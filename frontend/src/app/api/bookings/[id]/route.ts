import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedCustomerIdsForUser } from "@/lib/auth";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import { calculateCustomerEta } from "@/lib/utils/eta";
import { logger } from "@/lib/logger";
import {
  sendAdminBookingCancelledAlert,
  sendCustomerBookingCancelledAlert,
} from "@/lib/notifications";

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

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authorizedCustomerIds = await getAuthorizedCustomerIdsForUser({
      id: user.id,
      email: user.email,
    });

    const booking = await prisma.booking.findFirst({
      where: {
        id,
        OR: [
          ...(authorizedCustomerIds.length > 0 ? [{ customerId: { in: authorizedCustomerIds } }] : []),
          { customer: { userId: user.id } },
        ],
      },
      include: {
        service: true,
        technician: true,
        technicianLocation: true,
        reviews: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const eta = calculateCustomerEta(booking, booking.technicianLocation);

    // Compute signal freshness
    let signalFreshness: "waiting" | "fresh" | "stale" | "offline" = "waiting";
    const techLoc = booking.technicianLocation;
    if (techLoc && techLoc.isActive && techLoc.updatedAt) {
      const ageMs = Math.max(0, Date.now() - new Date(techLoc.updatedAt).getTime());
      if (ageMs < 60 * 1000) {
        signalFreshness = "fresh";
      } else if (ageMs <= 5 * 60 * 1000) {
        signalFreshness = "stale";
      } else {
        signalFreshness = "offline";
      }
    }

    const isEnRoute = booking.status === "in_progress" || (booking.status === "confirmed" && Boolean(booking.technicianId));
    const isCompleted = booking.status === "completed";
    const isCancelled = booking.status === "cancelled";
    const hasArrived = Boolean(booking.arrivedAt || eta.arrivalStatus === "arrived");

    const sanitizedTracking = {
      success: true,
      bookingId: booking.id,
      bookingStatus: booking.status,
      isEnRoute,
      isCompleted,
      isCancelled,
      isLive: (signalFreshness === "fresh" || signalFreshness === "stale") && !isCompleted && !isCancelled,
      hasArrived,
      arrivedAt: booking.arrivedAt ? booking.arrivedAt.toISOString() : null,
      technician: booking.technician
        ? {
            name: booking.technician.name,
            role: booking.technician.role,
            phone: null,
          }
        : null,
      technicianLocation:
        !isCompleted && !isCancelled && techLoc && techLoc.isActive && (signalFreshness === "fresh" || signalFreshness === "stale")
          ? {
              latitude: techLoc.latitude,
              longitude: techLoc.longitude,
              updatedAt: techLoc.updatedAt.toISOString(),
            }
          : null,
      customerLocation: {
        address: booking.formattedAddress || booking.location,
        latitude: booking.latitude,
        longitude: booking.longitude,
      },
      etaMinutes: eta.etaMinutes,
      distanceMiles: eta.distanceMiles,
      arrivalStatus: eta.arrivalStatus,
      estimatedArrivalAt: eta.estimatedArrivalAt,
      signalFreshness,
    };

    // Sanitize booking object to guarantee zero raw technician telemetry / phone leak (Phase 6F)
    const safeBooking = { ...booking };
    delete (safeBooking as Record<string, unknown>).technicianLocation;
    if (safeBooking.technician) {
      safeBooking.technician = {
        ...safeBooking.technician,
        phone: null,
      };
    }

    const safeSerializedBooking = {
      ...serializeDecimal(safeBooking),
      bookedAt: booking.createdAt.toISOString(),
      etaMinutes: eta.etaMinutes,
      estimatedArrivalAt: eta.estimatedArrivalAt,
      arrivalStatus: eta.arrivalStatus,
      etaUpdatedAt: eta.updatedAt,
      distanceMiles: eta.distanceMiles,
      signalFreshness,
      tracking: sanitizedTracking,
    };

    return NextResponse.json(
      {
        success: true,
        booking: safeSerializedBooking,
        tracking: sanitizedTracking,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    logger.error("booking_id.get_failed", { error });

    return NextResponse.json(
      {
        success: false,
        error: "Unable to retrieve booking.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authorizedCustomerIds = await getAuthorizedCustomerIdsForUser({
      id: user.id,
      email: user.email,
    });

    const booking = await prisma.booking.findFirst({
      where: {
        id,
        OR: [
          ...(authorizedCustomerIds.length > 0 ? [{ customerId: { in: authorizedCustomerIds } }] : []),
          { customer: { userId: user.id } },
        ],
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const body = await request.json();

    const {
      serviceId,
      vehicle,
      location,
      bookingDate,
      bookingTime,
      message,
      status,
    } = body;

    // Validate customer status transition: only "pending" -> "cancelled" is permitted
    if (status !== undefined) {
      if (status !== "cancelled" || booking.status !== "pending") {
        return NextResponse.json(
          { error: "Invalid status transition. Customers may only cancel pending bookings." },
          { status: 400 }
        );
      }
    }

    if (serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
      });
      if (!service) {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 400 }
        );
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        ...(serviceId && { serviceId }),
        ...(vehicle && { vehicle }),
        ...(location && { location }),
        ...(bookingDate && { bookingDate: new Date(bookingDate) }),
        ...(bookingTime && {
          bookingTime: new Date(`1970-01-01T${bookingTime}`),
        }),
        ...(message !== undefined && { message }),
        ...(status === "cancelled" && booking.status === "pending" && { status: "cancelled" }),
      },
      include: {
        customer: true,
        service: true,
      },
    });

    // Phase 6H (G-05): Dispatch post-commit cancellation alerts when cancelling via PUT
    if (status === "cancelled" && booking.status === "pending") {
      try {
        await sendAdminBookingCancelledAlert({
          booking: updatedBooking,
          cancelledBy: "Customer",
          reason: "Customer cancelled via API (PUT)",
        });
      } catch (notifErr) {
        logger.warn("booking_id.put_admin_cancel_notification_failed", { error: notifErr });
      }

      try {
        await sendCustomerBookingCancelledAlert({
          id: updatedBooking.id,
          vehicle: updatedBooking.vehicle,
          location: updatedBooking.location,
          bookingDate: updatedBooking.bookingDate,
          bookingTime: updatedBooking.bookingTime,
          status: "cancelled",
          primaryService: updatedBooking.primaryService,
          customer: updatedBooking.customer,
          service: updatedBooking.service,
        });
      } catch (notifErr) {
        logger.warn("booking_id.put_customer_cancel_notification_failed", { error: notifErr });
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedBooking,
    });
  } catch (error) {
    logger.error("booking_id.update_failed", { error });

    return NextResponse.json(
      {
        success: false,
        error: "Unable to update booking.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authorizedCustomerIds = await getAuthorizedCustomerIdsForUser({
      id: user.id,
      email: user.email,
    });

    const booking = await prisma.booking.findFirst({
      where: {
        id,
        OR: [
          ...(authorizedCustomerIds.length > 0 ? [{ customerId: { in: authorizedCustomerIds } }] : []),
          { customer: { userId: user.id } },
        ],
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Historical Preservation: Replace destructive physical deletion with state-machine cancellation
    if (booking.status === "pending") {
      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: {
          status: "cancelled",
          notes: booking.notes
            ? `${booking.notes}\n[Cancelled by Customer via API]`
            : "[Cancelled by Customer via API]",
        },
        include: {
          customer: true,
          service: true,
        },
      });

      // Phase 6H (G-05): Dispatch post-commit cancellation alerts when cancelling via DELETE
      try {
        await sendAdminBookingCancelledAlert({
          booking: updatedBooking,
          cancelledBy: "Customer",
          reason: "Customer cancelled via API (DELETE)",
        });
      } catch (notifErr) {
        logger.warn("booking_id.delete_admin_cancel_notification_failed", { error: notifErr });
      }

      try {
        await sendCustomerBookingCancelledAlert({
          id: updatedBooking.id,
          vehicle: updatedBooking.vehicle,
          location: updatedBooking.location,
          bookingDate: updatedBooking.bookingDate,
          bookingTime: updatedBooking.bookingTime,
          status: "cancelled",
          primaryService: updatedBooking.primaryService,
          customer: updatedBooking.customer,
          service: updatedBooking.service,
        });
      } catch (notifErr) {
        logger.warn("booking_id.delete_customer_cancel_notification_failed", { error: notifErr });
      }

      return NextResponse.json({
        success: true,
        message: "Booking request cancelled successfully.",
        booking: serializeDecimal(updatedBooking),
      });
    }

    if (booking.status === "cancelled") {
      return NextResponse.json({
        success: true,
        message: "Booking is already cancelled.",
        booking: serializeDecimal(booking),
      });
    }

    return NextResponse.json(
      {
        error:
          "Active or completed bookings cannot be removed directly. Please contact central dispatch to modify or reschedule an active appointment.",
      },
      { status: 400 }
    );
  } catch (error) {
    logger.error("booking_id.delete_failed", { error });

    return NextResponse.json(
      {
        success: false,
        error: "Unable to process booking cancellation.",
      },
      { status: 500 }
    );
  }
}