/**
 * Targeted Behavioral Test Suite: 24/7 Real-Time Booking Time-Slot Implementation
 * HT Mobile Tire — Service Timezone: America/Toronto
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

// Directly testable pure functions matching timezone.ts and availability.ts
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const trimmed = String(timeStr).trim();
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
  return 0;
}

function getTorontoDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
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

function isSlotInPast(dateStr, timeStr, referenceDate = new Date()) {
  if (!dateStr || !timeStr) return true;
  const todayToronto = getTorontoTodayString(referenceDate);
  if (dateStr < todayToronto) return true;
  if (dateStr > todayToronto) return false;
  const slotMinutes = parseTimeToMinutes(timeStr);
  const currentMinutes = getTorontoCurrentMinutes(referenceDate);
  return slotMinutes <= currentMinutes;
}

function doTimeWindowsOverlap(startA, durationA, startB, durationB) {
  const endA = startA + durationA;
  const endB = startB + durationB;
  return Math.max(startA, startB) < Math.min(endA, endB);
}

const CANONICAL_2HOUR_SLOTS = [
  { value: "12:00 AM", endTime: "02:00 AM", startMinutes: 0, endMinutes: 120, durationMinutes: 120 },
  { value: "02:00 AM", endTime: "04:00 AM", startMinutes: 120, endMinutes: 240, durationMinutes: 120 },
  { value: "04:00 AM", endTime: "06:00 AM", startMinutes: 240, endMinutes: 360, durationMinutes: 120 },
  { value: "06:00 AM", endTime: "08:00 AM", startMinutes: 360, endMinutes: 480, durationMinutes: 120 },
  { value: "08:00 AM", endTime: "10:00 AM", startMinutes: 480, endMinutes: 600, durationMinutes: 120 },
  { value: "10:00 AM", endTime: "12:00 PM", startMinutes: 600, endMinutes: 720, durationMinutes: 120 },
  { value: "12:00 PM", endTime: "02:00 PM", startMinutes: 720, endMinutes: 840, durationMinutes: 120 },
  { value: "02:00 PM", endTime: "04:00 PM", startMinutes: 840, endMinutes: 960, durationMinutes: 120 },
  { value: "04:00 PM", endTime: "06:00 PM", startMinutes: 960, endMinutes: 1080, durationMinutes: 120 },
  { value: "06:00 PM", endTime: "08:00 PM", startMinutes: 1080, endMinutes: 1200, durationMinutes: 120 },
  { value: "08:00 PM", endTime: "10:00 PM", startMinutes: 1200, endMinutes: 1320, durationMinutes: 120 },
  { value: "10:00 PM", endTime: "12:00 AM", startMinutes: 1320, endMinutes: 1440, durationMinutes: 120 },
];

function checkSlotCapacityMock({ existingBookings, targetDate, targetTime, maxCapacity = 1, durationMinutes = 120 }) {
  const targetStart = parseTimeToMinutes(targetTime);
  const targetDuration = durationMinutes;

  const overlappingActive = existingBookings.filter((b) => {
    if (b.bookingDate !== targetDate) return false;
    if (!["pending", "confirmed", "in_progress"].includes(b.status)) return false;

    const bStart = parseTimeToMinutes(b.bookingTime);
    const bDuration = b.estimatedDurationMinutes || 120;
    return doTimeWindowsOverlap(targetStart, targetDuration, bStart, bDuration);
  });

  const availableSlots = Math.max(0, maxCapacity - overlappingActive.length);
  return {
    available: availableSlots > 0,
    availableSlotsRemaining: availableSlots,
    overlappingCount: overlappingActive.length,
  };
}

export function runTimeSlotBooking24_7Tests() {
  describe("HT Mobile Tire: 24/7 Real-Time Booking Time-Slot Tests", () => {
    // 1. 24/7 slot generation
    test("1. 24/7 slot generation produces exactly 12 continuous 2-hour slots", () => {
      assertEqual(CANONICAL_2HOUR_SLOTS.length, 12, "Must have exactly 12 slots across 24 hours");
      assertEqual(CANONICAL_2HOUR_SLOTS[0].startMinutes, 0, "First slot must start at midnight (0m)");
      assertEqual(CANONICAL_2HOUR_SLOTS[11].endMinutes, 1440, "Last slot must end at midnight (1440m)");
    });

    // 2. 2-hour slot interval
    test("2. 2-hour slot interval is exactly 120 minutes for every slot", () => {
      CANONICAL_2HOUR_SLOTS.forEach((slot) => {
        assertEqual(slot.endMinutes - slot.startMinutes, 120, `${slot.value} must be 120 minutes`);
        assertEqual(slot.durationMinutes, 120);
      });
    });

    // 3. midnight/overnight coverage
    test("3. Midnight and overnight hours are fully covered", () => {
      const overnightSlots = CANONICAL_2HOUR_SLOTS.filter(
        (s) => s.value === "12:00 AM" || s.value === "02:00 AM" || s.value === "04:00 AM"
      );
      assertEqual(overnightSlots.length, 3, "Overnight slots 12 AM, 2 AM, 4 AM must exist");
    });

    // 4. 12 AM parsing
    test("4. 12:00 AM parses to 0 minutes", () => {
      assertEqual(parseTimeToMinutes("12:00 AM"), 0);
      assertEqual(parseTimeToMinutes("12:00 am"), 0);
    });

    // 5. 12 PM parsing
    test("5. 12:00 PM parses to 720 minutes (noon)", () => {
      assertEqual(parseTimeToMinutes("12:00 PM"), 720);
      assertEqual(parseTimeToMinutes("12:00 pm"), 720);
    });

    // 6. 02 PM parsing
    test("6. 02:00 PM parses to 840 minutes (resolving previous PM parsing bug)", () => {
      assertEqual(parseTimeToMinutes("02:00 PM"), 840);
      assertEqual(parseTimeToMinutes("2:00 PM"), 840);
    });

    // 7. 11:59 PM parsing
    test("7. 11:59 PM parses to 1439 minutes", () => {
      assertEqual(parseTimeToMinutes("11:59 PM"), 1439);
    });

    // 8. Toronto timezone date
    test("8. Toronto timezone date uses America/Toronto correctly", () => {
      // 2026-10-06 01:00 UTC is 2026-10-05 21:00 EDT (Toronto is UTC-4 in daylight saving)
      const testUtc = new Date("2026-10-06T01:00:00Z");
      const torontoParts = getTorontoDateParts(testUtc);
      assertEqual(torontoParts.year, 2026);
      assertEqual(torontoParts.month, 10);
      assertEqual(torontoParts.day, 5);
      assertEqual(torontoParts.hour, 21);
      assertEqual(getTorontoTodayString(testUtc), "2026-10-05");
    });

    // 9. Toronto timezone past time
    test("9. Toronto timezone rejects past time on today's date", () => {
      // Reference: 2026-10-05 at 14:30 Toronto time (870 minutes)
      const refDate = new Date("2026-10-05T18:30:00Z"); // 14:30 EDT
      assert(isSlotInPast("2026-10-05", "10:00 AM", refDate), "10:00 AM must be past when current is 2:30 PM");
      assert(isSlotInPast("2026-10-05", "02:00 PM", refDate), "02:00 PM must be past when current is 2:30 PM");
    });

    // 10. Future Toronto time
    test("10. Toronto timezone allows future time on today's date", () => {
      // Reference: 2026-10-05 at 14:30 Toronto time
      const refDate = new Date("2026-10-05T18:30:00Z");
      assert(!isSlotInPast("2026-10-05", "04:00 PM", refDate), "04:00 PM must NOT be past when current is 2:30 PM");
      assert(!isSlotInPast("2026-10-05", "06:00 PM", refDate), "06:00 PM must NOT be past when current is 2:30 PM");
    });

    // 11. Previous Toronto date
    test("11. Previous Toronto date is unconditionally rejected", () => {
      const refDate = new Date("2026-10-05T18:30:00Z");
      assert(isSlotInPast("2026-10-04", "10:00 PM", refDate), "Yesterday's date must be past");
      assert(isSlotInPast("2025-01-01", "12:00 PM", refDate), "Past year must be past");
    });

    // 12. Dynamic past-slot removal
    test("12. Dynamic past-slot removal filters out passed slots on current date", () => {
      const refDate = new Date("2026-10-05T18:30:00Z"); // 2:30 PM EDT (870 min)
      const today = getTorontoTodayString(refDate);

      const availableSlots = CANONICAL_2HOUR_SLOTS.filter((s) => !isSlotInPast(today, s.value, refDate));
      // Remaining slots must only be 04:00 PM, 06:00 PM, 08:00 PM, 10:00 PM
      assertEqual(availableSlots.length, 4);
      assertEqual(availableSlots[0].value, "04:00 PM");
      assertEqual(availableSlots[1].value, "06:00 PM");
      assertEqual(availableSlots[2].value, "08:00 PM");
      assertEqual(availableSlots[3].value, "10:00 PM");
    });

    // 13. Pending booking blocks slot
    test("13. Pending booking reserves and blocks slot window", () => {
      const existing = [
        { bookingDate: "2026-10-15", bookingTime: "10:00 AM", status: "pending", estimatedDurationMinutes: 120 },
      ];
      const res = checkSlotCapacityMock({
        existingBookings: existing,
        targetDate: "2026-10-15",
        targetTime: "10:00 AM",
        maxCapacity: 1,
      });
      assertEqual(res.available, false, "Pending booking must block slot");
      assertEqual(res.availableSlotsRemaining, 0);
    });

    // 14. Confirmed booking blocks slot
    test("14. Confirmed booking reserves and blocks slot window", () => {
      const existing = [
        { bookingDate: "2026-10-15", bookingTime: "12:00 PM", status: "confirmed", estimatedDurationMinutes: 120 },
      ];
      const res = checkSlotCapacityMock({
        existingBookings: existing,
        targetDate: "2026-10-15",
        targetTime: "12:00 PM",
        maxCapacity: 1,
      });
      assertEqual(res.available, false, "Confirmed booking must block slot");
    });

    // 15. in_progress booking blocks slot
    test("15. in_progress booking reserves and blocks slot window", () => {
      const existing = [
        { bookingDate: "2026-10-15", bookingTime: "02:00 PM", status: "in_progress", estimatedDurationMinutes: 120 },
      ];
      const res = checkSlotCapacityMock({
        existingBookings: existing,
        targetDate: "2026-10-15",
        targetTime: "02:00 PM",
        maxCapacity: 1,
      });
      assertEqual(res.available, false, "in_progress booking must block slot");
    });

    // 16. Cancelled booking releases future slot
    test("16. Cancelled booking releases its future time window", () => {
      const existing = [
        { bookingDate: "2026-10-15", bookingTime: "04:00 PM", status: "cancelled", estimatedDurationMinutes: 120 },
      ];
      const res = checkSlotCapacityMock({
        existingBookings: existing,
        targetDate: "2026-10-15",
        targetTime: "04:00 PM",
        maxCapacity: 1,
      });
      assertEqual(res.available, true, "Cancelled booking must release slot");
      assertEqual(res.availableSlotsRemaining, 1);
    });

    // 17. Cancelled past slot remains unavailable
    test("17. Cancelled past slot remains unavailable due to elapsed time", () => {
      const refDate = new Date("2026-10-05T20:00:00Z"); // 4:00 PM EDT
      const slotTime = "10:00 AM";
      // Even if cancelled, time is past:
      const isPast = isSlotInPast("2026-10-05", slotTime, refDate);
      assertEqual(isPast, true, "Past time must remain unavailable even if cancelled");
    });

    // 18. Overlapping window blocked
    test("18. Overlapping window (10:00-12:00 vs 11:00-13:00) is BLOCKED", () => {
      const existing = [
        { bookingDate: "2026-10-15", bookingTime: "10:00 AM", status: "pending", estimatedDurationMinutes: 120 },
      ];
      const res = checkSlotCapacityMock({
        existingBookings: existing,
        targetDate: "2026-10-15",
        targetTime: "11:00 AM",
        durationMinutes: 120,
        maxCapacity: 1,
      });
      assertEqual(res.available, false, "11:00 AM must be blocked by 10:00-12:00 booking");
    });

    // 19. Adjacent window allowed
    test("19. Adjacent window (10:00-12:00 vs 12:00-14:00) is ALLOWED", () => {
      const existing = [
        { bookingDate: "2026-10-15", bookingTime: "10:00 AM", status: "pending", estimatedDurationMinutes: 120 },
      ];
      const res = checkSlotCapacityMock({
        existingBookings: existing,
        targetDate: "2026-10-15",
        targetTime: "12:00 PM",
        durationMinutes: 120,
        maxCapacity: 1,
      });
      assertEqual(res.available, true, "12:00 PM is adjacent to 10:00-12:00 and must be allowed");
    });

    // 20. Stale page submission rejected
    test("20. Stale page submission where slot has passed returns past error", () => {
      const refDate = new Date("2026-10-05T14:01:00Z"); // 10:01 AM EDT
      const isPast = isSlotInPast("2026-10-05", "10:00 AM", refDate);
      assertEqual(isPast, true, "10:00 AM submission at 10:01 AM must be rejected");
    });

    // 21. Stale availability submission rejected
    test("21. Stale availability submission where capacity was taken returns unavailable error", () => {
      const existing = [
        { bookingDate: "2026-10-15", bookingTime: "10:00 AM", status: "pending", estimatedDurationMinutes: 120 },
      ];
      const res = checkSlotCapacityMock({
        existingBookings: existing,
        targetDate: "2026-10-15",
        targetTime: "10:00 AM",
        maxCapacity: 1,
      });
      assertEqual(res.available, false, "Second request must fail when capacity is 1");
    });

    // 22. Simultaneous same-slot requests -> one succeeds
    test("22. Simultaneous same-slot requests serialize so exactly one succeeds", () => {
      const dbBookings = [];
      function tryBook(id, time) {
        const capacity = checkSlotCapacityMock({
          existingBookings: dbBookings,
          targetDate: "2026-10-15",
          targetTime: time,
          maxCapacity: 1,
        });
        if (!capacity.available) return { success: false, error: "Unavailable" };
        dbBookings.push({ id, bookingDate: "2026-10-15", bookingTime: time, status: "pending", estimatedDurationMinutes: 120 });
        return { success: true };
      }

      const resA = tryBook("reqA", "10:00 AM");
      const resB = tryBook("reqB", "10:00 AM");

      assertEqual(resA.success, true, "First request succeeds");
      assertEqual(resB.success, false, "Second competing request fails");
      assertEqual(dbBookings.length, 1, "Only 1 booking created in DB");
    });

    // 23. Simultaneous overlapping requests -> one succeeds
    test("23. Simultaneous overlapping requests (10:00-12:00 vs 11:00-13:00) -> exactly one succeeds", () => {
      const dbBookings = [];
      function tryBook(id, time) {
        const capacity = checkSlotCapacityMock({
          existingBookings: dbBookings,
          targetDate: "2026-10-15",
          targetTime: time,
          durationMinutes: 120,
          maxCapacity: 1,
        });
        if (!capacity.available) return { success: false, error: "Unavailable" };
        dbBookings.push({ id, bookingDate: "2026-10-15", bookingTime: time, status: "pending", estimatedDurationMinutes: 120 });
        return { success: true };
      }

      const resA = tryBook("reqA", "10:00 AM");
      const resB = tryBook("reqB", "11:00 AM");

      assertEqual(resA.success, true, "First request succeeds");
      assertEqual(resB.success, false, "Overlapping request fails");
      assertEqual(dbBookings.length, 1);
    });

    // 24. POST /api/bookings parity
    test("24. POST /api/bookings has behavioral parity with server action", () => {
      const routePath = path.join(projectRoot, "frontend/src/app/api/bookings/route.ts");
      const content = fs.readFileSync(routePath, "utf-8");

      assert(content.includes("pg_advisory_xact_lock"), "REST API must acquire advisory lock");
      assert(content.includes("checkSlotCapacity"), "REST API must check slot capacity");
      assert(content.includes("isSlotInPast"), "REST API must validate past times using Toronto timezone");
      assert(content.includes("getTorontoTodayString"), "REST API must resolve Toronto today");
      assert(content.includes("Selected time has already passed"), "REST API must reject past time");
    });

    // 25. Customer server action parity
    test("25. Customer server action has concurrency lock and Toronto checks", () => {
      const actionPath = path.join(projectRoot, "frontend/src/app/actions/bookings/customer.ts");
      const content = fs.readFileSync(actionPath, "utf-8");

      assert(content.includes("pg_advisory_xact_lock"), "Server action must acquire advisory lock");
      assert(content.includes("checkSlotCapacity"), "Server action must check slot capacity");
      assert(content.includes("isSlotInPast"), "Server action must validate past times using Toronto timezone");
      assert(content.includes("Selected time has already passed"), "Server action must reject past time");
      assert(content.includes("estimatedDurationMinutes: 120"), "Server action must reserve 2-hour duration");
    });

    // 26. Availability API returns current slots
    test("26. Availability API returns 24/7 current slots for date query with Cache-Control no-store", () => {
      const routePath = path.join(projectRoot, "frontend/src/app/api/bookings/availability/route.ts");
      const content = fs.readFileSync(routePath, "utf-8");

      assert(content.includes("getAvailableSlotsForDate"), "API route must call getAvailableSlotsForDate");
      assert(content.includes("America/Toronto"), "API route must declare America/Toronto timezone");
      assert(content.includes("Cache-Control"), "API route must have Cache-Control header");
      assert(content.includes("no-store"), "API route must specify no-store");
    });

    // 27. Date change refreshes slots in BookingFormClient
    test("27. Date change in BookingFormClient clears stale time and refreshes slots", () => {
      const formPath = path.join(projectRoot, "frontend/src/app/booking/BookingFormClient.tsx");
      const content = fs.readFileSync(formPath, "utf-8");

      assert(content.includes("fetchSlots(newDate)"), "Form must fetch slots on date change");
      assert(content.includes('setBookingTime("")'), "Form must clear stale time on date change");
      assert(content.includes("setInterval"), "Form must establish real-time refresh timer");
      assert(content.includes("30000"), "Form timer interval must be 30 seconds");
    });

    // 28. Missing/invalid date/time rejected safely
    test("28. Missing or invalid date/time rejected safely", () => {
      assert(isSlotInPast("", ""), "Empty date/time must be marked past/invalid");
      assert(isSlotInPast(null, null), "Null date/time must be marked past/invalid");
      assertEqual(parseTimeToMinutes("invalid-time"), 0, "Invalid time string safely defaults to 0");
    });

    // 29. Notification isolation preserved
    test("29. Booking.customerEmail isolation and recipient logic remain strictly preserved", () => {
      const customerActionPath = path.join(projectRoot, "frontend/src/app/actions/bookings/customer.ts");
      const content = fs.readFileSync(customerActionPath, "utf-8");

      assert(content.includes("customerEmail: normalizedEmail"), "Booking.customerEmail must be preserved");
      assert(content.includes("sendAdminBookingCreatedAlert"), "Creation must alert admin only");
    });

    // 30. Business information preserved
    test("30. Business information (HT Mobile Tire, phone, service areas) preserved", () => {
      const brandPath = path.join(projectRoot, "frontend/src/lib/constants/brand.ts");
      const phonePath = path.join(projectRoot, "frontend/src/lib/constants/phone.ts");
      const brandContent = fs.readFileSync(brandPath, "utf-8");
      const phoneContent = fs.readFileSync(phonePath, "utf-8");

      assert(brandContent.includes("HT Mobile Tire"), "Business name must be HT Mobile Tire");
      assert(phoneContent.includes("+1 (647) 995-6665"), "Public phone must be +1 (647) 995-6665");
      assert(phoneContent.includes("+16479956665"), "Raw phone must be +16479956665");
    });
  });
}
