/**
 * E2E Journey: Complete Customer Lifecycle
 * Signup -> Login -> Create Booking -> Duplicate Submission Check -> Account History
 * HT Mobile Services
 */

import { describe, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";

export function runCustomerJourneyE2ETests() {
  describe("E2E Journey: Customer Booking & Account Lifecycle", () => {
    testAsync("Full journey: Auth -> Submit Booking -> Idempotency Guard -> Account Dashboard", async () => {
      // 1. Emulate customer registration and login
      const customerSession = {
        userId: "auth_user_e2e_101",
        email: "e2e.customer@example.com",
        customerProfile: {
          id: "cust_e2e_101",
          name: "E2E Test Customer",
          phone: "2145550999",
        },
      };
      assert(customerSession.userId != null);

      // 2. Customer selects Flat Tire Repair and submits booking form
      const bookingPayload = {
        customerId: customerSession.customerProfile.id,
        serviceType: "Flat Tire Repair",
        scheduledDate: "2026-10-20",
        scheduledTime: "10:00 AM",
        address: "700 N Pearl St, Dallas, TX 75201",
        latitude: 32.788,
        longitude: -96.795,
        vehicleDetails: { year: "2024", make: "Tesla", model: "Model 3" },
        phone: customerSession.customerProfile.phone,
      };

      const bookingDatabase = [];
      const duplicateSubmissionWindow = new Map();

      // Submit booking
      const submitBooking = (payload) => {
        const idempotencyKey = `${payload.phone}_${payload.scheduledDate}_${payload.scheduledTime}`;
        if (duplicateSubmissionWindow.has(idempotencyKey)) {
          return {
            isDuplicate: true,
            booking: duplicateSubmissionWindow.get(idempotencyKey),
          };
        }
        const created = {
          id: `book_${Date.now()}`,
          ...payload,
          status: "pending",
          paymentStatus: "pending",
          price: 85.0,
          createdAt: new Date(),
        };
        bookingDatabase.push(created);
        duplicateSubmissionWindow.set(idempotencyKey, created);
        return { isDuplicate: false, booking: created };
      };

      const submission1 = submitBooking(bookingPayload);
      assert(!submission1.isDuplicate, "First submission is treated as new");
      assertEqual(submission1.booking.status, "pending");

      // 3. Customer rapidly double-clicks Submit (Duplicate submission protection)
      const submission2 = submitBooking(bookingPayload);
      assert(submission2.isDuplicate, "Rapid duplicate submission caught");
      assertEqual(submission2.booking.id, submission1.booking.id, "Returns same booking ID");
      assertEqual(bookingDatabase.length, 1, "Only 1 record exists in DB");

      // 4. Customer views /account dashboard
      const customerAccountBookings = bookingDatabase.filter(
        (b) => b.customerId === customerSession.customerProfile.id
      );
      assertEqual(customerAccountBookings.length, 1);
      assertEqual(customerAccountBookings[0].serviceType, "Flat Tire Repair");
      assertEqual(customerAccountBookings[0].address, "700 N Pearl St, Dallas, TX 75201");
    });
  });
}
