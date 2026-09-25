/**
 * Phase 1 — Critical Security & Technician Secret Hardening Suite
 * 19 Focused Cryptographic & HMAC Security Tests
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";

const TEST_SECRET = "test_technician_dispatch_secret_super_safe_32_bytes";

function createTechnicianDispatchToken(technicianId, bookingId, secret = TEST_SECRET, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const iat = Date.now();
  const exp = iat + expiresInMs;
  const payload = { technicianId, ...(bookingId ? { bookingId } : {}), iat, exp };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

function verifyTechnicianDispatchToken(token, options = {}, secret = TEST_SECRET) {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return { valid: false, error: "Missing dispatch token." };
  }
  const parts = token.trim().split(".");
  if (parts.length !== 2) return { valid: false, error: "Malformed dispatch token format." };

  const [payloadEncoded, signature] = parts;
  if (!payloadEncoded || !signature) return { valid: false, error: "Malformed dispatch token format." };

  const expectedSig = crypto.createHmac("sha256", secret).update(payloadEncoded).digest("base64url");

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return { valid: false, error: "Invalid dispatch token signature." };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadEncoded, "base64url").toString("utf8"));
  } catch {
    return { valid: false, error: "Invalid dispatch token payload." };
  }

  if (!payload.technicianId || typeof payload.technicianId !== "string" || !payload.technicianId.trim()) {
    return { valid: false, error: "Invalid dispatch token payload: missing technician ID." };
  }

  if (!payload.exp || typeof payload.exp !== "number" || payload.exp <= Date.now()) {
    return { valid: false, error: "Dispatch token has expired." };
  }

  if (options.expectedTechnicianId && payload.technicianId !== options.expectedTechnicianId) {
    return { valid: false, error: "Dispatch token does not match the assigned technician." };
  }

  if (options.expectedBookingId && payload.bookingId && payload.bookingId !== options.expectedBookingId) {
    return { valid: false, error: "Dispatch token is not authorized for this booking." };
  }

  return { valid: true, technicianId: payload.technicianId, bookingId: payload.bookingId };
}

console.log("==================================================");
console.log("=== RUNNING PHASE 1 DISPATCH SECURITY SUITE ===");
console.log("==================================================");

let passed = 0;
function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ [PASS ${passed}/19] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err);
    throw err;
  }
}

// 1. Valid Token Verification
runTest("Valid dispatch token verifies successfully", () => {
  const token = createTechnicianDispatchToken("tech_carlos", "book_101");
  const res = verifyTechnicianDispatchToken(token, { expectedBookingId: "book_101", expectedTechnicianId: "tech_carlos" });
  assert.equal(res.valid, true);
  assert.equal(res.technicianId, "tech_carlos");
});

// 2. Empty string token rejected
runTest("Empty string token fails with missing token error", () => {
  const res = verifyTechnicianDispatchToken("");
  assert.equal(res.valid, false);
  assert.equal(res.error, "Missing dispatch token.");
});

// 3. Null token rejected
runTest("Null token fails verification", () => {
  const res = verifyTechnicianDispatchToken(null);
  assert.equal(res.valid, false);
});

// 4. Undefined token rejected
runTest("Undefined token fails verification", () => {
  const res = verifyTechnicianDispatchToken(undefined);
  assert.equal(res.valid, false);
});

// 5. Single part malformed token
runTest("Single part token rejected", () => {
  const res = verifyTechnicianDispatchToken("invalid-single-string");
  assert.equal(res.valid, false);
});

// 6. Three part token rejected (not JWT, custom 2-part format)
runTest("Three part token rejected", () => {
  const res = verifyTechnicianDispatchToken("part1.part2.part3");
  assert.equal(res.valid, false);
});

// 7. Forged signature rejected
runTest("Forged signature signed with wrong secret rejected", () => {
  const token = createTechnicianDispatchToken("tech_carlos", "book_101", "wrong_secret_123");
  const res = verifyTechnicianDispatchToken(token);
  assert.equal(res.valid, false);
  assert.equal(res.error, "Invalid dispatch token signature.");
});

// 8. Tampered payload rejected
runTest("Tampered technicianId in payload rejected", () => {
  const token = createTechnicianDispatchToken("tech_carlos", "book_101");
  const [p, s] = token.split(".");
  const tamperedPayload = Buffer.from(JSON.stringify({ technicianId: "tech_attacker", bookingId: "book_101", exp: Date.now() + 10000 })).toString("base64url");
  const res = verifyTechnicianDispatchToken(`${tamperedPayload}.${s}`);
  assert.equal(res.valid, false);
  assert.equal(res.error, "Invalid dispatch token signature.");
});

// 9. Expired token rejected
runTest("Expired token rejected", () => {
  const token = createTechnicianDispatchToken("tech_carlos", "book_101", TEST_SECRET, -5000);
  const res = verifyTechnicianDispatchToken(token);
  assert.equal(res.valid, false);
  assert.equal(res.error, "Dispatch token has expired.");
});

// 10. Cross-Booking Reuse rejected
runTest("Token for Booking A rejected when presented for Booking B", () => {
  const token = createTechnicianDispatchToken("tech_carlos", "booking_AAA");
  const res = verifyTechnicianDispatchToken(token, { expectedBookingId: "booking_BBB" });
  assert.equal(res.valid, false);
  assert.equal(res.error, "Dispatch token is not authorized for this booking.");
});

// 11. Cross-Technician Scope rejected
runTest("Token for Tech A rejected when presented for Tech B", () => {
  const token = createTechnicianDispatchToken("tech_carlos", "book_101");
  const res = verifyTechnicianDispatchToken(token, { expectedTechnicianId: "tech_david" });
  assert.equal(res.valid, false);
  assert.equal(res.error, "Dispatch token does not match the assigned technician.");
});

// 12. Missing technicianId in payload rejected
runTest("Token payload without technicianId rejected", () => {
  const payload = { bookingId: "book_101", exp: Date.now() + 10000 };
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const s = crypto.createHmac("sha256", TEST_SECRET).update(p).digest("base64url");
  const res = verifyTechnicianDispatchToken(`${p}.${s}`);
  assert.equal(res.valid, false);
});

// 13. Unscoped token allowed on any booking if expectedBookingId matches
runTest("Unscoped technician token allowed across technician jobs", () => {
  const token = createTechnicianDispatchToken("tech_carlos"); // no bookingId in payload
  const res = verifyTechnicianDispatchToken(token, { expectedTechnicianId: "tech_carlos", expectedBookingId: "any_booking" });
  assert.equal(res.valid, true);
});

// 14. Signature timing safe verification
runTest("Timing safe comparison prevents byte length differences", () => {
  const token = createTechnicianDispatchToken("tech_carlos", "book_101");
  const [p] = token.split(".");
  const res = verifyTechnicianDispatchToken(`${p}.shortsig`);
  assert.equal(res.valid, false);
});

// 15. Base64url padding flexibility
runTest("Standard base64url characters supported without errors", () => {
  const token = createTechnicianDispatchToken("tech_special_-_123", "book_456");
  const res = verifyTechnicianDispatchToken(token, { expectedTechnicianId: "tech_special_-_123" });
  assert.equal(res.valid, true);
});

// 16. Future expiration supported
runTest("7-day default expiration allows multi-day validity", () => {
  const token = createTechnicianDispatchToken("tech_carlos", "book_101", TEST_SECRET, 7 * 24 * 3600 * 1000);
  const res = verifyTechnicianDispatchToken(token);
  assert.equal(res.valid, true);
});

// 17. Non-JSON payload rejected
runTest("Non-JSON garbage payload rejected safely", () => {
  const p = Buffer.from("not_a_json_object").toString("base64url");
  const s = crypto.createHmac("sha256", TEST_SECRET).update(p).digest("base64url");
  const res = verifyTechnicianDispatchToken(`${p}.${s}`);
  assert.equal(res.valid, false);
});

// 18. Non-finite expiration rejected
runTest("Non-finite exp rejected", () => {
  const payload = { technicianId: "tech_carlos", exp: "infinity" };
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const s = crypto.createHmac("sha256", TEST_SECRET).update(p).digest("base64url");
  const res = verifyTechnicianDispatchToken(`${p}.${s}`);
  assert.equal(res.valid, false);
});

// 19. Complete end-to-end token generation & verification cycle
runTest("Full lifecycle token roundtrip passes all checks", () => {
  const token = createTechnicianDispatchToken("tech_roundtrip_99", "booking_target_99");
  const res = verifyTechnicianDispatchToken(token, {
    expectedBookingId: "booking_target_99",
    expectedTechnicianId: "tech_roundtrip_99",
  });
  assert.equal(res.valid, true);
  assert.equal(res.technicianId, "tech_roundtrip_99");
  assert.equal(res.bookingId, "booking_target_99");
});

console.log("\n==================================================");
console.log(`=== ALL 19 / 19 PHASE 1 SECURITY TESTS PASSED! ===`);
console.log("==================================================");
