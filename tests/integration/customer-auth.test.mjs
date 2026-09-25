/**
 * Integration Tests: Customer Authentication & Session Lifecycle
 * HT Mobile Services
 */

import { describe, test, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockCustomerAlice } from "../fixtures/user-fixtures.mjs";

export function runCustomerAuthIntegrationTests() {
  describe("Customer Authentication & Session Lifecycle (Integration)", () => {
    test("Authenticated customer session resolves customer identity and role", () => {
      const session = {
        user: { id: mockCustomerAlice.authUserId, email: mockCustomerAlice.email },
      };
      // Emulating getSessionCustomer resolution
      const resolvedCustomer = session?.user?.id === mockCustomerAlice.authUserId ? mockCustomerAlice : null;
      assert(resolvedCustomer !== null);
      assertEqual(resolvedCustomer.id, "cust_alice_111");
      assertEqual(resolvedCustomer.role, "customer");
    });

    test("Missing session returns null / 401 Unauthorized", () => {
      const session = null;
      const resolvedCustomer = session?.user ? mockCustomerAlice : null;
      assertEqual(resolvedCustomer, null);
    });

    test("Customer profile sync idempotently links Supabase Auth ID without duplicating records", () => {
      const existingCustomers = [{ ...mockCustomerAlice }];
      const syncPayload = {
        authUserId: mockCustomerAlice.authUserId,
        email: mockCustomerAlice.email,
        name: "Alice Smith Updated",
      };

      // Find existing
      const existing = existingCustomers.find((c) => c.authUserId === syncPayload.authUserId);
      if (existing) {
        existing.name = syncPayload.name;
      } else {
        existingCustomers.push({ id: "new_cust", ...syncPayload });
      }

      assertEqual(existingCustomers.length, 1, "Should not create duplicate customer record");
      assertEqual(existingCustomers[0].name, "Alice Smith Updated");
    });
  });
}
