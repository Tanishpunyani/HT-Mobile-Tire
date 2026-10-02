/**
 * Unit Tests: Availability Engine & Slot Calculations
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

function parseTimeToMinutes(timeStr) {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function doIntervalsOverlap(startA, endA, startB, endB) {
  // Half-open interval [start, end)
  return Math.max(startA, startB) < Math.min(endA, endB);
}

function checkSlotCapacity({ existingBookings, targetDate, targetTime, slotDurationMinutes = 60, fleetCapacity = 2 }) {
  const targetStart = parseTimeToMinutes(targetTime);
  const targetEnd = targetStart + slotDurationMinutes;

  const overlappingActive = existingBookings.filter((b) => {
    if (b.scheduledDate !== targetDate) return false;
    if (b.status === "cancelled" || b.status === "rejected") return false;

    const bStart = parseTimeToMinutes(b.scheduledTime);
    const bEnd = bStart + (b.durationMinutes || 60);
    return doIntervalsOverlap(targetStart, targetEnd, bStart, bEnd);
  });

  const availableSlots = Math.max(0, fleetCapacity - overlappingActive.length);
  return {
    isAvailable: availableSlots > 0,
    availableSlots,
    occupiedCount: overlappingActive.length,
    fleetCapacity,
  };
}

export function runCapacityTests() {
  describe("Capacity & Availability Slot Calculations (Unit)", () => {
    test("Empty schedule has 100% full capacity available", () => {
      const res = checkSlotCapacity({
        existingBookings: [],
        targetDate: "2026-10-15",
        targetTime: "09:00 AM",
        fleetCapacity: 2,
      });
      assert(res.isAvailable);
      assertEqual(res.availableSlots, 2);
    });

    test("Adjacent non-overlapping windows (09:00-10:00 vs 10:00-11:00) DO NOT conflict", () => {
      const existing = [
        {
          id: "b1",
          scheduledDate: "2026-10-15",
          scheduledTime: "09:00 AM",
          durationMinutes: 60,
          status: "confirmed",
        },
      ];
      const res = checkSlotCapacity({
        existingBookings: existing,
        targetDate: "2026-10-15",
        targetTime: "10:00 AM",
        slotDurationMinutes: 60,
        fleetCapacity: 1,
      });
      assert(res.isAvailable, "10:00 AM should not overlap with 09:00-10:00 slot");
      assertEqual(res.availableSlots, 1);
    });

    test("Overlapping window (09:00-10:00 vs 09:30-10:30) conflicts with capacity", () => {
      const existing = [
        {
          id: "b1",
          scheduledDate: "2026-10-15",
          scheduledTime: "09:00 AM",
          durationMinutes: 60,
          status: "confirmed",
        },
      ];
      const res = checkSlotCapacity({
        existingBookings: existing,
        targetDate: "2026-10-15",
        targetTime: "09:30 AM",
        slotDurationMinutes: 60,
        fleetCapacity: 1,
      });
      assertEqual(res.isAvailable, false, "09:30 AM overlaps with 09:00-10:00");
      assertEqual(res.availableSlots, 0);
    });

    test("Cancelled bookings DO NOT consume capacity", () => {
      const existing = [
        {
          id: "b1",
          scheduledDate: "2026-10-15",
          scheduledTime: "09:00 AM",
          durationMinutes: 60,
          status: "cancelled",
        },
        {
          id: "b2",
          scheduledDate: "2026-10-15",
          scheduledTime: "09:00 AM",
          durationMinutes: 60,
          status: "rejected",
        },
      ];
      const res = checkSlotCapacity({
        existingBookings: existing,
        targetDate: "2026-10-15",
        targetTime: "09:00 AM",
        fleetCapacity: 2,
      });
      assert(res.isAvailable, "Cancelled/rejected bookings release capacity");
      assertEqual(res.availableSlots, 2);
    });

    test("Fleet capacity of 2 allows 2 concurrent bookings but blocks 3rd", () => {
      const existing = [
        { id: "b1", scheduledDate: "2026-10-15", scheduledTime: "02:00 PM", status: "confirmed" },
        { id: "b2", scheduledDate: "2026-10-15", scheduledTime: "02:00 PM", status: "pending" },
      ];
      const res = checkSlotCapacity({
        existingBookings: existing,
        targetDate: "2026-10-15",
        targetTime: "02:00 PM",
        fleetCapacity: 2,
      });
      assertEqual(res.isAvailable, false);
      assertEqual(res.availableSlots, 0);
      assertEqual(res.occupiedCount, 2);
    });
  });
}
