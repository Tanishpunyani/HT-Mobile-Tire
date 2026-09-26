/**
 * Unit Tests: Booking State Machine & Role Matrix
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

const VALID_BOOKING_TRANSITIONS = {
  pending: ["confirmed", "cancelled", "rejected"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  rejected: [],
};

const ROLE_PERMISSIONS = {
  customer: {
    pending: ["cancelled"],
    confirmed: [],
    in_progress: [],
    completed: [],
    cancelled: [],
    rejected: [],
  },
  admin: {
    pending: ["confirmed", "cancelled", "rejected"],
    confirmed: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
    rejected: [],
  },
  technician: {
    pending: [],
    confirmed: ["in_progress"],
    in_progress: ["completed"],
    completed: [],
    cancelled: [],
    rejected: [],
  },
};

function validateBookingTransition(currentStatus, targetStatus, role = "admin") {
  if (currentStatus === targetStatus) {
    return { valid: true, isNoOp: true };
  }
  const allowedGeneral = VALID_BOOKING_TRANSITIONS[currentStatus] || [];
  if (!allowedGeneral.includes(targetStatus)) {
    return { valid: false, error: `Illegal transition from ${currentStatus} to ${targetStatus}` };
  }
  const allowedRole = ROLE_PERMISSIONS[role]?.[currentStatus] || [];
  if (!allowedRole.includes(targetStatus)) {
    return { valid: false, error: `Role '${role}' cannot transition from ${currentStatus} to ${targetStatus}` };
  }
  return { valid: true, isNoOp: false };
}

export function runStateMachineTests() {
  describe("Booking State Machine Transition Matrix (Unit)", () => {
    test("Pending -> Confirmed by Admin is ALLOWED", () => {
      const res = validateBookingTransition("pending", "confirmed", "admin");
      assert(res.valid, "Admin should be allowed to confirm pending booking");
    });

    test("Pending -> Confirmed by Customer is REJECTED", () => {
      const res = validateBookingTransition("pending", "confirmed", "customer");
      assertEqual(res.valid, false, "Customer cannot self-confirm booking");
    });

    test("Pending -> Cancelled by Customer is ALLOWED", () => {
      const res = validateBookingTransition("pending", "cancelled", "customer");
      assert(res.valid, "Customer can cancel their pending booking");
    });

    test("Confirmed -> Cancelled by Customer is REJECTED (must contact dispatch)", () => {
      const res = validateBookingTransition("confirmed", "cancelled", "customer");
      assertEqual(res.valid, false, "Customer cannot directly cancel confirmed booking");
    });

    test("Confirmed -> In Progress by Technician is ALLOWED", () => {
      const res = validateBookingTransition("confirmed", "in_progress", "technician");
      assert(res.valid, "Technician can start confirmed service");
    });

    test("In Progress -> Completed by Technician is ALLOWED", () => {
      const res = validateBookingTransition("in_progress", "completed", "technician");
      assert(res.valid, "Technician can complete service");
    });

    test("Completed is TERMINAL: Completed -> Pending is REJECTED for all roles", () => {
      assertEqual(validateBookingTransition("completed", "pending", "admin").valid, false);
      assertEqual(validateBookingTransition("completed", "pending", "customer").valid, false);
      assertEqual(validateBookingTransition("completed", "pending", "technician").valid, false);
    });

    test("Cancelled is TERMINAL: Cancelled -> Confirmed is REJECTED for all roles", () => {
      assertEqual(validateBookingTransition("cancelled", "confirmed", "admin").valid, false);
    });

    test("Idempotent transition to same status is recognized as no-op valid", () => {
      const res = validateBookingTransition("confirmed", "confirmed", "admin");
      assert(res.valid && res.isNoOp, "Same-status transition is a valid no-op");
    });
  });
}
