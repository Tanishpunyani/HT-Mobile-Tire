/**
 * Integration Tests: Soft Deletion / Cancellation & Historical Integrity
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockCustomerAlice } from "../fixtures/user-fixtures.mjs";
import { mockBookingAlicePending, mockBookingCompleted } from "../fixtures/booking-fixtures.mjs";

class MockDatabaseService {
  constructor() {
    this.records = new Map();
    this.records.set(mockBookingAlicePending.id, { ...mockBookingAlicePending });
    this.records.set(mockBookingCompleted.id, { ...mockBookingCompleted });
  }

  handleDeleteRequest(actor, bookingId) {
    const booking = this.records.get(bookingId);
    if (!booking) return { status: 404, error: "Booking not found." };
    if (booking.customerId !== actor.id) return { status: 403, error: "Access denied." };

    if (booking.status === "completed") {
      return { status: 400, error: "Historical completed bookings cannot be deleted." };
    }

    if (booking.status === "pending") {
      // Soft-cancel: update status, DO NOT delete row
      booking.status = "cancelled";
      booking.cancelledAt = new Date().toISOString();
      return { status: 200, message: "Booking cancelled successfully.", booking };
    }

    return { status: 400, error: "Active bookings must be cancelled through dispatch." };
  }
}

export function runCancellationDeletionIntegrationTests() {
  describe("Soft Cancellation vs Hard Deletion (Integration)", () => {
    test("DELETE on pending booking soft-cancels the booking without destroying record in DB", () => {
      const db = new MockDatabaseService();
      const res = db.handleDeleteRequest(mockCustomerAlice, mockBookingAlicePending.id);

      assertEqual(res.status, 200);
      const recordInDb = db.records.get(mockBookingAlicePending.id);
      assert(recordInDb !== undefined, "Record must still exist in DB");
      assertEqual(recordInDb.status, "cancelled", "Status must be updated to cancelled");
      assertEqual(recordInDb.price, 85.0, "Financial record preserved");
    });

    test("DELETE on completed historical booking is REJECTED (400) and record remains intact", () => {
      const db = new MockDatabaseService();
      const res = db.handleDeleteRequest(mockCustomerAlice, mockBookingCompleted.id);

      assertEqual(res.status, 400);
      const recordInDb = db.records.get(mockBookingCompleted.id);
      assert(recordInDb !== undefined);
      assertEqual(recordInDb.status, "completed", "Status remains completed");
    });
  });
}
