/**
 * Focused Unit & Integration Tests: Phase 4B Booking to Admin SMS Workflow
 * HT Mobile Services / Tire Mobile Clinic
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../../frontend/src");

export function runPhase4BWorkflowTests() {
  describe("Phase 4B: Customer Booking Form Date/Time Fields", () => {
    test("A. BookingFormClient renders date and time selector inputs", () => {
      const formPath = path.join(projectRoot, "app/booking/BookingFormClient.tsx");
      const content = fs.readFileSync(formPath, "utf-8");

      assert(content.includes('id="bookingDate"'), "bookingDate input id must exist");
      assert(content.includes('name="bookingDate"'), "bookingDate name must exist");
      assert(content.includes('type="date"'), "bookingDate type must be date");
      assert(content.includes('min={todayStr}'), "bookingDate must enforce min today");
      assert(content.includes('id="bookingTime"'), "bookingTime select id must exist");
      assert(content.includes('name="bookingTime"'), "bookingTime name must exist");
      assert(content.includes("6. Preferred Appointment Schedule"), "Schedule section header must exist");
    });

    test("B. Date and time values are packaged in formData for createBookingRequestAction", () => {
      const formPath = path.join(projectRoot, "app/booking/BookingFormClient.tsx");
      const content = fs.readFileSync(formPath, "utf-8");

      assert(content.includes("bookingDate: selectedDateValue"), "bookingDate must be passed to action");
      assert(content.includes("bookingTime: selectedTimeValue"), "bookingTime must be passed to action");
      assert(content.includes("scheduledDate: selectedDateValue"), "scheduledDate must be passed for compatibility");
      assert(content.includes("scheduledTime: selectedTimeValue"), "scheduledTime must be passed for compatibility");
    });
  });

  describe("Phase 4B: Server-Side Date/Time Validation", () => {
    test("C. Server Action source validates date format and rejects malformed dates", () => {
      const actionPath = path.join(projectRoot, "app/actions/bookings/customer.ts");
      const content = fs.readFileSync(actionPath, "utf-8");

      assert(content.includes("/^\\d{4}-\\d{2}-\\d{2}$/"), "Must validate YYYY-MM-DD regex");
      assert(content.includes("Invalid appointment date format"), "Must return error on malformed date");
      assert(content.includes("Invalid calendar date provided"), "Must validate actual calendar day/month bounds");
    });

    test("D. Server Action source rejects past dates earlier than today", () => {
      const actionPath = path.join(projectRoot, "app/actions/bookings/customer.ts");
      const content = fs.readFileSync(actionPath, "utf-8");

      assert(content.includes("candidateDate < todayUtc"), "Must check if date is earlier than today");
      assert(content.includes("Preferred appointment date cannot be in the past"), "Must return past date error message");
    });

    test("E. Coordinates and formattedAddress are forwarded to sendBookingConfirmation", () => {
      const actionPath = path.join(projectRoot, "app/actions/bookings/customer.ts");
      const content = fs.readFileSync(actionPath, "utf-8");

      assert(content.includes("latitude: booking.latitude"), "latitude must be forwarded to sendBookingConfirmation");
      assert(content.includes("longitude: booking.longitude"), "longitude must be forwarded to sendBookingConfirmation");
      assert(content.includes("formattedAddress: booking.formattedAddress"), "formattedAddress must be forwarded");
      assert(content.includes("message: booking.message"), "message must be forwarded");
    });
  });



  describe("Phase 4B: Admin Booking Detail Page & Authorization", () => {
    test("H. Admin booking detail page exists and enforces requireAdminSession", () => {
      const pagePath = path.join(projectRoot, "app/(admin-portal)/admin/bookings/[bookingId]/page.tsx");
      assert(fs.existsSync(pagePath), "Admin booking detail page must exist");

      const content = fs.readFileSync(pagePath, "utf-8");
      assert(content.includes("requireAdminSession"), "Page must enforce requireAdminSession");
      assert(content.includes("params"), "Page must accept bookingId route param");
      assert(content.includes("prisma.booking.findUnique"), "Page must load target booking by ID");
      assert(content.includes("Booking Not Found"), "Page must handle not-found cleanly");
    });

    test("I. Admin booking detail page displays all required fields", () => {
      const pagePath = path.join(projectRoot, "app/(admin-portal)/admin/bookings/[bookingId]/page.tsx");
      const content = fs.readFileSync(pagePath, "utf-8");

      assert(content.includes("booking.customer?.name"), "Must display customer name");
      assert(content.includes("booking.customer?.phone"), "Must display customer phone");
      assert(content.includes("booking.customer?.email"), "Must display customer email");
      assert(content.includes("booking.vehicle"), "Must display vehicle");
      assert(content.includes("booking.tireSize"), "Must display tire size");
      assert(content.includes("booking.bookingDate"), "Must display preferred date");
      assert(content.includes("booking.bookingTime"), "Must display preferred time");
      assert(content.includes("mapsUrl"), "Must display Google Maps navigation");
      assert(content.includes("booking.status"), "Must display booking status");
    });

    test("J. Admin interactive actions delegate to authorized server actions", () => {
      const actionsPath = path.join(projectRoot, "app/(admin-portal)/admin/bookings/[bookingId]/AdminBookingDetailActions.tsx");
      assert(fs.existsSync(actionsPath), "Admin detail actions component must exist");

      const content = fs.readFileSync(actionsPath, "utf-8");
      assert(content.includes("confirmBookingAction(bookingId)"), "Must call confirmBookingAction");
      assert(content.includes("cancelBookingAction(bookingId"), "Must call cancelBookingAction");
      assert(content.includes("assignTechnicianAction(bookingId"), "Must call assignTechnicianAction");
    });

    test("K. PATCH /api/admin/bookings/[id] dispatches canonical customer confirmation alert", () => {
      const patchRoutePath = path.join(projectRoot, "app/api/admin/bookings/[id]/route.ts");
      const content = fs.readFileSync(patchRoutePath, "utf-8");

      assert(content.includes("sendCustomerBookingConfirmedAlert"), "Must import sendCustomerBookingConfirmedAlert");
      assert(content.includes('status === "confirmed"'), "Must check for confirmed status");
    });
  });

}

// Allow standalone execution
if (process.argv[1] && process.argv[1].endsWith("phase-4b-workflow.test.mjs")) {
  runPhase4BWorkflowTests();
}
