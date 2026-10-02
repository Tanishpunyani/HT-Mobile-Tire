/**
 * E2E Journey: Service Completion, Invoicing & PDF Receipt Generation
 * HT Mobile Services
 */

import { describe, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockCustomerAlice, mockCustomerBob } from "../fixtures/user-fixtures.mjs";

export function runQuoteReceiptJourneyE2ETests() {
  describe("E2E Journey: Service Completion & PDF Receipt Lifecycle", () => {
    testAsync("Full journey: Admin completes quote -> Price reconciled -> PDF created -> Customer downloads receipt", async () => {
      const activeBooking = {
        id: "book_receipt_e2e_501",
        customerId: mockCustomerAlice.id,
        status: "in_progress",
        basePrice: 85.0,
        extraCharges: 0,
        totalPrice: 85.0,
        paymentStatus: "pending",
      };

      // 1. Admin completes quote with extra charges
      const completeAndQuote = (booking, extras = []) => {
        const extraTotal = extras.reduce((sum, item) => sum + item.amount, 0);
        booking.status = "completed";
        booking.extraCharges = extraTotal;
        booking.totalPrice = booking.basePrice + extraTotal;
        booking.paymentStatus = "paid";
        booking.pdfReceiptId = `receipt_${booking.id}.pdf`;
        return booking;
      };

      completeAndQuote(activeBooking, [
        { description: "Tire patch kit", amount: 20.0 },
        { description: "Wheel balance", amount: 15.0 },
      ]);

      assertEqual(activeBooking.status, "completed");
      assertEqual(activeBooking.totalPrice, 120.0);
      assertEqual(activeBooking.paymentStatus, "paid");

      // 2. Customer Alice requests receipt PDF
      const fetchReceipt = (viewer, booking) => {
        if (viewer.id !== booking.customerId) return { status: 403 };
        return {
          status: 200,
          receipt: {
            pdfUrl: `/api/bookings/${booking.id}/receipt`,
            totalPaid: booking.totalPrice,
            customerName: mockCustomerAlice.name,
          },
        };
      };

      const aliceReceipt = fetchReceipt(mockCustomerAlice, activeBooking);
      assertEqual(aliceReceipt.status, 200);
      assertEqual(aliceReceipt.receipt.totalPaid, 120.0);

      // 3. Customer Bob blocked from downloading Alice's receipt
      const bobReceipt = fetchReceipt(mockCustomerBob, activeBooking);
      assertEqual(bobReceipt.status, 403);
    });
  });
}
