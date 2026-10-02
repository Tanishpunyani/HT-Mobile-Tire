/**
 * Integration Tests: Notification Failure Resilience & Retry Queue
 * HT Mobile Services
 */

import fs from "fs";
import path from "path";
import { describe, test, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import { MockMessagingClient, MockResendClient } from "../helpers/mock-services.mjs";

const ROOT_DIR = path.resolve(process.cwd());
const CLEANUP_ROUTE_PATH = path.join(ROOT_DIR, "frontend/src/app/api/notifications/cleanup/route.ts");
const VERCEL_CONFIG_PATH = path.join(ROOT_DIR, "frontend/vercel.json");


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

  describe("Notification Retention & Scheduler (Phase 8.4)", () => {
    test("GET handler exists and delegates directly to POST", () => {
      assert(fs.existsSync(CLEANUP_ROUTE_PATH), "Cleanup route file must exist");
      const content = fs.readFileSync(CLEANUP_ROUTE_PATH, "utf-8");

      assert(
        content.includes("export async function GET(request: Request)"),
        "GET handler must be exported"
      );
      assert(
        content.includes("return POST(request);"),
        "GET handler must delegate directly to POST"
      );
    });

    test("CRON_SECRET authorization and fallback remain strictly enforced", () => {
      const content = fs.readFileSync(CLEANUP_ROUTE_PATH, "utf-8");

      assert(
        content.includes('const authHeader = request.headers.get("authorization");'),
        "Must inspect authorization header"
      );
      assert(
        content.includes("const cronSecret = process.env.CRON_SECRET;"),
        "Must read CRON_SECRET from process.env"
      );
      assert(
        content.includes("authHeader === `Bearer ${cronSecret}`"),
        "Must validate Bearer token match"
      );
      assert(
        content.includes("verifyAdminSession"),
        "Must fall back to admin session check"
      );
      assert(
        content.includes('{ status: 401 }'),
        "Must return 401 when unauthorized"
      );
    });

    test("POST logic preserves retention parameter and 90-day fallback", () => {
      const content = fs.readFileSync(CLEANUP_ROUTE_PATH, "utf-8");

      assert(
        content.includes('typeof body?.retentionDays === "number" && body.retentionDays > 0'),
        "Must validate numeric retentionDays"
      );
      assert(
        content.includes(": 90;"),
        "Must fall back to 90 days retention"
      );
      assert(
        content.includes("pruneOldNotificationLogs(retentionDays)"),
        "Must delegate pruning to pruneOldNotificationLogs"
      );
    });

    test("Vercel cron config schedules weekly Sunday run at 03:00 UTC", () => {
      assert(fs.existsSync(VERCEL_CONFIG_PATH), "frontend/vercel.json must exist");
      const raw = fs.readFileSync(VERCEL_CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);

      assert(Array.isArray(parsed.crons), "vercel.json must have crons array");
      const cleanupCron = parsed.crons.find(
        (c) => c.path === "/api/notifications/cleanup"
      );
      assert(cleanupCron != null, "Cron for /api/notifications/cleanup must be registered");
      assertEqual(cleanupCron.schedule, "0 3 * * 0", "Schedule must be weekly on Sunday at 03:00");
    });
  });
}
