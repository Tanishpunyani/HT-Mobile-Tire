import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface BookingAvailabilityResult {
  available: boolean;
  activeCount?: number;
  totalCapacity?: number;
  estimatedCompletionAt?: string;
  remainingMinutes?: number;
}

export const DEFAULT_SERVICE_DURATION_MINUTES = 45;
export const DEFAULT_BUFFER_MINUTES = 15;
export const DEFAULT_TOTAL_DURATION_MINUTES = 60; // 45 min service + 15 min buffer

/**
 * Converts a time representation (Date object, string "HH:MM", or ISO string) to minutes from midnight (0-1439).
 */
export function timeToMinutes(time: Date | string | null | undefined): number {
  if (!time) return 0;

  if (time instanceof Date) {
    return time.getUTCHours() * 60 + time.getUTCMinutes();
  }

  if (typeof time === "string") {
    // If format is "HH:MM" or "HH:MM:SS"
    if (time.includes(":")) {
      const parts = time.split(":");
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      return hours * 60 + minutes;
    }
    const d = new Date(time);
    if (!isNaN(d.getTime())) {
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    }
  }

  return 0;
}

/**
 * Checks whether two time windows on the same date overlap.
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
 * Checks whether a specific date and time slot has available technician capacity.
 */
export async function checkSlotCapacity(
  txOrPrisma: any,
  params: {
    bookingDate: Date;
    bookingTime: Date | string;
    durationMinutes?: number;
    excludeBookingId?: string;
  }
): Promise<{
  available: boolean;
  totalTechnicians: number;
  overlappingBookingsCount: number;
  availableSlotsRemaining: number;
}> {
  const duration = params.durationMinutes || DEFAULT_TOTAL_DURATION_MINUTES;
  const targetTimeMinutes = timeToMinutes(params.bookingTime);

  // 1. Get total active technicians
  const totalActiveTechnicians = await txOrPrisma.technician.count({
    where: { isActive: true },
  });

  const capacity = Math.max(1, totalActiveTechnicians || 5);

  // 2. Fetch all confirmed or in_progress bookings on the target date
  const startOfDay = new Date(params.bookingDate);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(params.bookingDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const bookingsOnDate = await txOrPrisma.booking.findMany({
    where: {
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
      technicianId: true,
    },
  });

  // 3. Count overlapping active bookings
  let overlappingCount = 0;
  for (const b of bookingsOnDate) {
    const existingStart = timeToMinutes(b.bookingTime);
    const existingDuration =
      (b.estimatedDurationMinutes || DEFAULT_SERVICE_DURATION_MINUTES) + DEFAULT_BUFFER_MINUTES;

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
 * Checks whether HT Mobile Tires currently has active fleet capacity for on-demand service.
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
