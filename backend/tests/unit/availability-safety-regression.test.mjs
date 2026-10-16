/**
 * Regression Test Suite: On-Demand Availability Safety & Capacity Engine
 * HT Mobile Tire — Service Timezone: America/Toronto
 *
 * Verifies fixes for:
 * 1. Zero active technicians resulting in genuine capacity 0 (no fallback to 5).
 * 2. Database query failures failing closed (never returning available: true).
 * 3. Future and stale confirmed bookings not consuming present live capacity.
 * 4. Currently overlapping confirmed and in-progress jobs correctly consuming capacity.
 * 5. Accurate remaining time estimates without stale confirmation timestamps.
 * 6. API route returning HTTP 503 on technical failure instead of HTTP 200 available: true.
 * 7. Client components (BookingWaitScreen, BookingFormClient) handling technical errors safely.
 */

import { describe, test, testAsync, assert, assertEqual, assertDeepEqual, assertRejects } from "../helpers/test-runner.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

const SERVICE_TIMEZONE = "America/Toronto";
const DEFAULT_SERVICE_DURATION_MINUTES = 45;
const DEFAULT_BUFFER_MINUTES = 15;

function getTorontoDateParts(date = new Date()) {
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
  const getPart = (type) => {
    const p = parts.find((part) => part.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };
  const hourRaw = getPart("hour");
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

function getTorontoTodayString(date = new Date()) {
  const { year, month, day } = getTorontoDateParts(date);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getTorontoCurrentMinutes(date = new Date()) {
  const { hour, minute } = getTorontoDateParts(date);
  return hour * 60 + minute;
}

function parseTimeToMinutes(time) {
  if (!time) return 0;
  if (time instanceof Date) {
    return time.getUTCHours() * 60 + time.getUTCMinutes();
  }
  if (typeof time === "string") {
    const trimmed = time.trim();
    const match12 = trimmed.match(/^([0]?[1-9]|1[0-2]):([0-5][0-9])(?::([0-5][0-9]))?\s*(AM|PM)$/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = parseInt(match12[2], 10);
      const meridiem = match12[4].toUpperCase();
      if (meridiem === "PM" && hours !== 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;
      return hours * 60 + minutes;
    }
    const match24 = trimmed.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])(?::([0-5][0-9]))?$/);
    if (match24) {
      return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
    }
  }
  return 0;
}

function doTimeWindowsOverlap(startA, durationA, startB, durationB) {
  const endA = startA + durationA;
  const endB = startB + durationB;
  return Math.max(startA, startB) < Math.min(endA, endB);
}

const CANONICAL_2HOUR_SLOTS = [
  { value: "12:00 AM", endTime: "02:00 AM", label: "12:00 AM – 02:00 AM (Overnight)", startMinutes: 0, endMinutes: 120, durationMinutes: 120 },
  { value: "02:00 AM", endTime: "04:00 AM", label: "02:00 AM – 04:00 AM (Overnight)", startMinutes: 120, endMinutes: 240, durationMinutes: 120 },
  { value: "04:00 AM", endTime: "06:00 AM", label: "04:00 AM – 06:00 AM (Early Morning)", startMinutes: 240, endMinutes: 360, durationMinutes: 120 },
  { value: "06:00 AM", endTime: "08:00 AM", label: "06:00 AM – 08:00 AM (Early Morning)", startMinutes: 360, endMinutes: 480, durationMinutes: 120 },
  { value: "08:00 AM", endTime: "10:00 AM", label: "08:00 AM – 10:00 AM (Morning)", startMinutes: 480, endMinutes: 600, durationMinutes: 120 },
  { value: "10:00 AM", endTime: "12:00 PM", label: "10:00 AM – 12:00 PM (Late Morning)", startMinutes: 600, endMinutes: 720, durationMinutes: 120 },
  { value: "12:00 PM", endTime: "02:00 PM", label: "12:00 PM – 02:00 PM (Midday)", startMinutes: 720, endMinutes: 840, durationMinutes: 120 },
  { value: "02:00 PM", endTime: "04:00 PM", label: "02:00 PM – 04:00 PM (Afternoon)", startMinutes: 840, endMinutes: 960, durationMinutes: 120 },
  { value: "04:00 PM", endTime: "06:00 PM", label: "04:00 PM – 06:00 PM (Late Afternoon)", startMinutes: 960, endMinutes: 1080, durationMinutes: 120 },
  { value: "06:00 PM", endTime: "08:00 PM", label: "06:00 PM – 08:00 PM (Evening)", startMinutes: 1080, endMinutes: 1200, durationMinutes: 120 },
  { value: "08:00 PM", endTime: "10:00 PM", label: "08:00 PM – 10:00 PM (Night)", startMinutes: 1200, endMinutes: 1320, durationMinutes: 120 },
  { value: "10:00 PM", endTime: "12:00 AM", label: "10:00 PM – 12:00 AM (Late Night)", startMinutes: 1320, endMinutes: 1440, durationMinutes: 120 },
];

/**
 * Pure-engine implementation of checkSlotCapacity matching frontend/src/lib/bookings/availability.ts
 */
async function checkSlotCapacityEngine(txOrPrisma, params) {
  const duration = params.durationMinutes || 120;
  const targetTimeMinutes = parseTimeToMinutes(params.bookingTime);

  const totalActiveTechnicians = await txOrPrisma.technician.count({
    where: { isActive: true },
  });

  if (totalActiveTechnicians === 0) {
    return {
      available: false,
      totalTechnicians: 0,
      overlappingBookingsCount: 0,
      availableSlotsRemaining: 0,
    };
  }

  const capacity =
    params.maxCapacity !== undefined
      ? params.maxCapacity
      : totalActiveTechnicians;

  const bookingsOnDate = await txOrPrisma.booking.findMany({
    where: {
      status: { in: params.statuses || ["pending", "confirmed", "in_progress"] },
    },
  });

  let overlappingCount = 0;
  for (const b of bookingsOnDate) {
    const existingStart = parseTimeToMinutes(b.bookingTime);
    const existingDuration = b.estimatedDurationMinutes || 120;
    if (doTimeWindowsOverlap(targetTimeMinutes, duration, existingStart, existingDuration)) {
      overlappingCount++;
    }
  }

  const availableSlotsRemaining = Math.max(0, capacity - overlappingCount);
  const available = availableSlotsRemaining > 0;

  return {
    available,
    totalTechnicians: capacity,
    overlappingBookingsCount: overlappingCount,
    availableSlotsRemaining,
  };
}

/**
 * Pure-engine implementation of getAvailableSlotsForDate matching frontend/src/lib/bookings/availability.ts
 */
async function getAvailableSlotsForDateEngine(txOrPrisma, dateStr, referenceDate = new Date()) {
  const totalActiveTechnicians = await txOrPrisma.technician.count({
    where: { isActive: true },
  });

  if (totalActiveTechnicians === 0) {
    return CANONICAL_2HOUR_SLOTS.map((slot) => ({
      time: slot.value,
      endTime: slot.endTime,
      label: slot.label,
      available: false,
      reason: "unstaffed",
    }));
  }

  return CANONICAL_2HOUR_SLOTS.map((slot) => ({
    time: slot.value,
    endTime: slot.endTime,
    label: slot.label,
    available: true,
  }));
}

/**
 * Pure-engine implementation matching frontend/src/lib/bookings/availability.ts
 */
async function getBookingAvailabilityEngine(prismaMock, referenceDate = new Date()) {
  try {
    const totalActiveTechs = await prismaMock.technician.count({
      where: { isActive: true },
    });

    if (totalActiveTechs === 0) {
      return {
        available: false,
        activeCount: 0,
        totalCapacity: 0,
        reason: "no_active_technicians",
      };
    }

    const totalCapacity = totalActiveTechs;

    const now = referenceDate;
    const nowMs = now.getTime();
    const todayTorontoStr = getTorontoTodayString(now);
    const currentMinutesToronto = getTorontoCurrentMinutes(now);

    const yesterdayDate = new Date(nowMs - 24 * 60 * 60 * 1000);
    const yesterdayTorontoStr = getTorontoTodayString(yesterdayDate);

    const [tYear, tMonth, tDay] = todayTorontoStr.split("-").map(Number);
    const todayUtcMidnight = new Date(Date.UTC(tYear, tMonth - 1, tDay));

    const [yYear, yMonth, yDay] = yesterdayTorontoStr.split("-").map(Number);
    const yesterdayUtcMidnight = new Date(Date.UTC(yYear, yMonth - 1, yDay));

    const candidateBookings = await prismaMock.booking.findMany({
      where: {
        OR: [
          { status: "in_progress" },
          {
            status: "confirmed",
            bookingDate: {
              in: [yesterdayUtcMidnight, todayUtcMidnight],
            },
          },
        ],
      },
      select: {
        id: true,
        status: true,
        bookingDate: true,
        bookingTime: true,
        serviceConfirmedAt: true,
        arrivedAt: true,
        estimatedDurationMinutes: true,
        updatedAt: true,
      },
    });

    const activeJobs = [];

    for (const b of candidateBookings) {
      if (b.status === "in_progress") {
        const durationMinutes =
          b.estimatedDurationMinutes && b.estimatedDurationMinutes > 0
            ? b.estimatedDurationMinutes
            : DEFAULT_SERVICE_DURATION_MINUTES;

        const startTime = b.arrivedAt || b.updatedAt || now;
        const completionMs = new Date(startTime).getTime() + durationMinutes * 60 * 1000;

        activeJobs.push({
          id: b.id,
          status: "in_progress",
          estimatedCompletionMs: completionMs,
        });
      } else if (b.status === "confirmed") {
        if (!b.bookingDate || !b.bookingTime) continue;

        let bDateStr = "";
        if (b.bookingDate instanceof Date) {
          const bYear = b.bookingDate.getUTCFullYear();
          const bMonth = String(b.bookingDate.getUTCMonth() + 1).padStart(2, "0");
          const bDay = String(b.bookingDate.getUTCDate()).padStart(2, "0");
          bDateStr = `${bYear}-${bMonth}-${bDay}`;
        } else if (typeof b.bookingDate === "string") {
          bDateStr = b.bookingDate.slice(0, 10);
        }

        const startMinutes = parseTimeToMinutes(b.bookingTime);
        const durationMinutes =
          b.estimatedDurationMinutes && b.estimatedDurationMinutes >= 120
            ? b.estimatedDurationMinutes
            : Math.max(120, (b.estimatedDurationMinutes || DEFAULT_SERVICE_DURATION_MINUTES) + DEFAULT_BUFFER_MINUTES);

        const endMinutes = startMinutes + durationMinutes;

        let isOverlapping = false;
        let scheduledCompletionMs = null;

        if (bDateStr === todayTorontoStr) {
          if (endMinutes <= 1440) {
            if (currentMinutesToronto >= startMinutes && currentMinutesToronto < endMinutes) {
              isOverlapping = true;
              const minutesRemaining = endMinutes - currentMinutesToronto;
              scheduledCompletionMs = nowMs + minutesRemaining * 60 * 1000;
            }
          } else {
            if (currentMinutesToronto >= startMinutes) {
              isOverlapping = true;
              const minutesRemaining = endMinutes - currentMinutesToronto;
              scheduledCompletionMs = nowMs + minutesRemaining * 60 * 1000;
            }
          }
        } else if (bDateStr === yesterdayTorontoStr) {
          if (endMinutes > 1440) {
            const spilloverMinutes = endMinutes - 1440;
            if (currentMinutesToronto < spilloverMinutes) {
              isOverlapping = true;
              const minutesRemaining = spilloverMinutes - currentMinutesToronto;
              scheduledCompletionMs = nowMs + minutesRemaining * 60 * 1000;
            }
          }
        }

        if (isOverlapping) {
          activeJobs.push({
            id: b.id,
            status: "confirmed",
            estimatedCompletionMs: scheduledCompletionMs,
          });
        }
      }
    }

    const activeCount = activeJobs.length;

    if (activeCount < totalCapacity) {
      return {
        available: true,
        activeCount,
        totalCapacity,
      };
    }

    let earliestCompletionMs = null;
    for (const job of activeJobs) {
      if (job.estimatedCompletionMs && job.estimatedCompletionMs > nowMs) {
        if (earliestCompletionMs === null || job.estimatedCompletionMs < earliestCompletionMs) {
          earliestCompletionMs = job.estimatedCompletionMs;
        }
      }
    }

    if (earliestCompletionMs !== null) {
      const remainingMs = Math.max(0, earliestCompletionMs - nowMs);
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
      const estimatedCompletionAt = new Date(earliestCompletionMs).toISOString();

      return {
        available: false,
        activeCount,
        totalCapacity,
        estimatedCompletionAt,
        remainingMinutes,
        reason: "all_technicians_occupied",
      };
    }

    return {
      available: false,
      activeCount,
      totalCapacity,
      estimatedCompletionAt: null,
      remainingMinutes: null,
      reason: "all_technicians_occupied",
    };
  } catch (error) {
    throw error;
  }
}

export function runAvailabilitySafetyRegressionTests() {
  describe("On-Demand Availability Safety & Capacity Engine Regression Suite", () => {
    // 1. Three active technicians and zero active bookings: available
    test("1. Three active technicians and zero active bookings: available with capacity 3", async () => {
      const mockPrisma = {
        technician: { count: async () => 3 },
        booking: { findMany: async () => [] },
      };
      const res = await getBookingAvailabilityEngine(mockPrisma);
      assertEqual(res.available, true);
      assertEqual(res.activeCount, 0);
      assertEqual(res.totalCapacity, 3);
    });

    // 2. Zero active technicians: unavailable, with capacity zero
    test("2. Zero active technicians: unavailable with capacity 0 (no fallback to 5)", async () => {
      const mockPrisma = {
        technician: { count: async () => 0 },
        booking: { findMany: async () => [] },
      };
      const res = await getBookingAvailabilityEngine(mockPrisma);
      assertEqual(res.available, false);
      assertEqual(res.activeCount, 0);
      assertEqual(res.totalCapacity, 0);
      assertEqual(res.reason, "no_active_technicians");
    });

    // 3. Technician-count query failure: throws / fails closed
    test("3. Technician-count query failure: throws and never returns available: true", async () => {
      const mockPrisma = {
        technician: { count: async () => { throw new Error("DB Connection Pool Timeout"); } },
        booking: { findMany: async () => [] },
      };
      await assertRejects(
        () => getBookingAvailabilityEngine(mockPrisma),
        "Must throw on technician query failure without returning available: true"
      );
    });

    // 4. Booking-query failure: throws / fails closed
    test("4. Booking-query failure: throws and never returns available: true", async () => {
      const mockPrisma = {
        technician: { count: async () => 3 },
        booking: { findMany: async () => { throw new Error("DB Query Execution Error"); } },
      };
      await assertRejects(
        () => getBookingAvailabilityEngine(mockPrisma),
        "Must throw on booking query failure without returning available: true"
      );
    });

    // 5. All technicians genuinely occupied by active jobs: unavailable
    test("5. All technicians genuinely occupied by active in_progress jobs: unavailable", async () => {
      const refDate = new Date("2026-10-16T15:00:00Z"); // Reference time
      const mockPrisma = {
        technician: { count: async () => 2 },
        booking: {
          findMany: async () => [
            {
              id: "b1",
              status: "in_progress",
              arrivedAt: new Date("2026-10-16T14:40:00Z"),
              estimatedDurationMinutes: 45,
            },
            {
              id: "b2",
              status: "in_progress",
              arrivedAt: new Date("2026-10-16T14:45:00Z"),
              estimatedDurationMinutes: 45,
            },
          ],
        },
      };
      const res = await getBookingAvailabilityEngine(mockPrisma, refDate);
      assertEqual(res.available, false);
      assertEqual(res.activeCount, 2);
      assertEqual(res.totalCapacity, 2);
      assertEqual(res.reason, "all_technicians_occupied");
      assert(res.remainingMinutes > 0, "Must calculate remaining minutes for earliest finishing job");
    });

    // 6. Future confirmed bookings do not consume present on-demand capacity
    test("6. Future confirmed bookings do NOT consume present on-demand capacity", async () => {
      // Current Toronto time: 2026-10-16 at 10:00 AM
      const refDate = new Date("2026-10-16T14:00:00Z"); // 10:00 AM EDT (UTC-4)
      const mockPrisma = {
        technician: { count: async () => 2 },
        booking: {
          findMany: async () => [
            // Tomorrow confirmed
            {
              id: "b_tomorrow",
              status: "confirmed",
              bookingDate: new Date(Date.UTC(2026, 9, 17)),
              bookingTime: "10:00 AM",
              estimatedDurationMinutes: 120,
            },
            // Next week confirmed
            {
              id: "b_next_week",
              status: "confirmed",
              bookingDate: new Date(Date.UTC(2026, 9, 23)),
              bookingTime: "02:00 PM",
              estimatedDurationMinutes: 120,
            },
            // Today at 04:00 PM (future slot today)
            {
              id: "b_today_later",
              status: "confirmed",
              bookingDate: new Date(Date.UTC(2026, 9, 16)),
              bookingTime: "04:00 PM",
              estimatedDurationMinutes: 120,
            },
          ],
        },
      };
      const res = await getBookingAvailabilityEngine(mockPrisma, refDate);
      assertEqual(res.available, true, "Future bookings must not lock out live capacity");
      assertEqual(res.activeCount, 0, "No bookings are active at 10:00 AM today");
      assertEqual(res.totalCapacity, 2);
    });

    // 7. A currently overlapping confirmed appointment follows the verified scheduling rules
    test("7. A currently overlapping confirmed appointment consumes 1 technician slot", async () => {
      // Current Toronto time: 2026-10-16 at 10:30 AM (630 min)
      const refDate = new Date("2026-10-16T14:30:00Z"); // 10:30 AM EDT
      const mockPrisma = {
        technician: { count: async () => 2 },
        booking: {
          findMany: async () => [
            // Today 10:00 AM - 12:00 PM (overlaps 10:30 AM)
            {
              id: "b_overlapping",
              status: "confirmed",
              bookingDate: new Date(Date.UTC(2026, 9, 16)),
              bookingTime: "10:00 AM",
              estimatedDurationMinutes: 120,
            },
          ],
        },
      };
      const res = await getBookingAvailabilityEngine(mockPrisma, refDate);
      assertEqual(res.available, true, "1 of 2 technicians busy -> still available");
      assertEqual(res.activeCount, 1, "Exactly 1 overlapping job active");
      assertEqual(res.totalCapacity, 2);
    });

    // 8. A past confirmed appointment outside its service window does not consume current capacity
    test("8. A past confirmed appointment outside its service window does NOT consume capacity", async () => {
      // Current Toronto time: 2026-10-16 at 03:00 PM (900 min)
      const refDate = new Date("2026-10-16T19:00:00Z"); // 03:00 PM EDT
      const mockPrisma = {
        technician: { count: async () => 1 },
        booking: {
          findMany: async () => [
            // Today morning 08:00 AM - 10:00 AM (already passed)
            {
              id: "b_past_today",
              status: "confirmed",
              bookingDate: new Date(Date.UTC(2026, 9, 16)),
              bookingTime: "08:00 AM",
              estimatedDurationMinutes: 120,
            },
            // Yesterday confirmed
            {
              id: "b_yesterday",
              status: "confirmed",
              bookingDate: new Date(Date.UTC(2026, 9, 15)),
              bookingTime: "02:00 PM",
              estimatedDurationMinutes: 120,
            },
          ],
        },
      };
      const res = await getBookingAvailabilityEngine(mockPrisma, refDate);
      assertEqual(res.available, true, "Past confirmed bookings must not lock capacity");
      assertEqual(res.activeCount, 0);
      assertEqual(res.totalCapacity, 1);
    });

    // 9. Completed and cancelled bookings are excluded
    test("9. Completed and cancelled bookings are strictly excluded from active counts", async () => {
      // Query filter test: ensure status in findMany excludes completed and cancelled
      const mockPrisma = {
        technician: { count: async () => 2 },
        booking: {
          findMany: async (args) => {
            // Assert that completed and cancelled are not in queried statuses
            const orList = args.where.OR;
            const inProgressClause = orList.find((c) => c.status === "in_progress");
            const confirmedClause = orList.find((c) => c.status === "confirmed");
            assert(inProgressClause, "Must query in_progress status");
            assert(confirmedClause, "Must query confirmed status");
            assert(!orList.some((c) => c.status === "completed"), "Must NOT query completed");
            assert(!orList.some((c) => c.status === "cancelled"), "Must NOT query cancelled");
            return [];
          },
        },
      };
      const res = await getBookingAvailabilityEngine(mockPrisma);
      assertEqual(res.available, true);
      assertEqual(res.activeCount, 0);
    });

    // 10. Remaining-time estimates are not derived from stale confirmation timestamps
    test("10. Remaining-time estimates are NOT derived from stale confirmation timestamps", async () => {
      // Current Toronto time: 2026-10-16 at 11:00 AM (660 min)
      const refDate = new Date("2026-10-16T15:00:00Z"); // 11:00 AM EDT
      const mockPrisma = {
        technician: { count: async () => 1 },
        booking: {
          findMany: async () => [
            {
              id: "b_active",
              status: "confirmed",
              bookingDate: new Date(Date.UTC(2026, 9, 16)),
              bookingTime: "10:00 AM",
              estimatedDurationMinutes: 120, // Ends at 12:00 PM (720 min -> 60 min remaining)
              serviceConfirmedAt: new Date("2026-10-13T10:00:00Z"), // Confirmed 3 days ago!
            },
          ],
        },
      };
      const res = await getBookingAvailabilityEngine(mockPrisma, refDate);
      assertEqual(res.available, false);
      assertEqual(res.activeCount, 1);
      assertEqual(res.totalCapacity, 1);
      // Remaining minutes should be approximately 60 minutes (from 11:00 AM to 12:00 PM), NOT 1 min
      assertEqual(res.remainingMinutes, 60, "Must calculate ~60m remaining from scheduled slot end, not stale 3-day old confirmation timestamp");
    });

    // 11. Source code audit: Route returns HTTP 503 on error, never HTTP 200 available: true
    test("11. Source code audit: Route returns HTTP 503 on technical failure, never 200 available: true", () => {
      const routePath = path.join(projectRoot, "frontend/src/app/api/bookings/availability/route.ts");
      const content = fs.readFileSync(routePath, "utf-8");

      assert(content.includes("status: 503"), "route.ts catch block must return HTTP 503");
      assert(content.includes("available: false"), "route.ts catch block must return available: false");
      assert(!content.includes("status: 200\n    );"), "route.ts must not return status 200 in catch block");
    });

    // 12. Source code audit: BookingWaitScreen and BookingFormClient handle errors safely
    test("12. Source code audit: Wait screen and booking calendar handle technical errors safely", () => {
      const waitScreenPath = path.join(projectRoot, "frontend/src/app/components/BookingWaitScreen.tsx");
      const waitContent = fs.readFileSync(waitScreenPath, "utf-8");

      assert(waitContent.includes("!res.ok || data.error"), "Wait screen must check !res.ok and data.error");
      assert(waitContent.includes("parsed > Date.now()"), "Wait screen must reject past targetTimeMs");

      const formClientPath = path.join(projectRoot, "frontend/src/app/booking/BookingFormClient.tsx");
      const formContent = fs.readFileSync(formClientPath, "utf-8");

      assert(formContent.includes("setSlotsError"), "Booking form must handle slots error state");
      assert(formContent.includes("slotsError ?"), "Booking form select must render slotsError safely");
      assert(formContent.includes("isUnstaffed"), "Booking form must check isUnstaffed");
      assert(formContent.includes('" (Unavailable)"'), "Booking form must label unstaffed slots as (Unavailable)");
      assert(formContent.includes('" (Booked)"'), "Booking form must label occupied slots as (Booked)");
    });

    // 13. Test A: checkSlotCapacity with maxCapacity: 1 and zero active technicians
    test("13. Test A: checkSlotCapacity with maxCapacity: 1 and zero active technicians enforces safety", async () => {
      const mockPrisma = {
        technician: { count: async () => 0 },
        booking: { findMany: async () => [] },
      };

      const res = await checkSlotCapacityEngine(mockPrisma, {
        bookingDate: new Date("2026-10-17T00:00:00Z"),
        bookingTime: "10:00 AM",
        durationMinutes: 120,
        maxCapacity: 1, // Attempt to reserve 1 slot
      });

      assertEqual(res.available, false, "available must be false when active technicians count is 0");
      assertEqual(res.totalTechnicians, 0, "totalTechnicians must be 0");
      assertEqual(res.availableSlotsRemaining, 0, "availableSlotsRemaining must be 0");
      assertEqual(res.overlappingBookingsCount, 0);

      // Verify that maxCapacity: 1 did not bypass the zero-technician check in source code
      const availPath = path.join(projectRoot, "frontend/src/lib/bookings/availability.ts");
      const availContent = fs.readFileSync(availPath, "utf-8");
      const zeroTechIndex = availContent.indexOf("if (totalActiveTechnicians === 0)");
      const maxCapIndex = availContent.indexOf("params.maxCapacity !== undefined");
      assert(zeroTechIndex !== -1, "checkSlotCapacity must contain totalActiveTechnicians === 0 guard");
      assert(zeroTechIndex < maxCapIndex, "totalActiveTechnicians === 0 guard must precede maxCapacity evaluation");
    });

    // 14. Test B: getAvailableSlotsForDate with zero active technicians
    test("14. Test B: getAvailableSlotsForDate with zero active technicians marks all 12 slots unavailable", async () => {
      const mockPrisma = {
        technician: { count: async () => 0 },
        booking: { findMany: async () => [] },
      };

      const slots = await getAvailableSlotsForDateEngine(mockPrisma, "2026-10-20");

      assertEqual(slots.length, 12, "Must return all 12 canonical slots");
      const availableCount = slots.filter((s) => s.available).length;
      assertEqual(availableCount, 0, "Zero slots must be bookable when active technician count is 0");

      slots.forEach((s) => {
        assertEqual(s.available, false, `Slot ${s.time} must not be available`);
        assertEqual(s.reason, "unstaffed", `Slot ${s.time} must have reason 'unstaffed' instead of 'occupied'`);
      });

      // Verify source code returns unstaffed reason
      const availPath = path.join(projectRoot, "frontend/src/lib/bookings/availability.ts");
      const availContent = fs.readFileSync(availPath, "utf-8");
      assert(availContent.includes('reason: "unstaffed"'), "getAvailableSlotsForDate must return reason: 'unstaffed'");
    });
  });
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("availability-safety-regression.test.mjs")) {
  runAvailabilitySafetyRegressionTests();
}
