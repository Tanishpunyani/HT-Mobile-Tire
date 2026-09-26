import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";
import { logger } from "@/lib/logger";
import { dispatchWhatsAppDirect } from "@/lib/notifications/whatsapp";


// ============================================================================
// ENVIRONMENT & CONFIGURATION
// ============================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "HT Mobile Tires <onboarding@resend.dev>";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

function getResendClient() {
  if (RESEND_API_KEY) {
    try {
      return new Resend(RESEND_API_KEY);
    } catch (err) {
      logger.warn("notifications.resend_init_failed", { error: err });
    }
  }
  return null;
}

// ============================================================================
// TYPES
// ============================================================================

export type NotificationChannel = "sms" | "email" | "whatsapp";

export type NotificationType =
  | "booking_confirmation"
  | "emergency_alert"
  | "status_update"
  | "technician_dispatch"
  | "quote_ready"
  | "customer_message"
  | "technician_assigned"
  | "technician_en_route"
  | "technician_arrived"
  | "booking_cancelled"
  | "contact_alert"
  | "BOOKING_CREATED"
  | "BOOKING_CONFIRMED"
  | "TECHNICIAN_ASSIGNED"
  | "TECHNICIAN_EN_ROUTE"
  | "TECHNICIAN_ARRIVED"
  | "SERVICE_STARTED"
  | "SERVICE_COMPLETED"
  | "EMERGENCY_REQUEST_CREATED"
  | "CONTACT_REQUEST_CREATED"
  | "BOOKING_CANCELLED"
  | "PAYMENT_RECEIVED";

export interface BookingNotificationPayload {
  id: string;
  vehicle: string;
  location: string;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bookingDate: Date | string;
  bookingTime: Date | string;
  message?: string | null;
  status: string;
  primaryService?: string | null;
  customer?: {
    name: string;
    phone: string;
    email?: string | null;
  } | null;
  service?: {
    name: string;
  } | null;
  technician?: {
    id?: string;
    name: string;
    phone?: string | null;
  } | null;
}

export interface EmergencyNotificationPayload {
  id: string;
  currentLocation: string;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  problem: string;
  problemDetails?: string | null;
  vehicle: string;
  status: string;
  createdAt?: Date | string;
  customer?: {
    name: string;
    phone: string;
    email?: string | null;
  } | null;
  service?: {
    name: string;
  } | null;
}

export interface ContactNotificationPayload {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  service?: string | null;
  location?: string | null;
  emergency?: boolean;
  message?: string | null;
}

export interface BookingCancelledAlertParams {
  booking: {
    id: string;
    vehicle?: string | null;
    primaryService?: string | null;
    service?: { name: string } | null;
    customer?: {
      name?: string | null;
      phone?: string | null;
    } | null;
  };
  cancelledBy: "customer" | "admin" | "Customer" | "Admin";
  reason?: string | null;
}

// ============================================================================
// LOW-LEVEL DISPATCHERS (WITH LOGGING & FALLBACK)
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toUuidOrNull(id?: string | null): string | null {
  return id && UUID_REGEX.test(id) ? id : null;
}

/**
 * Direct email dispatcher (used by sendEmail and retry mechanism)
 * Does NOT create a NotificationLog row.
 */
async function dispatchEmailDirect({
  to,
  subject,
  html,
  type,
  entityId,
  entityType,
}: {
  to: string;
  subject: string;
  html: string;
  type: NotificationType;
  entityId?: string;
  entityType?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const resend = getResendClient();

  if (!resend) {
    logger.info("notifications.email.simulated", {
      type,
      recipient: to,
      entityType,
      entityId,
      subject,
    });
    return { success: true, messageId: "simulated-email-" + Date.now() };
  }

  try {
    let response = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to,
      subject,
      html,
    });

    // Development/Sandbox fallback: If custom domain is not yet verified in Resend, fall back to onboarding sender
    if (
      response.error &&
      response.error.message?.toLowerCase().includes("domain is not verified") &&
      !RESEND_FROM_EMAIL.includes("onboarding@resend.dev")
    ) {
      logger.warn("notifications.email.domain_unverified_fallback", {
        configuredFrom: RESEND_FROM_EMAIL,
        fallbackFrom: "HT Mobile Tires <onboarding@resend.dev>",
      });
      response = await resend.emails.send({
        from: "HT Mobile Tires <onboarding@resend.dev>",
        to,
        subject,
        html,
      });
    }

    if (response.error) {
      throw new Error(response.error.message);
    }

    return { success: true, messageId: response.data?.id };
  } catch (error: unknown) {
    const errorMsg = (error as Error)?.message || "Unknown Resend error";
    logger.error("notifications.email.failed", {
      type,
      recipient: to,
      entityType,
      entityId,
      error: errorMsg,
    });
    return { success: false, error: errorMsg };
  }
}

/**
 * Sends an HTML email via Resend and creates a NotificationLog entry.
 * Non-blocking: will never crash caller if Resend fails or keys are missing.
 */
export async function sendEmail({
  to,
  subject,
  html,
  type,
  entityId,
  entityType,
}: {
  to: string;
  subject: string;
  html: string;
  type: NotificationType;
  entityId?: string;
  entityType: "booking" | "emergency_request";
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const result = await dispatchEmailDirect({
    to,
    subject,
    html,
    type,
    entityId,
    entityType,
  });

  await logNotification({
    channel: "email",
    recipient: to,
    type,
    entityType,
    entityId,
    status: result.success ? "sent" : "failed",
    subject,
    body: html,
    errorMessage: result.success ? undefined : result.error,
    messageId: result.messageId,
  });

  return result;
}

/**
 * Sends a WhatsApp message via Meta WhatsApp Business Platform / Cloud API
 * and creates a NotificationLog entry.
 * Idempotent: checks providerEventId to prevent duplicate customer alerts.
 */
export async function sendWhatsApp({
  to,
  body,
  type,
  entityId,
  entityType,
  providerEventId,
  templateName,
  templateParameters,
}: {
  to: string;
  body: string;
  type: NotificationType;
  entityId?: string;
  entityType: "booking" | "emergency_request" | "contact_message" | string;
  providerEventId?: string;
  templateName?: string;
  templateParameters?: Array<{ type: "text"; text: string }>;
}): Promise<{ success: boolean; messageId?: string; error?: string; skipped?: boolean }> {
  // Idempotency check: avoid duplicate customer WhatsApp messages if providerEventId exists
  if (providerEventId) {
    const existing = await prisma.notificationLog.findFirst({
      where: {
        channel: "whatsapp",
        providerEventId,
        status: "SENT",
      },
    });

    if (existing) {
      logger.info("notifications.whatsapp.duplicate_suppressed", {
        providerEventId,
        type,
        entityId,
      });
      return { success: true, skipped: true, messageId: existing.messageId || undefined };
    }
  }

  const result = await dispatchWhatsAppDirect({
    to,
    body,
    type,
    entityId,
    entityType,
    templateName,
    templateParameters,
  });

  await logNotification({
    channel: "whatsapp",
    recipient: to,
    type,
    entityType,
    entityId,
    status: result.success ? "sent" : "failed",
    subject: `WhatsApp: ${type}`,
    body,
    errorMessage: result.success ? undefined : result.error,
    messageId: result.messageId,
    providerEventId,
  });

  return result;
}

async function logNotification(data: {
  channel: string;
  recipient: string;
  type: string;
  entityType: string;
  entityId?: string;
  status: string;
  subject?: string;
  body?: string;
  errorMessage?: string;
  messageId?: string;
  providerEventId?: string;
}) {
  try {
    const isBooking = data.entityType === "booking";
    const isEmergency = data.entityType === "emergency_request";
    const validEntityUuid = toUuidOrNull(data.entityId);

    await prisma.notificationLog.create({
      data: {
        bookingId: isBooking && validEntityUuid ? validEntityUuid : null,
        emergencyRequestId: isEmergency && validEntityUuid ? validEntityUuid : null,
        entityId: validEntityUuid,
        entityType: data.entityType || null,
        channel: data.channel,
        recipient: data.recipient,
        type: data.type,
        status: data.status.toUpperCase(),
        content: data.body || data.subject || "Notification",
        subject: data.subject || null,
        body: data.body || null,
        errorMessage: data.errorMessage || null,
        messageId: data.messageId || null,
        providerEventId: data.providerEventId || null,
      },
    });
  } catch (err) {
    logger.error("notifications.log.persist_failed", { error: err });
  }
}

// ============================================================================
// HIGH-LEVEL NOTIFICATION FLOWS
// ============================================================================

/**
 * Triggered on new Booking creation:
 * - Branded HTML confirmation Email to Customer
 * - SMS transport removed; WhatsApp transport to be attached in next phase
 */
export async function sendBookingConfirmation(booking: BookingNotificationPayload) {
  const serviceName = booking.service?.name || "Mobile Tire Service";
  const customerName = booking.customer?.name || "Customer";
  const customerEmail = booking.customer?.email;

  const formattedDate =
    typeof booking.bookingDate === "string" && !booking.bookingDate.includes("T")
      ? booking.bookingDate
      : new Date(booking.bookingDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

  const formattedTime =
    typeof booking.bookingTime === "string" && !booking.bookingTime.includes("T")
      ? booking.bookingTime
      : new Date(booking.bookingTime).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });

  const dispatchPromises: Promise<unknown>[] = [];

  // Customer Email HTML
  if (customerEmail) {
    const manageUrl = `${APP_URL}/account?tab=bookings`;
    const customerEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: #0f172a; padding: 32px 24px; text-align: center; border-bottom: 4px solid #e11d48; }
          .header h1 { color: #ffffff; font-size: 24px; margin: 0 0 6px 0; font-weight: 800; }
          .header p { color: #fb7185; font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 0; letter-spacing: 1px; }
          .content { padding: 32px 24px; }
          .status-pill { display: inline-block; background: #dcfce7; color: #15803d; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; text-transform: uppercase; margin-bottom: 16px; }
          .details-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf2f7; font-size: 14px; }
          .row:last-child { border-bottom: none; }
          .label { color: #64748b; font-weight: 600; }
          .value { color: #0f172a; font-weight: 700; text-align: right; }
          .cta-button { display: block; width: 100%; box-sizing: border-box; background: #e11d48; color: #ffffff !important; text-align: center; padding: 14px 20px; border-radius: 10px; font-weight: 700; text-decoration: none; margin-top: 24px; font-size: 15px; }
          .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <p>HT Mobile Tires</p>
            <h1>Request Received</h1>
          </div>
          <div class="content">
            <span class="status-pill">&#10003; On-Demand 24/7 Dispatch</span>
            <p style="font-size: 15px; margin-top: 0;">Hi <strong>${customerName}</strong>,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              We have received your mobile tire service request. Our dispatch team is allocating an equipped technician van to your location.
            </p>

            <div class="details-box">
              <div class="row">
                <span class="label">Service</span>
                <span class="value">${serviceName}</span>
              </div>
              <div class="row">
                <span class="label">Requested At</span>
                <span class="value">${formattedDate} at ${formattedTime}</span>
              </div>
              <div class="row">
                <span class="label">Vehicle</span>
                <span class="value">${booking.vehicle}</span>
              </div>
              <div class="row">
                <span class="label">Location</span>
                <span class="value">${booking.location}</span>
              </div>
              ${
                booking.message
                  ? `<div class="row"><span class="label">Your Notes</span><span class="value">"${booking.message}"</span></div>`
                  : ""
              }
            </div>

            <a href="${manageUrl}" class="cta-button">View &amp; Manage Booking in Account &rarr;</a>
          </div>
          <div class="footer">
            <p style="margin: 0 0 6px 0;">Need immediate assistance or need to reschedule? Call <strong>${BUSINESS_PHONE_DISPLAY}</strong></p>
            <p style="margin: 0;">HT Mobile Tires &bull; Professional On-Demand Roadside &amp; Driveway Tire Service</p>
          </div>
        </div>
      </body>
      </html>
    `;

    dispatchPromises.push(
      sendEmail({
        to: customerEmail,
        subject: `Booking Confirmed: ${serviceName} - HT Mobile Tires`,
        html: customerEmailHtml,
        type: "booking_confirmation",
        entityId: booking.id,
        entityType: "booking",
      })
    );
  }

  // Customer WhatsApp Notification (Request Received / Pending Dispatch)
  if (booking.customer?.phone) {
    const manageUrl = `${APP_URL}/account?tab=bookings`;
    const bookingRef = `#${booking.id.slice(-6).toUpperCase()}`;
    const waBody = `HT Mobile Tires — Booking Request Received\n\nHi ${customerName}, we have received your mobile tire service request for booking ${bookingRef} (${serviceName}) on ${formattedDate} at ${formattedTime}.\n\nVehicle: ${booking.vehicle}\nLocation: ${booking.location}\n\nOur dispatch team is allocating an equipped mobile technician van to your location. We will notify you once confirmed.\n\nManage Booking: ${manageUrl}\nSupport: ${BUSINESS_PHONE_DISPLAY}`;

    dispatchPromises.push(
      sendWhatsApp({
        to: booking.customer.phone,
        body: waBody,
        type: "booking_confirmation",
        entityId: booking.id,
        entityType: "booking",
        providerEventId: `booking_created_${booking.id}`,
      })
    );
  }

  const results = await Promise.allSettled(dispatchPromises);
  return { success: true, results };
}

/**
 * Triggered on new EmergencyRequest creation:
 * - Branded HTML Email to Customer with ETA (30-45 min) & live hotline
 * - SMS transport removed; WhatsApp transport to be attached in next phase
 */
export async function sendEmergencyAlert(emergency: EmergencyNotificationPayload) {
  const customerName = emergency.customer?.name || "Customer";
  const customerEmail = emergency.customer?.email;

  const dispatchPromises: Promise<unknown>[] = [];

  if (customerEmail) {
    const trackUrl = `${APP_URL}/account?tab=emergency`;
    const customerEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #fecdd3; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: #991b1b; padding: 32px 24px; text-align: center; border-bottom: 4px solid #e11d48; }
          .header h1 { color: #ffffff; font-size: 22px; margin: 0 0 6px 0; font-weight: 800; }
          .header p { color: #fecdd3; font-size: 12px; font-weight: 800; text-transform: uppercase; margin: 0; letter-spacing: 1px; }
          .content { padding: 32px 24px; }
          .eta-banner { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; }
          .eta-banner h2 { color: #e11d48; margin: 0 0 4px 0; font-size: 20px; font-weight: 800; }
          .eta-banner p { color: #991b1b; margin: 0; font-size: 13px; font-weight: 600; }
          .details-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; font-size: 14px; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf2f7; }
          .row:last-child { border-bottom: none; }
          .label { color: #64748b; font-weight: 600; }
          .value { color: #0f172a; font-weight: 700; text-align: right; }
          .cta-button { display: block; width: 100%; box-sizing: border-box; background: #e11d48; color: #ffffff !important; text-align: center; padding: 14px 20px; border-radius: 10px; font-weight: 700; text-decoration: none; margin-top: 20px; font-size: 15px; }
          .call-box { background: #0f172a; color: #ffffff; border-radius: 12px; padding: 16px; text-align: center; margin-top: 20px; }
          .call-box a { color: #fb7185; font-weight: 800; text-decoration: none; font-size: 18px; display: inline-block; margin-top: 4px; }
          .footer { background: #f1f5f9; padding: 18px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <p>&#128680; Roadside Emergency Dispatch</p>
            <h1>Help Is On The Way!</h1>
          </div>
          <div class="content">
            <div class="eta-banner">
              <h2>Estimated Arrival: 30&ndash;45 Minutes</h2>
              <p>Your emergency request has been prioritized for mobile dispatch.</p>
            </div>

            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Hi <strong>${customerName}</strong>, our nearest mobile technician van has received your breakdown details and location. Please stay in a safe spot away from traffic.
            </p>

            <div class="details-box">
              <div class="row">
                <span class="label">Issue Reported</span>
                <span class="value" style="color: #e11d48;">${emergency.problem}</span>
              </div>
              <div class="row">
                <span class="label">Vehicle</span>
                <span class="value">${emergency.vehicle}</span>
              </div>
              <div class="row">
                <span class="label">Location</span>
                <span class="value">${emergency.currentLocation}</span>
              </div>
              ${
                emergency.problemDetails
                  ? `<div class="row"><span class="label">Details</span><span class="value">"${emergency.problemDetails}"</span></div>`
                  : ""
              }
            </div>

            <div class="call-box">
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">Direct Technician Hotline (24/7)</p>
              <a href="tel:${BUSINESS_PHONE_RAW}">&#128222; ${BUSINESS_PHONE_DISPLAY}</a>
            </div>

            <a href="${trackUrl}" class="cta-button">Track Status in Customer Account &rarr;</a>
          </div>
          <div class="footer">
            <p style="margin: 0;">HT Mobile Tires &bull; 24/7 Roadside Assistance &amp; Tire Replacement</p>
          </div>
        </div>
      </body>
      </html>
    `;

    dispatchPromises.push(
      sendEmail({
        to: customerEmail,
        subject: `[EMERGENCY DISPATCH] Help is On The Way - HT Mobile Tires`,
        html: customerEmailHtml,
        type: "emergency_alert",
        entityId: emergency.id,
        entityType: "emergency_request",
      })
    );
  }

  // Customer Priority WhatsApp Notification
  if (emergency.customer?.phone) {
    const trackUrl = `${APP_URL}/account?tab=emergency`;
    const waBody = `🚨 HT Mobile Tires — Priority Emergency Dispatch\n\nHi ${customerName}, our nearest mobile technician van has received your breakdown details.\n\nIssue: ${emergency.problem}\nVehicle: ${emergency.vehicle}\nLocation: ${emergency.currentLocation}\nEstimated Arrival: 30-45 minutes\n\nPlease stay in a safe spot away from traffic.\nDirect Hotline: ${BUSINESS_PHONE_DISPLAY}\nTrack: ${trackUrl}`;

    dispatchPromises.push(
      sendWhatsApp({
        to: emergency.customer.phone,
        body: waBody,
        type: "emergency_alert",
        entityId: emergency.id,
        entityType: "emergency_request",
        providerEventId: `emergency_alert_${emergency.id}`,
      })
    );
  }

  const results = await Promise.allSettled(dispatchPromises);
  return { success: true, results };
}

/**
 * Triggered on new Booking creation:
 * Alerts central dispatch / admin via WhatsApp
 */
export async function sendAdminBookingCreatedAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}> {
  const adminPhone = process.env.TECHNICIAN_PHONE_NUMBER;
  if (!adminPhone) {
    return { success: true, skipped: true, reason: "no_admin_phone" };
  }

  const customerName = booking.customer?.name || "Customer";
  const customerPhone = booking.customer?.phone || "N/A";
  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";
  const bookingRef = `#${booking.id.slice(-6).toUpperCase()}`;

  const formattedDate =
    typeof booking.bookingDate === "string" && !booking.bookingDate.includes("T")
      ? booking.bookingDate
      : new Date(booking.bookingDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

  const formattedTime =
    typeof booking.bookingTime === "string" && !booking.bookingTime.includes("T")
      ? booking.bookingTime
      : new Date(booking.bookingTime).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });

  const adminBookingUrl = `${APP_URL}/admin/bookings/${booking.id}`;

  const waBody = `NEW BOOKING REQUEST\nBooking: ${bookingRef}\n\nCustomer: ${customerName}\nPhone: ${customerPhone}\nService: ${serviceName}\nVehicle: ${booking.vehicle}\nLocation: ${booking.location}\nDate: ${formattedDate}\nTime: ${formattedTime}\n\nOpen booking in Admin Dashboard:\n${adminBookingUrl}`;

  return sendWhatsApp({
    to: adminPhone,
    body: waBody,
    type: "BOOKING_CREATED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: `admin_booking_created_${booking.id}`,
  });
}

/**
 * Triggered on new Contact form submission:
 * Alerts on-duty technician or central dispatch via WhatsApp
 */
export async function sendAdminContactAlert(contactMessage: ContactNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}> {
  const adminPhone = process.env.TECHNICIAN_PHONE_NUMBER;
  if (!adminPhone) {
    return { success: true, skipped: true, reason: "no_admin_phone" };
  }

  const waBody = `HT Mobile Tires — New Contact Request\n\nName: ${contactMessage.name}\nPhone: ${contactMessage.phone}\nService: ${contactMessage.service || "General Inquiry"}\nLocation: ${contactMessage.location || "N/A"}\nMessage: "${contactMessage.message || ""}"`;

  return sendWhatsApp({
    to: adminPhone,
    body: waBody,
    type: "CONTACT_REQUEST_CREATED",
    entityId: contactMessage.id,
    entityType: "contact_message",
    providerEventId: `admin_contact_${contactMessage.id}`,
  });
}

/**
 * Triggered on Booking Cancellation (Customer or Admin):
 * Alerts central dispatch via WhatsApp
 */
export async function sendAdminBookingCancelledAlert(params: BookingCancelledAlertParams): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}> {
  const adminPhone = process.env.TECHNICIAN_PHONE_NUMBER;
  if (!adminPhone) {
    return { success: true, skipped: true, reason: "no_admin_phone" };
  }

  const waBody = `HT Mobile Tires — Booking Cancelled Alert\n\nBooking: #${params.booking.id.slice(-6).toUpperCase()}\nCancelled by: ${params.cancelledBy}\nCustomer: ${params.booking.customer?.name || "N/A"} (${params.booking.customer?.phone || "N/A"})\nVehicle: ${params.booking.vehicle || "N/A"}\nReason: ${params.reason || "None provided"}`;

  return sendWhatsApp({
    to: adminPhone,
    body: waBody,
    type: "BOOKING_CANCELLED",
    entityId: params.booking.id,
    entityType: "booking",
    providerEventId: `admin_cancel_${params.booking.id}`,
  });
}

/**
 * 1. Customer Alert: Booking Confirmed (BOOKING_CONFIRMED)
 * Dispatches WhatsApp confirmation to customer phone.
 */
export async function sendCustomerBookingConfirmedAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}> {
  if (!booking.customer?.phone) {
    return { success: true, skipped: true, reason: "no_phone" };
  }

  const customerName = booking.customer.name || "Customer";
  const serviceName = booking.service?.name || "Mobile Tire Service";
  const formattedDate =
    typeof booking.bookingDate === "string" && !booking.bookingDate.includes("T")
      ? booking.bookingDate
      : new Date(booking.bookingDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

  const formattedTime =
    typeof booking.bookingTime === "string" && !booking.bookingTime.includes("T")
      ? booking.bookingTime
      : new Date(booking.bookingTime).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });

  const manageUrl = `${APP_URL}/account?tab=bookings`;
  const bookingRef = `#${booking.id.slice(-6).toUpperCase()}`;
  const waBody = `HT Mobile Tires — Booking Confirmed\n\nHi ${customerName}, your appointment for booking ${bookingRef} (${serviceName}) on ${formattedDate} at ${formattedTime} has been CONFIRMED!\n\nLocation: ${booking.location}\nVehicle: ${booking.vehicle}\n\nWe look forward to servicing your vehicle.\nManage Booking: ${manageUrl}\nSupport: ${BUSINESS_PHONE_DISPLAY}`;

  return sendWhatsApp({
    to: booking.customer.phone,
    body: waBody,
    type: "BOOKING_CONFIRMED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: `booking_confirmed_${booking.id}`,
  });
}

/**
 * 2. Customer Alert: Technician Assigned (TECHNICIAN_ASSIGNED)
 * Dispatches WhatsApp alert when technician is assigned.
 */
export async function sendCustomerTechnicianAssignedAlert(params: {
  booking: BookingNotificationPayload;
  technician?: { id?: string; name: string; phone?: string | null } | null;
}): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}> {
  const { booking, technician } = params;
  if (!booking.customer?.phone) {
    return { success: true, skipped: true, reason: "no_phone" };
  }

  const customerName = booking.customer.name || "Customer";
  const serviceName = booking.service?.name || "Mobile Tire Service";
  const techName = technician?.name || "A certified technician";

  const waBody = `HT Mobile Tires — Technician Assigned\n\nHi ${customerName}, certified technician ${techName} has been assigned to your mobile tire service (${serviceName}) for your ${booking.vehicle}.\n\nWe will notify you with live updates as soon as the technician is en route to ${booking.location}.\nSupport: ${BUSINESS_PHONE_DISPLAY}`;

  return sendWhatsApp({
    to: booking.customer.phone,
    body: waBody,
    type: "TECHNICIAN_ASSIGNED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: `tech_assigned_${booking.id}_${technician?.id || "assigned"}`,
  });
}

/**
 * 3. Customer Alert: Technician En Route (TECHNICIAN_EN_ROUTE)
 * Dispatches WhatsApp alert with ETA and live tracking link.
 */
export async function sendCustomerTechnicianEnRouteAlert(params: {
  booking: BookingNotificationPayload;
  etaMinutes?: number | null;
}): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}> {
  const { booking, etaMinutes } = params;
  if (!booking.customer?.phone) {
    return { success: true, skipped: true, reason: "no_phone" };
  }

  const customerName = booking.customer.name || "Customer";
  const eta = etaMinutes ? `${etaMinutes} minutes` : "30-45 minutes";
  const trackingUrl = `${APP_URL}/technician/tracking/${booking.id}`;

  const waBody = `HT Mobile Tires — Technician En Route\n\nHi ${customerName}, our mobile technician is on the way to your location!\n\nEstimated Arrival: ${eta}\nVehicle: ${booking.vehicle}\nLocation: ${booking.location}\n\nTrack Technician Live: ${trackingUrl}\nHotline: ${BUSINESS_PHONE_DISPLAY}`;

  return sendWhatsApp({
    to: booking.customer.phone,
    body: waBody,
    type: "TECHNICIAN_EN_ROUTE",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: `tech_en_route_${booking.id}_${Date.now()}`,
  });
}

/**
 * 4. Customer Alert: Technician Arrived (TECHNICIAN_ARRIVED)
 * Dispatches WhatsApp alert when technician arrives on-site.
 */
export async function sendCustomerTechnicianArrivedAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}> {
  if (!booking.customer?.phone) {
    return { success: true, skipped: true, reason: "no_phone" };
  }

  const customerName = booking.customer.name || "Customer";
  const waBody = `HT Mobile Tires — Technician Arrived\n\nHi ${customerName}, our mobile technician has arrived at ${booking.location} and is preparing to begin service on your ${booking.vehicle}.\n\nPlease ensure the vehicle is accessible.\nQuestions? Call: ${BUSINESS_PHONE_DISPLAY}`;

  return sendWhatsApp({
    to: booking.customer.phone,
    body: waBody,
    type: "TECHNICIAN_ARRIVED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: `tech_arrived_${booking.id}`,
  });
}

/**
 * Customer Alert: Service Started (SERVICE_STARTED)
 * Dispatches WhatsApp alert when technician begins work on vehicle.
 */
export async function sendCustomerServiceStartedAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}> {
  if (!booking.customer?.phone) {
    return { success: true, skipped: true, reason: "no_phone" };
  }

  const customerName = booking.customer.name || "Customer";
  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";
  const bookingRef = `#${booking.id.slice(-6).toUpperCase()}`;

  const waBody = `HT Mobile Tires — Service Started\n\nHi ${customerName},\nWork on your booking ${bookingRef} (${serviceName}) has now started.\n\nVehicle: ${booking.vehicle}\nLocation: ${booking.location}\n\nOur technician is currently working on your vehicle.\nSupport: ${BUSINESS_PHONE_DISPLAY}`;

  return sendWhatsApp({
    to: booking.customer.phone,
    body: waBody,
    type: "SERVICE_STARTED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: `service_started_${booking.id}`,
  });
}

/**
 * Customer Alert: Service Completed (SERVICE_COMPLETED)
 * Dispatches dedicated operational WhatsApp alert when service work is completed.
 */
export async function sendCustomerServiceCompletedAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}> {
  if (!booking.customer?.phone) {
    return { success: true, skipped: true, reason: "no_phone" };
  }

  const customerName = booking.customer.name || "Customer";
  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";
  const bookingRef = `#${booking.id.slice(-6).toUpperCase()}`;

  const waBody = `HT Mobile Tires — Service Completed\n\nHi ${customerName},\nYour mobile tire service for booking ${bookingRef} has been completed successfully.\n\nService: ${serviceName}\nVehicle: ${booking.vehicle}\nLocation: ${booking.location}\nStatus: Completed\n\nThank you for choosing HT Mobile Tires!\nSupport: ${BUSINESS_PHONE_DISPLAY}`;

  return sendWhatsApp({
    to: booking.customer.phone,
    body: waBody,
    type: "SERVICE_COMPLETED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: `service_completed_${booking.id}`,
  });
}

/**
 * 5. Customer Alert: Booking Cancelled (BOOKING_CANCELLED)
 * Dispatches WhatsApp notification on cancellation.
 */
export async function sendCustomerBookingCancelledAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}> {
  if (!booking.customer?.phone) {
    return { success: true, skipped: true, reason: "no_phone" };
  }

  const customerName = booking.customer.name || "Customer";
  const bookingUrl = `${APP_URL}/booking`;

  const waBody = `HT Mobile Tires — Booking Cancelled\n\nHi ${customerName}, your appointment for ${booking.vehicle} has been cancelled.\n\nIf you need to rebook or have questions, visit ${bookingUrl} or call our dispatch team at ${BUSINESS_PHONE_DISPLAY}.`;

  return sendWhatsApp({
    to: booking.customer.phone,
    body: waBody,
    type: "BOOKING_CANCELLED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: `booking_cancelled_${booking.id}`,
  });
}

/**
 * 6. Customer Alert: Payment Received (PAYMENT_RECEIVED)
 * Dispatches WhatsApp payment confirmation.
 */
export async function sendCustomerPaymentReceivedAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}> {
  if (!booking.customer?.phone) {
    return { success: true, skipped: true, reason: "no_phone" };
  }

  const customerName = booking.customer.name || "Customer";
  const accountUrl = `${APP_URL}/account?tab=bookings`;

  const waBody = `HT Mobile Tires — Payment Received\n\nHi ${customerName}, thank you for your payment for Booking #${booking.id.slice(-6).toUpperCase()}!\n\nYour receipt and service invoice are available in your account:\n${accountUrl}\n\nThank you for choosing HT Mobile Tires!`;

  return sendWhatsApp({
    to: booking.customer.phone,
    body: waBody,
    type: "PAYMENT_RECEIVED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: `payment_received_${booking.id}`,
  });
}

/**
 * Triggered on Admin Booking status changes (e.g. confirmed, in_progress, completed, cancelled)
 */
export async function sendStatusUpdate({
  booking,
  newStatus,
  technicianNotes,
}: {
  booking: BookingNotificationPayload;
  newStatus: string;
  technicianNotes?: string;
}) {
  const customerName = booking.customer?.name || "Customer";
  const customerEmail = booking.customer?.email;
  const serviceName = booking.service?.name || "Mobile Tire Service";

  const statusDescriptions: Record<string, { title: string; color: string; message: string }> = {
    confirmed: {
      title: "Booking Confirmed & Technician Assigned",
      color: "#2563eb",
      message:
        "Your appointment has been approved and a technician van is assigned to your time slot.",
    },
    in_progress: {
      title: "Technician Arrived / Service In Progress",
      color: "#9333ea",
      message:
        "Our mobile van is currently on-site performing your tire service. We will notify you once complete.",
    },
    completed: {
      title: "Tire Service Completed Successfully",
      color: "#16a34a",
      message:
        "Your mobile tire service is complete! Your tires have been installed, torqued, and verified to factory spec.",
    },
    cancelled: {
      title: "Booking Status Update: Cancelled",
      color: "#dc2626",
      message: "Your appointment has been cancelled. If this was a mistake, please contact us.",
    },
  };

  const currentInfo = statusDescriptions[newStatus] || {
    title: `Booking Status: ${newStatus.replace("_", " ").toUpperCase()}`,
    color: "#0f172a",
    message: `Your booking status has been updated to ${newStatus}.`,
  };

  const dispatchPromises: Promise<unknown>[] = [];

  if (customerEmail) {
    const accountUrl = `${APP_URL}/account?tab=bookings`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
          .header { background: #0f172a; padding: 28px 24px; text-align: center; border-bottom: 4px solid ${currentInfo.color}; }
          .header h1 { color: #ffffff; font-size: 22px; margin: 0; font-weight: 800; }
          .content { padding: 30px 24px; }
          .status-badge { display: inline-block; background: ${currentInfo.color}15; color: ${currentInfo.color}; font-weight: 800; font-size: 12px; padding: 6px 14px; border-radius: 999px; text-transform: uppercase; border: 1px solid ${currentInfo.color}30; }
          .notes-box { background: #f8fafc; border-left: 4px solid ${currentInfo.color}; padding: 14px; border-radius: 0 8px 8px 0; margin: 18px 0; font-size: 13px; }
          .cta-button { display: block; width: 100%; box-sizing: border-box; background: #e11d48; color: #ffffff !important; text-align: center; padding: 13px; border-radius: 10px; font-weight: 700; text-decoration: none; margin-top: 20px; font-size: 14px; }
          .footer { background: #f1f5f9; padding: 18px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>HT Mobile Tires</h1>
          </div>
          <div class="content">
            <span class="status-badge">${currentInfo.title}</span>
            <p style="font-size: 15px; margin-top: 16px;">Hi <strong>${customerName}</strong>,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">${currentInfo.message}</p>

            ${
              technicianNotes
                ? `<div class="notes-box"><strong>Technician Note:</strong> "${technicianNotes}"</div>`
                : ""
            }

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; font-size: 13px; margin-top: 16px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: #64748b;">Service:</span>
                <span style="font-weight: 700;">${serviceName}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Vehicle:</span>
                <span style="font-weight: 700;">${booking.vehicle}</span>
              </div>
            </div>

            <a href="${accountUrl}" class="cta-button">View Account Details &rarr;</a>
          </div>
          <div class="footer">
            <p style="margin: 0;">HT Mobile Tires &bull; Support: ${BUSINESS_PHONE_DISPLAY}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    dispatchPromises.push(
      sendEmail({
        to: customerEmail,
        subject: `Update on your Mobile Tire Service (${serviceName})`,
        html: emailHtml,
        type: "status_update",
        entityId: booking.id,
        entityType: "booking",
      })
    );
  }

  const results = await Promise.allSettled(dispatchPromises);
  return { success: true, results };
}

/**
 * Triggered when a Quote / Invoice is finalized for a completed service:
 * - Branded HTML Email with full itemized breakdown & PDF receipt access
 * - SMS transport removed; WhatsApp transport to be attached in next phase
 */
export async function sendQuoteReadyNotification({
  bookingId,
  customerName,
  customerPhone,
  customerEmail,
  serviceName,
  vehicle,
  basePrice,
  extraServices,
  totalAmount,
  notes,
}: {
  bookingId: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  serviceName: string;
  vehicle: string;
  basePrice: number;
  extraServices?: Array<{ name: string; price: number }> | null;
  totalAmount: number;
  notes?: string | null;
}) {
  const accountUrl = `${APP_URL}/account?tab=bookings`;
  const dispatchPromises: Promise<unknown>[] = [];

  const extraServicesHtml = (extraServices || [])
    .map(
      (extra) => `
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
        <span style="color: #475569;">+ ${extra.name}</span>
        <span style="font-weight: 700; color: #0f172a;">$${Number(extra.price).toFixed(2)}</span>
      </div>`
    )
    .join("");

  if (customerEmail) {
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
          .header { background: #0f172a; padding: 28px 24px; text-align: center; border-bottom: 4px solid #16a34a; }
          .header h1 { color: #ffffff; font-size: 22px; margin: 0; font-weight: 800; }
          .content { padding: 30px 24px; }
          .total-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
          .total-box h2 { color: #16a34a; margin: 0; font-size: 28px; font-weight: 800; }
          .cta-button { display: block; width: 100%; box-sizing: border-box; background: #e11d48; color: #ffffff !important; text-align: center; padding: 13px; border-radius: 10px; font-weight: 700; text-decoration: none; margin-top: 20px; font-size: 14px; }
          .footer { background: #f1f5f9; padding: 18px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>HT Mobile Tires</h1>
          </div>
          <div class="content">
            <p style="font-size: 15px; margin-top: 0;">Hi <strong>${customerName}</strong>,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              Your mobile tire service is complete and your invoice has been generated.
            </p>

            <div class="total-box">
              <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #15803d;">Total Amount</p>
              <h2>$${totalAmount.toFixed(2)}</h2>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0;">
              <div style="display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">
                <span style="color: #64748b;">${serviceName} (${vehicle})</span>
                <span style="font-weight: 700;">$${basePrice.toFixed(2)}</span>
              </div>
              ${extraServicesHtml}
              ${notes ? `<p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b;"><strong>Technician Note:</strong> ${notes}</p>` : ""}
            </div>

            <a href="${accountUrl}" class="cta-button">View in Account &amp; Download PDF Receipt &rarr;</a>
          </div>
          <div class="footer">
            <p style="margin: 0;">HT Mobile Tires &bull; Support: ${BUSINESS_PHONE_DISPLAY}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    dispatchPromises.push(
      sendEmail({
        to: customerEmail,
        subject: `Your Invoice & Receipt is Ready: ${serviceName} - HT Mobile Tires`,
        html: emailHtml,
        type: "quote_ready",
        entityId: bookingId,
        entityType: "booking",
      })
    );
  }

  // Customer WhatsApp Invoice Notification
  if (customerPhone) {
    const waBody = `HT Mobile Tires — Service Quote & Invoice Ready\n\nHi ${customerName}, your invoice for ${serviceName} (${vehicle}) has been finalized.\n\nTotal Amount: $${totalAmount.toFixed(2)}\n\nView details & download receipt: ${accountUrl}`;

    dispatchPromises.push(
      sendWhatsApp({
        to: customerPhone,
        body: waBody,
        type: "quote_ready",
        entityId: bookingId,
        entityType: "booking",
        providerEventId: `quote_ready_${bookingId}`,
      })
    );
  }

  const results = await Promise.allSettled(dispatchPromises);
  return { success: true, results };
}

// ============================================================================
// RETRY MECHANISM
// ============================================================================

/**
 * Re-attempts delivery for failed notifications (max 3 retries)
 * Retries active delivery channels (email, whatsapp).
 * Legacy SMS records are safely filtered out to prevent clogging retry queues.
 */
export async function retryFailedNotifications(limit = 10) {
  try {
    const failedLogs = await prisma.notificationLog.findMany({
      where: {
        status: "FAILED",
        retryCount: { lt: 3 },
        channel: { in: ["email", "whatsapp"] },
      },
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    if (failedLogs.length === 0) {
      return { total: 0, succeeded: 0, failed: 0, message: "No failed notifications to retry." };
    }

    let retried = 0;

    for (const log of failedLogs) {
      // Concurrency protection: Atomically claim row by incrementing retryCount
      const claimed = await prisma.notificationLog.updateMany({
        where: {
          id: log.id,
          status: "FAILED",
          retryCount: log.retryCount,
        },
        data: {
          retryCount: { increment: 1 },
        },
      });

      if (claimed.count === 0) {
        continue;
      }

      // Legacy SMS records are skipped since SMS Gateway is decommissioned
      if (log.channel === "sms") {
        logger.info("notifications.retry.sms_skipped", { id: log.id });
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            retryCount: 3,
            errorMessage: "SMS gateway decommissioned",
          },
        });
        continue;
      }

      const entityId = log.entityId || log.bookingId || log.emergencyRequestId || undefined;
      const entityType = (log.entityType as "booking" | "emergency_request" | undefined) || (log.emergencyRequestId ? "emergency_request" : "booking");

      let result: { success: boolean; messageId?: string; error?: string } = { success: false };

      if (log.channel === "email") {
        if (!log.recipient || !log.body || !log.subject) {
          await prisma.notificationLog.update({
            where: { id: log.id },
            data: {
              status: "FAILED",
              errorMessage: "Non-retryable: Missing recipient, subject, or HTML body payload",
              retryCount: 3,
            },
          });
          continue;
        }

        result = await dispatchEmailDirect({
          to: log.recipient,
          subject: log.subject,
          html: log.body,
          type: log.type as NotificationType,
          entityId,
          entityType,
        });
      }

      if (log.channel === "whatsapp") {
        if (!log.recipient || !log.body) {
          await prisma.notificationLog.update({
            where: { id: log.id },
            data: {
              status: "FAILED",
              errorMessage: "Non-retryable: Missing recipient phone or body payload",
              retryCount: 3,
            },
          });
          continue;
        }

        result = await dispatchWhatsAppDirect({
          to: log.recipient,
          body: log.body,
          type: log.type as NotificationType,
          entityId,
          entityType,
        });
      }

      if (result.success) {
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: "SENT",
            messageId: result.messageId || null,
            errorMessage: null,
          },
        });
        retried++;
      } else {
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: "FAILED",
            errorMessage: result.error || "Retry attempt failed",
          },
        });
      }
    }

    return { total: failedLogs.length, succeeded: retried, failed: failedLogs.length - retried };
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || "Unknown retry error";
    logger.error("notifications.retry.failed", { error: errorMsg });
    return { error: errorMsg, total: 0, succeeded: 0, failed: 0 };
  }
}

// ============================================================================
// RETENTION & CLEANUP
// ============================================================================

/**
 * Prunes old notification logs older than retentionDays (default 90 days).
 * Only deletes records with status 'SENT' / 'sent'.
 * Preserves FAILED, PENDING, and all records within the retention window.
 */
export async function pruneOldNotificationLogs(retentionDays = 90) {
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await prisma.notificationLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        status: {
          in: ["SENT", "sent"],
        },
      },
    });

    logger.info("notifications.cleanup.completed", {
      prunedCount: result.count,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    });

    return {
      success: true,
      count: result.count,
      cutoffDate,
      retentionDays,
    };
  } catch (error: unknown) {
    logger.error("notifications.cleanup.failed", { error });
    throw error;
  }
}
