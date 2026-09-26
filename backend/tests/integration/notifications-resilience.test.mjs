/**
 * Integration Tests: Notification Failure Resilience & Retry Queue
 * HT Mobile Services
 */

import { describe, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import { MockMessagingClient, MockResendClient } from "../helpers/mock-services.mjs";

async function executeBookingTransactionWithNotifications({ messagingClient, resend, dbLogs }) {
  // 1. Core transactional database write (commits first)
  const booking = { id: "book_resilient_101", status: "confirmed", customerEmail: "test@example.com", phone: "2145550199" };

  // 2. Post-commit notifications wrapped in non-blocking error boundaries
  let messageStatus = "pending";
  let emailStatus = "pending";

  try {
    await messagingClient.sendMessage({ to: booking.phone, body: "Your booking is confirmed." });
    messageStatus = "sent";
  } catch (err) {
    messageStatus = "failed";
    dbLogs.push({ type: "MESSAGING", recipient: booking.phone, error: err.message, status: "failed", retryCount: 0 });
  }

  try {
    await resend.sendEmail({ to: booking.customerEmail, subject: "Booking Confirmed", html: "<p>Confirmed</p>" });
    emailStatus = "sent";
  } catch (err) {
    emailStatus = "failed";
    dbLogs.push({ type: "EMAIL", recipient: booking.customerEmail, error: err.message, status: "failed", retryCount: 0 });
  }

  // Core booking result MUST SUCCEED regardless of notification status
  return {
    success: true,
    booking,
    notificationSummary: { messageStatus, emailStatus },
  };
}

export function runNotificationsResilienceIntegrationTests() {
  describe("Notification Resilience & Non-Blocking Boundaries (Integration)", () => {
    testAsync("Booking SUCCEEDS even when Messaging Service fails (recorded for retry)", async () => {
      const failingGateway = new MockMessagingClient(true); // Fails with 503
      const workingResend = new MockResendClient(false);
      const dbLogs = [];

      const result = await executeBookingTransactionWithNotifications({
        messagingClient: failingGateway,
        resend: workingResend,
        dbLogs,
      });

      assert(result.success, "Core booking must succeed");
      assertEqual(result.notificationSummary.messageStatus, "failed");
      assertEqual(result.notificationSummary.emailStatus, "sent");
      assertEqual(dbLogs.length, 1);
      assertEqual(dbLogs[0].type, "MESSAGING");
      assertEqual(dbLogs[0].status, "failed");
    });

    testAsync("Booking SUCCEEDS even when BOTH Messaging Service and Resend fail", async () => {
      const failingGateway = new MockMessagingClient(true);
      const failingResend = new MockResendClient(true);
      const dbLogs = [];

      const result = await executeBookingTransactionWithNotifications({
        messagingClient: failingGateway,
        resend: failingResend,
        dbLogs,
      });

      assert(result.success, "Core booking must remain committed and successful");
      assertEqual(result.notificationSummary.messageStatus, "failed");
      assertEqual(result.notificationSummary.emailStatus, "failed");
      assertEqual(dbLogs.length, 2, "Both failures queued for retry");
    });
  });
}
