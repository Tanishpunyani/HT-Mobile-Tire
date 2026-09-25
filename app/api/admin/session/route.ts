import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  verifyAdminSession,
  ADMIN_SESSION_COOKIE_NAME,
} from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

    const isValid = await verifyAdminSession(token);

    if (!isValid) {
      return NextResponse.json(
        { authenticated: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      email: (process.env.ADMIN_EMAIL || "admin@mobiletire.clinic").trim().toLowerCase(),
    });
  } catch (err) {
    logger.error("admin_session.check_exception", { error: err });
    return NextResponse.json(
      { authenticated: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
}
