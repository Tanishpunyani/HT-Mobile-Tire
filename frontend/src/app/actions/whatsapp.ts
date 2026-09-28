"use server";

import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { dispatchWhatsAppDirect, maskPhoneForLogging } from "@/lib/notifications/whatsapp";

export type AdminConversationStatus = "bot_active" | "human_handoff" | "closed";

export interface GetConversationsFilter {
  search?: string;
  status?: "all" | AdminConversationStatus;
}

export interface AdminConversationSummary {
  id: string;
  customerPhone: string;
  status: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  activeBookingId: string | null;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  activeBooking: {
    id: string;
    reference: string;
    vehicle: string;
    status: string;
    bookingDate: string;
    bookingTime: string;
  } | null;
  lastMessage: {
    body: string | null;
    direction: string;
    type: string;
    createdAt: string;
  } | null;
  metadata: Record<string, unknown> | null;
  hasUnreadMessages: boolean;
}

export interface AdminMessageItem {
  id: string;
  wamid: string;
  direction: string;
  type: string;
  body: string | null;
  senderRole: "customer" | "bot" | "admin";
  adminEmail: string | null;
  deliveryStatus?: "SENT" | "DELIVERED" | "READ" | "FAILED" | null;
  createdAt: string;
}

// ============================================================================
// A. GET WHATSAPP CONVERSATIONS ACTION
// ============================================================================

/**
 * Returns list of WhatsApp conversations for the admin inbox.
 * Strict admin session check. Never exposes raw tokens or technician private data.
 */
export async function getWhatsAppConversationsAction(
  filter?: GetConversationsFilter
): Promise<{ success: boolean; conversations?: AdminConversationSummary[]; error?: string }> {
  try {
    await requireAdminSession();

    const where: Record<string, unknown> = {};

    if (filter?.status && filter.status !== "all") {
      where.status = filter.status;
    }

    if (filter?.search) {
      const q = filter.search.trim();
      if (q) {
        where.OR = [
          { customerPhone: { contains: q, mode: "insensitive" } },
          { customer: { name: { contains: q, mode: "insensitive" } } },
          { customer: { email: { contains: q, mode: "insensitive" } } },
          { customer: { phone: { contains: q, mode: "insensitive" } } },
          { activeBooking: { vehicle: { contains: q, mode: "insensitive" } } },
        ];
      }
    }

    const conversations = await prisma.whatsAppConversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        activeBooking: {
          select: {
            id: true,
            vehicle: true,
            status: true,
            bookingDate: true,
            bookingTime: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            body: true,
            direction: true,
            type: true,
            createdAt: true,
          },
        },
      },
    });

    const safeSummaries: AdminConversationSummary[] = conversations.map((c) => {
      const meta = (c.metadata as Record<string, unknown>) || null;
      const lastReadAt = typeof meta?.lastReadAt === "string" ? new Date(meta.lastReadAt).getTime() : 0;
      const lastMsg = c.messages[0] || null;

      // Only mark unread if latest message was an inbound customer message
      // and it occurred strictly after the staff's lastReadAt timestamp
      const hasUnreadMessages = Boolean(
        lastMsg &&
          lastMsg.direction === "inbound" &&
          new Date(lastMsg.createdAt).getTime() > lastReadAt
      );

      return {
        id: c.id,
        customerPhone: c.customerPhone,
        status: c.status,
        lastMessageAt: c.lastMessageAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        activeBookingId: c.activeBookingId,
        customer: c.customer
          ? {
              id: c.customer.id,
              name: c.customer.name,
              email: c.customer.email,
              phone: c.customer.phone,
            }
          : null,
        activeBooking: c.activeBooking
          ? {
              id: c.activeBooking.id,
              reference: `#${c.activeBooking.id.slice(0, 8).toUpperCase()}`,
              vehicle: c.activeBooking.vehicle,
              status: c.activeBooking.status,
              bookingDate:
                c.activeBooking.bookingDate instanceof Date
                  ? c.activeBooking.bookingDate.toISOString().split("T")[0]
                  : String(c.activeBooking.bookingDate),
              bookingTime:
                c.activeBooking.bookingTime instanceof Date
                  ? c.activeBooking.bookingTime.toISOString().split("T")[1]?.slice(0, 5) || ""
                  : String(c.activeBooking.bookingTime).slice(0, 5),
            }
          : null,
        lastMessage: lastMsg
          ? {
              body: lastMsg.body,
              direction: lastMsg.direction,
              type: lastMsg.type,
              createdAt: lastMsg.createdAt.toISOString(),
            }
          : null,
        metadata: meta,
        hasUnreadMessages,
      };
    });

    return { success: true, conversations: safeSummaries };
  } catch (err: unknown) {
    logger.error("whatsapp_action.get_conversations_failed", {
      error: (err as Error)?.message || err,
    });
    return {
      success: false,
      error: (err as Error)?.message || "Failed to load WhatsApp conversations.",
    };
  }
}

// ============================================================================
// B. GET WHATSAPP CONVERSATION MESSAGES ACTION
// ============================================================================

/**
 * Returns chronological message transcript for a specific conversation.
 * Strict admin session check, validates conversationId, derives safe senderRole.
 */
export async function getWhatsAppConversationMessagesAction(
  conversationId: string
): Promise<{ success: boolean; messages?: AdminMessageItem[]; error?: string }> {
  try {
    await requireAdminSession();

    if (!conversationId || typeof conversationId !== "string" || conversationId.trim() === "") {
      return { success: false, error: "Invalid conversation ID." };
    }

    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, metadata: true },
    });

    if (!conversation) {
      return { success: false, error: "Conversation not found." };
    }

    // Step 5: Update metadata.lastReadAt when staff fetches conversation messages
    const existingMetadata =
      conversation.metadata && typeof conversation.metadata === "object"
        ? (conversation.metadata as Record<string, unknown>)
        : {};

    const updatedMetadata = {
      ...existingMetadata,
      lastReadAt: new Date().toISOString(),
    };

    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        metadata: updatedMetadata as any,
      },
    }).catch((err) => {
      logger.warn("whatsapp_action.update_last_read_failed", { conversationId, error: err });
    });

    const rawMessages = await prisma.whatsAppMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        wamid: true,
        direction: true,
        type: true,
        body: true,
        rawPayload: true,
        createdAt: true,
      },
    });

    const messages: AdminMessageItem[] = rawMessages.map((m) => {
      let senderRole: "customer" | "bot" | "admin" = "customer";
      let adminEmail: string | null = null;
      let deliveryStatus: "SENT" | "DELIVERED" | "READ" | "FAILED" | null = null;

      const raw = m.rawPayload as Record<string, unknown> | null;

      if (m.direction === "outbound") {
        if (raw?.source === "admin") {
          senderRole = "admin";
          adminEmail = typeof raw.adminEmail === "string" ? raw.adminEmail : null;
        } else {
          senderRole = "bot";
        }

        // Step 4: Extract deliveryStatus for outbound messages
        if (typeof raw?.deliveryStatus === "string") {
          const s = raw.deliveryStatus.toUpperCase();
          if (["SENT", "DELIVERED", "READ", "FAILED"].includes(s)) {
            deliveryStatus = s as "SENT" | "DELIVERED" | "READ" | "FAILED";
          }
        }
      } else {
        senderRole = "customer";
      }

      return {
        id: m.id,
        wamid: m.wamid,
        direction: m.direction,
        type: m.type,
        body: m.body,
        senderRole,
        adminEmail,
        deliveryStatus,
        createdAt: m.createdAt.toISOString(),
      };
    });

    return { success: true, messages };
  } catch (err: unknown) {
    logger.error("whatsapp_action.get_messages_failed", {
      conversationId,
      error: (err as Error)?.message || err,
    });
    return {
      success: false,
      error: (err as Error)?.message || "Failed to load conversation messages.",
    };
  }
}

// ============================================================================
// C. SEND ADMIN WHATSAPP REPLY ACTION
// ============================================================================

/**
 * Sends a human admin reply to the customer on WhatsApp.
 * Always resolves recipient from database record (never client-supplied phone).
 * Reuses existing dispatchWhatsAppDirect() and persists to WhatsAppMessage.
 */
export async function sendAdminWhatsAppReplyAction(
  conversationId: string,
  text: string
): Promise<{ success: boolean; message?: AdminMessageItem; error?: string }> {
  try {
    const session = await requireAdminSession();

    if (!conversationId || typeof conversationId !== "string" || conversationId.trim() === "") {
      return { success: false, error: "Invalid conversation ID." };
    }

    const trimmedText = (text || "").trim();
    if (!trimmedText) {
      return { success: false, error: "Message text cannot be empty." };
    }

    if (trimmedText.length > 4096) {
      return { success: false, error: "Message exceeds maximum allowed length of 4096 characters." };
    }

    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      include: {
        activeBooking: {
          select: { id: true },
        },
      },
    });

    if (!conversation) {
      return { success: false, error: "Conversation not found." };
    }

    const recipientPhone = conversation.customerPhone;
    const maskedPhone = maskPhoneForLogging(recipientPhone);

    // Reuse existing official WhatsApp provider
    const dispatchResult = await dispatchWhatsAppDirect({
      to: recipientPhone,
      body: trimmedText,
      type: "admin_agent_message",
      entityId: conversation.activeBooking?.id || undefined,
      entityType: conversation.activeBooking?.id ? "booking" : undefined,
    });

    if (!dispatchResult.success) {
      logger.error("whatsapp_action.admin_reply_dispatch_rejected", {
        conversationId,
        recipient: maskedPhone,
        error: dispatchResult.error,
      });

      // Step 10: Meta 131047 Error Handling
      // Error code 131047: Re-engagement window expired (> 24 hours since customer's last reply)
      const errStr = dispatchResult.error || "";
      if (errStr.includes("131047") || /24\s*hours/i.test(errStr)) {
        return {
          success: false,
          error:
            "Meta Cloud API Policy: The 24-hour customer service window has expired. You cannot send plain-text messages until the customer messages again or an approved template is sent.",
        };
      }

      return {
        success: false,
        error: dispatchResult.error || "Failed to deliver WhatsApp message via Meta Cloud API.",
      };
    }

    const outboundWamid =
      dispatchResult.messageId ||
      `wamid.outbound.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

    const now = new Date();

    // Persist outbound message with senderRole admin
    const newMessage = await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        wamid: outboundWamid,
        direction: "outbound",
        type: "text",
        body: trimmedText,
        rawPayload: {
          source: "admin",
          adminEmail: session.email,
          sentAt: now.toISOString(),
          simulated: dispatchResult.simulated || false,
        } as any,
        createdAt: now,
      },
    });

    // Update conversation timestamp and ensure status remains/becomes human_handoff
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: now,
        status: "human_handoff",
      },
    });

    logger.info("whatsapp_action.admin_reply_delivered", {
      conversationId: conversation.id,
      adminEmail: session.email,
      wamid: outboundWamid,
      recipient: maskedPhone,
      simulated: dispatchResult.simulated || false,
    });

    return {
      success: true,
      message: {
        id: newMessage.id,
        wamid: newMessage.wamid,
        direction: "outbound",
        type: "text",
        body: newMessage.body,
        senderRole: "admin",
        adminEmail: session.email,
        createdAt: newMessage.createdAt.toISOString(),
      },
    };
  } catch (err: unknown) {
    logger.error("whatsapp_action.admin_reply_exception", {
      conversationId,
      error: (err as Error)?.message || err,
    });
    return {
      success: false,
      error: (err as Error)?.message || "Failed to send WhatsApp message.",
    };
  }
}

// ============================================================================
// D. SET CONVERSATION STATUS ACTION
// ============================================================================

const ALLOWED_STATUSES: readonly AdminConversationStatus[] = [
  "bot_active",
  "human_handoff",
  "closed",
] as const;

/**
 * Toggles status between bot_active, human_handoff, and closed.
 * Merges metadata with audit attributes without dropping existing fields.
 */
export async function setConversationStatusAction(
  conversationId: string,
  status: AdminConversationStatus
): Promise<{ success: boolean; status?: AdminConversationStatus; error?: string }> {
  try {
    const session = await requireAdminSession();

    if (!conversationId || typeof conversationId !== "string" || conversationId.trim() === "") {
      return { success: false, error: "Invalid conversation ID." };
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return {
        success: false,
        error: `Invalid status. Allowed values are: ${ALLOWED_STATUSES.join(", ")}`,
      };
    }

    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, metadata: true },
    });

    if (!conversation) {
      return { success: false, error: "Conversation not found." };
    }

    const existingMetadata =
      conversation.metadata && typeof conversation.metadata === "object"
        ? (conversation.metadata as Record<string, unknown>)
        : {};

    const updatedMetadata: Record<string, unknown> = { ...existingMetadata };
    const nowIso = new Date().toISOString();

    if (status === "human_handoff") {
      updatedMetadata.assignedAdminEmail = session.email;
      updatedMetadata.handoffActivatedAt = nowIso;
      delete updatedMetadata.closedAt;
      delete updatedMetadata.closedBy;
    } else if (status === "closed") {
      updatedMetadata.closedAt = nowIso;
      updatedMetadata.closedBy = session.email;
    } else if (status === "bot_active") {
      updatedMetadata.resumedAt = nowIso;
      updatedMetadata.resumedBy = session.email;
      delete updatedMetadata.closedAt;
      delete updatedMetadata.closedBy;
    }

    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        status,
        metadata: updatedMetadata as any,
        updatedAt: new Date(),
      },
    });

    logger.info("whatsapp_action.status_updated", {
      conversationId: conversation.id,
      newStatus: status,
      adminEmail: session.email,
    });

    return { success: true, status };
  } catch (err: unknown) {
    logger.error("whatsapp_action.set_status_failed", {
      conversationId,
      status,
      error: (err as Error)?.message || err,
    });
    return {
      success: false,
      error: (err as Error)?.message || "Failed to update conversation status.",
    };
  }
}
