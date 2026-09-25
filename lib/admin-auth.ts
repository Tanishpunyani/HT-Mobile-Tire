import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const ADMIN_SESSION_COOKIE_NAME = "admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Secret used for cryptographic signing of the admin session cookie representation.
 */
function getAdminSigningSecret(): string {
  const secret = (process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_EMAIL || "").trim();
  if (!secret) {
    logger.error("admin_auth.secret_missing");
  }
  return secret;
}

/**
 * Signs a session token with its expiration timestamp using HMAC-SHA256.
 * Format: `<rawToken>.<expiresAtMs>.<signature>`
 */
export function signAdminSessionCookie(rawToken: string, expiresAtMs: number): string {
  const secret = getAdminSigningSecret();
  if (!secret) {
    throw new Error("Admin signing secret is not configured on the server.");
  }
  const data = `${rawToken.trim()}.${expiresAtMs}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Validates the cryptographic signature and expiration of an admin session cookie.
 * Does NOT query the database; used for early middleware rejection and format validation.
 */
export function validateAdminCookieSignature(
  cookieValue: string | null | undefined
): { valid: boolean; rawToken?: string; expiresAtMs?: number; error?: string } {
  if (!cookieValue || typeof cookieValue !== "string" || cookieValue.trim() === "") {
    return { valid: false, error: "Missing admin session cookie." };
  }

  const trimmed = cookieValue.trim();
  const parts = trimmed.split(".");

  // 1. Signed cookie format: <rawToken>.<expiresAtMs>.<signature>
  if (parts.length === 3) {
    const [rawToken, expStr, signature] = parts;
    const expiresAtMs = parseInt(expStr, 10);

    if (!rawToken || rawToken.length !== 64 || isNaN(expiresAtMs) || !signature) {
      return { valid: false, error: "Malformed signed admin session cookie structure." };
    }

    if (expiresAtMs <= Date.now()) {
      return { valid: false, error: "Admin session cookie has expired." };
    }

    const secret = getAdminSigningSecret();
    if (!secret) {
      return { valid: false, error: "Admin signing secret is not configured." };
    }
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${rawToken}.${expiresAtMs}`)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expSigBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
      return { valid: false, error: "Invalid admin session signature." };
    }

    return { valid: true, rawToken, expiresAtMs };
  }

  // 2. Allow raw 64-character hex tokens for backward compatibility
  if (parts.length === 1 && /^[a-f0-9]{64}$/i.test(parts[0])) {
    return { valid: true, rawToken: parts[0] };
  }

  return { valid: false, error: "Invalid admin session cookie format." };
}

/**
 * Validates admin credentials strictly against server-side environment variables.
 * Never exposes which part (email or password) failed.
 */
export async function verifyAdminCredentials(
  email: string | null | undefined,
  password: string | null | undefined
): Promise<boolean> {
  if (!email || !password) {
    return false;
  }

  const configuredAdminEmail = (process.env.ADMIN_EMAIL || "")
    .trim()
    .toLowerCase()
    .replace(/^["']|["']$/g, "");
  const configuredPasswordHash = (process.env.ADMIN_PASSWORD_HASH || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\(\$)/g, "$1");

  // If credentials are not properly configured on the server, fail securely
  if (!configuredAdminEmail || !configuredPasswordHash) {
    logger.error("admin_auth.env_missing");
    return false;
  }

  const inputEmail = email.trim().toLowerCase();
  if (inputEmail !== configuredAdminEmail) {
    return false;
  }

  try {
    const isPasswordValid = await bcrypt.compare(password, configuredPasswordHash);
    return isPasswordValid;
  } catch (err) {
    logger.error("admin_auth.password_compare_error", { error: err });
    return false;
  }
}

/**
 * Creates a persistent server-side admin session in the database.
 * Returns the signed cryptographic session token string for the cookie.
 */
export async function createAdminSession(): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAtMs = Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
  const expiresAt = new Date(expiresAtMs);

  await prisma.adminSession.create({
    data: {
      token: rawToken,
      expiresAt,
    },
  });

  return signAdminSessionCookie(rawToken, expiresAtMs);
}

/**
 * Verifies if an admin session token exists in the database and has not expired.
 * Validates the cookie signature before querying PostgreSQL.
 */
export async function verifyAdminSession(
  token: string | null | undefined
): Promise<boolean> {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return false;
  }

  const validation = validateAdminCookieSignature(token);
  if (!validation.valid || !validation.rawToken) {
    return false;
  }

  try {
    const session = await prisma.adminSession.findUnique({
      where: { token: validation.rawToken },
    });

    if (!session) {
      return false;
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      // Session has expired, clean it up asynchronously
      prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
      return false;
    }

    return true;
  } catch (err) {
    logger.error("admin_auth.session_verify_error", { error: err });
    return false;
  }
}

/**
 * Destroys an active admin session in the database.
 */
export async function destroyAdminSession(
  token: string | null | undefined
): Promise<boolean> {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return true;
  }

  const validation = validateAdminCookieSignature(token);
  const rawToken = validation.rawToken || token.trim();

  try {
    await prisma.adminSession.deleteMany({
      where: { token: rawToken },
    });
    return true;
  } catch (err) {
    logger.error("admin_auth.session_destroy_error", { error: err });
    return false;
  }
}

/**
 * Retrieves the admin session token from incoming HTTP cookies.
 */
export async function getAdminSessionToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE_NAME);
    return sessionCookie?.value || null;
  } catch {
    return null;
  }
}

/**
 * Server page / layout / Server Action guard that verifies the admin session.
 * Redirects to /admin/login if unauthenticated.
 */
export async function requireAdminSession(): Promise<{ authenticated: true; email: string }> {
  const token = await getAdminSessionToken();
  const isValid = await verifyAdminSession(token);

  if (!isValid) {
    redirect("/admin/login");
  }

  return {
    authenticated: true,
    email: (process.env.ADMIN_EMAIL || "admin@mobiletire.clinic").trim().toLowerCase(),
  };
}

export const ADMIN_MAX_LOGIN_ATTEMPTS = 5;
export const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const ADMIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Checks if the given IP or normalized email has exceeded persistent failed login limits.
 * Must be called BEFORE expensive bcrypt verification.
 */
export async function checkAdminRateLimit(
  ip: string,
  normalizedEmail: string
): Promise<{ blocked: boolean; remaining: number }> {
  try {
    const now = Date.now();
    const keys = [`ip:${ip.trim()}`, `email:${normalizedEmail.trim().toLowerCase()}`];

    const attempts = await prisma.adminLoginAttempt.findMany({
      where: { key: { in: keys } },
    });

    for (const record of attempts) {
      // 1. Check if explicitly locked out
      if (record.blockedUntil && new Date(record.blockedUntil).getTime() > now) {
        return { blocked: true, remaining: 0 };
      }

      // 2. Check if window is still active and limit reached
      const isWindowActive =
        new Date(record.firstAttemptAt).getTime() + ADMIN_LOGIN_WINDOW_MS > now;
      if (isWindowActive && record.attemptCount >= ADMIN_MAX_LOGIN_ATTEMPTS) {
        return { blocked: true, remaining: 0 };
      }
    }

    const maxCount = attempts.reduce((max, r) => {
      const isWindowActive =
        new Date(r.firstAttemptAt).getTime() + ADMIN_LOGIN_WINDOW_MS > now;
      return isWindowActive ? Math.max(max, r.attemptCount) : max;
    }, 0);

    return {
      blocked: false,
      remaining: Math.max(0, ADMIN_MAX_LOGIN_ATTEMPTS - maxCount),
    };
  } catch (err) {
    logger.error("admin_auth.rate_limit_check_error", { error: err });
    // If DB check fails, default to allowing request to prevent complete administrative lockout
    return { blocked: false, remaining: 1 };
  }
}

/**
 * Records a failed login attempt for both IP and normalized email.
 * Applies temporary lockout if attempts reach limit.
 */
export async function recordFailedAdminLogin(
  ip: string,
  normalizedEmail: string
): Promise<void> {
  const now = new Date();
  const keys = [`ip:${ip.trim()}`, `email:${normalizedEmail.trim().toLowerCase()}`];

  for (const key of keys) {
    try {
      const existing = await prisma.adminLoginAttempt.findUnique({
        where: { key },
      });

      if (!existing || existing.firstAttemptAt.getTime() + ADMIN_LOGIN_WINDOW_MS < now.getTime()) {
        // First attempt or previous window expired: reset window
        await prisma.adminLoginAttempt.upsert({
          where: { key },
          create: {
            key,
            attemptCount: 1,
            firstAttemptAt: now,
            lastAttemptAt: now,
            blockedUntil: null,
          },
          update: {
            attemptCount: 1,
            firstAttemptAt: now,
            lastAttemptAt: now,
            blockedUntil: null,
          },
        });
      } else {
        // Within active window: increment count
        const newCount = existing.attemptCount + 1;
        const isBlocked = newCount >= ADMIN_MAX_LOGIN_ATTEMPTS;
        const blockedUntil = isBlocked
          ? new Date(now.getTime() + ADMIN_LOCKOUT_DURATION_MS)
          : null;

        await prisma.adminLoginAttempt.update({
          where: { key },
          data: {
            attemptCount: newCount,
            lastAttemptAt: now,
            blockedUntil,
          },
        });
      }
    } catch (err) {
      logger.error("admin_auth.record_attempt_error", { error: err });
    }
  }
}

/**
 * Resets failed attempt records for IP and email upon successful authentication.
 */
export async function clearAdminLoginAttempts(
  ip: string,
  normalizedEmail: string
): Promise<void> {
  try {
    const keys = [`ip:${ip.trim()}`, `email:${normalizedEmail.trim().toLowerCase()}`];
    await prisma.adminLoginAttempt.deleteMany({
      where: { key: { in: keys } },
    });
  } catch (err) {
    logger.error("admin_auth.clear_attempts_error", { error: err });
  }
}
