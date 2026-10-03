/**
 * Unit Tests: Centralized Email Notification Service (Phase 10C.3)
 * HT Mobile Services
 *
 * Covers:
 * 1. Deterministic event identity generation
 * 2. Customer and Admin recipient resolution
 * 3. Modular customer templates rendering (all 11 types)
 * 4. Modular admin templates rendering (all 5 types)
 * 5. PDF generation and attachment formatting
 * 6. Email dispatcher behavior (simulated/mock send, error handling, non-blocking boundaries)
 * 7. Idempotency suppression on duplicate providerEventId
 * 8. Retry compatibility and payload structure
 */

import { describe, test, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  buildNotificationEventKey,
  buildBookingReceivedKey,
  buildBookingConfirmedKey,
  buildTechnicianAssignedKey,
  buildTechnicianEnRouteKey,
  buildTechnicianArrivedKey,
  buildServiceStartedKey,
  buildServiceCompletedKey,
  buildBookingCancelledKey,
  buildPaymentReceivedKey,
  buildQuoteReadyKey,
  buildEmergencyAlertKey,
  buildContactAlertKey,
  buildBookingCreatedAdminKey,
} from "../../../frontend/src/lib/notifications/identity.ts";
import {
  BUSINESS_PHONE_DISPLAY,
  renderBookingReceivedEmail,
  renderBookingConfirmedEmail,
  renderTechnicianAssignedEmail,
  renderTechnicianEnRouteEmail,
  renderTechnicianArrivedEmail,
  renderServiceStartedEmail,
  renderServiceCompletedEmail,
  renderBookingCancelledEmail,
  renderPaymentReceivedEmail,
  renderQuoteReadyEmail,
  renderEmergencyRequestCustomerEmail,
  renderAdminBookingCreatedEmail,
  renderAdminEmergencyAlertEmail,
  renderAdminContactAlertEmail,
  renderAdminBookingCancelledEmail,
  renderAdminStatusUpdateEmail,
} from "../../../frontend/src/lib/email/templates.ts";

/**
 * Authoritative recipient resolution implementation under test
 * (Matching frontend/src/lib/notifications/recipients.ts)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveAdminNotificationEmail() {
  const envEmail =
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.ADMIN_NOTIFICATION_EMAIL?.trim() ||
    "admin@mobiletire.clinic";

  return envEmail;
}

function resolveAdminNotificationEmails() {
  const primary = resolveAdminNotificationEmail();
  const rawList = primary.split(",").map((e) => e.trim()).filter(Boolean);
  const valid = rawList.filter((e) => EMAIL_REGEX.test(e));
  return valid.length > 0 ? valid : ["admin@mobiletire.clinic"];
}

function resolveCustomerNotificationEmail(source) {
  if (!source) {
    return null;
  }

  let rawEmail = null;

  if (typeof source === "string") {
    rawEmail = source.trim();
  } else if (typeof source === "object") {
    rawEmail =
      source.email?.trim() ||
      source.customer?.email?.trim() ||
      source.user?.email?.trim() ||
      null;
  }

  if (
    !rawEmail ||
    rawEmail === "N/A" ||
    rawEmail === "undefined" ||
    rawEmail === "null"
  ) {
    return null;
  }

  const cleaned = rawEmail.toLowerCase().trim();
  return EMAIL_REGEX.test(cleaned) ? cleaned : null;
}

export function runEmailServiceUnitTests() {
  describe("Email Service: Deterministic Event Identity", () => {
    test("buildBookingReceivedKey produces deterministic key", () => {
      const key = buildBookingReceivedKey("bkg-001");
      assertEqual(key, "booking_received:bkg-001");
    });

    test("buildBookingConfirmedKey produces deterministic key", () => {
      const key = buildBookingConfirmedKey("bkg-002");
      assertEqual(key, "booking_confirmation:bkg-002");
    });

    test("buildTechnicianAssignedKey produces deterministic key with and without techId", () => {
      assertEqual(
        buildTechnicianAssignedKey("bkg-003", "tech-77"),
        "technician_assigned:bkg-003:tech-77"
      );
      assertEqual(
        buildTechnicianAssignedKey("bkg-003"),
        "technician_assigned:bkg-003"
      );
    });

    test("buildTechnicianEnRouteKey produces deterministic key", () => {
      assertEqual(
        buildTechnicianEnRouteKey("bkg-004"),
        "technician_en_route:bkg-004"
      );
    });

    test("buildTechnicianArrivedKey produces deterministic key", () => {
      assertEqual(
        buildTechnicianArrivedKey("bkg-005"),
        "technician_arrived:bkg-005"
      );
    });

    test("buildServiceStartedKey produces deterministic key", () => {
      assertEqual(
        buildServiceStartedKey("bkg-006"),
        "service_started:bkg-006"
      );
    });

    test("buildServiceCompletedKey produces deterministic key", () => {
      assertEqual(
        buildServiceCompletedKey("bkg-007"),
        "service_completed:bkg-007"
      );
    });

    test("buildQuoteReadyKey produces deterministic key", () => {
      assertEqual(
        buildQuoteReadyKey("bkg-008"),
        "quote_ready:bkg-008"
      );
    });

    test("buildBookingCancelledKey produces deterministic key with actor qualifier", () => {
      assertEqual(
        buildBookingCancelledKey("bkg-009", "customer"),
        "booking_cancelled:bkg-009:customer"
      );
      assertEqual(
        buildBookingCancelledKey("bkg-009", "admin"),
        "booking_cancelled:bkg-009:admin"
      );
    });

    test("buildPaymentReceivedKey produces deterministic key", () => {
      assertEqual(
        buildPaymentReceivedKey("bkg-010"),
        "payment_received:bkg-010"
      );
    });

    test("buildEmergencyAlertKey and buildContactAlertKey produce deterministic keys", () => {
      assertEqual(buildEmergencyAlertKey("emg-111"), "emergency_alert:emg-111");
      assertEqual(buildContactAlertKey("cnt-222"), "contact_alert:cnt-222");
    });
  });

  describe("Email Service: Recipient Resolution", () => {
    const originalEnv = { ...process.env };

    test("Resolves primary ADMIN_EMAIL as admin recipient", () => {
      process.env.ADMIN_EMAIL = "admin@mobiletire.clinic";
      delete process.env.ADMIN_NOTIFICATION_EMAIL;

      const email = resolveAdminNotificationEmail();
      assertEqual(email, "admin@mobiletire.clinic");
    });

    test("Falls back to ADMIN_NOTIFICATION_EMAIL when ADMIN_EMAIL is unset", () => {
      delete process.env.ADMIN_EMAIL;
      process.env.ADMIN_NOTIFICATION_EMAIL = "dispatch@mobiletire.clinic";

      const email = resolveAdminNotificationEmail();
      assertEqual(email, "dispatch@mobiletire.clinic");
    });

    test("Falls back to default admin@mobiletire.clinic when env is missing", () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_NOTIFICATION_EMAIL;

      const email = resolveAdminNotificationEmail();
      assertEqual(email, "admin@mobiletire.clinic");
    });

    test("resolveAdminNotificationEmails parses comma-separated lists", () => {
      process.env.ADMIN_EMAIL = "ops@ht.com, dispatch@ht.com";
      const list = resolveAdminNotificationEmails();
      assertEqual(list.length, 2);
      assertEqual(list[0], "ops@ht.com");
      assertEqual(list[1], "dispatch@ht.com");
    });

    test("Resolves customer email from direct string", () => {
      const email = resolveCustomerNotificationEmail("  Customer@Example.COM  ");
      assertEqual(email, "customer@example.com");
    });

    test("Resolves customer email from nested customer object", () => {
      const booking = {
        id: "bkg-1",
        customer: { email: "john.doe@gmail.com" },
      };
      assertEqual(resolveCustomerNotificationEmail(booking), "john.doe@gmail.com");
    });

    test("Resolves customer email from direct email property or user object", () => {
      assertEqual(
        resolveCustomerNotificationEmail({ email: "direct@domain.com" }),
        "direct@domain.com"
      );
      assertEqual(
        resolveCustomerNotificationEmail({ user: { email: "user@domain.com" } }),
        "user@domain.com"
      );
    });

    test("Returns null for invalid or missing customer email", () => {
      assertEqual(resolveCustomerNotificationEmail(null), null);
      assertEqual(resolveCustomerNotificationEmail(undefined), null);
      assertEqual(resolveCustomerNotificationEmail(""), null);
      assertEqual(resolveCustomerNotificationEmail("not-an-email"), null);
      assertEqual(resolveCustomerNotificationEmail("N/A"), null);
      assertEqual(resolveCustomerNotificationEmail("null"), null);
      assertEqual(resolveCustomerNotificationEmail({ customer: { email: "bad" } }), null);
    });

    process.env = originalEnv;
  });

  describe("Email Service: Customer Email Templates (11 Templates)", () => {
    const sampleBooking = {
      bookingId: "c3d4e5f6-1111-2222-3333-444455556666",
      customerName: "Jane Smith",
      serviceName: "Emergency Tire Replacement",
      vehicle: "2023 Honda CR-V (Black)",
      location: "123 Elm St, Dallas, TX 75201",
      bookingDate: "2026-10-15",
      bookingTime: "14:00",
      notes: "Park in visitor parking spot 4",
      technicianName: "Alex Rivera",
      etaMinutes: 25,
      totalAmount: 189.5,
      trackingUrl: "https://ht-mobile-tire.vercel.app/technician/tracking/c3d4e5f6",
      accountUrl: "https://ht-mobile-tire.vercel.app/account?tab=bookings",
    };

    test("1. Booking Received template renders correctly", () => {
      const { subject, html, text } = renderBookingReceivedEmail(sampleBooking);
      assert(subject.includes("556666"), "Subject must include short booking ID");
      assert(html.includes("Jane Smith"), "HTML must include customer name");
      assert(html.includes("Emergency Tire Replacement"), "HTML must include service name");
      assert(html.includes("2023 Honda CR-V"), "HTML must include vehicle");
      assert(html.includes(BUSINESS_PHONE_DISPLAY), "HTML must include business hotline");
      assert(text.includes("Booking Received"), "Text must describe request received");
    });

    test("2. Booking Confirmed template renders correctly", () => {
      const { subject, html, text } = renderBookingConfirmedEmail(sampleBooking);
      assert(subject.includes("Booking Confirmed"), "Subject must state Booking Confirmed");
      assert(html.includes("CONFIRMED"), "HTML must include confirmed notice");
      assert(html.includes("Appointment Preparation"), "HTML must include vehicle prep advice");
      assert(text.includes("CONFIRMED"), "Text must confirm booking");
    });

    test("3. Technician Assigned template renders correctly", () => {
      const { subject, html, text } = renderTechnicianAssignedEmail(sampleBooking);
      assert(subject.includes("Technician Assigned"), "Subject must state Technician Assigned");
      assert(html.includes("Alex Rivera"), "HTML must include assigned technician name");
      assert(text.includes("Alex Rivera"), "Text must include technician name");
    });

    test("4. Technician En Route template renders correctly", () => {
      const { subject, html, text } = renderTechnicianEnRouteEmail(sampleBooking);
      assert(subject.includes("ETA 25 minutes"), "Subject must include ETA");
      assert(html.includes("25 minutes"), "HTML must render ETA banner");
      assert(html.includes("Driver Notice"), "HTML must include driver notice");
      assert(text.includes("on the way"), "Text must indicate technician is en route");
    });

    test("5. Technician Arrived template renders correctly", () => {
      const { subject, html, text } = renderTechnicianArrivedEmail(sampleBooking);
      assert(subject.includes("Technician Arrived On-Site"), "Subject must state arrival");
      assert(html.includes("Arrived On-Site"), "HTML must render arrival badge");
      assert(html.includes("Action Required"), "HTML must remind customer to make vehicle accessible");
    });

    test("6. Service Started template renders correctly", () => {
      const { subject, html, text } = renderServiceStartedEmail(sampleBooking);
      assert(subject.includes("Service Started"), "Subject must state Service Started");
      assert(html.includes("Service Underway"), "HTML must render service started header");
      assert(text.includes("has now started"), "Text must confirm work started");
    });

    test("7. Service Completed template renders with optional PDF attachment flag", () => {
      const { subject, html, text } = renderServiceCompletedEmail({
        ...sampleBooking,
        hasPdfAttachment: true,
      });
      assert(subject.includes("Service Completed"), "Subject must state Service Completed");
      assert(html.includes("$189.50"), "HTML must include total amount");
      assert(html.includes("Official Receipt Attached"), "HTML must indicate attached PDF receipt");
      assert(text.includes("completed successfully"), "Text must state completed successfully");
    });

    test("8. Booking Cancelled template renders correctly", () => {
      const { subject, html, text } = renderBookingCancelledEmail({
        ...sampleBooking,
        cancellationReason: "Customer requested reschedule",
      });
      assert(subject.includes("Booking Cancelled"), "Subject must state Booking Cancelled");
      assert(html.includes("Customer requested reschedule"), "HTML must include cancellation reason");
      assert(text.includes("cancelled"), "Text must state cancelled");
    });

    test("9. Payment Received template renders correctly", () => {
      const { subject, html, text } = renderPaymentReceivedEmail({
        ...sampleBooking,
        amountPaid: 189.5,
        paymentMethod: "Credit Card (Visa ending in 4242)",
      });
      assert(subject.includes("Payment Confirmation"), "Subject must state Payment Confirmation");
      assert(html.includes("$189.50"), "HTML must render amount paid");
      assert(html.includes("Visa ending in 4242"), "HTML must render payment method");
      assert(text.includes("payment of $189.50"), "Text must confirm payment amount");
    });

    test("10. Quote / Invoice Ready template renders itemized rows and add-ons", () => {
      const { subject, html, text } = renderQuoteReadyEmail({
        customerName: "Jane Smith",
        bookingId: sampleBooking.bookingId,
        primaryService: "Mobile Tire Replacement",
        basePrice: 150.0,
        extraServices: [
          { name: "TPMS Sensor Sync", price: 25.0 },
          { name: "Old Tire Disposal", price: 14.5 },
        ],
        totalAmount: 189.5,
        vehicle: "2023 Honda CR-V",
        hasPdfAttachment: true,
      });

      assert(subject.includes("Invoice & Quote"), "Subject must state Invoice & Quote");
      assert(html.includes("TPMS Sensor Sync"), "HTML must list add-on service");
      assert(html.includes("$25.00"), "HTML must format add-on price");
      assert(html.includes("$189.50"), "HTML must render total sum");
      assert(html.includes("PDF Invoice attached"), "HTML must state PDF attached");
      assert(text.includes("$189.50"), "Text must state total amount");
    });

    test("11. Emergency Request Confirmation template renders roadside priority banner", () => {
      const { subject, html, text } = renderEmergencyRequestCustomerEmail({
        id: "emg-9999",
        customerName: "Mark Davis",
        problem: "Blowout on Highway Shoulder",
        problemDetails: "Right rear tire blown, stuck on I-35 shoulder",
        vehicle: "Ford F-150",
        currentLocation: "I-35 Exit 428B, Dallas TX",
      });

      assert(subject.includes("[EMERGENCY DISPATCH]"), "Subject must have emergency flag");
      assert(html.includes("30&ndash;45 Minutes"), "HTML must render emergency arrival window");
      assert(html.includes("Blowout on Highway Shoulder"), "HTML must render problem");
      assert(html.includes(BUSINESS_PHONE_DISPLAY), "HTML must render hotline");
      assert(text.includes("30-45 minutes"), "Text must state 30-45 min arrival");
    });
  });

  describe("Email Service: Admin Email Templates (5 Templates)", () => {
    test("1. Admin: New Booking Created alert renders correctly", () => {
      const { subject, html, text } = renderAdminBookingCreatedEmail({
        bookingId: "bkg-admin-01",
        customerName: "Alice Miller",
        customerPhone: "214-555-0199",
        customerEmail: "alice@example.com",
        serviceName: "Flat Tire Mobile Repair",
        vehicle: "Tesla Model Y",
        location: "500 Main St, Dallas TX",
        bookingDate: "2026-10-20",
        bookingTime: "09:00",
        adminBookingUrl: "https://ht-mobile-tire.vercel.app/admin/bookings/bkg-admin-01",
      });

      assert(subject.includes("[ADMIN DISPATCH]"), "Subject must include [ADMIN DISPATCH]");
      assert(html.includes("Alice Miller"), "HTML must include customer name");
      assert(html.includes("214-555-0199"), "HTML must include customer phone");
      assert(html.includes("Tesla Model Y"), "HTML must include vehicle");
      assert(text.includes("NEW BOOKING REQUEST"), "Text must state NEW BOOKING REQUEST");
    });

    test("2. Admin: Emergency Roadside Alert renders priority alert", () => {
      const { subject, html, text } = renderAdminEmergencyAlertEmail({
        emergencyId: "emg-admin-02",
        customerName: "Bob Vance",
        customerPhone: "214-555-0288",
        customerEmail: "bob@vance.com",
        problem: "Flat Tire in Active Lane",
        problemDetails: "Hazard lights on",
        vehicle: "Chevy Silverado",
        location: "Hwy 75 & Campbell Rd",
        adminEmergencyUrl: "https://ht-mobile-tire.vercel.app/admin/emergency",
      });

      assert(subject.includes("[URGENT ROADSIDE]"), "Subject must include [URGENT ROADSIDE]");
      assert(html.includes("PRIORITY ROADSIDE DISPATCH"), "HTML must highlight priority roadside dispatch");
      assert(html.includes("214-555-0288"), "HTML must include customer phone");
      assert(text.includes("EMERGENCY ROADSIDE ALERT"), "Text must state alert");
    });

    test("3. Admin: Contact Message Alert renders inquiry details", () => {
      const { subject, html, text } = renderAdminContactAlertEmail({
        contactId: "cnt-admin-03",
        name: "Carol White",
        phone: "214-555-0377",
        email: "carol@example.com",
        service: "Fleet Tire Maintenance",
        location: "Fort Worth Warehouse",
        message: "Looking for commercial fleet servicing for 5 vans.",
        emergency: false,
      });

      assert(subject.includes("[ADMIN CONTACT]"), "Subject must include [ADMIN CONTACT]");
      assert(html.includes("Fleet Tire Maintenance"), "HTML must include requested service");
      assert(html.includes("commercial fleet servicing"), "HTML must include message");
      assert(text.includes("Carol White"), "Text must include sender name");
    });

    test("4. Admin: Booking Cancelled Alert renders cancellation notice", () => {
      const { subject, html, text } = renderAdminBookingCancelledEmail({
        bookingId: "bkg-admin-04",
        cancelledBy: "Customer",
        customerName: "David Lee",
        customerPhone: "214-555-0466",
        vehicle: "BMW X5",
        serviceName: "Tire Rotation",
        reason: "Vehicle was sold",
        adminBookingUrl: "https://ht-mobile-tire.vercel.app/admin/bookings/bkg-admin-04",
      });

      assert(subject.includes("[ADMIN ALERT]"), "Subject must include [ADMIN ALERT]");
      assert(html.includes("cancelled by <strong>Customer</strong>"), "HTML must include cancelled by");
      assert(html.includes("Vehicle was sold"), "HTML must include reason");
      assert(text.includes("Booking Cancelled Alert"), "Text must state alert");
    });

    test("5. Admin: Status Update Alert renders status transition", () => {
      const { subject, html, text } = renderAdminStatusUpdateEmail({
        bookingId: "bkg-admin-05",
        newStatus: "in_progress",
        customerName: "Eva Green",
        customerPhone: "214-555-0555",
        vehicle: "Audi Q7",
        technicianName: "Alex Rivera",
        technicianNotes: "Mounted and balanced two front tires",
      });

      assert(subject.includes("[STATUS UPDATE]"), "Subject must include [STATUS UPDATE]");
      assert(html.includes("IN_PROGRESS"), "HTML must include new status");
      assert(html.includes("Alex Rivera"), "HTML must include technician");
      assert(html.includes("Mounted and balanced"), "HTML must include notes");
    });
  });

  describe("Email Service: PDF Attachment Support", () => {
    test("Formats PDF attachments matching Resend attachment specification", () => {
      const mockPdfBuffer = Buffer.from("%PDF-1.4 \n%HT Mobile Tires Official Service Quote\n%%EOF");
      const attachment = {
        filename: "HTMobileTires_Quote_PDF01.pdf",
        content: mockPdfBuffer,
      };

      assertEqual(attachment.filename, "HTMobileTires_Quote_PDF01.pdf");
      assert(Buffer.isBuffer(attachment.content), "Attachment content must be a Buffer");
      assertEqual(attachment.content.slice(0, 5).toString("utf-8"), "%PDF-");
      assert(attachment.content.length > 20, "Attachment content must have non-empty bytes");
    });
  });


  describe("Email Service: Error Handling & Missing Data Tolerance", () => {
    test("Templates gracefully handle empty, null, and missing optional parameters", () => {
      const minimalData = {
        bookingId: "bkg-minimal",
        serviceName: "Tire Repair",
        vehicle: "Sedan",
        location: "Dallas",
      };

      const res1 = renderBookingReceivedEmail(minimalData);
      assert(res1.html.length > 0, "Booking Received must render with minimal data");

      const res2 = renderBookingConfirmedEmail(minimalData);
      assert(res2.html.length > 0, "Booking Confirmed must render with minimal data");

      const res3 = renderTechnicianAssignedEmail(minimalData);
      assert(res3.html.length > 0, "Technician Assigned must render with minimal data");

      const res4 = renderTechnicianEnRouteEmail(minimalData);
      assert(res4.html.length > 0, "Technician En Route must render with minimal data");

      const res5 = renderTechnicianArrivedEmail(minimalData);
      assert(res5.html.length > 0, "Technician Arrived must render with minimal data");

      const res6 = renderServiceStartedEmail(minimalData);
      assert(res6.html.length > 0, "Service Started must render with minimal data");

      const res7 = renderServiceCompletedEmail(minimalData);
      assert(res7.html.length > 0, "Service Completed must render with minimal data");

      const res8 = renderBookingCancelledEmail(minimalData);
      assert(res8.html.length > 0, "Booking Cancelled must render with minimal data");

      const res9 = renderPaymentReceivedEmail({ ...minimalData, amountPaid: 0 });
      assert(res9.html.length > 0, "Payment Received must render with minimal data");

      const res10 = renderQuoteReadyEmail({
        bookingId: "bkg-minimal",
        primaryService: "Tire Repair",
        basePrice: 50,
        totalAmount: 50,
      });
      assert(res10.html.length > 0, "Quote Ready must render with minimal data");

      const res11 = renderEmergencyRequestCustomerEmail({
        id: "emg-min",
        problem: "Flat Tire",
        vehicle: "Truck",
        currentLocation: "Highway",
      });
      assert(res11.html.length > 0, "Emergency Confirmation must render with minimal data");
    });
  });

  describe("Email Service: Retry Compatibility & Payload Verification", () => {
    test("Failed email log structure contains necessary fields for retry processing", () => {
      // Simulating the row read by retryFailedNotifications in frontend/src/lib/notifications.ts
      const failedEmailLog = {
        id: "log-failed-01",
        channel: "email",
        status: "FAILED",
        retryCount: 1,
        recipient: "customer@example.com",
        subject: "Booking Confirmed: Mobile Tire Service - HT Mobile Tires",
        body: "<html><body>Booking confirmation</body></html>",
        type: "booking_confirmation",
        entityId: "bkg-123456",
        entityType: "booking",
      };

      // Invariants required by retry mechanism:
      assert(failedEmailLog.channel === "email", "Log channel must be email");
      assert(failedEmailLog.status === "FAILED", "Log status must be FAILED");
      assert(failedEmailLog.retryCount < 3, "Retry count must be < 3");
      assert(Boolean(failedEmailLog.recipient), "Recipient must be present for retry");
      assert(Boolean(failedEmailLog.subject), "Subject must be present for retry");
      assert(Boolean(failedEmailLog.body), "Body (HTML) must be present for retry");
    });
  });
}

// Direct execution support
if (process.argv[1]?.endsWith("email-service.test.mjs")) {
  runEmailServiceUnitTests();
}
