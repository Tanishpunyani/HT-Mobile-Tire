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

    const [
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      emergencyRequests,
    ] = await Promise.all([
      prisma.booking.count(),

      prisma.booking.count({
        where: {
          status: "pending",
        },
      }),

      prisma.booking.count({
        where: {
          status: "confirmed",
        },
      }),

      prisma.booking.count({
        where: {
          status: "completed",
        },
      }),

      prisma.booking.count({
        where: {
          status: "cancelled",
        },
      }),

      prisma.emergencyRequest.count(),
    ]);

    return Response.json({
      success: true,
      data: {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        cancelledBookings,
        emergencyRequests,
      },
    });
  } catch (error) {
    logger.error("admin_dashboard.get_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to load dashboard data.",
      },
      { status: 500 }
    );
  }
}