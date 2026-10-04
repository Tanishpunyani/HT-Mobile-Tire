/**
 * Unit Tests: Emergency Notification Rendering & HTML Sanitization
 * HT Mobile Services
 *
 * Verifies that:
 * 1. HTML email body does NOT appear as raw HTML markup.
 * 2. Meaningful text from email HTML (problem, vehicle, location, ETA) is cleanly extracted.
 * 3. Plain-text notification bodies still display correctly without alteration.
 * 4. Empty / null / undefined bodies do not crash and handle gracefully.
 * 5. Malicious scripts, event handlers, and injected HTML are stripped (XSS safe).
 * 6. Existing emergency notification history structures remain accessible and render cleanly.
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import { formatNotificationBody } from "../../../frontend/src/lib/utils/format-notification.ts";
import { renderEmergencyRequestCustomerEmail } from "../../../frontend/src/lib/email/templates.ts";

export function runEmergencyNotificationRenderingTests() {
  describe("Emergency Notification Rendering & Sanitization (Unit)", () => {
    test("HTML email body does NOT appear as raw HTML markup", () => {
      const email = renderEmergencyRequestCustomerEmail({
        id: "em_abc123456789",
        customerName: "Alice Smith",
        problem: "Flat tire on highway",
        problemDetails: "Right rear tire punctured",
        vehicle: "2023 Honda Civic",
        currentLocation: "I-35 Exit 428, Dallas TX",
      });

      const formatted = formatNotificationBody(email.html);

      // Must not contain any HTML document shells, head, or tags
      assert(!formatted.includes("<!DOCTYPE"), "Must not contain DOCTYPE");
      assert(!formatted.includes("<html"), "Must not contain <html>");
      assert(!formatted.includes("<head"), "Must not contain <head>");
      assert(!formatted.includes("<style"), "Must not contain <style>");
      assert(!formatted.includes("</style>"), "Must not contain </style>");
      assert(!formatted.includes("<table"), "Must not contain <table>");
      assert(!formatted.includes("<div"), "Must not contain <div>");
      assert(!formatted.includes("<p>"), "Must not contain <p>");
      assert(!formatted.includes("class="), "Must not contain CSS classes");
      assert(!formatted.includes("background-color"), "Must not contain inline CSS");
    });

    test("Meaningful text from HTML email is cleanly extracted and formatted", () => {
      const email = renderEmergencyRequestCustomerEmail({
        id: "em_abc123456789",
        customerName: "Alice Smith",
        problem: "Blowout on highway",
        problemDetails: "Stuck on right shoulder near Exit 428",
        vehicle: "2023 Toyota RAV4 Grey",
        currentLocation: "US-75 & Spring Valley Rd",
      });

      const formatted = formatNotificationBody(email.html);

      // Core dispatch information must be present
      assert(formatted.includes("Estimated Arrival: 30–45 Minutes"), "Must include estimated arrival");
      assert(formatted.includes("Alice Smith"), "Must include customer name");
      assert(formatted.includes("Blowout on highway"), "Must include problem");
      assert(formatted.includes("2023 Toyota RAV4 Grey"), "Must include vehicle");
      assert(formatted.includes("US-75 & Spring Valley Rd"), "Must include location");
      assert(formatted.includes("Stuck on right shoulder near Exit 428"), "Must include problem details");
    });

    test("Plain-text notification body still displays correctly without modification", () => {
      const plainSms = "Technician Mike is 10 minutes away in Van #4. Please stay safely inside vehicle.";
      const formatted = formatNotificationBody(plainSms);
      assertEqual(formatted, plainSms);

      const multilineText = "Roadside Dispatch Update:\nTechnician assigned: Carlos\nETA: 15 mins";
      const formattedMulti = formatNotificationBody(multilineText);
      assertEqual(formattedMulti, multilineText);
    });

    test("Empty, null, or undefined body handles gracefully without crashing", () => {
      assertEqual(formatNotificationBody(""), "");
      assertEqual(formatNotificationBody("   "), "");
      assertEqual(formatNotificationBody(null), "");
      assertEqual(formatNotificationBody(undefined), "");
      assertEqual(formatNotificationBody(123), "");
      assertEqual(formatNotificationBody({}), "");
    });

    test("Malicious script and event handler tags are stripped safely (XSS protection)", () => {
      const maliciousHtml = `
        <div>
          <script>alert("XSS Attack!");</script>
          <img src="x" onerror="window.location='https://attacker.com'" />
          <a href="javascript:alert(1)">Click for voucher</a>
          <p>Valid dispatcher message: Stay in your car.</p>
          <iframe src="https://evil.com"></iframe>
          <object data="evil.swf"></object>
        </div>
      `;

      const formatted = formatNotificationBody(maliciousHtml);

      assert(!formatted.includes("<script>"), "Must strip script tag");
      assert(!formatted.includes("XSS Attack"), "Must remove script content");
      assert(!formatted.includes("onerror"), "Must strip event handlers");
      assert(!formatted.includes("<img"), "Must strip img tag");
      assert(!formatted.includes("<iframe"), "Must strip iframe tag");
      assert(!formatted.includes("<object"), "Must strip object tag");
      assert(formatted.includes("Valid dispatcher message: Stay in your car."), "Must keep legitimate message text");
    });

    test("Existing emergency notification history data structure renders cleanly", () => {
      const mockEmergencyLogs = [
        {
          id: "log_1",
          subject: "[EMERGENCY DISPATCH] Help is On The Way",
          body: renderEmergencyRequestCustomerEmail({
            id: "em_1",
            customerName: "Bob Jones",
            problem: "Tire Leak",
            vehicle: "Ford F-150",
            currentLocation: "Plano, TX",
          }).html,
          createdAt: new Date().toISOString(),
        },
        {
          id: "log_2",
          subject: "Technician Update",
          body: "Technician van has arrived at breakdown coordinates.",
          createdAt: new Date().toISOString(),
        },
      ];

      // Test mapping across history records as done in the account UI
      const renderedHistory = mockEmergencyLogs.map((log) => ({
        id: log.id,
        displayText: formatNotificationBody(log.body) || log.subject,
      }));

      assertEqual(renderedHistory.length, 2);
      assert(!renderedHistory[0].displayText.includes("<!DOCTYPE"), "HTML log must not contain DOCTYPE");
      assert(renderedHistory[0].displayText.includes("Tire Leak"), "HTML log must contain problem");
      assertEqual(renderedHistory[1].displayText, "Technician van has arrived at breakdown coordinates.");
    });
  });
}
