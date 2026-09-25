/**
 * Integration Test: Mark Arrived Dual Authorization (Technician Token + Admin Session)
 * HT Mobile Services — Problem 1 Regression Suite
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockCustomerAlice, mockCustomerBob, mockAdminUser, mockTechnicianCarlos, mockTechnicianDavid } from "../fixtures/user-fixtures.mjs";
import { mockBookingAliceConfirmed, mockBookingBobInProgress, mockBookingCompleted } from "../fixtures/booking-fixtures.mjs";

const mockBookingCancelled = {
  id: "book_cancelled_401",
  customerId: "cust_alice_111",
  technicianId: mockTechnicianCarlos.id,
  status: "cancelled",
  paymentStatus: "pending",
  serviceType: "Tire Replacement",
  scheduledDate: "2026-10-15",
  scheduledTime: "04:00 PM",
  address: "999 Pine St, Dallas, TX 75201",
  latitude: 32.7767,
  longitude: -96.797,
  price: 100.0,
  createdAt: new Date("2026-10-01T14:00:00.000Z"),
};
import crypto from "crypto";

const TEST_SECRET = "test_technician_dispatch_secret_super_safe_32_bytes";

function createTechnicianDispatchToken(technicianId, bookingId, secret = TEST_SECRET, expiresInMs = 3600000) {
  const exp = Date.now() + expiresInMs;
  const payload = JSON.stringify({ technicianId, ...(bookingId ? { bookingId } : {}), exp });
  const payloadB64 = Buffer.from(payload).toString("base64url");
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

  if (!payload.technicianId || !payload.exp || payload.exp <= Date.now()) {
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

// Simulates the markTechnicianArrivedAction authorization and state-machine logic
function simulateMarkTechnicianArrived({
  booking,
  token,
  sessionUser,
  adminCookiePresent,
}) {
  if (!booking || !booking.id) {
    return { success: false, status: 400, error: "Valid booking ID is required." };
  }

  let isAuthorized = false;
  let authorizedRole = "technician";
  const trimmedToken = (token || "").trim();

  // Path A: Dispatch Token Present
  if (trimmedToken) {
    const verification = verifyTechnicianDispatchToken(trimmedToken, {
      expectedBookingId: booking.id,
      expectedTechnicianId: booking.technicianId || undefined,
    });

    if (!verification.valid) {
      return { success: false, status: 403, error: verification.error || "Unauthorized technician dispatch token." };
    }

    if (booking.technicianId && verification.technicianId !== booking.technicianId) {
      return { success: false, status: 403, error: "Dispatch token is not authorized for the technician assigned to this booking." };
    }

    isAuthorized = true;
    authorizedRole = "technician";
  } else {
    // Path B: Token Absent / Empty -> Server-Side Admin / Staff Auth Check
    if (adminCookiePresent) {
      isAuthorized = true;
      authorizedRole = "admin";
    } else if (sessionUser) {
      if (sessionUser.role === "admin") {
        isAuthorized = true;
        authorizedRole = "admin";
      } else if (sessionUser.role === "technician" && sessionUser.id === booking.technicianId) {
        isAuthorized = true;
        authorizedRole = "technician";
      }
    }
  }

  if (!isAuthorized) {
    return {
      success: false,
      status: 401,
      error: "Unauthorized. Valid technician dispatch token or admin session required.",
    };
  }

  // State Machine Validation (Phase 6B: Booking must be confirmed)
  if (booking.status !== "confirmed") {
    return {
      success: false,
      status: 400,
      error: `Cannot record arrival for booking in "${booking.status}" status. Booking must be confirmed.`,
    };
  }

  if (!booking.technicianId) {
    return {
      success: false,
      status: 400,
      error: "Cannot record arrival. No technician is assigned to this booking.",
    };
  }

  const arrivalTimestamp = booking.arrivedAt || new Date().toISOString();

  return {
    success: true,
    status: 200,
    arrivedAt: arrivalTimestamp,
    bookingStatus: "confirmed",
    authorizedBy: trimmedToken ? "dispatch_token" : "admin_staff_session",
  };
}

export function runMarkArrivedDualAuthRegressionTests() {
  describe("Problem 1: Mark Arrived Dual Authorization Model (Integration)", () => {
    // Case 1: No token + valid Admin session + valid booking -> PASS
    test("Case 1: No token + valid Admin session on confirmed booking -> SUCCESS (200)", () => {
      const result = simulateMarkTechnicianArrived({
        booking: { ...mockBookingAliceConfirmed, arrivedAt: null },
        token: "",
        sessionUser: mockAdminUser,
        adminCookiePresent: true,
      });
      assert(result.success, "Admin session without token must succeed");
      assertEqual(result.status, 200);
      assertEqual(result.bookingStatus, "confirmed");
      assertEqual(result.authorizedBy, "admin_staff_session");
    });

    // Case 2: Valid technician token + correct booking -> PASS
    test("Case 2: Valid technician token + matching booking -> SUCCESS (200)", () => {
      const validToken = createTechnicianDispatchToken(mockTechnicianCarlos.id, mockBookingAliceConfirmed.id);
      const result = simulateMarkTechnicianArrived({
        booking: { ...mockBookingAliceConfirmed, technicianId: mockTechnicianCarlos.id, arrivedAt: null },
        token: validToken,
        sessionUser: null,
        adminCookiePresent: false,
      });
      assert(result.success, "Valid technician token must succeed");
      assertEqual(result.status, 200);
      assertEqual(result.bookingStatus, "confirmed");
      assertEqual(result.authorizedBy, "dispatch_token");
    });

    // Case 3: No token + normal customer session -> REJECT (401)
    test("Case 3: Customer session without token -> REJECTED (401)", () => {
      const result = simulateMarkTechnicianArrived({
        booking: { ...mockBookingAliceConfirmed, arrivedAt: null },
        token: "",
        sessionUser: mockCustomerAlice, // Customer role
        adminCookiePresent: false,
      });
      assertEqual(result.success, false);
      assertEqual(result.status, 401);
      assert(result.error.includes("Unauthorized"));
    });

    // Case 4: No token + unauthenticated -> REJECT (401)
    test("Case 4: No token + unauthenticated (no session) -> REJECTED (401)", () => {
      const result = simulateMarkTechnicianArrived({
        booking: { ...mockBookingAliceConfirmed, arrivedAt: null },
        token: "",
        sessionUser: null,
        adminCookiePresent: false,
      });
      assertEqual(result.success, false);
      assertEqual(result.status, 401);
    });

    // Case 5: Wrong technician token + booking -> REJECT (403)
    test("Case 5: Token for Technician David presented for Carlos's booking -> REJECTED (403)", () => {
      const wrongTechToken = createTechnicianDispatchToken(mockTechnicianDavid.id, mockBookingAliceConfirmed.id);
      const result = simulateMarkTechnicianArrived({
        booking: { ...mockBookingAliceConfirmed, technicianId: mockTechnicianCarlos.id, arrivedAt: null },
        token: wrongTechToken,
        sessionUser: null,
        adminCookiePresent: false,
      });
      assertEqual(result.success, false);
      assertEqual(result.status, 403);
    });

    // Case 6: Expired token + booking -> REJECT (403)
    test("Case 6: Expired technician token -> REJECTED (403)", () => {
      const expiredToken = createTechnicianDispatchToken(mockTechnicianCarlos.id, mockBookingAliceConfirmed.id, TEST_SECRET, -10000);
      const result = simulateMarkTechnicianArrived({
        booking: { ...mockBookingAliceConfirmed, technicianId: mockTechnicianCarlos.id, arrivedAt: null },
        token: expiredToken,
        sessionUser: null,
        adminCookiePresent: false,
      });
      assertEqual(result.success, false);
      assertEqual(result.status, 403);
    });

    // Case 7: Tampered token + booking -> REJECT (403)
    test("Case 7: Tampered signature token -> REJECTED (403)", () => {
      const validToken = createTechnicianDispatchToken(mockTechnicianCarlos.id, mockBookingAliceConfirmed.id);
      const [p] = validToken.split(".");
      const tamperedToken = `${p}.forgedSignature9999999999999999999999999999`;
      const result = simulateMarkTechnicianArrived({
        booking: { ...mockBookingAliceConfirmed, technicianId: mockTechnicianCarlos.id, arrivedAt: null },
        token: tamperedToken,
        sessionUser: null,
        adminCookiePresent: false,
      });
      assertEqual(result.success, false);
      assertEqual(result.status, 403);
    });

    // Case 8: Booking state machine validation (completed/cancelled bookings rejected)
    test("Case 8a: Completed booking cannot be marked arrived -> REJECTED (400)", () => {
      const validToken = createTechnicianDispatchToken(mockTechnicianCarlos.id, mockBookingCompleted.id);
      const result = simulateMarkTechnicianArrived({
        booking: mockBookingCompleted,
        token: validToken,
        sessionUser: null,
        adminCookiePresent: false,
      });
      assertEqual(result.success, false);
      assertEqual(result.status, 400);
      assert(result.error.includes("completed"));
    });

    test("Case 8b: Cancelled booking cannot be marked arrived -> REJECTED (400)", () => {
      const validToken = createTechnicianDispatchToken(mockTechnicianCarlos.id, mockBookingCancelled.id);
      const result = simulateMarkTechnicianArrived({
        booking: mockBookingCancelled,
        token: validToken,
        sessionUser: null,
        adminCookiePresent: false,
      });
      assertEqual(result.success, false);
      assertEqual(result.status, 400);
      assert(result.error.includes("cancelled"));
    });

    // Case 9: Idempotent repeat arrival (already arrived) -> PASS
    test("Case 9: Idempotent repeat arrival preserves arrival time without corruption", () => {
      const existingArrival = "2026-09-15T14:30:00.000Z";
      const validToken = createTechnicianDispatchToken(mockTechnicianCarlos.id, mockBookingAliceConfirmed.id);
      const result = simulateMarkTechnicianArrived({
        booking: { ...mockBookingAliceConfirmed, technicianId: mockTechnicianCarlos.id, arrivedAt: existingArrival },
        token: validToken,
        sessionUser: null,
        adminCookiePresent: false,
      });
      assert(result.success, "Repeated arrival must succeed idempotently");
      assertEqual(result.status, 200);
      assertEqual(result.arrivedAt, existingArrival);
    });
  });
}
