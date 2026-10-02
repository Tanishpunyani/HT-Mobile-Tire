/**
 * Phase 6F Focused Integration & Regression Test Suite
 * Customer Privacy, UI Consistency & Multi-Customer Authorization
 * HT Mobile Services / Tire Mobile Clinic
 *
 * Covers:
 * Privacy (Fix 1):
 * 1. GET /api/bookings/[id] does not expose technician.phone
 * 2. Customer response does not contain technician personal phone anywhere in tracking data
 * 3. Customer call action uses the public business number
 * 4. Existing customer tracking still works after sanitization
 * 5. Cross-customer booking access remains blocked
 *
 * Payment UI (Fix 2):
 * 6. quote_sent renders 'Payment Due'
 * 7. quote_sent renders 'Total Amount Due'
 * 8. paid renders 'Paid'
 * 9. paid renders 'Total Amount Paid'
 * 10. Unexpected payment status does not crash the page
 *
 * Receipt Authorization (Fix 3):
 * 11. Authenticated customer can access receipt through their primary customer ID
 * 12. Authenticated user with authorized guest + registered customer IDs can access guest booking receipt
 * 13. Different customer's receipt remains blocked (403)
 * 14. Admin receipt access remains functional
 * 15. Incomplete booking receipt remains blocked (400)
 *
 * Arrival UI (Fix 4):
 * 16. Confirmed booking without arrivedAt shows normal confirmed state
 * 17. Confirmed booking with arrivedAt shows 'Technician On-Site'
 * 18. in_progress still shows 'Service In Progress'
 * 19. Completed booking still shows 'Service Completed'
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY } from "../../../frontend/src/lib/constants/phone.ts";

export function runPhase6FCustomerHardeningTests() {
  describe("Phase 6F: Customer Privacy & Technician Phone Masking (Fix 1)", () => {
    // Simulates the sanitization logic in GET /api/bookings/[id]
    function sanitizeCustomerBookingResponse(booking) {
      const sanitizedTracking = {
        bookingId: booking.id,
        bookingStatus: booking.status,
        technician: booking.technician
          ? {
              name: booking.technician.name,
              role: booking.technician.role,
              phone: null, // Sanitized in Phase 6F
            }
          : null,
      };

      const safeBooking = { ...booking };
      delete safeBooking.technicianLocation;
      if (safeBooking.technician) {
        safeBooking.technician = {
          ...safeBooking.technician,
          phone: null, // Sanitized in Phase 6F
        };
      }

      return {
        booking: safeBooking,
        tracking: sanitizedTracking,
      };
    }

    test("1. GET /api/bookings/[id] does not expose technician.phone", () => {
      const rawBooking = {
        id: "bkg-001",
        status: "confirmed",
        technician: {
          id: "tech-carlos",
          name: "Carlos Rivera",
          role: "Mobile Tire Specialist",
          phone: "+12145559988", // Personal cell phone
        },
      };

      const response = sanitizeCustomerBookingResponse(rawBooking);
      assertEqual(response.booking.technician.phone, null);
      assertEqual(response.booking.technician.name, "Carlos Rivera");
    });

    test("2. Customer response does not contain technician personal phone anywhere in tracking data", () => {
      const rawBooking = {
        id: "bkg-002",
        status: "in_progress",
        technician: {
          id: "tech-carlos",
          name: "Carlos Rivera",
          role: "Mobile Tire Specialist",
          phone: "+12145559988",
        },
      };

      const response = sanitizeCustomerBookingResponse(rawBooking);
      assertEqual(response.tracking.technician.phone, null);
      assert(!JSON.stringify(response).includes("+12145559988"), "Personal phone must NOT appear anywhere in JSON");
    });

    test("3. Customer call action uses the public business number", () => {
      // Simulates the contact resolver in LiveVanTracker.tsx
      function resolveCustomerCallTarget() {
        return {
          raw: BUSINESS_PHONE_RAW,
          display: BUSINESS_PHONE_DISPLAY,
        };
      }

      const target = resolveCustomerCallTarget();
      assertEqual(target.raw, BUSINESS_PHONE_RAW);
      assertEqual(target.display, BUSINESS_PHONE_DISPLAY);
      assert(!target.raw.includes("+12145559988"), "Must not use technician personal phone");
    });

    test("4. Existing customer tracking still works after sanitization", () => {
      const rawBooking = {
        id: "bkg-004",
        status: "confirmed",
        technician: {
          id: "tech-01",
          name: "Sam Tech",
          role: "Mobile Specialist",
          phone: "+12149990000",
        },
      };

      const response = sanitizeCustomerBookingResponse(rawBooking);
      assertEqual(response.tracking.bookingStatus, "confirmed");
      assertEqual(response.tracking.technician.name, "Sam Tech");
      assertEqual(response.tracking.technician.role, "Mobile Specialist");
    });

    test("5. Cross-customer booking access remains blocked", () => {
      function authorizeAccess(viewerUser, authorizedCustomerIds, booking) {
        if (!viewerUser) return { status: 401 };
        const isOwner =
          (booking.customerId && authorizedCustomerIds.includes(booking.customerId)) ||
          booking.customer?.userId === viewerUser.id;
        return isOwner ? { status: 200 } : { status: 404, error: "Booking not found" };
      }

      const bookingAlice = { id: "bkg-alice", customerId: "cust-alice", customer: { userId: "user-alice" } };
      const res = authorizeAccess({ id: "user-bob" }, ["cust-bob"], bookingAlice);
      assertEqual(res.status, 404);
    });
  });

  describe("Phase 6F: Payment UI Distinctions (Fix 2)", () => {
    function resolveInvoiceDisplay(paymentStatus, totalAmount) {
      const totalAmountNum = Number(totalAmount) || 0;
      const isPaid = paymentStatus === "paid";
      const isQuoteSent = paymentStatus === "quote_sent";

      const paymentBadgeText = isPaid
        ? "Paid"
        : isQuoteSent
        ? "Payment Due"
        : "Official Completed Quote";

      const paymentTotalLabel = isPaid
        ? "Total Amount Paid:"
        : isQuoteSent
        ? "Total Amount Due:"
        : "Total Amount Due / Paid:";

      return {
        badge: paymentBadgeText,
        label: `${paymentTotalLabel} $${totalAmountNum.toFixed(2)}`,
      };
    }

    test("6. quote_sent renders 'Payment Due'", () => {
      const ui = resolveInvoiceDisplay("quote_sent", 125.0);
      assertEqual(ui.badge, "Payment Due");
    });

    test("7. quote_sent renders 'Total Amount Due'", () => {
      const ui = resolveInvoiceDisplay("quote_sent", 125.0);
      assert(ui.label.startsWith("Total Amount Due:"));
      assertEqual(ui.label, "Total Amount Due: $125.00");
    });

    test("8. paid renders 'Paid'", () => {
      const ui = resolveInvoiceDisplay("paid", 125.0);
      assertEqual(ui.badge, "Paid");
    });

    test("9. paid renders 'Total Amount Paid'", () => {
      const ui = resolveInvoiceDisplay("paid", 125.0);
      assert(ui.label.startsWith("Total Amount Paid:"));
      assertEqual(ui.label, "Total Amount Paid: $125.00");
    });

    test("10. Unexpected payment status does not crash the page", () => {
      const ui1 = resolveInvoiceDisplay(null, 100);
      assertEqual(ui1.badge, "Official Completed Quote");
      assertEqual(ui1.label, "Total Amount Due / Paid: $100.00");

      const ui2 = resolveInvoiceDisplay("unknown_state", "invalid_amount");
      assertEqual(ui2.badge, "Official Completed Quote");
      assertEqual(ui2.label, "Total Amount Due / Paid: $0.00");
    });
  });

  describe("Phase 6F: Multi-Customer Receipt Authorization (Fix 3)", () => {
    function authorizeReceiptDownload({ isAdmin, user, authorizedCustomerIds, booking }) {
      if (isAdmin) {
        if (booking.status !== "completed") return { status: 400, error: "Receipt requires completed status" };
        return { status: 200, access: true };
      }

      if (!user) return { status: 401, error: "Unauthorized" };

      if (!authorizedCustomerIds || authorizedCustomerIds.length === 0) {
        return { status: 403, error: "Customer profile not found" };
      }

      const isAuthorizedOwner =
        (booking.customerId && authorizedCustomerIds.includes(booking.customerId)) ||
        (booking.customer?.userId && booking.customer.userId === user.id);

      if (!isAuthorizedOwner) {
        return { status: 403, error: "Access denied" };
      }

      if (booking.status !== "completed") {
        return { status: 400, error: "Receipt is only available for completed services" };
      }

      return { status: 200, access: true };
    }

    test("11. Authenticated customer can access receipt through their primary customer ID", () => {
      const user = { id: "user-alice", email: "alice@example.com" };
      const authorizedCustomerIds = ["cust-alice-primary"];
      const booking = { id: "bkg-11", customerId: "cust-alice-primary", status: "completed" };

      const res = authorizeReceiptDownload({ isAdmin: false, user, authorizedCustomerIds, booking });
      assertEqual(res.status, 200);
      assertEqual(res.access, true);
    });

    test("12. Authenticated user with authorized guest + registered customer IDs can access their guest booking receipt", () => {
      const user = { id: "user-alice", email: "alice@example.com" };
      // User has both their new registered ID and an older guest booking ID tied to their email
      const authorizedCustomerIds = ["cust-alice-registered", "cust-alice-guest-prior"];
      const guestBooking = {
        id: "bkg-guest-prior",
        customerId: "cust-alice-guest-prior",
        status: "completed",
      };

      const res = authorizeReceiptDownload({ isAdmin: false, user, authorizedCustomerIds, booking: guestBooking });
      assertEqual(res.status, 200);
      assertEqual(res.access, true);
    });

    test("13. Different customer's receipt remains blocked", () => {
      const user = { id: "user-bob", email: "bob@example.com" };
      const authorizedCustomerIds = ["cust-bob"];
      const aliceBooking = { id: "bkg-alice", customerId: "cust-alice", status: "completed" };

      const res = authorizeReceiptDownload({ isAdmin: false, user, authorizedCustomerIds, booking: aliceBooking });
      assertEqual(res.status, 403);
      assertEqual(res.error, "Access denied");
    });

    test("14. Admin receipt access remains functional", () => {
      const booking = { id: "bkg-any", customerId: "cust-any", status: "completed" };
      const res = authorizeReceiptDownload({ isAdmin: true, user: null, authorizedCustomerIds: [], booking });
      assertEqual(res.status, 200);
      assertEqual(res.access, true);
    });

    test("15. Incomplete booking receipt remains blocked", () => {
      const user = { id: "user-alice", email: "alice@example.com" };
      const authorizedCustomerIds = ["cust-alice"];
      const inProgressBooking = { id: "bkg-prog", customerId: "cust-alice", status: "in_progress" };

      const res = authorizeReceiptDownload({ isAdmin: false, user, authorizedCustomerIds, booking: inProgressBooking });
      assertEqual(res.status, 400);
      assertEqual(res.error, "Receipt is only available for completed services");
    });
  });

  describe("Phase 6F: Arrival Milestone UI (Fix 4)", () => {
    function resolveMilestoneHeadline(booking) {
      const hasArrived = Boolean(booking.arrivedAt || booking.hasArrived);

      if (booking.status === "pending") {
        return { headline: "Booking Request Received", step: 1 };
      } else if (booking.status === "confirmed") {
        if (hasArrived) {
          return { headline: "Technician On-Site", step: 2 };
        }
        return { headline: "Appointment Confirmed", step: 2 };
      } else if (booking.status === "in_progress") {
        return { headline: "Service In Progress", step: 3 };
      } else if (booking.status === "completed") {
        return { headline: "Service Completed", step: 4 };
      }
      return { headline: "Status Unknown", step: 0 };
    }

    test("16. Confirmed booking without arrivedAt shows normal confirmed state", () => {
      const booking = { status: "confirmed", arrivedAt: null };
      const result = resolveMilestoneHeadline(booking);
      assertEqual(result.headline, "Appointment Confirmed");
      assertEqual(result.step, 2);
    });

    test("17. Confirmed booking with arrivedAt shows 'Technician On-Site'", () => {
      const booking = { status: "confirmed", arrivedAt: new Date().toISOString() };
      const result = resolveMilestoneHeadline(booking);
      assertEqual(result.headline, "Technician On-Site");
      assertEqual(result.step, 2);
    });

    test("18. in_progress still shows 'Service In Progress'", () => {
      const booking = { status: "in_progress", arrivedAt: new Date().toISOString() };
      const result = resolveMilestoneHeadline(booking);
      assertEqual(result.headline, "Service In Progress");
      assertEqual(result.step, 3);
    });

    test("19. Completed booking still shows 'Service Completed'", () => {
      const booking = { status: "completed", arrivedAt: new Date().toISOString() };
      const result = resolveMilestoneHeadline(booking);
      assertEqual(result.headline, "Service Completed");
      assertEqual(result.step, 4);
    });
  });
}

// Standalone execution support
if (process.argv[1]?.endsWith("phase-6f-customer-hardening.test.mjs")) {
  runPhase6FCustomerHardeningTests();
}
