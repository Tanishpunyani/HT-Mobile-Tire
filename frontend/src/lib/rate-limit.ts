import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Standard IPv4 & IPv6 regex patterns for strict IP syntax validation.
 */
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const IPV6_REGEX =
  /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^::(?:[a-fA-F0-9]{1,4}:){0,6}[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,7}:$|^(?:[a-fA-F0-9]{1,4}:){1,6}:[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:)(?::[a-fA-F0-9]{1,4}){1,6}$|^::$|^(?:[a-fA-F0-9]{1,4}:){1,4}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/**
 * Validates whether a candidate string is a strictly formatted IPv4 or IPv6 address.
 */
export function isValidIp(ip: string | null | undefined): boolean {
  if (!ip || typeof ip !== "string") {
    return false;
  }
  const trimmed = ip.trim();
  return IPV4_REGEX.test(trimmed) || IPV6_REGEX.test(trimmed);
}

/**
 * Resolves the client IP securely based on platform-controlled headers.
 *
 * Trust Model:
 * 1. `x-real-ip`: Set and controlled by Vercel Edge infrastructure; client-provided values are overwritten.
 * 2. `x-vercel-forwarded-for`: Vercel proxy platform header.
 * 3. `x-forwarded-for`: Proxies append IPs to the right. When traversing, rightmost entries represent
 *    the nearest proxy hops, preventing client-prepended spoofed addresses.
 * 4. Fallback: Returns "unknown_client" if no valid IP can be established. Never assumes 127.0.0.1.
 */
export function getClientIp(request: Request): string {
  // 1. Vercel edge platform-controlled real IP
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp && isValidIp(xRealIp)) {
    return xRealIp.trim();
  }

  // 2. Vercel forwarded header
  const xVercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (xVercelForwardedFor) {
    const parts = xVercelForwardedFor.split(",").map((s) => s.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
      if (isValidIp(parts[i])) {
        return parts[i];
      }
    }
  }

  // 3. Multi-hop X-Forwarded-For: traverse right-to-left (nearest trusted proxy hop)
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const parts = xForwardedFor.split(",").map((s) => s.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
      if (isValidIp(parts[i])) {
        return parts[i];
      }
    }
  }

  // 4. Safe explicit fallback
  return "unknown_client";
}

/**
 * Retrieves the dedicated salt for rate limiting.
 * NEVER reuses ADMIN_COOKIE_SECRET.
 * In production/preview environments, requires a configured high-entropy secret (>= 32 chars).
 * Falls back to an explicit test-only salt in non-production development/test environments.
 */
export function getRateLimitSalt(): string {
  const salt = process.env.RATE_LIMIT_SALT?.trim();
  const adminSecret = process.env.ADMIN_COOKIE_SECRET?.trim();

  // SEC-04 safeguard: Rate limiting must NEVER reuse ADMIN_COOKIE_SECRET
  if (salt && adminSecret && salt === adminSecret) {
    logger.error("rate_limit.salt_reuses_admin_cookie_secret");
    if (process.env.NODE_ENV === "production") {
      throw new Error("RATE_LIMIT_SALT must NOT reuse ADMIN_COOKIE_SECRET.");
    }
  }

  if (salt && salt.length >= 32) {
    return salt;
  }

  // In production / deployed environments, fail securely if unconfigured or too short
  if (process.env.NODE_ENV === "production") {
    logger.error("rate_limit.salt_missing_or_insecure");
    throw new Error("RATE_LIMIT_SALT must be configured with at least 32 characters in production.");
  }

  // Development / test fallback only
  return "dev-test-rate-limit-salt-only-do-not-use-in-production";
}

/**
 * Hashes an identifier (e.g. client IP) using HMAC-SHA256 to avoid storing raw IPs in PostgreSQL.
 */
export function hashRateLimitKey(endpointPrefix: string, identifier: string): string {
  const salt = getRateLimitSalt();
  const hash = crypto
    .createHmac("sha256", salt)
    .update(identifier.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
  return `${endpointPrefix}:${hash}`;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const memoryRateLimitMap = new Map<string, RateLimitRecord>();

// Cleanup stale in-memory entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryRateLimitMap.entries()) {
      if (now > record.resetTime) {
        memoryRateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * In-memory sliding-window limiter used as high-availability fallback.
 */
export function checkRateLimitMemory(
  key: string,
  limit: number = 5,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = memoryRateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetTime: now + windowMs,
    };
    memoryRateLimitMap.set(key, newRecord);
    return { allowed: true, remaining: Math.max(0, limit - 1), resetTime: newRecord.resetTime };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - record.count), resetTime: record.resetTime };
}

/**
 * Synchronous in-memory rate limiter for backwards compatibility.
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 5,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetTime: number } {
  return checkRateLimitMemory(identifier, limit, windowMs);
}

export interface DistributedRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  source: "postgres" | "memory_fallback";
}

/**
 * Distributed rate limiter backed by Supabase PostgreSQL.
 * Uses atomic UPSERT to guarantee concurrency safety across multiple serverless instances.
 * If the database connection fails or the table is unavailable, gracefully falls back to memory.
 */
export async function checkRateLimitDistributed(
  endpointPrefix: string,
  identifier: string,
  limit: number = 5,
  windowMs: number = 60 * 1000
): Promise<DistributedRateLimitResult> {
  let rateLimitKey: string;
  try {
    rateLimitKey = hashRateLimitKey(endpointPrefix, identifier);
  } catch (saltErr: unknown) {
    const errorMsg = saltErr instanceof Error ? saltErr.message : String(saltErr);
    logger.error("rate_limit.salt_configuration_error", { reason: errorMsg });
    const fallbackKey = `${endpointPrefix}:mem_${crypto.createHash("sha256").update(identifier.trim().toLowerCase()).digest("hex").slice(0, 32)}`;
    const memResult = checkRateLimitMemory(fallbackKey, limit, windowMs);
    return {
      allowed: memResult.allowed,
      remaining: memResult.remaining,
      resetTime: memResult.resetTime,
      source: "memory_fallback",
    };
  }

  try {
    const result = await prisma.$queryRaw<Array<{ count: number; expires_at: Date }>>`
      INSERT INTO rate_limits (key, count, expires_at, created_at, updated_at)
      VALUES (
        ${rateLimitKey},
        1,
        NOW() + (${windowMs} * INTERVAL '1 millisecond'),
        NOW(),
        NOW()
      )
      ON CONFLICT (key) DO UPDATE
      SET
        count = CASE
          WHEN rate_limits.expires_at <= NOW() THEN 1
          ELSE rate_limits.count + 1
        END,
        expires_at = CASE
          WHEN rate_limits.expires_at <= NOW() THEN NOW() + (${windowMs} * INTERVAL '1 millisecond')
          ELSE rate_limits.expires_at
        END,
        updated_at = NOW()
      RETURNING count, expires_at;
    `;

    if (result && result.length > 0) {
      const row = result[0];
      const count = Number(row.count);
      const resetTime = new Date(row.expires_at).getTime();
      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);

      return {
        allowed,
        remaining,
        resetTime,
        source: "postgres",
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn("rate_limit.database_fallback", {
      endpoint: endpointPrefix,
      reason: errorMsg.slice(0, 80),
    });
  }

  // Resilient fallback policy: continue with in-memory limiter
  const memResult = checkRateLimitMemory(rateLimitKey, limit, windowMs);
  return {
    allowed: memResult.allowed,
    remaining: memResult.remaining,
    resetTime: memResult.resetTime,
    source: "memory_fallback",
  };
}
