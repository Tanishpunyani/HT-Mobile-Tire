/**
 * Central Safari-Safe Date & Time Formatting Utilities for Admin Console
 *
 * Prevents WebKit / iOS Safari RangeError exceptions and hydration mismatches:
 * 1. Preserves calendar-date semantics for PostgreSQL DATE values ("2026-10-06", "2026-10-06T00:00:00.000Z")
 * 2. Preserves wall-clock time for bare SQL TIME ("14:00:00") and Prisma serialized SQL TIME ("1970-01-01T14:00:00.000Z")
 * 3. Enforces deterministic UTC formatting for timestamps across SSR and client hydration
 * 4. Passes explicit "en-US" locale (no empty arrays `[]`) to prevent Safari RangeError
 * 5. Handles null, undefined, and malformed inputs with 100% zero-throw guarantee
 */

const DEFAULT_LOCALE = "en-US";
const DEFAULT_TIMEZONE = "UTC";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
] as const;

const WEEKDAY_NAMES = [
  "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
] as const;

/**
 * Regex matching pure calendar dates:
 * - Bare SQL DATE: "2026-10-06"
 * - Prisma serialized PostgreSQL @db.Date: "2026-10-06T00:00:00.000Z", "2026-10-06T00:00:00Z", "2026-10-06T00:00:00"
 */
const CALENDAR_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?(?:Z|[+-]00:00)?)?$/i;

export interface FormatAdminDateOptions {
  includeWeekday?: boolean;
}

/**
 * Safely parses any input into a valid Date object.
 * Returns null if the value is null, undefined, empty, or unparseable.
 * Pure calendar dates are parsed as UTC midnight to prevent negative timezone off-by-one shifts.
 */
export function safeParseDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === "") {
    return null;
  }

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  if (typeof val === "string") {
    const trimmed = val.trim();

    // Check for pure calendar date (YYYY-MM-DD or Prisma UTC midnight)
    const calendarMatch = trimmed.match(CALENDAR_DATE_REGEX);
    if (calendarMatch) {
      const year = parseInt(calendarMatch[1], 10);
      const month = parseInt(calendarMatch[2], 10) - 1;
      const day = parseInt(calendarMatch[3], 10);
      if (month < 0 || month > 11 || day < 1 || day > 31) {
        return null;
      }
      // Construct UTC date to preserve calendar date semantics across all timezones
      const d = new Date(Date.UTC(year, month, day));
      if (
        d.getUTCFullYear() !== year ||
        d.getUTCMonth() !== month ||
        d.getUTCDate() !== day
      ) {
        return null;
      }
      return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Safely formats a time value into 12-hour format (e.g., "02:00 PM").
 *
 * Supports:
 * - Bare SQL TIME: "14:00:00", "12:00:00", "00:00:00", "16:30:00", "14:30"
 * - Prisma serialized SQL TIME: "1970-01-01T14:00:00.000Z"
 * - Full ISO timestamps: "2026-10-07T14:30:00Z"
 * - Date instances, null, undefined, malformed strings
 */
export function formatAdminTime(
  timeVal: unknown,
  fallback = ""
): string {
  if (timeVal === null || timeVal === undefined || timeVal === "") {
    return fallback;
  }

  if (typeof timeVal === "string") {
    const trimmed = timeVal.trim();

    // 1. Prisma serialized SQL TIME: "1970-01-01T14:00:00.000Z"
    // Preserves the literal wall-clock booking time without timezone shifts
    const prismaTimeMatch = trimmed.match(/^1970-01-01T(\d{1,2}):(\d{2})(?::\d{2})?/i);
    if (prismaTimeMatch) {
      const hours24 = parseInt(prismaTimeMatch[1], 10);
      const minutes = prismaTimeMatch[2];
      if (hours24 >= 0 && hours24 < 24) {
        const ampm = hours24 >= 12 ? "PM" : "AM";
        const hours12 = hours24 % 12 || 12;
        const paddedHours = String(hours12).padStart(2, "0");
        return `${paddedHours}:${minutes} ${ampm}`;
      }
    }

    // 2. Bare PostgreSQL SQL TIME: "14:00:00", "14:30", "00:00:00"
    const bareTimeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (bareTimeMatch) {
      const hours24 = parseInt(bareTimeMatch[1], 10);
      const minutes = bareTimeMatch[2];
      if (hours24 >= 0 && hours24 < 24) {
        const ampm = hours24 >= 12 ? "PM" : "AM";
        const hours12 = hours24 % 12 || 12;
        const paddedHours = String(hours12).padStart(2, "0");
        return `${paddedHours}:${minutes} ${ampm}`;
      }
      return trimmed;
    }
  }

  // 3. Full ISO timestamps or Date instances
  const d = safeParseDate(timeVal);
  if (!d) {
    return typeof timeVal === "string" ? timeVal : fallback;
  }

  try {
    return d.toLocaleTimeString(DEFAULT_LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: DEFAULT_TIMEZONE,
    });
  } catch {
    return fallback;
  }
}

/**
 * Safely formats a date value into human-readable format (e.g., "Oct 5, 2026").
 *
 * Supports:
 * - Bare SQL DATE: "2026-10-05"
 * - Prisma serialized calendar DATE: "2026-10-06T00:00:00.000Z"
 * - Full ISO timestamps: "2026-10-05T18:04:18.503Z"
 * - Date instances, null, undefined, malformed strings
 */
export function formatAdminDate(
  dateVal: unknown,
  fallback = "N/A",
  options?: FormatAdminDateOptions
): string {
  if (dateVal === null || dateVal === undefined || dateVal === "") {
    return fallback;
  }

  // 1. Direct calendar date parsing (preserves calendar date regardless of client timezone)
  if (typeof dateVal === "string") {
    const trimmed = dateVal.trim();
    const calendarMatch = trimmed.match(CALENDAR_DATE_REGEX);
    if (calendarMatch) {
      const year = parseInt(calendarMatch[1], 10);
      const monthIdx = parseInt(calendarMatch[2], 10) - 1;
      const day = parseInt(calendarMatch[3], 10);
      if (monthIdx >= 0 && monthIdx <= 11 && day >= 1 && day <= 31) {
        const monthName = MONTH_NAMES[monthIdx];
        if (options?.includeWeekday) {
          const weekdayIdx = new Date(Date.UTC(year, monthIdx, day)).getUTCDay();
          const weekday = WEEKDAY_NAMES[weekdayIdx];
          return `${weekday}, ${monthName} ${day}, ${year}`;
        }
        return `${monthName} ${day}, ${year}`;
      }
    }
  }

  // 2. Date instances or non-midnight ISO timestamps
  const d = safeParseDate(dateVal);
  if (!d) {
    return typeof dateVal === "string" ? dateVal : fallback;
  }

  try {
    const intlOptions: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: DEFAULT_TIMEZONE,
    };
    if (options?.includeWeekday) {
      intlOptions.weekday = "short";
    }
    return d.toLocaleDateString(DEFAULT_LOCALE, intlOptions);
  } catch {
    return fallback;
  }
}

/**
 * Safely formats a full date-time value (e.g., "Oct 5, 02:30 PM").
 *
 * Supports:
 * - Full ISO timestamps: "2026-09-13T11:17:20.342Z"
 * - Date instances, null, undefined, malformed strings
 */
export function formatAdminDateTime(
  dateVal: unknown,
  fallback = "N/A"
): string {
  if (dateVal === null || dateVal === undefined || dateVal === "") {
    return fallback;
  }

  const d = safeParseDate(dateVal);
  if (!d) {
    return typeof dateVal === "string" ? dateVal : fallback;
  }

  try {
    return d.toLocaleString(DEFAULT_LOCALE, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: DEFAULT_TIMEZONE,
    });
  } catch {
    return fallback;
  }
}

/**
 * Safely formats a database status enum (e.g., "in_progress" -> "in progress").
 * Guaranteed null-safe: will not throw if status is null or undefined.
 */
export function formatAdminStatus(
  statusVal: unknown,
  fallback = "pending"
): string {
  if (!statusVal || typeof statusVal !== "string") {
    return fallback;
  }
  return statusVal.replace(/_/g, " ");
}
