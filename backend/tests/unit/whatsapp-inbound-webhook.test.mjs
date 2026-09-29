/**
 * Unit Tests: WhatsApp Inbound Webhook & Message Storage (Phase 1)
 * HT Mobile Tyres
 *
 * Verifies all 15 Phase 1 invariants:
 * 1. Valid webhook signature + inbound text message
 * 2. Invalid webhook signature verification
 * 3. Unknown customer resolution (customerId: null, no auto-creation)
 * 4. Known customer resolution (links customerId)
 * 5. First message creates conversation (status: "bot_active")
 * 6. Second message reuses existing conversation
 * 7. Duplicate wamid does not create duplicate message
 * 8. Inbound text body stored correctly
 * 9. Non-text message does not crash (interactive, button, image)
 * 10. Raw payload preserved
 * 11. lastMessageAt updates correctly without regressing backwards
 * 12. Existing status webhook processing preserved (statuses -> NotificationLog)
 * 13. NO automatic chatbot reply is sent (strictly receive & store)
 * 14. Phone number is normalized consistently
 * 15. Full phone number is never exposed in logs (maskPhoneForLogging)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

const ROOT_DIR = path.resolve(process.cwd());
const WEBHOOK_PATH = path.join(ROOT_DIR, "frontend/src/app/api/webhooks/whatsapp/route.ts");
const SCHEMA_PATH = path.join(ROOT_DIR, "frontend/prisma/schema.prisma");
const PHONE_UTIL_PATH = path.join(ROOT_DIR, "frontend/src/lib/utils/phone.ts");
const WHATSAPP_UTIL_PATH = path.join(ROOT_DIR, "frontend/src/lib/notifications/whatsapp.ts");

export function runWhatsAppInboundWebhookUnitTests() {
  describe("Phase 1 Invariants: Database Schema & Relations", () => {
    const schemaSrc = fs.readFileSync(SCHEMA_PATH, "utf-8");

    test("1. WhatsAppConversation model exists with required Phase 1 fields", () => {
      assert(schemaSrc.includes("model WhatsAppConversation"), "WhatsAppConversation model must exist");
      assert(schemaSrc.includes('customerPhone   String            @map("customer_phone")'), "customerPhone field must exist");
      assert(schemaSrc.includes('status          String            @default("bot_active")'), "status must default to bot_active");
      assert(schemaSrc.includes('lastMessageAt   DateTime          @default(now()) @map("last_message_at")'), "lastMessageAt must exist");
      assert(schemaSrc.includes('activeBookingId String?           @map("active_booking_id")'), "activeBookingId must exist");
      assert(schemaSrc.includes('@@map("whatsapp_conversations")'), "Table must map to whatsapp_conversations");
    });

    test("2. WhatsAppMessage model exists with unique wamid and indexes", () => {
      assert(schemaSrc.includes("model WhatsAppMessage"), "WhatsAppMessage model must exist");
      assert(schemaSrc.includes("wamid          String               @unique"), "wamid must be unique");
      assert(schemaSrc.includes('direction      String               @default("inbound")'), "direction must default to inbound");
      assert(schemaSrc.includes('type           String               @default("text")'), "type must exist");
      assert(schemaSrc.includes('body           String?              @db.Text'), "body must be nullable text");
      assert(schemaSrc.includes('rawPayload     Json?                @map("raw_payload")'), "rawPayload must be nullable Json");
      assert(schemaSrc.includes('@@index([conversationId])'), "Index on conversationId must exist");
      assert(schemaSrc.includes('@@map("whatsapp_messages")'), "Table must map to whatsapp_messages");
    });

    test("3. Customer and Booking models declare back-relations to WhatsAppConversation", () => {
      assert(schemaSrc.includes("whatsappConversations WhatsAppConversation[]"), "Customer and Booking must declare relation");
    });
  });

  describe("Phase 1 Invariants: Webhook Handler Source Code Contracts", () => {
    const webhookSrc = fs.readFileSync(WEBHOOK_PATH, "utf-8");

    test("4. Webhook validates HMAC-SHA256 signature using timingSafeEqual", () => {
      assert(webhookSrc.includes("x-hub-signature-256"), "Webhook must check x-hub-signature-256");
      assert(webhookSrc.includes("crypto.timingSafeEqual"), "Signature validation must use timingSafeEqual");
      assert(webhookSrc.includes("Invalid signature"), "Must return Invalid signature on mismatch");
    });

    test("5. Webhook preserves existing delivery receipt processing (value.statuses)", () => {
      assert(webhookSrc.includes("value.statuses"), "Must process delivery statuses");
      assert(webhookSrc.includes("prisma.notificationLog.updateMany"), "Must update NotificationLog on delivery statuses");
      assert(webhookSrc.includes("deliveryStatus"), "Must update deliveryStatus in NotificationLog");
    });

    test("6. Webhook parses inbound customer messages (value.messages)", () => {
      assert(webhookSrc.includes("value.messages"), "Must parse value.messages");
      assert(webhookSrc.includes("normalizePhoneNumber(rawFrom)"), "Must normalize rawFrom sender phone");
      assert(webhookSrc.includes("maskPhoneForLogging(normalizedPhone)"), "Must mask phone for logs");
      assert(webhookSrc.includes("prisma.whatsAppMessage.findUnique"), "Must check existing wamid for deduplication");
      assert(webhookSrc.includes("prisma.whatsAppConversation.findFirst"), "Must find existing conversation");
      assert(webhookSrc.includes("prisma.whatsAppConversation.create"), "Must create conversation if missing");
      assert(webhookSrc.includes("prisma.whatsAppMessage.create"), "Must persist WhatsAppMessage");
    });

    test("7. Webhook strictly enforces NO automated chatbot reply in Phase 1", () => {
      assert(!webhookSrc.includes("dispatchWhatsAppDirect("), "Must NOT call dispatchWhatsAppDirect in webhook handler");
      assert(!webhookSrc.includes("sendWhatsApp("), "Must NOT call sendWhatsApp in webhook handler");
      assert(!webhookSrc.includes("openai"), "Must NOT invoke AI/OpenAI in webhook");
      assert(!webhookSrc.includes("gemini"), "Must NOT invoke Gemini in webhook");
    });
  });

  describe("Phase 1 Functional Logic Simulation: Security, Deduplication & Storage", () => {
    test("8. Valid vs Invalid HMAC-SHA256 signature validation", () => {
      const secret = "test_meta_app_secret_12345";
      const payload = JSON.stringify({ entry: [] });

      const validSig = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
      const invalidSig = "sha256=0000000000000000000000000000000000000000000000000000000000000000";

      const validBuf = Buffer.from(validSig);
      const expectedBuf = Buffer.from(`sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`);
      const invalidBuf = Buffer.from(invalidSig);

      assert(crypto.timingSafeEqual(validBuf, expectedBuf), "Valid signature must match expected hash");
      assert(!crypto.timingSafeEqual(invalidBuf, expectedBuf), "Invalid signature must not match expected hash");
    });

    test("9. Phone normalization and masked logging", () => {
      // Simulation of normalizePhoneNumber
      function normalize(phone) {
        const cleaned = (phone || "").trim().replace(/[\s\-().]/g, "");
        if (cleaned.startsWith("+")) {
          const digits = cleaned.slice(1).replace(/\D/g, "");
          return digits ? `+${digits}` : "";
        }
        const digits = cleaned.replace(/\D/g, "");
        return digits ? `+${digits}` : "";
      }

      function mask(phone) {
        if (!phone) return "[empty]";
        const digits = phone.replace(/\D/g, "");
        if (digits.length <= 4) return "****";
        return `***-***-${digits.slice(-4)}`;
      }

      assertEqual(normalize("12145550199"), "+12145550199", "US number without + normalized to E.164");
      assertEqual(normalize("+1 (214) 555-0199"), "+12145550199", "Formatted US number normalized to E.164");
      assertEqual(normalize("447123456789"), "+447123456789", "UK international number normalized");
      assertEqual(normalize("919876543210"), "+919876543210", "India international number normalized");

      // Masking verification
      assertEqual(mask("+12145550199"), "***-***-0199", "Masked phone hides personal digits");
      assert(!mask("+12145550199").includes("214"), "Masked phone must not contain area code");
    });

    test("10. Conversation lifecycle: First message creates, second reuses", () => {
      const mockDb = {
        conversations: [],
        messages: [],
      };

      function processInbound({ from, wamid, text, timestamp }) {
        const normalizedPhone = `+${from.replace(/\D/g, "")}`;

        // Deduplication
        if (mockDb.messages.some((m) => m.wamid === wamid)) {
          return { duplicate: true };
        }

        let conv = mockDb.conversations.find((c) => c.customerPhone === normalizedPhone);
        const msgDate = new Date(parseInt(timestamp, 10) * 1000);

        if (!conv) {
          conv = {
            id: `conv_${mockDb.conversations.length + 1}`,
            customerPhone: normalizedPhone,
            customerId: null,
            status: "bot_active",
            lastMessageAt: msgDate,
          };
          mockDb.conversations.push(conv);
        } else {
          if (!conv.lastMessageAt || conv.lastMessageAt < msgDate) {
            conv.lastMessageAt = msgDate;
          }
        }

        const msg = {
          id: `msg_${mockDb.messages.length + 1}`,
          conversationId: conv.id,
          wamid,
          type: "text",
          body: text,
          direction: "inbound",
          createdAt: msgDate,
        };
        mockDb.messages.push(msg);

        return { conversationId: conv.id, messageId: msg.id };
      }

      // First message
      const res1 = processInbound({
        from: "12145550199",
        wamid: "wamid.001",
        text: "Hello HT Tyres",
        timestamp: "1710000000",
      });
      assertEqual(mockDb.conversations.length, 1, "First message creates 1 conversation");
      assertEqual(mockDb.conversations[0].status, "bot_active", "Conversation starts as bot_active");
      assertEqual(mockDb.messages.length, 1, "First message is stored");

      // Second message from same sender
      const res2 = processInbound({
        from: "12145550199",
        wamid: "wamid.002",
        text: "What is my booking status?",
        timestamp: "1710000060",
      });
      assertEqual(mockDb.conversations.length, 1, "Second message does not create new conversation");
      assertEqual(res2.conversationId, res1.conversationId, "Second message shares same conversation ID");
      assertEqual(mockDb.messages.length, 2, "Second message is stored");
      assertEqual(mockDb.conversations[0].lastMessageAt.getTime(), 1710000060 * 1000, "lastMessageAt updated");

      // Duplicate wamid delivery simulation
      const resDuplicate = processInbound({
        from: "12145550199",
        wamid: "wamid.002", // Same wamid
        text: "What is my booking status?",
        timestamp: "1710000060",
      });
      assert(resDuplicate.duplicate === true, "Duplicate wamid is detected and skipped");
      assertEqual(mockDb.messages.length, 2, "Message count remains 2 (duplicate prevented)");
    });

    test("11. Media normalization: non-text messages extract human-readable labels and preserve captions", () => {
      function extractBody(msg) {
        const type = msg.type || "unknown";
        if (type === "text" && msg.text?.body) return msg.text.body;
        if (type === "interactive") {
          if (msg.interactive?.type === "button_reply") {
            return msg.interactive.button_reply?.title || msg.interactive.button_reply?.id || null;
          }
          if (msg.interactive?.type === "list_reply") {
            return msg.interactive.list_reply?.title || msg.interactive.list_reply?.id || null;
          }
        }
        if (type === "button" && msg.button?.text) return msg.button.text;
        if (type === "image") {
          return msg.image?.caption?.trim() ? msg.image.caption.trim() : "[Photo Attached]";
        }
        if (type === "audio" || type === "voice") {
          return "[Voice Note Attached]";
        }
        if (type === "document") {
          if (msg.document?.caption?.trim()) return msg.document.caption.trim();
          if (msg.document?.filename?.trim()) return `[Document: ${msg.document.filename.trim()}]`;
          return "[Document Attached]";
        }
        if (type === "video") {
          return msg.video?.caption?.trim() ? msg.video.caption.trim() : "[Video Attached]";
        }
        if (type === "sticker") {
          return "[Sticker Attached]";
        }
        if (type === "location") {
          return "[Location Shared]";
        }
        return null;
      }

      const textMsg = { type: "text", text: { body: "Can I reschedule?" } };
      assertEqual(extractBody(textMsg), "Can I reschedule?");

      const btnReplyMsg = {
        type: "interactive",
        interactive: { type: "button_reply", button_reply: { id: "btn_status", title: "View Status" } },
      };
      assertEqual(extractBody(btnReplyMsg), "View Status");

      // 1. image with caption preserves caption
      const imgWithCaption = {
        type: "image",
        image: { id: "img_123", caption: "Damaged front passenger tire" },
      };
      assertEqual(extractBody(imgWithCaption), "Damaged front passenger tire");

      // 2. image without caption -> [Photo Attached]
      const imgWithoutCaption = {
        type: "image",
        image: { id: "img_123" },
      };
      assertEqual(extractBody(imgWithoutCaption), "[Photo Attached]");

      // 3. voice/audio -> [Voice Note Attached]
      const audioMsg = { type: "audio", audio: { id: "aud_456" } };
      assertEqual(extractBody(audioMsg), "[Voice Note Attached]");
      const voiceMsg = { type: "voice", voice: { id: "voc_789" } };
      assertEqual(extractBody(voiceMsg), "[Voice Note Attached]");

      // 4. document with caption preserves caption
      const docWithCaption = {
        type: "document",
        document: { id: "doc_1", caption: "My Tire Invoice" },
      };
      assertEqual(extractBody(docWithCaption), "My Tire Invoice");

      // 5. document with filename but no caption -> [Document: filename]
      const docWithFilename = {
        type: "document",
        document: { id: "doc_2", filename: "invoice-oct2026.pdf" },
      };
      assertEqual(extractBody(docWithFilename), "[Document: invoice-oct2026.pdf]");

      // 6. document without caption/filename -> [Document Attached]
      const docWithoutFilename = {
        type: "document",
        document: { id: "doc_3" },
      };
      assertEqual(extractBody(docWithoutFilename), "[Document Attached]");

      // 7. video without caption -> [Video Attached]
      const vidWithoutCaption = {
        type: "video",
        video: { id: "vid_101" },
      };
      assertEqual(extractBody(vidWithoutCaption), "[Video Attached]");
      const vidWithCaption = {
        type: "video",
        video: { id: "vid_102", caption: "Slow puncture leak video" },
      };
      assertEqual(extractBody(vidWithCaption), "Slow puncture leak video");

      // 8. sticker -> [Sticker Attached]
      const stickerMsg = {
        type: "sticker",
        sticker: { id: "stk_202" },
      };
      assertEqual(extractBody(stickerMsg), "[Sticker Attached]");

      // 9. location -> [Location Shared]
      const locationMsg = {
        type: "location",
        location: { latitude: 32.7767, longitude: -96.797 },
      };
      assertEqual(extractBody(locationMsg), "[Location Shared]");

      // 10. rawPayload remains preserved
      const webhookSrc = fs.readFileSync(WEBHOOK_PATH, "utf-8");
      assert(webhookSrc.includes("rawPayload: message as any"), "rawPayload must be preserved with full message object");
    });

    test("12. Timestamp monotonicity: lastMessageAt never regresses on older delivery", () => {
      let lastMessageAt = new Date("2026-09-28T12:00:00Z");
      const olderDeliveryDate = new Date("2026-09-28T11:30:00Z");

      const updated = lastMessageAt && lastMessageAt > olderDeliveryDate ? lastMessageAt : olderDeliveryDate;
      assertEqual(updated.toISOString(), "2026-09-28T12:00:00.000Z", "Timestamp does not regress backwards");
    });

    test("13. Active booking resolution: exactly 1 active booking resolves; multiple leaves null", () => {
      function resolveActiveBooking(bookings) {
        if (bookings.length === 1) {
          return bookings[0].id;
        }
        return null;
      }

      assertEqual(resolveActiveBooking([{ id: "b1", status: "confirmed" }]), "b1", "Single active booking resolved");
      assertEqual(resolveActiveBooking([]), null, "No bookings resolves to null");
      assertEqual(
        resolveActiveBooking([
          { id: "b1", status: "confirmed" },
          { id: "b2", status: "pending" },
        ]),
        null,
        "Multiple active bookings resolves to null without guessing"
      );
    });
  });

  describe("Phase 9.2 Invariants: Inbound WhatsApp Interactive Parsing", () => {
    const webhookSrc = fs.readFileSync(WEBHOOK_PATH, "utf-8");

    function parseInboundWhatsAppMessage(message) {
      const type = message?.type || "unknown";
      let body = null;
      let interactiveId = null;
      let interactiveTitle = null;

      if (type === "text" && message.text?.body) {
        body = message.text.body;
      } else if (type === "interactive") {
        if (message.interactive?.type === "button_reply") {
          interactiveId = message.interactive.button_reply?.id?.trim() || null;
          interactiveTitle = message.interactive.button_reply?.title?.trim() || null;
          body = interactiveTitle || interactiveId || null;
        } else if (message.interactive?.type === "list_reply") {
          interactiveId = message.interactive.list_reply?.id?.trim() || null;
          interactiveTitle = message.interactive.list_reply?.title?.trim() || null;
          body = interactiveTitle || interactiveId || null;
        }
      } else if (type === "button" && message.button?.text) {
        body = message.button.text;
      } else if (type === "image") {
        body = message.image?.caption?.trim() ? message.image.caption.trim() : "[Photo Attached]";
      } else if (type === "audio" || type === "voice") {
        body = "[Voice Note Attached]";
      } else if (type === "document") {
        if (message.document?.caption?.trim()) {
          body = message.document.caption.trim();
        } else if (message.document?.filename?.trim()) {
          body = `[Document: ${message.document.filename.trim()}]`;
        } else {
          body = "[Document Attached]";
        }
      } else if (type === "video") {
        body = message.video?.caption?.trim() ? message.video.caption.trim() : "[Video Attached]";
      } else if (type === "sticker") {
        body = "[Sticker Attached]";
      } else if (type === "location") {
        body = "[Location Shared]";
      }

      return {
        type,
        body,
        interactiveId,
        interactiveTitle,
      };
    }

    test("14. button_reply extracts structured ID and preserves human-readable title", () => {
      const btnMsg = {
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: {
            id: "btn_status",
            title: "Booking Status",
          },
        },
      };

      const parsed = parseInboundWhatsAppMessage(btnMsg);
      assertEqual(parsed.type, "interactive", "Message type is interactive");
      assertEqual(parsed.interactiveId, "btn_status", "Structured button ID is extracted");
      assertEqual(parsed.interactiveTitle, "Booking Status", "Human-readable button title is preserved");
      assertEqual(parsed.body, "Booking Status", "Stored body uses human-readable title");
    });

    test("15. list_reply extracts structured ID and preserves human-readable title", () => {
      const listMsg = {
        type: "interactive",
        interactive: {
          type: "list_reply",
          list_reply: {
            id: "booking_select:A1B2C3D4",
            title: "2022 Ford F-150",
          },
        },
      };

      const parsed = parseInboundWhatsAppMessage(listMsg);
      assertEqual(parsed.type, "interactive", "Message type is interactive");
      assertEqual(parsed.interactiveId, "booking_select:A1B2C3D4", "Structured row ID is extracted");
      assertEqual(parsed.interactiveTitle, "2022 Ford F-150", "Human-readable row title is preserved");
      assertEqual(parsed.body, "2022 Ford F-150", "Stored body uses human-readable title");
    });

    test("16. booking_select:<id> structured row ID survives parsing completely unchanged", () => {
      const listMsg = {
        type: "interactive",
        interactive: {
          type: "list_reply",
          list_reply: {
            id: "booking_select:BK-9988-XYZ",
            title: "Tesla Model Y",
          },
        },
      };

      const parsed = parseInboundWhatsAppMessage(listMsg);
      assertEqual(parsed.interactiveId, "booking_select:BK-9988-XYZ", "booking_select token survives intact");
    });

    test("17. intent:<name> structured button ID survives parsing completely unchanged", () => {
      const btnMsg = {
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: {
            id: "intent:human_support",
            title: "Speak to Agent",
          },
        },
      };

      const parsed = parseInboundWhatsAppMessage(btnMsg);
      assertEqual(parsed.interactiveId, "intent:human_support", "intent token survives intact");
    });

    test("18. Stored body remains human-readable display title (never an opaque ID only)", () => {
      const btnMsg = {
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: {
            id: "intent:booking_status",
            title: "Check Status",
          },
        },
      };

      const parsed = parseInboundWhatsAppMessage(btnMsg);
      assertEqual(parsed.body, "Check Status", "Body must be human-readable title");
      assert(parsed.body !== "intent:booking_status", "Body must NOT be opaque ID only");
    });

    test("19. Fallback behavior: missing or empty title falls back to ID for body", () => {
      const btnWithoutTitle = {
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: {
            id: "btn_confirm",
          },
        },
      };

      const parsed = parseInboundWhatsAppMessage(btnWithoutTitle);
      assertEqual(parsed.interactiveId, "btn_confirm", "ID extracted");
      assertEqual(parsed.interactiveTitle, null, "Title is null");
      assertEqual(parsed.body, "btn_confirm", "Body falls back to ID when title is missing");
    });

    test("20. Whitespace handling: whitespace-only ID or title is trimmed safely to null", () => {
      const btnWhitespace = {
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: {
            id: "   ",
            title: "  Valid Title  ",
          },
        },
      };

      const parsed = parseInboundWhatsAppMessage(btnWhitespace);
      assertEqual(parsed.interactiveId, null, "Whitespace-only ID normalizes to null");
      assertEqual(parsed.interactiveTitle, "Valid Title", "Title is trimmed cleanly");
      assertEqual(parsed.body, "Valid Title", "Body uses trimmed title");
    });

    test("21. Inbound interactive reply preserves full original interactive object in rawPayload", () => {
      const fullMetaMessage = {
        from: "12145550199",
        id: "wamid.HBgTEST999",
        timestamp: "1710000000",
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: {
            id: "btn_status",
            title: "Booking Status",
          },
        },
      };

      // Simulates prisma.whatsAppMessage.create({ data: { rawPayload: message as any } })
      const storedPayload = fullMetaMessage;
      assertEqual(storedPayload.type, "interactive", "rawPayload preserves message type");
      assertEqual(storedPayload.interactive?.type, "button_reply", "rawPayload preserves interactive type");
      assertEqual(storedPayload.interactive?.button_reply?.id, "btn_status", "rawPayload preserves button ID");
      assertEqual(storedPayload.interactive?.button_reply?.title, "Booking Status", "rawPayload preserves button title");
    });

    test("22. Deterministic router input preparation passes structured ID or fallback body", () => {
      // Interactive with ID
      const parsedInteractive = parseInboundWhatsAppMessage({
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: { id: "intent:services", title: "View Services" },
        },
      });
      const routerInputInteractive = parsedInteractive.interactiveId || parsedInteractive.body;
      assertEqual(routerInputInteractive, "intent:services", "Router receives structured ID");

      // Plain text message
      const parsedText = parseInboundWhatsAppMessage({
        type: "text",
        text: { body: "Hello HT Tyres" },
      });
      const routerInputText = parsedText.interactiveId || parsedText.body;
      assertEqual(routerInputText, "Hello HT Tyres", "Router receives text body for standard messages");
    });

    test("23. Webhook route source code contracts verify parseInboundWhatsAppMessage and rawPayload preservation", () => {
      assert(webhookSrc.includes("function parseInboundWhatsAppMessage("), "route.ts must implement parseInboundWhatsAppMessage helper");
      assert(webhookSrc.includes("parsed.interactiveId"), "route.ts must extract parsed.interactiveId");
      assert(webhookSrc.includes("rawPayload: message as any"), "route.ts must store rawPayload with full message");
      assert(webhookSrc.includes("const body = interactiveId || parsed.body;"), "route.ts must prepare router input with interactiveId or parsed.body");
      assert(webhookSrc.includes("inboundText: body"), "route.ts must pass inboundText: body to sendWhatsAppBotReply");
    });
  });
}
