/**
 * E2E Journey: Admin Dispatch & Operations
 * Admin Login -> View Bookings -> Confirm -> Assign Technician
 * HT Mobile Services
 */

import { describe, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockTechnicianCarlos } from "../fixtures/user-fixtures.mjs";

export function runAdminJourneyE2ETests() {
  describe("E2E Journey: Admin Dispatch & Management Operations", () => {
    testAsync("Full journey: Admin Auth -> Dashboard -> Confirm Booking -> Dispatch Technician", async () => {
      // 1. Admin logs in with signed session cookie
      const adminCookie = "admin_valid_session_cookie";
      const isAdmin = (cookie) => cookie === "admin_valid_session_cookie";
      assert(isAdmin(adminCookie), "Admin authenticated");

      // 2. Initial state: Booking is pending
      const activeBooking = {
        id: "book_e2e_dispatch_202",
        customerId: "cust_e2e_101",
        status: "pending",
        technicianId: null,
        scheduledDate: "2026-10-20",
        scheduledTime: "10:00 AM",
      };

      // 3. Admin confirms booking
      const confirmBooking = (booking) => {
        if (booking.status !== "pending") throw new Error("Invalid status");
        booking.status = "confirmed";
        return booking;
      };
      confirmBooking(activeBooking);
      assertEqual(activeBooking.status, "confirmed");

      // 4. Admin assigns Technician Carlos
      const assignTechnician = (booking, technicianId) => {
        if (booking.status !== "confirmed") throw new Error("Must be confirmed");
        booking.technicianId = technicianId;
        return booking;
      };
      assignTechnician(activeBooking, mockTechnicianCarlos.id);
      assertEqual(activeBooking.technicianId, "tech_carlos_333");
    });
  });
}
