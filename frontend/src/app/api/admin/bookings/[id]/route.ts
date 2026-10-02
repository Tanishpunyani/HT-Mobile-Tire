import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import { verifyAdminSession, ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { sendStatusUpdate, sendCustomerBookingConfirmedAlert } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { validateBookingTransition } from "@/lib/bookings/state-machine";
import { checkSlotCapacity, DEFAULT_SERVICE_DURATION_MINUTES } from "@/lib/bookings/availability";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

    const isValid = await verifyAdminSession(token);

    if (!isValid) {
      return Response.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || typeof status !== "string") {
      return Response.json(
        {
          success: false,
          error: "A valid status is required.",
        },
        { status: 400 }
      );
    }

    // Phase 6H (G-04): Block direct completion via REST API.
    // The canonical completion path is completeAndQuoteAction which validates pricing, generates PDF invoices, and configures payment state.
    if (status === "completed") {
      return Response.json(
        {
          success: false,
          error: "Direct status transition to 'completed' via REST API is not permitted. Please use completeAndQuoteAction to validate quote line items, calculate totals, and generate invoices.",
        },
        { status: 400 }
      );
    }

    // Update booking with atomic transaction and centralized state machine
    const updateResult = await prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id },
          include: { customer: true, service: true, technician: true },
        });

        if (!booking) {
          return { error: "Booking not found.", status: 404 };
        }

        // Validate state machine transition
        const transition = validateBookingTransition(booking.status, status, "admin");
        if (!transition.allowed) {
          return {
            error: transition.error || `Cannot change booking from "${booking.status}" to "${status}".`,
            status: 400,
          };
        }

        if (transition.isNoop) {
          return { updated: booking, isNoop: true };
        }

        // Phase 6D: Require assigned technician before starting service
        if (status === "in_progress") {
          if (!booking.technicianId || booking.technicianId.trim() === "") {
            return {
              error: "Please assign a technician before starting service.",
              status: 400,
            };
          }
        }

        // If confirming, verify slot capacity
        if (status === "confirmed") {
          const slotCapacity = await checkSlotCapacity(tx, {
            bookingDate: booking.bookingDate,
            bookingTime: booking.bookingTime,
            durationMinutes: booking.estimatedDurationMinutes || DEFAULT_SERVICE_DURATION_MINUTES,
            excludeBookingId: booking.id,
          });

          if (!slotCapacity.available) {
            return {
              error: "Maximum technician capacity reached for this time slot. Reassign or choose an alternative slot.",
              status: 409,
              code: "SLOT_FULL",
            };
          }
        }

        const updated = await tx.booking.update({
          where: { id },
          data: {
            status,
            ...(status === "confirmed" && {
              serviceConfirmedAt: new Date(),
              estimatedDurationMinutes: booking.estimatedDurationMinutes || DEFAULT_SERVICE_DURATION_MINUTES,
            }),
            ...(status === "in_progress" && !booking.serviceConfirmedAt && {
              serviceConfirmedAt: new Date(),
            }),
          },
          include: {
            customer: true,
            service: true,
            technician: true,
          },
        });

        return { updated };
      },
      {
        maxWait: 15000,
        timeout: 20000,
      }
    );

    if ("error" in updateResult && updateResult.error) {
      return Response.json(
        {
          success: false,
          error: updateResult.error,
          code: (updateResult as any).code,
        },
        { status: updateResult.status || 400 }
      );
    }

    const updatedBooking = (updateResult as any).updated;
    const isNoop = (updateResult as any).isNoop;

    // Automated status update alerts (non-blocking)
    if (!isNoop) {
      try {
        if (status === "confirmed") {
          await sendCustomerBookingConfirmedAlert({
            id: updatedBooking.id,
            vehicle: updatedBooking.vehicle,
            location: updatedBooking.location,
            bookingDate: updatedBooking.bookingDate,
            bookingTime: updatedBooking.bookingTime,
            status: updatedBooking.status,
            primaryService: updatedBooking.primaryService,
            customer: updatedBooking.customer,
            service: updatedBooking.service,
          });
        } else {
          await sendStatusUpdate({
            booking: {
              id: updatedBooking.id,
              vehicle: updatedBooking.vehicle,
              location: updatedBooking.location,
              bookingDate: updatedBooking.bookingDate,
              bookingTime: updatedBooking.bookingTime,
              message: updatedBooking.message,
              status: updatedBooking.status,
              customer: updatedBooking.customer,
              service: updatedBooking.service,
            },
            newStatus: status,
            technicianNotes: body.technicianNotes || body.notes,
          });
        }
      } catch (notifErr) {
        logger.error("admin_booking_status.notification_failed", { error: notifErr });
      }
    }

    return Response.json({
      success: true,
      message: "Booking status updated successfully.",
      booking: serializeDecimal(updatedBooking),
    });
  } catch (error) {
    logger.error("admin_booking_status.update_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to update booking status.",
      },
      { status: 500 }
    );
  }
}