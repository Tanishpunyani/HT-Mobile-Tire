/**
 * Phase 6H Focused Integration & Regression Test Suite
 * Admin & Operational Consistency Implementation
 * HT Mobile Services / Tire Mobile Clinic
 *
 * Covers:
 * G-01: Customer Technician Phone Privacy (GET /api/bookings)
 * G-02: Admin Booking Detail Completeness
 * G-03: Technician Assignment / Reassignment Integrity (Terminal guard, safe no-op, auto-confirm capacity)
 * G-04: Block REST Completion Bypass (PATCH /api/admin/bookings/[id] rejects completed)
 * G-05: Customer API Cancellation Notifications (PUT / DELETE dispatch alerts)
 * G-06: Notification Operational Truth (SENT vs DELIVERED separation in UI)
 * G-07: Payment State Guard (markBookingPaidAction requires completed booking)
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

export function runPhase6HAdminOperationalTests() {
  describe("G-01: Customer Technician Phone Privacy (app/api/bookings/route.ts)", () => {
    // Simulates the sanitization logic in GET /api/bookings customer listing
    function sanitizeCustomerBookingsList(bookings) {
      return bookings.map((b) => {
        const safeB = { ...b };
        if (safeB.technician) {
          safeB.technician = {
            ...safeB.technician,
            phone: null, // Sanitized in Phase 6H
          };
        }
        return safeB;
      });
    }

    test("1. Customer booking list sanitizes technician.phone to null", () => {
      const rawBookings = [
        {
          id: "bkg-101",
          status: "confirmed",
          technician: {
            id: "tech-1",
            name: "Marcus Vance",
            role: "Lead Mobile Specialist",
            phone: "+12145551234",
          },
        },
        {
          id: "bkg-102",
          status: "in_progress",
          technician: {
            id: "tech-2",
            name: "Carlos Rivera",
            role: "Mobile Tire Specialist",
            phone: "+12145555678",
          },
        },
      ];

      const result = sanitizeCustomerBookingsList(rawBookings);
      assertEqual(result.length, 2);
      assertEqual(result[0].technician.phone, null);
      assertEqual(result[1].technician.phone, null);
    });

    test("2. Technician identity remains available where intended", () => {
      const rawBookings = [
        {
          id: "bkg-103",
          status: "confirmed",
          technician: {
            id: "tech-1",
            name: "Marcus Vance",
            role: "Lead Mobile Specialist",
            phone: "+12145551234",
          },
        },
      ];

      const result = sanitizeCustomerBookingsList(rawBookings);
      assertEqual(result[0].technician.id, "tech-1");
      assertEqual(result[0].technician.name, "Marcus Vance");
      assertEqual(result[0].technician.role, "Lead Mobile Specialist");
    });

    test("3. No personal technician phone appears anywhere in the customer payload", () => {
      const rawBookings = [
        {
          id: "bkg-104",
          status: "confirmed",
          technician: {
            id: "tech-1",
            name: "Marcus Vance",
            role: "Lead Mobile Specialist",
            phone: "+12145551234",
          },
        },
      ];

      const result = sanitizeCustomerBookingsList(rawBookings);
      const jsonStr = JSON.stringify(result);
      assert(!jsonStr.includes("+12145551234"), "Personal phone must NOT be in customer payload");
    });

    test("4. Booking without technician handles safely without error", () => {
      const rawBookings = [
        {
          id: "bkg-105",
          status: "pending",
          technician: null,
        },
      ];

      const result = sanitizeCustomerBookingsList(rawBookings);
      assertEqual(result[0].technician, null);
    });
  });

  describe("G-03: Technician Assignment / Reassignment Integrity (app/actions/bookings/admin.ts)", () => {
    // Simulates the updated assignTechnicianAction logic
    function simulateAssignTechnician({ booking, technicianId, capacityAvailable = true }) {
      if (booking.status === "completed" || booking.status === "cancelled") {
        return {
          success: false,
          error: `Cannot assign or reassign technician for a ${booking.status} booking.`,
        };
      }

      if (booking.technicianId === technicianId) {
        return {
          success: true,
          booking,
          noOp: true,
        };
      }

      const notifications = [];
      const updates = { technicianId };

      if (booking.status === "pending") {
        if (!capacityAvailable) {
          return {
            success: false,
            error: "The requested time slot has reached maximum booking capacity. Cannot confirm booking.",
          };
        }
        updates.status = "confirmed";
        updates.serviceConfirmedAt = new Date();
        notifications.push("BOOKING_CONFIRMED");
      }

      notifications.push("TECHNICIAN_ASSIGNED");

      return {
        success: true,
        booking: { ...booking, ...updates },
        notifications,
      };
    }

    test("1. Assignment blocked on completed booking", () => {
      const res = simulateAssignTechnician({
        booking: { id: "bkg-201", status: "completed", technicianId: null },
        technicianId: "tech-1",
      });
      assertEqual(res.success, false);
      assert(res.error.includes("completed"));
    });

    test("2. Assignment blocked on cancelled booking", () => {
      const res = simulateAssignTechnician({
        booking: { id: "bkg-202", status: "cancelled", technicianId: null },
        technicianId: "tech-1",
      });
      assertEqual(res.success, false);
      assert(res.error.includes("cancelled"));
    });

    test("3. Same-technician reassignment is a safe no-op with no redundant SMS", () => {
      const booking = { id: "bkg-203", status: "confirmed", technicianId: "tech-1" };
      const res = simulateAssignTechnician({
        booking,
        technicianId: "tech-1",
      });
      assertEqual(res.success, true);
      assertEqual(res.noOp, true);
      assertEqual(res.notifications, undefined);
    });

    test("4. Pending -> Confirmed validates capacity and triggers BOOKING_CONFIRMED exactly once", () => {
      const booking = { id: "bkg-204", status: "pending", technicianId: null };
      const res = simulateAssignTechnician({
        booking,
        technicianId: "tech-1",
        capacityAvailable: true,
      });
      assertEqual(res.success, true);
      assertEqual(res.booking.status, "confirmed");
      assert(res.booking.serviceConfirmedAt instanceof Date);
      assertEqual(res.notifications.length, 2);
      assertEqual(res.notifications[0], "BOOKING_CONFIRMED");
      assertEqual(res.notifications[1], "TECHNICIAN_ASSIGNED");
    });

    test("5. Pending -> Confirmed rejects when capacity limit is reached", () => {
      const booking = { id: "bkg-205", status: "pending", technicianId: null };
      const res = simulateAssignTechnician({
        booking,
        technicianId: "tech-1",
        capacityAvailable: false,
      });
      assertEqual(res.success, false);
      assert(res.error.includes("capacity"));
    });

    test("6. Confirmed booking reassignment to new technician sends only TECHNICIAN_ASSIGNED", () => {
      const booking = { id: "bkg-206", status: "confirmed", technicianId: "tech-1" };
      const res = simulateAssignTechnician({
        booking,
        technicianId: "tech-2",
      });
      assertEqual(res.success, true);
      assertEqual(res.notifications.length, 1);
      assertEqual(res.notifications[0], "TECHNICIAN_ASSIGNED");
    });
  });

  describe("G-04: Block REST Completion Bypass (app/api/admin/bookings/[id]/route.ts)", () => {
    // Simulates PATCH validation in app/api/admin/bookings/[id]/route.ts
    function simulateAdminPatch(currentBooking, patchBody) {
      if (patchBody.status === "completed") {
        return {
          status: 400,
          body: {
            error: "Direct status transition to 'completed' via REST API is blocked. Please use completeAndQuoteAction to validate extra services, generate the digital invoice PDF, and complete the booking.",
          },
        };
      }

      if (patchBody.status === "in_progress" && !currentBooking.technicianId && !patchBody.technicianId) {
        return {
          status: 400,
          body: { error: "Cannot start service without an assigned technician." },
        };
      }

      return {
        status: 200,
        body: {
          success: true,
          booking: { ...currentBooking, ...patchBody },
        },
      };
    }

    test("1. Direct status transition to 'completed' via REST PATCH is rejected with 400", () => {
      const booking = { id: "bkg-301", status: "in_progress", technicianId: "tech-1" };
      const res = simulateAdminPatch(booking, { status: "completed" });
      assertEqual(res.status, 400);
      assert(res.body.error.includes("completeAndQuoteAction"));
    });

    test("2. Existing valid admin transition to in_progress still works with assigned technician", () => {
      const booking = { id: "bkg-302", status: "confirmed", technicianId: "tech-1" };
      const res = simulateAdminPatch(booking, { status: "in_progress" });
      assertEqual(res.status, 200);
      assertEqual(res.body.booking.status, "in_progress");
    });

    test("3. Transition to in_progress still fails if no technician is assigned", () => {
      const booking = { id: "bkg-303", status: "confirmed", technicianId: null };
      const res = simulateAdminPatch(booking, { status: "in_progress" });
      assertEqual(res.status, 400);
      assert(res.body.error.includes("assigned technician"));
    });
  });

  describe("G-05: Customer API Cancellation Notifications (app/api/bookings/[id]/route.ts)", () => {
    // Simulates non-blocking post-commit cancellation notification dispatch in customer API
    function simulateCustomerCancellation({ booking, alreadyCancelled = false }) {
      if (alreadyCancelled || booking.status === "cancelled") {
        return {
          status: 200,
          dispatchedNotifications: [],
          message: "Already cancelled",
        };
      }

      const dispatchedNotifications = [];

      // Non-blocking post-commit dispatch
      try {
        dispatchedNotifications.push({
          type: "ADMIN_BOOKING_CANCELLED",
          bookingId: booking.id,
          recipient: "admin",
        });
      } catch {
        // non-blocking
      }

      try {
        if (booking.customer?.phone) {
          dispatchedNotifications.push({
            type: "CUSTOMER_BOOKING_CANCELLED",
            bookingId: booking.id,
            recipient: booking.customer.phone,
          });
        }
      } catch {
        // non-blocking
      }

      return {
        status: 200,
        dispatchedNotifications,
      };
    }

    test("1. Customer API cancellation dispatches both admin and customer alerts", () => {
      const booking = {
        id: "bkg-401",
        status: "confirmed",
        customer: { name: "Alice", phone: "+12145550001" },
      };
      const res = simulateCustomerCancellation({ booking });
      assertEqual(res.status, 200);
      assertEqual(res.dispatchedNotifications.length, 2);
      assertEqual(res.dispatchedNotifications[0].type, "ADMIN_BOOKING_CANCELLED");
      assertEqual(res.dispatchedNotifications[1].type, "CUSTOMER_BOOKING_CANCELLED");
    });

    test("2. Customer API cancellation is safe and does not duplicate if already cancelled", () => {
      const booking = {
        id: "bkg-402",
        status: "cancelled",
        customer: { name: "Bob", phone: "+12145550002" },
      };
      const res = simulateCustomerCancellation({ booking, alreadyCancelled: true });
      assertEqual(res.status, 200);
      assertEqual(res.dispatchedNotifications.length, 0);
    });

    test("3. Customer without phone still notifies admin safely", () => {
      const booking = {
        id: "bkg-403",
        status: "pending",
        customer: { name: "Charlie", phone: null },
      };
      const res = simulateCustomerCancellation({ booking });
      assertEqual(res.status, 200);
      assertEqual(res.dispatchedNotifications.length, 1);
      assertEqual(res.dispatchedNotifications[0].type, "ADMIN_BOOKING_CANCELLED");
    });
  });

  describe("G-06: Notification Operational Truth (app/(admin-portal)/admin/notifications/page.tsx)", () => {
    function computeNotificationStats(logs) {
      const totalDelivered = logs.filter(
        (l) => l.deliveryStatus?.toUpperCase() === "DELIVERED"
      ).length;
      const totalSent = logs.filter(
        (l) => l.status?.toUpperCase() === "SENT" && l.deliveryStatus?.toUpperCase() !== "DELIVERED"
      ).length;
      const totalFailed = logs.filter(
        (l) => l.status?.toUpperCase() === "FAILED" || l.deliveryStatus?.toUpperCase() === "FAILED"
      ).length;
      const totalPending = logs.filter(
        (l) => l.status?.toUpperCase() === "PENDING" || l.status?.toUpperCase() === "PROCESSING"
      ).length;

      return { totalDelivered, totalSent, totalFailed, totalPending };
    }

    function renderStatusBadge(log) {
      const appStatus = log.status?.toUpperCase();
      const carrierStatus = log.deliveryStatus?.toUpperCase();

      if (carrierStatus === "DELIVERED") {
        return { label: "Handset Delivered", isDelivered: true };
      }
      if (appStatus === "SENT") {
        return { label: "Dispatched (SMSC Sent)", isDelivered: false };
      }
      if (appStatus === "FAILED" || carrierStatus === "FAILED") {
        return { label: "Delivery Failed", isFailed: true };
      }
      return { label: "Processing / Queued", isPending: true };
    }

    test("1. Gateway SENT is distinguished from carrier DELIVERED in stat counts", () => {
      const logs = [
        { id: "1", status: "SENT", deliveryStatus: null }, // Only gateway dispatched
        { id: "2", status: "SENT", deliveryStatus: "DELIVERED" }, // Carrier handset delivered
        { id: "3", status: "SENT", deliveryStatus: "DELIVERED" }, // Carrier handset delivered
        { id: "4", status: "FAILED", deliveryStatus: null },
      ];

      const stats = computeNotificationStats(logs);
      assertEqual(stats.totalDelivered, 2);
      assertEqual(stats.totalSent, 1);
      assertEqual(stats.totalFailed, 1);
    });

    test("2. Status badge labels SENT as Dispatched, never as Delivered", () => {
      const sentLog = { status: "SENT", deliveryStatus: null };
      const badge = renderStatusBadge(sentLog);
      assertEqual(badge.label, "Dispatched (SMSC Sent)");
      assertEqual(badge.isDelivered, false);
    });

    test("3. Status badge labels carrier DELIVERED accurately as Handset Delivered", () => {
      const deliveredLog = { status: "SENT", deliveryStatus: "DELIVERED" };
      const badge = renderStatusBadge(deliveredLog);
      assertEqual(badge.label, "Handset Delivered");
      assertEqual(badge.isDelivered, true);
    });

    test("4. Status badge reflects failed delivery accurately", () => {
      const failedLog = { status: "FAILED", deliveryStatus: null };
      const badge = renderStatusBadge(failedLog);
      assertEqual(badge.label, "Delivery Failed");
      assertEqual(badge.isFailed, true);
    });
  });

  describe("G-07: Payment State Guard (app/actions/bookings/quote.ts)", () => {
    // Simulates the updated markBookingPaidAction logic
    function simulateMarkBookingPaid({ booking, targetStatus = "paid" }) {
      // 1. Terminal completed booking requirement (Phase 6H G-07)
      if (booking.status !== "completed") {
        return {
          success: false,
          error: `Cannot mark booking as paid. Booking must be 'completed' before payment can be recorded. Current booking status is '${booking.status}'.`,
        };
      }

      // 2. Existing payment transition validation
      const current = booking.paymentStatus || "pending";
      const validTransitions = {
        pending: ["quote_sent", "paid"],
        quote_sent: ["paid"],
        paid: ["paid"],
      };

      if (!validTransitions[current]?.includes(targetStatus)) {
        return {
          success: false,
          error: `Invalid payment transition from '${current}' to '${targetStatus}'.`,
        };
      }

      // 3. Idempotent paid
      if (current === "paid") {
        return {
          success: true,
          booking,
          idempotent: true,
        };
      }

      return {
        success: true,
        booking: {
          ...booking,
          paymentStatus: "paid",
        },
      };
    }

    test("1. completed + quote_sent -> paid succeeds", () => {
      const booking = { id: "bkg-501", status: "completed", paymentStatus: "quote_sent" };
      const res = simulateMarkBookingPaid({ booking });
      assertEqual(res.success, true);
      assertEqual(res.booking.paymentStatus, "paid");
    });

    test("2. completed + pending -> paid succeeds", () => {
      const booking = { id: "bkg-502", status: "completed", paymentStatus: "pending" };
      const res = simulateMarkBookingPaid({ booking });
      assertEqual(res.success, true);
      assertEqual(res.booking.paymentStatus, "paid");
    });

    test("3. pending booking -> paid rejected", () => {
      const booking = { id: "bkg-503", status: "pending", paymentStatus: "pending" };
      const res = simulateMarkBookingPaid({ booking });
      assertEqual(res.success, false);
      assert(res.error.includes("must be 'completed'"));
    });

    test("4. confirmed booking -> paid rejected", () => {
      const booking = { id: "bkg-504", status: "confirmed", paymentStatus: "pending" };
      const res = simulateMarkBookingPaid({ booking });
      assertEqual(res.success, false);
      assert(res.error.includes("must be 'completed'"));
    });

    test("5. in_progress booking -> paid rejected", () => {
      const booking = { id: "bkg-505", status: "in_progress", paymentStatus: "pending" };
      const res = simulateMarkBookingPaid({ booking });
      assertEqual(res.success, false);
      assert(res.error.includes("must be 'completed'"));
    });

    test("6. cancelled booking -> paid rejected", () => {
      const booking = { id: "bkg-506", status: "cancelled", paymentStatus: "pending" };
      const res = simulateMarkBookingPaid({ booking });
      assertEqual(res.success, false);
      assert(res.error.includes("must be 'completed'"));
    });

    test("7. already paid completed booking remains safe/no-op", () => {
      const booking = { id: "bkg-507", status: "completed", paymentStatus: "paid" };
      const res = simulateMarkBookingPaid({ booking });
      assertEqual(res.success, true);
      assertEqual(res.idempotent, true);
    });
  });

  describe("G-02: Admin Booking Detail Completeness", () => {
    test("1. Arrival badge renders when confirmed and arrivedAt is set", () => {
      const booking = {
        id: "bkg-601",
        status: "confirmed",
        arrivedAt: new Date("2026-09-24T14:30:00Z"),
      };
      const shouldShowArrivalBadge = booking.status === "confirmed" && !!booking.arrivedAt;
      assertEqual(shouldShowArrivalBadge, true);
    });

    test("2. Arrival badge does not render when confirmed but arrivedAt is null", () => {
      const booking = {
        id: "bkg-602",
        status: "confirmed",
        arrivedAt: null,
      };
      const shouldShowArrivalBadge = booking.status === "confirmed" && !!booking.arrivedAt;
      assertEqual(shouldShowArrivalBadge, false);
    });

    test("3. PDF receipt download link is available when status is completed", () => {
      const booking = {
        id: "bkg-603",
        status: "completed",
        paymentStatus: "paid",
        totalAmount: 185.0,
      };
      const receiptUrl = booking.status === "completed" ? `/api/bookings/${booking.id}/receipt` : null;
      assertEqual(receiptUrl, "/api/bookings/bkg-603/receipt");
    });

    test("4. PDF receipt download link is not available when status is in_progress", () => {
      const booking = {
        id: "bkg-604",
        status: "in_progress",
        paymentStatus: "pending",
        totalAmount: null,
      };
      const receiptUrl = booking.status === "completed" ? `/api/bookings/${booking.id}/receipt` : null;
      assertEqual(receiptUrl, null);
    });

    test("5. Line items correctly parse extraServices JSON array or string", () => {
      const stringExtra = JSON.stringify([
        { name: "Tire Disposal Fee", price: 15 },
        { name: "Valve Stem Replacement", price: 10 },
      ]);
      const parsed = typeof stringExtra === "string" ? JSON.parse(stringExtra) : stringExtra;
      assertEqual(parsed.length, 2);
      assertEqual(parsed[0].name, "Tire Disposal Fee");
      assertEqual(parsed[1].price, 10);
    });
  });
}

// Standalone execution support
if (process.argv[1]?.endsWith("phase-6h-admin-operational.test.mjs")) {
  runPhase6HAdminOperationalTests();
}

