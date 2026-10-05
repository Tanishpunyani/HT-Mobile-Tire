/**
 * Centralized Timezone and 24/7 Slot Utility for HT Mobile Tire
 * Canonical Timezone: America/Toronto (Eastern Time: EST / EDT)
 */

export const SERVICE_TIMEZONE = "America/Toronto";

export interface TorontoDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
}

/**
 * Returns the decomposed date parts for a given Date in America/Toronto timezone.
 * Uses native Intl.DateTimeFormat to automatically handle DST without hardcoding offsets.
 */
export function getTorontoDateParts(date: Date = new Date()): TorontoDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SERVICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string): number => {
    const p = parts.find((part) => part.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };

  const hourRaw = getPart("hour");
  // Some Intl implementations output "24" for midnight; normalize to 0
  const hour = hourRaw === 24 ? 0 : hourRaw;

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour,
    minute: getPart("minute"),
    second: getPart("second"),
  };
}

/**
 * Returns current Toronto date in 'YYYY-MM-DD' ISO format.
 */
export function getTorontoTodayString(date: Date = new Date()): string {
  const { year, month, day } = getTorontoDateParts(date);
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns current minutes from midnight (0 - 1439) in America/Toronto.
 */
export function getTorontoCurrentMinutes(date: Date = new Date()): number {
  const { hour, minute } = getTorontoDateParts(date);
  return hour * 60 + minute;
}

/**
 * Parses a 12-hour or 24-hour time representation to minutes from midnight (0-1439).
 * Correctly handles AM/PM conversion:
 * 12:00 AM -> 0
 * 01:00 AM -> 60
 * 12:00 PM -> 720
 * 01:00 PM -> 780
 * 02:00 PM -> 840
 * 11:59 PM -> 1439
 */
export function parseTimeToMinutes(time: Date | string | null | undefined): number {
  if (!time) return 0;

  if (time instanceof Date) {
    return time.getUTCHours() * 60 + time.getUTCMinutes();
  }

  if (typeof time === "string") {
    const trimmed = time.trim();

    // 1. Check for 12-hour format: "HH:MM AM/PM"
    const match12 = trimmed.match(/^([0]?[1-9]|1[0-2]):([0-5][0-9])(?::([0-5][0-9]))?\s*(AM|PM)$/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = parseInt(match12[2], 10);
      const meridiem = match12[4].toUpperCase();

      if (meridiem === "PM" && hours !== 12) {
        hours += 12;
      } else if (meridiem === "AM" && hours === 12) {
        hours = 0;
      }

      return hours * 60 + minutes;
    }

    // 2. Check for 24-hour format: "HH:MM" or "HH:MM:SS"
    const match24 = trimmed.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])(?::([0-5][0-9]))?$/);
    if (match24) {
      const hours = parseInt(match24[1], 10);
      const minutes = parseInt(match24[2], 10);
      return hours * 60 + minutes;
    }

    // 3. Fallback for ISO strings
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    }
  }

  return 0;
}

/**
 * Checks whether a given appointment date and time slot is in the past
 * relative to the current time in America/Toronto.
 *
 * - Any date before today's Toronto date -> past (true)
 * - Any date after today's Toronto date -> not past (false)
 * - For today's Toronto date:
 *     slotStartMinutes <= currentTorontoMinutes -> past (true)
 */
export function isSlotInPast(
  dateStr: string,
  timeStr: string,
  referenceDate: Date = new Date()
): boolean {
  if (!dateStr || !timeStr) return true;

  const todayToronto = getTorontoTodayString(referenceDate);

  if (dateStr < todayToronto) {
    return true; // Past calendar date
  }

  if (dateStr > todayToronto) {
    return false; // Future calendar date
  }

  // Same day: compare minutes from midnight
  const slotMinutes = parseTimeToMinutes(timeStr);
  const currentMinutes = getTorontoCurrentMinutes(referenceDate);

  return slotMinutes <= currentMinutes;
}

/**
 * 2-Hour Slot Definition across 24 Hours (12 Slots total)
 */
export interface CanonicalSlot {
  value: string; // "08:00 AM" (Value stored in bookingTime)
  endTime: string; // "10:00 AM"
  label: string; // "08:00 AM – 10:00 AM (Morning)"
  startMinutes: number; // 480
  endMinutes: number; // 600
  durationMinutes: number; // 120
}

export const CANONICAL_2HOUR_SLOTS: CanonicalSlot[] = [
  {
    value: "12:00 AM",
    endTime: "02:00 AM",
    label: "12:00 AM – 02:00 AM (Overnight)",
    startMinutes: 0,
    endMinutes: 120,
    durationMinutes: 120,
  },
  {
    value: "02:00 AM",
    endTime: "04:00 AM",
    label: "02:00 AM – 04:00 AM (Overnight)",
    startMinutes: 120,
    endMinutes: 240,
    durationMinutes: 120,
  },
  {
    value: "04:00 AM",
    endTime: "06:00 AM",
    label: "04:00 AM – 06:00 AM (Early Morning)",
    startMinutes: 240,
    endMinutes: 360,
    durationMinutes: 120,
  },
  {
    value: "06:00 AM",
    endTime: "08:00 AM",
    label: "06:00 AM – 08:00 AM (Early Morning)",
    startMinutes: 360,
    endMinutes: 480,
    durationMinutes: 120,
  },
  {
    value: "08:00 AM",
    endTime: "10:00 AM",
    label: "08:00 AM – 10:00 AM (Morning)",
    startMinutes: 480,
    endMinutes: 600,
    durationMinutes: 120,
  },
  {
    value: "10:00 AM",
    endTime: "12:00 PM",
    label: "10:00 AM – 12:00 PM (Late Morning)",
    startMinutes: 600,
    endMinutes: 720,
    durationMinutes: 120,
  },
  {
    value: "12:00 PM",
    endTime: "02:00 PM",
    label: "12:00 PM – 02:00 PM (Midday)",
    startMinutes: 720,
    endMinutes: 840,
    durationMinutes: 120,
  },
  {
    value: "02:00 PM",
    endTime: "04:00 PM",
    label: "02:00 PM – 04:00 PM (Afternoon)",
    startMinutes: 840,
    endMinutes: 960,
    durationMinutes: 120,
  },
  {
    value: "04:00 PM",
    endTime: "06:00 PM",
    label: "04:00 PM – 06:00 PM (Late Afternoon)",
    startMinutes: 960,
    endMinutes: 1080,
    durationMinutes: 120,
  },
  {
    value: "06:00 PM",
    endTime: "08:00 PM",
    label: "06:00 PM – 08:00 PM (Evening)",
    startMinutes: 1080,
    endMinutes: 1200,
    durationMinutes: 120,
  },
  {
    value: "08:00 PM",
    endTime: "10:00 PM",
    label: "08:00 PM – 10:00 PM (Night)",
    startMinutes: 1200,
    endMinutes: 1320,
    durationMinutes: 120,
  },
  {
    value: "10:00 PM",
    endTime: "12:00 AM",
    label: "10:00 PM – 12:00 AM (Late Night)",
    startMinutes: 1320,
    endMinutes: 1440,
    durationMinutes: 120,
  },
];
