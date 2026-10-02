import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/validations/contact";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { sendAdminContactAlert } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`contact_${clientIp}`, 5, 60 * 1000);

    if (!rateLimit.allowed) {
      return Response.json(
        {
          success: false,
          error: "Too many messages sent. Please wait a minute before trying again.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();

    const result = contactSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        {
          success: false,
          error: "Invalid contact information.",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      name,
      phone,
      email,
      service,
      location,
      emergency,
      message,
    } = result.data;

    // Create contact message
    const contactMessage = await prisma.contactMessage.create({
      data: {
        name,
        phone,
        email: email || null,
        service: service || null,
        location: location || null,
        emergency: emergency === true,
        message,
      },
    });

    // Non-blocking Admin SMS Alert (Phase 3B)
    try {
      await sendAdminContactAlert(contactMessage);
    } catch (notifErr) {
      logger.warn("contact_messages.admin_notification_failed", { error: notifErr });
    }

    return Response.json(
      {
        success: true,
        message: "Contact message created successfully.",
        contactMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("contact_messages.create_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to create contact message.",
      },
      { status: 500 }
    );
  }
}