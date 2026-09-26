import { pruneOldNotificationLogs } from "@/lib/notifications";
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
    const retentionDays =
      typeof body?.retentionDays === "number" && body.retentionDays > 0
        ? body.retentionDays
        : 90;

    const result = await pruneOldNotificationLogs(retentionDays);

    return Response.json({
      success: true,
      deletedCount: result.count,
      retentionDays: result.retentionDays,
      cutoffDate: result.cutoffDate,
    });
  } catch (error: any) {
    logger.error("notifications_cleanup.cron_failed", { error });
    return Response.json(
      { success: false, error: error?.message || "Notification cleanup failed" },
      { status: 500 }
    );
  }
}
