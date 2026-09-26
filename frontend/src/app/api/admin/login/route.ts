import { NextResponse } from "next/server";
import {
  verifyAdminCredentials,
  createAdminSession,
  checkAdminRateLimit,
  recordFailedAdminLogin,
  clearAdminLoginAttempts,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
} from "@/lib/admin-auth";
import { getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const { email, password } = body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check persistent rate limit BEFORE expensive bcrypt.compare
    const rateLimitCheck = await checkAdminRateLimit(clientIp, normalizedEmail);
    if (rateLimitCheck.blocked) {
      return NextResponse.json(
        { success: false, error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    // 2. Verify credentials
    const isValid = await verifyAdminCredentials(normalizedEmail, password);

    if (!isValid) {
      // Record failed attempt in PostgreSQL
      await recordFailedAdminLogin(clientIp, normalizedEmail);

      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // 3. Clear failed attempts on successful authentication
    await clearAdminLoginAttempts(clientIp, normalizedEmail);

    // 4. Create persistent session and set HTTP-only cookie
    const sessionToken = await createAdminSession();

    const response = NextResponse.json({
      success: true,
      message: "Admin authenticated successfully.",
    });

    const isProduction = process.env.NODE_ENV === "production";

    response.cookies.set({
      name: ADMIN_SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      sameSite: "strict",
      secure: isProduction,
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      path: "/",
    });

    return response;
  } catch (err) {
    logger.error("admin_login.exception", { error: err });
    return NextResponse.json(
      { success: false, error: "Authentication service unavailable." },
      { status: 500 }
    );
  }
}
