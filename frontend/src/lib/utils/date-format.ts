/**
 * Central Safari-Safe Date & Time Formatting Utilities for Admin Console
 *
 * Prevents WebKit / iOS Safari RangeError exceptions caused by:
 * 1. Passing empty locale array `[]` to toLocaleDateString/toLocaleTimeString/toLocaleString
 * 2. Calling Intl formatters on Invalid Date instances
 * 3. Misparsing bare PostgreSQL SQL TIME values ("14:00:00")
 * 4. Misparsing Prisma serialized SQL TIME values ("1970-01-01T14:00:00.000Z")
 * 5. Undefined/null status string operations
 */

const DEFAULT_LOCALE = "en-US";

/**
 * Safely parses any input into a valid Date object.
 * Returns null if the value is null, undefined, empty, or unparseable.
 */
export function safeParseDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === "") {
    return null;
  }

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  if (typeof val === "string") {
    // Check for YYYY-MM-DD bare date format to avoid UTC timezone off-by-one shifts
    const bareDateMatch = val.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (bareDateMatch) {
      const year = parseInt(bareDateMatch[1], 10);
      const month = parseInt(bareDateMatch[2], 10) - 1;
      const day = parseInt(bareDateMatch[3], 10);
      if (month < 0 || month > 11 || day < 1 || day > 31) {
        return null;
      }
      const d = new Date(year, month, day);
      if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
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
 * - Full ISO timestamps: "2026-10-05T18:04:18.503Z"
 * - Date instances, null, undefined, malformed strings
 */
export function formatAdminDate(
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
    return d.toLocaleDateString(DEFAULT_LOCALE, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
