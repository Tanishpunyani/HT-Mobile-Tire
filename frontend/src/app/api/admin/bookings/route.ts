import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import { verifyAdminSession, ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

    const isValid = await verifyAdminSession(token);

    if (!isValid) {
      return Response.json(
        {
          success: false,
          error: "Administrator access required.",
        },
        { status: 401 }
      );
    }

    try {
      const [bookings, technicians] = await Promise.all([
        prisma.booking.findMany({
          orderBy: {
            createdAt: "desc",
          },
          include: {
            customer: true,
            service: true,
            technician: true,
          },
        }),
        prisma.technician.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
        }),
      ]);

      return Response.json({
        success: true,
        count: bookings.length,
        bookings: serializeDecimal(bookings),
        technicians: serializeDecimal(technicians),
      });
    } catch (prismaErr) {
      logger.warn("admin_bookings.prisma_fallback", { error: prismaErr });
      const supabase: any = createAdminClient();
      const { data: bookingsData, error: sbError } = await (supabase.from("bookings") as any)
        .select("*, customer:customers(*), service:services(*)")
        .order("created_at", { ascending: false });

      if (sbError) {
        throw sbError;
      }

      const formatted = (bookingsData || []).map((b: any) => ({
        id: b.id,
        primaryService: b.primary_service,
        extraServices: b.extra_services,
        vehicle: b.vehicle,
        location: b.location,
        formattedAddress: b.formatted_address,
        latitude: b.latitude,
        longitude: b.longitude,
        bookingDate: b.booking_date,
        bookingTime: b.booking_time,
        status: b.status,
        paymentStatus: b.payment_status,
        totalAmount: b.total_amount,
        notes: b.notes,
        tireSize: b.tire_size,
        message: b.message,
        customer: b.customer,
        service: b.service,
        createdAt: b.created_at,
      }));

      return Response.json({
        success: true,
        count: formatted.length,
        bookings: formatted,
      });
    }
  } catch (error: any) {
    logger.error("admin_bookings.get_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to load bookings. Please try again.",
      },
      { status: 500 }
    );
  }
}