"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";
import { validateBookingTransition } from "@/lib/bookings/state-machine";
import { revalidatePath } from "next/cache";
import {
  sendAdminBookingCancelledAlert,
  sendCustomerBookingConfirmedAlert,
  sendCustomerTechnicianAssignedAlert,
  sendCustomerServiceStartedAlert,
  sendCustomerBookingCancelledAlert,
} from "@/lib/notifications";
import { checkSlotCapacity, DEFAULT_SERVICE_DURATION_MINUTES } from "@/lib/bookings/availability";

export async function confirmBookingAction(bookingId: string) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return { success: false, error: "Unauthorized. Admin session required." };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    const transition = validateBookingTransition(booking.status, "confirmed", "admin");
    if (!transition.allowed) {
      return { success: false, error: transition.error || "Cannot confirm booking." };
    }

    if (transition.isNoop) {
      return { success: true };
    }

    // Verify slot capacity before confirming booking
    const slotCapacity = await checkSlotCapacity(prisma, {
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      durationMinutes: booking.estimatedDurationMinutes || DEFAULT_SERVICE_DURATION_MINUTES,
      excludeBookingId: booking.id,
    });

    if (!slotCapacity.available) {
      return {
        success: false,
        error: "Maximum technician capacity reached for this time slot. Reassign or choose an alternative slot.",
      };
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "confirmed",
        serviceConfirmedAt: new Date(),
      },
      include: {
        customer: true,
        service: true,
      },
    });

    // Non-blocking Customer Booking Confirmation SMS (Phase 3C)
    try {
      await sendCustomerBookingConfirmedAlert({
        id: updated.id,
        vehicle: updated.vehicle,
        location: updated.location,
        bookingDate: updated.bookingDate,
        bookingTime: updated.bookingTime,
        status: updated.status,
        primaryService: updated.primaryService,
        customer: updated.customer,
        service: updated.service,
      });
    } catch (notifErr) {
      console.warn("Failed to dispatch customer booking confirmation SMS:", notifErr);
    }

    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${bookingId}`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to confirm booking." };
  }
}

export async function startServiceAction(bookingId: string) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return { success: false, error: "Unauthorized. Admin session required." };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    // Phase 6B: Require assigned technician before starting service
    if (!booking.technicianId || booking.technicianId.trim() === "") {
      return {
        success: false,
        error: "Please assign a technician before starting service.",
      };
    }

    const transition = validateBookingTransition(booking.status, "in_progress", "admin");
    if (!transition.allowed) {
      return { success: false, error: transition.error || "Cannot start service." };
    }

    if (transition.isNoop) {
      return { success: true };
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "in_progress" },
      include: {
        customer: true,
        service: true,
      },
    });

    try {
      await sendCustomerServiceStartedAlert({
        id: updated.id,
        vehicle: updated.vehicle,
        location: updated.location,
        bookingDate: updated.bookingDate,
        bookingTime: updated.bookingTime,
        status: updated.status,
        primaryService: updated.primaryService,
        customer: updated.customer,
        service: updated.service,
      });
    } catch (notifErr) {
      console.warn("Failed to dispatch customer service started alert:", notifErr);
    }

    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${bookingId}`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to start service." };
  }
}

export async function cancelBookingAction(bookingId: string, reason?: string) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return { success: false, error: "Unauthorized. Admin session required." };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, service: true },
    });

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    const transition = validateBookingTransition(booking.status, "cancelled", "admin");
    if (!transition.allowed) {
      return { success: false, error: transition.error || "Cannot cancel booking." };
    }

    if (transition.isNoop) {
      return { success: true };
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "cancelled",
        notes: reason ? `${booking.notes ? booking.notes + "\n" : ""}Cancellation Reason: ${reason}` : booking.notes,
      },
    });

    // Non-blocking Admin SMS Alert (Phase 3B)
    try {
      await sendAdminBookingCancelledAlert({
        booking,
        cancelledBy: "Admin",
        reason: reason || "Cancelled by admin",
      });
    } catch (notifErr) {
      console.warn("Failed to dispatch cancellation notification to admin:", notifErr);
    }

    // Non-blocking Customer Cancellation SMS (Phase 3C)
    try {
      await sendCustomerBookingCancelledAlert({
        id: booking.id,
        vehicle: booking.vehicle,
        location: booking.location,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        status: "cancelled",
        primaryService: booking.primaryService,
        customer: booking.customer,
        service: booking.service,
      });
    } catch (notifErr) {
      console.warn("Failed to dispatch customer cancellation SMS:", notifErr);
    }

    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${bookingId}`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to cancel booking." };
  }
}

export async function assignTechnicianAction(bookingId: string, technicianId: string) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return { success: false, error: "Unauthorized. Admin session required." };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        service: true,
      },
    });

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    // Phase 6H (G-03.A): Terminal booking protection
    if (booking.status === "completed" || booking.status === "cancelled") {
      return {
        success: false,
        error: `Cannot assign technician to a ${booking.status} booking.`,
      };
    }

    // Phase 6H (G-03.B): Same-technician reassignment is a safe no-op
    if (booking.technicianId === technicianId) {
      return { success: true };
    }

    const technician = await prisma.technician.findUnique({
      where: { id: technicianId },
    });

    if (!technician || !technician.isActive) {
      return { success: false, error: "Selected technician is inactive or invalid." };
    }

    const isAutoConfirming = booking.status === "pending";

    // Phase 6H (G-03.C): If auto-confirming from pending, validate slot capacity
    if (isAutoConfirming) {
      const slotCapacity = await checkSlotCapacity(prisma, {
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        durationMinutes: booking.estimatedDurationMinutes || DEFAULT_SERVICE_DURATION_MINUTES,
        excludeBookingId: booking.id,
      });

      if (!slotCapacity.available) {
        return {
          success: false,
          error: "Maximum technician capacity reached for this time slot. Reassign or choose an alternative slot.",
        };
      }
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        technicianId,
        status: isAutoConfirming ? "confirmed" : booking.status,
        ...(isAutoConfirming && {
          serviceConfirmedAt: new Date(),
          estimatedDurationMinutes: booking.estimatedDurationMinutes || DEFAULT_SERVICE_DURATION_MINUTES,
        }),
      },
      include: {
        customer: true,
        service: true,
      },
    });

    // Phase 6H (G-03.C): Trigger canonical BOOKING_CONFIRMED notification exactly once if auto-confirmed
    if (isAutoConfirming) {
      try {
        await sendCustomerBookingConfirmedAlert({
          id: updated.id,
          vehicle: updated.vehicle,
          location: updated.location,
          bookingDate: updated.bookingDate,
          bookingTime: updated.bookingTime,
          status: updated.status,
          primaryService: updated.primaryService,
          customer: updated.customer,
          service: updated.service,
        });
      } catch (notifErr) {
        console.warn("Failed to dispatch customer booking confirmation SMS during auto-confirm:", notifErr);
      }
    }

    // Non-blocking Customer Technician Assigned SMS (Phase 3C)
    try {
      await sendCustomerTechnicianAssignedAlert({
        booking: {
          id: updated.id,
          vehicle: updated.vehicle,
          location: updated.location,
          bookingDate: updated.bookingDate,
          bookingTime: updated.bookingTime,
          status: updated.status,
          primaryService: updated.primaryService,
          customer: updated.customer,
          service: updated.service,
        },
        technician: {
          id: technician.id,
          name: technician.name,
          phone: technician.phone,
        },
      });
    } catch (notifErr) {
      console.warn("Failed to dispatch customer technician assigned SMS:", notifErr);
    }

    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${bookingId}`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to assign technician." };
  }
}
