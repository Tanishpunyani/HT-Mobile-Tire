"use server";

import { prisma } from "@/lib/prisma";
import { verifyTechnicianDispatchToken } from "@/lib/technician-auth";
import { getAdminSessionToken, verifyAdminSession } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { validateBookingTransition } from "@/lib/bookings/state-machine";
import { revalidatePath } from "next/cache";
import {
  sendCustomerTechnicianArrivedAlert,
  sendCustomerTechnicianEnRouteAlert,
} from "@/lib/notifications";

export async function markTechnicianArrivedAction(bookingId: string, token?: string) {
  try {
    if (!bookingId || typeof bookingId !== "string" || bookingId.trim() === "") {
      return { success: false, error: "Valid booking ID is required." };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId.trim() },
    });

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    let isAuthorized = false;
    let authorizedRole: "technician" | "admin" = "technician";
    const trimmedToken = (token || "").trim();

    // -------------------------------------------------------------
    // Path A: Dispatch Token Present -> Strict HMAC & Scope Check
    // -------------------------------------------------------------
    if (trimmedToken) {
      const verification = verifyTechnicianDispatchToken(trimmedToken, {
        expectedBookingId: booking.id,
        expectedTechnicianId: booking.technicianId || undefined,
      });

      if (!verification.valid) {
        return {
          success: false,
          error: verification.error || "Unauthorized technician dispatch token.",
        };
      }

      if (booking.technicianId && verification.technicianId !== booking.technicianId) {
        return {
          success: false,
          error: "Dispatch token is not authorized for the technician assigned to this booking.",
        };
      }

      isAuthorized = true;
      authorizedRole = "technician";
    } else {
      // -------------------------------------------------------------
      // Path B: Token Absent / Empty -> Server-Side Admin / Staff Auth
      // -------------------------------------------------------------
      // 1. Verify Admin Session Cookie
      const adminCookieToken = await getAdminSessionToken();
      if (adminCookieToken) {
        const isValidAdmin = await verifyAdminSession(adminCookieToken);
        if (isValidAdmin) {
          isAuthorized = true;
          authorizedRole = "admin";
        }
      }

      // 2. Verify Authenticated Staff User in PostgreSQL
      if (!isAuthorized) {
        try {
          const supabase = await createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id },
            });

            if (dbUser?.role === "admin") {
              isAuthorized = true;
              authorizedRole = "admin";
            } else if (dbUser?.role === "technician") {
              if (booking.technicianId) {
                const techRecord = await prisma.technician.findFirst({
                  where: { id: booking.technicianId, isActive: true },
                });
                if (techRecord) {
                  isAuthorized = true;
                  authorizedRole = "technician";
                }
              }
            }
          }
        } catch {
          // Supabase session check failed
        }
      }
    }

    if (!isAuthorized) {
      return {
        success: false,
        error: "Unauthorized. Valid technician dispatch token or admin session required.",
      };
    }

    // -------------------------------------------------------------
    // Phase 6B: State Machine & Idempotent Arrival Validation
    // Technician arrival is a milestone; status remains confirmed.
    // -------------------------------------------------------------
    if (booking.status !== "confirmed") {
      return {
        success: false,
        error: `Cannot record arrival for booking in "${booking.status}" status. Booking must be confirmed.`,
      };
    }

    if (!booking.technicianId || booking.technicianId.trim() === "") {
      return {
        success: false,
        error: "Cannot record arrival. No technician is assigned to this booking.",
      };
    }

    const arrivalTimestamp = booking.arrivedAt || new Date();

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        arrivedAt: arrivalTimestamp,
        status: "confirmed",
      },
      include: {
        customer: true,
        service: true,
        technician: true,
      },
    });

    // Non-blocking Customer Technician Arrived SMS (Phase 3C)
    try {
      await sendCustomerTechnicianArrivedAlert({
        id: updated.id,
        vehicle: updated.vehicle,
        location: updated.location,
        bookingDate: updated.bookingDate,
        bookingTime: updated.bookingTime,
        status: updated.status,
        primaryService: updated.primaryService,
        customer: updated.customer,
        service: updated.service,
        technician: updated.technician,
      });
    } catch (notifErr) {
      console.warn("Failed to dispatch customer technician arrived SMS:", notifErr);
    }

    revalidatePath(`/technician`);
    revalidatePath(`/technician/tracking/${booking.id}`);
    revalidatePath(`/admin/bookings`);
    revalidatePath(`/account/bookings/${booking.id}`);

    return {
      success: true,
      arrivedAt: (arrivalTimestamp instanceof Date ? arrivalTimestamp : new Date(arrivalTimestamp)).toISOString(),
      status: "confirmed",
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record arrival." };
  }
}

export async function startTechnicianTripAction(bookingId: string, token?: string) {
  try {
    if (!bookingId || typeof bookingId !== "string" || bookingId.trim() === "") {
      return { success: false, error: "Valid booking ID is required." };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId.trim() },
      include: {
        customer: true,
        service: true,
        technician: true,
      },
    });

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    let isAuthorized = false;
    let authorizedRole: "technician" | "admin" = "technician";
    const trimmedToken = (token || "").trim();

    // -------------------------------------------------------------
    // Path A: Dispatch Token Present -> Strict HMAC & Scope Check
    // -------------------------------------------------------------
    if (trimmedToken) {
      const verification = verifyTechnicianDispatchToken(trimmedToken, {
        expectedBookingId: booking.id,
        expectedTechnicianId: booking.technicianId || undefined,
      });

      if (!verification.valid) {
        return {
          success: false,
          error: verification.error || "Unauthorized technician dispatch token.",
        };
      }

      if (booking.technicianId && verification.technicianId !== booking.technicianId) {
        return {
          success: false,
          error: "Dispatch token is not authorized for the technician assigned to this booking.",
        };
      }

      isAuthorized = true;
      authorizedRole = "technician";
    } else {
      // -------------------------------------------------------------
      // Path B: Token Absent / Empty -> Server-Side Admin / Staff Auth
      // -------------------------------------------------------------
      const adminCookieToken = await getAdminSessionToken();
      if (adminCookieToken) {
        const isValidAdmin = await verifyAdminSession(adminCookieToken);
        if (isValidAdmin) {
          isAuthorized = true;
          authorizedRole = "admin";
        }
      }

      if (!isAuthorized) {
        try {
          const supabase = await createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id },
            });

            if (dbUser?.role === "admin") {
              isAuthorized = true;
              authorizedRole = "admin";
            } else if (dbUser?.role === "technician") {
              if (booking.technicianId) {
                const techRecord = await prisma.technician.findFirst({
                  where: { id: booking.technicianId, isActive: true },
                });
                if (techRecord) {
                  isAuthorized = true;
                  authorizedRole = "technician";
                }
              }
            }
          }
        } catch {
          // Supabase session check failed
        }
      }
    }

    if (!isAuthorized) {
      return {
        success: false,
        error: "Unauthorized. Valid technician dispatch token or admin session required.",
      };
    }

    // Must be in confirmed status
    if (booking.status !== "confirmed" && booking.status !== "in_progress") {
      return {
        success: false,
        error: `Cannot start trip for booking in "${booking.status}" status. Booking must be confirmed.`,
      };
    }

    // Non-blocking Customer En-Route SMS Dispatch (Phase 3C)
    // Booking status remains 'confirmed' (or 'in_progress') without mutation
    try {
      await sendCustomerTechnicianEnRouteAlert({
        booking: {
          id: booking.id,
          vehicle: booking.vehicle,
          location: booking.location,
          bookingDate: booking.bookingDate,
          bookingTime: booking.bookingTime,
          status: booking.status,
          primaryService: booking.primaryService,
          customer: booking.customer,
          service: booking.service,
          technician: booking.technician,
        },
        etaMinutes: null,
      });
    } catch (notifErr) {
      console.warn("Failed to dispatch technician en route SMS:", notifErr);
    }

    revalidatePath(`/technician`);
    revalidatePath(`/technician/tracking/${booking.id}`);
    revalidatePath(`/account/bookings/${booking.id}`);

    return {
      success: true,
      message: "Technician trip started successfully.",
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to start technician trip." };
  }
}

export async function getTechnicianPortalDataAction(token: string) {
  try {
    const verification = verifyTechnicianDispatchToken(token);
    if (!verification.valid || !verification.technicianId) {
      return { success: false, error: verification.error || "Invalid technician token." };
    }

    const technician = await prisma.technician.findUnique({
      where: { id: verification.technicianId },
    });

    if (!technician) {
      return { success: false, error: "Technician not found." };
    }

    const allBookings = await prisma.booking.findMany({
      where: {
        technicianId: technician.id,
      },
      include: {
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const activeJobs = allBookings
      .filter((b) => b.status === "confirmed" || b.status === "in_progress" || b.status === "pending")
      .map((b) => ({
        ...b,
        arrivedAt: b.arrivedAt ? b.arrivedAt.toISOString() : null,
        totalAmount: b.totalAmount != null ? Number(b.totalAmount) : null,
      }));

    const completedJobs = allBookings
      .filter((b) => b.status === "completed")
      .map((b) => ({
        ...b,
        arrivedAt: b.arrivedAt ? b.arrivedAt.toISOString() : null,
        totalAmount: b.totalAmount != null ? Number(b.totalAmount) : null,
      }));

    const cancelledJobs = allBookings
      .filter((b) => b.status === "cancelled")
      .map((b) => ({
        ...b,
        arrivedAt: b.arrivedAt ? b.arrivedAt.toISOString() : null,
        totalAmount: b.totalAmount != null ? Number(b.totalAmount) : null,
      }));

    return {
      success: true,
      technician: {
        id: technician.id,
        name: technician.name,
        phone: technician.phone,
        role: "technician",
        isActive: technician.isActive,
      },
      activeJobs,
      completedJobs,
      cancelledJobs,
      stats: {
        totalCompleted: completedJobs.length,
        activeCount: activeJobs.length,
        completedCount: completedJobs.length,
        cancelledCount: cancelledJobs.length,
        totalCount: allBookings.length,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch technician data." };
  }
}
