import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  parseTimeToMinutes,
  isSlotInPast,
  CANONICAL_2HOUR_SLOTS,
  CanonicalSlot,
  getTorontoTodayString,
  getTorontoCurrentMinutes,
} from "@/lib/utils/timezone";

export interface BookingAvailabilityResult {
  available: boolean;
  activeCount?: number;
  totalCapacity?: number;
  estimatedCompletionAt?: string | null;
  remainingMinutes?: number | null;
  reason?: string;
  error?: string;
}

export interface SlotAvailabilityItem {
  time: string;
  endTime: string;
  label: string;
  available: boolean;
  reason?: "past" | "occupied" | "unstaffed";
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
  const totalActiveTechnicians = await txOrPrisma.technician.count({
    where: { isActive: true },
  });

  if (totalActiveTechnicians === 0) {
    return CANONICAL_2HOUR_SLOTS.map((slot: CanonicalSlot) => ({
      time: slot.value,
      endTime: slot.endTime,
      label: slot.label,
      available: false,
      reason: "unstaffed",
    }));
  }

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
 * Considers all active mobile tire technicians and only jobs currently occupying capacity.
 */
export async function getBookingAvailability(
  prismaClient: any = prisma,
  referenceDate?: Date
): Promise<BookingAvailabilityResult> {
  try {
    const totalActiveTechs = await prismaClient.technician.count({
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

    const now = referenceDate || new Date();
    const nowMs = now.getTime();
    const todayTorontoStr = getTorontoTodayString(now);
    const currentMinutesToronto = getTorontoCurrentMinutes(now);

    const yesterdayDate = new Date(nowMs - 24 * 60 * 60 * 1000);
    const yesterdayTorontoStr = getTorontoTodayString(yesterdayDate);

    const [tYear, tMonth, tDay] = todayTorontoStr.split("-").map(Number);
    const todayUtcMidnight = new Date(Date.UTC(tYear, tMonth - 1, tDay));

    const [yYear, yMonth, yDay] = yesterdayTorontoStr.split("-").map(Number);
    const yesterdayUtcMidnight = new Date(Date.UTC(yYear, yMonth - 1, yDay));

    const candidateBookings = await prismaClient.booking.findMany({
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

    interface ActiveOccupyingJob {
      id: string;
      status: string;
      estimatedCompletionMs: number | null;
    }

    const activeJobs: ActiveOccupyingJob[] = [];

    for (const b of candidateBookings) {
      if (b.status === "in_progress") {
        const durationMinutes =
          b.estimatedDurationMinutes && b.estimatedDurationMinutes > 0
            ? b.estimatedDurationMinutes
            : DEFAULT_SERVICE_DURATION_MINUTES;

        // Trustworthy start timestamp: arrivedAt or updatedAt (when technician started service)
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
        let scheduledCompletionMs: number | null = null;

        if (bDateStr === todayTorontoStr) {
          if (endMinutes <= 1440) {
            if (currentMinutesToronto >= startMinutes && currentMinutesToronto < endMinutes) {
              isOverlapping = true;
              const minutesRemaining = endMinutes - currentMinutesToronto;
              scheduledCompletionMs = nowMs + minutesRemaining * 60 * 1000;
            }
          } else {
            // Crosses midnight: startMinutes to 1440 on today
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

    // All active technicians are genuinely occupied right now
    let earliestCompletionMs: number | null = null;
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
  } catch (error: any) {
    logger.error("availability.check_failed", { error: error?.message });
    throw error;
  }
}
