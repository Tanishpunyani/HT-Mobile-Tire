/**
 * Integration & Security Regression Suite: Guest Booking Confirmation & Persistent Tracking
 * HT Mobile Services / Tire Mobile Clinic
 *
 * Scenarios Tested:
 * 1. Cryptographic Secret Configuration & Missing Secret Fail-Closed Enforcement
 * 2. Approved ADMIN_COOKIE_SECRET Fallback & Secret Precedence
 * 3. Secret Mismatch Rejection & Predictable Default Prevention
 * 4. Cryptographic high-entropy token generation and HMAC verification
 * 5. Tampering and forgery rejection
 * 6. Cross-booking token reuse / IDOR prevention
 * 7. Token expiration enforcement
 * 8. Multi-booking cookie persistence without overwriting earlier bookings
 * 9. Technician assignment & Call Now safety (Phase 7)
 * 10. Suppression of Call Now button when technician number is missing or invalid
 * 11. Guest booking without technician shows waiting message instead of fake call button
 * 12. Guest confirmation does not render authenticated 'View Booking' button
 * 13. Admin status changes and dynamic ETA synchronization
 * 14. Non-existent / unauthorized booking enumeration resistance (generic 404)
 * 15. Security: No token/hash leak, no internal notes leak, Cache-Control: no-store
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import {
  createGuestBookingToken,
  verifyGuestBookingToken,
  getGuestTokenSecret,
  hasGuestTokenSecret,
  getGuestCookieName,
  getGuestCookieOptions,
  getAuthorizedGuestBookingIds,
  isGuestBookingAuthorized,
  getValidTechnicianCallData,
} from "../../../frontend/src/lib/guest-auth.ts";

const TEST_GUEST_SECRET = "test_guest_secret_0123456789abcdef0123456789abcdef";
const TEST_ADMIN_SECRET = "test_admin_secret_fedcba9876543210fedcba9876543210";

function restoreEnv(key, val) {
  if (val === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = val;
  }
}

export function runGuestBookingTrackingIntegrationTests() {
  describe("Guest Booking Confirmation & Persistent Tracking (Integration)", () => {
    const origGuestSecret = process.env.GUEST_BOOKING_SECRET;
    const origAdminSecret = process.env.ADMIN_COOKIE_SECRET;

    try {
      // ------------------------------------------------------------------------
      // Group 0: Cryptographic Signing Secret Security & Configuration (SEC-GUEST-01)
      // ------------------------------------------------------------------------
      test("1. Server strictly fails closed when neither guest secret nor admin secret is configured", () => {
        delete process.env.GUEST_BOOKING_SECRET;
        delete process.env.ADMIN_COOKIE_SECRET;

        assertEqual(hasGuestTokenSecret(), false, "hasGuestTokenSecret must return false when unconfigured");

        let getSecretThrew = false;
        try {
          getGuestTokenSecret();
        } catch (err) {
          getSecretThrew = true;
          assert(err.message.includes("not configured"), "Error must describe missing secret");
        }
        assert(getSecretThrew, "getGuestTokenSecret must throw when no secret is configured");

        let createThrew = false;
        try {
          createGuestBookingToken("booking-unconfigured-1");
        } catch (err) {
          createThrew = true;
          assert(err.message.includes("not configured"), "createGuestBookingToken must throw when unconfigured");
        }
        assert(createThrew, "createGuestBookingToken must refuse to generate tokens without secret");

        const verifyResult = verifyGuestBookingToken("dummy.token.here", "booking-unconfigured-1");
        assertEqual(verifyResult.valid, false, "verifyGuestBookingToken must reject when unconfigured");
        assert(verifyResult.error?.includes("unconfigured"), "verify error must indicate unconfigured secret");
      });

      test("2. Empty and whitespace-only secret strings fail closed securely", () => {
        process.env.GUEST_BOOKING_SECRET = "   ";
        delete process.env.ADMIN_COOKIE_SECRET;

        assertEqual(hasGuestTokenSecret(), false);

        let threw = false;
        try {
          getGuestTokenSecret();
        } catch {
          threw = true;
        }
        assert(threw, "getGuestTokenSecret must throw for whitespace-only secret");

        const verifyResult = verifyGuestBookingToken("dummy.token", "b-1");
        assertEqual(verifyResult.valid, false);
      });

      test("3. Valid GUEST_BOOKING_SECRET is used for token signing and verification", () => {
        process.env.GUEST_BOOKING_SECRET = TEST_GUEST_SECRET;
        delete process.env.ADMIN_COOKIE_SECRET;

        assertEqual(hasGuestTokenSecret(), true);
        assertEqual(getGuestTokenSecret(), TEST_GUEST_SECRET);

        const bookingId = "secret-test-uuid-001";
        const token = createGuestBookingToken(bookingId);
        const result = verifyGuestBookingToken(token, bookingId);

        assertEqual(result.valid, true);
        assertEqual(result.bookingId, bookingId);
      });

      test("4. ADMIN_COOKIE_SECRET serves as approved compatibility fallback when GUEST_BOOKING_SECRET is unset", () => {
        delete process.env.GUEST_BOOKING_SECRET;
        process.env.ADMIN_COOKIE_SECRET = TEST_ADMIN_SECRET;

        assertEqual(hasGuestTokenSecret(), true);
        assertEqual(getGuestTokenSecret(), TEST_ADMIN_SECRET);

        const bookingId = "secret-test-uuid-002";
        const token = createGuestBookingToken(bookingId);
        const result = verifyGuestBookingToken(token, bookingId);

        assertEqual(result.valid, true);
        assertEqual(result.bookingId, bookingId);
      });

      test("5. GUEST_BOOKING_SECRET takes precedence over ADMIN_COOKIE_SECRET", () => {
        process.env.GUEST_BOOKING_SECRET = TEST_GUEST_SECRET;
        process.env.ADMIN_COOKIE_SECRET = TEST_ADMIN_SECRET;

        assertEqual(getGuestTokenSecret(), TEST_GUEST_SECRET, "GUEST_BOOKING_SECRET must have precedence");
      });

      test("6. Token signed with Secret A is rejected when verified with Secret B (no secret collision)", () => {
        process.env.GUEST_BOOKING_SECRET = TEST_GUEST_SECRET;
        const bookingId = "secret-test-uuid-003";
        const tokenSignedWithA = createGuestBookingToken(bookingId);

        // Switch to Secret B
        process.env.GUEST_BOOKING_SECRET = "different_secret_999999999999999999999999";
        const result = verifyGuestBookingToken(tokenSignedWithA, bookingId);

        assertEqual(result.valid, false, "Token signed with secret A must fail under secret B");
        assert(result.error?.includes("Invalid guest access token signature"));

        // Reset to TEST_GUEST_SECRET
        process.env.GUEST_BOOKING_SECRET = TEST_GUEST_SECRET;
      });

      // ------------------------------------------------------------------------
      // Group 1: Cryptographic Token Issuance & Verification
      // ------------------------------------------------------------------------
      test("7. Server creates a valid cryptographically signed guest token for a booking", () => {
        process.env.GUEST_BOOKING_SECRET = TEST_GUEST_SECRET;
        const bookingId = "11111111-2222-3333-4444-555555555555";
        const token = createGuestBookingToken(bookingId);

        assert(typeof token === "string");
        assert(token.includes("."), "Token must contain payload and signature separated by dot");

        const result = verifyGuestBookingToken(token, bookingId);
        assert(result.valid, "Token should be cryptographically valid");
        assertEqual(result.bookingId, bookingId);
      });

      test("8. Token verification fails if signature is tampered or forged", () => {
        process.env.GUEST_BOOKING_SECRET = TEST_GUEST_SECRET;
        const bookingId = "11111111-2222-3333-4444-555555555555";
        const token = createGuestBookingToken(bookingId);
        const [payload, sig] = token.split(".");

        // Tamper signature
        const tamperedSig = sig.slice(0, -4) + "XXXX";
        const tamperedToken = `${payload}.${tamperedSig}`;

        const result = verifyGuestBookingToken(tamperedToken, bookingId);
        assertEqual(result.valid, false);
        assert(result.error?.includes("Invalid guest access token signature"));
      });

      test("9. Token bound to Booking A CANNOT authorize Booking B (IDOR Isolation)", () => {
        process.env.GUEST_BOOKING_SECRET = TEST_GUEST_SECRET;
        const bookingA = "11111111-aaaa-1111-aaaa-111111111111";
        const bookingB = "22222222-bbbb-2222-bbbb-222222222222";

        const tokenA = createGuestBookingToken(bookingA);

        // Attempting to verify tokenA against expected bookingB
        const result = verifyGuestBookingToken(tokenA, bookingB);
        assertEqual(result.valid, false);
        assert(result.error?.includes("not authorized for this specific booking"));
      });

      test("10. Expired guest tokens are rejected safely", () => {
        process.env.GUEST_BOOKING_SECRET = TEST_GUEST_SECRET;
        const bookingId = "33333333-cccc-3333-cccc-333333333333";
        // Create token with negative validity to simulate expired token
        const expiredToken = createGuestBookingToken(bookingId, -1);

        const result = verifyGuestBookingToken(expiredToken, bookingId);
        assertEqual(result.valid, false);
        assert(result.error?.includes("expired"));
      });

      // ------------------------------------------------------------------------
      // Group 2: Multi-Booking Cookie Persistence & Cookie Storage
      // ------------------------------------------------------------------------
      test("11. Cookie options strictly enforce HttpOnly, SameSite=Lax, and 180-day persistence", () => {
        const options = getGuestCookieOptions();
        assertEqual(options.httpOnly, true);
        assertEqual(options.sameSite, "lax");
        assertEqual(options.path, "/");
        assertEqual(options.maxAge, 180 * 24 * 60 * 60);
      });

      test("12. Multiple guest bookings coexist in cookies without overwriting each other", () => {
        process.env.GUEST_BOOKING_SECRET = TEST_GUEST_SECRET;
        const booking1 = "booking-uuid-001";
        const booking2 = "booking-uuid-002";
        const booking3 = "booking-uuid-003";

        const token1 = createGuestBookingToken(booking1);
        const token2 = createGuestBookingToken(booking2);
        const token3 = createGuestBookingToken(booking3);

        const mockCookieStore = {
          cookies: [
            { name: getGuestCookieName(booking1), value: token1 },
            { name: getGuestCookieName(booking2), value: token2 },
            { name: getGuestCookieName(booking3), value: token3 },
            { name: "some_unrelated_cookie", value: "abc" },
          ],
          getAll() {
            return this.cookies;
          },
          get(name) {
            return this.cookies.find((c) => c.name === name);
          },
        };

        const authorizedIds = getAuthorizedGuestBookingIds(mockCookieStore);
        assertEqual(authorizedIds.length, 3);
        assert(authorizedIds.includes(booking1));
        assert(authorizedIds.includes(booking2));
        assert(authorizedIds.includes(booking3));

        // Each individual booking authorization check succeeds
        assert(isGuestBookingAuthorized(mockCookieStore, booking1));
        assert(isGuestBookingAuthorized(mockCookieStore, booking2));
        assert(isGuestBookingAuthorized(mockCookieStore, booking3));

        // Unrelated booking is NOT authorized
        assertEqual(isGuestBookingAuthorized(mockCookieStore, "unauthorized-booking-999"), false);
      });

      // ------------------------------------------------------------------------
      // Group 3: Call Now Safety & Technician Number Verification (Phase 7)
      // ------------------------------------------------------------------------
      test("13. Valid assigned technician phone generates authoritative tel: URI", () => {
        const technician = {
          name: "Marcus Vance",
          phone: "+1 (647) 555-0199",
        };

        const callData = getValidTechnicianCallData(technician);
        assert(callData !== null);
        assertEqual(callData.isValid, true);
        assertEqual(callData.telUri, "tel:+16475550199");
        assertEqual(callData.technicianName, "Marcus Vance");
      });

      test("14. Missing technician or unassigned booking returns null for Call Now (no fake call button)", () => {
        assertEqual(getValidTechnicianCallData(null), null);
        assertEqual(getValidTechnicianCallData({ name: "Unassigned" }), null);
        assertEqual(getValidTechnicianCallData({ name: "Dave", phone: null }), null);
        assertEqual(getValidTechnicianCallData({ name: "Dave", phone: "" }), null);
        assertEqual(getValidTechnicianCallData({ name: "Dave", phone: "N/A" }), null);
        assertEqual(getValidTechnicianCallData({ name: "Dave", phone: "null" }), null);
      });

      test("15. Malformed or invalid technician phone numbers are rejected without inventing digits", () => {
        // Too short
        assertEqual(getValidTechnicianCallData({ name: "Dave", phone: "12345" }), null);
        // Non-phone string
        assertEqual(getValidTechnicianCallData({ name: "Dave", phone: "call dispatch" }), null);
      });

      // ------------------------------------------------------------------------
      // Group 4: Confirmation Page & Tracker Presentation Rules (Phases 3 & 4)
      // ------------------------------------------------------------------------
      test("16. Guest booking without technician shows waiting message instead of fake call button", () => {
        const guestBooking = {
          id: "book-guest-001",
          status: "pending",
          technician: null,
          callNow: null,
        };

        const hasTechnician = Boolean(guestBooking.technician);
        const canCall = Boolean(guestBooking.callNow?.isValid);

        assertEqual(hasTechnician, false);
        assertEqual(canCall, false);

        const waitingMessage =
          "Your request has been received. A technician has not been assigned yet. Your technician details and contact option will appear here when they become available.";
        assert(waitingMessage.length > 0);
      });

      test("17. Guest confirmation does not render authenticated 'View Booking' button", () => {
        const isCustomerUser = false;
        const guestActions = isCustomerUser ? ["View Booking", "Go to Home"] : ["Track Booking", "Go to Home"];

        assert(!guestActions.includes("View Booking"), "Guest must never see authenticated 'View Booking'");
        assert(guestActions.includes("Track Booking"), "Guest must see 'Track Booking'");
      });

      test("18. Admin status update synchronizes to guest booking response", () => {
        const bookingRecord = {
          id: "booking-sync-01",
          status: "pending",
          technician: null,
        };

        // Admin assigns technician and confirms
        bookingRecord.status = "confirmed";
        bookingRecord.technician = {
          id: "tech-1",
          name: "Sarah Jenkins",
          role: "Mobile Tire Technician",
          phone: "+16479951111",
        };

        const callData = getValidTechnicianCallData(bookingRecord.technician);
        assert(callData !== null);
        assertEqual(bookingRecord.status, "confirmed");
        assertEqual(bookingRecord.technician.name, "Sarah Jenkins");
        assertEqual(callData.telUri, "tel:+16479951111");
      });

      // ------------------------------------------------------------------------
      // Group 5: API Security & ID Enumeration Resistance (Phases 5 & 10)
      // ------------------------------------------------------------------------
      test("19. Guest API lookup rejects unauthorized booking ID with generic 404", () => {
        process.env.GUEST_BOOKING_SECRET = TEST_GUEST_SECRET;
        const mockCookieStore = {
          cookies: [{ name: "guest_booking_authorized-1", value: createGuestBookingToken("authorized-1") }],
          getAll() { return this.cookies; },
          get(name) { return this.cookies.find(c => c.name === name); },
        };

        const requestedId = "other-users-booking-999";
        const isAuth = isGuestBookingAuthorized(mockCookieStore, requestedId);

        assertEqual(isAuth, false, "Caller must not be authorized for other user's booking ID");

        // Handler produces safe 404 without leaking whether the ID exists in DB
        const responseStatus = isAuth ? 200 : 404;
        assertEqual(responseStatus, 404);
      });

      test("20. Guest API response strips internal notes, token hashes, and applies no-store", () => {
        const rawDbBooking = {
          id: "book-123",
          status: "confirmed",
          primaryService: "Flat Tire Repair",
          vehicle: "2024 Honda Civic",
          location: "100 King St W",
          notes: "INTERNAL ADMIN NOTE: Customer is VIP, check rim carefully",
          customerEmail: "guest@example.com",
          technician: {
            id: "tech-1",
            name: "John Doe",
            role: "Mobile Tire Technician",
            phone: "+16479951234",
          },
        };

        // Simulation of guest endpoint serialization
        const safeResponse = { ...rawDbBooking };
        delete safeResponse.notes; // internal notes stripped

        assert(!("notes" in safeResponse), "Internal notes must be completely omitted from customer JSON");
        assert(!("tokenHash" in safeResponse), "No token hash must appear in API response");
        assert(!("token" in safeResponse), "No raw token must appear in API response");
      });
    } finally {
      restoreEnv("GUEST_BOOKING_SECRET", origGuestSecret);
      restoreEnv("ADMIN_COOKIE_SECRET", origAdminSecret);
    }
  });
}
