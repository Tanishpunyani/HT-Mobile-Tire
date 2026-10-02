import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  WhatsAppCustomerContext,
  CustomerSafeBookingSummary,
  resolveWhatsAppCustomerContext,
} from "./context";
import {
  dispatchWhatsAppDirect,
  maskPhoneForLogging,
  WhatsAppInteractivePayload,
} from "@/lib/notifications/whatsapp";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type CustomerIntent =
  | "greeting"
  | "booking_status"
  | "appointment"
  | "technician"
  | "tracking"
  | "service_info"
  | "cancellation"
  | "reschedule"
  | "payment"
  | "receipt"
  | "human_support"
  | "media_attachment"
  | "unknown";

export interface WhatsAppBotResponse {
  intent: CustomerIntent;
  replyText: string;
  targetBookingId?: string | null;
  shouldHandoff?: boolean;
  suppressResponse?: boolean;
  interactive?: WhatsAppInteractivePayload;
}

export interface SendWhatsAppBotReplyParams {
  conversationId: string;
  customerPhone: string;
  context: WhatsAppCustomerContext;
  inboundText: string | null;
}

// ============================================================================
// TEXT NORMALIZATION & TOKEN UTILITIES
// ============================================================================

/**
 * Normalizes user text for robust deterministic intent matching.
 * Trims, lowercases, removes non-essential punctuation, collapses whitespace.
 */
export function normalizeInboundText(text: string | null | undefined): string {
  if (!text || typeof text !== "string") return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[?!.,;:"'()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if normalized text contains any of the supplied phrases or words (with word boundaries).
 */
function matchesAny(text: string, patterns: Array<string | RegExp>): boolean {
  for (const pattern of patterns) {
    if (typeof pattern === "string") {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      if (regex.test(text)) return true;
    } else if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Detects if the user provided an explicit booking reference token (e.g. #A1B2C3D4 or A1B2C3D4).
 */
export function extractBookingReference(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/#?([0-9a-fA-F]{8})\b/i);
  return match ? match[1].toUpperCase() : null;
}

// ============================================================================
// INTENT DETECTION ENGINE (DETERMINISTIC HIERARCHY)
// ============================================================================

/**
 * Classifies inbound user message into one of 12 supported CustomerIntents.
 * Uses priority ordering to resolve collisions reliably.
 */
export function detectWhatsAppIntent(inboundText: string | null): CustomerIntent {
  // 0. Structured Interactive Intents & Button Aliases
  if (inboundText) {
    const rawTrimmed = inboundText.trim();
    const rawLower = rawTrimmed.toLowerCase();

    // Human Support
    if (
      rawLower === "intent:human_support" ||
      rawLower === "intent:human" ||
      rawLower === "btn_human" ||
      rawLower === "btn_support"
    ) {
      return "human_support";
    }

    // Booking Selection / Status
    if (
      rawLower.startsWith("booking_select:") ||
      rawLower === "intent:booking_status" ||
      rawLower === "intent:status" ||
      rawLower === "btn_status"
    ) {
      return "booking_status";
    }

    // Tracking
    if (
      rawLower === "intent:tracking" ||
      rawLower === "intent:track" ||
      rawLower === "btn_tracking" ||
      rawLower === "btn_track"
    ) {
      return "tracking";
    }

    // Technician
    if (
      rawLower === "intent:technician" ||
      rawLower === "btn_technician"
    ) {
      return "technician";
    }

    // Appointment
    if (
      rawLower === "intent:appointment" ||
      rawLower === "btn_appointment"
    ) {
      return "appointment";
    }

    // Cancellation
    if (
      rawLower === "intent:cancellation" ||
      rawLower === "intent:cancel" ||
      rawLower === "btn_cancel"
    ) {
      return "cancellation";
    }

    // Reschedule
    if (
      rawLower === "intent:reschedule" ||
      rawLower === "btn_reschedule"
    ) {
      return "reschedule";
    }

    // Receipt
    if (
      rawLower === "intent:receipt" ||
      rawLower === "intent:invoice" ||
      rawLower === "btn_receipt" ||
      rawLower === "btn_invoice"
    ) {
      return "receipt";
    }

    // Payment
    if (
      rawLower === "intent:payment" ||
      rawLower === "intent:pay" ||
      rawLower === "btn_payment" ||
      rawLower === "btn_pay"
    ) {
      return "payment";
    }

    // Services
    if (
      rawLower.startsWith("service_select:") ||
      rawLower === "intent:services" ||
      rawLower === "intent:service_info" ||
      rawLower === "btn_services"
    ) {
      return "service_info";
    }

    // Greeting
    if (
      rawLower === "intent:greeting" ||
      rawLower === "btn_greeting" ||
      rawLower === "btn_menu"
    ) {
      return "greeting";
    }
  }

  const text = normalizeInboundText(inboundText);
  if (!text) return "unknown";

  // Priority 1: Human Support / Emergency handoff
  if (
    matchesAny(text, [
      "human",
      "agent",
      "representative",
      "real person",
      "operator",
      "call me",
      "talk to someone",
      "talk to a person",
      "speak to someone",
      "speak to a person",
      "speak with human",
      "customer service",
      "live support",
    ])
  ) {
    return "human_support";
  }

  // Priority 2: Booking reference explicit inquiry (e.g. "#A1B2C3D4 status" or just "#A1B2C3D4")
  if (/^#?[0-9a-fA-F]{8}$/i.test(text.trim())) {
    return "booking_status";
  }

  // Priority 3: Technician & Tracking
  // Specific tracking query
  if (
    matchesAny(text, [
      "track",
      "tracking",
      "tracking link",
      "live tracking",
      "live van",
      "track van",
      "map link",
      "gps link",
    ])
  ) {
    return "tracking";
  }

  // Technician whereabouts / arrival
  if (
    matchesAny(text, [
      "technician",
      "mechanic",
      "driver",
      "where is technician",
      "who is coming",
      "tech on the way",
      "on the way",
      "en route",
      "eta",
      "arrival time",
      "when will you arrive",
      "when will tech arrive",
    ])
  ) {
    return "technician";
  }

  // Priority 4: Cancellation & Rescheduling
  if (
    matchesAny(text, [
      "cancel",
      "cancellation",
      "cancel booking",
      "cancel appointment",
      "drop booking",
    ])
  ) {
    return "cancellation";
  }

  if (
    matchesAny(text, [
      "reschedule",
      "postpone",
      "change time",
      "change date",
      "move appointment",
      "change booking",
    ])
  ) {
    return "reschedule";
  }

  // Priority 5: Billing & Receipts
  if (
    matchesAny(text, [
      "receipt",
      "invoice",
      "send receipt",
      "get receipt",
      "pdf receipt",
      "bill",
    ])
  ) {
    return "receipt";
  }

  if (
    matchesAny(text, [
      "pay",
      "paid",
      "payment",
      "did i pay",
      "how much do i owe",
      "total amount",
      "balance",
      "cost",
      "owe",
    ])
  ) {
    return "payment";
  }

  // Priority 6: Status & Appointment Time
  if (
    matchesAny(text, [
      "appointment",
      "when is my appointment",
      "what time",
      "time window",
      "schedule",
      "when are you coming",
    ])
  ) {
    return "appointment";
  }

  if (
    matchesAny(text, [
      "status",
      "booking status",
      "check booking",
      "my booking",
      "is it confirmed",
      "booking confirmed",
    ])
  ) {
    return "booking_status";
  }

  // Priority 7: Services & Pricing
  if (
    matchesAny(text, [
      "service",
      "services",
      "what services",
      "offer",
      "price",
      "pricing",
      "rates",
      "flat tire",
      "flat repair",
      "tire rotation",
      "new tires",
      "used tires",
      "wheel balance",
      "puncture",
      "tire change",
    ])
  ) {
    return "service_info";
  }

  // Priority 8: Greetings & Help
  if (
    matchesAny(text, [
      "hi",
      "hello",
      "hey",
      "good morning",
      "good afternoon",
      "good evening",
      "howdy",
      "start",
    ])
  ) {
    return "greeting";
  }

  if (
    matchesAny(text, [
      "help",
      "options",
      "menu",
      "commands",
      "what can you do",
      "support",
    ])
  ) {
    return "greeting";
  }

  // Priority 9: Media Attachments (Phase 8.3)
  if (
    inboundText &&
    (/^\[(Photo Attached|Voice Note Attached|Document:.*|Document Attached|Video Attached|Sticker Attached|Location Shared)\]$/i.test(
      inboundText.trim()
    ) ||
      matchesAny(text, [
        "photo attached",
        "voice note attached",
        "document attached",
        "video attached",
        "sticker attached",
        "location shared",
      ]) ||
      /^document\b/i.test(text))
  ) {
    return "media_attachment";
  }

  // Fallback
  return "unknown";
}

// ============================================================================
// RESPONSE BUILDERS (CUSTOMER-SAFE MARKDOWN)
// ============================================================================

function formatStatus(status: string): string {
  switch (status.toLowerCase()) {
    case "pending":
      return "Pending Confirmation";
    case "confirmed":
      return "Confirmed";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function formatPaymentStatus(paymentStatus: string): string {
  switch (paymentStatus.toLowerCase()) {
    case "paid":
      return "Paid in Full";
    case "quote_sent":
      return "Quote / Invoice Sent";
    case "pending":
      return "Pending";
    default:
      return paymentStatus;
  }
}

function formatIsoTime(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  } catch {
    return "";
  }
}

function buildDisambiguationPrompt(
  candidates: CustomerSafeBookingSummary[]
): string {
  const items = candidates
    .map((c, i) => {
      return `${i + 1}. *${c.reference}* — ${c.serviceName} (${c.vehicle})\n   Scheduled: *${c.bookingDate}* at *${c.bookingTime}*`;
    })
    .join("\n\n");

  return `You currently have *${candidates.length} active bookings*:\n\n${items}\n\nPlease reply with your booking reference (e.g. *${candidates[0].reference}*) so I can assist you with the right appointment.`;
}

function buildDisambiguationListPayload(
  candidates: CustomerSafeBookingSummary[]
): WhatsAppInteractivePayload | undefined {
  if (!candidates || candidates.length < 2 || candidates.length > 10) {
    return undefined;
  }

  return {
    type: "list",
    buttonText: "Select Booking",
    bodyText: "Please select which booking you would like to view:",
    sections: [
      {
        title: "Active Bookings",
        rows: candidates.slice(0, 10).map((c) => ({
          id: `booking_select:${c.reference.replace(/#/g, "") || c.id}`.slice(0, 200),
          title: (c.vehicle || "Vehicle").slice(0, 24),
          description: `${c.serviceName} • ${c.bookingDate}`.slice(0, 72),
        })),
      },
    ],
  };
}

function buildServiceListPayload(
  services: Array<{ name: string; slug?: string; id?: string; price?: number | null; description?: string | null }>
): WhatsAppInteractivePayload | undefined {
  if (!services || services.length === 0 || services.length > 10) {
    return undefined;
  }

  return {
    type: "list",
    buttonText: "View Services",
    bodyText: "Select a service below for detailed pricing and availability:",
    sections: [
      {
        title: "Our Services",
        rows: services.slice(0, 10).map((s) => {
          const serviceId = s.slug || s.id || s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const pricePart = s.price != null ? `From $${Number(s.price).toFixed(2)} • ` : "";
          const descPart = s.description ? s.description.slice(0, 50) : "Mobile tire service";
          return {
            id: `service_select:${serviceId}`.slice(0, 200),
            title: s.name.slice(0, 24),
            description: `${pricePart}${descPart}`.slice(0, 72),
          };
        }),
      },
    ],
  };
}

// ============================================================================
// MAIN DETERMINISTIC ROUTER
// ============================================================================

/**
 * Routes incoming message against customer context and produces customer-safe response.
 */
export function routeWhatsAppIntent(
  context: WhatsAppCustomerContext,
  inboundMessageText: string | null
): WhatsAppBotResponse {
  const normalizedText = normalizeInboundText(inboundMessageText);

  // 0. Closed Conversation Reopening
  // When an inbound message arrives for a closed conversation, automatically reopen to bot_active
  const wasClosed = context.conversation.status === "closed";
  if (wasClosed) {
    context.conversation.status = "bot_active";
  }

  // 1. Human Handoff Check
  // If conversation is marked for human handoff and user did NOT ask to return to bot:
  if (context.conversation.status === "human_handoff") {
    if (
      normalizedText === "bot" ||
      normalizedText === "restart" ||
      normalizedText === "restart bot"
    ) {
      return {
        intent: "greeting",
        replyText:
          "Welcome back! I am HT Mobile Tyres bot assistant. How can I help you today?",
        shouldHandoff: false,
        suppressResponse: false,
      };
    }
    // Suppress bot reply to allow human agent to converse
    return {
      intent: "human_support",
      replyText: "",
      suppressResponse: true,
    };
  }

  // 2. Disambiguation Input Matching
  // If customer has candidate active bookings, check if this message references one
  const candidates = context.bookingContext.candidateActiveBookings;
  let targetBookingId: string | null = null;

  // Check structured list ID: booking_select:<ref-or-id>
  const bookingSelectMatch = inboundMessageText?.trim().match(/^booking_select:(.+)$/i);
  if (bookingSelectMatch) {
    const selectedToken = bookingSelectMatch[1].trim().toUpperCase();
    const candidateList =
      candidates && candidates.length > 0
        ? candidates
        : context.bookingContext.activeBooking
        ? [context.bookingContext.activeBooking]
        : [];
    const matched = candidateList.find(
      (c) =>
        c.reference.replace(/#/g, "").toUpperCase() === selectedToken ||
        c.id.toUpperCase() === selectedToken ||
        c.id.replace(/-/g, "").toUpperCase().startsWith(selectedToken)
    );
    if (matched) {
      targetBookingId = matched.id;
    }
  } else if (candidates && candidates.length > 1) {
    const refToken = extractBookingReference(inboundMessageText);
    if (refToken) {
      const matched = candidates.find(
        (c) =>
          c.reference.replace(/#/g, "").toUpperCase() === refToken ||
          c.id.replace(/-/g, "").toUpperCase().startsWith(refToken)
      );
      if (matched) {
        targetBookingId = matched.id;
      }
    } else {
      // Check if user replied with index (1, 2, 3...)
      const numMatch = normalizedText.match(/^([1-9])$/);
      if (numMatch) {
        const idx = parseInt(numMatch[1], 10) - 1;
        if (candidates[idx]) {
          targetBookingId = candidates[idx].id;
        }
      } else {
        // Check if user mentioned vehicle name uniquely
        const matchedByVehicle = candidates.filter(
          (c) =>
            normalizedText.includes(c.vehicle.toLowerCase()) ||
            (normalizedText.length >= 3 && c.vehicle.toLowerCase().includes(normalizedText))
        );
        if (matchedByVehicle.length === 1) {
          targetBookingId = matchedByVehicle[0].id;
        }
      }
    }
  }

  // 3. Detect Intent
  const intent = detectWhatsAppIntent(inboundMessageText);

  // 4. Build Intent Response
  switch (intent) {
    case "human_support": {
      return {
        intent,
        replyText: `I am connecting you with our customer support team.\n\n📞 *Support Hotline:* ${context.policy.supportHotline}\n🕒 *Hours:* 7 Days a week (24/7 Roadside Assistance)\n\nA team representative will review your message shortly.`,
        shouldHandoff: true,
      };
    }

    case "greeting": {
      const greetingName =
        context.customer.isKnown && context.customer.name
          ? `Hi ${context.customer.name.split(" ")[0]}! `
          : "Hello! ";

      const text = `${greetingName}Welcome to *HT Mobile Tyres* — On-Demand Mobile Tire Service.\n\nI can help you with:\n• *Booking Status* — Check active appointments\n• *Appointment Details* — Date, time window & vehicle\n• *Technician ETA & Tracking* — Live van arrival time & link\n• *Services & Pricing* — Flat repairs, rotations & new tires\n• *Payment & Receipts* — Check balance or download invoices\n• *Cancellation & Reschedule* — Policy guidance\n• *Support* — Speak with a representative\n\nHow can I help you today?`;

      return {
        intent,
        replyText: text,
        interactive: {
          type: "button",
          bodyText: text.slice(0, 1024),
          buttons: [
            { id: "intent:booking_status", title: "Booking Status" },
            { id: "intent:services", title: "Our Services" },
            { id: "intent:human_support", title: "Speak to Staff" },
          ],
        },
      };
    }

    case "booking_status": {
      if (!context.bookingContext.hasBookings) {
        const text = `You do not have any active or past bookings with HT Mobile Tyres.\n\nTo schedule on-demand mobile tire service:\n👉 https://mobiletire.clinic/booking`;
        return {
          intent,
          replyText: text,
          interactive: {
            type: "button",
            bodyText: text.slice(0, 1024),
            buttons: [
              { id: "intent:services", title: "Our Services" },
              { id: "intent:human_support", title: "Support" },
            ],
          },
        };
      }

      if (context.bookingContext.activeBookingsCount === 0) {
        const last = context.bookingContext.lastCompletedBooking;
        if (last) {
          const text = `You don't have any active bookings right now.\n\n*Previous Service:*\n• Reference: *${last.reference}*\n• Service: *${last.serviceName}*\n• Vehicle: *${last.vehicle}*\n• Date: *${last.bookingDate}*\n• Status: *Completed*\n\nNeed to book a new appointment?\n👉 https://mobiletire.clinic/booking`;
          return {
            intent,
            replyText: text,
            interactive: {
              type: "button",
              bodyText: text.slice(0, 1024),
              buttons: [
                { id: "intent:services", title: "Our Services" },
                { id: "intent:human_support", title: "Support" },
              ],
            },
          };
        }
        const text = `You do not have any active bookings right now.\n\nBook a new service online:\n👉 https://mobiletire.clinic/booking`;
        return {
          intent,
          replyText: text,
          interactive: {
            type: "button",
            bodyText: text.slice(0, 1024),
            buttons: [
              { id: "intent:services", title: "Our Services" },
              { id: "intent:human_support", title: "Support" },
            ],
          },
        };
      }

      if (context.bookingContext.activeBookingsCount > 1 && !targetBookingId) {
        const interactive = buildDisambiguationListPayload(candidates);
        return {
          intent,
          replyText: buildDisambiguationPrompt(candidates),
          targetBookingId: null,
          ...(interactive ? { interactive } : {}),
        };
      }

      const b = context.bookingContext.activeBooking;
      if (!b) {
        const interactive = buildDisambiguationListPayload(candidates);
        return {
          intent,
          replyText: buildDisambiguationPrompt(candidates),
          targetBookingId,
          ...(interactive ? { interactive } : {}),
        };
      }

      const trackingLine = b.trackingUrl
        ? `\n\nLive van tracking:\n👉 ${b.trackingUrl}`
        : "";

      const text = `*Booking Status: ${formatStatus(b.status)}*\n\n• Reference: *${b.reference}*\n• Service: *${b.serviceName}*\n• Vehicle: *${b.vehicle}*\n• Scheduled: *${b.bookingDate}* at *${b.bookingTime}*\n• Location: *${b.location}*\n• Payment: *${formatPaymentStatus(b.paymentStatus)}*${trackingLine}`;

      const buttons = b.trackingUrl
        ? [
            { id: "intent:tracking", title: "Track Van" },
            { id: "intent:services", title: "Our Services" },
            { id: "intent:human_support", title: "Support" },
          ]
        : [
            { id: "intent:services", title: "Our Services" },
            { id: "intent:human_support", title: "Support" },
          ];

      return {
        intent,
        replyText: text,
        targetBookingId,
        interactive: {
          type: "button",
          bodyText: text.slice(0, 1024),
          buttons,
        },
      };
    }

    case "appointment": {
      if (context.bookingContext.activeBookingsCount === 0) {
        const text = `You do not have any upcoming appointments scheduled.\n\nBook an on-demand mobile appointment:\n👉 https://mobiletire.clinic/booking`;
        return {
          intent,
          replyText: text,
          interactive: {
            type: "button",
            bodyText: text.slice(0, 1024),
            buttons: [
              { id: "intent:services", title: "Our Services" },
              { id: "intent:human_support", title: "Support" },
            ],
          },
        };
      }

      if (context.bookingContext.activeBookingsCount > 1 && !targetBookingId) {
        const interactive = buildDisambiguationListPayload(candidates);
        return {
          intent,
          replyText: buildDisambiguationPrompt(candidates),
          ...(interactive ? { interactive } : {}),
        };
      }

      const b = context.bookingContext.activeBooking;
      if (!b) {
        const interactive = buildDisambiguationListPayload(candidates);
        return {
          intent,
          replyText: buildDisambiguationPrompt(candidates),
          targetBookingId,
          ...(interactive ? { interactive } : {}),
        };
      }

      const text = `*Your Appointment Details:*\n\n• Reference: *${b.reference}*\n• Service: *${b.serviceName}*\n• Vehicle: *${b.vehicle}*\n• Date: *${b.bookingDate}*\n• Arrival Window: *${b.bookingTime}*\n• Service Location: *${b.location}*\n\nOur mobile service van will arrive during your scheduled window.`;

      return {
        intent,
        replyText: text,
        targetBookingId,
        interactive: {
          type: "button",
          bodyText: text.slice(0, 1024),
          buttons: [
            { id: "intent:booking_status", title: "Check Status" },
            { id: "intent:services", title: "Our Services" },
            { id: "intent:human_support", title: "Support" },
          ],
        },
      };
    }

    case "technician": {
      if (context.bookingContext.activeBookingsCount === 0) {
        return {
          intent,
          replyText: `You do not have an active booking with an assigned technician.\n\nTo schedule service:\n👉 https://mobiletire.clinic/booking`,
        };
      }

      if (context.bookingContext.activeBookingsCount > 1 && !targetBookingId) {
        const interactive = buildDisambiguationListPayload(candidates);
        return {
          intent,
          replyText: buildDisambiguationPrompt(candidates),
          ...(interactive ? { interactive } : {}),
        };
      }

      const b = context.bookingContext.activeBooking;
      if (!b) {
        const interactive = buildDisambiguationListPayload(candidates);
        return {
          intent,
          replyText: buildDisambiguationPrompt(candidates),
          targetBookingId,
          ...(interactive ? { interactive } : {}),
        };
      }

      const techName = b.technician?.name || "Our technician";

      switch (b.eta.arrivalStatus) {
        case "arrived": {
          const text = `*Technician On-Site!*\n\nYour technician, *${techName}*, has arrived on-site and is preparing equipment for your *${b.vehicle}*.`;
          return {
            intent,
            replyText: text,
            targetBookingId,
            interactive: {
              type: "button",
              bodyText: text.slice(0, 1024),
              buttons: [
                { id: "intent:booking_status", title: "Check Status" },
                { id: "intent:human_support", title: "Support" },
              ],
            },
          };
        }

        case "in_progress": {
          const text = `*Service In Progress!*\n\nYour technician, *${techName}*, is currently working on your vehicle (*${b.vehicle}*).`;
          return {
            intent,
            replyText: text,
            targetBookingId,
            interactive: {
              type: "button",
              bodyText: text.slice(0, 1024),
              buttons: [
                { id: "intent:booking_status", title: "Check Status" },
                { id: "intent:human_support", title: "Support" },
              ],
            },
          };
        }

        case "estimated": {
          const etaMin = b.eta.etaMinutes;
          const dist = b.eta.distanceMiles;
          const timeEst = formatIsoTime(b.eta.estimatedArrivalAt);
          const timeLine = timeEst ? ` (approx *${timeEst}*)` : "";
          const distLine = dist != null ? `\n• Distance: *${dist} miles*` : "";
          const trackLine = b.trackingUrl
            ? `\n\nLive van tracking:\n👉 ${b.trackingUrl}`
            : "";

          const text = `*Technician En Route!*\n\nYour technician, *${techName}*, is on the way!\n• Estimated Arrival: *~${etaMin} minutes*${timeLine}${distLine}${trackLine}`;

          return {
            intent,
            replyText: text,
            targetBookingId,
            interactive: {
              type: "button",
              bodyText: text.slice(0, 1024),
              buttons: [
                { id: "intent:tracking", title: "Live Tracking" },
                { id: "intent:human_support", title: "Support" },
              ],
            },
          };
        }

        case "updating": {
          const trackLine = b.trackingUrl
            ? `\n\nLive tracking link:\n👉 ${b.trackingUrl}`
            : "";
          const text = `*Technician Dispatched!*\n\nYour technician, *${techName}*, has been dispatched. Live GPS signal is currently updating—please check back in a few moments.${trackLine}`;
          return {
            intent,
            replyText: text,
            targetBookingId,
            interactive: {
              type: "button",
              bodyText: text.slice(0, 1024),
              buttons: [
                { id: "intent:tracking", title: "Live Tracking" },
                { id: "intent:human_support", title: "Support" },
              ],
            },
          };
        }

        case "unavailable":
        default: {
          const text = `Your appointment (*${b.reference}*) is confirmed for *${b.bookingDate}* at *${b.bookingTime}*.\n\nA technician will be assigned prior to your arrival window. You will receive an alert as soon as they depart for your location.`;
          return {
            intent,
            replyText: text,
            targetBookingId,
            interactive: {
              type: "button",
              bodyText: text.slice(0, 1024),
              buttons: [
                { id: "intent:booking_status", title: "Check Status" },
                { id: "intent:human_support", title: "Support" },
              ],
            },
          };
        }
      }
    }

    case "tracking": {
      if (context.bookingContext.activeBookingsCount === 0) {
        return {
          intent,
          replyText: `Live tracking is available for active service appointments. You do not currently have an active booking.\n\nBook service:\n👉 https://mobiletire.clinic/booking`,
        };
      }

      if (context.bookingContext.activeBookingsCount > 1 && !targetBookingId) {
        const interactive = buildDisambiguationListPayload(candidates);
        return {
          intent,
          replyText: buildDisambiguationPrompt(candidates),
          ...(interactive ? { interactive } : {}),
        };
      }

      const b = context.bookingContext.activeBooking;
      if (!b) {
        const interactive = buildDisambiguationListPayload(candidates);
        return {
          intent,
          replyText: buildDisambiguationPrompt(candidates),
          targetBookingId,
          ...(interactive ? { interactive } : {}),
        };
      }

      if (b.trackingUrl) {
        const text = `Here is the live van tracking link for booking *${b.reference}*:\n👉 ${b.trackingUrl}\n\nYou can follow your technician's progress in real-time.`;
        return {
          intent,
          replyText: text,
          targetBookingId,
          interactive: {
            type: "button",
            bodyText: text.slice(0, 1024),
            buttons: [
              { id: "intent:technician", title: "Check ETA" },
              { id: "intent:human_support", title: "Support" },
            ],
          },
        };
      }

      const text = `Live tracking is activated once a technician is dispatched and en route to your location.\n\nYour booking (*${b.reference}*) is scheduled for *${b.bookingDate}* at *${b.bookingTime}*.`;
      return {
        intent,
        replyText: text,
        targetBookingId,
        interactive: {
          type: "button",
          bodyText: text.slice(0, 1024),
          buttons: [
            { id: "intent:booking_status", title: "Check Status" },
            { id: "intent:human_support", title: "Support" },
          ],
        },
      };
    }

    case "service_info": {
      const rawText = inboundMessageText?.trim() || "";
      const isServiceSelect = /^service_select:(.+)$/i.test(rawText);

      if (isServiceSelect) {
        const serviceToken = rawText.replace(/^service_select:/i, "").trim().toLowerCase();
        const catalog = context.serviceCatalog || [];
        const matchedService = catalog.find((s) => {
          const sSlug = (s.slug || "").toLowerCase();
          const sId = ((s as any).id || "").toLowerCase();
          const sNameSlug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          return (
            sSlug === serviceToken ||
            sId === serviceToken ||
            sNameSlug === serviceToken ||
            sNameSlug.includes(serviceToken) ||
            serviceToken.includes(sNameSlug)
          );
        });

        if (matchedService) {
          const pricePart = matchedService.price != null ? `\n• Price: *from $${Number(matchedService.price).toFixed(2)}*` : "";
          const descPart = matchedService.description ? `\n• Description: ${matchedService.description}` : "";
          const text = `*${matchedService.name}*${pricePart}${descPart}\n\nOur fully equipped mobile tyre vans come directly to your home, office, or roadside!\n\nBook this service online:\n👉 https://mobiletire.clinic/booking`;

          return {
            intent,
            replyText: text,
            interactive: {
              type: "button",
              bodyText: text.slice(0, 1024),
              buttons: [
                { id: "intent:services", title: "All Services" },
                { id: "intent:human_support", title: "Speak to Staff" },
              ],
            },
          };
        } else {
          // Unknown service ID -> safe fallback
          const serviceListPayload = buildServiceListPayload(catalog);
          const fallbackText = `We could not find the selected service. Here is our full list of mobile tire services:\n\nBook online:\n👉 https://mobiletire.clinic/services`;
          return {
            intent,
            replyText: fallbackText,
            ...(serviceListPayload ? { interactive: serviceListPayload } : {}),
          };
        }
      }

      if (!context.serviceCatalog || context.serviceCatalog.length === 0) {
        return {
          intent,
          replyText: `*HT Mobile Tyres Services:*\n\n• Flat Tire Repair & Puncture Patching\n• Mobile Tire Rotation & Laser Balancing\n• New & Used Tire Delivery & Installation\n• 24/7 Emergency Roadside Assistance\n\nBook online:\n👉 https://mobiletire.clinic/services`,
        };
      }

      const serviceItems = context.serviceCatalog
        .map((s) => {
          const priceStr =
            s.price != null ? ` — from $${Number(s.price).toFixed(2)}` : "";
          const desc = s.description
            ? `\n  ${s.description}`
            : "\n  Professional mobile tire service at your location.";
          return `• *${s.name}*${priceStr}${desc}`;
        })
        .join("\n");

      const text = `*HT Mobile Tyres — Services & Pricing:*\n\n${serviceItems}\n\nOur fully equipped vans come to your home, workplace, or roadside!\n\nBook appointment:\n👉 https://mobiletire.clinic/services`;
      const serviceListPayload = buildServiceListPayload(context.serviceCatalog);

      return {
        intent,
        replyText: text,
        ...(serviceListPayload ? { interactive: serviceListPayload } : {}),
      };
    }

    case "cancellation": {
      if (context.bookingContext.activeBookingsCount === 0) {
        const text = `You do not have any active bookings eligible for cancellation.\n\nIf you have questions about a past service, please call *${context.policy.supportHotline}*.`;
        return {
          intent,
          replyText: text,
          interactive: {
            type: "button",
            bodyText: text.slice(0, 1024),
            buttons: [
              { id: "intent:human_support", title: "Speak to Staff" },
              { id: "intent:services", title: "Our Services" },
            ],
          },
        };
      }

      if (context.bookingContext.activeBookingsCount > 1 && !targetBookingId) {
        const interactive = buildDisambiguationListPayload(candidates);
        return {
          intent,
          replyText: buildDisambiguationPrompt(candidates),
          ...(interactive ? { interactive } : {}),
        };
      }

      const b = context.bookingContext.activeBooking;
      if (!b) {
        const interactive = buildDisambiguationListPayload(candidates);
        return {
          intent,
          replyText: buildDisambiguationPrompt(candidates),
          targetBookingId,
          ...(interactive ? { interactive } : {}),
        };
      }

      if (b.status === "pending") {
        const text = `Your booking (*${b.reference}*) is currently *Pending Confirmation* and can be cancelled.\n\nTo cancel your request, please manage it in your account:\n👉 https://mobiletire.clinic/account\nOr call dispatch at *${context.policy.supportHotline}*.`;
        return {
          intent,
          replyText: text,
          targetBookingId,
          interactive: {
            type: "button",
            bodyText: text.slice(0, 1024),
            buttons: [
              { id: "intent:human_support", title: "Speak to Staff" },
              { id: "intent:booking_status", title: "Check Status" },
            ],
          },
        };
      }

      if (b.status === "confirmed") {
        const text = `Your booking (*${b.reference}*) is *Confirmed* and a mobile service van has been reserved for your appointment.\n\nCancellations require dispatch assistance: please call *${context.policy.supportHotline}* so we can assist you.`;
        return {
          intent,
          replyText: text,
          targetBookingId,
          interactive: {
            type: "button",
            bodyText: text.slice(0, 1024),
            buttons: [
              { id: "intent:human_support", title: "Speak to Staff" },
              { id: "intent:booking_status", title: "Check Status" },
            ],
          },
        };
      }

      const text = `Your booking (*${b.reference}*) is currently *${formatStatus(b.status)}* and cannot be cancelled directly.\n\nFor assistance, please contact dispatch at *${context.policy.supportHotline}*.`;
      return {
        intent,
        replyText: text,
        targetBookingId,
        interactive: {
          type: "button",
          bodyText: text.slice(0, 1024),
          buttons: [
            { id: "intent:human_support", title: "Speak to Staff" },
            { id: "intent:booking_status", title: "Check Status" },
          ],
        },
      };
    }

    case "reschedule": {
      const b = context.bookingContext.activeBooking;
      const refStr = b ? ` (*${b.reference}*)` : "";
      const text = `To reschedule your appointment${refStr}, please call our dispatch team at *${context.policy.supportHotline}* so we can check real-time availability, or manage your booking online:\n👉 https://mobiletire.clinic/account`;

      return {
        intent,
        replyText: text,
        targetBookingId,
        interactive: {
          type: "button",
          bodyText: text.slice(0, 1024),
          buttons: [
            { id: "intent:human_support", title: "Speak to Staff" },
            { id: "intent:booking_status", title: "Check Status" },
          ],
        },
      };
    }

    case "payment": {
      if (context.bookingContext.activeBookingsCount === 0) {
        const last = context.bookingContext.lastCompletedBooking;
        if (last) {
          const amtStr =
            last.totalAmount != null ? `$${last.totalAmount.toFixed(2)}` : "";
          const text = `You have no active balances.\n\nYour previous service (*${last.reference}*) was *${formatPaymentStatus(last.paymentStatus)}* ${amtStr}.\n\nView past receipts: https://mobiletire.clinic/account`;
          return {
            intent,
            replyText: text,
            interactive: {
              type: "button",
              bodyText: text.slice(0, 1024),
              buttons: [
                { id: "intent:services", title: "Our Services" },
                { id: "intent:human_support", title: "Support" },
              ],
            },
          };
        }
        const text = `You have no open balances or active invoices with HT Mobile Tyres.`;
        return {
          intent,
          replyText: text,
          interactive: {
            type: "button",
            bodyText: text.slice(0, 1024),
            buttons: [
              { id: "intent:services", title: "Our Services" },
              { id: "intent:human_support", title: "Support" },
            ],
          },
        };
      }

      if (context.bookingContext.activeBookingsCount > 1 && !targetBookingId) {
        const interactive = buildDisambiguationListPayload(candidates);
        return {
          intent,
          replyText: buildDisambiguationPrompt(candidates),
          ...(interactive ? { interactive } : {}),
        };
      }

      const b = context.bookingContext.activeBooking;
      if (!b) {
        const interactive = buildDisambiguationListPayload(candidates);
        return {
          intent,
          replyText: buildDisambiguationPrompt(candidates),
          targetBookingId,
          ...(interactive ? { interactive } : {}),
        };
      }

      const amt =
        b.totalAmount != null ? `$${b.totalAmount.toFixed(2)}` : null;

      if (b.paymentStatus === "paid") {
        const text = `*Payment Status: Paid in Full*\n\n• Booking: *${b.reference}*\n• Amount Paid: *${amt || "Paid"}*\n• Status: *Paid in Full*\n\nThank you for choosing HT Mobile Tyres!`;
        return {
          intent,
          replyText: text,
          targetBookingId,
          interactive: {
            type: "button",
            bodyText: text.slice(0, 1024),
            buttons: [
              { id: "intent:booking_status", title: "Check Status" },
              { id: "intent:receipt", title: "Get Receipt" },
              { id: "intent:human_support", title: "Support" },
            ],
          },
        };
      }

      if (b.paymentStatus === "quote_sent") {
        const text = `*Payment Status: Invoice Ready*\n\n• Booking: *${b.reference}*\n• Total Amount Due: *${amt || "$0.00"}*\n\nYou can review your quote and pay online:\n👉 https://mobiletire.clinic/account`;
        return {
          intent,
          replyText: text,
          targetBookingId,
          interactive: {
            type: "button",
            bodyText: text.slice(0, 1024),
            buttons: [
              { id: "intent:booking_status", title: "Check Status" },
              { id: "intent:human_support", title: "Support" },
            ],
          },
        };
      }

      const text = `*Payment Status: Pending*\n\n• Booking: *${b.reference}*\n• Payment will be finalized and collected upon technician completion on-site.`;
      return {
        intent,
        replyText: text,
        targetBookingId,
        interactive: {
          type: "button",
          bodyText: text.slice(0, 1024),
          buttons: [
            { id: "intent:booking_status", title: "Check Status" },
            { id: "intent:human_support", title: "Support" },
          ],
        },
      };
    }

    case "receipt": {
      const b = context.bookingContext.activeBooking;
      const last = context.bookingContext.lastCompletedBooking;

      const targetReceipt = b?.receiptUrl ? b : last?.receiptUrl ? last : null;

      if (targetReceipt && targetReceipt.receiptUrl) {
        const text = `Here is the link to view/download your official service receipt for booking *${targetReceipt.reference}*:\n👉 ${targetReceipt.receiptUrl}\n\nNote: You can also access all receipts anytime in your account at https://mobiletire.clinic/account.`;
        return {
          intent,
          replyText: text,
          targetBookingId,
          interactive: {
            type: "button",
            bodyText: text.slice(0, 1024),
            buttons: [
              { id: "intent:booking_status", title: "Check Status" },
              { id: "intent:services", title: "Our Services" },
            ],
          },
        };
      }

      const text = `Official receipts are generated upon service completion. You do not currently have any completed bookings with receipts available.\n\nManage account & invoices: https://mobiletire.clinic/account`;
      return {
        intent,
        replyText: text,
        targetBookingId,
        interactive: {
          type: "button",
          bodyText: text.slice(0, 1024),
          buttons: [
            { id: "intent:booking_status", title: "Check Status" },
            { id: "intent:services", title: "Our Services" },
          ],
        },
      };
    }

    case "media_attachment": {
      const rawText = inboundMessageText?.trim() || "";
      const lower = rawText.toLowerCase();

      let replyText =
        "Thank you! We have received your attachment. A member of our team will review it. Reply with *Status* to check your booking, or *Human* to speak with our staff.";

      if (lower.startsWith("[photo attached]") || lower.includes("photo attached")) {
        replyText =
          "Thank you for sharing the photo! Our team has received your image. If this is related to tire damage or an upcoming appointment, a technician or dispatch agent will review it. You can also reply with *Status* to check your booking or *Human* to chat with our staff.";
      } else if (lower.startsWith("[voice note attached]") || lower.includes("voice note attached")) {
        replyText =
          `Thank you for your voice note! We have received your audio message. If you need immediate assistance with an active booking, please text *Status* or reply *Human* to speak directly with our team, or call our hotline at *${context.policy.supportHotline}*.`;
      } else if (lower.startsWith("[document:") || lower.startsWith("[document attached]") || lower.includes("document")) {
        const docMatch = rawText.match(/\[Document:\s*([^\]]+)\]/i);
        const filename = docMatch ? docMatch[1].trim() : null;
        if (filename) {
          replyText =
            `We received your document (*${filename}*). Our staff will review your file. To check your booking status or request service details, reply with *Status* or *Services*.`;
        } else {
          replyText =
            "We received your document attachment. Our staff will review your file. To check your booking status or request service details, reply with *Status* or *Services*.";
        }
      } else if (lower.startsWith("[video attached]") || lower.includes("video attached")) {
        replyText =
          "Thank you for sharing the video! Our team has received your video clip and will review it with your service details. Reply with *Status* to view your active appointment, or *Human* to speak with our dispatch team.";
      } else if (lower.startsWith("[sticker attached]") || lower.includes("sticker attached")) {
        replyText =
          "Thanks for the sticker! 😊 How can we assist you with your vehicle today? Reply with *Status* to check your booking, or *Services* to view available mobile tire services.";
      } else if (lower.startsWith("[location shared]") || lower.includes("location shared")) {
        replyText =
          `Thank you for sharing your location! We have noted your coordinates. If you are updating the service location for an active booking, our dispatch team will update your mobile van route. Reply with *Status* or call *${context.policy.supportHotline}* for real-time updates.`;
      }

      return {
        intent,
        replyText,
        targetBookingId,
        interactive: {
          type: "button",
          bodyText: replyText.slice(0, 1024),
          buttons: [
            { id: "intent:booking_status", title: "Check Status" },
            { id: "intent:human_support", title: "Speak to Staff" },
          ],
        },
      };
    }

    case "unknown":
    default: {
      const text = `I didn't quite catch that. Here are some things I can help you with:\n\n• *Status* — Check your booking status\n• *Appointment* — View appointment date & time\n• *Technician* — Check technician arrival ETA\n• *Tracking* — Get live van tracking link\n• *Services* — See available services & pricing\n• *Cancel* / *Reschedule* — Appointment guidance\n• *Receipt* — Download your service invoice\n• *Human* — Connect with a customer support representative\n\nHow can I assist you?`;
      return {
        intent: "unknown",
        replyText: text,
        targetBookingId: targetBookingId || null,
        interactive: {
          type: "button",
          bodyText: text.slice(0, 1024),
          buttons: [
            { id: "intent:booking_status", title: "Booking Status" },
            { id: "intent:services", title: "Our Services" },
            { id: "intent:human_support", title: "Speak to Staff" },
          ],
        },
      };
    }
  }
}

// ============================================================================
// OUTBOUND BOT RESPONSE DISPATCHER & PERSISTENCE
// ============================================================================

/**
 * High-level orchestration for Phase 3:
 * 1. Executes intent routing against customer context
 * 2. Re-resolves context if user disambiguated a specific booking reference
 * 3. Checks human handoff state
 * 4. Dispatches reply using existing WhatsApp provider
 * 5. Persists outbound WhatsAppMessage
 * 6. Updates conversation timestamp & status
 */
export async function sendWhatsAppBotReply({
  conversationId,
  customerPhone,
  context,
  inboundText,
}: SendWhatsAppBotReplyParams): Promise<WhatsAppBotResponse | null> {
  const maskedPhone = maskPhoneForLogging(customerPhone);
  const wasClosed = context.conversation.status === "closed";

  // 1. Initial Routing
  let botResponse = routeWhatsAppIntent(context, inboundText);

  // 2. Disambiguation Re-Resolution
  // If the user's message referenced one of the candidate bookings, re-resolve context
  let validatedTargetBookingId: string | null = null;
  if (
    botResponse.targetBookingId &&
    !context.bookingContext.activeBooking
  ) {
    try {
      const targetedContext = await resolveWhatsAppCustomerContext(customerPhone, {
        targetBookingId: botResponse.targetBookingId,
      });
      if (targetedContext.bookingContext.activeBooking?.id === botResponse.targetBookingId) {
        context = targetedContext;
        validatedTargetBookingId = botResponse.targetBookingId;
      }
      botResponse = routeWhatsAppIntent(targetedContext, inboundText);
    } catch (err) {
      logger.warn("whatsapp.router.target_reresolve_failed", {
        maskedPhone,
        targetBookingId: botResponse.targetBookingId,
        error: err,
      });
    }
  }

  // 3. Human Handoff Suppression
  if (botResponse.suppressResponse) {
    logger.info("whatsapp.router.suppressed_for_handoff", {
      conversationId,
      maskedPhone,
    });
    return botResponse;
  }

  // 4. Outbound Dispatch via Existing Provider
  if (botResponse.replyText) {
    try {
      const dispatchResult = await dispatchWhatsAppDirect({
        to: customerPhone,
        body: botResponse.replyText,
        type: "customer_message",
        entityId: context.bookingContext.activeBooking?.id,
        entityType: "booking",
        ...(botResponse.interactive ? { interactive: botResponse.interactive } : {}),
      });

      const outboundWamid =
        dispatchResult.messageId ||
        `wamid.outbound.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

      // 5. Persist Outbound WhatsAppMessage
      await prisma.whatsAppMessage.create({
        data: {
          conversationId,
          wamid: outboundWamid,
          direction: "outbound",
          type: botResponse.interactive ? "interactive" : "text",
          body: botResponse.replyText,
          rawPayload: {
            intent: botResponse.intent,
            targetBookingId: botResponse.targetBookingId || null,
            source: "deterministic_router",
            simulated: dispatchResult.simulated || false,
            ...(botResponse.interactive ? { interactive: botResponse.interactive } : {}),
          } as any,
          createdAt: new Date(),
        },
      });

      logger.info("whatsapp.router.reply_dispatched", {
        conversationId,
        intent: botResponse.intent,
        maskedPhone,
        wamid: outboundWamid,
        isInteractive: Boolean(botResponse.interactive),
      });
    } catch (dispatchErr) {
      logger.error("whatsapp.router.dispatch_failed", {
        conversationId,
        maskedPhone,
        error: (dispatchErr as Error)?.message || dispatchErr,
      });
    }
  }

  // 6. Update Conversation State (lastMessageAt, status, and activeBookingId)
  try {
    const convUpdate: Record<string, unknown> = {
      lastMessageAt: new Date(),
    };

    if (validatedTargetBookingId) {
      convUpdate.activeBookingId = validatedTargetBookingId;
    }

    if (botResponse.shouldHandoff) {
      convUpdate.status = "human_handoff";
    } else if (
      (context.conversation.status === "human_handoff" &&
        !botResponse.suppressResponse) ||
      wasClosed
    ) {
      convUpdate.status = "bot_active";
    }

    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: convUpdate,
    });
  } catch (convErr) {
    logger.warn("whatsapp.router.conv_update_failed", {
      conversationId,
      error: convErr,
    });
  }

  return botResponse;
}
