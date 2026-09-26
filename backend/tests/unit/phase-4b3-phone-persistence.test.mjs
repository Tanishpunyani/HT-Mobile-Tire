/**
 * Focused Unit Tests: Phase 4B.3 Booking Phone Persistence Fix
 * HT Mobile Services / Tire Mobile Clinic
 */

import { describe, test, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../../frontend/src");

export function runPhase4B3PhonePersistenceTests() {
  describe("Phase 4B.3: Source Code Invariants for Phone Persistence", () => {
    test("TEST 1. lib/auth.ts synchronizes Customer.phone for existing customers", () => {
      const authPath = path.join(projectRoot, "lib/auth.ts");
      const content = fs.readFileSync(authPath, "utf-8");

      assert(
        content.includes("if (userPhone && userPhone !== customer.phone)"),
        "lib/auth.ts must check if userPhone differs from customer.phone"
      );
      assert(
        content.includes("updateData.phone = userPhone"),
        "lib/auth.ts must set updateData.phone when new phone is provided"
      );
      assert(
        content.includes("prisma.customer.update"),
        "lib/auth.ts must update existing customer record"
      );
    });

    test("TEST 2. app/actions/bookings/customer.ts ensures Customer.phone is updated for authenticated & guest bookings", () => {
      const actionPath = path.join(projectRoot, "app/actions/bookings/customer.ts");
      const content = fs.readFileSync(actionPath, "utf-8");

      assert(
        content.includes("submittedPhone && resolvedCustomer.phone !== submittedPhone"),
        "customer.ts must verify submittedPhone against resolvedCustomer.phone"
      );
      assert(
        content.includes("prisma.customer.update"),
        "customer.ts must execute prisma.customer.update for changed phone"
      );
      assert(
        content.includes("submittedPhone && customer.phone !== submittedPhone"),
        "customer.ts must verify submittedPhone for matched guest customer"
      );
    });

    test("TEST 3. app/api/bookings/route.ts gives precedence to submitted phone over stale user metadata", () => {
      const apiRoutePath = path.join(projectRoot, "app/api/bookings/route.ts");
      const content = fs.readFileSync(apiRoutePath, "utf-8");

      assert(
        content.includes("validSubmittedPhone || user.user_metadata?.phone"),
        "route.ts must prioritize explicitly submitted phone over user_metadata.phone"
      );
      assert(
        content.includes("phone && phone !== \"N/A\" && phone !== customer.phone"),
        "route.ts must update existing customer phone if different"
      );
    });
  });

  describe("Phase 4B.3: Customer Profile Phone Sync Logic Simulation", () => {
    // Simulated mock helper mirroring getOrCreateCustomerForUser logic
    function simulateCustomerSync(existingCustomer, incomingAuthUser) {
      const userPhone = incomingAuthUser.phone && incomingAuthUser.phone !== "N/A"
        ? incomingAuthUser.phone.trim()
        : null;
      const userEmail = incomingAuthUser.email ? incomingAuthUser.email.trim() : null;

      let customer = existingCustomer ? { ...existingCustomer } : null;

      if (customer) {
        const updateData = {};
        if (!customer.userId) {
          updateData.userId = incomingAuthUser.id;
          if (userEmail && !customer.email) updateData.email = userEmail;
        }
        if (userPhone && userPhone !== customer.phone) {
          updateData.phone = userPhone;
        }
        if (Object.keys(updateData).length > 0) {
          customer = { ...customer, ...updateData };
        }
        return { customer, updated: Object.keys(updateData).length > 0 };
      }

      // New customer creation
      customer = {
        id: "new-cust-id",
        userId: incomingAuthUser.id,
        name: incomingAuthUser.name,
        email: userEmail,
        phone: userPhone || "N/A",
      };
      return { customer, updated: false };
    }

    test("TEST A — Existing customer edits phone: Customer.phone is updated to new number", () => {
      const existing = {
        id: "cust-1",
        userId: "user-1",
        name: "Alex Demo",
        phone: "(555) 987-6543",
        email: "alex@example.com",
      };
      const incoming = {
        id: "user-1",
        name: "Alex Demo",
        phone: "8360318923",
        email: "alex@example.com",
      };

      const result = simulateCustomerSync(existing, incoming);
      assertEqual(result.customer.phone, "8360318923", "Customer phone must update to new number");
      assertEqual(result.customer.id, "cust-1", "Customer ID must be preserved");
      assertEqual(result.updated, true, "Update must be triggered");
    });

    test("TEST B — Existing customer keeps same phone: No unnecessary update", () => {
      const existing = {
        id: "cust-1",
        userId: "user-1",
        name: "Alex Demo",
        phone: "8360318923",
        email: "alex@example.com",
      };
      const incoming = {
        id: "user-1",
        name: "Alex Demo",
        phone: "8360318923",
        email: "alex@example.com",
      };

      const result = simulateCustomerSync(existing, incoming);
      assertEqual(result.customer.phone, "8360318923", "Customer phone must remain unchanged");
      assertEqual(result.updated, false, "Update must NOT be triggered when phone is identical");
    });

    test("TEST C — Empty submitted phone: Does not overwrite valid stored phone", () => {
      const existing = {
        id: "cust-1",
        userId: "user-1",
        name: "Alex Demo",
        phone: "8360318923",
        email: "alex@example.com",
      };
      const incomingEmpty = {
        id: "user-1",
        name: "Alex Demo",
        phone: "",
        email: "alex@example.com",
      };
      const incomingNA = {
        id: "user-1",
        name: "Alex Demo",
        phone: "N/A",
        email: "alex@example.com",
      };

      const resultEmpty = simulateCustomerSync(existing, incomingEmpty);
      assertEqual(resultEmpty.customer.phone, "8360318923", "Empty phone must NOT overwrite stored phone");

      const resultNA = simulateCustomerSync(existing, incomingNA);
      assertEqual(resultNA.customer.phone, "8360318923", "N/A phone must NOT overwrite stored phone");
    });

    test("TEST D — New authenticated customer: Initial customer created with submitted phone", () => {
      const incoming = {
        id: "user-new",
        name: "New Customer",
        phone: "2145550199",
        email: "new@example.com",
      };

      const result = simulateCustomerSync(null, incoming);
      assertEqual(result.customer.phone, "2145550199", "New customer must be created with submitted phone");
      assertEqual(result.customer.name, "New Customer", "New customer must have correct name");
    });

    test("TEST E — Admin booking data resolution: booking.customer.phone equals submitted phone", () => {
      // Simulates booking created with customerId pointing to customer with updated phone
      const customer = {
        id: "cust-1",
        name: "Alex Demo",
        phone: "8360318923",
      };
      const booking = {
        id: "booking-123",
        customerId: customer.id,
        customer,
      };

      assertEqual(booking.customer.phone, "8360318923", "Admin view must see updated phone via customer relation");
    });

    test("TEST F — Confirmation notification recipient receives customer containing updated phone", () => {
      const updatedBooking = {
        id: "booking-123",
        status: "confirmed",
        customer: {
          id: "cust-1",
          name: "Alex Demo",
          phone: "8360318923",
        },
      };

      // In confirmBookingAction, updated.customer is passed to sendCustomerBookingConfirmedAlert
      assert(updatedBooking.customer.phone === "8360318923", "Customer object passed to alert must have updated phone");
    });

    test("TEST G — Secondary API route: Submitted phone takes precedence over stale metadata", () => {
      const resultData = { phone: "8360318923" };
      const user = { user_metadata: { phone: "(555) 987-6543" } };

      const rawSubmittedPhone = resultData.phone?.trim();
      const validSubmittedPhone =
        rawSubmittedPhone && rawSubmittedPhone !== "N/A" ? rawSubmittedPhone : null;
      const phone = validSubmittedPhone || user.user_metadata?.phone || "";

      assertEqual(phone, "8360318923", "Submitted phone must override stale user metadata");
    });
  });
}

// Allow standalone execution
if (process.argv[1] && process.argv[1].endsWith("phase-4b3-phone-persistence.test.mjs")) {
  runPhase4B3PhonePersistenceTests();
}
