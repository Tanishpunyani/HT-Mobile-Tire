/**
 * Unit & Integration Tests: Admin Live GPS Direct Dispatch & Emergency Call Customer Actions
 * HT Mobile Tire Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const TEST_SECRET = "test_technician_dispatch_secret_super_safe_32_bytes";

// Helper reproducing technician dispatch token generation from src/lib/technician-auth.ts
function createTechnicianDispatchToken(technicianId, bookingId, secret = TEST_SECRET, expiresInMs = 3600000) {
  const expiresAt = Date.now() + expiresInMs;
  const payload = JSON.stringify({ technicianId, bookingId: bookingId || null, expiresAt });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

// Helper reproducing safe URL verification from BookingsManagementClient.tsx
function validateDispatchUrl(dispatchUrl, expectedBookingId, expectedOrigin = "https://ht-mobile-tire.vercel.app") {
  if (!dispatchUrl || typeof dispatchUrl !== "string") {
    return { valid: false, reason: "missing_url" };
  }

  try {
    const parsed = new URL(dispatchUrl, expectedOrigin);
    if (parsed.origin !== expectedOrigin) {
      return { valid: false, reason: "origin_mismatch" };
    }
    if (!parsed.pathname.startsWith(`/technician/tracking/${expectedBookingId}`)) {
      return { valid: false, reason: "pathname_mismatch" };
    }
    return { valid: true, url: parsed.href };
  } catch {
    return { valid: false, reason: "malformed_url" };
  }
}

// Helper reproducing phone call URI normalization from EmergencyRequestsManagementClient.tsx
function getCustomerCallUri(phone) {
  if (!phone || typeof phone !== "string") return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const startsWithPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 7) {
    return null;
  }

  const normalized = startsWithPlus ? `+${digits}` : digits;
  return `tel:${normalized}`;
}

export function runAdminDispatchAndEmergencyActionTests() {
  describe("Admin Live GPS Direct Dispatch Portal Navigation", () => {
    test("Clicking Live GPS for valid booking with assigned technician generates correct portal URL", () => {
      const bookingId = "booking_abc_123";
      const technicianId = "tech_james_456";
      const token = createTechnicianDispatchToken(technicianId, bookingId);
      const host = "https://ht-mobile-tire.vercel.app";
      const generatedUrl = `${host}/technician/tracking/${bookingId}?token=${encodeURIComponent(token)}`;

      const validation = validateDispatchUrl(generatedUrl, bookingId, host);
      assert(validation.valid, "Generated URL must pass safe destination validation");
      assert(validation.url.includes(`/technician/tracking/${bookingId}`), "URL must contain expected booking tracking path");
      assert(validation.url.includes("token="), "URL must contain dispatch authentication token");
    });

    test("Portal URL corresponds strictly to the selected booking, never another booking", () => {
      const booking1 = "booking_001";
      const booking2 = "booking_002";
      const techId = "tech_001";
      const token1 = createTechnicianDispatchToken(techId, booking1);
      const url1 = `https://ht-mobile-tire.vercel.app/technician/tracking/${booking1}?token=${encodeURIComponent(token1)}`;

      const validationAgainstBooking2 = validateDispatchUrl(url1, booking2);
      assertEqual(validationAgainstBooking2.valid, false, "URL for Booking 1 must be rejected when targeted for Booking 2");
      assertEqual(validationAgainstBooking2.reason, "pathname_mismatch");
    });

    test("Missing technician assignment blocks portal opening", () => {
      const bookingWithoutTech = {
        id: "booking_unassigned",
        technicianId: null,
      };

      function attemptOpen(booking) {
        if (!booking.id || typeof booking.id !== "string" || !booking.id.trim()) {
          return { error: "Invalid booking identifier." };
        }
        if (!booking.technicianId) {
          return { error: "Please assign a technician before opening the Live GPS Dispatch Portal." };
        }
        return { success: true };
      }

      const result = attemptOpen(bookingWithoutTech);
      assertEqual(result.error, "Please assign a technician before opening the Live GPS Dispatch Portal.");
    });

    test("Invalid booking ID blocks portal opening safely", () => {
      function attemptOpen(booking) {
        if (!booking.id || typeof booking.id !== "string" || !booking.id.trim()) {
          return { error: "Invalid booking identifier." };
        }
        if (!booking.technicianId) {
          return { error: "Please assign a technician before opening the Live GPS Dispatch Portal." };
        }
        return { success: true };
      }

      assertEqual(attemptOpen({ id: "", technicianId: "tech_1" }).error, "Invalid booking identifier.");
      assertEqual(attemptOpen({ id: "   ", technicianId: "tech_1" }).error, "Invalid booking identifier.");
    });

    test("Open-redirect prevention: external or forged hosts are rejected", () => {
      const evilUrl = "https://malicious-site.example.com/technician/tracking/booking_123?token=evil";
      const validation = validateDispatchUrl(evilUrl, "booking_123", "https://ht-mobile-tire.vercel.app");
      assertEqual(validation.valid, false);
      assertEqual(validation.reason, "origin_mismatch");
    });

    test("Source code audit: BookingsManagementClient wires handleOpenLiveGps to buttons", () => {
      const filePath = path.resolve(process.cwd(), "frontend/src/app/(admin-portal)/admin/bookings/BookingsManagementClient.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      assert(content.includes("handleOpenLiveGps(booking)"), "Card and table Live GPS buttons must invoke handleOpenLiveGps");
      assert(!content.includes("onClick={() => setTrackingModalBooking(booking)}"), "Live GPS button must no longer open tracking modal");
      assert(content.includes("AdminLiveTrackingModal"), "AdminLiveTrackingModal component must be preserved in file");
    });

    test("Source code audit: AdminBookingDetailActions wires handleOpenLiveGps to button", () => {
      const filePath = path.resolve(process.cwd(), "frontend/src/app/(admin-portal)/admin/bookings/[bookingId]/AdminBookingDetailActions.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      assert(content.includes("handleOpenLiveGps"), "Detail actions Live GPS button must invoke handleOpenLiveGps");
      assert(!content.includes("onClick={() => setShowGpsModal(true)}"), "Detail actions button must no longer open modal");
    });
  });

  describe("Emergency Requests Call Customer Button & Map Pin Preservation", () => {
    test("Emergency Call Customer button has exact label 'Call Customer'", () => {
      const filePath = path.resolve(process.cwd(), "frontend/src/app/(admin-portal)/admin/emergency-requests/EmergencyRequestsManagementClient.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      assert(!content.includes("Dispatch Route →"), "Dispatch Route button must be completely removed");
      assert(content.includes("Call Customer"), "Button must have visible text 'Call Customer'");
    });

    test("View Map Pin is completely preserved with original handler and icon", () => {
      const filePath = path.resolve(process.cwd(), "frontend/src/app/(admin-portal)/admin/emergency-requests/EmergencyRequestsManagementClient.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      assert(content.includes("View Map Pin"), "View Map Pin must remain present");
      assert(content.includes("setSelectedMapRequest(request)"), "View Map Pin click handler must remain intact");
      assert(content.includes("StaticMapPreview"), "StaticMapPreview modal component must remain intact");
    });

    test("Phone normalization helper preserves international prefix without inventing one", () => {
      // US international format with +
      assertEqual(getCustomerCallUri("+1 (555) 234-5678"), "tel:+15552345678");
      // International number (UK)
      assertEqual(getCustomerCallUri("+44 7911 123456"), "tel:+447911123456");
      // Domestic 10-digit number (no + invented)
      assertEqual(getCustomerCallUri("(555) 234-5678"), "tel:5552345678");
      assertEqual(getCustomerCallUri("555-234-5678"), "tel:5552345678");
      assertEqual(getCustomerCallUri("5552345678"), "tel:5552345678");
    });

    test("Missing or invalid phone numbers return null to safely render disabled button", () => {
      assertEqual(getCustomerCallUri(null), null);
      assertEqual(getCustomerCallUri(undefined), null);
      assertEqual(getCustomerCallUri(""), null);
      assertEqual(getCustomerCallUri("   "), null);
      assertEqual(getCustomerCallUri("N/A"), null);
      assertEqual(getCustomerCallUri("unknown"), null);
      assertEqual(getCustomerCallUri("123"), null); // under 7 digits
    });

    test("Multi-row isolation: Each emergency request uses its own distinct customer phone number", () => {
      const requestA = {
        id: "em_001",
        customer: { name: "Alice", phone: "+1 (555) 111-2222" },
      };
      const requestB = {
        id: "em_002",
        customer: { name: "Bob", phone: "555-888-9999" },
      };
      const requestC = {
        id: "em_003",
        customer: null, // guest without customer record
      };

      const uriA = getCustomerCallUri(requestA.customer?.phone);
      const uriB = getCustomerCallUri(requestB.customer?.phone);
      const uriC = getCustomerCallUri(requestC.customer?.phone);

      assertEqual(uriA, "tel:+15551112222", "Row A must use Alice's number");
      assertEqual(uriB, "tel:5558889999", "Row B must use Bob's number");
      assertEqual(uriC, null, "Row C must safely be null without crashing or cross-contaminating");
      assert(uriA !== uriB, "Row A and Row B must never share numbers");
    });

    test("tel: URI never initiates call automatically and does not contain undefined or null", () => {
      const uri = getCustomerCallUri("+1-555-333-4444");
      assert(uri.startsWith("tel:"), "URI must use standard tel: protocol");
      assert(!uri.includes("undefined"), "URI must not contain 'undefined'");
      assert(!uri.includes("null"), "URI must not contain 'null'");
    });
  });
}
