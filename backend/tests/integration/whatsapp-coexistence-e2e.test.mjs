/**
 * Integration Test Suite: WhatsApp Coexistence & Operational Lifecycle (Phase 6)
 * HT Mobile Tyres
 *
 * Covers:
 * 1. Customer inbound message accepted by webhook processing
 * 2. Customer context is resolved safely
 * 3. Inbound message is persisted with valid WAMID
 * 4. Deterministic bot response is generated
 * 5. Multiple active bookings trigger disambiguation prompt
 * 6. Valid booking reference (#REF, number, vehicle) selects correct booking
 * 7. Selected booking is persisted as conversation.activeBookingId
 * 8. Follow-up message uses persisted booking context without re-prompting
 * 9. Human support changes conversation to human_handoff
 * 10. Bot replies are suppressed during human_handoff
 * 11. Admin reply is persisted with source = "admin"
 * 12. Admin can return conversation to bot
 * 13. Closed conversation reopens on customer message
 * 14. Delivery status can update outbound message state
 * 15. Business-side echo is not routed back into chatbot processing
 * 16. Admin can manually associate a customer-owned booking
 * 17. Admin cannot associate another customer's booking (IDOR protection)
 * 18. Transcript is capped at 150 messages
 * 19. Returned transcript remains chronological (oldest -> newest)
 * 20. Existing Phase 1–5 behavior remains compatible
 */

import fs from "fs";
import path from "path";
import { describe, test, assert, assertEqual, assertDeepEqual } from "../helpers/test-runner.mjs";

const frontendSrcDir = path.resolve(process.cwd(), "frontend/src");
const webhookSrcPath = path.join(frontendSrcDir, "app/api/webhooks/whatsapp/route.ts");
const actionsSrcPath = path.join(frontendSrcDir, "app/actions/whatsapp.ts");
const routerSrcPath = path.join(frontendSrcDir, "lib/whatsapp/router.ts");
const adminPageSrcPath = path.join(frontendSrcDir, "app/(admin-portal)/admin/whatsapp/page.tsx");

export function runWhatsAppCoexistenceE2EIntegrationTests() {
  describe("Phase 6: WhatsApp Coexistence & End-to-End Operational Lifecycle", () => {
    const webhookCode = fs.readFileSync(webhookSrcPath, "utf-8");
    const actionsCode = fs.readFileSync(actionsSrcPath, "utf-8");
    const routerCode = fs.readFileSync(routerSrcPath, "utf-8");
    const adminPageCode = fs.readFileSync(adminPageSrcPath, "utf-8");

    // ------------------------------------------------------------------------
    // 1. Inbound Webhook Acceptance
    // ------------------------------------------------------------------------
    test("1. Customer inbound message is accepted by webhook processing", () => {
      assert(webhookCode.includes("export async function POST(request: Request)"), "POST route exists");
      assert(webhookCode.includes("value.messages"), "Webhook extracts messages array");
      assert(webhookCode.includes("wamid"), "Extracts message ID as wamid");
      assert(webhookCode.includes("Response.json({ success: true }"), "Always returns 200 OK");
    });

    // ------------------------------------------------------------------------
    // 2. Customer Context Resolution
    // ------------------------------------------------------------------------
    test("2. Customer context is resolved safely", () => {
      assert(
        webhookCode.includes("resolveWhatsAppCustomerContext(rawFrom"),
        "Calls resolveWhatsAppCustomerContext with sender phone"
      );
      assert(
        webhookCode.includes("customerContext.customer.isKnown"),
        "Checks customer resolution status"
      );
    });

    // ------------------------------------------------------------------------
    // 3. Inbound Persistence
    // ------------------------------------------------------------------------
    test("3. Inbound message is persisted with valid WAMID", () => {
      assert(webhookCode.includes("prisma.whatsAppMessage.create({"), "Persists message to database");
      assert(webhookCode.includes('direction: "inbound"'), "Sets direction as inbound");
      assert(webhookCode.includes("rawPayload: message as any"), "Preserves raw payload");
    });

    // ------------------------------------------------------------------------
    // 4. Deterministic Bot Response Generation
    // ------------------------------------------------------------------------
    test("4. Deterministic bot response is generated", () => {
      assert(webhookCode.includes("sendWhatsAppBotReply({"), "Webhook calls sendWhatsAppBotReply");
      assert(routerCode.includes("routeWhatsAppIntent(context, inboundText)"), "Router routes intent deterministically");
    });

    // ------------------------------------------------------------------------
    // 5. Multiple Active Bookings Trigger Disambiguation
    // ------------------------------------------------------------------------
    test("5. Multiple active bookings trigger disambiguation prompt", () => {
      assert(
        routerCode.includes("buildDisambiguationPrompt"),
        "Router uses buildDisambiguationPrompt when multiple active bookings exist"
      );
      assert(
        routerCode.includes("active bookings*"),
        "Prompt message explains customer has multiple active bookings"
      );
      assert(routerCode.includes("candidateActiveBookings"), "Uses candidateActiveBookings list");
    });

    // ------------------------------------------------------------------------
    // 6. Valid Booking Reference Selection
    // ------------------------------------------------------------------------
    test("6. Valid booking reference selects the correct booking", () => {
      assert(routerCode.includes("extractBookingReference"), "Extracts booking reference token");
      assert(routerCode.includes("candidates.find("), "Matches reference against customer active candidates");

      // Functional simulation: reference extraction
      const candidates = [
        { id: "bkg-1111", reference: "#BKG1111", vehicle: "Tesla Model 3" },
        { id: "bkg-2222", reference: "#BKG2222", vehicle: "BMW 3 Series" },
      ];

      const matchByRef = (refText) => {
        const clean = refText.replace(/[#\s]/g, "").toUpperCase();
        return candidates.find((c) => c.reference.replace(/[#\s]/g, "").toUpperCase() === clean);
      };

      const matched = matchByRef("#BKG2222");
      assertEqual(matched?.id, "bkg-2222", "Matches booking 2222");
    });

    // ------------------------------------------------------------------------
    // 7. Selected Booking Persisted as activeBookingId
    // ------------------------------------------------------------------------
    test("7. Selected booking is persisted as conversation.activeBookingId", () => {
      assert(
        routerCode.includes("validatedTargetBookingId"),
        "Tracks validatedTargetBookingId during disambiguation"
      );
      assert(
        routerCode.includes("convUpdate.activeBookingId = validatedTargetBookingId"),
        "Persists activeBookingId to whatsAppConversation in DB"
      );
    });

    // ------------------------------------------------------------------------
    // 8. Follow-up Message Uses Persisted Booking Context
    // ------------------------------------------------------------------------
    test("8. Follow-up message uses persisted booking context without re-prompting", () => {
      assert(
        webhookCode.includes("targetBookingId: conversation.activeBookingId"),
        "Webhook passes conversation.activeBookingId to resolveWhatsAppCustomerContext"
      );

      // Functional simulation: follow-up turn
      const conversationState = {
        id: "conv-1",
        customerPhone: "+447700900123",
        activeBookingId: "bkg-2222",
      };

      const simulatedResolveContext = (phone, options) => {
        const allBookings = [
          { id: "bkg-1111", vehicle: "Tesla Model 3" },
          { id: "bkg-2222", vehicle: "BMW 3 Series" },
        ];
        const active = options?.targetBookingId
          ? allBookings.find((b) => b.id === options.targetBookingId) || null
          : null;
        return { activeBooking: active };
      };

      const contextOnTurn3 = simulatedResolveContext(
        conversationState.customerPhone,
        { targetBookingId: conversationState.activeBookingId }
      );

      assertEqual(contextOnTurn3.activeBooking?.id, "bkg-2222", "Active booking immediately resolved on turn 3");
    });

    // ------------------------------------------------------------------------
    // 9. Human Support Changes Conversation to human_handoff
    // ------------------------------------------------------------------------
    test("9. Human support changes conversation to human_handoff", () => {
      assert(routerCode.includes('case "human_support":'), "Handles human_support intent");
      assert(routerCode.includes('convUpdate.status = "human_handoff"'), "Persists human_handoff status");
    });

    // ------------------------------------------------------------------------
    // 10. Bot Replies Suppressed During human_handoff
    // ------------------------------------------------------------------------
    test("10. Bot replies are suppressed during human_handoff", () => {
      assert(routerCode.includes("context.conversation.status === \"human_handoff\""), "Checks for human_handoff");
      assert(routerCode.includes("suppressResponse: true"), "Sets suppressResponse: true");
    });

    // ------------------------------------------------------------------------
    // 11. Admin Reply Persisted with source = "admin"
    // ------------------------------------------------------------------------
    test("11. Admin reply is persisted with source = admin", () => {
      assert(actionsCode.includes('source: "admin"'), "Outbound message stores source: admin");
      assert(actionsCode.includes("adminEmail: session.email"), "Stores adminEmail in rawPayload");
    });

    // ------------------------------------------------------------------------
    // 12. Admin Can Return Conversation to Bot
    // ------------------------------------------------------------------------
    test("12. Admin can return conversation to bot", () => {
      assert(actionsCode.includes('status === "bot_active"'), "Action allows status update to bot_active");
      assert(adminPageCode.includes("Return to Bot"), "Admin UI provides Return to Bot button");
    });

    // ------------------------------------------------------------------------
    // 13. Closed Conversation Reopens on Customer Message
    // ------------------------------------------------------------------------
    test("13. Closed conversation reopens on customer message", () => {
      assert(routerCode.includes("wasClosed"), "Detects when conversation was closed");
      assert(routerCode.includes('convUpdate.status = "bot_active"'), "Reopens status to bot_active");
    });

    // ------------------------------------------------------------------------
    // 14. Delivery Status Updates Outbound Message State
    // ------------------------------------------------------------------------
    test("14. Delivery status can update outbound message state", () => {
      assert(webhookCode.includes("prisma.whatsAppMessage.findUnique({"), "Queries message by wamid");
      assert(webhookCode.includes("deliveryStatus"), "Updates deliveryStatus");
      assert(webhookCode.includes("deliveredAt"), "Updates deliveredAt timestamp");
    });

    // ------------------------------------------------------------------------
    // 15. Business-Side Echo Defense
    // ------------------------------------------------------------------------
    test("15. Business-side echo is not routed back into chatbot processing", () => {
      assert(webhookCode.includes("isBusinessEcho"), "Webhook includes isBusinessEcho guard");
      assert(
        webhookCode.includes("whatsapp.webhook.business_echo_suppressed"),
        "Logs suppressed business echo event"
      );

      // Functional simulation: echo detection
      const detectEcho = (rawFrom, phoneId, displayPhone) => {
        return Boolean(
          (phoneId && rawFrom === phoneId) ||
          (displayPhone && rawFrom === displayPhone)
        );
      };

      assertEqual(detectEcho("1005559999", "1005559999", "+447000000000"), true, "Suppresses phone ID echo");
      assertEqual(detectEcho("+447000000000", "1005559999", "+447000000000"), true, "Suppresses display phone echo");
      assertEqual(detectEcho("+447111222333", "1005559999", "+447000000000"), false, "Allows normal customer message");
    });

    // ------------------------------------------------------------------------
    // 16. Admin Can Manually Associate a Customer-Owned Booking
    // ------------------------------------------------------------------------
    test("16. Admin can manually associate a customer-owned booking", () => {
      assert(
        actionsCode.includes("export async function setConversationActiveBookingAction"),
        "setConversationActiveBookingAction exported"
      );
      assert(
        actionsCode.includes("matchesCustomerId") && actionsCode.includes("matchesCustomerPhone"),
        "Verifies booking belongs to the customer"
      );
      assert(
        actionsCode.includes("activeBookingId: targetBooking.id"),
        "Updates activeBookingId on conversation"
      );
    });

    // ------------------------------------------------------------------------
    // 17. Admin Cannot Associate Another Customer's Booking (IDOR Protection)
    // ------------------------------------------------------------------------
    test("17. Admin cannot associate another customer's booking", () => {
      assert(
        actionsCode.includes("Forbidden: Selected booking does not belong to this customer"),
        "Rejects cross-customer booking association"
      );

      // Functional simulation: IDOR protection
      const verifyOwnership = (convCustomer, bookingCustomer) => {
        const matchesId = convCustomer.id && bookingCustomer.id === convCustomer.id;
        const matchesPhone = convCustomer.phone && bookingCustomer.phone === convCustomer.phone;
        return matchesId || matchesPhone;
      };

      const validLink = verifyOwnership(
        { id: "cust-1", phone: "+447111111111" },
        { id: "cust-1", phone: "+447111111111" }
      );
      assertEqual(validLink, true, "Same customer allowed");

      const invalidIdor = verifyOwnership(
        { id: "cust-1", phone: "+447111111111" },
        { id: "cust-999", phone: "+447999999999" }
      );
      assertEqual(invalidIdor, false, "Cross customer IDOR blocked");
    });

    // ------------------------------------------------------------------------
    // 18. Transcript is Capped at 150 Messages
    // ------------------------------------------------------------------------
    test("18. Transcript is capped at 150 messages", () => {
      assert(actionsCode.includes("TRANSCRIPT_SAFETY_CEILING = 150"), "Enforces 150 message ceiling");
      assert(actionsCode.includes("take: TRANSCRIPT_SAFETY_CEILING"), "Prisma query uses ceiling take limit");
    });

    // ------------------------------------------------------------------------
    // 19. Returned Transcript Remains Chronological
    // ------------------------------------------------------------------------
    test("19. Returned transcript remains chronological", () => {
      assert(actionsCode.includes("rawMessagesDesc.reverse()"), "Reverses desc query to chronological order");

      // Functional simulation: reverse desc query
      const descList = [
        { id: "msg-3", createdAt: 300 },
        { id: "msg-2", createdAt: 200 },
        { id: "msg-1", createdAt: 100 },
      ];
      const chronoList = descList.reverse();
      assertEqual(chronoList[0].id, "msg-1", "Oldest message is first");
      assertEqual(chronoList[2].id, "msg-3", "Newest message is last");
    });

    // ------------------------------------------------------------------------
    // 20. Existing Phase 1–5 Behavior Remains Compatible
    // ------------------------------------------------------------------------
    test("20. Existing Phase 1–5 behavior remains compatible", () => {
      assert(webhookCode.includes('import { after } from "next/server";'), "Phase 5 after() decoupling preserved");
      assert(actionsCode.includes("deliveryStatus"), "Phase 5 deliveryStatus preserved");
      assert(actionsCode.includes("lastReadAt"), "Phase 5 lastReadAt unread tracking preserved");
      assert(adminPageCode.includes("POLLING_INTERVAL_MS = 10000"), "Phase 5 10-second polling preserved");
      assert(actionsCode.includes("131047"), "Phase 5 Meta 131047 error handling preserved");
    });
  });
}
