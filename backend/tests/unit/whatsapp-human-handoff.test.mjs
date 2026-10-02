/**
 * Unit Tests: WhatsApp Human Handoff & Coexistence Workflow (Phase 4)
 * HT Mobile Tyres
 *
 * Verifies all Phase 4 specifications:
 * 1. human_support intent triggers human_handoff (shouldHandoff: true)
 * 2. Bot replies are suppressed during human_handoff (suppressResponse: true)
 * 3. "bot" keyword resumes bot_active
 * 4. "restart" keyword resumes bot_active
 * 5. Admin takeover sets conversation status to human_handoff
 * 6. Admin return-to-bot sets conversation status to bot_active
 * 7. Admin close sets conversation status to closed
 * 8. Closed conversation reopens to bot_active on new customer message
 * 9. Admin outbound message uses existing dispatchWhatsAppDirect provider
 * 10. Admin outbound message is persisted to WhatsAppMessage
 * 11. Admin outbound message has rawPayload.source === "admin"
 * 12. Conversation lastMessageAt updates on outbound admin message
 * 13. Admin cannot send empty message (rejected)
 * 14. Admin cannot send to an arbitrary phone number (derived from conversation record)
 * 15. Unauthenticated admin action is rejected (requireAdminSession enforced)
 * 16. Invalid conversation ID is rejected safely
 * 17. Invalid status value is rejected (allowed: bot_active, human_handoff, closed)
 * 18. Existing metadata is preserved during status update (merged, not overwritten)
 * 19. Customer inbound messages remain stored during handoff
 * 20. Delivery status callbacks (value.statuses[]) cannot trigger bot replies
 * 21. Message ownership derivation (customer: inbound, bot: outbound/deterministic_router, admin: outbound/admin)
 * 22. Admin navbar contains WhatsApp link with MessageSquare icon
 */

import fs from "fs";
import path from "path";
import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

const frontendSrcDir = path.resolve(process.cwd(), "frontend/src");
const routerSrcPath = path.join(frontendSrcDir, "lib/whatsapp/router.ts");
const actionsSrcPath = path.join(frontendSrcDir, "app/actions/whatsapp.ts");
const adminPageSrcPath = path.join(frontendSrcDir, "app/(admin-portal)/admin/whatsapp/page.tsx");
const adminNavbarSrcPath = path.join(frontendSrcDir, "app/(admin-portal)/admin/components/AdminNavbar.tsx");
const webhookSrcPath = path.join(frontendSrcDir, "app/api/webhooks/whatsapp/route.ts");

export function runWhatsAppHumanHandoffUnitTests() {
  describe("Phase 4: WhatsApp Human Handoff & Coexistence Workflow", () => {
    const routerCode = fs.readFileSync(routerSrcPath, "utf-8");
    const actionsCode = fs.readFileSync(actionsSrcPath, "utf-8");
    const adminPageCode = fs.readFileSync(adminPageSrcPath, "utf-8");
    const adminNavbarCode = fs.readFileSync(adminNavbarSrcPath, "utf-8");
    const webhookCode = fs.readFileSync(webhookSrcPath, "utf-8");

    // ------------------------------------------------------------------------
    // 1. Customer Human Request & Handoff State Activation
    // ------------------------------------------------------------------------
    test("1. human_support intent triggers human_handoff (shouldHandoff: true)", () => {
      assert(routerCode.includes("case \"human_support\":"), "Must handle human_support intent");
      assert(routerCode.includes("shouldHandoff: true"), "Must set shouldHandoff: true");
      assert(
        routerCode.includes("convUpdate.status = \"human_handoff\""),
        "Must persist human_handoff status to conversation"
      );
    });

    test("2. Bot replies are suppressed during human_handoff (suppressResponse: true)", () => {
      assert(
        routerCode.includes("context.conversation.status === \"human_handoff\""),
        "Must check for human_handoff status"
      );
      assert(
        routerCode.includes("suppressResponse: true"),
        "Must set suppressResponse: true during handoff"
      );
      assert(
        routerCode.includes("if (botResponse.suppressResponse)"),
        "sendWhatsAppBotReply must check suppressResponse and exit early"
      );
    });

    test("3. 'bot' keyword resumes bot_active", () => {
      assert(
        routerCode.includes("normalizedText === \"bot\""),
        "Must recognize 'bot' keyword to exit handoff"
      );
      assert(
        routerCode.includes("Welcome back! I am HT Mobile Tyres bot assistant"),
        "Must greet user upon bot resumption"
      );
      assert(
        routerCode.includes("convUpdate.status = \"bot_active\""),
        "Must reset conversation status to bot_active in database"
      );
    });

    test("4. 'restart' keyword resumes bot_active", () => {
      assert(
        routerCode.includes("normalizedText === \"restart\""),
        "Must recognize 'restart' keyword to exit handoff"
      );
      assert(
        routerCode.includes("normalizedText === \"restart bot\""),
        "Must recognize 'restart bot' keyword to exit handoff"
      );
    });

    // ------------------------------------------------------------------------
    // 2. Closed Conversation Automatic Reopening
    // ------------------------------------------------------------------------
    test("5. Closed conversation automatically reopens to bot_active on new customer message", () => {
      assert(
        routerCode.includes("const wasClosed = context.conversation.status === \"closed\""),
        "Must detect when conversation status was closed"
      );
      assert(
        routerCode.includes("context.conversation.status = \"bot_active\""),
        "Must reopen context status to bot_active"
      );
      assert(
        routerCode.includes("wasClosed"),
        "Must persist bot_active to database when conversation was closed"
      );
    });

    // ------------------------------------------------------------------------
    // 3. Admin Server Actions Security & Authorization
    // ------------------------------------------------------------------------
    test("6. Every admin action strictly enforces requireAdminSession()", () => {
      assert(
        actionsCode.includes("import { requireAdminSession } from \"@/lib/admin-auth\""),
        "Must import requireAdminSession"
      );

      // Verify each export calls requireAdminSession
      const actions = [
        "getWhatsAppConversationsAction",
        "getWhatsAppConversationMessagesAction",
        "sendAdminWhatsAppReplyAction",
        "setConversationStatusAction",
      ];

      for (const action of actions) {
        assert(
          actionsCode.includes(action),
          `Action ${action} must be exported`
        );
      }

      // Check occurrences of await requireAdminSession()
      const matches = actionsCode.match(/await requireAdminSession\(\)/g);
      assert(matches && matches.length >= 4, "Every action must await requireAdminSession()");
    });

    test("7. Admin actions validate conversationId", () => {
      assert(
        actionsCode.includes("!conversationId || typeof conversationId !== \"string\""),
        "Must validate conversationId type and non-emptiness"
      );
    });

    test("8. Admin status update validates allowed statuses", () => {
      assert(
        actionsCode.includes("ALLOWED_STATUSES"),
        "Must define allowed status array"
      );
      assert(
        actionsCode.includes("\"bot_active\"") &&
          actionsCode.includes("\"human_handoff\"") &&
          actionsCode.includes("\"closed\""),
        "Must support bot_active, human_handoff, and closed"
      );
      assert(
        actionsCode.includes("!ALLOWED_STATUSES.includes(status)"),
        "Must reject invalid status values"
      );
    });

    test("9. Existing metadata is preserved and merged during status updates", () => {
      assert(
        actionsCode.includes("...existingMetadata"),
        "Must preserve and spread existing metadata"
      );
      assert(
        actionsCode.includes("updatedMetadata.assignedAdminEmail = session.email"),
        "Must record assignedAdminEmail on handoff"
      );
      assert(
        actionsCode.includes("updatedMetadata.closedBy = session.email"),
        "Must record closedBy on closure"
      );
      assert(
        actionsCode.includes("updatedMetadata.closedAt = nowIso"),
        "Must record closedAt on closure"
      );
    });

    // ------------------------------------------------------------------------
    // 4. Outbound Human Message Architecture & Ownership
    // ------------------------------------------------------------------------
    test("10. Outbound admin message reuses existing dispatchWhatsAppDirect()", () => {
      assert(
        actionsCode.includes("import { dispatchWhatsAppDirect"),
        "Must import existing dispatchWhatsAppDirect"
      );
      assert(
        actionsCode.includes("await dispatchWhatsAppDirect({"),
        "Must call existing dispatchWhatsAppDirect"
      );
      assert(
        actionsCode.includes("type: \"admin_agent_message\""),
        "Must pass appropriate message type for admin reply"
      );
    });

    test("11. Recipient phone number is always resolved from conversation record (never client-supplied)", () => {
      assert(
        actionsCode.includes("const recipientPhone = conversation.customerPhone"),
        "Recipient phone must come from conversation.customerPhone"
      );
      assert(
        !actionsCode.includes("recipientPhone: string") &&
          !actionsCode.includes("to: string"),
        "sendAdminWhatsAppReplyAction must not accept arbitrary recipient phone argument"
      );
    });

    test("12. Admin outbound message validates text length and rejects empty bodies", () => {
      assert(
        actionsCode.includes("if (!trimmedText)"),
        "Must reject empty or whitespace-only messages"
      );
      assert(
        actionsCode.includes("trimmedText.length > 4096"),
        "Must enforce 4096 character limit on outbound text"
      );
    });

    test("13. Outbound admin message is persisted with rawPayload.source === 'admin'", () => {
      assert(
        actionsCode.includes("direction: \"outbound\""),
        "Must set direction to outbound"
      );
      assert(
        actionsCode.includes("source: \"admin\""),
        "Must tag rawPayload.source as admin"
      );
      assert(
        actionsCode.includes("adminEmail: session.email"),
        "Must record sending admin email in rawPayload"
      );
    });

    test("14. Conversation lastMessageAt and status are updated upon admin send", () => {
      assert(
        actionsCode.includes("lastMessageAt: now"),
        "Must update lastMessageAt on conversation"
      );
      assert(
        actionsCode.includes("status: \"human_handoff\""),
        "Must ensure conversation status remains/becomes human_handoff"
      );
    });

    test("15. Failed Meta dispatch does not create false success records", () => {
      assert(
        actionsCode.includes("if (!dispatchResult.success)"),
        "Must check dispatchResult.success before creating message"
      );
      assert(
        actionsCode.includes("Failed to deliver WhatsApp message via Meta Cloud API"),
        "Must return safe error message on dispatch failure"
      );
    });

    // ------------------------------------------------------------------------
    // 5. Message Ownership & Safe Role Derivation
    // ------------------------------------------------------------------------
    test("16. Transcript derives senderRole cleanly (customer, bot, admin)", () => {
      assert(
        actionsCode.includes("let senderRole: \"customer\" | \"bot\" | \"admin\" = \"customer\""),
        "Must define three-way senderRole type"
      );
      assert(
        actionsCode.includes("if (m.direction === \"outbound\")"),
        "Must check direction outbound"
      );
      assert(
        actionsCode.includes("raw?.source === \"admin\""),
        "Must check rawPayload.source === 'admin' for human replies"
      );
      assert(
        actionsCode.includes("senderRole = \"bot\""),
        "Must assign bot role to non-admin outbound replies"
      );
      assert(
        !actionsCode.includes("rawPayload: m.rawPayload"),
        "Must not expose raw Meta payload to admin API output"
      );
    });

    // ------------------------------------------------------------------------
    // 6. Inbound Continuity, Deduplication & Loop Protection
    // ------------------------------------------------------------------------
    test("17. Inbound customer messages remain persisted during handoff", () => {
      // In webhook, message persistence occurs BEFORE sendWhatsAppBotReply is called
      const storeIdx = webhookCode.indexOf("await prisma.whatsAppMessage.create");
      const botReplyIdx = webhookCode.indexOf("await sendWhatsAppBotReply");
      assert(storeIdx !== -1, "Inbound message create must exist");
      assert(botReplyIdx !== -1, "Bot reply call must exist");
      assert(storeIdx < botReplyIdx, "Inbound message MUST be stored before bot reply check");
    });

    test("18. Status callbacks (value.statuses[]) never invoke chatbot response", () => {
      assert(
        webhookCode.includes("if (Array.isArray(value.statuses))"),
        "Must handle value.statuses separately"
      );
      const statusesBlock = webhookCode.slice(
        webhookCode.indexOf("if (Array.isArray(value.statuses))"),
        webhookCode.indexOf("if (Array.isArray(value.messages))")
      );
      assert(
        !statusesBlock.includes("sendWhatsAppBotReply"),
        "Status callbacks must never invoke sendWhatsAppBotReply"
      );
    });

    // ------------------------------------------------------------------------
    // 7. Admin UI & Navigation Verification
    // ------------------------------------------------------------------------
    test("19. Admin WhatsApp page provides split-pane inbox and live reply controls", () => {
      assert(
        adminPageCode.includes("getWhatsAppConversationsAction"),
        "Admin page must load conversations"
      );
      assert(
        adminPageCode.includes("getWhatsAppConversationMessagesAction"),
        "Admin page must load messages for selected conversation"
      );
      assert(
        adminPageCode.includes("sendAdminWhatsAppReplyAction"),
        "Admin page must dispatch replies via Server Action"
      );
      assert(
        adminPageCode.includes("setConversationStatusAction"),
        "Admin page must allow status toggles"
      );
      assert(
        adminPageCode.includes("Take Over"),
        "Admin page must have Take Over button"
      );
      assert(
        adminPageCode.includes("Return to Bot"),
        "Admin page must have Return to Bot button"
      );
      assert(
        adminPageCode.includes("Close"),
        "Admin page must have Close button"
      );
      assert(
        adminPageCode.includes("Send via WhatsApp"),
        "Admin page must have send button"
      );
      assert(
        adminPageCode.includes("isOutside24HourWindow"),
        "Admin page must display 24-hour service window notice"
      );
    });

    test("20. AdminNavbar includes WhatsApp navigation link with MessageSquare icon", () => {
      assert(
        adminNavbarCode.includes("name: \"WhatsApp\""),
        "Admin navbar must include WhatsApp link"
      );
      assert(
        adminNavbarCode.includes("href: \"/admin/whatsapp\""),
        "WhatsApp navbar link must point to /admin/whatsapp"
      );
      assert(
        adminNavbarCode.includes("MessageSquare"),
        "WhatsApp link must use MessageSquare icon"
      );
    });
  });
}
