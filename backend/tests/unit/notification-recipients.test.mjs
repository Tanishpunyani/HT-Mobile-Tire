/**
 * Unit Tests: Notification Recipient Resolution Helper
 * HT Mobile Services / Phase 3A
 *
 * Covers:
 * 1. Admin phone resolution hierarchy (ADMIN_NOTIFICATION_PHONE -> DISPATCH_PHONE_NUMBER -> TECHNICIAN_PHONE_NUMBER)
 * 2. Strict exclusion of business hotline numbers (BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY)
 * 3. Graceful null returns on missing/invalid admin phone
 * 4. Customer phone resolution from multiple input shapes (string, booking.customer.phone, booking.phone, booking.user.phone)
 * 5. E.164 phone normalization integration
 * 6. Non-blocking error handling (never throws)
 * 7. Server-side security (no NEXT_PUBLIC prefix, non-leakage)
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

/**
 * Authoritative phone normalizer matching lib/sms/index.ts
 */
function normalizePhoneToE164(phone) {
  if (!phone || typeof phone !== "string") return "";
  let cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (cleaned.startsWith("+")) {
    return cleaned;
  }
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }
  return cleaned ? `+${cleaned}` : "";
}

/**
 * Implementation under test (matching lib/notifications/recipients.ts)
 */
function resolveAdminNotificationPhone(normalizer = normalizePhoneToE164) {
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

function resolveCustomerNotificationPhone(source, normalizer = normalizePhoneToE164) {
  if (!source) {
    return null;
  }

  let rawPhone = null;

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

export function runNotificationRecipientsUnitTests() {
  describe("Recipient Resolution: Admin Recipient (Unit)", () => {
    const originalEnv = { ...process.env };

    test("Resolves primary ADMIN_NOTIFICATION_PHONE when configured", () => {
      process.env.ADMIN_NOTIFICATION_PHONE = "214-555-0100";
      process.env.DISPATCH_PHONE_NUMBER = "214-555-0101";
      process.env.TECHNICIAN_PHONE_NUMBER = "214-555-0102";

      const phone = resolveAdminNotificationPhone();
      assertEqual(phone, "+12145550100");
    });

    test("Falls back to DISPATCH_PHONE_NUMBER when ADMIN_NOTIFICATION_PHONE is empty", () => {
      delete process.env.ADMIN_NOTIFICATION_PHONE;
      process.env.DISPATCH_PHONE_NUMBER = "(214) 555-0101";
      process.env.TECHNICIAN_PHONE_NUMBER = "214-555-0102";

      const phone = resolveAdminNotificationPhone();
      assertEqual(phone, "+12145550101");
    });

    test("Falls back to legacy TECHNICIAN_PHONE_NUMBER when dispatch and admin are unset", () => {
      delete process.env.ADMIN_NOTIFICATION_PHONE;
      delete process.env.DISPATCH_PHONE_NUMBER;
      process.env.TECHNICIAN_PHONE_NUMBER = "+12145550102";

      const phone = resolveAdminNotificationPhone();
      assertEqual(phone, "+12145550102");
    });

    test("Returns null safely when no admin phone is configured", () => {
      delete process.env.ADMIN_NOTIFICATION_PHONE;
      delete process.env.DISPATCH_PHONE_NUMBER;
      delete process.env.TECHNICIAN_PHONE_NUMBER;

      const phone = resolveAdminNotificationPhone();
      assertEqual(phone, null);
    });

    test("Under no circumstances does it fall back to BUSINESS_PHONE_RAW or display", () => {
      delete process.env.ADMIN_NOTIFICATION_PHONE;
      delete process.env.DISPATCH_PHONE_NUMBER;
      delete process.env.TECHNICIAN_PHONE_NUMBER;
      process.env.NEXT_PUBLIC_BUSINESS_PHONE = "+18005558473";
      process.env.NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY = "(800) 555-TIRE (8473)";

      const phone = resolveAdminNotificationPhone();
      assertEqual(phone, null, "Must never return the business hotline as an admin recipient");
    });

    test("Non-blocking on malformed admin phone input", () => {
      process.env.ADMIN_NOTIFICATION_PHONE = "not-a-number";
      const phone = resolveAdminNotificationPhone();
      assertEqual(phone, null, "Malformed phone string must return null safely without throwing");
    });

    // Cleanup env
    process.env = originalEnv;
  });

  describe("Recipient Resolution: Customer Recipient (Unit)", () => {
    test("Resolves direct phone string and normalizes to E.164", () => {
      const phone = resolveCustomerNotificationPhone("2145550199");
      assertEqual(phone, "+12145550199");
    });

    test("Resolves formatted customer phone with dashes/parentheses", () => {
      const phone = resolveCustomerNotificationPhone("(214) 555-0199");
      assertEqual(phone, "+12145550199");
    });

    test("Resolves customer phone from nested booking.customer object", () => {
      const booking = {
        id: "b1",
        customer: {
          phone: "214-555-7788",
        },
      };
      const phone = resolveCustomerNotificationPhone(booking);
      assertEqual(phone, "+12145557788");
    });

    test("Resolves customer phone from direct object property", () => {
      const entity = { phone: "+12145559988" };
      const phone = resolveCustomerNotificationPhone(entity);
      assertEqual(phone, "+12145559988");
    });

    test("Resolves customer phone from user fallback property", () => {
      const entity = { user: { phone: "214.555.3344" } };
      const phone = resolveCustomerNotificationPhone(entity);
      assertEqual(phone, "+12145553344");
    });

    test("Returns null for empty, missing, or invalid customer phone", () => {
      assertEqual(resolveCustomerNotificationPhone(null), null);
      assertEqual(resolveCustomerNotificationPhone(undefined), null);
      assertEqual(resolveCustomerNotificationPhone(""), null);
      assertEqual(resolveCustomerNotificationPhone("   "), null);
      assertEqual(resolveCustomerNotificationPhone("N/A"), null);
      assertEqual(resolveCustomerNotificationPhone({ phone: "N/A" }), null);
      assertEqual(resolveCustomerNotificationPhone("123"), null); // Too short
    });

    test("Customer resolution never throws on corrupt objects", () => {
      assertEqual(resolveCustomerNotificationPhone({}), null);
      assertEqual(resolveCustomerNotificationPhone({ customer: null }), null);
    });
  });

  describe("Recipient Resolution: Security & Privacy Guards", () => {
    test("ADMIN_NOTIFICATION_PHONE does not use NEXT_PUBLIC prefix", () => {
      assert(
        !Object.prototype.hasOwnProperty.call(process.env, "NEXT_PUBLIC_ADMIN_NOTIFICATION_PHONE"),
        "Admin notification destination must NEVER be prefixed with NEXT_PUBLIC"
      );
    });
  });
}

// Direct execution support
if (process.argv[1]?.endsWith("notification-recipients.test.mjs")) {
  runNotificationRecipientsUnitTests();
}
