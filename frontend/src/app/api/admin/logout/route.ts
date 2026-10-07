import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  destroyAdminSession,
  ADMIN_SESSION_COOKIE_NAME,
} from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

    if (token) {
      await destroyAdminSession(token);
    }

    const response = NextResponse.json({
      success: true,
      message: "Admin logged out successfully.",
    });

    const isProduction = process.env.NODE_ENV === "production";

    response.cookies.set({
      name: ADMIN_SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (err) {
    logger.error("admin_logout.exception", { error: err });
    return NextResponse.json(
      { success: false, error: "Logout failed." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
