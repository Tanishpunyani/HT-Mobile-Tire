export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import {
  getBookingAvailability,
  checkSlotCapacity,
  getAvailableSlotsForDate,
} from "@/lib/bookings/availability";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`availability_${clientIp}`, 60, 60 * 1000);

    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const timeParam = searchParams.get("time");

    // 1. If date is provided with a specific time, check single slot capacity (legacy support)
    if (dateParam && timeParam) {
      const parsedDate = new Date(`${dateParam}T00:00:00`);
      if (!isNaN(parsedDate.getTime())) {
        const slotCapacity = await checkSlotCapacity(prisma, {
          bookingDate: parsedDate,
          bookingTime: timeParam,
          maxCapacity: 1,
        });

        return Response.json(
          {
            available: slotCapacity.available,
            totalTechnicians: slotCapacity.totalTechnicians,
            availableSlotsRemaining: slotCapacity.availableSlotsRemaining,
            isScheduledSlot: true,
          },
          {
            status: 200,
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );
      }
    }

    // 2. If date is provided without a time, return all 24/7 2-hour slots for that date
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const slots = await getAvailableSlotsForDate(prisma, dateParam);
      return Response.json(
        {
          date: dateParam,
          timezone: "America/Toronto",
          slots,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    // Default to fleet-wide on-demand availability
    const availability = await getBookingAvailability();

    return Response.json(availability, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    logger.error("availability_api.get_failed", { error: error?.message });
    return Response.json(
      { available: true },
      { status: 200 }
    );
  }
}
