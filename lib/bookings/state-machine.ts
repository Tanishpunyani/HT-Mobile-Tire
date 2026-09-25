/**
 * HT Mobile Tires — Server-Authoritative Booking & Payment State Machines
 *
 * Single source of truth for all booking status and payment status transitions.
 * Enforces role-based permissions, terminal state immutability, and idempotent operations.
 */

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PaymentStatus =
  | "pending"
  | "quote_sent"
  | "paid";

export type UserRole = "customer" | "technician" | "admin";

export interface TransitionResult {
  allowed: boolean;
  isNoop: boolean;
  error?: string;
}

// Valid Booking Status Transitions by Role
const BOOKING_TRANSITIONS: Record<
  BookingStatus,
  Record<UserRole, BookingStatus[]>
> = {
  pending: {
    customer: ["cancelled"], // Customers can only cancel pending requests
    technician: [],
    admin: ["confirmed", "cancelled"], // Admins can confirm or cancel
  },
  confirmed: {
    customer: [], // Customers must call dispatch to cancel confirmed bookings
    technician: ["in_progress"], // Tech starting service / en route
    admin: ["in_progress", "cancelled"], // Admins can start or cancel
  },
  in_progress: {
    customer: [],
    technician: ["completed"], // Tech finishes work on vehicle
    admin: ["completed", "cancelled"], // Admins can complete or emergency cancel
  },
  completed: {
    customer: [],
    technician: [],
    admin: [], // Terminal & Immutable
  },
  cancelled: {
    customer: [],
    technician: [],
    admin: [], // Terminal & Immutable
  },
};

// Valid Payment Status Transitions
const PAYMENT_TRANSITIONS: Record<
  PaymentStatus,
  Record<UserRole, PaymentStatus[]>
> = {
  pending: {
    customer: [],
    technician: [],
    admin: ["quote_sent", "paid"],
  },
  quote_sent: {
    customer: [],
    technician: [],
    admin: ["paid"],
  },
  paid: {
    customer: [],
    technician: [],
    admin: [], // Terminal & Immutable
  },
};

/**
 * Validates whether a requested booking status transition is permitted.
 */
export function validateBookingTransition(
  currentStatus: string,
  requestedStatus: string,
  role: UserRole = "admin"
): TransitionResult {
  const current = currentStatus?.toLowerCase() as BookingStatus;
  const requested = requestedStatus?.toLowerCase() as BookingStatus;

  // 1. Idempotent check (same state -> same state is a safe no-op)
  if (current === requested) {
    return { allowed: true, isNoop: true };
  }

  // 2. Validate known status values
  const knownStatuses: BookingStatus[] = [
    "pending",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
  ];

  if (!knownStatuses.includes(current)) {
    return {
      allowed: false,
      isNoop: false,
      error: `Invalid current booking status: "${currentStatus}".`,
    };
  }

  if (!knownStatuses.includes(requested)) {
    return {
      allowed: false,
      isNoop: false,
      error: `Invalid requested booking status: "${requestedStatus}".`,
    };
  }

  // 3. Check terminal states
  if (current === "completed") {
    return {
      allowed: false,
      isNoop: false,
      error: "Cannot modify a completed booking. Completed records are permanent and immutable.",
    };
  }

  if (current === "cancelled") {
    return {
      allowed: false,
      isNoop: false,
      error: "Cannot modify a cancelled booking. Cancelled records cannot be reactivated.",
    };
  }

  // 4. Role-based transition check
  const allowedForRole = BOOKING_TRANSITIONS[current]?.[role] || [];
  if (allowedForRole.includes(requested)) {
    return { allowed: true, isNoop: false };
  }

  return {
    allowed: false,
    isNoop: false,
    error: `Transition from "${current}" to "${requested}" is not permitted for role "${role}".`,
  };
}

/**
 * Validates whether a requested payment status transition is permitted.
 */
export function validatePaymentTransition(
  currentPayment: string,
  requestedPayment: string,
  role: UserRole = "admin"
): TransitionResult {
  const current = (currentPayment?.toLowerCase() || "pending") as PaymentStatus;
  const requested = (requestedPayment?.toLowerCase() || "pending") as PaymentStatus;

  // 1. Idempotent check
  if (current === requested) {
    return { allowed: true, isNoop: true };
  }

  const knownStatuses: PaymentStatus[] = ["pending", "quote_sent", "paid"];

  if (!knownStatuses.includes(current) || !knownStatuses.includes(requested)) {
    return {
      allowed: false,
      isNoop: false,
      error: `Invalid payment status transition from "${currentPayment}" to "${requestedPayment}".`,
    };
  }

  if (current === "paid") {
    return {
      allowed: false,
      isNoop: false,
      error: "Cannot modify a settled payment. Paid status is permanent.",
    };
  }

  const allowedForRole = PAYMENT_TRANSITIONS[current]?.[role] || [];
  if (allowedForRole.includes(requested)) {
    return { allowed: true, isNoop: false };
  }

  return {
    allowed: false,
    isNoop: false,
    error: `Payment transition from "${current}" to "${requested}" is not permitted for role "${role}".`,
  };
}
