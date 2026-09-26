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

    const logs = await prisma.notificationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return Response.json({
      success: true,
      logs,
    });
  } catch (error) {
    logger.error("admin_notifications.get_failed", { error });
    return Response.json(
      { success: false, error: "Unable to retrieve notification logs." },
      { status: 500 }
    );
  }
}
