"use server";

import {
  sendBookingConfirmation,
  sendEmergencyAlert,
  sendStatusUpdate,
  retryFailedNotifications,
  type BookingNotificationPayload,
  type EmergencyNotificationPayload,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

/**
 * Server Action: Send Booking Confirmation (SMS to Technician + Email to Customer)
 */
export async function notifyBookingCreatedAction(bookingId: string) {
  try {
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

    const payload: BookingNotificationPayload = {
      id: booking.id,
      vehicle: booking.vehicle,
      location: booking.location,
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      message: booking.message,
      status: booking.status,
      customer: booking.customer,
      service: booking.service,
    };

    const result = await sendBookingConfirmation(payload);
    return { success: true, result };
  } catch (error: any) {
    logger.error("notification_action.booking_created_failed", { error });
    return { success: false, error: error?.message || "Failed to send notifications." };
  }
}

/**
 * Server Action: Send Emergency Request Alert (Priority SMS to Tech + Email to Customer)
 */
export async function notifyEmergencyCreatedAction(emergencyId: string) {
  try {
    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id: emergencyId },
      include: {
        customer: true,
        service: true,
      },
    });

    if (!emergency) {
      return { success: false, error: "Emergency request not found." };
    }

    const payload: EmergencyNotificationPayload = {
      id: emergency.id,
      currentLocation: emergency.currentLocation,
      problem: emergency.problem,
      problemDetails: emergency.problemDetails,
      vehicle: emergency.vehicle,
      status: emergency.status,
      customer: emergency.customer,
      service: emergency.service,
    };

    const result = await sendEmergencyAlert(payload);
    return { success: true, result };
  } catch (error: any) {
    logger.error("notification_action.emergency_created_failed", { error });
    return { success: false, error: error?.message || "Failed to send emergency alert." };
  }
}

/**
 * Server Action: Send Booking Status Update (Admin triggered)
 */
export async function notifyStatusUpdateAction({
  bookingId,
  newStatus,
  technicianNotes,
}: {
  bookingId: string;
  newStatus: string;
  technicianNotes?: string;
}) {
  try {
    await requireAdminSession();

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

    const payload: BookingNotificationPayload = {
      id: booking.id,
      vehicle: booking.vehicle,
      location: booking.location,
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      message: booking.message,
      status: booking.status,
      customer: booking.customer,
      service: booking.service,
    };

    const result = await sendStatusUpdate({
      booking: payload,
      newStatus,
      technicianNotes,
    });

    return { success: true, result };
  } catch (error: any) {
    logger.error("notification_action.status_update_failed", { error });
    return { success: false, error: error?.message || "Failed to send status update." };
  }
}

/**
 * Server Action: Trigger Retry Queue for Failed Notification Logs (Admin tool)
 */
export async function triggerNotificationRetryAction(limit = 10) {
  try {
    await requireAdminSession();
    const result = await retryFailedNotifications(limit);
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to retry notifications." };
  }
}
