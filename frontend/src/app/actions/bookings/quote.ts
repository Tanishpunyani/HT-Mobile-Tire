"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";
import { validateBookingTransition, validatePaymentTransition } from "@/lib/bookings/state-machine";
import { completeQuoteSchema } from "@/lib/validations/complete-quote";
import { generateQuotePdf } from "@/lib/receipts";
import {
  sendQuoteReadyNotification,
  sendCustomerPaymentReceivedAlert,
  sendCustomerServiceCompletedAlert,
} from "@/lib/notifications";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import { revalidatePath } from "next/cache";

export interface CompleteAndQuoteParams {
  bookingId: string;
  basePrice: number;
  extraServices?: Array<{ name: string; price: number }>;
  notes?: string | null;
}

export async function completeAndQuoteAction(params: CompleteAndQuoteParams) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return { success: false, error: "Unauthorized. Admin session required." };
    }

    const validated = completeQuoteSchema.parse(params);

    const booking = await prisma.booking.findUnique({
      where: { id: validated.bookingId },
      include: { customer: true },
    });

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    const bookingTransition = validateBookingTransition(booking.status, "completed", "admin");
    if (!bookingTransition.allowed) {
      return {
        success: false,
        error: bookingTransition.error || "Cannot complete booking in current status.",
      };
    }

    const extraTotal = (validated.extraServices || []).reduce((sum, e) => sum + e.price, 0);
    const totalAmount = validated.basePrice + extraTotal;

    // Phase 6D: Preserve "paid" status if quote is edited after settlement
    const newPaymentStatus =
      booking.paymentStatus === "paid"
        ? "paid"
        : "quote_sent";

    const updated = await prisma.booking.update({
      where: { id: validated.bookingId },
      data: {
        status: "completed",
        paymentStatus: newPaymentStatus,
        totalAmount,
        extraServices: validated.extraServices as any,
        notes: validated.notes || booking.notes,
      },
    });

    // Send Dedicated Service Completed WhatsApp Alert (Non-blocking)
    try {
      await sendCustomerServiceCompletedAlert({
        id: booking.id,
        vehicle: booking.vehicle || "Vehicle",
        location: booking.formattedAddress || booking.location || "Dallas, TX",
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        status: "completed",
        primaryService: booking.primaryService,
        customer: booking.customer,
      });
    } catch (completeErr) {
      console.warn("Service completed notification warning:", completeErr);
    }

    // Generate Quote / Invoice PDF
    try {
      await generateQuotePdf({
        quoteNumber: `INV-${booking.id.substring(0, 8).toUpperCase()}`,
        bookingId: booking.id,
        customerName: booking.customer?.name || "Valued Customer",
        customerPhone: booking.customer?.phone || "",
        customerEmail: booking.customer?.email,
        vehicle: booking.vehicle || "Vehicle",
        location: booking.formattedAddress || booking.location || "Dallas, TX",
        primaryService: booking.primaryService || "Flat Tire Repair",
        basePrice: validated.basePrice,
        extraServices: validated.extraServices,
        totalAmount,
        notes: validated.notes,
        date: new Date().toLocaleDateString(),
      });
    } catch (pdfErr) {
      console.warn("PDF generation warning:", pdfErr);
    }

    // Send Customer Quote Ready Notification (Non-blocking)
    try {
      await sendQuoteReadyNotification({
        bookingId: booking.id,
        customerName: booking.customer?.name || "Customer",
        customerPhone: booking.customer?.phone,
        customerEmail: booking.customer?.email,
        serviceName: booking.primaryService || "Mobile Tire Service",
        vehicle: booking.vehicle || "Vehicle",
        basePrice: validated.basePrice,
        extraServices: validated.extraServices,
        totalAmount,
        notes: validated.notes,
      });
    } catch (notifyErr) {
      console.warn("Quote ready notification warning:", notifyErr);
    }

    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${validated.bookingId}`);
    revalidatePath("/account");

    return { success: true, booking: serializeDecimal(updated) };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to complete quote." };
  }
}

export async function markBookingPaidAction(bookingId: string) {
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

    const paymentTransition = validatePaymentTransition(booking.paymentStatus, "paid", "admin");
    if (!paymentTransition.allowed) {
      return {
        success: false,
        error: paymentTransition.error || "Invalid payment status transition.",
      };
    }

    if (paymentTransition.isNoop) {
      return { success: true };
    }

    // Phase 6H (G-07): Only a completed booking may transition to paymentStatus = paid
    if (booking.status !== "completed") {
      return {
        success: false,
        error: `Cannot mark booking as paid while in "${booking.status}" status. Service must be completed before payment can be marked as paid.`,
      };
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: "paid",
      },
      include: { customer: true, service: true },
    });

    // Non-blocking Customer Payment Received Notification (Phase 6D)
    try {
      await sendCustomerPaymentReceivedAlert({
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
      console.warn("Failed to dispatch customer payment received notification:", notifErr);
    }

    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath("/account");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark booking as paid." };
  }
}
