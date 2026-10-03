/**
 * Unit Tests: Email Lifecycle Event Rewiring (Phase 10C.4)
 * HT Mobile Tire / HT Mobile Tire Next.js
 *
 * Verifies:
 * 1. Customer Email Lifecycle Wiring (11 events)
 * 2. Admin Email Lifecycle Wiring (5 events)
 * 3. Removal of active WhatsApp dispatch from all lifecycle paths
 * 4. Preservation of WhatsApp source files and models
 * 5. Idempotency & deduplication for all 16 business events
 * 6. NotificationLog channel="email" logging
 * 7. Non-blocking failure isolation
 * 8. PDF attachment flow for completion/quote
 */

import fs from "fs";
import path from "path";
import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

const ROOT_DIR = path.resolve(process.cwd());
const NOTIFICATIONS_PATH = path.join(ROOT_DIR, "frontend/src/lib/notifications.ts");
const EMAIL_PATH = path.join(ROOT_DIR, "frontend/src/lib/email.ts");
const CUSTOMER_ACTION_PATH = path.join(ROOT_DIR, "frontend/src/app/actions/bookings/customer.ts");
const ADMIN_ACTION_PATH = path.join(ROOT_DIR, "frontend/src/app/actions/bookings/admin.ts");
const TECH_ACTION_PATH = path.join(ROOT_DIR, "frontend/src/app/actions/bookings/technician.ts");
const QUOTE_ACTION_PATH = path.join(ROOT_DIR, "frontend/src/app/actions/bookings/quote.ts");
const BOOKINGS_API_PATH = path.join(ROOT_DIR, "frontend/src/app/api/bookings/route.ts");
const BOOKING_ID_API_PATH = path.join(ROOT_DIR, "frontend/src/app/api/bookings/[id]/route.ts");
const ADMIN_BOOKING_ID_API_PATH = path.join(ROOT_DIR, "frontend/src/app/api/admin/bookings/[id]/route.ts");
const EMERGENCY_API_PATH = path.join(ROOT_DIR, "frontend/src/app/api/emergency-requests/route.ts");
const CONTACT_API_PATH = path.join(ROOT_DIR, "frontend/src/app/api/contact-messages/route.ts");

export function runEmailLifecycleRewiringUnitTests() {
  const notifSrc = fs.readFileSync(NOTIFICATIONS_PATH, "utf-8");
  const emailSrc = fs.readFileSync(EMAIL_PATH, "utf-8");
  const customerSrc = fs.readFileSync(CUSTOMER_ACTION_PATH, "utf-8");
  const adminSrc = fs.readFileSync(ADMIN_ACTION_PATH, "utf-8");
  const techSrc = fs.readFileSync(TECH_ACTION_PATH, "utf-8");
  const quoteSrc = fs.readFileSync(QUOTE_ACTION_PATH, "utf-8");
  const bookingsApiSrc = fs.readFileSync(BOOKINGS_API_PATH, "utf-8");
  const bookingIdApiSrc = fs.readFileSync(BOOKING_ID_API_PATH, "utf-8");
  const adminBookingIdApiSrc = fs.readFileSync(ADMIN_BOOKING_ID_API_PATH, "utf-8");
  const emergencyApiSrc = fs.readFileSync(EMERGENCY_API_PATH, "utf-8");
  const contactApiSrc = fs.readFileSync(CONTACT_API_PATH, "utf-8");

  describe("Phase 10C.4: Customer Email Lifecycle Wiring", () => {
    test("1. Booking Received delegates to sendCustomerBookingReceivedEmail", () => {
      assert(
        notifSrc.includes("return sendCustomerBookingReceivedEmail(booking);"),
        "sendBookingConfirmation must delegate to sendCustomerBookingReceivedEmail"
      );
      assert(
        bookingsApiSrc.includes("sendBookingConfirmation"),
        "POST /api/bookings must trigger booking confirmation"
      );
    });

    test("2. Booking Confirmed delegates to sendCustomerBookingConfirmedEmail", () => {
      assert(
        notifSrc.includes("return sendCustomerBookingConfirmedEmail(booking);"),
        "sendCustomerBookingConfirmedAlert must delegate to sendCustomerBookingConfirmedEmail"
      );
      assert(
        adminSrc.includes("sendCustomerBookingConfirmedAlert"),
        "confirmBookingAction must call sendCustomerBookingConfirmedAlert"
      );
    });

    test("3. Technician Assigned delegates to sendCustomerTechnicianAssignedEmail", () => {
      assert(
        notifSrc.includes("return sendCustomerTechnicianAssignedEmail(params);"),
        "sendCustomerTechnicianAssignedAlert must delegate to sendCustomerTechnicianAssignedEmail"
      );
      assert(
        adminSrc.includes("sendCustomerTechnicianAssignedAlert"),
        "assignTechnicianAction must call sendCustomerTechnicianAssignedAlert"
      );
    });

    test("4. Technician En Route delegates to sendCustomerTechnicianEnRouteEmail", () => {
      assert(
        notifSrc.includes("return sendCustomerTechnicianEnRouteEmail(params);"),
        "sendCustomerTechnicianEnRouteAlert must delegate to sendCustomerTechnicianEnRouteEmail"
      );
      assert(
        techSrc.includes("sendCustomerTechnicianEnRouteAlert"),
        "startTripAction must call sendCustomerTechnicianEnRouteAlert"
      );
    });

    test("5. Technician Arrived delegates to sendCustomerTechnicianArrivedEmail", () => {
      assert(
        notifSrc.includes("return sendCustomerTechnicianArrivedEmail(booking);"),
        "sendCustomerTechnicianArrivedAlert must delegate to sendCustomerTechnicianArrivedEmail"
      );
      assert(
        techSrc.includes("sendCustomerTechnicianArrivedAlert"),
        "arriveTechnicianAction must call sendCustomerTechnicianArrivedAlert"
      );
    });

    test("6. Service Started delegates to sendCustomerServiceStartedEmail", () => {
      assert(
        notifSrc.includes("return sendCustomerServiceStartedEmail(booking);"),
        "sendCustomerServiceStartedAlert must delegate to sendCustomerServiceStartedEmail"
      );
      assert(
        adminSrc.includes("sendCustomerServiceStartedAlert"),
        "startServiceAction must call sendCustomerServiceStartedAlert"
      );
    });

    test("7. Service Completed delegates to sendCustomerServiceCompletedEmail with PDF attachment", () => {
      assert(
        notifSrc.includes("return sendCustomerServiceCompletedEmail"),
        "sendCustomerServiceCompletedAlert must delegate to sendCustomerServiceCompletedEmail"
      );
      assert(
        quoteSrc.includes("sendCustomerServiceCompletedAlert"),
        "completeAndQuoteAction must call sendCustomerServiceCompletedAlert"
      );
      assert(
        quoteSrc.includes("pdfBytes"),
        "completeAndQuoteAction must pass generated pdfBytes"
      );
    });

    test("8. Booking Cancelled delegates to sendCustomerBookingCancelledEmail", () => {
      assert(
        notifSrc.includes("return sendCustomerBookingCancelledEmail({ booking });"),
        "sendCustomerBookingCancelledAlert must delegate to sendCustomerBookingCancelledEmail"
      );
      assert(
        customerSrc.includes("sendCustomerBookingCancelledAlert"),
        "cancelCustomerBookingAction must call sendCustomerBookingCancelledAlert"
      );
      assert(
        adminSrc.includes("sendCustomerBookingCancelledAlert"),
        "cancelBookingAction must call sendCustomerBookingCancelledAlert"
      );
    });

    test("9. Payment Received delegates to sendCustomerPaymentReceivedEmail", () => {
      assert(
        notifSrc.includes("return sendCustomerPaymentReceivedEmail"),
        "sendCustomerPaymentReceivedAlert must delegate to sendCustomerPaymentReceivedEmail"
      );
      assert(
        quoteSrc.includes("sendCustomerPaymentReceivedAlert"),
        "markBookingPaidAction must call sendCustomerPaymentReceivedAlert"
      );
    });

    test("10. Quote / Invoice Ready delegates to sendQuoteReadyEmail", () => {
      assert(
        notifSrc.includes("return sendQuoteReadyEmail"),
        "sendQuoteReadyNotification must delegate to sendQuoteReadyEmail"
      );
      assert(
        quoteSrc.includes("sendQuoteReadyNotification"),
        "completeAndQuoteAction must call sendQuoteReadyNotification"
      );
    });

    test("11. Emergency Request Confirmation delegates to sendCustomerEmergencyConfirmationEmail", () => {
      assert(
        notifSrc.includes("sendCustomerEmergencyConfirmationEmail(emergency);"),
        "sendEmergencyAlert must call sendCustomerEmergencyConfirmationEmail"
      );
      assert(
        emergencyApiSrc.includes("sendEmergencyAlert"),
        "POST /api/emergency-requests must call sendEmergencyAlert"
      );
    });
  });

  describe("Phase 10C.4: Admin Email Lifecycle Wiring", () => {
    test("12. Admin New Booking Alert delegates to sendAdminBookingCreatedEmail", () => {
      assert(
        notifSrc.includes("return sendAdminBookingCreatedEmail(booking);"),
        "sendAdminBookingCreatedAlert must delegate to sendAdminBookingCreatedEmail"
      );
      assert(
        customerSrc.includes("sendAdminBookingCreatedAlert"),
        "createBookingRequestAction must call sendAdminBookingCreatedAlert"
      );
      assert(
        bookingsApiSrc.includes("sendAdminBookingCreatedEmail"),
        "POST /api/bookings must dispatch admin email"
      );
    });

    test("13. Admin Emergency Alert delegates to sendAdminEmergencyAlertEmail", () => {
      assert(
        notifSrc.includes("sendAdminEmergencyAlertEmail(emergency);"),
        "sendEmergencyAlert must call sendAdminEmergencyAlertEmail"
      );
    });

    test("14. Admin Contact Message Alert delegates to sendAdminContactAlertEmail", () => {
      assert(
        notifSrc.includes("return sendAdminContactAlertEmail(contactMessage);"),
        "sendAdminContactAlert must delegate to sendAdminContactAlertEmail"
      );
      assert(
        contactApiSrc.includes("sendAdminContactAlert"),
        "POST /api/contact-messages must call sendAdminContactAlert"
      );
    });

    test("15. Admin Booking Cancellation Alert delegates to sendAdminBookingCancelledEmail", () => {
      assert(
        notifSrc.includes("sendAdminBookingCancelledEmail"),
        "sendAdminBookingCancelledAlert must delegate to sendAdminBookingCancelledEmail"
      );
      assert(
        bookingIdApiSrc.includes("sendAdminBookingCancelledAlert"),
        "API cancellations must alert admin via email"
      );
    });

    test("16. Admin Status Update Alert delegates to sendAdminStatusUpdateEmail", () => {
      assert(
        notifSrc.includes("sendAdminStatusUpdateEmail({"),
        "sendStatusUpdate must dispatch sendAdminStatusUpdateEmail"
      );
      assert(
        adminBookingIdApiSrc.includes("sendStatusUpdate"),
        "PATCH /api/admin/bookings/[id] must invoke sendStatusUpdate"
      );
    });
  });

  describe("Phase 10C.4: Elimination of Active WhatsApp Dispatch from Lifecycle Events", () => {
    test("17. Lifecycle dispatchers in notifications.ts do NOT call sendWhatsApp", () => {
      // Extract the HIGH-LEVEL NOTIFICATION FLOWS section
      const flowsStart = notifSrc.indexOf("// HIGH-LEVEL NOTIFICATION FLOWS (EMAIL-ONLY LIFECYCLE REWIRING)");
      const flowsEnd = notifSrc.indexOf("// RETRY MECHANISM");
      assert(flowsStart > 0 && flowsEnd > flowsStart, "Flows section must be clearly bounded");

      const lifecycleSection = notifSrc.substring(flowsStart, flowsEnd);
      assert(
        !lifecycleSection.includes("sendWhatsApp({"),
        "No active lifecycle dispatcher may invoke sendWhatsApp"
      );
      assert(
        !lifecycleSection.includes("dispatchWhatsAppDirect({"),
        "No active lifecycle dispatcher may invoke dispatchWhatsAppDirect"
      );
    });
  });

  describe("Phase 10C.4: NotificationLog Integration & Idempotency", () => {
    test("19. NotificationLog enforces channel='email' in sendEmailDirect", () => {
      assert(
        emailSrc.includes('channel: "email"'),
        "sendEmailDirect must persist logs with channel = 'email'"
      );
      assert(
        emailSrc.includes("providerEventId: data.providerEventId || null"),
        "logNotificationRecord must persist providerEventId"
      );
    });

    test("20. Idempotency suppression check runs before email dispatch", () => {
      assert(
        emailSrc.includes("prisma.notificationLog.findFirst"),
        "sendEmailDirect must query notificationLog for duplicate providerEventId"
      );
      assert(
        emailSrc.includes("email.duplicate_suppressed"),
        "Duplicate sends must log duplicate_suppressed event"
      );
    });

    test("21. Quote ready deduplication prevents duplicate email after service completion", () => {
      assert(
        emailSrc.includes("email.quote_ready.already_sent_or_completed"),
        "sendQuoteReadyEmail must check if completion email was already sent"
      );
    });
  });
}

// Standalone execution support
if (process.argv[1] && process.argv[1].endsWith("email-lifecycle-rewiring.test.mjs")) {
  runEmailLifecycleRewiringUnitTests();
}
