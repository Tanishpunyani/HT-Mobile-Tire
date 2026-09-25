export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getAuthenticatedUser, getOrCreateCustomerForUser } from "@/lib/auth";
import { getBookingAvailability } from "@/lib/bookings/availability";
import BookingFormClient from "./BookingFormClient";
import { logger } from "@/lib/logger";

export default async function BookingPage() {
  let customer = null;
  let availability = { available: true };

  try {
    const [authUser, avail] = await Promise.all([
      getAuthenticatedUser(),
      getBookingAvailability(),
    ]);

    availability = avail;

    if (authUser) {
      customer = await getOrCreateCustomerForUser(authUser);
    }
  } catch (err) {
    logger.warn("booking_page.server_load_failed", { error: err });
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background-light">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      }
    >
      <BookingFormClient initialCustomer={customer} initialAvailability={availability} />
    </Suspense>
  );
}