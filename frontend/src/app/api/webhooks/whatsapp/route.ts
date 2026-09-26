import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
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

          // Delivery status updates (sent, delivered, read, failed)
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

                logger.info("whatsapp.webhook.status_updated", {
                  messageId,
                  deliveryStatus,
                  recordsUpdated: updated.count,
                });
              } catch (updateErr) {
                logger.error("whatsapp.webhook.db_update_failed", {
                  messageId,
                  error: updateErr,
                });
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
