import crypto from "crypto";

export const GUEST_COOKIE_PREFIX = "guest_booking_";
export const GUEST_TOKEN_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // 180 days

export interface GuestTokenPayload {
  bookingId: string;
  nonce: string;
  iat: number;
  exp: number;
}

export interface GuestTokenVerificationResult {
  valid: boolean;
  bookingId?: string;
  error?: string;
}

/**
 * Normalizes phone numbers provider-neutrally without inventing digits.
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone || typeof phone !== "string") return "";

  const trimmed = phone.trim();
  if (!trimmed) return "";

  const cleaned = trimmed.replace(/[\s\-().]/g, "");

  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  const digits = cleaned.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

/**
 * Retrieves the cryptographic signing secret for guest booking tokens.
 * Authoritatively requires GUEST_BOOKING_SECRET or the approved ADMIN_COOKIE_SECRET fallback.
 * Strictly fails closed if neither secret is configured, preventing predictable defaults.
 */
export function getGuestTokenSecret(): string {
  const secret = (
    process.env.GUEST_BOOKING_SECRET ||
    process.env.ADMIN_COOKIE_SECRET ||
    ""
  ).trim();

  if (!secret) {
    throw new Error(
      "Guest booking cryptographic signing secret is not configured. Server must configure GUEST_BOOKING_SECRET or ADMIN_COOKIE_SECRET."
    );
  }

  return secret;
}

/**
 * Checks whether an acceptable cryptographic signing secret is configured.
 */
export function hasGuestTokenSecret(): boolean {
  const secret = (
    process.env.GUEST_BOOKING_SECRET ||
    process.env.ADMIN_COOKIE_SECRET ||
    ""
  ).trim();
  return secret.length > 0;
}

/**
 * Creates a cryptographically signed, high-entropy stateless access token
 * bound strictly to a specific booking ID.
 */
export function createGuestBookingToken(
  bookingId: string,
  expiresInDays = 180
): string {
  if (!bookingId || typeof bookingId !== "string" || bookingId.trim() === "") {
    throw new Error("Cannot create guest booking token without a valid booking ID.");
  }

  const secret = getGuestTokenSecret();
  const trimmedBookingId = bookingId.trim();
  const nonce = crypto.randomBytes(32).toString("hex"); // 256 bits entropy
  const iat = Date.now();
  const exp = iat + expiresInDays * 24 * 60 * 60 * 1000;

  const payload: GuestTokenPayload = {
    bookingId: trimmedBookingId,
    nonce,
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
 * Verifies the cryptographic HMAC signature, expiration, and booking ID binding of a guest token.
 * Prevents token forgery, tampering, and cross-booking IDOR attacks.
 */
export function verifyGuestBookingToken(
  token: string | null | undefined,
  expectedBookingId?: string
): GuestTokenVerificationResult {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return { valid: false, error: "Missing guest access token." };
  }

  let secret: string;
  try {
    secret = getGuestTokenSecret();
  } catch {
    return {
      valid: false,
      error: "Guest token verification is unavailable: signing secret is unconfigured.",
    };
  }
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 2) {
      return { valid: false, error: "Malformed guest token format." };
    }

    const [payloadEncoded, signature] = parts;
    if (!payloadEncoded || !signature) {
      return { valid: false, error: "Malformed guest token format." };
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payloadEncoded)
      .digest("base64url");

    const sigBuffer = Buffer.from(signature);
    const expectedSigBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      return { valid: false, error: "Invalid guest access token signature." };
    }

    const payloadJson = Buffer.from(payloadEncoded, "base64url").toString("utf8");
    const payload: GuestTokenPayload = JSON.parse(payloadJson);

    if (!payload || typeof payload !== "object") {
      return { valid: false, error: "Invalid guest token payload structure." };
    }

    if (!payload.bookingId || typeof payload.bookingId !== "string" || payload.bookingId.trim() === "") {
      return { valid: false, error: "Invalid guest token payload: missing booking ID." };
    }

    if (
      !payload.exp ||
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now()
    ) {
      return { valid: false, error: "Guest access token has expired." };
    }

    // IDOR & Cross-Booking Protection
    if (expectedBookingId && expectedBookingId.trim()) {
      if (payload.bookingId.trim().toLowerCase() !== expectedBookingId.trim().toLowerCase()) {
        return {
          valid: false,
          error: "Guest token is not authorized for this specific booking.",
        };
      }
    }

    return {
      valid: true,
      bookingId: payload.bookingId.trim(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV !== "test") {
      console.warn("guest_auth.verify_failed", message);
    }
    return { valid: false, error: "Failed to verify guest token." };
  }
}

/**
 * Returns the standardized cookie name for a specific booking.
 */
export function getGuestCookieName(bookingId: string): string {
  return `${GUEST_COOKIE_PREFIX}${bookingId.trim()}`;
}

/**
 * Cookie options adhering strictly to project security conventions:
 * HttpOnly, SameSite=Lax, Secure in production, 180-day maxAge.
 */
export function getGuestCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: GUEST_TOKEN_MAX_AGE_SECONDS,
    path: "/",
  };
}

/**
 * Sets a guest access token cookie in the Next.js cookie store.
 */
export function setGuestBookingCookie(
  cookieStore: { set: (options: any) => void },
  bookingId: string,
  token: string
) {
  cookieStore.set({
    name: getGuestCookieName(bookingId),
    value: token,
    ...getGuestCookieOptions(),
  });
}

/**
 * Extracts and verifies all valid authorized guest booking IDs stored in the current browser cookies.
 */
export function getAuthorizedGuestBookingIds(
  cookieStore: { getAll: () => Array<{ name: string; value: string }> }
): string[] {
  try {
    const allCookies = cookieStore.getAll();
    const authorizedIds: string[] = [];

    for (const cookie of allCookies) {
      if (cookie.name.startsWith(GUEST_COOKIE_PREFIX)) {
        const expectedId = cookie.name.slice(GUEST_COOKIE_PREFIX.length);
        const result = verifyGuestBookingToken(cookie.value, expectedId);
        if (result.valid && result.bookingId) {
          authorizedIds.push(result.bookingId);
        }
      }
    }

    return Array.from(new Set(authorizedIds));
  } catch {
    return [];
  }
}

/**
 * Checks if a specific booking ID is authorized by the incoming cookies.
 */
export function isGuestBookingAuthorized(
  cookieStore: {
    get: (name: string) => { value: string } | undefined;
    getAll: () => Array<{ name: string; value: string }>;
  },
  bookingId: string
): boolean {
  if (!bookingId) return false;
  const cookieName = getGuestCookieName(bookingId);
  const directCookie = cookieStore.get(cookieName);

  if (directCookie?.value) {
    const result = verifyGuestBookingToken(directCookie.value, bookingId);
    if (result.valid) return true;
  }

  // Fallback: check all guest cookies in case of formatting variations
  const allIds = getAuthorizedGuestBookingIds(cookieStore);
  return allIds.includes(bookingId.trim());
}

/**
 * Validates and normalizes actual technician contact information for safe customer calling.
 * Strictly guarantees that only genuine, normalized numbers associated with an assigned technician
 * produce a tel: link. Never returns placeholders, fake numbers, or company phone substitutes.
 */
export function getValidTechnicianCallData(
  technician: { name?: string | null; phone?: string | null } | null | undefined
): { isValid: boolean; telUri: string; displayPhone: string; technicianName: string } | null {
  if (!technician || !technician.name) {
    return null;
  }

  const rawPhone = technician.phone;
  if (!rawPhone || typeof rawPhone !== "string") {
    return null;
  }

  const trimmed = rawPhone.trim();
  if (
    !trimmed ||
    trimmed === "N/A" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined"
  ) {
    return null;
  }

  const digits = trimmed.replace(/\D/g, "");
  // Must have standard phone digit length (10 to 15 digits)
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  const normalized = normalizePhoneNumber(trimmed);
  if (!normalized || !normalized.startsWith("+") || normalized.length < 11) {
    return null;
  }

  return {
    isValid: true,
    telUri: `tel:${normalized}`,
    displayPhone: trimmed,
    technicianName: technician.name.trim(),
  };
}
