/**
 * Unit Tests: Admin Cookie Security, Signature Verification (SEC-04 & SEC-02)
 * HT Mobile Services
 */

import { describe, test, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import crypto from "crypto";
import { validateAdminCookieEdge } from "../../../frontend/src/lib/auth/admin-cookie.ts";

// Explicit test-only secret for automated fixtures (never use production secrets)
const TEST_ADMIN_COOKIE_SECRET = "test_admin_cookie_secret_0123456789abcdef0123456789abcdef";

function signCookieWithSecret(rawToken, expiresAtMs, secret) {
  const data = `${rawToken}.${expiresAtMs}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

function restoreEnv(key, val) {
  if (val === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = val;
  }
}

export function runAdminCookieTests() {
  describe("Admin Session Cookie Security (Unit - SEC-04 & SEC-02)", () => {
    const rawToken = "a".repeat(64); // 64 hex characters
    const validExpiresAtMs = Date.now() + 86400000;

    testAsync("SEC-04: Valid cookie signed with ADMIN_COOKIE_SECRET is accepted by Edge validator", async () => {
      const origSecret = process.env.ADMIN_COOKIE_SECRET;
      try {
        process.env.ADMIN_COOKIE_SECRET = TEST_ADMIN_COOKIE_SECRET;
        const cookie = signCookieWithSecret(rawToken, validExpiresAtMs, TEST_ADMIN_COOKIE_SECRET);

        const result = await validateAdminCookieEdge(cookie);
        assertEqual(result.valid, true, "Valid cookie signed with ADMIN_COOKIE_SECRET must pass");
        assertEqual(result.rawToken, rawToken);
        assertEqual(result.expiresAtMs, validExpiresAtMs);
      } finally {
        restoreEnv("ADMIN_COOKIE_SECRET", origSecret);
      }
    });

    testAsync("SEC-04: Cookie signed with Secret A is rejected when verified with Secret B", async () => {
      const origSecret = process.env.ADMIN_COOKIE_SECRET;
      try {
        process.env.ADMIN_COOKIE_SECRET = "secret_b_0123456789abcdef0123456789abcdef";
        const cookieSignedWithA = signCookieWithSecret(rawToken, validExpiresAtMs, "secret_a_0123456789abcdef0123456789abcdef");

        const result = await validateAdminCookieEdge(cookieSignedWithA);
        assertEqual(result.valid, false, "Signature mismatch must be rejected");
        assertEqual(result.error, "Invalid admin session signature.");
      } finally {
        restoreEnv("ADMIN_COOKIE_SECRET", origSecret);
      }
    });

    testAsync("SEC-04: Cookie signed with old fallback (ADMIN_PASSWORD_HASH or ADMIN_EMAIL) is rejected", async () => {
      const origSecret = process.env.ADMIN_COOKIE_SECRET;
      try {
        process.env.ADMIN_COOKIE_SECRET = TEST_ADMIN_COOKIE_SECRET;

        // Cookie signed using old fallback key (e.g. hypothetical password hash or email string)
        const cookieWithOldFallback = signCookieWithSecret(rawToken, validExpiresAtMs, "old_legacy_secret_from_password_hash_or_email");

        const result = await validateAdminCookieEdge(cookieWithOldFallback);
        assertEqual(result.valid, false, "Old fallback signature must be rejected under SEC-04");
      } finally {
        restoreEnv("ADMIN_COOKIE_SECRET", origSecret);
      }
    });

    testAsync("SEC-04: Missing, empty, or whitespace-only ADMIN_COOKIE_SECRET fails securely", async () => {
      const origSecret = process.env.ADMIN_COOKIE_SECRET;
      try {
        const cookie = signCookieWithSecret(rawToken, validExpiresAtMs, TEST_ADMIN_COOKIE_SECRET);

        // 1. Missing secret
        delete process.env.ADMIN_COOKIE_SECRET;
        const resMissing = await validateAdminCookieEdge(cookie);
        assertEqual(resMissing.valid, false);
        assertEqual(resMissing.error, "Server admin secret is unconfigured.");

        // 2. Empty secret
        process.env.ADMIN_COOKIE_SECRET = "";
        const resEmpty = await validateAdminCookieEdge(cookie);
        assertEqual(resEmpty.valid, false);
        assertEqual(resEmpty.error, "Server admin secret is unconfigured.");

        // 3. Whitespace-only secret
        process.env.ADMIN_COOKIE_SECRET = "   ";
        const resWhitespace = await validateAdminCookieEdge(cookie);
        assertEqual(resWhitespace.valid, false);
        assertEqual(resWhitespace.error, "Server admin secret is unconfigured.");
      } finally {
        restoreEnv("ADMIN_COOKIE_SECRET", origSecret);
      }
    });

    testAsync("SEC-02: Legacy unsigned 64-hexadecimal token is strictly rejected", async () => {
      const origSecret = process.env.ADMIN_COOKIE_SECRET;
      try {
        process.env.ADMIN_COOKIE_SECRET = TEST_ADMIN_COOKIE_SECRET;
        const unsignedHexToken = "b".repeat(64); // Valid 64-hex format, but unsigned

        const result = await validateAdminCookieEdge(unsignedHexToken);
        assertEqual(result.valid, false, "SEC-02: Raw unsigned 64-hex tokens must be rejected");
        assertEqual(result.error, "Invalid admin session cookie format.");
      } finally {
        restoreEnv("ADMIN_COOKIE_SECRET", origSecret);
      }
    });

    testAsync("SEC-02: Expired cookie is rejected even if signature is valid", async () => {
      const origSecret = process.env.ADMIN_COOKIE_SECRET;
      try {
        process.env.ADMIN_COOKIE_SECRET = TEST_ADMIN_COOKIE_SECRET;
        const expiredMs = Date.now() - 5000;
        const expiredCookie = signCookieWithSecret(rawToken, expiredMs, TEST_ADMIN_COOKIE_SECRET);

        const result = await validateAdminCookieEdge(expiredCookie);
        assertEqual(result.valid, false);
        assertEqual(result.error, "Admin session cookie has expired.");
      } finally {
        restoreEnv("ADMIN_COOKIE_SECRET", origSecret);
      }
    });

    testAsync("SEC-02: Malformed cookie parts and tampered tokens are rejected", async () => {
      const origSecret = process.env.ADMIN_COOKIE_SECRET;
      try {
        process.env.ADMIN_COOKIE_SECRET = TEST_ADMIN_COOKIE_SECRET;

        // Malformed token length
        const badTokenCookie = signCookieWithSecret("short_token", validExpiresAtMs, TEST_ADMIN_COOKIE_SECRET);
        const resBadToken = await validateAdminCookieEdge(badTokenCookie);
        assertEqual(resBadToken.valid, false);

        // Non-numeric expiration
        const badExpCookie = `${rawToken}.notanumber.validsig`;
        const resBadExp = await validateAdminCookieEdge(badExpCookie);
        assertEqual(resBadExp.valid, false);

        // Tampered payload
        const validCookie = signCookieWithSecret(rawToken, validExpiresAtMs, TEST_ADMIN_COOKIE_SECRET);
        const [tok, exp] = validCookie.split(".");
        const tamperedSigCookie = `${tok}.${exp}.tampered_signature_string`;
        const resTampered = await validateAdminCookieEdge(tamperedSigCookie);
        assertEqual(resTampered.valid, false);
      } finally {
        restoreEnv("ADMIN_COOKIE_SECRET", origSecret);
      }
    });

    testAsync("Node.js HMAC and Web Crypto validators produce 100% consistent validation decisions", async () => {
      const origSecret = process.env.ADMIN_COOKIE_SECRET;
      try {
        process.env.ADMIN_COOKIE_SECRET = TEST_ADMIN_COOKIE_SECRET;

        function validateNode(cookie, secret) {
          if (!cookie || typeof cookie !== "string" || cookie.trim() === "") {
            return { valid: false };
          }
          const parts = cookie.trim().split(".");
          if (parts.length === 3) {
            const [raw, expStr, sig] = parts;
            const exp = parseInt(expStr, 10);
            if (!raw || raw.length !== 64 || isNaN(exp) || !sig) return { valid: false };
            if (exp <= Date.now()) return { valid: false };
            if (!secret || !secret.trim()) return { valid: false };
            const expected = crypto.createHmac("sha256", secret.trim()).update(`${raw}.${exp}`).digest("base64url");
            const bufA = Buffer.from(sig);
            const bufB = Buffer.from(expected);
            if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) return { valid: false };
            return { valid: true, rawToken: raw, expiresAtMs: exp };
          }
          return { valid: false };
        }

        const validCookie = signCookieWithSecret(rawToken, validExpiresAtMs, TEST_ADMIN_COOKIE_SECRET);
        const expiredCookie = signCookieWithSecret(rawToken, Date.now() - 10000, TEST_ADMIN_COOKIE_SECRET);
        const unsignedCookie = "c".repeat(64);
        const tamperedCookie = validCookie.slice(0, -5) + "zzzzz";
        const malformedCookie = "random.garbage.cookie";

        const testCases = [
          { name: "valid signed cookie", cookie: validCookie, expected: true },
          { name: "expired cookie", cookie: expiredCookie, expected: false },
          { name: "unsigned 64-hex cookie", cookie: unsignedCookie, expected: false },
          { name: "tampered cookie", cookie: tamperedCookie, expected: false },
          { name: "malformed cookie", cookie: malformedCookie, expected: false },
        ];

        for (const tc of testCases) {
          const edgeRes = await validateAdminCookieEdge(tc.cookie);
          const nodeRes = validateNode(tc.cookie, TEST_ADMIN_COOKIE_SECRET);

          assertEqual(edgeRes.valid, tc.expected, `Edge check for ${tc.name}`);
          assertEqual(nodeRes.valid, tc.expected, `Node check for ${tc.name}`);
          assertEqual(edgeRes.valid, nodeRes.valid, `Parity check for ${tc.name}`);
        }
      } finally {
        restoreEnv("ADMIN_COOKIE_SECRET", origSecret);
      }
    });
  });
}
