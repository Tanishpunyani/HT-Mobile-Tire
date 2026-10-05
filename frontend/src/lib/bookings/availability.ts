import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  parseTimeToMinutes,
  isSlotInPast,
  CANONICAL_2HOUR_SLOTS,
  CanonicalSlot,
} from "@/lib/utils/timezone";

export interface BookingAvailabilityResult {
  available: boolean;
  activeCount?: number;
  totalCapacity?: number;
  estimatedCompletionAt?: string;
  remainingMinutes?: number;
}

export interface SlotAvailabilityItem {
  time: string;
  endTime: string;
  label: string;
  available: boolean;
  reason?: "past" | "occupied";
}

export const DEFAULT_SERVICE_DURATION_MINUTES = 45;
export const DEFAULT_BUFFER_MINUTES = 15;
export const DEFAULT_TOTAL_DURATION_MINUTES = 60; // 45 min service + 15 min buffer

/**
 * Converts a time representation (Date object, string "HH:MM", "HH:MM AM/PM", or ISO string) to minutes from midnight (0-1439).
 * Correctly converts 12-hour AM/PM and 24-hour formats.
 */
export function timeToMinutes(time: Date | string | null | undefined): number {
  return parseTimeToMinutes(time);
}

/**
 * Checks whether two time windows on the same date overlap.
 * Uses half-open interval comparison [start, end).
 */
export function doTimeWindowsOverlap(
  startA: number,
  durationA: number,
  startB: number,
  durationB: number
): boolean {
  const endA = startA + durationA;
  const endB = startB + durationB;
  return Math.max(startA, startB) < Math.min(endA, endB);
}

/**
 * Checks whether a specific date and time slot has available capacity.
 * Supports pending, confirmed, and in_progress reservation.
 * When maxCapacity is set to 1, any single overlapping booking marks the window unavailable.
 */
export async function checkSlotCapacity(
  txOrPrisma: any,
  params: {
    bookingDate: Date;
    bookingTime: Date | string;
    durationMinutes?: number;
    excludeBookingId?: string;
    maxCapacity?: number;
    statuses?: string[];
  }
): Promise<{
  available: boolean;
  totalTechnicians: number;
  overlappingBookingsCount: number;
  availableSlotsRemaining: number;
}> {
  const duration = params.durationMinutes || 120;
  const targetTimeMinutes = timeToMinutes(params.bookingTime);

  // 1. Determine capacity limit
  const totalActiveTechnicians = await txOrPrisma.technician.count({
    where: { isActive: true },
  });

  const capacity =
    params.maxCapacity !== undefined
      ? params.maxCapacity
      : Math.max(1, totalActiveTechnicians || 5);

  // 2. Fetch all active bookings (pending, confirmed, in_progress) on the target date
  const startOfDay = new Date(params.bookingDate);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(params.bookingDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const targetStatuses = params.statuses || ["pending", "confirmed", "in_progress"];

  const bookingsOnDate = await txOrPrisma.booking.findMany({
    where: {
      bookingDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: { in: targetStatuses },
      ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
    },
    select: {
      id: true,
      bookingTime: true,
      estimatedDurationMinutes: true,
      technicianId: true,
    },
  });

  // 3. Count overlapping active bookings
  let overlappingCount = 0;
  for (const b of bookingsOnDate) {
    const existingStart = timeToMinutes(b.bookingTime);
    const existingDuration =
      b.estimatedDurationMinutes && b.estimatedDurationMinutes >= 120
        ? b.estimatedDurationMinutes
        : Math.max(120, (b.estimatedDurationMinutes || DEFAULT_SERVICE_DURATION_MINUTES) + DEFAULT_BUFFER_MINUTES);

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
 * Generates all 2-hour slots for a given date in America/Toronto,
 * verifying both past-time status and database occupancy.
 */
export async function getAvailableSlotsForDate(
  txOrPrisma: any,
  dateStr: string,
  referenceDate: Date = new Date()
): Promise<SlotAvailabilityItem[]> {
  const [year, month, day] = dateStr.split("-").map(Number);
  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  const activeBookings = await txOrPrisma.booking.findMany({
    where: {
      bookingDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: { in: ["pending", "confirmed", "in_progress"] },
    },
    select: {
      id: true,
      bookingTime: true,
      estimatedDurationMinutes: true,
    },
  });

  return CANONICAL_2HOUR_SLOTS.map((slot: CanonicalSlot) => {
    // 1. Is slot in the past?
    if (isSlotInPast(dateStr, slot.value, referenceDate)) {
      return {
        time: slot.value,
        endTime: slot.endTime,
        label: slot.label,
        available: false,
        reason: "past",
      };
    }

    // 2. Does slot overlap with any active booking window?
    const slotStart = slot.startMinutes;
    const slotDuration = slot.durationMinutes;

    const isOccupied = activeBookings.some((b: any) => {
      const bStart = timeToMinutes(b.bookingTime);
      const bDuration =
        b.estimatedDurationMinutes && b.estimatedDurationMinutes >= 120
          ? b.estimatedDurationMinutes
          : Math.max(120, (b.estimatedDurationMinutes || DEFAULT_SERVICE_DURATION_MINUTES) + DEFAULT_BUFFER_MINUTES);
      return doTimeWindowsOverlap(slotStart, slotDuration, bStart, bDuration);
    });

    if (isOccupied) {
      return {
        time: slot.value,
        endTime: slot.endTime,
        label: slot.label,
        available: false,
        reason: "occupied",
      };
    }

    return {
      time: slot.value,
      endTime: slot.endTime,
      label: slot.label,
      available: true,
    };
  });
}

/**
 * Checks whether a specific technician is available for an assignment without time conflicts.
 */
export async function checkTechnicianAvailability(
  txOrPrisma: any,
  technicianId: string,
  params: {
    bookingDate: Date;
    bookingTime: Date | string;
    durationMinutes?: number;
    excludeBookingId?: string;
  }
): Promise<{ available: boolean; conflictBookingId?: string }> {
  const duration = params.durationMinutes || DEFAULT_TOTAL_DURATION_MINUTES;
  const targetTimeMinutes = timeToMinutes(params.bookingTime);

  const startOfDay = new Date(params.bookingDate);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(params.bookingDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const techBookings = await txOrPrisma.booking.findMany({
    where: {
      technicianId,
      bookingDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: { in: ["confirmed", "in_progress"] },
      ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
    },
    select: {
      id: true,
      bookingTime: true,
      estimatedDurationMinutes: true,
    },
  });

  for (const b of techBookings) {
    const existingStart = timeToMinutes(b.bookingTime);
    const existingDuration =
      (b.estimatedDurationMinutes || DEFAULT_SERVICE_DURATION_MINUTES) + DEFAULT_BUFFER_MINUTES;

    if (doTimeWindowsOverlap(targetTimeMinutes, duration, existingStart, existingDuration)) {
      return { available: false, conflictBookingId: b.id };
    }
  }

  return { available: true };
}

/**
 * Checks whether HT Mobile Tire currently has active fleet capacity for on-demand service.
 * Considers all active mobile tire technicians.
 */
export async function getBookingAvailability(): Promise<BookingAvailabilityResult> {
  try {
    const totalActiveTechs = await prisma.technician.count({
      where: { isActive: true },
    });
    const totalCapacity = Math.max(1, totalActiveTechs || 5);

    const activeBookings = await prisma.booking.findMany({
      where: {
        status: {
          in: ["confirmed", "in_progress"],
        },
      },
      select: {
        id: true,
        status: true,
        serviceConfirmedAt: true,
        estimatedDurationMinutes: true,
        updatedAt: true,
      },
    });

    const activeCount = activeBookings.length;

    // If active jobs are less than total fleet capacity, company is available!
    if (activeCount < totalCapacity) {
      return {
        available: true,
        activeCount,
        totalCapacity,
      };
    }

    // If all technicians are currently active on-site, compute the earliest completing technician
    let earliestCompletionMs = Infinity;
    const nowMs = Date.now();

    for (const b of activeBookings) {
      const durationMinutes =
        b.estimatedDurationMinutes && b.estimatedDurationMinutes > 0
          ? b.estimatedDurationMinutes
          : DEFAULT_SERVICE_DURATION_MINUTES;

      const baseTime = b.serviceConfirmedAt || b.updatedAt || new Date();
      const completionTimeMs = new Date(baseTime).getTime() + durationMinutes * 60 * 1000;
      if (completionTimeMs < earliestCompletionMs) {
        earliestCompletionMs = completionTimeMs;
      }
    }

    const remainingMs = Math.max(0, earliestCompletionMs - nowMs);
    const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    const estimatedCompletionAt = new Date(
      earliestCompletionMs === Infinity ? nowMs + 45 * 60 * 1000 : earliestCompletionMs
    ).toISOString();

    return {
      available: false,
      activeCount,
      totalCapacity,
      estimatedCompletionAt,
      remainingMinutes,
    };
  } catch (error: any) {
    logger.error("availability.check_failed", { error: error?.message });
    return { available: true, totalCapacity: 5, activeCount: 0 };
  }
}
