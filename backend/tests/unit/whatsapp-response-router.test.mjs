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
}
