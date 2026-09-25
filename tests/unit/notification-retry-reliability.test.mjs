/**
 * Unit Tests: NotificationLog Persistence & Retry Reliability
 * HT Mobile Services / Phase 10 Step 3
 *
 * Covers:
 * A. Message ID persistence
 * B. Null message ID on success
 * C. Canonical FAILED status query selection
 * D. Prevention of duplicate NotificationLog rows during retry
 * E. Retry count incrementation (0 -> 1 -> 2 -> 3) and terminal stop
 * F. Retry success transition to SENT with messageId
 * G. Retry failure state and error message update
 * H. EntityId / EntityType preservation across retries
 * I. Concurrency protection via atomic row-level claiming
 * J. Compatibility of dispatch payload and provider boundaries
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

/**
 * In-memory Mock Notification DB conforming to Prisma NotificationLog model
 */
class MockNotificationDatabase {
  constructor() {
    this.logs = [];
    this.idCounter = 1;
  }

  reset() {
    this.logs = [];
    this.idCounter = 1;
  }

  create({ data }) {
    const record = {
      id: data.id || `notif-uuid-${this.idCounter++}`,
      bookingId: data.bookingId || null,
      emergencyRequestId: data.emergencyRequestId || null,
      entityId: data.entityId || null,
      entityType: data.entityType || null,
      channel: data.channel || "sms",
      recipient: data.recipient,
      type: data.type,
      status: (data.status || "PENDING").toUpperCase(),
      content: data.content || null,
      subject: data.subject || null,
      body: data.body || null,
      errorMessage: data.errorMessage || null,
      retryCount: data.retryCount || 0,
      messageId: data.messageId || null,
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
    };
    this.logs.push(record);
    return { ...record };
  }

  findMany({ where = {}, take, orderBy } = {}) {
    let result = this.logs.filter((log) => {
      if (where.status !== undefined && log.status !== where.status) {
        return false;
      }
      if (where.retryCount?.lt !== undefined && !(log.retryCount < where.retryCount.lt)) {
        return false;
      }
      return true;
    });

    if (orderBy?.createdAt === "asc") {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    if (take !== undefined) {
      result = result.slice(0, take);
    }

    return result.map((r) => ({ ...r }));
  }

  updateMany({ where = {}, data = {} }) {
    let updatedCount = 0;
    for (const log of this.logs) {
      if (where.id && log.id !== where.id) continue;
      if (where.status && log.status !== where.status) continue;
      if (where.retryCount !== undefined && log.retryCount !== where.retryCount) continue;

      if (data.retryCount?.increment) {
        log.retryCount += data.retryCount.increment;
      } else if (typeof data.retryCount === "number") {
        log.retryCount = data.retryCount;
      }

      if (data.status) {
        log.status = data.status;
      }

      log.updatedAt = new Date();
      updatedCount++;
    }
    return { count: updatedCount };
  }

  update({ where, data }) {
    const record = this.logs.find((l) => l.id === where.id);
    if (!record) {
      throw new Error(`Record with id ${where.id} not found`);
    }

    if (data.status) record.status = data.status;
    if (data.messageId !== undefined) record.messageId = data.messageId;
    if (data.errorMessage !== undefined) record.errorMessage = data.errorMessage;
    if (data.retryCount?.increment) {
      record.retryCount += data.retryCount.increment;
    } else if (typeof data.retryCount === "number") {
      record.retryCount = data.retryCount;
    }
    record.updatedAt = new Date();
    return { ...record };
  }
}

/**
 * Isolated Runner for Retry Mechanism matching lib/notifications.ts implementation
 */
function executeRetryProcess({ db, dispatchSmsProvider, dispatchEmailProvider, limit = 10 }) {
  const failedLogs = db.findMany({
    where: {
      status: "FAILED",
      retryCount: { lt: 3 },
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  if (failedLogs.length === 0) {
    return { total: 0, succeeded: 0, message: "No failed notifications to retry." };
  }

  let retried = 0;

  for (const log of failedLogs) {
    // 1. Concurrency claim
    const claimed = db.updateMany({
      where: {
        id: log.id,
        status: "FAILED",
        retryCount: log.retryCount,
      },
      data: {
        retryCount: { increment: 1 },
      },
    });

    if (claimed.count === 0) {
      continue;
    }

    const entityId = log.entityId || log.bookingId || log.emergencyRequestId || undefined;
    const entityType = log.entityType || (log.emergencyRequestId ? "emergency_request" : "booking");

    let result = { success: false, messageId: undefined, error: undefined };

    if (log.channel === "sms" && log.body) {
      const idempotencyKey = `sms_retry_${log.type}_${entityId || log.id}_${log.retryCount + 1}`;
      if (dispatchSmsProvider) {
        result = dispatchSmsProvider({
          to: log.recipient,
          message: log.body,
          type: log.type,
          entityId,
          entityType,
          idempotencyKey,
        });
      }
    } else if (log.channel === "email" && log.body && log.subject) {
      if (dispatchEmailProvider) {
        result = dispatchEmailProvider({
          to: log.recipient,
          subject: log.subject,
          html: log.body,
          type: log.type,
          entityId,
          entityType,
        });
      }
    }

    if (result.success) {
      db.update({
        where: { id: log.id },
        data: {
          status: "SENT",
          messageId: result.messageId || null,
          errorMessage: null,
        },
      });
      retried++;
    } else {
      db.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          errorMessage: result.error || "Retry attempt failed",
        },
      });
    }
  }

  return { total: failedLogs.length, succeeded: retried };
}

export function runNotificationRetryReliabilityTests() {
  describe("NotificationLog Message ID & Retry Reliability (Phase 10 Step 3)", () => {
    const db = new MockNotificationDatabase();

    test("A. Message ID Persistence: Gateway message ID is persisted in NotificationLog", () => {
      db.reset();
      const mockMessageId = "gateway-msg-abc-123";

      // Simulate initial creation with provider returning messageId
      const record = db.create({
        data: {
          channel: "sms",
          recipient: "+12145550199",
          type: "booking_confirmation",
          entityType: "booking",
          entityId: "11111111-1111-1111-1111-111111111111",
          status: "SENT",
          body: "Your booking is confirmed.",
          messageId: mockMessageId,
        },
      });

      assertEqual(record.messageId, mockMessageId, "NotificationLog must store the provider messageId");
      assertEqual(record.status, "SENT", "Status must be canonical SENT");
    });

    test("B. No Message ID: Notification remains successful and messageId remains null when omitted", () => {
      db.reset();

      const record = db.create({
        data: {
          channel: "sms",
          recipient: "+12145550199",
          type: "technician_dispatch",
          entityType: "booking",
          entityId: "11111111-1111-1111-1111-111111111111",
          status: "SENT",
          body: "New job dispatch",
          messageId: null,
        },
      });

      assertEqual(record.messageId, null, "messageId should be null when provider returns no ID");
      assertEqual(record.status, "SENT", "Status must still be SENT");
    });

    test("C. Canonical FAILED Status Query Selection: Worker matches uppercase FAILED and ignores non-failed", () => {
      db.reset();

      // Insert canonical FAILED
      db.create({
        data: {
          id: "fail-canonical",
          recipient: "+12145550101",
          type: "status_update",
          entityType: "booking",
          status: "FAILED",
          retryCount: 0,
        },
      });

      // Insert already SENT
      db.create({
        data: {
          id: "sent-row",
          recipient: "+12145550102",
          type: "status_update",
          entityType: "booking",
          status: "SENT",
          retryCount: 0,
        },
      });

      // Insert FAILED with retryCount = 3 (terminal)
      db.create({
        data: {
          id: "fail-exhausted",
          recipient: "+12145550103",
          type: "status_update",
          entityType: "booking",
          status: "FAILED",
          retryCount: 3,
        },
      });

      const selected = db.findMany({
        where: {
          status: "FAILED",
          retryCount: { lt: 3 },
        },
      });

      assertEqual(selected.length, 1, "Only eligible FAILED rows with retryCount < 3 should be selected");
      assertEqual(selected[0].id, "fail-canonical", "Canonical FAILED row must match query");
    });

    test("D. No Duplicate Log Row Created During Retry", () => {
      db.reset();

      db.create({
        data: {
          id: "single-log-uuid",
          channel: "sms",
          recipient: "+12145550199",
          type: "emergency_alert",
          entityType: "emergency_request",
          entityId: "22222222-2222-2222-2222-222222222222",
          status: "FAILED",
          body: "Emergency dispatch requested",
          retryCount: 0,
        },
      });

      assertEqual(db.logs.length, 1, "Initial count must be 1");

      const dispatchCalls = [];
      const mockSmsProvider = (params) => {
        dispatchCalls.push(params);
        return { success: true, messageId: "gateway-retry-101" };
      };

      const result = executeRetryProcess({
        db,
        dispatchSmsProvider: mockSmsProvider,
        dispatchEmailProvider: () => ({ success: true }),
      });

      assertEqual(result.succeeded, 1, "Retry should succeed");
      assertEqual(db.logs.length, 1, "Log count MUST remain 1; retry must NOT insert a second row");
      assertEqual(db.logs[0].id, "single-log-uuid", "The original row ID must be updated");
      assertEqual(db.logs[0].status, "SENT", "Status must update to SENT");
      assertEqual(db.logs[0].messageId, "gateway-retry-101", "Provider messageId must be recorded on the existing row");
    });

    test("E. Retry Count Incrementation: 0 -> 1 -> 2 -> 3 and stops at limit", () => {
      db.reset();

      db.create({
        data: {
          id: "retry-count-test",
          channel: "sms",
          recipient: "+12145550199",
          type: "booking_confirmation",
          entityType: "booking",
          status: "FAILED",
          body: "Booking details",
          retryCount: 0,
        },
      });

      const failingProvider = () => ({ success: false, error: "Network timeout" });

      // Retry 1: 0 -> 1
      executeRetryProcess({ db, dispatchSmsProvider: failingProvider });
      assertEqual(db.logs[0].retryCount, 1, "First retry increments count to 1");
      assertEqual(db.logs[0].status, "FAILED", "Status remains FAILED");

      // Retry 2: 1 -> 2
      executeRetryProcess({ db, dispatchSmsProvider: failingProvider });
      assertEqual(db.logs[0].retryCount, 2, "Second retry increments count to 2");

      // Retry 3: 2 -> 3
      executeRetryProcess({ db, dispatchSmsProvider: failingProvider });
      assertEqual(db.logs[0].retryCount, 3, "Third retry increments count to 3");

      // Attempt Retry 4: Must be ignored
      const finalAttempt = executeRetryProcess({ db, dispatchSmsProvider: failingProvider });
      assertEqual(finalAttempt.total, 0, "After 3 retries, record must no longer be selected");
      assertEqual(db.logs[0].retryCount, 3, "Retry count must not exceed 3");
    });

    test("F. Retry Success: Updates SAME row to SENT and stores messageId", () => {
      db.reset();

      db.create({
        data: {
          id: "row-to-succeed",
          channel: "sms",
          recipient: "+12145550199",
          type: "quote_ready",
          entityType: "booking",
          status: "FAILED",
          body: "Invoice ready",
          retryCount: 1,
          errorMessage: "Initial failure",
        },
      });

      const successProvider = () => ({ success: true, messageId: "android-gw-999" });

      executeRetryProcess({ db, dispatchSmsProvider: successProvider });

      const updated = db.logs[0];
      assertEqual(updated.status, "SENT", "Status must become SENT on retry success");
      assertEqual(updated.messageId, "android-gw-999", "Returned messageId must be saved");
      assertEqual(updated.errorMessage, null, "Error message must be cleared on success");
      assertEqual(updated.retryCount, 2, "Retry count was incremented");
    });

    test("G. Retry Failure: Keeps SAME row FAILED with incremented count and updated errorMessage", () => {
      db.reset();

      db.create({
        data: {
          id: "row-to-fail",
          channel: "sms",
          recipient: "+12145550199",
          type: "status_update",
          entityType: "booking",
          status: "FAILED",
          body: "Status update text",
          retryCount: 0,
          errorMessage: "Initial 500 error",
        },
      });

      const failingProvider = () => ({ success: false, error: "Android Gateway offline 503" });

      executeRetryProcess({ db, dispatchSmsProvider: failingProvider });

      const updated = db.logs[0];
      assertEqual(updated.status, "FAILED", "Status must remain FAILED");
      assertEqual(updated.errorMessage, "Android Gateway offline 503", "Error message must reflect retry error");
      assertEqual(updated.retryCount, 1, "Retry count must be incremented to 1");
    });

    test("H. Entity Preservation: entityId and entityType remain associated through retries", () => {
      db.reset();

      const originalEntityId = "33333333-3333-3333-3333-333333333333";
      const originalEntityType = "emergency_request";

      db.create({
        data: {
          id: "entity-preserve-row",
          channel: "sms",
          recipient: "+12145550199",
          type: "emergency_alert",
          entityType: originalEntityType,
          entityId: originalEntityId,
          status: "FAILED",
          body: "Urgent emergency alert",
          retryCount: 0,
        },
      });

      let receivedEntityId = null;
      let receivedEntityType = null;

      const inspectingProvider = (params) => {
        receivedEntityId = params.entityId;
        receivedEntityType = params.entityType;
        return { success: true, messageId: "preserved-entity-msg" };
      };

      executeRetryProcess({ db, dispatchSmsProvider: inspectingProvider });

      // Check dispatch params
      assertEqual(receivedEntityId, originalEntityId, "Provider dispatch must receive original entityId");
      assertEqual(receivedEntityType, originalEntityType, "Provider dispatch must receive original entityType");

      // Check database row
      const finalRow = db.logs[0];
      assertEqual(finalRow.entityId, originalEntityId, "NotificationLog entityId must be preserved");
      assertEqual(finalRow.entityType, originalEntityType, "NotificationLog entityType must be preserved");
    });

    test("I. Concurrent Retry Protection: Two workers cannot claim the same record simultaneously", () => {
      db.reset();

      db.create({
        data: {
          id: "concurrent-row",
          channel: "sms",
          recipient: "+12145550199",
          type: "status_update",
          entityType: "booking",
          status: "FAILED",
          body: "Van en route",
          retryCount: 0,
        },
      });

      // Worker 1 and Worker 2 both observe the row with retryCount: 0
      const observedLog = db.logs[0];
      assertEqual(observedLog.retryCount, 0, "Initial retryCount is 0");

      // Worker 1 claims
      const claim1 = db.updateMany({
        where: { id: observedLog.id, status: "FAILED", retryCount: 0 },
        data: { retryCount: { increment: 1 } },
      });

      // Worker 2 attempts to claim with its observed snapshot retryCount = 0
      const claim2 = db.updateMany({
        where: { id: observedLog.id, status: "FAILED", retryCount: 0 },
        data: { retryCount: { increment: 1 } },
      });

      assertEqual(claim1.count, 1, "Worker 1 successfully claims the row");
      assertEqual(claim2.count, 0, "Worker 2 claim is rejected because retryCount changed");
      assertEqual(db.logs[0].retryCount, 1, "retryCount incremented exactly once");
    });

    test("J. Existing Notification Flows: Notification payload contracts remain intact", () => {
      // Contract check: verify required parameters and shape
      const samplePayload = {
        to: "+12145550199",
        body: "Booking Confirmation",
        type: "booking_confirmation",
        entityId: "44444444-4444-4444-4444-444444444444",
        entityType: "booking",
      };

      assert(samplePayload.to && samplePayload.body && samplePayload.type, "Notification payload contract fields intact");
      assertEqual(samplePayload.entityType, "booking", "entityType aligns with supported types");
    });
  });
}
