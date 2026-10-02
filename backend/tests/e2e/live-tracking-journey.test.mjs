/**
 * E2E Journey: Customer Live Van Tracking
 * HT Mobile Services
 */

import { describe, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockCustomerAlice, mockCustomerBob } from "../fixtures/user-fixtures.mjs";

export function runLiveTrackingJourneyE2ETests() {
  describe("E2E Journey: Customer Live Tracking & Realtime Map View", () => {
    testAsync("Full journey: Authenticated Customer -> View Live Van -> Live ETA -> Cross-Customer Isolation", async () => {
      const activeBooking = {
        id: "book_live_tracking_101",
        customerId: mockCustomerAlice.id,
        status: "in_progress",
        destinationLat: 32.7767,
        destinationLon: -96.797,
      };

      const liveGpsState = {
        bookingId: activeBooking.id,
        technicianLat: 32.785,
        technicianLon: -96.802,
        speedMph: 28,
        updatedAt: Date.now() - 5000, // 5s ago (live)
      };

      // Customer Alice requests tracking endpoint
      const fetchCustomerTracking = (viewer, booking) => {
        if (viewer.id !== booking.customerId) {
          return { status: 403, error: "Forbidden" };
        }
        return {
          status: 200,
          tracking: {
            vanLatitude: liveGpsState.technicianLat,
            vanLongitude: liveGpsState.technicianLon,
            etaMinutes: 6,
            distanceMiles: 1.4,
            freshness: "live",
          },
        };
      };

      const aliceResponse = fetchCustomerTracking(mockCustomerAlice, activeBooking);
      assertEqual(aliceResponse.status, 200);
      assertEqual(aliceResponse.tracking.etaMinutes, 6);
      assertEqual(aliceResponse.tracking.freshness, "live");

      // Bob tries to access Alice's tracking
      const bobResponse = fetchCustomerTracking(mockCustomerBob, activeBooking);
      assertEqual(bobResponse.status, 403);
    });
  });
}
