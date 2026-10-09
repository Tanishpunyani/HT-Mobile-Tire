import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuthorizedGuestBookingIds, getValidTechnicianCallData } from "@/lib/guest-auth";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import { calculateCustomerEta } from "@/lib/utils/eta";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const authorizedIds = getAuthorizedGuestBookingIds(cookieStore);

    if (authorizedIds.length === 0) {
      return NextResponse.json(
        {
          success: true,
          bookings: [],
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const bookings = await prisma.booking.findMany({
      where: {
        id: { in: authorizedIds },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        service: true,
        technician: true,
        technicianLocation: true,
      },
    });

    const safeBookings = bookings.map((b) => {
      const eta = calculateCustomerEta(b, b.technicianLocation);
      const safeB: Record<string, any> = { ...b };
      delete safeB.technicianLocation;
      delete safeB.notes; // internal notes stripped

      // Safe technician contact validation (Phase 7)
      let technicianData = null;
      let callNowData = null;

      if (b.technician) {
        callNowData = getValidTechnicianCallData(b.technician);
        technicianData = {
          id: b.technician.id,
          name: b.technician.name,
          role: b.technician.role,
          phone: b.technician.phone || null,
          hasValidPhone: Boolean(callNowData?.isValid),
          callUri: callNowData?.telUri || null,
        };
      }

      safeB.technician = technicianData;

      return {
        ...serializeDecimal(safeB),
        bookedAt: b.createdAt.toISOString(),
        etaMinutes: eta.etaMinutes,
        estimatedArrivalAt: eta.estimatedArrivalAt,
        arrivalStatus: eta.arrivalStatus,
        etaUpdatedAt: eta.updatedAt,
        distanceMiles: eta.distanceMiles,
        callNow: callNowData,
      };
    });

    return NextResponse.json(
      {
        success: true,
        bookings: safeBookings,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    logger.error("guest_bookings.list_failed", { error });

    return NextResponse.json(
      {
        success: false,
        error: "Unable to retrieve guest bookings.",
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
