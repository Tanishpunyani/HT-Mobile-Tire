/**
 * Unit Tests: Admin Cookie Security & Signature Verification
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import crypto from "crypto";

const TEST_ADMIN_SECRET = "test_admin_session_secret_at_least_32_bytes_long";

function createAdminSessionCookie(secret = TEST_ADMIN_SECRET, expiresInMs = 86400000) {
  const expiresAt = Date.now() + expiresInMs;
  const payload = JSON.stringify({ role: "admin", expiresAt });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

function verifyAdminSessionCookie(cookieValue, secret = TEST_ADMIN_SECRET) {
  if (!cookieValue || typeof cookieValue !== "string") return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;

  const expectedSignature = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return false;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return false;
  }

  if (payload.role !== "admin" || !payload.expiresAt || Date.now() > payload.expiresAt) {
    return false;
  }

  return true;
}

export function runAdminCookieTests() {
  describe("Admin Session Cookie Security (Unit)", () => {
    test("Valid signed admin session cookie is accepted", () => {
      const cookie = createAdminSessionCookie();
      const isValid = verifyAdminSessionCookie(cookie);
      assert(isValid, "Signed admin cookie must be valid");
    });

    test("Cookie with wrong signature is rejected", () => {
      const cookie = createAdminSessionCookie("wrong_secret_12345678901234567890");
      const isValid = verifyAdminSessionCookie(cookie);
      assertEqual(isValid, false, "Forged admin cookie must be rejected");
    });

    test("Expired admin cookie is rejected", () => {
      const expiredCookie = createAdminSessionCookie(TEST_ADMIN_SECRET, -5000);
      const isValid = verifyAdminSessionCookie(expiredCookie);
      assertEqual(isValid, false, "Expired admin cookie must be rejected");
    });

    test("Random / dummy cookie string is rejected", () => {
      assertEqual(verifyAdminSessionCookie("123456789"), false);
      assertEqual(verifyAdminSessionCookie("random_cookie_value"), false);
      assertEqual(verifyAdminSessionCookie(""), false);
      assertEqual(verifyAdminSessionCookie(null), false);
    });

    test("Tampered payload with valid-looking structure is rejected", () => {
      const validCookie = createAdminSessionCookie();
      const [, signature] = validCookie.split(".");
      const alteredPayload = Buffer.from(
        JSON.stringify({ role: "admin", expiresAt: Date.now() + 999999999 })
      ).toString("base64url");
      const tampered = `${alteredPayload}.${signature}`;

      assertEqual(verifyAdminSessionCookie(tampered), false);
    });
  });
}
