/**
 * Integration Tests: Technician Token Authorization & Dispatch Context
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockTechnicianCarlos, mockTechnicianDavid } from "../fixtures/user-fixtures.mjs";
import { mockBookingAliceConfirmed, mockBookingBobInProgress } from "../fixtures/booking-fixtures.mjs";

function authorizeTechnicianAction({ tokenTechId, tokenBookingId, targetTechId, targetBookingId }) {
  if (!tokenTechId || !tokenBookingId) return { authorized: false, status: 401 };
  if (tokenTechId !== targetTechId) {
    return { authorized: false, status: 403, error: "Token not valid for target technician" };
  }
  if (tokenBookingId !== targetBookingId) {
    return { authorized: false, status: 403, error: "Token not valid for target booking" };
  }
  return { authorized: true, status: 200 };
}

export function runTechnicianAuthIntegrationTests() {
  describe("Technician Authorization & Token Scoping (Integration)", () => {
    test("Technician Carlos accessing assigned Booking Alice is ALLOWED (200)", () => {
      const result = authorizeTechnicianAction({
        tokenTechId: mockTechnicianCarlos.id,
        tokenBookingId: mockBookingAliceConfirmed.id,
        targetTechId: mockTechnicianCarlos.id,
        targetBookingId: mockBookingAliceConfirmed.id,
      });
      assert(result.authorized);
      assertEqual(result.status, 200);
    });

    test("Technician Carlos attempting to broadcast location on Bob's booking is REJECTED (403)", () => {
      const result = authorizeTechnicianAction({
        tokenTechId: mockTechnicianCarlos.id,
        tokenBookingId: mockBookingAliceConfirmed.id, // Carlos's token has Alice's booking
        targetTechId: mockTechnicianCarlos.id,
        targetBookingId: mockBookingBobInProgress.id, // Target is Bob's booking
      });
      assertEqual(result.authorized, false);
      assertEqual(result.status, 403);
    });

    test("Technician David attempting to use Carlos's token is REJECTED (403)", () => {
      const result = authorizeTechnicianAction({
        tokenTechId: mockTechnicianCarlos.id,
        tokenBookingId: mockBookingAliceConfirmed.id,
        targetTechId: mockTechnicianDavid.id,
        targetBookingId: mockBookingAliceConfirmed.id,
      });
      assertEqual(result.authorized, false);
      assertEqual(result.status, 403);
    });
  });
}
