import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession, ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth";
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

    const customers = await prisma.customer.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        bookings: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            service: true,
          },
        },
      },
    });

    const customerData = customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      bookings: customer.bookings.length,
      serviceHistory: customer.bookings.map((booking) => ({
        service: booking.service?.name || "Unknown Service",
        vehicle: booking.vehicle,
        date: booking.bookingDate,
        status: booking.status,
      })),
    }));

    return Response.json({
      success: true,
      count: customerData.length,
      customers: customerData,
    });
  } catch (error: any) {
    logger.error("admin_customers.get_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to get customers.",
      },
      { status: 500 }
    );
  }
}