import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession, ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

    const isValid = await verifyAdminSession(token);

    if (!isValid) {
      return Response.json(
        {
          success: false,
          error: "Administrator access required.",
        },
        { status: 401 }
      );
    }

    try {
      const contactMessages = await prisma.contactMessage.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

      return Response.json({
        success: true,
        count: contactMessages.length,
        contactMessages,
      });
    } catch (prismaErr) {
      logger.warn("admin_contact_messages.prisma_fallback", { error: prismaErr });
      const supabase: any = createAdminClient();
      const { data: messages, error: sbError } = await (supabase.from("contact_messages") as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (sbError) {
        throw sbError;
      }

      return Response.json({
        success: true,
        count: (messages || []).length,
        contactMessages: messages || [],
      });
    }
  } catch (error: any) {
    logger.error("admin_contact_messages.get_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to get contact messages.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

    const isValid = await verifyAdminSession(token);

    if (!isValid) {
      return Response.json(
        {
          success: false,
          error: "Administrator access required.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { messageId, customerMessage, sendEmailNotification } = body;

    if (!messageId || typeof messageId !== "string") {
      return Response.json(
        { success: false, error: "Valid contact message ID is required." },
        { status: 400 }
      );
    }

    const trimmedMessage = (customerMessage || "").trim();
    if (!trimmedMessage || trimmedMessage.length < 2) {
      return Response.json(
        { success: false, error: "Please provide a valid message to send to the customer." },
        { status: 400 }
      );
    }

    // 1. Fetch contact message
    const contactMessage = await prisma.contactMessage.findUnique({
      where: { id: messageId },
    });

    if (!contactMessage) {
      return Response.json(
        { success: false, error: "Contact message not found." },
        { status: 404 }
      );
    }

    // 2. Update status to 'contacted'
    const updatedContactMessage = await prisma.contactMessage.update({
      where: { id: messageId },
      data: {
        status: "contacted",
      },
    });

    // 3. Persist NotificationLog entry for Customer Account
    const recipient = contactMessage.phone || contactMessage.email || "Customer";
    const notificationLog = await prisma.notificationLog.create({
      data: {
        entityId: contactMessage.id,
        entityType: "contact_message",
        type: "customer_message",
        channel: "account",
        recipient,
        subject: `HT Mobile Tire - Update on your ${contactMessage.service || "service"} inquiry`,
        body: trimmedMessage,
        content: trimmedMessage,
        status: "SENT",
      },
    });

    // 4. Non-blocking customer email notification dispatch

    if (contactMessage.email && (sendEmailNotification === true)) {
      try {
        await sendEmail({
          to: contactMessage.email,
          subject: `Update on your ${contactMessage.service || "Tire Service"} Request - HT Mobile Tire`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
              <h2 style="color: #e11d48; margin-top: 0;">HT Mobile Tire Dispatch Update</h2>
              <p>Hi <strong>${contactMessage.name}</strong>,</p>
              <div style="background: #f8fafc; border-left: 4px solid #e11d48; padding: 14px; margin: 16px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 15px; line-height: 1.6;">${trimmedMessage.replace(/\n/g, "<br/>")}</p>
              </div>
              <p style="font-size: 13px; color: #64748b;"><strong>Service Inquiry:</strong> ${contactMessage.service || "General Inquiry"}</p>
              <p style="font-size: 13px; color: #64748b;">Direct Hotline: <strong>${BUSINESS_PHONE_DISPLAY}</strong></p>
            </div>
          `,
          type: "status_update",
          entityId: contactMessage.id,
          entityType: "booking" as any,
        });
      } catch (emailErr) {
        logger.warn("admin_contact_messages.email_dispatch_failed", { error: emailErr });
      }
    }

    return Response.json({
      success: true,
      message: "Customer message sent successfully.",
      contactMessage: updatedContactMessage,
      notificationLog,
    });
  } catch (error: any) {
    logger.error("admin_contact_messages.post_failed", { error });
    return Response.json(
      {
        success: false,
        error: "Unable to send message to customer. Please try again.",
      },
      { status: 500 }
    );
  }
}