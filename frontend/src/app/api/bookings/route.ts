import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedCustomerIdsForUser } from "@/lib/auth";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import { calculateCustomerEta } from "@/lib/utils/eta";
import { bookingSchema } from "@/lib/validations/booking";
import { sendBookingConfirmation, sendAdminBookingCreatedEmail } from "@/lib/notifications";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

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

      const now = new Date();
      const parsedDate = date ? new Date(`${date}T00:00:00`) : now;
      const validDate = isNaN(parsedDate.getTime()) ? now : parsedDate;
      const cleanTime = time && time.includes(":") ? (time.length === 5 ? time : time.slice(0, 5)) : null;
      const parsedTime = cleanTime ? new Date(`1970-01-01T${cleanTime}:00`) : now;
      const validTime = isNaN(parsedTime.getTime()) ? now : parsedTime;

      // 4. Create booking
      const createdBooking = await tx.booking.create({
        data: {
          customerId: customer.id,
          serviceId: selectedService.id,
          primaryService: selectedService.name,
          vehicle,
          location,
          bookingDate: validDate,
          bookingTime: validTime,
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

    // 5. Automated booking alerts (non-blocking)
    try {
      await sendBookingConfirmation({
        id: booking.id,
        vehicle: booking.vehicle,
        location: booking.location,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        message: booking.message,
        status: booking.status,
        customer: booking.customer,
        service: booking.service,
      });
      await sendAdminBookingCreatedEmail({
        id: booking.id,
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