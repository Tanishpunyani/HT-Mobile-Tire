/**
 * Integration Tests: Tracking Privacy & Realtime Telemetry Isolation
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockCustomerAlice, mockCustomerBob } from "../fixtures/user-fixtures.mjs";
import { mockBookingAliceConfirmed } from "../fixtures/booking-fixtures.mjs";
import { mockTelemetryPacket } from "../fixtures/gps-fixtures.mjs";

function getTrackingForViewer(viewer, booking, telemetry) {
  if (!viewer) return { status: 401, error: "Unauthorized" };
  if (viewer.role === "admin") {
    // Admin gets full operational view
    return { status: 200, data: { ...telemetry, fullDetails: true } };
  }
  if (viewer.role === "customer") {
    if (booking.customerId !== viewer.id) {
      return { status: 403, error: "Access denied. Not your booking." };
    }
    // Sanitized customer tracking view
    return {
      status: 200,
      data: {
        bookingId: telemetry.bookingId,
        latitude: telemetry.latitude,
        longitude: telemetry.longitude,
        speed: telemetry.speed,
        updatedAt: telemetry.timestamp,
      },
    };
  }
  return { status: 403, error: "Forbidden" };
}

export function runTrackingPrivacyIntegrationTests() {
  describe("Tracking Privacy & Customer Telemetry Isolation (Integration)", () => {
    test("Customer Alice sees sanitized tracking for her active booking", () => {
      const res = getTrackingForViewer(mockCustomerAlice, mockBookingAliceConfirmed, mockTelemetryPacket);
      assertEqual(res.status, 200);
      assert(res.data.latitude != null);
      assertEqual(res.data.fullDetails, undefined, "Customer should not receive internal raw telemetry");
    });

    test("Customer Bob cannot view tracking for Alice's booking (403)", () => {
      const res = getTrackingForViewer(mockCustomerBob, mockBookingAliceConfirmed, mockTelemetryPacket);
      assertEqual(res.status, 403);
    });

    test("Unauthenticated user cannot view tracking (401)", () => {
      const res = getTrackingForViewer(null, mockBookingAliceConfirmed, mockTelemetryPacket);
      assertEqual(res.status, 401);
    });
  });
}
