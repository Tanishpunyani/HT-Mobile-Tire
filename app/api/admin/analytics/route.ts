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
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // Get bookings with service information
    const bookings = await prisma.booking.findMany({
      select: {
        status: true,
        bookingDate: true,
        service: {
          select: {
            name: true,
          },
        },
      },
    });

    // Get emergency requests count
    const emergencyRequests = await prisma.emergencyRequest.count();

    // Bookings by service
    const serviceCounts: Record<string, number> = {};

    bookings.forEach((booking) => {
      const serviceName = booking.service?.name || "Unknown Service";
      serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
    });

    // Bookings per month
    const monthlyCounts: Record<string, number> = {};

    bookings.forEach((booking) => {
      const date = new Date(booking.bookingDate);
      const month = date.toLocaleString("en-US", {
        month: "short",
      });
      const year = date.getFullYear();
      const key = `${month} ${year}`;
      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
    });

    // Completed vs cancelled
    const completedBookings = bookings.filter(
      (booking) => booking.status === "completed"
    ).length;

    const cancelledBookings = bookings.filter(
      (booking) => booking.status === "cancelled"
    ).length;

    return Response.json({
      success: true,
      data: {
        totalBookings: bookings.length,
        serviceCounts,
        monthlyCounts,
        completedBookings,
        cancelledBookings,
        emergencyRequests,
      },
    });
  } catch (error) {
    logger.error("admin_analytics.get_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to load analytics.",
      },
      { status: 500 }
    );
  }
}