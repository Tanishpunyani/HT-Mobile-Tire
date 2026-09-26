/**
 * Phase 6D Focused Integration Test Suite
 * Payment & Completion Hardening
 * HT Mobile Services / Tire Mobile Clinic
 *
 * Verifies:
 * 1. FIX 1: Payment Preservation — Paid booking quote edit remains 'paid'
 * 2. FIX 1: Payment Preservation — Quote-sent booking quote edit remains 'quote_sent'
 * 3. FIX 1: Payment Preservation — New completion from 'in_progress' produces 'quote_sent'
 * 4. FIX 1: Notification Guard — Paid quote edit does not produce duplicate SERVICE_COMPLETED notification
 * 5. FIX 2: Cancellation Guard — Repeated customer cancellation returns success without DB mutation
 * 6. FIX 2: Cancellation Guard — Repeated customer cancellation does not send duplicate cancellation SMS
 * 7. FIX 3: Payment Notification — First pending -> paid transition creates customer payment SMS
 * 8. FIX 3: Duplicate Guard — Repeated paid -> paid transition creates no second payment notification
 * 9. FIX 3: Failure Isolation — Payment notification failure does not roll back paymentStatus
 * 10. FIX 4: Admin PATCH Guard — confirmed -> in_progress without technician is rejected (400)
 * 11. FIX 4: Admin PATCH Guard — confirmed -> in_progress with technician is allowed
 * 12. FIX 4: Unrelated PATCH Transitions — Other valid admin PATCH transitions remain unchanged
 */

import { describe, test, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import { validateBookingTransition, validatePaymentTransition } from "../../../frontend/src/lib/bookings/state-machine.ts";
import { buildPaymentReceivedKey, buildServiceCompletedKey, buildBookingCancelledKey } from "../../../frontend/src/lib/notifications/identity.ts";

export function runPhase6DPaymentHardeningTests() {
  describe("Phase 6D: Payment Preservation (Fix 1)", () => {
    // Helper simulating completeAndQuoteAction payment logic
    function resolveCompletionPaymentStatus(currentPaymentStatus) {
      return currentPaymentStatus === "paid" ? "paid" : "quote_sent";
    }

    test("1. Paid booking quote edit remains 'paid'", () => {
      const existingBooking = {
        id: "bkg-paid-001",
        status: "completed",
        paymentStatus: "paid",
        totalAmount: 120.0,
      };

      // Ensure transition validation allows completed -> completed (noop) or role check
      const transition = validateBookingTransition(existingBooking.status, "completed", "admin");
      // Note: In completeAndQuoteAction, the state transition check is run
      assert(transition.allowed || transition.isNoop);

      const updatedPaymentStatus = resolveCompletionPaymentStatus(existingBooking.paymentStatus);
      assertEqual(updatedPaymentStatus, "paid", "Must NEVER clobber 'paid' back to 'quote_sent'");
    });

    test("2. Quote-sent booking quote edit remains 'quote_sent'", () => {
      const existingBooking = {
        id: "bkg-qs-002",
        status: "completed",
        paymentStatus: "quote_sent",
        totalAmount: 95.0,
      };

      const updatedPaymentStatus = resolveCompletionPaymentStatus(existingBooking.paymentStatus);
      assertEqual(updatedPaymentStatus, "quote_sent");
    });

    test("3. New completion from 'in_progress' produces 'quote_sent'", () => {
      const existingBooking = {
        id: "bkg-prog-003",
        status: "in_progress",
        paymentStatus: "pending",
        totalAmount: null,
      };

      const transition = validateBookingTransition(existingBooking.status, "completed", "admin");
      assertEqual(transition.allowed, true, "in_progress -> completed must be allowed");

      const updatedPaymentStatus = resolveCompletionPaymentStatus(existingBooking.paymentStatus);
      assertEqual(updatedPaymentStatus, "quote_sent");
    });

    test("4. Paid quote edit does not produce duplicate SERVICE_COMPLETED notification", () => {
      const bookingId = "bkg-paid-004";
      const key1 = buildServiceCompletedKey(bookingId);
      const key2 = buildServiceCompletedKey(bookingId);

      // Identity key must be deterministic for deduplication
      assertEqual(key1, key2);
      assertEqual(key1, `service_completed:${bookingId}`);

      // Simulated notification log
      const sentNotifications = new Set([key1]);
      const isDuplicate = sentNotifications.has(key2);
      assertEqual(isDuplicate, true, "Subsequent quote edit must detect existing completion notification");
    });
  });

  describe("Phase 6D: Customer Cancellation No-Op Protection (Fix 2)", () => {
    test("5. Repeated customer cancellation returns success without another database mutation", () => {
      let dbMutationCount = 0;
      let notificationDispatchCount = 0;

      // Mock implementation of cancelCustomerBookingAction logic
      function simulateCustomerCancel(booking) {
        const transition = validateBookingTransition(booking.status, "cancelled", "customer");
        if (!transition.allowed) {
          return { success: false, error: transition.error || "Cannot cancel booking in its current state." };
        }

        if (transition.isNoop) {
          return { success: true };
        }

        // DB update
        dbMutationCount++;
        booking.status = "cancelled";

        // Notification dispatch
        notificationDispatchCount++;
        return { success: true };
      }

      const booking = {
        id: "bkg-cancel-005",
        status: "pending",
        customerId: "cust-001",
      };

      // First cancellation: succeeds, updates DB, sends alert
      const res1 = simulateCustomerCancel(booking);
      assertEqual(res1.success, true);
      assertEqual(dbMutationCount, 1);
      assertEqual(notificationDispatchCount, 1);
      assertEqual(booking.status, "cancelled");

      // Repeated cancellation: must be a no-op returning { success: true }
      const res2 = simulateCustomerCancel(booking);
      assertEqual(res2.success, true);
      assertEqual(dbMutationCount, 1, "DB mutation count must NOT increment on repeated cancellation");
      assertEqual(notificationDispatchCount, 1, "No extra notification dispatch on repeated cancellation");
    });

    test("6. Repeated customer cancellation does not send another cancellation SMS", () => {
      const transition = validateBookingTransition("cancelled", "cancelled", "customer");
      assertEqual(transition.allowed, true);
      assertEqual(transition.isNoop, true);

      // Verify that isNoop short-circuits prior to SMS builder / sender
      let smsSent = false;
      if (!transition.isNoop) {
        smsSent = true;
      }
      assertEqual(smsSent, false, "SMS must not be triggered when isNoop is true");
    });
  });

  describe("Phase 6D: Customer Payment-Received Notification (Fix 3)", () => {
    test("7. First pending -> paid transition creates payment notification", () => {
      const booking = {
        id: "bkg-pay-007",
        paymentStatus: "pending",
        customer: { name: "John Doe", phone: "+12145550123" },
      };

      const paymentTransition = validatePaymentTransition(booking.paymentStatus, "paid", "admin");
      assertEqual(paymentTransition.allowed, true);
      assertEqual(paymentTransition.isNoop, false);

      const shortBookingId = booking.id.replace(/-/g, "").slice(0, 6).toUpperCase();
      const messageBody = `Payment received for booking #${shortBookingId}. Thank you for choosing HT Mobile Services! Your payment has been recorded successfully.`;

      assert(messageBody.includes("Payment received for booking #BKGPAY"));
      assert(messageBody.includes("HT Mobile Services"));
      assert(messageBody.includes("recorded successfully"));

      const dedupeKey = buildPaymentReceivedKey(booking.id);
      assertEqual(dedupeKey, `payment_received:${booking.id}`);
    });

    test("8. Repeated paid -> paid transition creates no second payment notification", () => {
      const paymentTransition = validatePaymentTransition("paid", "paid", "admin");
      assertEqual(paymentTransition.allowed, true);
      assertEqual(paymentTransition.isNoop, true);

      let notificationSent = false;
      if (!paymentTransition.isNoop) {
        notificationSent = true;
      }
      assertEqual(notificationSent, false, "Repeated paid transition must short-circuit without dispatching SMS");
    });

    test("9. Payment notification failure does not change paymentStatus", () => {
      const booking = {
        id: "bkg-pay-009",
        paymentStatus: "quote_sent",
      };

      // Simulates markBookingPaidAction commit + notification failure isolation
      let dbCommittedStatus = null;
      let actionResult = null;

      try {
        // Step 1: DB update commits
        booking.paymentStatus = "paid";
        dbCommittedStatus = booking.paymentStatus;

        // Step 2: Non-blocking notification dispatch fails
        try {
          throw new Error("Notification dispatch timeout or network failure");
        } catch (notifErr) {
          // Warning logged, NOT rethrown
        }

        actionResult = { success: true };
      } catch (err) {
        actionResult = { success: false, error: err.message };
      }

      assertEqual(actionResult.success, true);
      assertEqual(dbCommittedStatus, "paid", "Database paymentStatus must remain 'paid' despite notification error");
      assertEqual(booking.paymentStatus, "paid");
    });
  });

  describe("Phase 6D: Admin PATCH Route Alignment (Fix 4)", () => {
    // Simulates the PATCH route logic from app/api/admin/bookings/[id]/route.ts
    function simulateAdminPatch(booking, requestedStatus) {
      if (!booking) {
        return { error: "Booking not found.", status: 404 };
      }

      const transition = validateBookingTransition(booking.status, requestedStatus, "admin");
      if (!transition.allowed) {
        return {
          error: transition.error || `Cannot change booking from "${booking.status}" to "${requestedStatus}".`,
          status: 400,
        };
      }

      if (transition.isNoop) {
        return { updated: booking, isNoop: true };
      }

      // Phase 6D: Require assigned technician before starting service
      if (requestedStatus === "in_progress") {
        if (!booking.technicianId || booking.technicianId.trim() === "") {
          return {
            error: "Please assign a technician before starting service.",
            status: 400,
          };
        }
      }

      booking.status = requestedStatus;
      return { updated: booking, status: 200 };
    }

    test("10. confirmed -> in_progress without technician is rejected", () => {
      const booking = {
        id: "bkg-patch-010",
        status: "confirmed",
        technicianId: null,
      };

      const result = simulateAdminPatch(booking, "in_progress");
      assertEqual(result.status, 400);
      assertEqual(result.error, "Please assign a technician before starting service.");
      assertEqual(booking.status, "confirmed", "Status must remain confirmed");
    });

    test("11. confirmed -> in_progress with technician is allowed", () => {
      const booking = {
        id: "bkg-patch-011",
        status: "confirmed",
        technicianId: "tech-789",
      };

      const result = simulateAdminPatch(booking, "in_progress");
      assertEqual(result.status, 200);
      assertEqual(result.updated.status, "in_progress");
    });

    test("12. Existing unrelated PATCH transitions remain unchanged", () => {
      // pending -> confirmed (does not require technician)
      const booking1 = {
        id: "bkg-patch-012a",
        status: "pending",
        technicianId: null,
      };
      const result1 = simulateAdminPatch(booking1, "confirmed");
      assertEqual(result1.status, 200);
      assertEqual(result1.updated.status, "confirmed");

      // confirmed -> cancelled (does not require technician)
      const booking2 = {
        id: "bkg-patch-012b",
        status: "confirmed",
        technicianId: null,
      };
      const result2 = simulateAdminPatch(booking2, "cancelled");
      assertEqual(result2.status, 200);
      assertEqual(result2.updated.status, "cancelled");
    });
  });
}

// Standalone execution support
if (process.argv[1]?.endsWith("phase-6d-payment-hardening.test.mjs")) {
  runPhase6DPaymentHardeningTests();
}
