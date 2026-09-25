/**
 * Unit Tests: Deterministic Notification Identity & Event Key Generator
 * HT Mobile Services / Phase 3A
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import {
  buildNotificationEventKey,
  buildBookingCreatedAdminKey,
  buildBookingConfirmedKey,
  buildTechnicianAssignedKey,
  buildTechnicianEnRouteKey,
  buildTechnicianArrivedKey,
  buildServiceCompletedKey,
  buildEmergencyAlertKey,
  buildContactAlertKey,
  buildBookingCancelledKey,
  buildPaymentReceivedKey,
} from "../../lib/notifications/identity.ts";

export function runNotificationIdentityUnitTests() {
  describe("Notification Identity: Pure Determinism", () => {
    test("Same entity ID + event ALWAYS produces identical key", () => {
      const key1 = buildNotificationEventKey({
        eventName: "booking_confirmation",
        entityId: "bkg-12345",
      });
      const key2 = buildNotificationEventKey({
        eventName: "booking_confirmation",
        entityId: "bkg-12345",
      });

      assertEqual(key1, key2);
      assertEqual(key1, "booking_confirmation:bkg-12345");
    });

    test("Different entity IDs produce distinct keys", () => {
      const key1 = buildBookingConfirmedKey("bkg-001");
      const key2 = buildBookingConfirmedKey("bkg-002");

      assert(key1 !== key2, "Different entities must produce distinct keys");
      assertEqual(key1, "booking_confirmation:bkg-001");
      assertEqual(key2, "booking_confirmation:bkg-002");
    });

    test("Key generation contains no Date.now(), Math.random(), or non-deterministic state", () => {
      const keys = new Set();
      for (let i = 0; i < 100; i++) {
        keys.add(buildBookingConfirmedKey("constant-booking-id"));
      }

      assertEqual(keys.size, 1, "Must generate exactly 1 unique key across 100 iterations");
    });
  });

  describe("Notification Identity: Event Key Catalog Helpers", () => {
    test("buildBookingCreatedAdminKey formats correctly", () => {
      assertEqual(
        buildBookingCreatedAdminKey("bkg-999"),
        "booking_created_admin:bkg-999"
      );
    });

    test("buildTechnicianAssignedKey includes tech qualifier when provided", () => {
      const keyWithTech = buildTechnicianAssignedKey("bkg-123", "tech-456");
      assertEqual(keyWithTech, "technician_assigned:bkg-123:tech-456");

      const keyWithoutTech = buildTechnicianAssignedKey("bkg-123");
      assertEqual(keyWithoutTech, "technician_assigned:bkg-123");
    });

    test("buildTechnicianEnRouteKey formats correctly", () => {
      assertEqual(
        buildTechnicianEnRouteKey("bkg-123"),
        "technician_en_route:bkg-123"
      );
    });

    test("buildTechnicianArrivedKey formats correctly", () => {
      assertEqual(
        buildTechnicianArrivedKey("bkg-123"),
        "technician_arrived:bkg-123"
      );
    });

    test("buildServiceCompletedKey formats correctly", () => {
      assertEqual(
        buildServiceCompletedKey("bkg-123"),
        "service_completed:bkg-123"
      );
    });

    test("buildEmergencyAlertKey formats correctly", () => {
      assertEqual(
        buildEmergencyAlertKey("emg-777"),
        "emergency_alert:emg-777"
      );
    });

    test("buildContactAlertKey formats correctly", () => {
      assertEqual(
        buildContactAlertKey("cnt-888"),
        "contact_alert:cnt-888"
      );
    });

    test("buildBookingCancelledKey distinguishes cancellation actor", () => {
      const customerCancel = buildBookingCancelledKey("bkg-100", "customer");
      const adminCancel = buildBookingCancelledKey("bkg-100", "admin");

      assertEqual(customerCancel, "booking_cancelled:bkg-100:customer");
      assertEqual(adminCancel, "booking_cancelled:bkg-100:admin");
      assert(customerCancel !== adminCancel, "Actor qualifiers must differentiate keys");
    });

    test("buildPaymentReceivedKey formats correctly", () => {
      assertEqual(
        buildPaymentReceivedKey("bkg-456"),
        "payment_received:bkg-456"
      );
    });
  });
}

// Direct execution support
if (process.argv[1]?.endsWith("notification-identity.test.mjs")) {
  runNotificationIdentityUnitTests();
}
