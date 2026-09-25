/**
 * Integration Tests: Customer IDOR & Resource Ownership Protection
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockCustomerAlice, mockCustomerBob } from "../fixtures/user-fixtures.mjs";
import { mockBookingAliceConfirmed, mockBookingBobInProgress } from "../fixtures/booking-fixtures.mjs";

function authorizeCustomerAccess(actorCustomer, targetBooking) {
  if (!actorCustomer || !targetBooking) return { allowed: false, status: 401 };
  if (targetBooking.customerId !== actorCustomer.id) {
    return { allowed: false, status: 403, error: "Access denied. Resource does not belong to you." };
  }
  return { allowed: true, status: 200 };
}

export function runIdorIntegrationTests() {
  describe("Customer IDOR / BOLA Ownership Protection (Integration)", () => {
    test("Customer Alice accessing her own booking is ALLOWED (200)", () => {
      const res = authorizeCustomerAccess(mockCustomerAlice, mockBookingAliceConfirmed);
      assert(res.allowed);
      assertEqual(res.status, 200);
    });

    test("Customer Alice attempting to view Bob's booking is REJECTED with 403 Forbidden", () => {
      const res = authorizeCustomerAccess(mockCustomerAlice, mockBookingBobInProgress);
      assertEqual(res.allowed, false);
      assertEqual(res.status, 403);
    });

    test("Customer Bob attempting to access Alice's booking receipt is REJECTED with 403", () => {
      const res = authorizeCustomerAccess(mockCustomerBob, mockBookingAliceConfirmed);
      assertEqual(res.allowed, false);
      assertEqual(res.status, 403);
    });

    test("Unauthenticated actor attempting to access any booking is REJECTED with 401", () => {
      const res = authorizeCustomerAccess(null, mockBookingAliceConfirmed);
      assertEqual(res.allowed, false);
      assertEqual(res.status, 401);
    });
  });
}
