import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface DispatchTokenPayload {
  technicianId: string;
  bookingId?: string;
  iat: number;
  exp: number;
}

export interface TokenVerificationResult {
  valid: boolean;
  technicianId?: string;
  bookingId?: string;
  error?: string;
}

export interface TokenVerificationOptions {
  expectedBookingId?: string;
  expectedTechnicianId?: string;
}

/**
 * Retrieves the mandatory server-side secret for signing technician dispatch tokens.
 * Fails explicitly and securely if the secret is not configured or is empty.
 */
export function getTechnicianDispatchSecret(): string | null {
  const secret = (
    process.env.TECHNICIAN_DISPATCH_SECRET ||
    process.env.ADMIN_COOKIE_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    ""
  ).trim();
  if (!secret) {
    logger.error("technician_auth.secret_missing");
    return null;
  }
  return secret;
}

/**
 * Creates a cryptographically signed stateless dispatch token for a technician.
 * Default validity: 7 days.
 * Throws if the server secret is not configured.
 */
export function createTechnicianDispatchToken(
  technicianId: string,
  bookingId?: string,
  expiresInDays = 7
): string {
  const secret = getTechnicianDispatchSecret();
  if (!secret) {
    throw new Error("TECHNICIAN_DISPATCH_SECRET is not configured on the server.");
  }

  const trimmedTechId = technicianId ? technicianId.trim() : "";
  if (!trimmedTechId) {
    throw new Error("Cannot create dispatch token without a valid technician ID.");
  }

  const iat = Date.now();
  const exp = iat + expiresInDays * 24 * 60 * 60 * 1000;

  const payload: DispatchTokenPayload = {
    technicianId: trimmedTechId,
    ...(bookingId && bookingId.trim() ? { bookingId: bookingId.trim() } : {}),
    iat,
    exp,
  };

  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadEncoded)
    .digest("base64url");

  return `${payloadEncoded}.${signature}`;
}

/**
 * Verifies the cryptographic signature, expiration, and scope of a dispatch token.
 * Prevents token tampering, forgery, and cross-booking/cross-technician reuse.
 */
export function verifyTechnicianDispatchToken(
  token: string | null | undefined,
  options?: TokenVerificationOptions
): TokenVerificationResult {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return { valid: false, error: "Missing dispatch token." };
  }

  const secret = getTechnicianDispatchSecret();
  if (!secret) {
    return { valid: false, error: "Authentication service unavailable." };
  }

  try {
    const parts = token.trim().split(".");
    if (parts.length !== 2) {
      return { valid: false, error: "Malformed dispatch token format." };
    }

    const [payloadEncoded, signature] = parts;
    if (!payloadEncoded || !signature) {
      return { valid: false, error: "Malformed dispatch token format." };
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payloadEncoded)
      .digest("base64url");

    // Timing-safe signature comparison
    const sigBuffer = Buffer.from(signature);
    const expectedSigBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      return { valid: false, error: "Invalid dispatch token signature." };
    }

    const payloadJson = Buffer.from(payloadEncoded, "base64url").toString("utf8");
    const payload: DispatchTokenPayload = JSON.parse(payloadJson);

    if (!payload || typeof payload !== "object") {
      return { valid: false, error: "Invalid dispatch token payload." };
    }

    if (!payload.technicianId || typeof payload.technicianId !== "string" || payload.technicianId.trim() === "") {
      return { valid: false, error: "Invalid dispatch token payload: missing technician ID." };
    }

    if (!payload.exp || typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
      return { valid: false, error: "Dispatch token has expired." };
    }

    // 1. Cross-Technician Scope Protection
    if (options?.expectedTechnicianId && options.expectedTechnicianId.trim()) {
      if (payload.technicianId.trim() !== options.expectedTechnicianId.trim()) {
        return {
          valid: false,
          error: "Dispatch token does not match the assigned technician.",
        };
      }
    }

    // 2. Cross-Booking Scope Protection
    if (options?.expectedBookingId && options.expectedBookingId.trim()) {
      if (payload.bookingId && payload.bookingId.trim() !== options.expectedBookingId.trim()) {
        return {
          valid: false,
          error: "Dispatch token is not authorized for this booking.",
        };
      }
    }

    return {
      valid: true,
      technicianId: payload.technicianId.trim(),
      bookingId: payload.bookingId ? payload.bookingId.trim() : undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("technician_auth.verify_failed", { error: message });
    return { valid: false, error: "Failed to verify dispatch token." };
  }
}

/**
 * Validates a dispatch token and retrieves the corresponding active Technician record from PostgreSQL.
 */
export async function getAuthenticatedTechnicianFromToken(
  token: string | null | undefined,
  options?: TokenVerificationOptions
) {
  const result = verifyTechnicianDispatchToken(token, options);
  if (!result.valid || !result.technicianId) {
    return null;
  }

  try {
    const technician = await prisma.technician.findUnique({
      where: { id: result.technicianId },
    });

    if (!technician || !technician.isActive) {
      return null;
    }

    return technician;
  } catch (err) {
    logger.error("technician_auth.db_lookup_failed", { error: err });
    return null;
  }
}

/**
 * Compares an untrusted candidate API key against the server-configured technician API key
 * in constant time using SHA-256 digests and crypto.timingSafeEqual to prevent side-channel timing leaks.
 * Never logs credentials or headers.
 */
export function verifyTechnicianApiKey(candidateKey: string | null | undefined): boolean {
  const configuredKey = process.env.TECHNICIAN_API_KEY?.trim();
  if (!configuredKey || typeof candidateKey !== "string" || candidateKey.trim() === "") {
    return false;
  }

  const candidateTrimmed = candidateKey.trim();
  const configuredBuf = Buffer.from(configuredKey, "utf8");
  const candidateBuf = Buffer.from(candidateTrimmed, "utf8");

  // Hash both to fixed 32-byte SHA-256 digests so buffer lengths are identical and timingSafeEqual never throws
  const configuredHash = crypto.createHash("sha256").update(configuredBuf).digest();
  const candidateHash = crypto.createHash("sha256").update(candidateBuf).digest();

  const hashesMatch = crypto.timingSafeEqual(configuredHash, candidateHash);
  return hashesMatch && configuredBuf.length === candidateBuf.length;
}
