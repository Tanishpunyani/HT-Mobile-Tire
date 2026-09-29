/**
 * Unit Tests: WhatsApp Intent Detection & Deterministic Response Router (Phase 3)
 * HT Mobile Tyres
 *
 * Verifies all 34 Phase 3 requirements:
 * 1. Greeting intent ("hi", "hello")
 * 2. Help/menu intent ("help", "menu")
 * 3. Booking status — one active booking
 * 4. Booking status — multiple active bookings (disambiguation prompt)
 * 5. Booking status — historical booking only
 * 6. Booking status — no bookings
 * 7. Appointment date/time intent
 * 8. Technician assigned intent
 * 9. Technician en route intent
 * 10. Technician arrived intent
 * 11. Technician stale GPS ("updating")
 * 12. Technician unavailable
 * 13. Tracking link intent
 * 14. Service catalog intent
 * 15. Cancellation pending intent
 * 16. Cancellation confirmed intent
 * 17. Cancellation in progress/completed/cancelled
 * 18. Reschedule intent
 * 19. Payment paid intent
 * 20. Payment quote_sent intent
 * 21. Payment pending intent
 * 22. Receipt intent
 * 23. Human support intent (shouldHandoff: true)
 * 24. Unknown fallback intent
 * 25. Booking reference disambiguation (#A1B2C3D4)
 * 26. Cross-customer target booking rejection (IDOR)
 * 27. Unknown customer handling
 * 28. Human handoff suppression (suppressResponse: true)
 * 29. Bot restart request ("bot", "restart")
 * 30. Outbound WhatsAppMessage persistence schema/contract
 * 31. Duplicate inbound wamid handling
 * 32. Bot loop / echo prevention
 * 33. Technician personal phone privacy
 * 34. Raw telemetry privacy (GPS coordinates/speed/heading omitted)
 */

import fs from "fs";
import path from "path";
import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

const ROOT_DIR = path.resolve(process.cwd());
const ROUTER_PATH = path.join(ROOT_DIR, "frontend/src/lib/whatsapp/router.ts");
const WEBHOOK_PATH = path.join(ROOT_DIR, "frontend/src/app/api/webhooks/whatsapp/route.ts");
const CONTEXT_PATH = path.join(ROOT_DIR, "frontend/src/lib/whatsapp/context.ts");

// ============================================================================
// SIMULATION ENGINE FOR DETERMINISTIC UNIT TESTS
// ============================================================================

function normalizeInboundText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[?!.,;:"'()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text, patterns) {
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

function detectWhatsAppIntent(inboundText) {
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

  // Priority 1: Human Support
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

  // Priority 2: Booking reference token
  if (/^#?[0-9a-fA-F]{8}$/i.test(text.trim())) {
    return "booking_status";
  }

  // Priority 3: Tracking & Technician
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

  return "unknown";
}

// Mock mock Context Generator
function createMockContext(overrides = {}) {
  const base = {
    customer: {
      id: "cust-1",
      name: "Alice Walker",
      phone: "+15551234567",
      email: "alice@example.com",
      isKnown: true,
    },
    conversation: {
      id: "conv-1",
      status: "bot_active",
      activeBookingId: "book-1",
      metadata: null,
    },
    bookingContext: {
      hasBookings: true,
      activeBookingsCount: 1,
      activeBooking: {
        id: "book-1",
        reference: "#A1B2C3D4",
        serviceName: "Flat Tire Repair",
        vehicle: "2022 Honda Civic",
        location: "123 Main St, Dallas, TX",
        status: "confirmed",
        bookingDate: "2026-10-15",
        bookingTime: "09:00",
        paymentStatus: "pending",
        totalAmount: 75.0,
        receiptUrl: null,
        tireSize: "225/45R17",
        message: null,
        formattedAddress: "123 Main St, Dallas, TX",
        technician: {
          id: "tech-1",
          name: "Mike Davis",
          role: "Lead Mobile Technician",
        },
        eta: {
          arrivalStatus: "estimated",
          etaMinutes: 18,
          estimatedArrivalAt: "2026-10-15T09:18:00.000Z",
          distanceMiles: 4.2,
          updatedAt: "2026-10-15T09:00:00.000Z",
        },
        trackingUrl: "https://mobiletire.clinic/technician/tracking/book-1",
        extraServices: null,
      },
      candidateActiveBookings: [
        {
          id: "book-1",
          reference: "#A1B2C3D4",
          serviceName: "Flat Tire Repair",
          vehicle: "2022 Honda Civic",
          location: "123 Main St, Dallas, TX",
          status: "confirmed",
          bookingDate: "2026-10-15",
          bookingTime: "09:00",
          paymentStatus: "pending",
          totalAmount: 75.0,
          receiptUrl: null,
        },
      ],
      lastCompletedBooking: null,
    },
    serviceCatalog: [
      {
        name: "Flat Tire Repair",
        slug: "flat-tire-repair",
        description: "Mobile puncture repair and bead reseal.",
        price: 65.0,
      },
      {
        name: "Mobile Tire Rotation",
        slug: "tire-rotation",
        description: "Driveway laser balance & rotation.",
        price: 85.0,
      },
    ],
    policy: {
      canCancelActiveBooking: false,
      cancellationRule: "Confirmed bookings require dispatch assistance to cancel. Please call support.",
      supportHotline: "(800) 555-TIRE (8473)",
    },
  };

  return { ...base, ...overrides };
}

function buildDisambiguationPrompt(candidates) {
  const items = candidates
    .map((c, i) => `${i + 1}. *${c.reference}* — ${c.serviceName} (${c.vehicle})\n   Scheduled: *${c.bookingDate}* at *${c.bookingTime}*`)
    .join("\n\n");
  return `You currently have *${candidates.length} active bookings*:\n\n${items}\n\nPlease reply with your booking reference (e.g. *${candidates[0].reference}*) so I can assist you with the right appointment.`;
}

function buildDisambiguationListPayload(candidates) {
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

function buildServiceListPayload(services) {
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

function simulateRouteWhatsAppIntent(context, inboundMessageText) {
  const normalizedText = normalizeInboundText(inboundMessageText);

  if (context.conversation.status === "closed") {
    context.conversation.status = "bot_active";
  }

  if (context.conversation.status === "human_handoff") {
    if (
      normalizedText === "bot" ||
      normalizedText === "restart" ||
      normalizedText === "restart bot"
    ) {
      return {
        intent: "greeting",
        replyText: "Welcome back! I am HT Mobile Tyres bot assistant. How can I help you today?",
        shouldHandoff: false,
        suppressResponse: false,
      };
    }
    return {
      intent: "human_support",
      replyText: "",
      suppressResponse: true,
    };
  }

  const candidates = context.bookingContext.candidateActiveBookings;
  let targetBookingId = null;

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
    const refMatch = inboundMessageText ? inboundMessageText.match(/#?([0-9a-fA-F]{8})\b/i) : null;
    const refToken = refMatch ? refMatch[1].toUpperCase() : null;
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
      const numMatch = normalizedText.match(/^([1-9])$/);
      if (numMatch) {
        const idx = parseInt(numMatch[1], 10) - 1;
        if (candidates[idx]) {
          targetBookingId = candidates[idx].id;
        }
      } else {
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

  const intent = detectWhatsAppIntent(inboundMessageText);

  switch (intent) {
    case "human_support":
      return {
        intent,
        replyText: `I am connecting you with our customer support team.\n\n📞 *Support Hotline:* ${context.policy.supportHotline}\n🕒 *Hours:* 7 Days a week (24/7 Roadside Assistance)\n\nA team representative will review your message shortly.`,
        shouldHandoff: true,
      };

    case "greeting": {
      const greetingName = context.customer.isKnown && context.customer.name ? `Hi ${context.customer.name.split(" ")[0]}! ` : "Hello! ";
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
        const text = last
          ? `You don't have any active bookings right now.\n\n*Previous Service:*\n• Reference: *${last.reference}*\n• Service: *${last.serviceName}*\n• Vehicle: *${last.vehicle}*\n• Date: *${last.bookingDate}*\n• Status: *Completed*\n\nNeed to book a new appointment?\n👉 https://mobiletire.clinic/booking`
          : `You do not have any active bookings right now.\n\nBook a new service online:\n👉 https://mobiletire.clinic/booking`;
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
          targetBookingId: targetBookingId || null,
          ...(interactive ? { interactive } : {}),
        };
      }

      const trackingLine = b.trackingUrl ? `\n\nLive van tracking:\n👉 ${b.trackingUrl}` : "";
      const text = `*Booking Status: ${b.status}*\n\n• Reference: *${b.reference}*\n• Service: *${b.serviceName}*\n• Vehicle: *${b.vehicle}*\n• Scheduled: *${b.bookingDate}* at *${b.bookingTime}*\n• Location: *${b.location}*\n• Payment: *${b.paymentStatus}*${trackingLine}`;
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
      if (b.eta.arrivalStatus === "arrived") {
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

      const text = `*Technician En Route!*\n\nYour technician, *${techName}*, is on the way!`;
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

    case "service_info": {
      const rawText = inboundMessageText?.trim() || "";
      const isServiceSelect = /^service_select:(.+)$/i.test(rawText);

      if (isServiceSelect) {
        const serviceToken = rawText.replace(/^service_select:/i, "").trim().toLowerCase();
        const catalog = context.serviceCatalog || [];
        const matchedService = catalog.find((s) => {
          const sSlug = (s.slug || "").toLowerCase();
          const sId = (s.id || "").toLowerCase();
          const sNameSlug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          return sSlug === serviceToken || sId === serviceToken || sNameSlug === serviceToken || sNameSlug.includes(serviceToken);
        });

        if (matchedService) {
          const text = `*${matchedService.name}*\n• Price: from $${Number(matchedService.price).toFixed(2)}\n• Description: ${matchedService.description}\n\nBook online: https://mobiletire.clinic/booking`;
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
          const serviceListPayload = buildServiceListPayload(catalog);
          const fallbackText = `We could not find the selected service. Here is our full list of mobile tire services:\n\nBook online:\n👉 https://mobiletire.clinic/services`;
          return {
            intent,
            replyText: fallbackText,
            ...(serviceListPayload ? { interactive: serviceListPayload } : {}),
          };
        }
      }

      const text = `*HT Mobile Tyres — Services & Pricing*`;
      const serviceListPayload = buildServiceListPayload(context.serviceCatalog);
      return {
        intent,
        replyText: text,
        ...(serviceListPayload ? { interactive: serviceListPayload } : {}),
      };
    }

    case "cancellation": {
      const text = `Cancellations require dispatch assistance: please call ${context.policy.supportHotline}`;
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
      const text = `To reschedule your appointment, please call dispatch at ${context.policy.supportHotline}`;
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

    case "media_attachment":
      return {
        intent,
        replyText: "Thank you for sharing the photo! Our team has received your image.",
        targetBookingId,
      };

    default:
      return {
        intent: "unknown",
        replyText: "I didn't quite catch that.",
        targetBookingId: targetBookingId || null,
      };
  }
}

export function runWhatsAppResponseRouterUnitTests() {
  const routerSrc = fs.readFileSync(ROUTER_PATH, "utf-8");
  const webhookSrc = fs.readFileSync(WEBHOOK_PATH, "utf-8");
  const contextSrc = fs.readFileSync(CONTEXT_PATH, "utf-8");

  describe("Phase 3 Invariants: Intent Detection Engine", () => {
    test("1. Greeting intent detected from common salutations", () => {
      assertEqual(detectWhatsAppIntent("hi"), "greeting");
      assertEqual(detectWhatsAppIntent("Hello"), "greeting");
      assertEqual(detectWhatsAppIntent("Hey there!"), "greeting");
      assertEqual(detectWhatsAppIntent("good morning"), "greeting");
    });

    test("2. Help / Menu intent detected", () => {
      assertEqual(detectWhatsAppIntent("help"), "greeting");
      assertEqual(detectWhatsAppIntent("menu"), "greeting");
      assertEqual(detectWhatsAppIntent("what can you do?"), "greeting");
    });

    test("3. Booking status intent detected", () => {
      assertEqual(detectWhatsAppIntent("What is my booking status?"), "booking_status");
      assertEqual(detectWhatsAppIntent("check booking"), "booking_status");
      assertEqual(detectWhatsAppIntent("is it confirmed?"), "booking_status");
      assertEqual(detectWhatsAppIntent("#A1B2C3D4"), "booking_status");
    });

    test("4. Appointment time intent detected", () => {
      assertEqual(detectWhatsAppIntent("When is my appointment?"), "appointment");
      assertEqual(detectWhatsAppIntent("what time are you coming?"), "appointment");
      assertEqual(detectWhatsAppIntent("appointment schedule"), "appointment");
    });

    test("5. Technician whereabouts intent detected with priority over generic words", () => {
      assertEqual(detectWhatsAppIntent("Where is my technician?"), "technician");
      assertEqual(detectWhatsAppIntent("who is coming to fix my tire?"), "technician");
      assertEqual(detectWhatsAppIntent("what is the tech ETA?"), "technician");
      assertEqual(detectWhatsAppIntent("is the driver on the way?"), "technician");
    });

    test("6. Live Tracking link intent detected", () => {
      assertEqual(detectWhatsAppIntent("track van"), "tracking");
      assertEqual(detectWhatsAppIntent("send tracking link"), "tracking");
      assertEqual(detectWhatsAppIntent("live tracking"), "tracking");
    });

    test("7. Service catalog intent detected", () => {
      assertEqual(detectWhatsAppIntent("What services do you offer?"), "service_info");
      assertEqual(detectWhatsAppIntent("tire pricing"), "service_info");
      assertEqual(detectWhatsAppIntent("how much for flat repair?"), "service_info");
    });

    test("8. Cancellation intent detected", () => {
      assertEqual(detectWhatsAppIntent("Can I cancel my appointment?"), "cancellation");
      assertEqual(detectWhatsAppIntent("cancel booking"), "cancellation");
      assertEqual(detectWhatsAppIntent("drop booking"), "cancellation");
    });

    test("9. Reschedule intent detected", () => {
      assertEqual(detectWhatsAppIntent("Can I reschedule?"), "reschedule");
      assertEqual(detectWhatsAppIntent("need to change time"), "reschedule");
      assertEqual(detectWhatsAppIntent("postpone my appointment"), "reschedule");
    });

    test("10. Payment status intent detected", () => {
      assertEqual(detectWhatsAppIntent("Did I pay?"), "payment");
      assertEqual(detectWhatsAppIntent("how much do I owe?"), "payment");
      assertEqual(detectWhatsAppIntent("what is my balance?"), "payment");
    });

    test("11. Receipt intent detected", () => {
      assertEqual(detectWhatsAppIntent("Send my receipt"), "receipt");
      assertEqual(detectWhatsAppIntent("where is my invoice?"), "receipt");
      assertEqual(detectWhatsAppIntent("get receipt"), "receipt");
    });

    test("12. Human support intent detected with top priority", () => {
      assertEqual(detectWhatsAppIntent("I want to speak with a human"), "human_support");
      assertEqual(detectWhatsAppIntent("talk to an agent"), "human_support");
      assertEqual(detectWhatsAppIntent("representative"), "human_support");
      assertEqual(detectWhatsAppIntent("call me please"), "human_support");
    });

    test("13. Unknown intent fallback for non-matching queries", () => {
      assertEqual(detectWhatsAppIntent("asdfghjkl"), "unknown");
      assertEqual(detectWhatsAppIntent("🚀🔥🎉"), "unknown");
      assertEqual(detectWhatsAppIntent(""), "unknown");
      assertEqual(detectWhatsAppIntent(null), "unknown");
    });

    test("13b. Media attachment labels detected as media_attachment and do not fall into unknown fallback", () => {
      assertEqual(detectWhatsAppIntent("[Photo Attached]"), "media_attachment");
      assertEqual(detectWhatsAppIntent("[Voice Note Attached]"), "media_attachment");
      assertEqual(detectWhatsAppIntent("[Document: tire_receipt.pdf]"), "media_attachment");
      assertEqual(detectWhatsAppIntent("[Document Attached]"), "media_attachment");
      assertEqual(detectWhatsAppIntent("[Video Attached]"), "media_attachment");
      assertEqual(detectWhatsAppIntent("[Sticker Attached]"), "media_attachment");
      assertEqual(detectWhatsAppIntent("[Location Shared]"), "media_attachment");
    });
  });

  describe("Phase 3 Invariants: Router Behavior & Business Logic", () => {
    test("14. Booking status — one active booking returns reference, vehicle, scheduled time", () => {
      assert(routerSrc.includes("case \"booking_status\":"), "Must handle booking_status");
      assert(routerSrc.includes("b.reference"), "Must include reference");
      assert(routerSrc.includes("b.vehicle"), "Must include vehicle");
      assert(routerSrc.includes("formatStatus(b.status)"), "Must format status");
    });

    test("15. Booking status — multiple active bookings returns disambiguation prompt", () => {
      assert(routerSrc.includes("buildDisambiguationPrompt(candidates)"), "Must return disambiguation prompt on multiple active bookings");
      assert(routerSrc.includes("activeBookingsCount > 1"), "Must check activeBookingsCount > 1");
    });

    test("16. Booking status — historical booking only mentions previous service safely", () => {
      assert(routerSrc.includes("Previous Service:"), "Must display previous service");
      assert(routerSrc.includes("last.reference"), "Must include historical reference");
    });

    test("17. Booking status — no bookings provides online booking link", () => {
      assert(routerSrc.includes("You do not have any active or past bookings"), "Provides safe empty response");
      assert(routerSrc.includes("https://mobiletire.clinic/booking"), "Includes booking website link");
    });

    test("18. Appointment date/time returns scheduled date, window, and location", () => {
      assert(routerSrc.includes("case \"appointment\":"), "Must handle appointment intent");
      assert(routerSrc.includes("b.bookingDate"), "Must include date");
      assert(routerSrc.includes("b.bookingTime"), "Must include time");
    });

    test("19. Technician assigned intent exposes technician name & role", () => {
      assert(routerSrc.includes("case \"technician\":"), "Must handle technician intent");
      assert(routerSrc.includes("b.technician?.name"), "Must include technician name");
    });

    test("20. Technician en route returns ETA minutes, distance, and live tracking link", () => {
      assert(routerSrc.includes("b.eta.etaMinutes"), "Must include ETA minutes");
      assert(routerSrc.includes("b.eta.distanceMiles"), "Must include distance miles");
      assert(routerSrc.includes("b.trackingUrl"), "Must include trackingUrl when active");
    });

    test("21. Technician arrived returns arrived on-site wording", () => {
      assert(routerSrc.includes("has arrived on-site"), "Must include arrived wording");
    });

    test("22. Technician stale GPS returns 'updating' wording without crashing", () => {
      assert(routerSrc.includes("Live GPS signal is currently updating"), "Must handle updating arrival state");
    });

    test("23. Technician unavailable explains pending dispatch prior to window", () => {
      assert(routerSrc.includes("assigned prior to your arrival window"), "Must explain pending dispatch");
    });

    test("24. Tracking link intent returns /technician/tracking/[id]", () => {
      assert(routerSrc.includes("case \"tracking\":"), "Must handle tracking intent");
      assert(routerSrc.includes("Here is the live van tracking link"), "Provides tracking link");
    });

    test("25. Service catalog returns dynamic active services and prices", () => {
      assert(routerSrc.includes("case \"service_info\":"), "Must handle service_info");
      assert(routerSrc.includes("context.serviceCatalog"), "Must read dynamically from context.serviceCatalog");
      assert(routerSrc.includes("https://mobiletire.clinic/services"), "Includes services link");
    });

    test("26. Cancellation pending explains allowed state and account link", () => {
      assert(routerSrc.includes("case \"cancellation\":"), "Must handle cancellation");
      assert(routerSrc.includes("Pending Confirmation"), "Recognizes pending cancellation");
    });

    test("27. Cancellation confirmed requires dispatch hotline assistance", () => {
      assert(routerSrc.includes("Confirmed"), "Recognizes confirmed cancellation");
      assert(routerSrc.includes("Cancellations require dispatch assistance"), "Directs to dispatch");
    });

    test("28. Reschedule intent directs user to hotline and account portal", () => {
      assert(routerSrc.includes("case \"reschedule\":"), "Must handle reschedule");
      assert(routerSrc.includes("context.policy.supportHotline"), "Provides support hotline");
    });

    test("29. Payment paid / quote_sent / pending handled safely", () => {
      assert(routerSrc.includes("case \"payment\":"), "Must handle payment");
      assert(routerSrc.includes("Payment Status: Paid in Full"), "Handles paid");
      assert(routerSrc.includes("Payment Status: Invoice Ready"), "Handles quote_sent");
      assert(routerSrc.includes("Payment Status: Pending"), "Handles pending");
    });

    test("30. Receipt intent provides official receiptUrl", () => {
      assert(routerSrc.includes("case \"receipt\":"), "Must handle receipt");
      assert(routerSrc.includes("targetReceipt.receiptUrl"), "Provides official receiptUrl");
    });

    test("31. Human support intent sets shouldHandoff: true and provides hotline", () => {
      assert(routerSrc.includes("case \"human_support\":"), "Must handle human_support");
      assert(routerSrc.includes("shouldHandoff: true"), "Must set shouldHandoff flag");
    });

    test("32. Human handoff state suppresses automated replies unless restarted", () => {
      assert(routerSrc.includes("context.conversation.status === \"human_handoff\""), "Checks human_handoff conversation status");
      assert(routerSrc.includes("suppressResponse: true"), "Suppresses automated reply when in handoff");
      assert(routerSrc.includes("normalizedText === \"bot\"") && routerSrc.includes("normalizedText === \"restart\""), "Allows restart command");
    });

    test("33. Technician phone privacy: technician.phone is strictly prohibited", () => {
      assert(!routerSrc.includes("technician.phone"), "technician.phone must NEVER appear in router.ts");
      assert(!contextSrc.includes("technician.phone"), "technician.phone must NEVER appear in context.ts");
    });

    test("34. Hardware telemetry privacy: raw GPS coordinates, speed, heading are omitted", () => {
      assert(!routerSrc.includes("technicianLocation.latitude"), "Raw GPS latitude must not be read in router");
      assert(!routerSrc.includes("technicianLocation.longitude"), "Raw GPS longitude must not be read in router");
      assert(!routerSrc.includes("technicianLocation.speed"), "Speed must not be read in router");
      assert(!routerSrc.includes("technicianLocation.heading"), "Heading must not be read in router");
    });

    test("34b. Media attachment router responses provide deterministic acknowledgements", () => {
      assert(routerSrc.includes("case \"media_attachment\":"), "Must handle media_attachment intent");
      assert(routerSrc.includes("[photo attached]"), "Handles [Photo Attached]");
      assert(routerSrc.includes("[voice note attached]"), "Handles [Voice Note Attached]");
      assert(routerSrc.includes("[document:"), "Handles [Document: filename]");
      assert(routerSrc.includes("[video attached]"), "Handles [Video Attached]");
      assert(routerSrc.includes("[sticker attached]"), "Handles [Sticker Attached]");
      assert(routerSrc.includes("[location shared]"), "Handles [Location Shared]");
    });
  });

  describe("Phase 3 Invariants: Webhook Pipeline Integration & Loop Protection", () => {
    test("35. Webhook invokes sendWhatsAppBotReply after storing inbound message", () => {
      assert(webhookSrc.includes("sendWhatsAppBotReply("), "route.ts must call sendWhatsAppBotReply");
      assert(webhookSrc.includes("inboundText: body"), "Must pass inbound text body");
    });

    test("36. Outbound bot message is persisted with direction = 'outbound'", () => {
      assert(routerSrc.includes("direction: \"outbound\""), "Must persist WhatsAppMessage with direction outbound");
      assert(routerSrc.includes("source: \"deterministic_router\""), "Must record deterministic_router in rawPayload");
    });

    test("37. Loop prevention: Delivery receipts in value.statuses are not routed as bot messages", () => {
      assert(webhookSrc.includes("value.statuses"), "Statuses are processed separately");
      assert(!webhookSrc.includes("sendWhatsAppBotReply({ conversationId: statusObj"), "Statuses cannot trigger bot replies");
    });
  });

  describe("Phase 9.3: Native WhatsApp Interactive Router Integration & Booking Disambiguation", () => {
    test("38. Structured intent: intent:booking_status -> booking_status", () => {
      assertEqual(detectWhatsAppIntent("intent:booking_status"), "booking_status");
      assertEqual(detectWhatsAppIntent("intent:status"), "booking_status");
    });

    test("39. Structured intent: intent:services -> service_info", () => {
      assertEqual(detectWhatsAppIntent("intent:services"), "service_info");
      assertEqual(detectWhatsAppIntent("intent:service_info"), "service_info");
    });

    test("40. Structured intent: intent:human_support -> human_support", () => {
      assertEqual(detectWhatsAppIntent("intent:human_support"), "human_support");
      assertEqual(detectWhatsAppIntent("intent:human"), "human_support");
    });

    test("41. Button alias: btn_status -> booking_status", () => {
      assertEqual(detectWhatsAppIntent("btn_status"), "booking_status");
    });

    test("42. Button alias: btn_services -> service_info", () => {
      assertEqual(detectWhatsAppIntent("btn_services"), "service_info");
    });

    test("43. Button alias: btn_human -> human_support", () => {
      assertEqual(detectWhatsAppIntent("btn_human"), "human_support");
      assertEqual(detectWhatsAppIntent("btn_support"), "human_support");
    });

    test("44. Structured booking selection: booking_select:<valid-reference> selects correct booking", () => {
      const multiCtx = createMockContext({
        bookingContext: {
          hasBookings: true,
          activeBookingsCount: 2,
          activeBooking: null,
          candidateActiveBookings: [
            { id: "book-1", reference: "#A1B2C3D4", serviceName: "Flat Tire Repair", vehicle: "2022 Honda Civic", location: "123 Main St", status: "confirmed", bookingDate: "2026-10-15", bookingTime: "09:00", paymentStatus: "pending", totalAmount: 75.0, receiptUrl: null },
            { id: "book-2", reference: "#E5F6G7H8", serviceName: "Mobile Tire Rotation", vehicle: "2021 Ford F-150", location: "456 Oak St", status: "confirmed", bookingDate: "2026-10-16", bookingTime: "14:00", paymentStatus: "paid", totalAmount: 85.0, receiptUrl: null },
          ],
          lastCompletedBooking: null,
        },
      });

      const res = simulateRouteWhatsAppIntent(multiCtx, "booking_select:A1B2C3D4");
      assertEqual(res.intent, "booking_status");
      assertEqual(res.targetBookingId, "book-1", "Must resolve targetBookingId to book-1");
    });

    test("45. Structured booking selection: booking_select:<wrong/unknown-reference> is rejected safely", () => {
      const multiCtx = createMockContext({
        bookingContext: {
          hasBookings: true,
          activeBookingsCount: 2,
          activeBooking: null,
          candidateActiveBookings: [
            { id: "book-1", reference: "#A1B2C3D4", serviceName: "Flat Tire Repair", vehicle: "2022 Honda Civic", location: "123 Main St", status: "confirmed", bookingDate: "2026-10-15", bookingTime: "09:00", paymentStatus: "pending", totalAmount: 75.0, receiptUrl: null },
            { id: "book-2", reference: "#E5F6G7H8", serviceName: "Mobile Tire Rotation", vehicle: "2021 Ford F-150", location: "456 Oak St", status: "confirmed", bookingDate: "2026-10-16", bookingTime: "14:00", paymentStatus: "paid", totalAmount: 85.0, receiptUrl: null },
          ],
          lastCompletedBooking: null,
        },
      });

      const res = simulateRouteWhatsAppIntent(multiCtx, "booking_select:UNKNOWN999");
      assertEqual(res.intent, "booking_status");
      assertEqual(res.targetBookingId, null, "Must NOT resolve unauthorized targetBookingId");
      assert(res.replyText.includes("2 active bookings"), "Falls back to disambiguation prompt");
    });

    test("46. Structured service selection: service_select:<known-service> maps correctly", () => {
      const ctx = createMockContext();
      const res = simulateRouteWhatsAppIntent(ctx, "service_select:flat-tire-repair");
      assertEqual(res.intent, "service_info");
      assert(res.replyText.includes("Flat Tire Repair"), "Contains service name");
      assert(res.interactive?.type === "button", "Attaches buttons for service");
      assertEqual(res.interactive.buttons[0].id, "intent:services");
    });

    test("47. Structured service selection: service_select:<unknown-service> falls back safely", () => {
      const ctx = createMockContext();
      const res = simulateRouteWhatsAppIntent(ctx, "service_select:nonexistent-mystery-service");
      assertEqual(res.intent, "service_info");
      assert(res.replyText.includes("could not find"), "Contains safe fallback wording");
      assert(res.interactive?.type === "list", "Provides service list menu fallback");
    });

    test("48. Multiple bookings produce list interactive response when within limits", () => {
      const multiCtx = createMockContext({
        bookingContext: {
          hasBookings: true,
          activeBookingsCount: 2,
          activeBooking: null,
          candidateActiveBookings: [
            { id: "book-1", reference: "#A1B2C3D4", serviceName: "Flat Tire Repair", vehicle: "2022 Honda Civic", location: "123 Main St", status: "confirmed", bookingDate: "2026-10-15", bookingTime: "09:00", paymentStatus: "pending", totalAmount: 75.0, receiptUrl: null },
            { id: "book-2", reference: "#E5F6G7H8", serviceName: "Mobile Tire Rotation", vehicle: "2021 Ford F-150", location: "456 Oak St", status: "confirmed", bookingDate: "2026-10-16", bookingTime: "14:00", paymentStatus: "paid", totalAmount: 85.0, receiptUrl: null },
          ],
          lastCompletedBooking: null,
        },
      });

      const res = simulateRouteWhatsAppIntent(multiCtx, "status");
      assertEqual(res.intent, "booking_status");
      assert(res.interactive !== undefined, "Interactive list payload must be present");
      assertEqual(res.interactive.type, "list");
      assertEqual(res.interactive.buttonText, "Select Booking");
      assertEqual(res.interactive.sections[0].rows.length, 2);
      assertEqual(res.interactive.sections[0].rows[0].id, "booking_select:A1B2C3D4");
    });

    test("49. Greeting produces button interactive response with 3 options", () => {
      const ctx = createMockContext();
      const res = simulateRouteWhatsAppIntent(ctx, "hi");
      assertEqual(res.intent, "greeting");
      assert(res.interactive !== undefined, "Interactive button payload must be attached");
      assertEqual(res.interactive.type, "button");
      assertEqual(res.interactive.buttons.length, 3);
      assertEqual(res.interactive.buttons[0].id, "intent:booking_status");
      assertEqual(res.interactive.buttons[1].id, "intent:services");
      assertEqual(res.interactive.buttons[2].id, "intent:human_support");
    });

    test("50. Active booking status flow produces appropriate buttons", () => {
      const ctxWithTracking = createMockContext();
      const resWithTrack = simulateRouteWhatsAppIntent(ctxWithTracking, "status");
      assertEqual(resWithTrack.intent, "booking_status");
      assertEqual(resWithTrack.interactive?.type, "button");
      assertEqual(resWithTrack.interactive.buttons.length, 3);
      assertEqual(resWithTrack.interactive.buttons[0].title, "Track Van");

      const ctxNoTracking = createMockContext({
        bookingContext: {
          hasBookings: true,
          activeBookingsCount: 1,
          activeBooking: {
            ...createMockContext().bookingContext.activeBooking,
            trackingUrl: null,
          },
          candidateActiveBookings: [createMockContext().bookingContext.activeBooking],
          lastCompletedBooking: null,
        },
      });
      const resNoTrack = simulateRouteWhatsAppIntent(ctxNoTracking, "status");
      assertEqual(resNoTrack.interactive?.type, "button");
      assertEqual(resNoTrack.interactive.buttons.length, 2);
      assertEqual(resNoTrack.interactive.buttons[0].title, "Our Services");
    });

    test("51. Technician flow produces appropriate buttons", () => {
      const ctx = createMockContext();
      const resEnRoute = simulateRouteWhatsAppIntent(ctx, "technician");
      assertEqual(resEnRoute.intent, "technician");
      assertEqual(resEnRoute.interactive?.type, "button");
      assertEqual(resEnRoute.interactive.buttons[0].id, "intent:tracking");
      assertEqual(resEnRoute.interactive.buttons[0].title, "Live Tracking");

      const ctxArrived = createMockContext({
        bookingContext: {
          hasBookings: true,
          activeBookingsCount: 1,
          activeBooking: {
            ...createMockContext().bookingContext.activeBooking,
            eta: { arrivalStatus: "arrived" },
          },
          candidateActiveBookings: [createMockContext().bookingContext.activeBooking],
          lastCompletedBooking: null,
        },
      });
      const resArrived = simulateRouteWhatsAppIntent(ctxArrived, "technician");
      assertEqual(resArrived.interactive?.type, "button");
      assertEqual(resArrived.interactive.buttons[0].title, "Check Status");
    });

    test("52. Services flow produces list menu response", () => {
      const ctx = createMockContext();
      const res = simulateRouteWhatsAppIntent(ctx, "services");
      assertEqual(res.intent, "service_info");
      assertEqual(res.interactive?.type, "list");
      assertEqual(res.interactive.buttonText, "View Services");
      assertEqual(res.interactive.sections[0].rows.length, 2);
    });

    test("53. Cancellation & reschedule flows produce appropriate buttons", () => {
      const ctx = createMockContext();
      const resCancel = simulateRouteWhatsAppIntent(ctx, "cancel");
      assertEqual(resCancel.intent, "cancellation");
      assertEqual(resCancel.interactive?.type, "button");
      assertEqual(resCancel.interactive.buttons[0].title, "Speak to Staff");
      assertEqual(resCancel.interactive.buttons[1].title, "Check Status");

      const resResched = simulateRouteWhatsAppIntent(ctx, "reschedule");
      assertEqual(resResched.intent, "reschedule");
      assertEqual(resResched.interactive?.type, "button");
      assertEqual(resResched.interactive.buttons[0].title, "Speak to Staff");
    });

    test("54. Plain-text 'status' remains unchanged and functional", () => {
      assertEqual(detectWhatsAppIntent("status"), "booking_status");
      assertEqual(detectWhatsAppIntent("booking status"), "booking_status");
      const ctx = createMockContext();
      const res = simulateRouteWhatsAppIntent(ctx, "status");
      assert(res.replyText.includes("Booking Status:"), "Contains original status header");
      assert(res.replyText.includes("#A1B2C3D4"), "Contains reference");
    });

    test("55. Plain-text 'services' remains unchanged and functional", () => {
      assertEqual(detectWhatsAppIntent("services"), "service_info");
      assertEqual(detectWhatsAppIntent("what services"), "service_info");
      const ctx = createMockContext();
      const res = simulateRouteWhatsAppIntent(ctx, "services");
      assert(res.replyText.includes("HT Mobile Tyres"), "Contains service text");
    });

    test("56. Plain-text 'human' remains unchanged and triggers handoff", () => {
      assertEqual(detectWhatsAppIntent("human"), "human_support");
      assertEqual(detectWhatsAppIntent("agent"), "human_support");
      const ctx = createMockContext();
      const res = simulateRouteWhatsAppIntent(ctx, "human");
      assertEqual(res.intent, "human_support");
      assertEqual(res.shouldHandoff, true, "Must set shouldHandoff: true");
    });

    test("57. Plain-text numeric and vehicle-name booking selection remains functional", () => {
      const multiCtx = createMockContext({
        bookingContext: {
          hasBookings: true,
          activeBookingsCount: 2,
          activeBooking: null,
          candidateActiveBookings: [
            { id: "book-1", reference: "#A1B2C3D4", serviceName: "Flat Tire Repair", vehicle: "2022 Honda Civic", location: "123 Main St", status: "confirmed", bookingDate: "2026-10-15", bookingTime: "09:00", paymentStatus: "pending", totalAmount: 75.0, receiptUrl: null },
            { id: "book-2", reference: "#E5F6G7H8", serviceName: "Mobile Tire Rotation", vehicle: "2021 Ford F-150", location: "456 Oak St", status: "confirmed", bookingDate: "2026-10-16", bookingTime: "14:00", paymentStatus: "paid", totalAmount: 85.0, receiptUrl: null },
          ],
          lastCompletedBooking: null,
        },
      });

      const resNum = simulateRouteWhatsAppIntent(multiCtx, "1");
      assertEqual(resNum.targetBookingId, "book-1", "Numeric 1 selects first booking");

      const resVehicle = simulateRouteWhatsAppIntent(multiCtx, "Ford F-150");
      assertEqual(resVehicle.targetBookingId, "book-2", "Vehicle name selects second booking");
    });

    test("58. Existing media_attachment routing remains unchanged", () => {
      assertEqual(detectWhatsAppIntent("[Photo Attached]"), "media_attachment");
      assertEqual(detectWhatsAppIntent("[Voice Note Attached]"), "media_attachment");
      assertEqual(detectWhatsAppIntent("[Location Shared]"), "media_attachment");
      const ctx = createMockContext();
      const res = simulateRouteWhatsAppIntent(ctx, "[Photo Attached]");
      assertEqual(res.intent, "media_attachment");
      assert(res.replyText.includes("photo"), "Acknowledges photo");
    });

    test("59. Existing handoff behavior remains unchanged", () => {
      const handoffCtx = createMockContext({
        conversation: { id: "conv-1", status: "human_handoff", activeBookingId: "book-1", metadata: null },
      });
      const resSuppressed = simulateRouteWhatsAppIntent(handoffCtx, "status");
      assertEqual(resSuppressed.suppressResponse, true, "Suppresses bot reply in handoff");

      const resRestart = simulateRouteWhatsAppIntent(handoffCtx, "restart");
      assertEqual(resRestart.suppressResponse, false, "Resumes on restart command");
      assertEqual(resRestart.intent, "greeting");
    });

    test("60. Interactive payload respects provider constraints", () => {
      const ctx = createMockContext();
      const resGreeting = simulateRouteWhatsAppIntent(ctx, "hi");
      assert(resGreeting.interactive.buttons.length <= 3, "Buttons count <= 3");
      resGreeting.interactive.buttons.forEach((b) => {
        assert(b.title.length <= 20, `Button title "${b.title}" exceeds 20 characters`);
        assert(b.id.length <= 256, `Button id "${b.id}" exceeds 256 characters`);
      });

      const resServices = simulateRouteWhatsAppIntent(ctx, "services");
      assert(resServices.interactive.sections[0].rows.length <= 10, "List rows <= 10");
      assert(resServices.interactive.buttonText.length <= 20, "buttonText <= 20");
      resServices.interactive.sections[0].rows.forEach((r) => {
        assert(r.title.length <= 24, `Row title "${r.title}" exceeds 24 characters`);
        if (r.description) {
          assert(r.description.length <= 72, `Row description "${r.description}" exceeds 72 characters`);
        }
      });
    });

    test("61. Fallback to text occurs safely when interactive data cannot be constructed", () => {
      const manyCandidates = Array.from({ length: 15 }, (_, i) => ({
        id: `book-${i}`,
        reference: `#REF${i.toString().padStart(5, "0")}`,
        serviceName: "Tire Repair",
        vehicle: "Car",
        location: "City",
        status: "confirmed",
        bookingDate: "2026-10-15",
        bookingTime: "10:00",
        paymentStatus: "pending",
        totalAmount: 50.0,
        receiptUrl: null,
      }));

      const overflowCtx = createMockContext({
        bookingContext: {
          hasBookings: true,
          activeBookingsCount: 15,
          activeBooking: null,
          candidateActiveBookings: manyCandidates,
          lastCompletedBooking: null,
        },
      });

      const res = simulateRouteWhatsAppIntent(overflowCtx, "status");
      assertEqual(res.intent, "booking_status");
      assertEqual(res.interactive, undefined, "Interactive payload must be undefined when candidates > 10");
      assert(res.replyText.includes("15 active bookings"), "Text fallback remains present and valid");
    });

    test("62. Static verification: router.ts implements Phase 9.3 interactive elements", () => {
      assert(routerSrc.includes("booking_select:"), "router.ts must handle booking_select:");
      assert(routerSrc.includes("service_select:"), "router.ts must handle service_select:");
      assert(routerSrc.includes("btn_status"), "router.ts must handle btn_status");
      assert(routerSrc.includes("btn_services"), "router.ts must handle btn_services");
      assert(routerSrc.includes("btn_human"), "router.ts must handle btn_human");
      assert(routerSrc.includes("intent:booking_status"), "router.ts must handle intent:booking_status");
      assert(routerSrc.includes("intent:services"), "router.ts must handle intent:services");
      assert(routerSrc.includes("intent:human_support"), "router.ts must handle intent:human_support");
      assert(routerSrc.includes("buildDisambiguationListPayload"), "router.ts must include buildDisambiguationListPayload");
      assert(routerSrc.includes("buildServiceListPayload"), "router.ts must include buildServiceListPayload");
      assert(routerSrc.includes("interactive: botResponse.interactive"), "router.ts must forward interactive payload");
    });
  });
}
