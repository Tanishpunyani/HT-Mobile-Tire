import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";
import { logger } from "@/lib/logger";
import { resolveCustomerNotificationEmail, resolveBookingCustomerEmail } from "@/lib/notifications/recipients";
import {
  dispatchEmailDirect as dispatchEmailDirectService,
  sendEmailDirect as sendEmailDirectService,
  sendCustomerBookingReceivedEmail,
  sendCustomerBookingConfirmedEmail,
  sendCustomerTechnicianAssignedEmail,
  sendCustomerTechnicianEnRouteEmail,
  sendCustomerTechnicianArrivedEmail,
  sendCustomerServiceStartedEmail,
  sendCustomerServiceCompletedEmail,
  sendCustomerBookingCancelledEmail,
  sendCustomerPaymentReceivedEmail,
  sendQuoteReadyEmail,
  sendCustomerEmergencyConfirmationEmail,
  sendAdminBookingCreatedEmail,
  sendAdminEmergencyAlertEmail,
  sendAdminContactAlertEmail,
  sendAdminBookingCancelledEmail,
  sendAdminStatusUpdateEmail,
} from "@/lib/email";

export {
  sendCustomerBookingReceivedEmail,
  sendCustomerBookingConfirmedEmail,
  sendCustomerTechnicianAssignedEmail,
  sendCustomerTechnicianEnRouteEmail,
  sendCustomerTechnicianArrivedEmail,
  sendCustomerServiceStartedEmail,
  sendCustomerServiceCompletedEmail,
  sendCustomerBookingCancelledEmail,
  sendCustomerPaymentReceivedEmail,
  sendQuoteReadyEmail,
  sendCustomerEmergencyConfirmationEmail,
  sendAdminBookingCreatedEmail,
  sendAdminEmergencyAlertEmail,
  sendAdminContactAlertEmail,
  sendAdminBookingCancelledEmail,
  sendAdminStatusUpdateEmail,
};


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

export type NotificationChannel = "sms" | "email";

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
  customerEmail?: string | null;
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
  totalAmount?: number | null;
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
 * Delegates to centralized email service in lib/email.ts.
 * Does NOT create a NotificationLog row.
 */
export async function dispatchEmailDirect({
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
  return dispatchEmailDirectService({
    to,
    subject,
    html,
    type,
    entityId,
    entityType,
  });
}

/**
 * Sends an HTML email via Resend and creates a NotificationLog entry.
 * Non-blocking: delegates to centralized sendEmailDirect in lib/email.ts.
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
  return sendEmailDirectService({
    to,
    subject,
    html,
    type,
    entityId,
    entityType,
  });
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

// ============================================================================
// HIGH-LEVEL NOTIFICATION FLOWS (EMAIL-ONLY LIFECYCLE REWIRING)
// ============================================================================

/**
 * 1. Customer: Booking Received (BOOKING_CREATED)
 * Dispatches branded HTML confirmation Email to Customer.
 */
export async function sendBookingConfirmation(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}> {
  return sendCustomerBookingReceivedEmail(booking);
}

/**
 * Triggered on new EmergencyRequest creation:
 * - Branded HTML Email to Customer with ETA (30-45 min) & live hotline
 * - High-priority Alert Email to Admin Dispatch
 * Active WhatsApp dispatch removed in Phase 10C.4.
 */
export async function sendEmergencyAlert(emergency: EmergencyNotificationPayload): Promise<{
  success: boolean;
  results: PromiseSettledResult<unknown>[];
}> {
  const customerPromise = sendCustomerEmergencyConfirmationEmail(emergency);
  const adminPromise = sendAdminEmergencyAlertEmail(emergency);

  const results = await Promise.allSettled([customerPromise, adminPromise]);
  return { success: true, results };
}

/**
 * Triggered on new Booking creation:
 * Alerts central dispatch / admin via Email.
 */
export async function sendAdminBookingCreatedAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}> {
  return sendAdminBookingCreatedEmail(booking);
}

/**
 * Triggered on new Contact form submission:
 * Alerts on-duty technician or central dispatch via Email.
 * Active WhatsApp dispatch removed in Phase 10C.4.
 */
export async function sendAdminContactAlert(contactMessage: ContactNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}> {
  return sendAdminContactAlertEmail(contactMessage);
}

/**
 * Triggered on Booking Cancellation (Customer or Admin):
 * Alerts central dispatch via Email.
 * Active WhatsApp dispatch removed in Phase 10C.4.
 */
export async function sendAdminBookingCancelledAlert(params: BookingCancelledAlertParams): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}> {
  return sendAdminBookingCancelledEmail({
    booking: {
      id: params.booking.id,
      vehicle: params.booking.vehicle || "Vehicle",
      location: (params.booking as any).location || "On-Site Service",
      status: (params.booking as any).status || "cancelled",
      customer: params.booking.customer,
      service: params.booking.service,
      primaryService: params.booking.primaryService,
    },
    cancelledBy: params.cancelledBy,
    reason: params.reason,
  });
}

/**
 * 1. Customer Alert: Booking Confirmed (BOOKING_CONFIRMED)
 * Dispatches email confirmation to customer.
 */
export async function sendCustomerBookingConfirmedAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}> {
  return sendCustomerBookingConfirmedEmail(booking);
}

/**
 * 2. Customer Alert: Technician Assigned (TECHNICIAN_ASSIGNED)
 * Dispatches email alert when technician is assigned.
 * Active WhatsApp dispatch removed in Phase 10C.4.
 */
export async function sendCustomerTechnicianAssignedAlert(params: {
  booking: BookingNotificationPayload;
  technician?: { id?: string; name: string; phone?: string | null } | null;
}): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}> {
  return sendCustomerTechnicianAssignedEmail(params);
}

/**
 * 3. Customer Alert: Technician En Route (TECHNICIAN_EN_ROUTE)
 * Dispatches email alert with ETA and live tracking link.
 * Active WhatsApp dispatch removed in Phase 10C.4.
 */
export async function sendCustomerTechnicianEnRouteAlert(params: {
  booking: BookingNotificationPayload;
  etaMinutes?: number | null;
}): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}> {
  return sendCustomerTechnicianEnRouteEmail(params);
}

/**
 * 4. Customer Alert: Technician Arrived (TECHNICIAN_ARRIVED)
 * Dispatches email alert when technician arrives on-site.
 * Active WhatsApp dispatch removed in Phase 10C.4.
 */
export async function sendCustomerTechnicianArrivedAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}> {
  return sendCustomerTechnicianArrivedEmail(booking);
}

/**
 * Customer Alert: Service Started (SERVICE_STARTED)
 * Dispatches email alert when technician begins work on vehicle.
 */
export async function sendCustomerServiceStartedAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}> {
  return sendCustomerServiceStartedEmail(booking);
}

/**
 * Customer Alert: Service Completed (SERVICE_COMPLETED)
 * Dispatches dedicated operational email alert when service work is completed.
 */
export async function sendCustomerServiceCompletedAlert(
  booking: BookingNotificationPayload & { pdfBytes?: Uint8Array }
): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}> {
  return sendCustomerServiceCompletedEmail({
    booking,
    pdfBytes: booking.pdfBytes,
  });
}

/**
 * 5. Customer Alert: Booking Cancelled (BOOKING_CANCELLED)
 * Dispatches email notification on cancellation.
 * Active WhatsApp dispatch removed in Phase 10C.4.
 */
export async function sendCustomerBookingCancelledAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}> {
  return sendCustomerBookingCancelledEmail({ booking });
}

/**
 * 6. Customer Alert: Payment Received (PAYMENT_RECEIVED)
 * Dispatches email payment confirmation.
 * Active WhatsApp dispatch removed in Phase 10C.4.
 */
export async function sendCustomerPaymentReceivedAlert(booking: BookingNotificationPayload): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}> {
  const amountPaid = booking.totalAmount ? Number(booking.totalAmount) : 0;
  return sendCustomerPaymentReceivedEmail({
    booking,
    amountPaid,
  });
}

/**
 * Triggered on Admin Booking status changes (e.g. confirmed, in_progress, completed, cancelled)
 * Sends customer status update email and admin status update alert.
 */
export async function sendStatusUpdate({
  booking,
  newStatus,
  technicianNotes,
}: {
  booking: BookingNotificationPayload;
  newStatus: string;
  technicianNotes?: string;
}): Promise<{ success: boolean; results?: unknown[]; error?: string }> {
  const customerEmail = resolveBookingCustomerEmail(booking.customerEmail);
  const dispatchPromises: Promise<unknown>[] = [];

  // 1. Admin status alert email
  dispatchPromises.push(
    sendAdminStatusUpdateEmail({
      booking,
      newStatus,
      technicianNotes,
    })
  );

  // 2. Customer status update email (if customer email is available and not a terminal event)
  // CRITICAL RULE: If newStatus is 'confirmed', customer confirmation requires technicianId !== null
  const shouldSkipCustomerConfirmed =
    newStatus === "confirmed" && !(booking as any).technicianId;

  if (customerEmail && !shouldSkipCustomerConfirmed) {
    const statusDescriptions: Record<string, { title: string; color: string; message: string }> = {
      confirmed: {
        title: "Booking Confirmed & Technician Assigned",
        color: "#2563eb",
        message: "Your appointment has been approved and a technician van is assigned to your time slot.",
      },
      in_progress: {
        title: "Technician Arrived / Service In Progress",
        color: "#9333ea",
        message: "Our mobile van is currently on-site performing your tire service. We will notify you once complete.",
      },
      completed: {
        title: "Tire Service Completed Successfully",
        color: "#16a34a",
        message: "Your mobile tire service is complete! Your tires have been installed, torqued, and verified to factory spec.",
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

    const accountUrl = `${APP_URL}/account?tab=bookings`;
    const serviceName = booking.service?.name || "Mobile Tire Service";
    const customerName = booking.customer?.name || "Customer";

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
      sendEmailDirectService({
        to: customerEmail,
        subject: `Update on your Mobile Tire Service (${serviceName})`,
        html: emailHtml,
        type: "status_update",
        entityId: booking.id,
        entityType: "booking",
        providerEventId: `customer_status_${booking.id}_${newStatus}`,
      })
    );
  }

  const results = await Promise.allSettled(dispatchPromises);
  return { success: true, results };
}

/**
 * Triggered when a Quote / Invoice is finalized for a completed service:
 * - Branded HTML Email with full itemized breakdown & attached PDF receipt
 * Active WhatsApp dispatch removed in Phase 10C.4.
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
  pdfBytes,
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
  pdfBytes?: Uint8Array;
}): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}> {
  return sendQuoteReadyEmail({
    bookingId,
    customerName,
    customerEmail: customerEmail || "",
    primaryService: serviceName,
    vehicle,
    basePrice,
    extraServices: extraServices || undefined,
    totalAmount,
    notes,
    pdfBytes,
  });
}

// ============================================================================
// RETRY MECHANISM
// ============================================================================

/**
 * Re-attempts delivery for failed notifications (max 3 retries)
 * Retries active delivery channel (email).
 * Legacy SMS and WhatsApp records are safely marked terminal/skipped to prevent clogging retry queues.
 */
export async function retryFailedNotifications(limit = 10) {
  try {
    const failedLogs = await prisma.notificationLog.findMany({
      where: {
        status: "FAILED",
        retryCount: { lt: 3 },
        channel: { in: ["email", "sms", "whatsapp"] },
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

      // Legacy WhatsApp records are skipped since WhatsApp channel is decommissioned
      if (log.channel === "whatsapp") {
        logger.info("notifications.retry.whatsapp_skipped", { id: log.id });
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            retryCount: 3,
            errorMessage: "WhatsApp channel decommissioned",
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
