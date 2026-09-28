import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { normalizePhoneNumber, getPhoneCandidates } from "@/lib/utils/phone";
import { maskPhoneForLogging } from "@/lib/notifications/whatsapp";
import { calculateCustomerEta, CustomerEtaResult } from "@/lib/utils/eta";
import { validateBookingTransition } from "@/lib/bookings/state-machine";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";

// ============================================================================
// BASE URL RESOLUTION
// ============================================================================

function getValidBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl !== "..." && envUrl.trim() !== "") {
    try {
      new URL(envUrl);
      return envUrl.replace(/\/+$/, "");
    } catch {
      // Fallback on malformed URL
    }
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");
  }
  return "https://mobiletire.clinic";
}

// ============================================================================
// TYPES & INTERFACES (CUSTOMER-SAFE DTOs)
// ============================================================================

export interface CustomerSafeBookingSummary {
  id: string;
  reference: string;
  serviceName: string;
  vehicle: string;
  location: string;
  status: string;
  bookingDate: string;
  bookingTime: string;
  paymentStatus: string;
  totalAmount: number | null;
  receiptUrl: string | null;
}

export interface CustomerSafeTechnician {
  id: string;
  name: string;
  role: string;
}

export interface CustomerSafeExtraService {
  name: string;
  price: number;
}

export interface CustomerSafeBooking extends CustomerSafeBookingSummary {
  tireSize: string | null;
  message: string | null;
  formattedAddress: string | null;
  technician: CustomerSafeTechnician | null;
  eta: CustomerEtaResult;
  trackingUrl: string | null;
  extraServices: CustomerSafeExtraService[] | null;
}

export interface ServiceCatalogItem {
  name: string;
  slug: string;
  description: string | null;
  price: number | null;
}

export interface WhatsAppCustomerContext {
  customer: {
    id: string | null;
    name: string | null;
    phone: string;
    email: string | null;
    isKnown: boolean;
  };
  conversation: {
    id: string | null;
    status: string;
    activeBookingId: string | null;
    metadata: Record<string, any> | null;
  };
  bookingContext: {
    hasBookings: boolean;
    activeBookingsCount: number;
    activeBooking: CustomerSafeBooking | null;
    candidateActiveBookings: CustomerSafeBookingSummary[];
    lastCompletedBooking: CustomerSafeBookingSummary | null;
  };
  serviceCatalog: ServiceCatalogItem[];
  policy: {
    canCancelActiveBooking: boolean;
    cancellationRule: string;
    supportHotline: string;
  };
}

export interface ContextResolverOptions {
  targetBookingId?: string;
  createConversationIfMissing?: boolean;
}

// ============================================================================
// DTO MAPPERS
// ============================================================================

function toDateString(dateVal: any): string {
  if (!dateVal) return "";
  if (dateVal instanceof Date) {
    return dateVal.toISOString().split("T")[0];
  }
  const str = String(dateVal);
  return str.includes("T") ? str.split("T")[0] : str;
}

function toTimeString(timeVal: any): string {
  if (!timeVal) return "";
  if (timeVal instanceof Date) {
    return timeVal.toISOString().split("T")[1]?.slice(0, 5) || "";
  }
  const str = String(timeVal);
  if (str.includes("T")) {
    return str.split("T")[1]?.slice(0, 5) || "";
  }
  return str.slice(0, 5);
}

function toCustomerSafeBookingSummary(
  booking: any,
  baseUrl: string
): CustomerSafeBookingSummary {
  const isPaidOrCompleted =
    booking.paymentStatus === "paid" || booking.status === "completed";
  const receiptUrl = isPaidOrCompleted
    ? `${baseUrl}/api/bookings/${booking.id}/receipt`
    : null;

  const totalAmount =
    booking.totalAmount != null ? Number(booking.totalAmount) : null;

  const serviceName =
    booking.service?.name || booking.primaryService || "Mobile Tire Service";

  const location = booking.formattedAddress || booking.location || "";

  return {
    id: booking.id,
    reference: `#${booking.id.slice(0, 8).toUpperCase()}`,
    serviceName,
    vehicle: booking.vehicle || "Vehicle",
    location,
    status: booking.status,
    bookingDate: toDateString(booking.bookingDate),
    bookingTime: toTimeString(booking.bookingTime),
    paymentStatus: booking.paymentStatus,
    totalAmount,
    receiptUrl,
  };
}

function toCustomerSafeBooking(
  booking: any,
  baseUrl: string
): CustomerSafeBooking {
  const summary = toCustomerSafeBookingSummary(booking, baseUrl);

  // Safe ETA calculation via central dynamic utility
  const etaResult = calculateCustomerEta(booking, booking.technicianLocation);

  // Live tracking URL is only provided when technician is confirmed/assigned or in progress
  const isTrackingActive =
    booking.status === "in_progress" ||
    (booking.status === "confirmed" && Boolean(booking.technicianId));

  const trackingUrl = isTrackingActive
    ? `${baseUrl}/technician/tracking/${booking.id}`
    : null;

  // Strict privacy boundary: NEVER expose technician personal phone
  const technician: CustomerSafeTechnician | null = booking.technician
    ? {
        id: booking.technician.id,
        name: booking.technician.name,
        role: booking.technician.role || "Mobile Tire Technician",
      }
    : null;

  // Parse extra services safely
  let extraServices: CustomerSafeExtraService[] | null = null;
  if (Array.isArray(booking.extraServices)) {
    extraServices = (booking.extraServices as any[]).map((item) => ({
      name: String(item?.name || item?.description || "Extra Service"),
      price: Number(item?.price || item?.amount || 0),
    }));
  }

  return {
    ...summary,
    tireSize: booking.tireSize || null,
    message: booking.message || null,
    formattedAddress: booking.formattedAddress || null,
    technician,
    eta: etaResult,
    trackingUrl,
    extraServices,
  };
}

function getCancellationPolicy(activeBooking: CustomerSafeBooking | null): {
  canCancelActiveBooking: boolean;
  cancellationRule: string;
} {
  if (!activeBooking) {
    return {
      canCancelActiveBooking: false,
      cancellationRule: "No active booking eligible for cancellation.",
    };
  }

  const transition = validateBookingTransition(
    activeBooking.status,
    "cancelled",
    "customer"
  );

  let cancellationRule =
    "Pending requests can be cancelled directly before technician confirmation.";

  if (activeBooking.status === "confirmed") {
    cancellationRule =
      "Confirmed bookings require dispatch assistance to cancel. Please call our support hotline.";
  } else if (activeBooking.status === "in_progress") {
    cancellationRule =
      "Service is currently in progress on-site and cannot be cancelled directly.";
  } else if (activeBooking.status === "completed") {
    cancellationRule = "Completed services cannot be cancelled.";
  } else if (activeBooking.status === "cancelled") {
    cancellationRule = "This booking is already cancelled.";
  }

  return {
    canCancelActiveBooking: transition.allowed,
    cancellationRule,
  };
}

// ============================================================================
// SERVER-SIDE CONTEXT RESOLVER
// ============================================================================

/**
 * Resolves verified WhatsApp sender phone into a unified customer-safe read model.
 * Reuses existing Customer, Booking, Service, Technician, and ETA data without duplication.
 *
 * Guarantees:
 * - Deterministic international phone matching (India, US, UK, Australia, E.164)
 * - Strict IDOR prevention (cannot access other customers' bookings)
 * - Technician privacy (phone omitted, no raw GPS telemetry)
 * - Ambiguous multiple bookings returned as candidates without silent guesswork
 * - Zero automated reply dispatching (pure read model for future chatbot)
 */
export async function resolveWhatsAppCustomerContext(
  senderPhone: string,
  options?: ContextResolverOptions
): Promise<WhatsAppCustomerContext> {
  const normalizedPhone = normalizePhoneNumber(senderPhone);
  const candidates = getPhoneCandidates(senderPhone);
  const maskedPhone = maskPhoneForLogging(normalizedPhone);
  const baseUrl = getValidBaseUrl();

  logger.info("whatsapp.context.resolving", {
    maskedPhone,
    hasTargetBooking: Boolean(options?.targetBookingId),
  });

  // 1. Resolve Customer by candidate phone numbers
  const customer = await prisma.customer.findFirst({
    where: {
      phone: { in: candidates },
    },
    orderBy: { updatedAt: "desc" },
  });

  const isKnown = Boolean(customer);

  // 2. Resolve or retrieve WhatsAppConversation
  let conversation = await prisma.whatsAppConversation.findFirst({
    where: {
      OR: [
        { customerPhone: normalizedPhone },
        { customerPhone: { in: candidates } },
        ...(customer?.id ? [{ customerId: customer.id }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  // 3. Query Active Bookings (pending, confirmed, in_progress)
  const customerBookingWhere = customer?.id
    ? {
        OR: [
          { customerId: customer.id },
          { customer: { phone: { in: candidates } } },
        ],
      }
    : {
        customer: { phone: { in: candidates } },
      };

  const activeBookingsRaw = await prisma.booking.findMany({
    where: {
      ...customerBookingWhere,
      status: { in: ["pending", "confirmed", "in_progress"] },
    },
    include: {
      service: true,
      technician: true,
      technicianLocation: true,
    },
    orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
  });

  // 4. Handle Active Booking Ambiguity & Target Booking IDOR Check
  let activeBooking: CustomerSafeBooking | null = null;
  let candidateActiveBookings: CustomerSafeBookingSummary[] = [];

  if (activeBookingsRaw.length === 1) {
    const singleRaw = activeBookingsRaw[0];

    // If an explicit target was requested, verify it matches the owned booking
    if (options?.targetBookingId) {
      if (options.targetBookingId === singleRaw.id) {
        activeBooking = toCustomerSafeBooking(singleRaw, baseUrl);
      } else {
        // IDOR or non-matching target: do not return unauthorized booking
        logger.warn("whatsapp.context.target_booking_unauthorized", {
          maskedPhone,
          targetBookingId: options.targetBookingId,
        });
        activeBooking = null;
      }
    } else {
      activeBooking = toCustomerSafeBooking(singleRaw, baseUrl);
    }

    candidateActiveBookings = [toCustomerSafeBookingSummary(singleRaw, baseUrl)];
  } else if (activeBookingsRaw.length > 1) {
    candidateActiveBookings = activeBookingsRaw.map((b) =>
      toCustomerSafeBookingSummary(b, baseUrl)
    );

    // If targetBookingId provided and securely matches one of the customer's active bookings
    if (options?.targetBookingId) {
      const matched = activeBookingsRaw.find(
        (b) => b.id === options.targetBookingId
      );
      if (matched) {
        activeBooking = toCustomerSafeBooking(matched, baseUrl);
      } else {
        logger.warn("whatsapp.context.target_booking_not_found_in_active", {
          maskedPhone,
          targetBookingId: options.targetBookingId,
        });
        activeBooking = null;
      }
    } else {
      // Multiple active bookings exist and no explicit target -> NEVER GUESS
      activeBooking = null;
    }
  }

  // 5. Query Total Bookings & Historical Completed Booking if no active booking
  const totalBookingsCount = await prisma.booking.count({
    where: customerBookingWhere,
  });

  const hasBookings = totalBookingsCount > 0;

  let lastCompletedBooking: CustomerSafeBookingSummary | null = null;
  if (activeBookingsRaw.length === 0 && hasBookings) {
    const lastCompletedRaw = await prisma.booking.findFirst({
      where: {
        ...customerBookingWhere,
        status: "completed",
      },
      include: {
        service: true,
      },
      orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
    });

    if (lastCompletedRaw) {
      lastCompletedBooking = toCustomerSafeBookingSummary(
        lastCompletedRaw,
        baseUrl
      );
    }
  }

  // 6. Update or Create Conversation record if requested
  const resolvedActiveBookingId = activeBooking?.id || null;

  if (conversation) {
    const updateData: Record<string, any> = {};
    if (!conversation.customerId && customer?.id) {
      updateData.customerId = customer.id;
    }
    if (conversation.activeBookingId !== resolvedActiveBookingId) {
      updateData.activeBookingId = resolvedActiveBookingId;
    }

    if (Object.keys(updateData).length > 0) {
      try {
        conversation = await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: updateData,
        });
      } catch (convUpdateErr) {
        logger.warn("whatsapp.context.conversation_update_failed", {
          error: convUpdateErr,
        });
      }
    }
  } else if (options?.createConversationIfMissing) {
    try {
      conversation = await prisma.whatsAppConversation.create({
        data: {
          customerPhone: normalizedPhone,
          customerId: customer?.id || null,
          status: "bot_active",
          activeBookingId: resolvedActiveBookingId,
        },
      });
    } catch (convCreateErr) {
      logger.warn("whatsapp.context.conversation_create_failed", {
        error: convCreateErr,
      });
    }
  }

  // 7. Query Active Service Catalog
  const activeServicesRaw = await prisma.service.findMany({
    where: { isActive: true },
    select: {
      name: true,
      slug: true,
      description: true,
      price: true,
    },
    orderBy: { name: "asc" },
  });

  const serviceCatalog: ServiceCatalogItem[] = activeServicesRaw.map((s) => ({
    name: s.name,
    slug: s.slug,
    description: s.description || null,
    price: s.price != null ? Number(s.price) : null,
  }));

  // 8. Determine Cancellation Policy & Hotline
  const { canCancelActiveBooking, cancellationRule } =
    getCancellationPolicy(activeBooking);

  return {
    customer: {
      id: customer?.id || null,
      name: customer?.name || null,
      phone: customer?.phone || normalizedPhone,
      email: customer?.email || null,
      isKnown,
    },
    conversation: {
      id: conversation?.id || null,
      status: conversation?.status || "bot_active",
      activeBookingId: conversation?.activeBookingId || null,
      metadata: (conversation?.metadata as Record<string, any>) || null,
    },
    bookingContext: {
      hasBookings,
      activeBookingsCount: activeBookingsRaw.length,
      activeBooking,
      candidateActiveBookings,
      lastCompletedBooking,
    },
    serviceCatalog,
    policy: {
      canCancelActiveBooking,
      cancellationRule,
      supportHotline: BUSINESS_PHONE_DISPLAY,
    },
  };
}
