"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateCustomerForUser, getAuthorizedCustomerIdsForUser } from "@/lib/auth";
import { validateBookingTransition } from "@/lib/bookings/state-machine";
import { checkSlotCapacity } from "@/lib/bookings/availability";
import {
  sendBookingConfirmation,
  sendAdminBookingCancelledAlert,
  sendCustomerBookingCancelledAlert,
} from "@/lib/notifications";
import { revalidatePath } from "next/cache";

export async function createBookingRequestAction(formData: {
  serviceId?: string;
  service?: string;
  serviceType?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  bookingDate?: string;
  bookingTime?: string;
  address?: string;
  location?: string;
  formattedAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  tireSize?: string | null;
  name: string;
  email: string;
  phone: string;
  vehicle?: string;
  vehicleDetails?: {
    year: string;
    make: string;
    model: string;
    tireSize?: string;
  };
  notes?: string;
  message?: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Resolve or create customer profile using unified identity resolver
    let customerId: string | null = null;
    const submittedPhone =
      formData.phone && formData.phone.trim() !== "" && formData.phone.trim() !== "N/A"
        ? formData.phone.trim()
        : null;

    if (user) {
      const resolvedCustomer = await getOrCreateCustomerForUser({
        id: user.id,
        email: formData.email || user.email || "",
        name: formData.name,
        phone: formData.phone,
      });
      customerId = resolvedCustomer.id;

      // Ensure database customer row reflects explicitly submitted booking phone
      if (submittedPhone && resolvedCustomer.phone !== submittedPhone) {
        try {
          await prisma.customer.update({
            where: { id: resolvedCustomer.id },
            data: { phone: submittedPhone },
          });
        } catch (updateErr: any) {
          console.warn("Failed to synchronize customer phone in booking action:", updateErr);
        }
      }
    } else {
      let customer = await prisma.customer.findFirst({
        where: {
          OR: [
            ...(formData.phone ? [{ phone: formData.phone }] : []),
            ...(formData.email ? [{ email: formData.email }] : []),
          ],
        },
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || "N/A",
          },
        });
      } else {
        // If an existing customer was matched for a guest booking (e.g. by email),
        // update customer.phone if a valid new phone was submitted
        if (submittedPhone && customer.phone !== submittedPhone) {
          try {
            customer = await prisma.customer.update({
              where: { id: customer.id },
              data: { phone: submittedPhone },
            });
          } catch (updateErr: any) {
            console.warn("Failed to update guest customer phone:", updateErr);
          }
        }
      }
      customerId = customer.id;
    }

    // 2. Validate and Parse Date & Time
    const rawDateStr = String(formData.scheduledDate || formData.bookingDate || "").trim();
    const rawTimeStr = String(formData.scheduledTime || formData.bookingTime || "").trim();

    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    let bookingDateObj: Date;
    if (rawDateStr) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDateStr)) {
        return { success: false, error: "Invalid appointment date format. Expected YYYY-MM-DD." };
      }
      const [year, month, day] = rawDateStr.split("-").map(Number);
      const candidateDate = new Date(Date.UTC(year, month - 1, day));
      if (
        isNaN(candidateDate.getTime()) ||
        candidateDate.getUTCFullYear() !== year ||
        candidateDate.getUTCMonth() !== month - 1 ||
        candidateDate.getUTCDate() !== day
      ) {
        return { success: false, error: "Invalid calendar date provided." };
      }
      if (candidateDate < todayUtc) {
        return { success: false, error: "Preferred appointment date cannot be in the past." };
      }
      bookingDateObj = candidateDate;
    } else {
      bookingDateObj = todayUtc;
    }

    let bookingTimeObj: Date = now;
    let scheduledTimeStr = "09:00 AM";

    if (rawTimeStr) {
      const match12 = rawTimeStr.match(/^([0]?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$/i);
      const match24 = rawTimeStr.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);

      if (!match12 && !match24) {
        return { success: false, error: "Invalid appointment time format." };
      }

      let hours = 9;
      let minutes = 0;

      if (match12) {
        let h = parseInt(match12[1], 10);
        minutes = parseInt(match12[2], 10);
        const meridiem = match12[3].toUpperCase();
        if (meridiem === "PM" && h < 12) h += 12;
        if (meridiem === "AM" && h === 12) h = 0;
        hours = h;
        scheduledTimeStr = `${match12[1].padStart(2, "0")}:${match12[2]} ${meridiem}`;
      } else if (match24) {
        hours = parseInt(match24[1], 10);
        minutes = parseInt(match24[2], 10);
        const meridiem = hours >= 12 ? "PM" : "AM";
        const h12 = hours % 12 || 12;
        scheduledTimeStr = `${String(h12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${meridiem}`;
      }

      bookingTimeObj = new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
    }

    // 3. Capacity Check
    const capacityCheck = await checkSlotCapacity(prisma, {
      bookingDate: bookingDateObj,
      bookingTime: scheduledTimeStr,
    });

    if (!capacityCheck.available) {
      return {
        success: false,
        error: "Selected time slot is no longer available. Please select another slot.",
      };
    }

    const primaryService = formData.service || formData.serviceType || "Flat Tire Repair";
    const vehicleStr =
      formData.vehicle ||
      (formData.vehicleDetails
        ? `${formData.vehicleDetails.year} ${formData.vehicleDetails.make} ${formData.vehicleDetails.model}`
        : "Standard Vehicle");
    const locStr = formData.formattedAddress || formData.address || formData.location || "Dallas, TX";

    // 4. Create Booking
    const booking = await prisma.booking.create({
      data: {
        customerId,
        serviceId: formData.serviceId || null,
        primaryService,
        bookingDate: bookingDateObj,
        bookingTime: bookingTimeObj,
        vehicle: vehicleStr,
        location: locStr,
        formattedAddress: formData.formattedAddress || null,
        latitude: formData.latitude ?? null,
        longitude: formData.longitude ?? null,
        city: formData.city ?? null,
        state: formData.state ?? null,
        zipCode: formData.zipCode ?? null,
        tireSize: formData.tireSize ?? null,
        message: formData.message || formData.notes || null,
        status: "pending",
        paymentStatus: "pending",
      },
    });

    // 5. Non-blocking Notification Dispatch with Preserved GPS Coordinates
    try {
      await sendBookingConfirmation({
        id: booking.id,
        status: "pending",
        bookingDate: bookingDateObj,
        bookingTime: scheduledTimeStr,
        location: locStr,
        formattedAddress: booking.formattedAddress || formData.formattedAddress || null,
        latitude: booking.latitude ?? formData.latitude ?? null,
        longitude: booking.longitude ?? formData.longitude ?? null,
        vehicle: vehicleStr,
        customer: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
        },
        service: {
          name: primaryService,
        },
        message: booking.message,
      });
    } catch (notifErr) {
      console.warn("Failed to dispatch booking notification:", notifErr);
    }

    revalidatePath("/account");
    revalidatePath("/admin/bookings");

    return { success: true, bookingId: booking.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create booking" };
  }
}

export async function cancelCustomerBookingAction(bookingId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized." };
    }

    const authorizedCustomerIds = await getAuthorizedCustomerIdsForUser({
      id: user.id,
      email: user.email,
    });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, service: true },
    });

    const isAuthorizedOwner =
      booking &&
      (booking.customer?.userId === user.id ||
        (booking.customerId && authorizedCustomerIds.includes(booking.customerId)));

    if (!isAuthorizedOwner) {
      return { success: false, error: "Booking not found or access denied." };
    }

    const transition = validateBookingTransition(booking.status, "cancelled", "customer");
    if (!transition.allowed) {
      return {
        success: false,
        error: transition.error || "Cannot cancel booking in its current state.",
      };
    }

    if (transition.isNoop) {
      return { success: true };
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "cancelled",
      },
    });

    // Non-blocking Admin SMS Alert (Phase 3B)
    try {
      await sendAdminBookingCancelledAlert({
        booking,
        cancelledBy: "Customer",
        reason: "Customer cancelled via account portal",
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

    revalidatePath("/account");
    revalidatePath(`/account/bookings/${bookingId}`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to cancel booking" };
  }
}
