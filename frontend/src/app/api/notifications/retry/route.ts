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
    const { searchParams } = new URL(request.url);
    const queryLimit = searchParams.get("limit");
    const rawLimit = body?.limit ?? queryLimit;

    const parsedLimit =
      typeof rawLimit === "number"
        ? Math.floor(rawLimit)
        : typeof rawLimit === "string"
        ? parseInt(rawLimit, 10)
        : 10;
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 50)
        : 10;

    const result = await retryFailedNotifications(limit);

    if (
      result &&
      typeof result === "object" &&
      "error" in result &&
      (result as any).error &&
      !(result as any).total &&
      !(result as any).succeeded
    ) {
      return Response.json(
        { success: false, error: (result as any).error },
        { status: 500 }
      );
    }

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

/**
 * Support Vercel Cron native invocation (which defaults to GET)
 */
export async function GET(request: Request) {
  return POST(request);
}
