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
        { success: false, error: "Administrator access required." },
        { status: 401 }
      );
    }

    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        booking: {
          include: {
            service: true,
          },
        },
      },
    });

    return Response.json({
      success: true,
      reviews,
    });
  } catch (error) {
    logger.error("admin_reviews.get_failed", { error });
    return Response.json(
      { success: false, error: "Unable to retrieve reviews." },
      { status: 500 }
    );
  }
}
