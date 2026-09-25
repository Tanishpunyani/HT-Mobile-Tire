/**
 * Unit Tests: Technician Token Security & Scope
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import crypto from "crypto";

const TEST_SECRET = "test_technician_dispatch_secret_super_safe_32_bytes";

function createTechnicianDispatchToken(technicianId, bookingId, secret = TEST_SECRET, expiresInMs = 3600000) {
  const expiresAt = Date.now() + expiresInMs;
  const payload = JSON.stringify({ technicianId, bookingId: bookingId || null, expiresAt });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

function verifyTechnicianDispatchToken(token, expectedBookingId, expectedTechnicianId, secret = TEST_SECRET) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (Date.now() > payload.expiresAt) return null;
  if (expectedBookingId && payload.bookingId && payload.bookingId !== expectedBookingId) return null;
  if (expectedTechnicianId && payload.technicianId !== expectedTechnicianId) return null;

  return payload;
}

export function runTechnicianTokenTests() {
  describe("Technician Token Security & HMAC Scope (Unit)", () => {
    test("Valid dispatch token for technician and booking succeeds", () => {
      const token = createTechnicianDispatchToken("tech_1", "book_100");
      const result = verifyTechnicianDispatchToken(token, "book_100", "tech_1");
      assert(result !== null, "Token must verify successfully");
      assertEqual(result.technicianId, "tech_1");
      assertEqual(result.bookingId, "book_100");
    });

    test("Forged token signature is rejected", () => {
      const token = createTechnicianDispatchToken("tech_1", "book_100", "wrong_secret_12345");
      const result = verifyTechnicianDispatchToken(token, "book_100", "tech_1");
      assertEqual(result, null, "Forged token must return null");
    });

    test("Tampered payload in token is rejected", () => {
      const token = createTechnicianDispatchToken("tech_1", "book_100");
      const [payloadB64, signature] = token.split(".");
      const tamperedPayload = Buffer.from(
        JSON.stringify({ technicianId: "tech_attacker", bookingId: "book_100", expiresAt: Date.now() + 100000 })
      ).toString("base64url");
      const tamperedToken = `${tamperedPayload}.${signature}`;

      const result = verifyTechnicianDispatchToken(tamperedToken, "book_100", "tech_1");
      assertEqual(result, null, "Tampered payload must fail verification");
    });

    test("Expired token is rejected", () => {
      const expiredToken = createTechnicianDispatchToken("tech_1", "book_100", TEST_SECRET, -10000);
      const result = verifyTechnicianDispatchToken(expiredToken, "book_100", "tech_1");
      assertEqual(result, null, "Expired token must return null");
    });

    test("Cross-Booking Reuse: Token issued for Booking A is REJECTED for Booking B", () => {
      const tokenA = createTechnicianDispatchToken("tech_1", "booking_AAA");
      const resultForB = verifyTechnicianDispatchToken(tokenA, "booking_BBB", "tech_1");
      assertEqual(resultForB, null, "Token A cannot be used on Booking B");
    });

    test("Cross-Technician Scope: Token issued for Tech A is REJECTED for Tech B", () => {
      const tokenTechA = createTechnicianDispatchToken("tech_AAA", "booking_100");
      const resultTechB = verifyTechnicianDispatchToken(tokenTechA, "booking_100", "tech_BBB");
      assertEqual(resultTechB, null, "Tech A token cannot authenticate Tech B");
    });
  });
}
