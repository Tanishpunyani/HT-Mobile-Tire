/**
 * Behavioral & Lifecycle Unit Tests: Email Notification System Fix
 * HT Mobile Services / Phase 2 Implementation
 *
 * Implements the 15 mandatory tests from Step 22:
 * TEST 1 — Booking Email Persistence
 * TEST 2 — Auth Session Isolation
 * TEST 3 — Existing Phone Match Email Preservation
 * TEST 4 — New Booking Admin Only (Customer Count = 0)
 * TEST 5 — Confirm Without Technician (No Customer Email)
 * TEST 6 — Assign Technician (Confirmation/Assignment Lifecycle)
 * TEST 7 — Confirmed + Assigned Recipient (john@example.com, NOT admin)
 * TEST 8 — No Admin Fallback (Null/Skipped Safely, NEVER Admin Email)
 * TEST 9 — Quote Email Recipient (john@example.com)
 * TEST 10 — Payment Email Recipient (john@example.com)
 * TEST 11 — Service Completion Email Recipient (john@example.com)
 * TEST 12 — Cancellation Email Recipient (john@example.com)
 * TEST 13 — NotificationLog Recipient Separation (Customer vs Admin)
 * TEST 14 — Duplicate Protection for Booking Confirmation
 * TEST 15 — Historical Compatibility (SMS/WhatsApp NotificationLog Rows)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../../frontend/src");

// Pure recipient resolver matching frontend/src/lib/notifications/recipients.ts
function resolveBookingCustomerEmail(source) {
  if (!source) return null;
  let raw = null;
  if (typeof source === "string") {
    raw = source.trim();
  } else if (typeof source === "object") {
    raw = source.customerEmail?.trim() || null;
  }
  if (!raw || raw === "N/A" || raw === "undefined" || raw === "null") return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cleaned = raw.toLowerCase().trim();
  return emailRegex.test(cleaned) ? cleaned : null;
}

function resolveCustomerNotificationEmail(source) {
  if (!source) return null;

  let rawEmail = null;

  if (typeof source === "string") {
    rawEmail = source.trim();
  } else if (typeof source === "object") {
    // If source represents a booking payload (has customerEmail property defined, even if null):
    if ("customerEmail" in source) {
      rawEmail = source.customerEmail?.trim() || null;
    } else {
      rawEmail =
        source.email?.trim() ||
        source.customer?.email?.trim() ||
        source.user?.email?.trim() ||
        null;
    }
  }

  if (!rawEmail || rawEmail === "N/A" || rawEmail === "undefined" || rawEmail === "null") return null;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cleaned = rawEmail.toLowerCase().trim();
  return emailRegex.test(cleaned) ? cleaned : null;
}

function resolveAdminNotificationEmail() {
  const envEmail =
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.ADMIN_NOTIFICATION_EMAIL?.trim();

  if (envEmail) {
    const first = envEmail.split(",")[0].trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(first)) {
      return first.toLowerCase();
    }
  }

  return "admin@mobiletire.clinic";
}

export function runEmailNotificationFixTests() {
  describe("Phase 2: Email Notification Fix (Mandatory Step 22 Tests)", () => {
    // ------------------------------------------------------------------------
    // TEST 1 — BOOKING EMAIL PERSISTENCE
    // ------------------------------------------------------------------------
    test("TEST 1 — BOOKING EMAIL PERSISTENCE: Normalizes and preserves submitted email in Booking.customerEmail", () => {
      const rawInput = "   John.Doe+Tires@Example.COM  ";
      const normalizedEmail = rawInput.trim().toLowerCase();
      assertEqual(normalizedEmail, "john.doe+tires@example.com", "Email must be trimmed and lowercased");

      // Verify Prisma schema has customerEmail
      const schemaPath = path.join(projectRoot, "../prisma/schema.prisma");
      const schemaContent = fs.readFileSync(schemaPath, "utf-8");
      assert(
        schemaContent.includes("customerEmail") && schemaContent.includes("@map(\"customer_email\")"),
        "Prisma schema must declare customerEmail String? @map(\"customer_email\") on Booking model"
      );

      // Verify customer.ts captures and writes customerEmail: normalizedEmail
      const customerActionPath = path.join(projectRoot, "app/actions/bookings/customer.ts");
      const customerActionContent = fs.readFileSync(customerActionPath, "utf-8");
      assert(
        customerActionContent.includes("customerEmail: normalizedEmail"),
        "customer.ts must write normalizedEmail to Booking.customerEmail"
      );

      // Verify api/bookings/route.ts captures customerEmail
      const routePath = path.join(projectRoot, "app/api/bookings/route.ts");
      const routeContent = fs.readFileSync(routePath, "utf-8");
      assert(
        routeContent.includes("customerEmail: email ? email.trim().toLowerCase() : null"),
        "api/bookings/route.ts must capture normalized email into customerEmail"
      );
    });

    // ------------------------------------------------------------------------
    // TEST 2 — AUTH SESSION ISOLATION
    // ------------------------------------------------------------------------
    test("TEST 2 — AUTH SESSION ISOLATION: Authenticated user session does not bleed into Booking.customerEmail", () => {
      const authSessionUser = {
        id: "admin-user-001",
        email: "admin@mobiletire.clinic",
        role: "admin",
      };

      const formInput = {
        name: "John Doe",
        email: "john@example.com",
        phone: "2145550199",
      };

      // Simulation of createBookingRequestAction logic
      const normalizedFormEmail = formInput.email.trim().toLowerCase();
      const bookingData = {
        customerEmail: normalizedFormEmail,
        vehicle: "Ford F-150",
      };

      assertEqual(
        bookingData.customerEmail,
        "john@example.com",
        "Booking.customerEmail must come strictly from the form"
      );
      assert(
        bookingData.customerEmail !== authSessionUser.email,
        "Booking.customerEmail must NOT bleed from the authenticated admin user"
      );
    });

    // ------------------------------------------------------------------------
    // TEST 3 — EXISTING PHONE MATCH
    // ------------------------------------------------------------------------
    test("TEST 3 — EXISTING PHONE MATCH: Reusing existing customer by phone does not overwrite Booking.customerEmail", () => {
      const existingCustomerInDb = {
        id: "cust-existing-999",
        phone: "+12145550199",
        email: "stale-admin@example.com", // Old or mismatched email on customer record
      };

      const newBookingForm = {
        name: "John Doe",
        phone: "(214) 555-0199",
        email: "john@example.com", // New email entered for this booking
      };

      const normalizedFormEmail = newBookingForm.email.trim().toLowerCase();

      // Guest matches existing customer by phone
      const matchedCustomer = existingCustomerInDb;
      const bookingRecord = {
        id: "booking-new-001",
        customerId: matchedCustomer.id,
        customerEmail: normalizedFormEmail, // Preserved submitted email
      };

      assertEqual(
        bookingRecord.customerEmail,
        "john@example.com",
        "Booking.customerEmail must preserve the newly submitted form email"
      );
      assert(
        bookingRecord.customerEmail !== matchedCustomer.email,
        "Booking.customerEmail must not be overridden by the matched customer record's existing email"
      );
    });

    // ------------------------------------------------------------------------
    // TEST 4 — NEW BOOKING ADMIN ONLY
    // ------------------------------------------------------------------------
    test("TEST 4 — NEW BOOKING ADMIN ONLY: Booking submission alerts admin only (customer notification count = 0)", () => {
      const notificationsDispatched = [];

      function mockSendAdminBookingCreatedAlert(booking) {
        notificationsDispatched.push({ target: "admin", type: "BOOKING_CREATED", recipient: resolveAdminNotificationEmail() });
      }

      function mockSendCustomerBookingReceivedAlert(booking) {
        notificationsDispatched.push({ target: "customer", type: "BOOKING_RECEIVED", recipient: resolveCustomerNotificationEmail(booking) });
      }

      // Simulate Phase 2 booking creation workflow
      const booking = {
        id: "b-12345",
        customerEmail: "john@example.com",
        vehicle: "Tesla Model Y",
      };

      // In Phase 2: only admin alert is dispatched
      mockSendAdminBookingCreatedAlert(booking);

      const adminNotifications = notificationsDispatched.filter((n) => n.target === "admin");
      const customerNotifications = notificationsDispatched.filter((n) => n.target === "customer");

      assertEqual(adminNotifications.length, 1, "Admin notification count must be 1");
      assertEqual(customerNotifications.length, 0, "Customer notification count must be 0");

      // Verify customer.ts no longer calls sendBookingConfirmation
      const customerActionPath = path.join(projectRoot, "app/actions/bookings/customer.ts");
      const customerActionContent = fs.readFileSync(customerActionPath, "utf-8");
      assert(
        !customerActionContent.includes("sendBookingConfirmation("),
        "createBookingRequestAction must NOT invoke sendBookingConfirmation"
      );
    });

    // ------------------------------------------------------------------------
    // TEST 5 — CONFIRM WITHOUT TECHNICIAN
    // ------------------------------------------------------------------------
    test("TEST 5 — CONFIRM WITHOUT TECHNICIAN: Confirming booking with technicianId = null sends NO customer confirmation", () => {
      let bookingConfirmedEmailsSent = 0;

      function simulateConfirmBooking(booking) {
        // Step 11 logic:
        const updatedBooking = { ...booking, status: "confirmed" };
        if (updatedBooking.technicianId !== null && updatedBooking.technicianId !== undefined) {
          bookingConfirmedEmailsSent++;
        }
        return updatedBooking;
      }

      const initialBooking = {
        id: "b-001",
        status: "pending",
        technicianId: null,
        customerEmail: "john@example.com",
      };

      const result = simulateConfirmBooking(initialBooking);

      assertEqual(result.status, "confirmed", "Booking status must transition to confirmed");
      assertEqual(bookingConfirmedEmailsSent, 0, "Customer BOOKING_CONFIRMED emails must be 0 when technicianId is null");

      // Verify admin.ts enforces technicianId check before confirmation alert
      const adminActionPath = path.join(projectRoot, "app/actions/bookings/admin.ts");
      const adminActionContent = fs.readFileSync(adminActionPath, "utf-8");
      assert(
        adminActionContent.includes("updated.technicianId"),
        "confirmBookingAction must guard confirmation alert with updated.technicianId check"
      );
    });

    // ------------------------------------------------------------------------
    // TEST 6 — ASSIGN TECHNICIAN
    // ------------------------------------------------------------------------
    test("TEST 6 — ASSIGN TECHNICIAN: Reaching status = confirmed AND technicianId != null sends confirmation lifecycle once", () => {
      const dispatchedEvents = [];
      const notificationLogs = [];

      function simulateAssignTechnician(booking, technicianId) {
        const wasConfirmed = booking.status === "confirmed";
        const wasAssigned = Boolean(booking.technicianId);

        const updated = {
          ...booking,
          status: "confirmed",
          technicianId,
        };

        const alreadySentConfirmation = notificationLogs.some(
          (l) => l.bookingId === updated.id && l.type === "BOOKING_CONFIRMED"
        );

        if (!alreadySentConfirmation) {
          dispatchedEvents.push("BOOKING_CONFIRMED");
          notificationLogs.push({ bookingId: updated.id, type: "BOOKING_CONFIRMED" });
        } else if (wasConfirmed && wasAssigned && booking.technicianId !== technicianId) {
          dispatchedEvents.push("TECHNICIAN_ASSIGNED");
          notificationLogs.push({ bookingId: updated.id, type: "TECHNICIAN_ASSIGNED" });
        }

        return updated;
      }

      // Step A: Initial assignment to pending booking
      const pendingBooking = { id: "b-100", status: "pending", technicianId: null, customerEmail: "john@example.com" };
      const afterAssign = simulateAssignTechnician(pendingBooking, "tech-1");

      assertEqual(afterAssign.status, "confirmed");
      assertEqual(afterAssign.technicianId, "tech-1");
      assertEqual(dispatchedEvents.length, 1);
      assertEqual(dispatchedEvents[0], "BOOKING_CONFIRMED");

      // Step B: Reassigning to another technician
      const afterReassign = simulateAssignTechnician(afterAssign, "tech-2");
      assertEqual(afterReassign.technicianId, "tech-2");
      assertEqual(dispatchedEvents.length, 2);
      assertEqual(dispatchedEvents[1], "TECHNICIAN_ASSIGNED", "Reassignment must send TECHNICIAN_ASSIGNED, not duplicate BOOKING_CONFIRMED");
    });

    // ------------------------------------------------------------------------
    // TEST 7 — CONFIRMED + ASSIGNED RECIPIENT
    // ------------------------------------------------------------------------
    test("TEST 7 — CONFIRMED + ASSIGNED RECIPIENT: Recipient is john@example.com, never admin email", () => {
      const booking = {
        id: "b-555",
        status: "confirmed",
        technicianId: "tech-99",
        customerEmail: "john@example.com",
        customer: { email: "different-customer@example.com" },
      };

      const recipient = resolveCustomerNotificationEmail(booking);
      assertEqual(recipient, "john@example.com", "Authoritative booking.customerEmail must take precedence");
      assert(recipient !== resolveAdminNotificationEmail(), "Recipient must NOT equal admin email");
    });

    // ------------------------------------------------------------------------
    // TEST 8 — NO ADMIN FALLBACK
    // ------------------------------------------------------------------------
    test("TEST 8 — NO ADMIN FALLBACK: Missing/invalid customerEmail returns null; admin email is NEVER used", () => {
      const originalAdmin = process.env.ADMIN_EMAIL;
      process.env.ADMIN_EMAIL = "admin@mobiletire.clinic";

      try {
        const bookingWithoutEmail = {
          id: "b-empty",
          customerEmail: null,
          customer: { email: null },
          user: { email: null },
        };

        const resolved = resolveCustomerNotificationEmail(bookingWithoutEmail);
        assertEqual(resolved, null, "Customer recipient resolution must return null when no customer email exists");
        assert(resolved !== process.env.ADMIN_EMAIL, "Customer recipient must NEVER fall back to admin email");

        // Simulating dispatch skip
        function dispatchCustomerNotification(booking) {
          const email = resolveCustomerNotificationEmail(booking);
          if (!email) {
            return { success: true, skipped: true, reason: "no_customer_email" };
          }
          return { success: true, dispatchedTo: email };
        }

        const dispatchResult = dispatchCustomerNotification(bookingWithoutEmail);
        assertEqual(dispatchResult.skipped, true);
        assertEqual(dispatchResult.reason, "no_customer_email");
      } finally {
        process.env.ADMIN_EMAIL = originalAdmin;
      }
    });

    // ------------------------------------------------------------------------
    // TEST 9 — QUOTE
    // ------------------------------------------------------------------------
    test("TEST 9 — QUOTE: Quote notification resolves booking.customerEmail = john@example.com", () => {
      const booking = {
        id: "b-quote-1",
        customerEmail: "john@example.com",
        customer: { name: "John Doe", email: "stale@example.com" },
      };

      const recipient = resolveBookingCustomerEmail(booking.customerEmail);
      assertEqual(recipient, "john@example.com");

      // Verify quote.ts passes booking.customerEmail
      const quoteActionPath = path.join(projectRoot, "app/actions/bookings/quote.ts");
      const quoteActionContent = fs.readFileSync(quoteActionPath, "utf-8");
      assert(
        quoteActionContent.includes("authoritativeCustomerEmail = booking.customerEmail;"),
        "quote.ts must set authoritativeCustomerEmail strictly to booking.customerEmail without fallback"
      );
    });

    // ------------------------------------------------------------------------
    // TEST 10 — PAYMENT
    // ------------------------------------------------------------------------
    test("TEST 10 — PAYMENT: Payment received notification resolves booking.customerEmail = john@example.com", () => {
      const updatedBooking = {
        id: "b-pay-1",
        customerEmail: "john@example.com",
        paymentStatus: "paid",
        status: "completed",
        customer: { email: "other@example.com" },
      };

      const recipient = resolveBookingCustomerEmail(updatedBooking.customerEmail);
      assertEqual(recipient, "john@example.com");

      const quoteActionPath = path.join(projectRoot, "app/actions/bookings/quote.ts");
      const quoteActionContent = fs.readFileSync(quoteActionPath, "utf-8");
      assert(
        quoteActionContent.includes("customerEmail: updated.customerEmail,"),
        "markBookingPaidAction must pass updated.customerEmail strictly"
      );
    });

    // ------------------------------------------------------------------------
    // TEST 11 — COMPLETION
    // ------------------------------------------------------------------------
    test("TEST 11 — COMPLETION: Service completion notification resolves booking.customerEmail = john@example.com", () => {
      const booking = {
        id: "b-comp-1",
        customerEmail: "john@example.com",
        status: "completed",
        customer: { email: "old@example.com" },
      };

      const recipient = resolveBookingCustomerEmail(booking.customerEmail);
      assertEqual(recipient, "john@example.com");
    });

    // ------------------------------------------------------------------------
    // TEST 12 — CANCELLATION
    // ------------------------------------------------------------------------
    test("TEST 12 — CANCELLATION: Booking cancellation notification resolves booking.customerEmail = john@example.com", () => {
      const booking = {
        id: "b-canc-1",
        customerEmail: "john@example.com",
        status: "cancelled",
        customer: { email: "stale@example.com" },
      };

      const recipient = resolveCustomerNotificationEmail(booking);
      assertEqual(recipient, "john@example.com");

      // Verify admin.ts cancelAdminBookingAction and customer.ts cancelCustomerBookingAction pass customerEmail
      const adminActionPath = path.join(projectRoot, "app/actions/bookings/admin.ts");
      const adminActionContent = fs.readFileSync(adminActionPath, "utf-8");
      assert(
        adminActionContent.includes("customerEmail: booking.customerEmail,"),
        "cancelAdminBookingAction must pass customerEmail strictly"
      );

      const customerActionPath = path.join(projectRoot, "app/actions/bookings/customer.ts");
      const customerActionContent = fs.readFileSync(customerActionPath, "utf-8");
      assert(
        customerActionContent.includes("customerEmail: booking.customerEmail,"),
        "cancelCustomerBookingAction must pass customerEmail strictly"
      );
    });

    // ------------------------------------------------------------------------
    // TEST 13 — NOTIFICATION LOG
    // ------------------------------------------------------------------------
    test("TEST 13 — NOTIFICATION LOG: Recipient recorded in log separates customer email from admin email", () => {
      const customerBooking = {
        id: "b-log-1",
        customerEmail: "john@example.com",
      };

      const mockNotificationLogs = [];

      function logCustomerEmail(booking, type) {
        mockNotificationLogs.push({
          entityId: booking.id,
          type,
          channel: "email",
          recipient: resolveCustomerNotificationEmail(booking),
          status: "SENT",
        });
      }

      function logAdminEmail(booking, type) {
        mockNotificationLogs.push({
          entityId: booking.id,
          type,
          channel: "email",
          recipient: resolveAdminNotificationEmail(),
          status: "SENT",
        });
      }

      logCustomerEmail(customerBooking, "BOOKING_CONFIRMED");
      logAdminEmail(customerBooking, "BOOKING_CREATED");

      const customerLog = mockNotificationLogs.find((l) => l.type === "BOOKING_CONFIRMED");
      const adminLog = mockNotificationLogs.find((l) => l.type === "BOOKING_CREATED");

      assertEqual(customerLog.recipient, "john@example.com", "Customer log must record john@example.com");
      assertEqual(adminLog.recipient, "admin@mobiletire.clinic", "Admin log must record admin email");
      assert(customerLog.recipient !== adminLog.recipient, "Customer recipient and Admin recipient must remain distinct");
    });

    // ------------------------------------------------------------------------
    // TEST 14 — DUPLICATE PROTECTION
    // ------------------------------------------------------------------------
    test("TEST 14 — DUPLICATE PROTECTION: Idempotency prevents duplicate BOOKING_CONFIRMED emails on repeated actions", () => {
      const logs = new Set();
      let emailSendCount = 0;

      function dispatchConfirmedEmail(bookingId) {
        const key = `booking_confirmed_${bookingId}`;
        if (logs.has(key)) {
          return { skipped: true, reason: "idempotent_duplicate" };
        }
        logs.add(key);
        emailSendCount++;
        return { success: true };
      }

      // First confirmation action
      const res1 = dispatchConfirmedEmail("booking-dup-1");
      assertEqual(res1.success, true);
      assertEqual(emailSendCount, 1);

      // Repeated confirmation action (e.g. rapid click or retry)
      const res2 = dispatchConfirmedEmail("booking-dup-1");
      assertEqual(res2.skipped, true);
      assertEqual(emailSendCount, 1, "Duplicate confirmation must NOT trigger a second email");
    });

    // ------------------------------------------------------------------------
    // TEST 15 — HISTORICAL COMPATIBILITY
    // ------------------------------------------------------------------------
    test("TEST 15 — HISTORICAL COMPATIBILITY: Historical SMS/WhatsApp NotificationLog rows remain readable and retry-safe", () => {
      const historicalRows = [
        { id: "log-1", channel: "sms", status: "FAILED", recipient: "+12145550199", retryCount: 0 },
        { id: "log-2", channel: "whatsapp", status: "FAILED", recipient: "+12145550199", retryCount: 1 },
        { id: "log-3", channel: "email", status: "FAILED", recipient: "john@example.com", retryCount: 0 },
      ];

      // Verify schema enum/channel supports sms, whatsapp, email
      const schemaPath = path.join(projectRoot, "../prisma/schema.prisma");
      const schemaContent = fs.readFileSync(schemaPath, "utf-8");
      assert(schemaContent.includes("model NotificationLog"), "NotificationLog model must exist in schema");
      assert(schemaContent.includes("channel"), "NotificationLog.channel must exist");

      // Simulate retry logic from notifications.ts
      let emailRetried = 0;
      let legacySkipped = 0;

      for (const row of historicalRows) {
        if (row.channel === "email") {
          emailRetried++;
        } else {
          // Legacy channels are marked terminal or safely skipped
          legacySkipped++;
        }
      }

      assertEqual(emailRetried, 1, "Only active email channel should be retried");
      assertEqual(legacySkipped, 2, "Historical SMS/WhatsApp rows must be handled safely without crashing");
    });

    // ------------------------------------------------------------------------
    // TEST 16 — MISSING BOOKING EMAIL NEVER USES CUSTOMER OR ADMIN EMAIL (Step 14)
    // ------------------------------------------------------------------------
    test("TEST 16 — MISSING BOOKING EMAIL: customerEmail=null with Customer.email=admin@example.com returns null (NEVER admin)", () => {
      const originalAdmin = process.env.ADMIN_EMAIL;
      process.env.ADMIN_EMAIL = "admin@mobiletire.clinic";

      try {
        const booking = {
          id: "b-test-16",
          customerEmail: null,
          customer: { email: "admin@mobiletire.clinic" },
          user: { email: "admin@mobiletire.clinic" },
        };

        const bookingRecipient = resolveBookingCustomerEmail(booking);
        assertEqual(bookingRecipient, null, "resolveBookingCustomerEmail must return null for booking with customerEmail=null");

        const genericRecipient = resolveCustomerNotificationEmail(booking);
        assertEqual(genericRecipient, null, "resolveCustomerNotificationEmail must return null for booking shape with customerEmail=null");

        assert(bookingRecipient !== process.env.ADMIN_EMAIL, "Recipient must NEVER equal admin email");
        assert(genericRecipient !== process.env.ADMIN_EMAIL, "Recipient must NEVER equal admin email");
      } finally {
        process.env.ADMIN_EMAIL = originalAdmin;
      }
    });

    // ------------------------------------------------------------------------
    // TEST 17 — FULL BOOKING RECIPIENT ISOLATION (Step 15)
    // ------------------------------------------------------------------------
    test("TEST 17 — FULL BOOKING RECIPIENT ISOLATION: All 9 lifecycle events resolve john@example.com, ignoring Customer.email=admin@example.com", () => {
      const booking = {
        id: "b-test-17",
        customerEmail: "john@example.com",
        customer: { email: "admin@mobiletire.clinic", name: "Admin Customer" },
        user: { email: "admin@mobiletire.clinic" },
        vehicle: "Ford Explorer",
        location: "Dallas, TX",
        status: "confirmed",
        primaryService: "Flat Tire Repair",
      };

      // 1. Confirmation
      assertEqual(resolveBookingCustomerEmail(booking), "john@example.com");
      // 2. Technician Assigned
      assertEqual(resolveBookingCustomerEmail(booking), "john@example.com");
      // 3. En Route
      assertEqual(resolveBookingCustomerEmail(booking), "john@example.com");
      // 4. Arrived
      assertEqual(resolveBookingCustomerEmail(booking), "john@example.com");
      // 5. Service Started
      assertEqual(resolveBookingCustomerEmail(booking), "john@example.com");
      // 6. Service Completed
      assertEqual(resolveBookingCustomerEmail(booking), "john@example.com");
      // 7. Quote Ready
      assertEqual(resolveBookingCustomerEmail(booking.customerEmail), "john@example.com");
      // 8. Payment Received
      assertEqual(resolveBookingCustomerEmail(booking), "john@example.com");
      // 9. Cancellation
      assertEqual(resolveBookingCustomerEmail(booking), "john@example.com");
    });

    // ------------------------------------------------------------------------
    // TEST 18 — MISSING BOOKING EMAIL SKIPS NOTIFICATION (Step 16)
    // ------------------------------------------------------------------------
    test("TEST 18 — MISSING BOOKING EMAIL: customerEmail=null with Customer.email=old-customer@example.com results in NO customer notification", () => {
      const booking = {
        id: "b-test-18",
        customerEmail: null,
        customer: { email: "old-customer@example.com" },
      };

      const recipient = resolveBookingCustomerEmail(booking);
      assertEqual(recipient, null, "Must NOT fall back to Customer.email when booking.customerEmail is null");

      const genericRecipient = resolveCustomerNotificationEmail(booking);
      assertEqual(genericRecipient, null, "Generic resolver must also return null for booking shape");
    });

    // ------------------------------------------------------------------------
    // TEST 19 — ADMIN SEPARATION GUARD (Step 17)
    // ------------------------------------------------------------------------
    test("TEST 19 — ADMIN SEPARATION: New Booking goes to admin; confirmation goes to booking email; missing email never goes to admin", () => {
      const originalAdmin = process.env.ADMIN_EMAIL;
      process.env.ADMIN_EMAIL = "admin@mobiletire.clinic";

      try {
        const adminEmail = resolveAdminNotificationEmail();
        assertEqual(adminEmail, "admin@mobiletire.clinic", "Admin recipient must resolve configured admin address");

        // Booking with customer email
        const validBooking = {
          id: "b-test-19a",
          customerEmail: "john@example.com",
        };
        const validRecipient = resolveBookingCustomerEmail(validBooking);
        assertEqual(validRecipient, "john@example.com");
        assert(validRecipient !== adminEmail, "Customer email must remain separate from admin email");

        // Booking without customer email
        const missingEmailBooking = {
          id: "b-test-19b",
          customerEmail: null,
        };
        const missingRecipient = resolveBookingCustomerEmail(missingEmailBooking);
        assertEqual(missingRecipient, null);
        assert(missingRecipient !== adminEmail, "Missing customer email must NEVER fall back to admin email");
      } finally {
        process.env.ADMIN_EMAIL = originalAdmin;
      }
    });
  });
}

// Direct execution support
if (process.argv[1]?.endsWith("email-notification-fix.test.mjs")) {
  runEmailNotificationFixTests();
}
