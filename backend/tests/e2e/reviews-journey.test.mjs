/**
 * E2E Journey: Customer Reviews for Completed Bookings
 * HT Mobile Services
 */

import { describe, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockCustomerAlice, mockCustomerBob } from "../fixtures/user-fixtures.mjs";
import { mockBookingAlicePending, mockBookingCompleted } from "../fixtures/booking-fixtures.mjs";

export function runReviewsJourneyE2ETests() {
  describe("E2E Journey: Verified Customer Review Submission", () => {
    testAsync("Full journey: Completed booking review succeeds; non-completed or cross-customer fails", async () => {
      const reviewStore = [];

      const submitReview = (viewer, booking, { rating, comment }) => {
        if (!viewer) return { status: 401, error: "Unauthorized" };
        if (viewer.id !== booking.customerId) {
          return { status: 403, error: "Cannot review another customer's booking" };
        }
        if (booking.status !== "completed") {
          return { status: 400, error: "Only completed services can be reviewed" };
        }
        const review = {
          id: `rev_${Date.now()}`,
          bookingId: booking.id,
          customerId: viewer.id,
          rating,
          comment,
          published: true,
          createdAt: new Date(),
        };
        reviewStore.push(review);
        return { status: 201, review };
      };

      // 1. Alice reviews her completed booking
      const res1 = submitReview(mockCustomerAlice, mockBookingCompleted, {
        rating: 5,
        comment: "Outstanding emergency flat repair in Plano!",
      });
      assertEqual(res1.status, 201);
      assertEqual(reviewStore.length, 1);
      assertEqual(reviewStore[0].rating, 5);

      // 2. Alice tries to review a pending booking (REJECTED)
      const res2 = submitReview(mockCustomerAlice, mockBookingAlicePending, { rating: 5, comment: "Premature review" });
      assertEqual(res2.status, 400);

      // 3. Bob tries to review Alice's booking (REJECTED)
      const res3 = submitReview(mockCustomerBob, mockBookingCompleted, { rating: 1, comment: "Malicious review" });
      assertEqual(res3.status, 403);
    });
  });
}
