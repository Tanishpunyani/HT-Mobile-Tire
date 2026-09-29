import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { maskPhoneForLogging } from "@/lib/notifications/whatsapp";
import { resolveWhatsAppCustomerContext } from "@/lib/whatsapp/context";
import { sendWhatsAppBotReply } from "@/lib/whatsapp/router";
import { after } from "next/server";
import crypto from "crypto";

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET;

/**
 * GET handler: Meta WhatsApp Webhook Verification
 * Meta sends hub.mode, hub.verify_token, hub.challenge to verify webhook endpoint ownership.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && WHATSAPP_VERIFY_TOKEN && token === WHATSAPP_VERIFY_TOKEN) {
      logger.info("whatsapp.webhook.verified");
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    logger.warn("whatsapp.webhook.verify_failed", {
      mode,
      tokenMatch: token === WHATSAPP_VERIFY_TOKEN,
    });

    return new Response("Forbidden", { status: 403 });
  } catch (error) {
    logger.error("whatsapp.webhook.get_exception", { error });
    return new Response("Internal Server Error", { status: 500 });
  }
}

/**
 * POST handler: Meta WhatsApp Webhook Status & Message Ingestion
 * Receives delivery receipts (sent, delivered, read, failed) and updates NotificationLog.
 * Receives inbound customer messages and persists them to WhatsAppConversation & WhatsAppMessage.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // Verify HMAC-SHA256 signature if app secret is configured
    if (WHATSAPP_APP_SECRET) {
      const signature = request.headers.get("x-hub-signature-256");
      if (!signature) {
        logger.warn("whatsapp.webhook.signature_missing");
        return Response.json({ success: false, error: "Missing signature" }, { status: 401 });
      }

      const expectedSignature = `sha256=${crypto
        .createHmac("sha256", WHATSAPP_APP_SECRET)
        .update(rawBody)
        .digest("hex")}`;

      const signatureBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (
        signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
      ) {
        logger.warn("whatsapp.webhook.signature_invalid");
        return Response.json({ success: false, error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody || "{}");

    // Process entries
    if (Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (!Array.isArray(entry.changes)) continue;

        for (const change of entry.changes) {
          const value = change.value;
          if (!value) continue;

          // 1. Delivery status updates (sent, delivered, read, failed)
          if (Array.isArray(value.statuses)) {
            for (const statusObj of value.statuses) {
              const messageId = statusObj.id;
              const statusStr = (statusObj.status || "").toLowerCase();
              const timestamp = statusObj.timestamp;

              if (!messageId) continue;

              const deliveryStatus = statusStr.toUpperCase();
              const deliveredAt =
                statusStr === "delivered" || statusStr === "read"
                  ? new Date(parseInt(timestamp, 10) * 1000)
                  : undefined;

              const errorMessage =
                statusStr === "failed" && Array.isArray(statusObj.errors) && statusObj.errors[0]?.message
                  ? statusObj.errors[0].message
                  : undefined;

              try {
                // 1a. Update NotificationLog for transactional notifications
                const updated = await prisma.notificationLog.updateMany({
                  where: {
                    messageId,
                  },
                  data: {
                    deliveryStatus,
                    ...(deliveredAt ? { deliveredAt } : {}),
                    ...(errorMessage ? { errorMessage } : {}),
                  },
                });

                // 1b. Synchronize delivery status into WhatsAppMessage rawPayload for 2-way bot and admin messages
                const existingMsg = await prisma.whatsAppMessage.findUnique({
                  where: { wamid: messageId },
                  select: { id: true, rawPayload: true },
                });

                if (existingMsg) {
                  const existingPayload =
                    existingMsg.rawPayload && typeof existingMsg.rawPayload === "object"
                      ? (existingMsg.rawPayload as Record<string, unknown>)
                      : {};

                  const mergedPayload: Record<string, unknown> = {
                    ...existingPayload,
                    deliveryStatus,
                    ...(deliveredAt ? { deliveredAt: deliveredAt.toISOString() } : {}),
                    ...(errorMessage ? { deliveryError: errorMessage } : {}),
                  };

                  await prisma.whatsAppMessage.update({
                    where: { id: existingMsg.id },
                    data: {
                      rawPayload: mergedPayload as any,
                    },
                  });
                }

                logger.info("whatsapp.webhook.status_updated", {
                  messageId,
                  deliveryStatus,
                  recordsUpdated: updated.count,
                  whatsAppMessageUpdated: Boolean(existingMsg),
                });
              } catch (updateErr) {
                logger.error("whatsapp.webhook.db_update_failed", {
                  messageId,
                  error: updateErr,
                });
              }
            }
          }

          // 2. Inbound customer WhatsApp messages
          if (Array.isArray(value.messages)) {
            for (const message of value.messages) {
              const wamid = message.id;
              const rawFrom = message.from;

              if (!wamid || !rawFrom) {
                continue;
              }

              const normalizedPhone = normalizePhoneNumber(rawFrom);
              const maskedPhone = maskPhoneForLogging(normalizedPhone);

              // Step 6: Business-side echo / loop defense
              // Distinguish inbound customer messages from business-side outbound echo messages
              const configuredPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
              const metadataPhoneId = value.metadata?.phone_number_id;
              const displayPhoneNumber = value.metadata?.display_phone_number
                ? normalizePhoneNumber(value.metadata.display_phone_number)
                : null;

              const isBusinessEcho = Boolean(
                (configuredPhoneId && rawFrom === configuredPhoneId) ||
                (metadataPhoneId && rawFrom === metadataPhoneId) ||
                (displayPhoneNumber && normalizedPhone === displayPhoneNumber)
              );

              if (isBusinessEcho) {
                logger.info("whatsapp.webhook.business_echo_suppressed", {
                  wamid,
                  rawFrom,
                  metadataPhoneId,
                  displayPhoneNumber,
                });
                // Acknowledge receipt to Meta without triggering automated bot responses
                continue;
              }

              logger.info("whatsapp.inbound.received", {
                wamid,
                maskedPhone,
                type: message.type,
              });

              // Deduplication check: verify if wamid already stored
              const existingMsg = await prisma.whatsAppMessage.findUnique({
                where: { wamid },
                select: { id: true },
              });

              if (existingMsg) {
                logger.info("whatsapp.inbound.duplicate", {
                  wamid,
                  maskedPhone,
                });
                continue;
              }

              // Find existing WhatsAppConversation for this customer phone
              let conversation = await prisma.whatsAppConversation.findFirst({
                where: { customerPhone: normalizedPhone },
                orderBy: { updatedAt: "desc" },
              });

              // Resolve full customer & database context (Customer, Bookings, ETA, Services)
              // If conversation already has an activeBookingId (from prior disambiguation or staff linking), pass it
              const customerContext = conversation?.activeBookingId
                ? await resolveWhatsAppCustomerContext(rawFrom, {
                    targetBookingId: conversation.activeBookingId,
                  })
                : await resolveWhatsAppCustomerContext(rawFrom);

              if (customerContext.customer.isKnown) {
                logger.info("whatsapp.inbound.customer_resolved", {
                  wamid,
                  customerId: customerContext.customer.id,
                  maskedPhone,
                });
              }

              // Active booking context (if customer has exactly 1 active booking)
              const activeBookingId =
                customerContext.bookingContext.activeBooking?.id || null;

              // Parse message timestamp safely
              let messageDate = new Date();
              if (message.timestamp) {
                const parsedSec = parseInt(message.timestamp, 10);
                if (!isNaN(parsedSec) && parsedSec > 0) {
                  messageDate = new Date(parsedSec * 1000);
                }
              }

              if (!conversation) {
                conversation = await prisma.whatsAppConversation.create({
                  data: {
                    customerPhone: normalizedPhone,
                    customerId: customerContext.customer.id || null,
                    status: "bot_active",
                    activeBookingId,
                    lastMessageAt: messageDate,
                  },
                });
              } else {
                // Update conversation if customer or active booking can now be linked
                const updateData: Record<string, unknown> = {};
                if (!conversation.customerId && customerContext.customer.id) {
                  updateData.customerId = customerContext.customer.id;
                }
                // Only link activeBookingId if not already set, or if verified single active booking exists
                if (!conversation.activeBookingId && activeBookingId) {
                  updateData.activeBookingId = activeBookingId;
                }
                // Never move lastMessageAt backwards
                if (!conversation.lastMessageAt || conversation.lastMessageAt < messageDate) {
                  updateData.lastMessageAt = messageDate;
                }

                if (Object.keys(updateData).length > 0) {
                  conversation = await prisma.whatsAppConversation.update({
                    where: { id: conversation.id },
                    data: updateData,
                  });
                }
              }

              // Extract body according to message type
              const messageType = message.type || "unknown";
              let body: string | null = null;

              if (messageType === "text" && message.text?.body) {
                body = message.text.body;
              } else if (messageType === "interactive") {
                if (message.interactive?.type === "button_reply") {
                  body =
                    message.interactive.button_reply?.title ||
                    message.interactive.button_reply?.id ||
                    null;
                } else if (message.interactive?.type === "list_reply") {
                  body =
                    message.interactive.list_reply?.title ||
                    message.interactive.list_reply?.id ||
                    null;
                }
              } else if (messageType === "button" && message.button?.text) {
                body = message.button.text;
              } else if (messageType === "image") {
                body = message.image?.caption?.trim() ? message.image.caption.trim() : "[Photo Attached]";
              } else if (messageType === "audio" || messageType === "voice") {
                body = "[Voice Note Attached]";
              } else if (messageType === "document") {
                if (message.document?.caption?.trim()) {
                  body = message.document.caption.trim();
                } else if (message.document?.filename?.trim()) {
                  body = `[Document: ${message.document.filename.trim()}]`;
                } else {
                  body = "[Document Attached]";
                }
              } else if (messageType === "video") {
                body = message.video?.caption?.trim() ? message.video.caption.trim() : "[Video Attached]";
              } else if (messageType === "sticker") {
                body = "[Sticker Attached]";
              } else if (messageType === "location") {
                body = "[Location Shared]";
              }

              // Store incoming message with rawPayload
              try {
                await prisma.whatsAppMessage.create({
                  data: {
                    conversationId: conversation.id,
                    wamid,
                    direction: "inbound",
                    type: messageType,
                    body,
                    rawPayload: message as any,
                    createdAt: messageDate,
                  },
                });

                logger.info("whatsapp.inbound.stored", {
                  wamid,
                  conversationId: conversation.id,
                  type: messageType,
                  maskedPhone,
                });

                // Phase 3 & 5: Route Intent & Dispatch Customer-Safe Response
                // Decouple outbound bot reply from webhook HTTP response using Next.js after()
                after(async () => {
                  try {
                    await sendWhatsAppBotReply({
                      conversationId: conversation.id,
                      customerPhone: normalizedPhone,
                      context: customerContext,
                      inboundText: body,
                    });
                  } catch (botErr) {
                    logger.error("whatsapp.bot_reply.exception", {
                      wamid,
                      maskedPhone,
                      error: (botErr as Error)?.message || botErr,
                    });
                  }
                });
              } catch (msgCreateErr: any) {
                // Handle unique constraint conflict gracefully
                if (msgCreateErr?.code === "P2002") {
                  logger.info("whatsapp.inbound.duplicate_p2002", { wamid, maskedPhone });
                } else {
                  logger.error("whatsapp.inbound.store_failed", {
                    wamid,
                    error: msgCreateErr?.message || msgCreateErr,
                  });
                }
              }
            }
          }
        }
      }
    }

    // Always acknowledge receipt to Meta with 200 OK
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error("whatsapp.webhook.post_exception", { error });
    // Return 200 to prevent Meta retry loops on malformed payloads
    return Response.json({ success: false, error: "Malformed payload" }, { status: 200 });
  }
}
