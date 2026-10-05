/**
 * Notification Recipient Resolution Helper
 * HT Mobile Services / Tire Mobile Clinic
 *
 * Server-only helper to resolve and normalize phone numbers for Admin and Customer notifications.
 *
 * CRITICAL SAFETY RULES:
 * 1. ADMIN_NOTIFICATION_PHONE must remain server-side and never be exposed to clients.
 * 2. BUSINESS_PHONE_RAW / BUSINESS_PHONE_DISPLAY must NEVER be used as the admin notification destination.
 * 3. Returns null on missing or unparseable numbers; never throws or crashes business transactions.
 */

import { normalizePhoneToE164 } from "@/lib/utils/phone";

/**
 * Resolves the phone number to receive Admin / Central Dispatch operational alerts.
 * 
 * Hierarchy:
 * 1. process.env.ADMIN_NOTIFICATION_PHONE (Dedicated admin phone)
 * 2. process.env.DISPATCH_PHONE_NUMBER (Dispatch fallback)
 * 3. process.env.TECHNICIAN_PHONE_NUMBER (Legacy dispatch fallback)
 * 
 * Note: Under no circumstances is the inbound business hotline (BUSINESS_PHONE_RAW)
 * used as an admin destination.
 */
export function resolveAdminNotificationPhone(
  normalizer: (phone: string) => string = normalizePhoneToE164
): string | null {
  const envPhone =
    process.env.ADMIN_NOTIFICATION_PHONE?.trim() ||
    process.env.DISPATCH_PHONE_NUMBER?.trim() ||
    process.env.TECHNICIAN_PHONE_NUMBER?.trim();

  if (!envPhone) {
    return null;
  }

  const normalized = normalizer(envPhone);
  return normalized && normalized.length >= 10 ? normalized : null;
}

export type CustomerPhoneSource =
  | string
  | {
      phone?: string | null;
      customer?: { phone?: string | null } | null;
      user?: { phone?: string | null } | null;
    }
  | null
  | undefined;

/**
 * Resolves and normalizes the customer phone number from direct string or entity objects.
 * 
 * Safe: returns null on missing/invalid input, never throws.
 */
export function resolveCustomerNotificationPhone(
  source?: CustomerPhoneSource,
  normalizer: (phone: string) => string = normalizePhoneToE164
): string | null {
  if (!source) {
    return null;
  }

  let rawPhone: string | null = null;

  if (typeof source === "string") {
    rawPhone = source.trim();
  } else if (typeof source === "object") {
    rawPhone =
      source.phone?.trim() ||
      source.customer?.phone?.trim() ||
      source.user?.phone?.trim() ||
      null;
  }

  if (!rawPhone || rawPhone === "N/A" || rawPhone === "undefined" || rawPhone === "null") {
    return null;
  }

  const normalized = normalizer(rawPhone);
  return normalized && normalized.length >= 10 ? normalized : null;
}

// ============================================================================
// EMAIL RECIPIENT RESOLUTION HELPERS (PHASE 10C.3)
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolves the primary email address to receive Admin / Central Dispatch operational alerts.
 *
 * Hierarchy:
 * 1. process.env.ADMIN_EMAIL (Configured admin recipient identified in system audit)
 * 2. process.env.ADMIN_NOTIFICATION_EMAIL (Optional alias if present)
 * 3. Default fallback: "admin@mobiletire.clinic"
 *
 * Returns a valid, trimmed email string. Never throws or returns null.
 */
export function resolveAdminNotificationEmail(): string {
  const envEmail =
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.ADMIN_NOTIFICATION_EMAIL?.trim() ||
    "admin@mobiletire.clinic";

  return envEmail;
}

/**
 * Resolves all configured admin notification emails as an array.
 * Supports comma-separated entries in ADMIN_EMAIL or ADMIN_NOTIFICATION_EMAIL.
 */
export function resolveAdminNotificationEmails(): string[] {
  const primary = resolveAdminNotificationEmail();
  const rawList = primary.split(",").map((e) => e.trim()).filter(Boolean);
  const valid = rawList.filter((e) => EMAIL_REGEX.test(e));
  return valid.length > 0 ? valid : ["admin@mobiletire.clinic"];
}

/**
 * Resolves the authoritative customer notification email specifically for a Booking.
 * Strictly checks booking.customerEmail (or direct email string).
 * NEVER falls back to Customer.email, User.email, or admin email.
 * If customerEmail is missing, empty, or invalid, returns null.
 */
export function resolveBookingCustomerEmail(
  source?: string | { customerEmail?: string | null } | null
): string | null {
  if (!source) {
    return null;
  }

  let rawEmail: string | null = null;
  if (typeof source === "string") {
    rawEmail = source.trim();
  } else if (typeof source === "object") {
    rawEmail = source.customerEmail?.trim() || null;
  }

  if (
    !rawEmail ||
    rawEmail === "N/A" ||
    rawEmail === "undefined" ||
    rawEmail === "null"
  ) {
    return null;
  }

  const cleaned = rawEmail.toLowerCase().trim();
  return EMAIL_REGEX.test(cleaned) ? cleaned : null;
}

export type CustomerEmailSource =
  | string
  | {
      customerEmail?: string | null;
      email?: string | null;
      customer?: { email?: string | null } | null;
      user?: { email?: string | null } | null;
    }
  | null
  | undefined;

/**
 * Resolves and validates customer email address from string or booking/user entity objects.
 * For Booking objects (having customerEmail property): ONLY customerEmail is authoritative.
 * For non-booking entities: falls back to direct email, customer.email, user.email.
 *
 * Safe: returns null on missing/invalid email, never throws, and NEVER falls back to admin email.
 */
export function resolveCustomerNotificationEmail(
  source?: CustomerEmailSource
): string | null {
  if (!source) {
    return null;
  }

  let rawEmail: string | null = null;

  if (typeof source === "string") {
    rawEmail = source.trim();
  } else if (typeof source === "object") {
    // If source represents a booking notification (i.e. has "customerEmail" property):
    // Strict isolation rule: For bookings, ONLY customerEmail is authoritative.
    // If customerEmail is null or empty, DO NOT fall back to customer.email or user.email.
    if ("customerEmail" in source) {
      rawEmail = source.customerEmail?.trim() || null;
    } else {
      rawEmail =
        source.email?.trim() ||
        source.customer?.email?.trim() ||
        source.user?.email?.trim() ||
        null;
    }
  }

  if (
    !rawEmail ||
    rawEmail === "N/A" ||
    rawEmail === "undefined" ||
    rawEmail === "null"
  ) {
    return null;
  }

  const cleaned = rawEmail.toLowerCase().trim();
  return EMAIL_REGEX.test(cleaned) ? cleaned : null;
}
