import { retryFailedNotifications } from "@/lib/notifications";
import { verifyAdminSession, getAdminSessionToken } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    // 1. Cron/Internal authorization via Bearer token
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    const isCronAuthorized =
      Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    // 2. Admin session authorization fallback
    if (!isCronAuthorized) {
      const token = await getAdminSessionToken();
      const isAdminAuthorized = await verifyAdminSession(token);

      if (!isAdminAuthorized) {
        return Response.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const limit = typeof body?.limit === "number" ? body.limit : 10;

    const result = await retryFailedNotifications(limit);

    return Response.json({
      success: true,
      result,
    });
  } catch (error: any) {
    logger.error("notifications_retry.cron_failed", { error });
    return Response.json(
      { success: false, error: error?.message || "Retry process failed" },
      { status: 500 }
    );
  }
}
