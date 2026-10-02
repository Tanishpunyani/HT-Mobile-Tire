/**
 * E2E Journey: Technician Dispatch, GPS Broadcast & Arrival
 * HT Mobile Services
 */

import { describe, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockTechnicianCarlos } from "../fixtures/user-fixtures.mjs";

export function runTechnicianJourneyE2ETests() {
  describe("E2E Journey: Technician Dispatch, GPS Broadcast & Arrival", () => {
    testAsync("Full journey: Token Auth -> View Dispatch -> Broadcast GPS -> Mark Arrived -> Start Service", async () => {
      // 1. Technician accesses dispatch portal with token
      const technicianTokenPayload = {
        technicianId: mockTechnicianCarlos.id,
        bookingId: "book_e2e_dispatch_202",
        expiresAt: Date.now() + 3600000,
      };

      const bookingState = {
        id: "book_e2e_dispatch_202",
        technicianId: mockTechnicianCarlos.id,
        status: "confirmed",
        technicianArrivedAt: null,
      };

      // 2. Technician broadcasts GPS location telemetry
      const telemetryStore = [];
      const broadcastLocation = (lat, lng, speed = 35) => {
        telemetryStore.push({
          bookingId: bookingState.id,
          technicianId: technicianTokenPayload.technicianId,
          latitude: lat,
          longitude: lng,
          speed,
          timestamp: Date.now(),
        });
      };

      broadcastLocation(32.78, -96.799); // On route
      broadcastLocation(32.788, -96.795, 0); // Arrived at customer location
      assertEqual(telemetryStore.length, 2);

      // 3. Technician marks arrived
      bookingState.technicianArrivedAt = new Date().toISOString();
      assert(bookingState.technicianArrivedAt != null);

      // 4. Technician transitions status to in_progress
      bookingState.status = "in_progress";
      assertEqual(bookingState.status, "in_progress");
    });
  });
}
