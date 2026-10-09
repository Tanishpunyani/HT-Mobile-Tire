import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isGuestBookingAuthorized, getValidTechnicianCallData } from "@/lib/guest-auth";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import { calculateCustomerEta } from "@/lib/utils/eta";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string" || id.trim() === "") {
      return NextResponse.json(
        { error: "Invalid booking ID" },
        {
          status: 400,
          headers: { "Cache-Control": "no-store, max-age=0" },
        }
      );
    }

    const trimmedId = id.trim();
    const cookieStore = await cookies();

    // Verify cryptographic guest token
    const isAuthorized = isGuestBookingAuthorized(cookieStore, trimmedId);
    if (!isAuthorized) {
      // Generic 404 response to prevent leaking whether another customer's booking exists
      return NextResponse.json(
        { error: "Booking not found" },
        {
          status: 404,
          headers: { "Cache-Control": "no-store, max-age=0" },
        }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: trimmedId },
      include: {
        service: true,
        technician: true,
        technicianLocation: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        {
          status: 404,
          headers: { "Cache-Control": "no-store, max-age=0" },
        }
      );
    }

    const eta = calculateCustomerEta(booking, booking.technicianLocation);

    // Safe technician validation & Call Now data (Phase 7)
    let technicianData = null;
    let callNowData = null;

    if (booking.technician) {
      callNowData = getValidTechnicianCallData(booking.technician);
      technicianData = {
        id: booking.technician.id,
        name: booking.technician.name,
        role: booking.technician.role,
        phone: booking.technician.phone || null,
        hasValidPhone: Boolean(callNowData?.isValid),
        callUri: callNowData?.telUri || null,
      };
    }

    // Sanitize booking object to strip internal notes, GPS telemetry, etc.
    const safeBooking: Record<string, any> = { ...booking };
    delete safeBooking.technicianLocation;
    delete safeBooking.notes;
    safeBooking.technician = technicianData;

    const safeSerializedBooking = {
      ...serializeDecimal(safeBooking),
      bookedAt: booking.createdAt.toISOString(),
      etaMinutes: eta.etaMinutes,
      estimatedArrivalAt: eta.estimatedArrivalAt,
      arrivalStatus: eta.arrivalStatus,
      etaUpdatedAt: eta.updatedAt,
      distanceMiles: eta.distanceMiles,
      callNow: callNowData,
    };

    return NextResponse.json(
      {
        success: true,
        booking: safeSerializedBooking,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    logger.error("guest_booking_id.get_failed", { error });

    return NextResponse.json(
      {
        success: false,
        error: "Unable to retrieve guest booking.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
