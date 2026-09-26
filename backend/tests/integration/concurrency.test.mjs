/**
 * Integration Tests: Booking Concurrency & Admin State Mutex
 * HT Mobile Services
 */

import { describe, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";

class MockTransactionalBookingStore {
  constructor(maxSlotsPerWindow = 1) {
    this.maxSlots = maxSlotsPerWindow;
    this.bookings = new Map();
    this.lock = false;
  }

  async createBookingWithCapacityCheck(bookingData) {
    // Simulating serialized database transaction with lock
    while (this.lock) {
      await new Promise((r) => setTimeout(r, 5));
    }
    this.lock = true;
    try {
      const activeCount = Array.from(this.bookings.values()).filter(
        (b) => b.scheduledTime === bookingData.scheduledTime && b.status !== "cancelled"
      ).length;

      if (activeCount >= this.maxSlots) {
        return { success: false, status: 409, error: "Slot capacity exhausted" };
      }

      this.bookings.set(bookingData.id, { ...bookingData, status: "pending" });
      return { success: true, status: 201, booking: this.bookings.get(bookingData.id) };
    } finally {
      this.lock = false;
    }
  }

  async transitionStatus(bookingId, targetStatus) {
    while (this.lock) {
      await new Promise((r) => setTimeout(r, 5));
    }
    this.lock = true;
    try {
      const booking = this.bookings.get(bookingId);
      if (!booking) return { success: false, status: 404 };
      if (booking.status === "completed" || booking.status === "cancelled") {
        return { success: false, status: 400, error: "Cannot transition terminal booking" };
      }
      booking.status = targetStatus;
      return { success: true, status: 200, booking };
    } finally {
      this.lock = false;
    }
  }
}

export function runConcurrencyIntegrationTests() {
  describe("Concurrency & Race Condition Safety (Integration)", () => {
    testAsync("Two concurrent booking requests for 1 remaining slot -> 1 succeeds (201), 1 fails (409)", async () => {
      const store = new MockTransactionalBookingStore(1);

      const reqA = store.createBookingWithCapacityCheck({
        id: "book_concurrent_A",
        scheduledTime: "10:00 AM",
      });
      const reqB = store.createBookingWithCapacityCheck({
        id: "book_concurrent_B",
        scheduledTime: "10:00 AM",
      });

      const [resA, resB] = await Promise.all([reqA, reqB]);

      const successCount = (resA.success ? 1 : 0) + (resB.success ? 1 : 0);
      const conflictCount = (resA.status === 409 ? 1 : 0) + (resB.status === 409 ? 1 : 0);

      assertEqual(successCount, 1, "Exactly one request must succeed");
      assertEqual(conflictCount, 1, "Exactly one request must receive 409 Conflict");
    });

    testAsync("Concurrent Admin Confirm vs Cancel on same booking transitions deterministically", async () => {
      const store = new MockTransactionalBookingStore(1);
      await store.createBookingWithCapacityCheck({
        id: "book_test_admin",
        scheduledTime: "01:00 PM",
      });

      // Simultaneous confirm and cancel
      const [resConfirm, resCancel] = await Promise.all([
        store.transitionStatus("book_test_admin", "confirmed"),
        store.transitionStatus("book_test_admin", "cancelled"),
      ]);

      assert(resConfirm.success || resCancel.success, "At least one transition succeeds");
      const finalBooking = store.bookings.get("book_test_admin");
      assert(
        finalBooking.status === "confirmed" || finalBooking.status === "cancelled",
        "Final state must be valid single state"
      );
    });
  });
}
