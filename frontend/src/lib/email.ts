import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";
import { generateQuotePdf, QuotePdfData } from "@/lib/receipts";
import {
  resolveAdminNotificationEmail,
  resolveCustomerNotificationEmail,
  CustomerEmailSource,
} from "@/lib/notifications/recipients";
import {
  buildNotificationEventKey,
  buildBookingReceivedKey,
  buildBookingConfirmedKey,
  buildTechnicianAssignedKey,
  buildTechnicianEnRouteKey,
  buildTechnicianArrivedKey,
  buildServiceStartedKey,
  buildServiceCompletedKey,
  buildBookingCancelledKey,
  buildPaymentReceivedKey,
  buildQuoteReadyKey,
  buildEmergencyAlertKey,
  buildContactAlertKey,
  buildBookingCreatedAdminKey,
} from "@/lib/notifications/identity";
import {
  renderBookingReceivedEmail,
  renderBookingConfirmedEmail,
  renderTechnicianAssignedEmail,
  renderTechnicianEnRouteEmail,
  renderTechnicianArrivedEmail,
  renderServiceStartedEmail,
  renderServiceCompletedEmail,
  renderBookingCancelledEmail,
  renderPaymentReceivedEmail,
  renderQuoteReadyEmail,
  renderEmergencyRequestCustomerEmail,
  renderAdminBookingCreatedEmail,
  renderAdminEmergencyAlertEmail,
  renderAdminContactAlertEmail,
  renderAdminBookingCancelledEmail,
  renderAdminStatusUpdateEmail,
} from "@/lib/email/templates";

// ============================================================================
// CONFIGURATION & SENDER RESOLUTION
// ============================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Prefer configured RESEND_FROM_EMAIL with FROM_EMAIL fallback and sandbox default
export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL?.trim() ||
  process.env.FROM_EMAIL?.trim() ||
  "HT Mobile Tires <onboarding@resend.dev>";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

let cachedResendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  if (!RESEND_API_KEY) {
    return null;
  }
  if (!cachedResendClient) {
    try {
      cachedResendClient = new Resend(RESEND_API_KEY);
    } catch (err) {
      logger.warn("email.resend_init_failed", { error: err });
      return null;
    }
  }
  return cachedResendClient;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toUuidOrNull(id?: string | null): string | null {
  return id && UUID_REGEX.test(id) ? id : null;
}

// ============================================================================
// TYPES
// ============================================================================

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface DispatchEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  type?: string;
  entityId?: string;
  entityType?: "booking" | "emergency_request" | "contact_message" | string;
  providerEventId?: string;
}

export interface DispatchResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  simulated?: boolean;
}

// ============================================================================
// CORE EMAIL DISPATCHER (LOW-LEVEL DIRECT & RETRY-COMPATIBLE)
// ============================================================================

/**
 * Direct email dispatcher sending directly via Resend SDK.
 * Handles sandbox unverified domain automatic fallback.
 * Does NOT create NotificationLog rows directly (used by sendEmailDirect and retry processor).
 */
export async function dispatchEmailDirect({
  to,
  subject,
  html,
  text,
  attachments,
  type = "email_notification",
  entityId,
  entityType,
}: DispatchEmailOptions): Promise<DispatchResult> {
  const resend = getResendClient();
  const recipient = Array.isArray(to) ? to.join(", ") : to;

  if (!resend) {
    logger.info("email.dispatch.simulated", {
      type,
      recipient,
      entityType,
      entityId,
      subject,
    });
    return {
      success: true,
      messageId: `simulated-email-${Date.now()}`,
      simulated: true,
    };
  }

  try {
    let response = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
      attachments,
    });

    // Development/Sandbox fallback: If custom domain is unverified, fall back to onboarding@resend.dev
    if (
      response.error &&
      response.error.message?.toLowerCase().includes("domain is not verified") &&
      !FROM_EMAIL.includes("onboarding@resend.dev")
    ) {
      logger.warn("email.dispatch.domain_unverified_fallback", {
        configuredFrom: FROM_EMAIL,
        fallbackFrom: "HT Mobile Tires <onboarding@resend.dev>",
      });

      response = await resend.emails.send({
        from: "HT Mobile Tires <onboarding@resend.dev>",
        to,
        subject,
        html,
        text,
        attachments,
      });
    }

    if (response.error) {
      throw new Error(response.error.message);
    }

    return {
      success: true,
      messageId: response.data?.id,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("email.dispatch.failed", {
      type,
      recipient,
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

// ============================================================================
// AUDIT LOGGING & IDEMPOTENT DISPATCHER
// ============================================================================

/**
 * Persists an email notification attempt into prisma.notificationLog.
 * Wrapped in safe try/catch: database log failures NEVER crash caller.
 */
async function logNotificationRecord(data: {
  recipient: string;
  type: string;
  entityType?: string;
  entityId?: string;
  status: "sent" | "failed";
  subject: string;
  body: string;
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
        channel: "email",
        recipient: data.recipient,
        type: data.type,
        status: data.status.toUpperCase(),
        content: data.body || data.subject || "Email Notification",
        subject: data.subject,
        body: data.body,
        errorMessage: data.errorMessage || null,
        messageId: data.messageId || null,
        providerEventId: data.providerEventId || null,
      },
    });
  } catch (err) {
    logger.error("email.log.persist_failed", { error: err });
  }
}

/**
 * Primary Reusable Email Dispatcher with Idempotency & NotificationLog integration.
 * Non-blocking: will never throw an uncaught error.
 */
export async function sendEmailDirect(options: DispatchEmailOptions): Promise<DispatchResult> {
  const recipient = Array.isArray(options.to) ? options.to.join(", ") : options.to;
  const type = options.type || "email_notification";

  // Deterministic Idempotency Check
  if (options.providerEventId) {
    try {
      const existing = await prisma.notificationLog.findFirst({
        where: {
          channel: "email",
          providerEventId: options.providerEventId,
          status: "SENT",
        },
      });

      if (existing) {
        logger.info("email.duplicate_suppressed", {
          providerEventId: options.providerEventId,
          type,
          recipient,
          entityId: options.entityId,
        });
        return {
          success: true,
          skipped: true,
          messageId: existing.messageId || undefined,
        };
      }
    } catch (dbErr) {
      logger.warn("email.idempotency_lookup_failed", { error: dbErr });
    }
  }

  // Execute Dispatch
  const result = await dispatchEmailDirect(options);

  // Log in NotificationLog
  await logNotificationRecord({
    recipient,
    type,
    entityType: options.entityType,
    entityId: options.entityId,
    status: result.success ? "sent" : "failed",
    subject: options.subject,
    body: options.html,
    errorMessage: result.success ? undefined : result.error,
    messageId: result.messageId,
    providerEventId: options.providerEventId,
  });

  return result;
}

// ============================================================================
// CUSTOMER HIGH-LEVEL EMAIL NOTIFICATIONS (11 TEMPLATES)
// ============================================================================

export interface CustomerNotificationBookingPayload {
  id: string;
  vehicle: string;
  location: string;
  bookingDate?: Date | string | null;
  bookingTime?: Date | string | null;
  message?: string | null;
  status: string;
  primaryService?: string | null;
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  service?: {
    name: string;
  } | null;
  technician?: {
    id?: string;
    name: string;
    phone?: string | null;
  } | null;
  etaMinutes?: number | null;
  totalAmount?: number | null;
  cancellationReason?: string | null;
}

/**
 * 1. Customer: Booking Received
 */
export async function sendCustomerBookingReceivedEmail(
  booking: CustomerNotificationBookingPayload
): Promise<DispatchResult> {
  const email = resolveCustomerNotificationEmail(booking);
  if (!email) {
    return { success: true, skipped: true, error: "no_customer_email" };
  }

  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";
  const { subject, html, text } = renderBookingReceivedEmail({
    customerName: booking.customer?.name,
    bookingId: booking.id,
    serviceName,
    vehicle: booking.vehicle,
    location: booking.location,
    bookingDate: booking.bookingDate,
    bookingTime: booking.bookingTime,
    notes: booking.message,
    accountUrl: `${APP_URL}/account?tab=bookings`,
  });

  return sendEmailDirect({
    to: email,
    subject,
    html,
    text,
    type: "BOOKING_CREATED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: buildBookingReceivedKey(booking.id),
  });
}

/**
 * 2. Customer: Booking Confirmed
 */
export async function sendCustomerBookingConfirmedEmail(
  booking: CustomerNotificationBookingPayload
): Promise<DispatchResult> {
  const email = resolveCustomerNotificationEmail(booking);
  if (!email) {
    return { success: true, skipped: true, error: "no_customer_email" };
  }

  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";
  const { subject, html, text } = renderBookingConfirmedEmail({
    customerName: booking.customer?.name,
    bookingId: booking.id,
    serviceName,
    vehicle: booking.vehicle,
    location: booking.location,
    bookingDate: booking.bookingDate,
    bookingTime: booking.bookingTime,
    accountUrl: `${APP_URL}/account?tab=bookings`,
  });

  return sendEmailDirect({
    to: email,
    subject,
    html,
    text,
    type: "BOOKING_CONFIRMED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: buildBookingConfirmedKey(booking.id),
  });
}

/**
 * 3. Customer: Technician Assigned
 */
export async function sendCustomerTechnicianAssignedEmail(params: {
  booking: CustomerNotificationBookingPayload;
  technician?: { id?: string; name: string } | null;
}): Promise<DispatchResult> {
  const { booking, technician } = params;
  const email = resolveCustomerNotificationEmail(booking);
  if (!email) {
    return { success: true, skipped: true, error: "no_customer_email" };
  }

  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";
  const techName = technician?.name || booking.technician?.name || "Certified Mobile Technician";
  const { subject, html, text } = renderTechnicianAssignedEmail({
    customerName: booking.customer?.name,
    bookingId: booking.id,
    serviceName,
    vehicle: booking.vehicle,
    location: booking.location,
    bookingDate: booking.bookingDate,
    technicianName: techName,
    accountUrl: `${APP_URL}/account?tab=bookings`,
  });

  const techId = technician?.id || booking.technician?.id;
  return sendEmailDirect({
    to: email,
    subject,
    html,
    text,
    type: "TECHNICIAN_ASSIGNED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: buildTechnicianAssignedKey(booking.id, techId),
  });
}

/**
 * 4. Customer: Technician En Route
 */
export async function sendCustomerTechnicianEnRouteEmail(params: {
  booking: CustomerNotificationBookingPayload;
  etaMinutes?: number | null;
}): Promise<DispatchResult> {
  const { booking, etaMinutes } = params;
  const email = resolveCustomerNotificationEmail(booking);
  if (!email) {
    return { success: true, skipped: true, error: "no_customer_email" };
  }

  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";
  const trackingUrl = `${APP_URL}/technician/tracking/${booking.id}`;
  const { subject, html, text } = renderTechnicianEnRouteEmail({
    customerName: booking.customer?.name,
    bookingId: booking.id,
    serviceName,
    vehicle: booking.vehicle,
    location: booking.location,
    technicianName: booking.technician?.name,
    etaMinutes: etaMinutes || booking.etaMinutes,
    trackingUrl,
    accountUrl: `${APP_URL}/account?tab=bookings`,
  });

  return sendEmailDirect({
    to: email,
    subject,
    html,
    text,
    type: "TECHNICIAN_EN_ROUTE",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: buildTechnicianEnRouteKey(booking.id),
  });
}

/**
 * 5. Customer: Technician Arrived
 */
export async function sendCustomerTechnicianArrivedEmail(
  booking: CustomerNotificationBookingPayload
): Promise<DispatchResult> {
  const email = resolveCustomerNotificationEmail(booking);
  if (!email) {
    return { success: true, skipped: true, error: "no_customer_email" };
  }

  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";
  const { subject, html, text } = renderTechnicianArrivedEmail({
    customerName: booking.customer?.name,
    bookingId: booking.id,
    serviceName,
    vehicle: booking.vehicle,
    location: booking.location,
    technicianName: booking.technician?.name,
    accountUrl: `${APP_URL}/account?tab=bookings`,
  });

  return sendEmailDirect({
    to: email,
    subject,
    html,
    text,
    type: "TECHNICIAN_ARRIVED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: buildTechnicianArrivedKey(booking.id),
  });
}

/**
 * 6. Customer: Service Started
 */
export async function sendCustomerServiceStartedEmail(
  booking: CustomerNotificationBookingPayload
): Promise<DispatchResult> {
  const email = resolveCustomerNotificationEmail(booking);
  if (!email) {
    return { success: true, skipped: true, error: "no_customer_email" };
  }

  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";
  const { subject, html, text } = renderServiceStartedEmail({
    customerName: booking.customer?.name,
    bookingId: booking.id,
    serviceName,
    vehicle: booking.vehicle,
    location: booking.location,
    technicianName: booking.technician?.name,
    accountUrl: `${APP_URL}/account?tab=bookings`,
  });

  return sendEmailDirect({
    to: email,
    subject,
    html,
    text,
    type: "SERVICE_STARTED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: buildServiceStartedKey(booking.id),
  });
}

/**
 * 7. Customer: Service Completed (With optional PDF invoice/receipt attachment)
 */
export async function sendCustomerServiceCompletedEmail(params: {
  booking: CustomerNotificationBookingPayload;
  quoteData?: QuotePdfData;
  pdfBytes?: Uint8Array;
}): Promise<DispatchResult> {
  const { booking, quoteData } = params;
  const email = resolveCustomerNotificationEmail(booking);
  if (!email) {
    return { success: true, skipped: true, error: "no_customer_email" };
  }

  const shortId = booking.id.slice(-6).toUpperCase();
  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";

  let pdfBytes = params.pdfBytes;
  if (!pdfBytes && quoteData) {
    try {
      pdfBytes = await generateQuotePdf(quoteData);
    } catch (pdfErr) {
      logger.warn("email.service_completed.pdf_generation_failed", { error: pdfErr });
    }
  }

  const attachments: EmailAttachment[] | undefined = pdfBytes
    ? [
        {
          filename: `HTMobileTires_Receipt_${shortId}.pdf`,
          content: Buffer.from(pdfBytes),
        },
      ]
    : undefined;

  const { subject, html, text } = renderServiceCompletedEmail({
    customerName: booking.customer?.name,
    bookingId: booking.id,
    serviceName,
    vehicle: booking.vehicle,
    location: booking.location,
    technicianName: booking.technician?.name,
    totalAmount: booking.totalAmount || quoteData?.totalAmount,
    accountUrl: `${APP_URL}/account?tab=bookings`,
    hasPdfAttachment: Boolean(attachments && attachments.length > 0),
  });

  return sendEmailDirect({
    to: email,
    subject,
    html,
    text,
    attachments,
    type: "SERVICE_COMPLETED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: buildServiceCompletedKey(booking.id),
  });
}

/**
 * 8. Customer: Booking Cancelled
 */
export async function sendCustomerBookingCancelledEmail(params: {
  booking: CustomerNotificationBookingPayload;
  reason?: string | null;
  cancelledBy?: string | null;
}): Promise<DispatchResult> {
  const { booking, reason, cancelledBy } = params;
  const email = resolveCustomerNotificationEmail(booking);
  if (!email) {
    return { success: true, skipped: true, error: "no_customer_email" };
  }

  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";
  const { subject, html, text } = renderBookingCancelledEmail({
    customerName: booking.customer?.name,
    bookingId: booking.id,
    serviceName,
    vehicle: booking.vehicle,
    location: booking.location,
    cancellationReason: reason,
  });

  return sendEmailDirect({
    to: email,
    subject,
    html,
    text,
    type: "BOOKING_CANCELLED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: buildBookingCancelledKey(booking.id, cancelledBy),
  });
}

/**
 * 9. Customer: Payment Received
 */
export async function sendCustomerPaymentReceivedEmail(params: {
  booking: CustomerNotificationBookingPayload;
  amountPaid: number;
  paymentMethod?: string;
}): Promise<DispatchResult> {
  const { booking, amountPaid, paymentMethod } = params;
  const email = resolveCustomerNotificationEmail(booking);
  if (!email) {
    return { success: true, skipped: true, error: "no_customer_email" };
  }

  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";
  const { subject, html, text } = renderPaymentReceivedEmail({
    customerName: booking.customer?.name,
    bookingId: booking.id,
    serviceName,
    vehicle: booking.vehicle,
    location: booking.location,
    amountPaid,
    paymentMethod,
    accountUrl: `${APP_URL}/account?tab=bookings`,
  });

  return sendEmailDirect({
    to: email,
    subject,
    html,
    text,
    type: "PAYMENT_RECEIVED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: buildPaymentReceivedKey(booking.id),
  });
}

/**
 * 10. Customer: Quote / Invoice Ready
 */
export interface SendQuoteEmailParams {
  customerEmail: string;
  customerName: string;
  bookingId: string;
  primaryService: string;
  basePrice: number;
  extraServices?: Array<{ name: string; price: number }>;
  totalAmount: number;
  notes?: string | null;
  vehicle?: string;
  location?: string;
  serviceDate?: string;
  pdfBytes?: Uint8Array;
}

export async function sendQuoteReadyEmail(params: SendQuoteEmailParams): Promise<DispatchResult> {
  const shortId = params.bookingId.slice(-6).toUpperCase();
  const customerEmail = resolveCustomerNotificationEmail(params.customerEmail);

  if (!customerEmail) {
    return { success: true, skipped: true, error: "invalid_customer_email" };
  }

  // Deduplication check: Do not duplicate Quote Ready email if another existing email path already sent invoice/completion
  try {
    const existingCompletion = await prisma.notificationLog.findFirst({
      where: {
        channel: "email",
        entityId: params.bookingId,
        type: { in: ["SERVICE_COMPLETED", "quote_ready"] },
        status: "SENT",
      },
    });
    if (existingCompletion) {
      logger.info("email.quote_ready.already_sent_or_completed", { bookingId: params.bookingId });
      return { success: true, skipped: true, messageId: existingCompletion.messageId || undefined };
    }
  } catch (lookupErr) {
    logger.warn("email.quote_ready.dedup_lookup_failed", { error: lookupErr });
  }

  let pdfBytes = params.pdfBytes;
  if (!pdfBytes) {
    try {
      pdfBytes = await generateQuotePdf({
        quoteNumber: `Q-${shortId}`,
        bookingId: params.bookingId,
        customerName: params.customerName,
        customerPhone: "",
        customerEmail: customerEmail,
        vehicle: params.vehicle || "Customer Vehicle",
        location: params.location || "On-Site Service",
        primaryService: params.primaryService,
        basePrice: params.basePrice,
        extraServices: params.extraServices,
        totalAmount: params.totalAmount,
        notes: params.notes,
        date: params.serviceDate || new Date().toLocaleDateString("en-US"),
      });
    } catch (pdfErr) {
      logger.warn("email.quote.pdf_generation_fallback", { error: pdfErr });
    }
  }

  const attachments: EmailAttachment[] | undefined = pdfBytes
    ? [
        {
          filename: `HTMobileTires_Quote_${shortId}.pdf`,
          content: Buffer.from(pdfBytes),
        },
      ]
    : undefined;

  const { subject, html, text } = renderQuoteReadyEmail({
    customerName: params.customerName,
    bookingId: params.bookingId,
    primaryService: params.primaryService,
    basePrice: params.basePrice,
    extraServices: params.extraServices,
    totalAmount: params.totalAmount,
    vehicle: params.vehicle,
    location: params.location,
    serviceDate: params.serviceDate,
    notes: params.notes,
    accountUrl: `${APP_URL}/account?tab=bookings`,
    hasPdfAttachment: Boolean(attachments && attachments.length > 0),
  });

  return sendEmailDirect({
    to: customerEmail,
    subject,
    html,
    text,
    attachments,
    type: "quote_ready",
    entityId: params.bookingId,
    entityType: "booking",
    providerEventId: buildQuoteReadyKey(params.bookingId),
  });
}

/**
 * Preserved backwards-compatible alias for existing callers of sendQuoteEmail
 */
export const sendQuoteEmail = sendQuoteReadyEmail;

/**
 * 11. Customer: Emergency Request Confirmation
 */
export interface EmergencyNotificationPayload {
  id: string;
  problem: string;
  problemDetails?: string | null;
  vehicle: string;
  currentLocation: string;
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

export async function sendCustomerEmergencyConfirmationEmail(
  emergency: EmergencyNotificationPayload
): Promise<DispatchResult> {
  const email = resolveCustomerNotificationEmail(emergency);
  if (!email) {
    return { success: true, skipped: true, error: "no_customer_email" };
  }

  const { subject, html, text } = renderEmergencyRequestCustomerEmail({
    id: emergency.id,
    customerName: emergency.customer?.name,
    problem: emergency.problem,
    problemDetails: emergency.problemDetails,
    vehicle: emergency.vehicle,
    currentLocation: emergency.currentLocation,
    accountUrl: `${APP_URL}/account?tab=emergency`,
  });

  return sendEmailDirect({
    to: email,
    subject,
    html,
    text,
    type: "EMERGENCY_REQUEST_CREATED",
    entityId: emergency.id,
    entityType: "emergency_request",
    providerEventId: buildEmergencyAlertKey(emergency.id),
  });
}

// ============================================================================
// ADMIN HIGH-LEVEL EMAIL NOTIFICATIONS (5 TEMPLATES)
// ============================================================================

/**
 * 1. Admin: New Booking Alert
 */
export async function sendAdminBookingCreatedEmail(
  booking: CustomerNotificationBookingPayload
): Promise<DispatchResult> {
  const adminEmail = resolveAdminNotificationEmail();
  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";

  const { subject, html, text } = renderAdminBookingCreatedEmail({
    bookingId: booking.id,
    customerName: booking.customer?.name,
    customerPhone: booking.customer?.phone,
    customerEmail: booking.customer?.email,
    serviceName,
    vehicle: booking.vehicle,
    location: booking.location,
    bookingDate: booking.bookingDate,
    bookingTime: booking.bookingTime,
    notes: booking.message,
    adminBookingUrl: `${APP_URL}/admin/bookings/${booking.id}`,
  });

  return sendEmailDirect({
    to: adminEmail,
    subject,
    html,
    text,
    type: "BOOKING_CREATED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: buildBookingCreatedAdminKey(booking.id),
  });
}

/**
 * 2. Admin: Emergency Roadside Alert
 */
export async function sendAdminEmergencyAlertEmail(
  emergency: EmergencyNotificationPayload
): Promise<DispatchResult> {
  const adminEmail = resolveAdminNotificationEmail();

  const { subject, html, text } = renderAdminEmergencyAlertEmail({
    emergencyId: emergency.id,
    customerName: emergency.customer?.name,
    customerPhone: emergency.customer?.phone,
    customerEmail: emergency.customer?.email,
    problem: emergency.problem,
    problemDetails: emergency.problemDetails,
    vehicle: emergency.vehicle,
    location: emergency.currentLocation,
    adminEmergencyUrl: `${APP_URL}/admin/emergency`,
  });

  return sendEmailDirect({
    to: adminEmail,
    subject,
    html,
    text,
    type: "EMERGENCY_REQUEST_CREATED",
    entityId: emergency.id,
    entityType: "emergency_request",
    providerEventId: `admin_emergency_${emergency.id}`,
  });
}

/**
 * 3. Admin: Contact Form Submission Alert
 */
export interface ContactNotificationPayload {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  service?: string | null;
  location?: string | null;
  message?: string | null;
  emergency?: boolean;
}

export async function sendAdminContactAlertEmail(
  contact: ContactNotificationPayload
): Promise<DispatchResult> {
  const adminEmail = resolveAdminNotificationEmail();

  const { subject, html, text } = renderAdminContactAlertEmail({
    contactId: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    service: contact.service,
    location: contact.location,
    message: contact.message,
    emergency: contact.emergency,
  });

  return sendEmailDirect({
    to: adminEmail,
    subject,
    html,
    text,
    type: "CONTACT_REQUEST_CREATED",
    entityId: contact.id,
    entityType: "contact_message",
    providerEventId: buildContactAlertKey(contact.id),
  });
}

/**
 * 4. Admin: Booking Cancellation Alert
 */
export async function sendAdminBookingCancelledEmail(params: {
  booking: CustomerNotificationBookingPayload;
  cancelledBy: string;
  reason?: string | null;
}): Promise<DispatchResult> {
  const { booking, cancelledBy, reason } = params;
  const adminEmail = resolveAdminNotificationEmail();
  const serviceName = booking.service?.name || booking.primaryService || "Mobile Tire Service";

  const { subject, html, text } = renderAdminBookingCancelledEmail({
    bookingId: booking.id,
    cancelledBy,
    customerName: booking.customer?.name,
    customerPhone: booking.customer?.phone,
    vehicle: booking.vehicle,
    serviceName,
    reason,
    adminBookingUrl: `${APP_URL}/admin/bookings/${booking.id}`,
  });

  return sendEmailDirect({
    to: adminEmail,
    subject,
    html,
    text,
    type: "BOOKING_CANCELLED",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: `admin_cancelled_${booking.id}`,
  });
}

/**
 * 5. Admin: Important Status Update Alert
 */
export async function sendAdminStatusUpdateEmail(params: {
  booking: CustomerNotificationBookingPayload;
  newStatus: string;
  technicianNotes?: string | null;
}): Promise<DispatchResult> {
  const { booking, newStatus, technicianNotes } = params;
  const adminEmail = resolveAdminNotificationEmail();

  const { subject, html, text } = renderAdminStatusUpdateEmail({
    bookingId: booking.id,
    newStatus,
    customerName: booking.customer?.name,
    customerPhone: booking.customer?.phone,
    vehicle: booking.vehicle,
    technicianName: booking.technician?.name,
    technicianNotes,
    adminBookingUrl: `${APP_URL}/admin/bookings/${booking.id}`,
  });

  return sendEmailDirect({
    to: adminEmail,
    subject,
    html,
    text,
    type: "status_update",
    entityId: booking.id,
    entityType: "booking",
    providerEventId: `admin_status_${booking.id}_${newStatus}`,
  });
}
