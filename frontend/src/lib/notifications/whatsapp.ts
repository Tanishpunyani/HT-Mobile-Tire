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

// ============================================================================
// INTERACTIVE MESSAGING TYPES & CONTRACTS
// ============================================================================

export interface WhatsAppReplyButton {
  id: string;
  title: string;
}

export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppListSection {
  title?: string;
  rows: WhatsAppListRow[];
}

export interface WhatsAppInteractiveButtons {
  type: "button";
  bodyText?: string;
  headerText?: string;
  footerText?: string;
  buttons: WhatsAppReplyButton[];
}

export interface WhatsAppInteractiveList {
  type: "list";
  buttonText: string;
  bodyText?: string;
  headerText?: string;
  footerText?: string;
  sections: WhatsAppListSection[];
}

export type WhatsAppInteractivePayload =
  | WhatsAppInteractiveButtons
  | WhatsAppInteractiveList;

export interface WhatsAppDispatchParams {
  to: string;
  body: string;
  type: NotificationType | string;
  entityId?: string;
  entityType?: "booking" | "emergency_request" | "contact_message" | string;
  templateName?: string;
  templateLanguage?: string;
  templateParameters?: Array<{ type: "text"; text: string }>;
  interactive?: WhatsAppInteractivePayload;
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
 * Validates WhatsApp interactive button payload against Meta limits.
 * Returns error message string if invalid, or null if valid.
 */
export function validateInteractiveButtons(
  interactive: WhatsAppInteractiveButtons,
  fallbackBody?: string
): string | null {
  const body = (interactive.bodyText || fallbackBody || "").trim();
  if (!body) {
    return "Interactive button message body text cannot be empty.";
  }
  if (body.length > 1024) {
    return "Interactive button body exceeds maximum length of 1024 characters.";
  }
  if (interactive.headerText && interactive.headerText.length > 60) {
    return "Interactive button header exceeds maximum length of 60 characters.";
  }
  if (interactive.footerText && interactive.footerText.length > 60) {
    return "Interactive button footer exceeds maximum length of 60 characters.";
  }
  if (!Array.isArray(interactive.buttons) || interactive.buttons.length < 1 || interactive.buttons.length > 3) {
    return "Interactive button message must contain between 1 and 3 buttons.";
  }

  const seenIds = new Set<string>();
  for (const btn of interactive.buttons) {
    if (!btn || typeof btn !== "object") {
      return "Invalid interactive button item.";
    }
    const id = (btn.id || "").trim();
    if (!id || id.length > 256) {
      return "Interactive button ID must be between 1 and 256 characters.";
    }
    if (seenIds.has(id)) {
      return `Duplicate interactive button ID: ${id}`;
    }
    seenIds.add(id);

    const title = (btn.title || "").trim();
    if (!title || title.length > 20) {
      return "Interactive button title must be between 1 and 20 characters.";
    }
  }

  return null;
}

/**
 * Validates WhatsApp interactive list payload against Meta limits.
 * Returns error message string if invalid, or null if valid.
 */
export function validateInteractiveList(
  interactive: WhatsAppInteractiveList,
  fallbackBody?: string
): string | null {
  const body = (interactive.bodyText || fallbackBody || "").trim();
  if (!body) {
    return "Interactive list message body text cannot be empty.";
  }
  if (body.length > 1024) {
    return "Interactive list body exceeds maximum length of 1024 characters.";
  }
  if (interactive.headerText && interactive.headerText.length > 60) {
    return "Interactive list header exceeds maximum length of 60 characters.";
  }
  if (interactive.footerText && interactive.footerText.length > 60) {
    return "Interactive list footer exceeds maximum length of 60 characters.";
  }

  const buttonText = (interactive.buttonText || "").trim();
  if (!buttonText || buttonText.length > 20) {
    return "Interactive list action button text must be between 1 and 20 characters.";
  }

  if (!Array.isArray(interactive.sections) || interactive.sections.length < 1 || interactive.sections.length > 10) {
    return "Interactive list must contain between 1 and 10 sections.";
  }

  let totalRows = 0;
  const seenRowIds = new Set<string>();

  for (const section of interactive.sections) {
    if (!section || !Array.isArray(section.rows)) {
      return "Invalid interactive list section.";
    }
    if (interactive.sections.length > 1) {
      const secTitle = (section.title || "").trim();
      if (!secTitle || secTitle.length > 24) {
        return "Interactive list section title must be between 1 and 24 characters when multiple sections exist.";
      }
    } else if (section.title && section.title.length > 24) {
      return "Interactive list section title exceeds maximum length of 24 characters.";
    }

    if (section.rows.length === 0) {
      return "Interactive list section cannot have empty rows.";
    }

    totalRows += section.rows.length;

    for (const row of section.rows) {
      if (!row || typeof row !== "object") {
        return "Invalid interactive list row.";
      }
      const rowId = (row.id || "").trim();
      if (!rowId || rowId.length > 200) {
        return "Interactive list row ID must be between 1 and 200 characters.";
      }
      if (seenRowIds.has(rowId)) {
        return `Duplicate interactive list row ID: ${rowId}`;
      }
      seenRowIds.add(rowId);

      const title = (row.title || "").trim();
      if (!title || title.length > 24) {
        return "Interactive list row title must be between 1 and 24 characters.";
      }

      if (row.description && row.description.length > 72) {
        return "Interactive list row description exceeds maximum length of 72 characters.";
      }
    }
  }

  if (totalRows < 1 || totalRows > 10) {
    return "Interactive list must contain between 1 and 10 total rows across all sections.";
  }

  return null;
}

/**
 * Constructs the outbound Meta Cloud API JSON request payload.
 * Priority:
 * 1. Interactive (button / list) if interactive payload is provided
 * 2. Template if templateName is provided
 * 3. Text fallback
 */
export function buildWhatsAppPayload({
  to,
  body,
  templateName,
  templateLanguage = "en_US",
  templateParameters,
  interactive,
}: {
  to: string;
  body: string;
  templateName?: string;
  templateLanguage?: string;
  templateParameters?: Array<{ type: "text"; text: string }>;
  interactive?: WhatsAppInteractivePayload;
}): Record<string, unknown> {
  const formattedPhone = formatPhoneForWhatsApp(to);

  if (interactive) {
    if (interactive.type === "button") {
      const interactiveObj: Record<string, unknown> = {
        type: "button",
        body: {
          text: interactive.bodyText || body,
        },
        action: {
          buttons: interactive.buttons.map((btn) => ({
            type: "reply",
            reply: {
              id: btn.id,
              title: btn.title,
            },
          })),
        },
      };

      if (interactive.headerText) {
        interactiveObj.header = {
          type: "text",
          text: interactive.headerText,
        };
      }

      if (interactive.footerText) {
        interactiveObj.footer = {
          text: interactive.footerText,
        };
      }

      return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "interactive",
        interactive: interactiveObj,
      };
    }

    if (interactive.type === "list") {
      const interactiveObj: Record<string, unknown> = {
        type: "list",
        body: {
          text: interactive.bodyText || body,
        },
        action: {
          button: interactive.buttonText,
          sections: interactive.sections.map((sec) => ({
            ...(sec.title ? { title: sec.title } : {}),
            rows: sec.rows.map((row) => ({
              id: row.id,
              title: row.title,
              ...(row.description ? { description: row.description } : {}),
            })),
          })),
        },
      };

      if (interactive.headerText) {
        interactiveObj.header = {
          type: "text",
          text: interactive.headerText,
        };
      }

      if (interactive.footerText) {
        interactiveObj.footer = {
          text: interactive.footerText,
        };
      }

      return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "interactive",
        interactive: interactiveObj,
      };
    }
  }

  if (templateName) {
    return {
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
  }

  return {
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
  interactive,
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

  // Validate interactive payload if provided
  if (interactive) {
    const validationError =
      interactive.type === "button"
        ? validateInteractiveButtons(interactive, body)
        : interactive.type === "list"
        ? validateInteractiveList(interactive, body)
        : `Unsupported interactive message type: ${(interactive as any).type}`;

    if (validationError) {
      logger.warn("whatsapp.dispatch.invalid_interactive_payload", {
        maskedPhone,
        type,
        entityId,
        error: validationError,
      });
      return {
        success: false,
        error: validationError,
      };
    }
  }

  // Safe mode: If credentials are not configured or live sending is disabled, simulate delivery
  if (!WHATSAPP_ENABLED || !WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    logger.info("whatsapp.message.simulated", {
      type,
      recipient: maskedPhone,
      entityType,
      entityId,
      bodyPreview: (interactive ? `[Interactive:${interactive.type}] ` : "") + body.slice(0, 80),
      isInteractive: Boolean(interactive),
      interactiveType: interactive?.type,
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
    const payload = buildWhatsAppPayload({
      to,
      body,
      templateName,
      templateLanguage,
      templateParameters,
      interactive,
    });

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
      isInteractive: Boolean(interactive),
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
