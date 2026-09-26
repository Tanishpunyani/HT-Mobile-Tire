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

