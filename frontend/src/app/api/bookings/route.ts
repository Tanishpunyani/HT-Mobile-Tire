import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedCustomerIdsForUser } from "@/lib/auth";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import { calculateCustomerEta } from "@/lib/utils/eta";
import { bookingSchema } from "@/lib/validations/booking";
import { sendAdminBookingCreatedEmail } from "@/lib/notifications";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { checkSlotCapacity } from "@/lib/bookings/availability";
import { isSlotInPast, getTorontoTodayString } from "@/lib/utils/timezone";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`booking_${clientIp}`, 5, 60 * 1000);

    if (!rateLimit.allowed) {
      return Response.json(
        {
          success: false,
          error: "Too many booking requests. Please wait a minute before trying again.",
        },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        {
          success: false,
          error: "Please sign in before booking a service.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const result = bookingSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        {
          success: false,
          error: "Invalid booking information.",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      vehicle,
      location,
      service,
      date,
      time,
      message,
    } = result.data;

    const todayToronto = getTorontoTodayString();
    const rawDateStr = date ? String(date).trim() : todayToronto;

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(rawDateStr)) {
      return Response.json(
        { success: false, error: "Invalid appointment date format. Expected YYYY-MM-DD." },
        { status: 400 }
      );
    }
    if (rawDateStr < todayToronto) {
      return Response.json(
        { success: false, error: "Preferred appointment date cannot be in the past." },
        { status: 400 }
      );
    }

    const rawTimeStr = time ? String(time).trim() : "08:00 AM";
    const match12 = rawTimeStr.match(/^([0]?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$/i);
    const match24 = rawTimeStr.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);

    if (!match12 && !match24) {
      return Response.json(
        { success: false, error: "Invalid appointment time format." },
        { status: 400 }
      );
    }

    let hours = 8;
    let minutes = 0;
    let scheduledTimeStr = "08:00 AM";

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

    const [year, month, day] = rawDateStr.split("-").map(Number);
    const validDate = new Date(Date.UTC(year, month - 1, day));
    const validTime = new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));

    if (isSlotInPast(rawDateStr, scheduledTimeStr)) {
      return Response.json(
        { success: false, error: "Selected time has already passed." },
        { status: 400 }
      );
    }

    const email = user.email || "";
    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      result.data.name ||
      "Customer";

    // Explicit submitted booking phone takes precedence over stale Supabase metadata
    const rawSubmittedPhone = result.data.phone?.trim();
    const validSubmittedPhone =
      rawSubmittedPhone && rawSubmittedPhone !== "N/A" ? rawSubmittedPhone : null;
    const phone = validSubmittedPhone || user.user_metadata?.phone || "";

    // Execute atomic transaction for user/customer resolution and booking creation
    const { booking, errorResponse } = await prisma.$transaction(async (tx) => {
      // Concurrency lock
      try {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(74629471)`;
      } catch {
        // Fallback for non-postgres / mock DB
      }

      // 1. Find or create User safely
      if (email) {
        await tx.user.upsert({
          where: { id: user.id },
          update: {
            ...(phone && phone !== "N/A" ? { phone } : {}),
          },
          create: {
            id: user.id,
            name,
            email,
            phone,
            role: "customer",
          },
        });
      }

      // 2. Find or create Customer profile
      let customer = await tx.customer.findFirst({
        where: {
          OR: [
            { userId: user.id },
            ...(email ? [{ email }] : []),
            ...(phone ? [{ phone }] : []),
          ],
        },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            userId: user.id,
            name,
            email: email || null,
            phone,
          },
        });
      } else {
        const updateData: { userId?: string; phone?: string } = {};
        if (!customer.userId) {
          updateData.userId = user.id;
        }
        if (phone && phone !== "N/A" && phone !== customer.phone) {
          updateData.phone = phone;
        }
        if (Object.keys(updateData).length > 0) {
          customer = await tx.customer.update({
            where: {
              id: customer.id,
            },
            data: updateData,
          });
        }
      }

      // 3. Find selected service by name or slug
      const selectedService = await tx.service.findFirst({
        where: {
          OR: [
            {
              name: service,
            },
            {
              slug: service,
            },
          ],
          isActive: true,
        },
      });

      if (!selectedService) {
        return {
          booking: null,
          errorResponse: {
            success: false,
            error: "Selected service is not available.",
            status: 400,
          },
        };
      }

      // 4. Capacity & Overlap Check (maxCapacity: 1 for customer booking)
      const capacityCheck = await checkSlotCapacity(tx, {
        bookingDate: validDate,
        bookingTime: scheduledTimeStr,
        durationMinutes: 120,
        maxCapacity: 1,
      });

      if (!capacityCheck.available) {
        return {
          booking: null,
          errorResponse: {
            success: false,
            error: "Selected time slot is no longer available. Please select another slot.",
            status: 409,
          },
        };
      }

      // 5. Create booking atomically
      const createdBooking = await tx.booking.create({
        data: {
          customerId: customer.id,
          customerEmail: email ? email.trim().toLowerCase() : null,
          serviceId: selectedService.id,
          primaryService: selectedService.name,
          vehicle,
          location,
          bookingDate: validDate,
          bookingTime: validTime,
          estimatedDurationMinutes: 120,
          message: message || null,
          status: "pending",
          paymentStatus: "pending",
        },
        include: {
          customer: true,
          service: true,
        },
      });

      return { booking: createdBooking, errorResponse: null };
    }, {
      maxWait: 15000,
      timeout: 20000,
    });

    if (errorResponse || !booking) {
      return Response.json(
        {
          success: false,
          error: errorResponse?.error || "Selected service is not available.",
        },
        { status: errorResponse?.status || 400 }
      );
    }

    // 5. Automated booking alerts (Step 8: New booking is ADMIN ONLY)
    try {
      await sendAdminBookingCreatedEmail({
        id: booking.id,
        customerEmail: booking.customerEmail || booking.customer?.email,
        vehicle: booking.vehicle,
        location: booking.location,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        message: booking.message,
        status: booking.status,
        customer: booking.customer,
        service: booking.service,
      });
    } catch (notifErr) {
      logger.error("booking.notification_failed", { error: notifErr });
    }

    return Response.json(
      {
        success: true,
        message: "Booking created successfully.",
        booking: serializeDecimal(booking),
      },
      { status: 201 }
    );

  } catch (error) {
    logger.error("booking.create_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to create booking.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const authorizedCustomerIds = await getAuthorizedCustomerIdsForUser({
      id: user.id,
      email: user.email,
    });

    const whereConditions: any[] = [{ customer: { userId: user.id } }];
    if (authorizedCustomerIds.length > 0) {
      whereConditions.push({ customerId: { in: authorizedCustomerIds } });
    }

    const whereClause = {
      OR: whereConditions,
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip,
        include: {
          service: true,
          reviews: true,
          technician: true,
          technicianLocation: true,
        },
      }),
      prisma.booking.count({
        where: whereClause,
      }),
    ]);

    const safeBookings = bookings.map((b) => {
      const eta = calculateCustomerEta(b, b.technicianLocation);
      const safeB = { ...b };
      delete (safeB as Record<string, unknown>).technicianLocation;

      // Phase 6H (G-01): Sanitize technician personal phone to null for customer privacy
      if (safeB.technician) {
        safeB.technician = {
          ...safeB.technician,
          phone: null,
        };
      }

      return {
        ...serializeDecimal(safeB),
        bookedAt: b.createdAt.toISOString(),
        etaMinutes: eta.etaMinutes,
        estimatedArrivalAt: eta.estimatedArrivalAt,
        arrivalStatus: eta.arrivalStatus,
        etaUpdatedAt: eta.updatedAt,
        distanceMiles: eta.distanceMiles,
      };
    });

    return Response.json({
      success: true,
      bookings: safeBookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("booking.list_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to get your bookings.",
      },
      { status: 500 }
    );
  }
}