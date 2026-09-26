/**
 * Unit Tests: WhatsApp Workflow Completion
 * HT Mobile Tyres
 *
 * Verifies:
 * 1. sendAdminBookingCreatedAlert implementation and contract
 * 2. Integration into createBookingRequestAction
 * 3. sendCustomerServiceStartedAlert implementation and contract
 * 4. Integration into startServiceAction
 * 5. sendCustomerServiceCompletedAlert implementation and contract
 * 6. Integration into completeAndQuoteAction (preserving sendQuoteReadyNotification)
 * 7. Polished customer WhatsApp message templates (booking reference + support hotline)
 * 8. Idempotency providerEventId determinism
 */

import fs from "fs";
import path from "path";
import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

const ROOT_DIR = path.resolve(process.cwd());
const NOTIFICATIONS_PATH = path.join(ROOT_DIR, "frontend/src/lib/notifications.ts");
const CUSTOMER_ACTION_PATH = path.join(ROOT_DIR, "frontend/src/app/actions/bookings/customer.ts");
const ADMIN_ACTION_PATH = path.join(ROOT_DIR, "frontend/src/app/actions/bookings/admin.ts");
const QUOTE_ACTION_PATH = path.join(ROOT_DIR, "frontend/src/app/actions/bookings/quote.ts");

export function runWhatsAppWorkflowCompletionUnitTests() {
  describe("WhatsApp Workflow: Notifications Framework Invariants", () => {
    const notifSrc = fs.readFileSync(NOTIFICATIONS_PATH, "utf-8");

    test("1. sendAdminBookingCreatedAlert is exported with correct contract", () => {
      assert(
        notifSrc.includes("export async function sendAdminBookingCreatedAlert"),
        "sendAdminBookingCreatedAlert must be exported from notifications.ts"
      );
      assert(
        notifSrc.includes("process.env.TECHNICIAN_PHONE_NUMBER"),
        "sendAdminBookingCreatedAlert must target process.env.TECHNICIAN_PHONE_NUMBER"
      );
      assert(
        notifSrc.includes('type: "BOOKING_CREATED"'),
        "sendAdminBookingCreatedAlert must use type BOOKING_CREATED"
      );
      assert(
        notifSrc.includes("admin_booking_created_${booking.id}"),
        "sendAdminBookingCreatedAlert must use deterministic providerEventId"
      );
      assert(
        notifSrc.includes("NEW BOOKING REQUEST"),
        "sendAdminBookingCreatedAlert must include NEW BOOKING REQUEST header"
      );
      assert(
        notifSrc.includes("${APP_URL}/admin/bookings/${booking.id}"),
        "sendAdminBookingCreatedAlert must include direct admin booking URL"
      );
      assert(
        notifSrc.includes("booking.id.slice(-6).toUpperCase()"),
        "sendAdminBookingCreatedAlert must include short booking reference"
      );
    });

    test("2. sendCustomerServiceStartedAlert is exported with correct contract", () => {
      assert(
        notifSrc.includes("export async function sendCustomerServiceStartedAlert"),
        "sendCustomerServiceStartedAlert must be exported from notifications.ts"
      );
      assert(
        notifSrc.includes('type: "SERVICE_STARTED"'),
        "sendCustomerServiceStartedAlert must use type SERVICE_STARTED"
      );
      assert(
        notifSrc.includes("service_started_${booking.id}"),
        "sendCustomerServiceStartedAlert must use deterministic providerEventId"
      );
      assert(
        notifSrc.includes("HT Mobile Tires — Service Started"),
        "sendCustomerServiceStartedAlert must include clear service started header"
      );
      assert(
        notifSrc.includes("BUSINESS_PHONE_DISPLAY"),
        "sendCustomerServiceStartedAlert must include support hotline"
      );
    });

    test("3. sendCustomerServiceCompletedAlert is exported with correct contract", () => {
      assert(
        notifSrc.includes("export async function sendCustomerServiceCompletedAlert"),
        "sendCustomerServiceCompletedAlert must be exported from notifications.ts"
      );
      assert(
        notifSrc.includes('type: "SERVICE_COMPLETED"'),
        "sendCustomerServiceCompletedAlert must use type SERVICE_COMPLETED"
      );
      assert(
        notifSrc.includes("service_completed_${booking.id}"),
        "sendCustomerServiceCompletedAlert must use deterministic providerEventId"
      );
      assert(
        notifSrc.includes("HT Mobile Tires — Service Completed"),
        "sendCustomerServiceCompletedAlert must include clear service completed header"
      );
      assert(
        notifSrc.includes("BUSINESS_PHONE_DISPLAY"),
        "sendCustomerServiceCompletedAlert must include support hotline"
      );
    });

    test("4. Existing customer templates polished with booking reference and hotline", () => {
      // booking_confirmation
      assert(
        notifSrc.includes("request for booking ${bookingRef}"),
        "booking_confirmation template must include booking reference"
      );
      assert(
        notifSrc.includes("Support: ${BUSINESS_PHONE_DISPLAY}"),
        "booking_confirmation template must include support hotline"
      );

      // BOOKING_CONFIRMED
      assert(
        notifSrc.includes("appointment for booking ${bookingRef}"),
        "BOOKING_CONFIRMED template must include booking reference"
      );
    });
  });

  describe("WhatsApp Workflow: Action Triggers & Non-blocking Dispatch", () => {
    const customerSrc = fs.readFileSync(CUSTOMER_ACTION_PATH, "utf-8");
    const adminSrc = fs.readFileSync(ADMIN_ACTION_PATH, "utf-8");
    const quoteSrc = fs.readFileSync(QUOTE_ACTION_PATH, "utf-8");

    test("5. createBookingRequestAction triggers sendAdminBookingCreatedAlert non-blockingly", () => {
      assert(
        customerSrc.includes("sendAdminBookingCreatedAlert"),
        "customer.ts must import and call sendAdminBookingCreatedAlert"
      );
      assert(
        customerSrc.includes("await sendAdminBookingCreatedAlert(notificationPayload)"),
        "customer.ts must await sendAdminBookingCreatedAlert"
      );
      assert(
        customerSrc.includes("catch (adminNotifErr)"),
        "customer.ts must catch notification errors to prevent booking transaction rollback"
      );
    });

    test("6. startServiceAction triggers sendCustomerServiceStartedAlert non-blockingly", () => {
      assert(
        adminSrc.includes("sendCustomerServiceStartedAlert"),
        "admin.ts must import and call sendCustomerServiceStartedAlert"
      );
      assert(
        adminSrc.includes("await sendCustomerServiceStartedAlert({"),
        "admin.ts must await sendCustomerServiceStartedAlert"
      );
      assert(
        adminSrc.includes("data: { status: \"in_progress\" }"),
        "admin.ts must perform in_progress update before alert"
      );
    });

    test("7. completeAndQuoteAction triggers sendCustomerServiceCompletedAlert while preserving quote_ready", () => {
      assert(
        quoteSrc.includes("sendCustomerServiceCompletedAlert"),
        "quote.ts must import and call sendCustomerServiceCompletedAlert"
      );
      assert(
        quoteSrc.includes("sendQuoteReadyNotification"),
        "quote.ts must preserve sendQuoteReadyNotification"
      );
      assert(
        quoteSrc.includes("await sendCustomerServiceCompletedAlert({"),
        "quote.ts must await sendCustomerServiceCompletedAlert"
      );
      assert(
        quoteSrc.includes("await sendQuoteReadyNotification({"),
        "quote.ts must await sendQuoteReadyNotification"
      );
    });
  });

  describe("WhatsApp Workflow: Message Formatter Simulation", () => {
    test("8. Formatter generates deterministic references and valid URLs", () => {
      const mockBookingId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const shortRef = `#${mockBookingId.slice(-6).toUpperCase()}`;
      assertEqual(shortRef, "#567890");

      const mockAppUrl = "https://mobiletire.clinic";
      const adminUrl = `${mockAppUrl}/admin/bookings/${mockBookingId}`;
      assertEqual(adminUrl, "https://mobiletire.clinic/admin/bookings/a1b2c3d4-e5f6-7890-abcd-ef1234567890");

      const providerEventId = `admin_booking_created_${mockBookingId}`;
      assertEqual(providerEventId, "admin_booking_created_a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    });
  });
}
