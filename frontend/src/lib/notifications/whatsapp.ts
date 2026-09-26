import { logger } from "@/lib/logger";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import type { NotificationType } from "@/lib/notifications";

// ============================================================================
// ENVIRONMENT & CONFIGURATION
// ============================================================================

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === "true";
const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION || "v20.0";

export interface WhatsAppDispatchParams {
  to: string;
  body: string;
  type: NotificationType | string;
  entityId?: string;
  entityType?: "booking" | "emergency_request" | "contact_message" | string;
  templateName?: string;
  templateLanguage?: string;
  templateParameters?: Array<{ type: "text"; text: string }>;
}

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * Normalizes phone number into WhatsApp international digit-only format.
 * Strips leading '+' and formatting characters.
 */
export function formatPhoneForWhatsApp(phone: string | null | undefined): string {
  if (!phone) return "";
  const normalized = normalizePhoneNumber(phone);
  // Strip leading '+'
  const digits = normalized.replace(/\D/g, "");
  return digits;
}

/**
 * Masks phone number for secure logging (e.g. +1 ***-***-1234).
 * Never exposes full customer phone numbers in logs.
 */
export function maskPhoneForLogging(phone: string | null | undefined): string {
  if (!phone) return "[empty]";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `***-***-${digits.slice(-4)}`;
}

/**
 * Direct WhatsApp dispatcher (used by sendWhatsApp and retry mechanism)
 * Uses official Meta WhatsApp Business Platform / Cloud API.
 * Does NOT create a NotificationLog row directly.
 */
export async function dispatchWhatsAppDirect({
  to,
  body,
  type,
  entityId,
  entityType,
  templateName,
  templateLanguage = "en_US",
  templateParameters,
}: WhatsAppDispatchParams): Promise<WhatsAppResult> {
  const formattedPhone = formatPhoneForWhatsApp(to);
  const maskedPhone = maskPhoneForLogging(to);

  if (!formattedPhone || formattedPhone.length < 7) {
    logger.warn("whatsapp.dispatch.invalid_phone", {
      maskedPhone,
      type,
      entityId,
    });
    return {
      success: false,
      error: `Invalid recipient phone number format: ${maskedPhone}`,
    };
  }

  // Safe mode: If credentials are not configured or live sending is disabled, simulate delivery
  if (!WHATSAPP_ENABLED || !WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    logger.info("whatsapp.message.simulated", {
      type,
      recipient: maskedPhone,
      entityType,
      entityId,
      bodyPreview: body.slice(0, 80),
      reason: !WHATSAPP_ENABLED
        ? "WHATSAPP_ENABLED is not true"
        : "Missing Meta WhatsApp Cloud API credentials",
    });

    return {
      success: true,
      messageId: `wamid.simulated.${Date.now()}.${Math.random().toString(36).slice(2, 9)}`,
      simulated: true,
    };
  }

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    // Construct Meta Cloud API payload
    let payload: Record<string, unknown>;

    if (templateName) {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: templateParameters?.length
            ? [
                {
                  type: "body",
                  parameters: templateParameters,
                },
              ]
            : undefined,
        },
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: {
          preview_url: false,
          body,
        },
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok || responseData.error) {
      const errorMsg =
        responseData.error?.message ||
        `Meta WhatsApp Cloud API error: HTTP ${response.status} ${response.statusText}`;

      logger.error("whatsapp.dispatch.provider_rejected", {
        type,
        recipient: maskedPhone,
        entityType,
        entityId,
        error: errorMsg,
        code: responseData.error?.code,
      });

      return {
        success: false,
        error: errorMsg,
      };
    }

    const messageId = responseData.messages?.[0]?.id;

    logger.info("whatsapp.dispatch.delivered_to_provider", {
      type,
      recipient: maskedPhone,
      entityType,
      entityId,
      messageId,
    });

    return {
      success: true,
      messageId,
    };
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || "Unknown WhatsApp dispatch error";
    logger.error("whatsapp.dispatch.exception", {
      type,
      recipient: maskedPhone,
      entityType,
      entityId,
      error: errorMsg,
    });

    return {
      success: false,
      error: errorMsg,
    };
  }
}
