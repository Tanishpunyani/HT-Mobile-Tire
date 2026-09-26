import { cookies } from "next/headers";
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
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const adminEmail = (process.env.ADMIN_EMAIL || "admin@mobiletire.clinic").trim().toLowerCase();

    return Response.json({
      success: true,
      user: {
        name: "Admin",
        email: adminEmail,
        role: "admin",
      },
    });
  } catch (error) {
    logger.error("admin_me.verification_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to verify administrator session.",
      },
      { status: 500 }
    );
  }
}