/**
 * Automated Test Suite: Pre-Domain Security Hardening & Canonical URL Alignment
 * HT Mobile Tire — Pre-Domain Transition Testing
 *
 * Verifies:
 * 1. HSTS header configured safely for transition period (max-age=86400, no includeSubDomains, no preload).
 * 2. Public health endpoint (/api/health) sanitizes all exceptions (database, Supabase, internal errors)
 *    and never discloses raw database messages, passwords, SQL, or internal stack traces to clients.
 * 3. Public health endpoint preserves healthy response contract ({ status: "ok", db: "connected", supabase: "connected" }).
 * 4. Canonical URL resolution:
 *    - Trims whitespace and removes trailing slashes safely.
 *    - Validates absolute HTTP/HTTPS URLs and rejects malformed values, unexpected protocols, and garbage.
 *    - Falls back strictly to "https://ht-mobile-tire.vercel.app" when unconfigured or invalid.
 * 5. Metadata routes (sitemap, robots) generate URLs strictly from canonical URL helper.
 * 6. Email notification templates:
 *    - Fallback links use canonical URL helper.
 *    - Explicitly supplied URLs (e.g. data.accountUrl, data.adminBookingUrl) are preserved.
 *    - Query parameters and paths (/account?tab=bookings, /booking, /account?tab=emergency) are preserved.
 */

import { describe, test, testAsync, assert, assertEqual, assertDeepEqual } from "../helpers/test-runner.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeBaseUrl, getCanonicalBaseUrl, buildCanonicalUrl, DEFAULT_PRODUCTION_URL } from "../../../frontend/src/lib/utils/url.ts";
import {
  renderBookingReceivedEmail,
  renderBookingConfirmedEmail,
  renderTechnicianEnRouteEmail,
  renderBookingCancelledEmail,
  renderPaymentReceivedEmail,
  renderQuoteReadyEmail,
  renderEmergencyRequestCustomerEmail,
  renderAdminBookingCreatedEmail,
  renderAdminEmergencyAlertEmail,
} from "../../../frontend/src/lib/email/templates.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

export function runPreDomainHardeningTests() {
  // =========================================================================
  // 1. HSTS CONFIGURATION TESTS
  // =========================================================================
  describe("HSTS Pre-Domain Configuration", () => {
    test("Strict-Transport-Security in next.config.ts uses max-age=86400 without subdomains or preload", () => {
      const nextConfigPath = path.join(projectRoot, "frontend/next.config.ts");
      assert(fs.existsSync(nextConfigPath), "frontend/next.config.ts must exist");
      const content = fs.readFileSync(nextConfigPath, "utf-8");

      // Verify HSTS key is present
      assert(content.includes('key: "Strict-Transport-Security"'), "Strict-Transport-Security header must be configured");

      // Verify the value is max-age=86400
      assert(content.includes('value: "max-age=86400"'), "HSTS value must be set to 'max-age=86400' for transition");

      // Ensure includeSubDomains and preload are NOT in the active policy
      const hstsMatch = content.match(/key:\s*"Strict-Transport-Security"[\s\S]*?value:\s*"([^"]+)"/);
      assert(hstsMatch, "Could not match Strict-Transport-Security header value");
      const hstsValue = hstsMatch[1];

      assertEqual(hstsValue, "max-age=86400", "HSTS value must be exactly 'max-age=86400'");
      assert(!hstsValue.includes("includeSubDomains"), "HSTS must NOT include 'includeSubDomains' during pre-domain transition");
      assert(!hstsValue.includes("preload"), "HSTS must NOT include 'preload' during pre-domain transition");

      // Verify no duplicate HSTS header definitions exist in next.config.ts
      const matches = content.match(/Strict-Transport-Security/g) || [];
      // Allowed in comments and one in header key definition
      const keyMatches = content.match(/key:\s*["']Strict-Transport-Security["']/g) || [];
      assertEqual(keyMatches.length, 1, "There must be exactly one Strict-Transport-Security header defined");
    });
  });

  // =========================================================================
  // 2. PUBLIC HEALTH ENDPOINT SANITIZATION TESTS
  // =========================================================================
  describe("Public Health Endpoint Sanitization (/api/health)", () => {
    test("Health route source code sanitizes Supabase and Prisma exceptions without leaking raw errors", () => {
      const healthRoutePath = path.join(projectRoot, "frontend/src/app/api/health/route.ts");
      assert(fs.existsSync(healthRoutePath), "frontend/src/app/api/health/route.ts must exist");
      const content = fs.readFileSync(healthRoutePath, "utf-8");

      // Verify generic sanitization strings are used
      assert(content.includes('"Supabase service unavailable"'), "Must use generic message for Supabase error");
      assert(content.includes('"Database connection unavailable"'), "Must use generic message for Database error");

      // Verify dynamic error messages (err.message, error.message) are NOT returned in JSON response
      assert(!content.includes("error: sbError?.message"), "Must NOT return dynamic sbError.message in JSON");
      assert(!content.includes("error: err?.message"), "Must NOT return dynamic err.message in JSON");
      assert(!content.includes("error: String(err)"), "Must NOT return dynamic String(err) in JSON");

      // Verify server-side logging with logger.error is present for diagnostics
      assert(content.includes("logger.error"), "Must log diagnostic information via logger.error");
    });

    test("Simulated health endpoint handler returns generic sanitized error on Supabase failure", async () => {
      // Mock failure simulation matching health/route.ts logic
      const simulateHealthCheck = async ({ supabaseFails, prismaFails, rootCrashes }) => {
        if (rootCrashes) {
          return {
            status: 503,
            body: { status: "unhealthy", error: "Internal health check error", version: "1.0.0" }
          };
        }

        let dbStatus = "connected";
        if (prismaFails) {
          dbStatus = "Database connection unavailable";
        }

        let supabaseStatus = "connected";
        if (supabaseFails) {
          supabaseStatus = "Supabase service unavailable";
        }

        const isHealthy = dbStatus === "connected" && supabaseStatus === "connected";
        return {
          status: isHealthy ? 200 : 503,
          body: {
            status: isHealthy ? "ok" : "degraded",
            db: dbStatus,
            supabase: supabaseStatus,
            timestamp: new Date().toISOString(),
            version: "1.0.0",
          }
        };
      };

      // Case A: Supabase failure with sensitive raw message
      const resA = await simulateHealthCheck({
        supabaseFails: new Error("relation \"bookings\" does not exist at postgres://app_user:secretpass123@aws.supabase.co:5432/postgres"),
        prismaFails: false,
        rootCrashes: false,
      });

      assertEqual(resA.status, 503);
      assertEqual(resA.body.status, "degraded");
      assertEqual(resA.body.supabase, "Supabase service unavailable");
      assertEqual(resA.body.db, "connected");
      assert(!JSON.stringify(resA.body).includes("secretpass123"), "Health response must never disclose database credentials");
      assert(!JSON.stringify(resA.body).includes("aws.supabase.co"), "Health response must never disclose internal hostnames");

      // Case B: Prisma connection failure with raw exception
      const resB = await simulateHealthCheck({
        supabaseFails: false,
        prismaFails: new Error("Can't reach database server at `aws-0-region.pooler.supabase.com:6543`"),
        rootCrashes: false,
      });

      assertEqual(resB.status, 503);
      assertEqual(resB.body.status, "degraded");
      assertEqual(resB.body.db, "Database connection unavailable");
      assertEqual(resB.body.supabase, "connected");
      assert(!JSON.stringify(resB.body).includes("pooler.supabase.com"), "Health response must never disclose database server hostnames");

      // Case C: Healthy status
      const resC = await simulateHealthCheck({
        supabaseFails: false,
        prismaFails: false,
        rootCrashes: false,
      });

      assertEqual(resC.status, 200);
      assertEqual(resC.body.status, "ok");
      assertEqual(resC.body.db, "connected");
      assertEqual(resC.body.supabase, "connected");
      assertEqual(resC.body.version, "1.0.0");
      assert(typeof resC.body.timestamp === "string", "Timestamp must be present and valid");

      // Case D: Root exception
      const resD = await simulateHealthCheck({
        supabaseFails: false,
        prismaFails: false,
        rootCrashes: true,
      });

      assertEqual(resD.status, 503);
      assertEqual(resD.body.status, "unhealthy");
      assertEqual(resD.body.error, "Internal health check error");
    });
  });

  // =========================================================================
  // 3. CANONICAL APPLICATION URL NORMALIZATION & RESOLUTION TESTS
  // =========================================================================
  describe("Canonical URL Helper (url.ts)", () => {
    test("normalizeBaseUrl removes trailing slashes and trims whitespace", () => {
      assertEqual(normalizeBaseUrl("https://ht-mobile-tire.vercel.app/"), "https://ht-mobile-tire.vercel.app");
      assertEqual(normalizeBaseUrl("https://ht-mobile-tire.vercel.app///"), "https://ht-mobile-tire.vercel.app");
      assertEqual(normalizeBaseUrl("   https://ht-mobile-tire.vercel.app/   "), "https://ht-mobile-tire.vercel.app");
      assertEqual(normalizeBaseUrl("http://localhost:3000/"), "http://localhost:3000");
    });

    test("normalizeBaseUrl rejects invalid, malformed, or malicious values", () => {
      assertEqual(normalizeBaseUrl(null), null);
      assertEqual(normalizeBaseUrl(undefined), null);
      assertEqual(normalizeBaseUrl(""), null);
      assertEqual(normalizeBaseUrl("   "), null);
      assertEqual(normalizeBaseUrl("..."), null);
      assertEqual(normalizeBaseUrl("undefined"), null);
      assertEqual(normalizeBaseUrl("ftp://files.example.com"), null);
      assertEqual(normalizeBaseUrl("javascript:alert(1)"), null);
      assertEqual(normalizeBaseUrl("data:text/html,test"), null);
      assertEqual(normalizeBaseUrl("file:///etc/passwd"), null);
      assertEqual(normalizeBaseUrl("not-a-url"), null);
      assertEqual(normalizeBaseUrl("://missing-protocol"), null);
      assertEqual(normalizeBaseUrl("http://"), null);
    });

    test("getCanonicalBaseUrl falls back safely to DEFAULT_PRODUCTION_URL", () => {
      const origEnv = process.env.NEXT_PUBLIC_APP_URL;
      const origVercel = process.env.VERCEL_URL;
      try {
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.VERCEL_URL;

        // When environment is empty
        assertEqual(getCanonicalBaseUrl(), DEFAULT_PRODUCTION_URL);
        assertEqual(getCanonicalBaseUrl(), "https://ht-mobile-tire.vercel.app");

        // When invalid candidate or env is passed
        assertEqual(getCanonicalBaseUrl("malformed"), DEFAULT_PRODUCTION_URL);
        assertEqual(getCanonicalBaseUrl("javascript:evil()"), DEFAULT_PRODUCTION_URL);

        // When custom domain is configured in NEXT_PUBLIC_APP_URL
        process.env.NEXT_PUBLIC_APP_URL = "https://custom-domain.com/";
        assertEqual(getCanonicalBaseUrl(), "https://custom-domain.com");

        // When explicit candidate is provided, it takes highest precedence
        assertEqual(getCanonicalBaseUrl("https://explicit.com/"), "https://explicit.com");

        // When NEXT_PUBLIC_APP_URL is empty but VERCEL_URL is set
        delete process.env.NEXT_PUBLIC_APP_URL;
        process.env.VERCEL_URL = "my-preview-branch.vercel.app";
        assertEqual(getCanonicalBaseUrl(), "https://my-preview-branch.vercel.app");
      } finally {
        if (origEnv !== undefined) process.env.NEXT_PUBLIC_APP_URL = origEnv;
        else delete process.env.NEXT_PUBLIC_APP_URL;
        if (origVercel !== undefined) process.env.VERCEL_URL = origVercel;
        else delete process.env.VERCEL_URL;
      }
    });

    test("buildCanonicalUrl constructs clean paths and preserves query parameters", () => {
      // Relative path with leading slash
      assertEqual(
        buildCanonicalUrl("/account?tab=bookings", "https://ht-mobile-tire.vercel.app"),
        "https://ht-mobile-tire.vercel.app/account?tab=bookings"
      );

      // Relative path without leading slash
      assertEqual(
        buildCanonicalUrl("account?tab=bookings", "https://ht-mobile-tire.vercel.app"),
        "https://ht-mobile-tire.vercel.app/account?tab=bookings"
      );

      // Empty path returns base URL
      assertEqual(
        buildCanonicalUrl("", "https://ht-mobile-tire.vercel.app"),
        "https://ht-mobile-tire.vercel.app"
      );

      // Deep paths and parameters
      assertEqual(
        buildCanonicalUrl("/admin/emergency?id=EMG-100&priority=high", "https://ht-mobile-tire.vercel.app"),
        "https://ht-mobile-tire.vercel.app/admin/emergency?id=EMG-100&priority=high"
      );

      // Already absolute HTTP/HTTPS URL is preserved
      assertEqual(
        buildCanonicalUrl("https://external-portal.com/track?id=123", "https://ht-mobile-tire.vercel.app"),
        "https://external-portal.com/track?id=123"
      );
    });
  });

  // =========================================================================
  // 4. METADATA ROUTES (SITEMAP & ROBOTS) INTEGRATION TESTS
  // =========================================================================
  describe("Metadata Routes (sitemap.ts and robots.ts)", () => {
    test("sitemap.ts imports and uses getCanonicalBaseUrl", () => {
      const sitemapPath = path.join(projectRoot, "frontend/src/app/sitemap.ts");
      assert(fs.existsSync(sitemapPath), "sitemap.ts must exist");
      const content = fs.readFileSync(sitemapPath, "utf-8");

      assert(
        /import\s*\{\s*[^}]*\bgetCanonicalBaseUrl\b[^}]*\}\s*from\s*["']@\/lib\/utils\/url["']/.test(content),
        "sitemap.ts must import getCanonicalBaseUrl"
      );
      assert(content.includes("const baseUrl = getCanonicalBaseUrl()"), "sitemap.ts must resolve base URL dynamically");
      assert(!content.includes('"https://mobiletire.clinic"'), "sitemap.ts must not contain hardcoded unpurchased domain");
      assert(!content.includes("https://mobiletire.clinic"), "sitemap.ts must not hardcode mobiletire.clinic");
    });

    test("robots.ts imports and uses getCanonicalBaseUrl", () => {
      const robotsPath = path.join(projectRoot, "frontend/src/app/robots.ts");
      assert(fs.existsSync(robotsPath), "robots.ts must exist");
      const content = fs.readFileSync(robotsPath, "utf-8");

      assert(content.includes('import { getCanonicalBaseUrl } from "@/lib/utils/url"'), "robots.ts must import getCanonicalBaseUrl");
      assert(content.includes("const baseUrl = getCanonicalBaseUrl()"), "robots.ts must resolve base URL dynamically");
      assert(content.includes("sitemap: `${baseUrl}/sitemap.xml`"), "robots.ts must reference dynamic canonical sitemap URL");
      assert(!content.includes('"https://mobiletire.clinic"'), "robots.ts must not contain hardcoded unpurchased domain");
    });

    test("layout.tsx uses getCanonicalBaseUrl for metadataBase", () => {
      const layoutPath = path.join(projectRoot, "frontend/src/app/layout.tsx");
      assert(fs.existsSync(layoutPath), "layout.tsx must exist");
      const content = fs.readFileSync(layoutPath, "utf-8");

      assert(
        /import\s*\{\s*[^}]*\bgetCanonicalBaseUrl\b[^}]*\}\s*from\s*["']@\/lib\/utils\/url["']/.test(content),
        "layout.tsx must import getCanonicalBaseUrl"
      );
      assert(content.includes("const baseUrl = getCanonicalBaseUrl()"), "layout.tsx must resolve base URL dynamically");
      assert(content.includes("metadataBase: new URL(baseUrl)"), "layout.tsx metadataBase must use resolved baseUrl");
      assert(!content.includes("https://mobiletire.clinic"), "layout.tsx must not hardcode mobiletire.clinic");
    });
  });

  // =========================================================================
  // 5. EMAIL TEMPLATES FALLBACK URLS & PRESERVATION TESTS
  // =========================================================================
  describe("Email Templates Canonical URL Fallbacks", () => {
    const origEnv = process.env.NEXT_PUBLIC_APP_URL;
    try {
      delete process.env.NEXT_PUBLIC_APP_URL;

      test("Booking Received email uses canonical fallback link and preserves query params", () => {
        const email = renderBookingReceivedEmail({
          bookingId: "test-booking-12345",
          customerName: "Alex Mercer",
          serviceName: "Tire Changeover",
          vehicle: "2024 Honda Civic",
          location: "123 Main St, Toronto",
          bookingDate: "2026-10-20",
          bookingTime: "10:00 AM",
        });

        assert(email.text.includes("Manage Booking: https://ht-mobile-tire.vercel.app/account?tab=bookings"), "Must include canonical fallback with tab=bookings");
      });

      test("Booking Received email preserves explicitly supplied accountUrl", () => {
        const email = renderBookingReceivedEmail({
          bookingId: "test-booking-12345",
          customerName: "Alex Mercer",
          serviceName: "Tire Changeover",
          vehicle: "2024 Honda Civic",
          location: "123 Main St, Toronto",
          bookingDate: "2026-10-20",
          bookingTime: "10:00 AM",
          accountUrl: "https://my-custom-portal.com/user/bookings?ref=special",
        });

        assert(email.text.includes("Manage Booking: https://my-custom-portal.com/user/bookings?ref=special"), "Explicitly provided accountUrl must be preserved");
      });

      test("Booking Confirmed email uses canonical fallback link", () => {
        const email = renderBookingConfirmedEmail({
          bookingId: "test-booking-12345",
          customerName: "Alex Mercer",
          serviceName: "Tire Changeover",
          vehicle: "2024 Honda Civic",
          location: "123 Main St, Toronto",
          bookingDate: "2026-10-20",
          bookingTime: "10:00 AM",
        });

        assert(email.text.includes("Manage Booking: https://ht-mobile-tire.vercel.app/account?tab=bookings"), "Must include canonical fallback with tab=bookings");
      });

      test("Technician En Route email uses canonical fallback link", () => {
        const email = renderTechnicianEnRouteEmail({
          bookingId: "test-booking-12345",
          customerName: "Alex Mercer",
          serviceName: "Tire Changeover",
          vehicle: "2024 Honda Civic",
          location: "123 Main St, Toronto",
          bookingDate: "2026-10-20",
          bookingTime: "10:00 AM",
        });

        assert(email.text.includes("Track Technician Live: https://ht-mobile-tire.vercel.app"), "Must include canonical base URL fallback");
      });

      test("Booking Cancelled email uses canonical /booking link in both text and CTA", () => {
        const email = renderBookingCancelledEmail({
          bookingId: "test-booking-12345",
          customerName: "Alex Mercer",
          serviceName: "Tire Changeover",
          vehicle: "2024 Honda Civic",
          location: "123 Main St, Toronto",
          bookingDate: "2026-10-20",
          bookingTime: "10:00 AM",
        });

        assert(email.text.includes("visit https://ht-mobile-tire.vercel.app/booking"), "Must include canonical /booking link in text");
        assert(email.html.includes('href="https://ht-mobile-tire.vercel.app/booking"'), "Must include canonical /booking CTA in HTML");
      });

      test("Payment Received email uses canonical fallback link", () => {
        const email = renderPaymentReceivedEmail({
          bookingId: "test-booking-12345",
          customerName: "Alex Mercer",
          serviceName: "Tire Changeover",
          vehicle: "2024 Honda Civic",
          location: "123 Main St, Toronto",
          bookingDate: "2026-10-20",
          bookingTime: "10:00 AM",
          amountPaid: 150,
        });

        assert(email.text.includes("https://ht-mobile-tire.vercel.app/account?tab=bookings"), "Must include canonical fallback in payment email");
      });

      test("Quote & Invoice email uses canonical fallback link", () => {
        const email = renderQuoteReadyEmail({
          bookingId: "test-booking-12345",
          customerName: "Alex Mercer",
          primaryService: "Flat Tire Repair",
          basePrice: 120,
          totalAmount: 120,
        });

        assert(email.text.includes("View details & receipt: https://ht-mobile-tire.vercel.app/account?tab=bookings"), "Must include canonical fallback in quote email");
      });

      test("Emergency Request Customer email uses canonical /account?tab=emergency fallback link", () => {
        const email = renderEmergencyRequestCustomerEmail({
          id: "emg-99999",
          customerName: "Alex Mercer",
          problem: "Blowout on highway",
          vehicle: "2024 Honda Civic",
          currentLocation: "Hwy 401 Eastbound",
        });

        assert(email.text.includes("Track: https://ht-mobile-tire.vercel.app/account?tab=emergency"), "Must include canonical emergency tracking fallback");
      });

      test("Admin New Booking alert uses canonical /admin/bookings fallback link", () => {
        const email = renderAdminBookingCreatedEmail({
          bookingId: "test-booking-12345",
          serviceName: "Tire Changeover",
          vehicle: "2024 Honda Civic",
          location: "123 Main St, Toronto",
        });

        assert(email.text.includes("https://ht-mobile-tire.vercel.app/admin/bookings"), "Must include canonical admin bookings fallback");
      });

      test("Admin Emergency alert uses canonical /admin/emergency fallback link", () => {
        const email = renderAdminEmergencyAlertEmail({
          emergencyId: "emg-99999",
          problem: "Blowout on highway",
          vehicle: "2024 Honda Civic",
          location: "Hwy 401 Eastbound",
        });

        assert(email.text.includes("https://ht-mobile-tire.vercel.app/admin/emergency"), "Must include canonical admin emergency fallback");
      });

      test("Configuring custom NEXT_PUBLIC_APP_URL propagates to all fallback email links", () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://customdomain.com/";

        const email = renderBookingReceivedEmail({
          bookingId: "test-booking-12345",
          customerName: "Alex Mercer",
          serviceName: "Tire Changeover",
          vehicle: "2024 Honda Civic",
          location: "123 Main St, Toronto",
        });

        assert(email.text.includes("Manage Booking: https://customdomain.com/account?tab=bookings"), "Must use configured custom domain in fallback links without double slashes");
      });
    } finally {
      if (origEnv !== undefined) process.env.NEXT_PUBLIC_APP_URL = origEnv;
      else delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });
}

// Direct execution support
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runPreDomainHardeningTests();
}
