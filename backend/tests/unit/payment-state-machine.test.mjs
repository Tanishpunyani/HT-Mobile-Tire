/**
 * Unit Tests: Payment State Machine
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

const VALID_PAYMENT_TRANSITIONS = {
  pending: ["quote_sent", "paid", "cancelled"],
  quote_sent: ["paid", "cancelled"],
  paid: ["refunded"],
  refunded: [],
  cancelled: [],
};

function validatePaymentTransition(currentStatus, targetStatus, role = "admin") {
  if (currentStatus === targetStatus) return { valid: true, isNoOp: true };
  if (role !== "admin") {
    return { valid: false, error: "Only admin/system can transition payment state" };
  }
  const allowed = VALID_PAYMENT_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return { valid: false, error: `Invalid payment transition from ${currentStatus} to ${targetStatus}` };
  }
  return { valid: true, isNoOp: false };
}

export function runPaymentStateMachineTests() {
  describe("Payment State Machine (Unit)", () => {
    test("Pending -> Quote Sent is ALLOWED for admin", () => {
      const res = validatePaymentTransition("pending", "quote_sent", "admin");
      assert(res.valid);
    });

    test("Quote Sent -> Paid is ALLOWED for admin", () => {
      const res = validatePaymentTransition("quote_sent", "paid", "admin");
      assert(res.valid);
    });

    test("Pending -> Paid (direct cash/card on site) is ALLOWED for admin", () => {
      const res = validatePaymentTransition("pending", "paid", "admin");
      assert(res.valid);
    });

    test("Customer cannot directly mutate payment status to Paid", () => {
      const res = validatePaymentTransition("pending", "paid", "customer");
      assertEqual(res.valid, false, "Customer cannot self-mark payment as paid");
    });

    test("Paid -> Pending is REJECTED (invalid regression)", () => {
      const res = validatePaymentTransition("paid", "pending", "admin");
      assertEqual(res.valid, false, "Cannot unpay an invoice back to pending");
    });

    test("Paid -> Refunded is ALLOWED for admin", () => {
      const res = validatePaymentTransition("paid", "refunded", "admin");
      assert(res.valid);
    });
  });
}
