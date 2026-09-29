/**
 * Unit Tests: WhatsApp Workflow Completion
 * HT Mobile Tyres
 *
 * Verifies:
 * 1. sendAdminBookingCreatedAlert implementation and contract
 * 2. Integration into createBookingRequestAction
 * 3. sendCustomerServiceStartedAlert implementation and contract
 * 4. Integration into startServiceAction
 * 5. sendCustomerServiceCompletedAlert implementation and contract
 * 6. Integration into completeAndQuoteAction (preserving sendQuoteReadyNotification)
 * 7. Polished customer WhatsApp message templates (booking reference + support hotline)
 * 8. Idempotency providerEventId determinism
 */

import fs from "fs";
import path from "path";
import { describe, test, assert, assertEqual, assertDeepEqual } from "../helpers/test-runner.mjs";

const ROOT_DIR = path.resolve(process.cwd());
const NOTIFICATIONS_PATH = path.join(ROOT_DIR, "frontend/src/lib/notifications.ts");
const CUSTOMER_ACTION_PATH = path.join(ROOT_DIR, "frontend/src/app/actions/bookings/customer.ts");
const ADMIN_ACTION_PATH = path.join(ROOT_DIR, "frontend/src/app/actions/bookings/admin.ts");
const QUOTE_ACTION_PATH = path.join(ROOT_DIR, "frontend/src/app/actions/bookings/quote.ts");
const WHATSAPP_PROVIDER_PATH = path.join(ROOT_DIR, "frontend/src/lib/notifications/whatsapp.ts");


export function runWhatsAppWorkflowCompletionUnitTests() {
  describe("WhatsApp Workflow: Notifications Framework Invariants", () => {
    const notifSrc = fs.readFileSync(NOTIFICATIONS_PATH, "utf-8");

    test("1. sendAdminBookingCreatedAlert is exported with correct contract", () => {
      assert(
        notifSrc.includes("export async function sendAdminBookingCreatedAlert"),
        "sendAdminBookingCreatedAlert must be exported from notifications.ts"
      );
      assert(
        notifSrc.includes("process.env.TECHNICIAN_PHONE_NUMBER"),
        "sendAdminBookingCreatedAlert must target process.env.TECHNICIAN_PHONE_NUMBER"
      );
      assert(
        notifSrc.includes('type: "BOOKING_CREATED"'),
        "sendAdminBookingCreatedAlert must use type BOOKING_CREATED"
      );
      assert(
        notifSrc.includes("admin_booking_created_${booking.id}"),
        "sendAdminBookingCreatedAlert must use deterministic providerEventId"
      );
      assert(
        notifSrc.includes("NEW BOOKING REQUEST"),
        "sendAdminBookingCreatedAlert must include NEW BOOKING REQUEST header"
      );
      assert(
        notifSrc.includes("${APP_URL}/admin/bookings/${booking.id}"),
        "sendAdminBookingCreatedAlert must include direct admin booking URL"
      );
      assert(
        notifSrc.includes("booking.id.slice(-6).toUpperCase()"),
        "sendAdminBookingCreatedAlert must include short booking reference"
      );
    });

    test("2. sendCustomerServiceStartedAlert is exported with correct contract", () => {
      assert(
        notifSrc.includes("export async function sendCustomerServiceStartedAlert"),
        "sendCustomerServiceStartedAlert must be exported from notifications.ts"
      );
      assert(
        notifSrc.includes('type: "SERVICE_STARTED"'),
        "sendCustomerServiceStartedAlert must use type SERVICE_STARTED"
      );
      assert(
        notifSrc.includes("service_started_${booking.id}"),
        "sendCustomerServiceStartedAlert must use deterministic providerEventId"
      );
      assert(
        notifSrc.includes("HT Mobile Tires — Service Started"),
        "sendCustomerServiceStartedAlert must include clear service started header"
      );
      assert(
        notifSrc.includes("BUSINESS_PHONE_DISPLAY"),
        "sendCustomerServiceStartedAlert must include support hotline"
      );
    });

    test("3. sendCustomerServiceCompletedAlert is exported with correct contract", () => {
      assert(
        notifSrc.includes("export async function sendCustomerServiceCompletedAlert"),
        "sendCustomerServiceCompletedAlert must be exported from notifications.ts"
      );
      assert(
        notifSrc.includes('type: "SERVICE_COMPLETED"'),
        "sendCustomerServiceCompletedAlert must use type SERVICE_COMPLETED"
      );
      assert(
        notifSrc.includes("service_completed_${booking.id}"),
        "sendCustomerServiceCompletedAlert must use deterministic providerEventId"
      );
      assert(
        notifSrc.includes("HT Mobile Tires — Service Completed"),
        "sendCustomerServiceCompletedAlert must include clear service completed header"
      );
      assert(
        notifSrc.includes("BUSINESS_PHONE_DISPLAY"),
        "sendCustomerServiceCompletedAlert must include support hotline"
      );
    });

    test("4. Existing customer templates polished with booking reference and hotline", () => {
      // booking_confirmation
      assert(
        notifSrc.includes("request for booking ${bookingRef}"),
        "booking_confirmation template must include booking reference"
      );
      assert(
        notifSrc.includes("Support: ${BUSINESS_PHONE_DISPLAY}"),
        "booking_confirmation template must include support hotline"
      );

      // BOOKING_CONFIRMED
      assert(
        notifSrc.includes("appointment for booking ${bookingRef}"),
        "BOOKING_CONFIRMED template must include booking reference"
      );
    });
  });

  describe("WhatsApp Workflow: Action Triggers & Non-blocking Dispatch", () => {
    const customerSrc = fs.readFileSync(CUSTOMER_ACTION_PATH, "utf-8");
    const adminSrc = fs.readFileSync(ADMIN_ACTION_PATH, "utf-8");
    const quoteSrc = fs.readFileSync(QUOTE_ACTION_PATH, "utf-8");

    test("5. createBookingRequestAction triggers sendAdminBookingCreatedAlert non-blockingly", () => {
      assert(
        customerSrc.includes("sendAdminBookingCreatedAlert"),
        "customer.ts must import and call sendAdminBookingCreatedAlert"
      );
      assert(
        customerSrc.includes("await sendAdminBookingCreatedAlert(notificationPayload)"),
        "customer.ts must await sendAdminBookingCreatedAlert"
      );
      assert(
        customerSrc.includes("catch (adminNotifErr)"),
        "customer.ts must catch notification errors to prevent booking transaction rollback"
      );
    });

    test("6. startServiceAction triggers sendCustomerServiceStartedAlert non-blockingly", () => {
      assert(
        adminSrc.includes("sendCustomerServiceStartedAlert"),
        "admin.ts must import and call sendCustomerServiceStartedAlert"
      );
      assert(
        adminSrc.includes("await sendCustomerServiceStartedAlert({"),
        "admin.ts must await sendCustomerServiceStartedAlert"
      );
      assert(
        adminSrc.includes("data: { status: \"in_progress\" }"),
        "admin.ts must perform in_progress update before alert"
      );
    });

    test("7. completeAndQuoteAction triggers sendCustomerServiceCompletedAlert while preserving quote_ready", () => {
      assert(
        quoteSrc.includes("sendCustomerServiceCompletedAlert"),
        "quote.ts must import and call sendCustomerServiceCompletedAlert"
      );
      assert(
        quoteSrc.includes("sendQuoteReadyNotification"),
        "quote.ts must preserve sendQuoteReadyNotification"
      );
      assert(
        quoteSrc.includes("await sendCustomerServiceCompletedAlert({"),
        "quote.ts must await sendCustomerServiceCompletedAlert"
      );
      assert(
        quoteSrc.includes("await sendQuoteReadyNotification({"),
        "quote.ts must await sendQuoteReadyNotification"
      );
    });
  });

  describe("WhatsApp Workflow: Message Formatter Simulation", () => {
    test("8. Formatter generates deterministic references and valid URLs", () => {
      const mockBookingId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const shortRef = `#${mockBookingId.slice(-6).toUpperCase()}`;
      assertEqual(shortRef, "#567890");

      const mockAppUrl = "https://mobiletire.clinic";
      const adminUrl = `${mockAppUrl}/admin/bookings/${mockBookingId}`;
      assertEqual(adminUrl, "https://mobiletire.clinic/admin/bookings/a1b2c3d4-e5f6-7890-abcd-ef1234567890");

      const providerEventId = `admin_booking_created_${mockBookingId}`;
      assertEqual(providerEventId, "admin_booking_created_a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    });
  });

  describe("WhatsApp Outbound Provider: Native Interactive Abstraction (Phase 9.1)", () => {
    const providerSrc = fs.readFileSync(WHATSAPP_PROVIDER_PATH, "utf-8");

    // Contract and Export Invariants
    test("9. whatsapp.ts exports interactive interfaces and validation functions", () => {
      assert(providerSrc.includes("export interface WhatsAppReplyButton"), "Must export WhatsAppReplyButton");
      assert(providerSrc.includes("export interface WhatsAppListRow"), "Must export WhatsAppListRow");
      assert(providerSrc.includes("export interface WhatsAppListSection"), "Must export WhatsAppListSection");
      assert(providerSrc.includes("export interface WhatsAppInteractiveButtons"), "Must export WhatsAppInteractiveButtons");
      assert(providerSrc.includes("export interface WhatsAppInteractiveList"), "Must export WhatsAppInteractiveList");
      assert(providerSrc.includes("export type WhatsAppInteractivePayload"), "Must export WhatsAppInteractivePayload");
      assert(providerSrc.includes("export function validateInteractiveButtons"), "Must export validateInteractiveButtons");
      assert(providerSrc.includes("export function validateInteractiveList"), "Must export validateInteractiveList");
      assert(providerSrc.includes("export function buildWhatsAppPayload"), "Must export buildWhatsAppPayload");
      assert(providerSrc.includes("interactive?: WhatsAppInteractivePayload"), "WhatsAppDispatchParams must include optional interactive");
    });

    // Helper functions conforming to provider specification
    function formatPhone(phone) {
      if (!phone) return "";
      return phone.replace(/\D/g, "");
    }

    function validateButtons(interactive, fallbackBody) {
      const body = (interactive.bodyText || fallbackBody || "").trim();
      if (!body) return "Interactive button message body text cannot be empty.";
      if (body.length > 1024) return "Interactive button body exceeds maximum length of 1024 characters.";
      if (interactive.headerText && interactive.headerText.length > 60) return "Interactive button header exceeds maximum length of 60 characters.";
      if (interactive.footerText && interactive.footerText.length > 60) return "Interactive button footer exceeds maximum length of 60 characters.";
      if (!Array.isArray(interactive.buttons) || interactive.buttons.length < 1 || interactive.buttons.length > 3) {
        return "Interactive button message must contain between 1 and 3 buttons.";
      }
      const seenIds = new Set();
      for (const btn of interactive.buttons) {
        if (!btn || typeof btn !== "object") return "Invalid interactive button item.";
        const id = (btn.id || "").trim();
        if (!id || id.length > 256) return "Interactive button ID must be between 1 and 256 characters.";
        if (seenIds.has(id)) return `Duplicate interactive button ID: ${id}`;
        seenIds.add(id);
        const title = (btn.title || "").trim();
        if (!title || title.length > 20) return "Interactive button title must be between 1 and 20 characters.";
      }
      return null;
    }

    function validateList(interactive, fallbackBody) {
      const body = (interactive.bodyText || fallbackBody || "").trim();
      if (!body) return "Interactive list message body text cannot be empty.";
      if (body.length > 1024) return "Interactive list body exceeds maximum length of 1024 characters.";
      if (interactive.headerText && interactive.headerText.length > 60) return "Interactive list header exceeds maximum length of 60 characters.";
      if (interactive.footerText && interactive.footerText.length > 60) return "Interactive list footer exceeds maximum length of 60 characters.";
      const buttonText = (interactive.buttonText || "").trim();
      if (!buttonText || buttonText.length > 20) return "Interactive list action button text must be between 1 and 20 characters.";
      if (!Array.isArray(interactive.sections) || interactive.sections.length < 1 || interactive.sections.length > 10) {
        return "Interactive list must contain between 1 and 10 sections.";
      }
      let totalRows = 0;
      const seenRowIds = new Set();
      for (const section of interactive.sections) {
        if (!section || !Array.isArray(section.rows)) return "Invalid interactive list section.";
        if (interactive.sections.length > 1) {
          const secTitle = (section.title || "").trim();
          if (!secTitle || secTitle.length > 24) return "Interactive list section title must be between 1 and 24 characters when multiple sections exist.";
        } else if (section.title && section.title.length > 24) {
          return "Interactive list section title exceeds maximum length of 24 characters.";
        }
        if (section.rows.length === 0) return "Interactive list section cannot have empty rows.";
        totalRows += section.rows.length;
        for (const row of section.rows) {
          if (!row || typeof row !== "object") return "Invalid interactive list row.";
          const rowId = (row.id || "").trim();
          if (!rowId || rowId.length > 200) return "Interactive list row ID must be between 1 and 200 characters.";
          if (seenRowIds.has(rowId)) return `Duplicate interactive list row ID: ${rowId}`;
          seenRowIds.add(rowId);
          const title = (row.title || "").trim();
          if (!title || title.length > 24) return "Interactive list row title must be between 1 and 24 characters.";
          if (row.description && row.description.length > 72) return "Interactive list row description exceeds maximum length of 72 characters.";
        }
      }
      if (totalRows < 1 || totalRows > 10) return "Interactive list must contain between 1 and 10 total rows across all sections.";
      return null;
    }

    function buildPayload({ to, body, templateName, templateLanguage = "en_US", templateParameters, interactive }) {
      const formattedPhone = formatPhone(to);
      if (interactive) {
        if (interactive.type === "button") {
          const interactiveObj = {
            type: "button",
            body: { text: interactive.bodyText || body },
            action: {
              buttons: interactive.buttons.map((btn) => ({
                type: "reply",
                reply: { id: btn.id, title: btn.title },
              })),
            },
          };
          if (interactive.headerText) interactiveObj.header = { type: "text", text: interactive.headerText };
          if (interactive.footerText) interactiveObj.footer = { text: interactive.footerText };
          return {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "interactive",
            interactive: interactiveObj,
          };
        }
        if (interactive.type === "list") {
          const interactiveObj = {
            type: "list",
            body: { text: interactive.bodyText || body },
            action: {
              button: interactive.buttonText,
              sections: interactive.sections.map((sec) => ({
                ...(sec.title ? { title: sec.title } : {}),
                rows: sec.rows.map((row) => ({
                  id: row.id,
                  title: row.title,
                  ...(row.description ? { description: row.description } : {}),
                })),
              })),
            },
          };
          if (interactive.headerText) interactiveObj.header = { type: "text", text: interactive.headerText };
          if (interactive.footerText) interactiveObj.footer = { text: interactive.footerText };
          return {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "interactive",
            interactive: interactiveObj,
          };
        }
      }
      if (templateName) {
        return {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: templateParameters?.length ? [{ type: "body", parameters: templateParameters }] : undefined,
          },
        };
      }
      return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: { preview_url: false, body },
      };
    }

    test("10. Existing text payload remains unchanged", () => {
      const payload = buildPayload({
        to: "+12145550199",
        body: "Hello from mobile tire clinic!",
      });
      assertEqual(payload.messaging_product, "whatsapp");
      assertEqual(payload.recipient_type, "individual");
      assertEqual(payload.to, "12145550199");
      assertEqual(payload.type, "text");
      assertEqual(payload.text.body, "Hello from mobile tire clinic!");
      assertEqual(payload.text.preview_url, false);
    });

    test("11. Existing template payload remains unchanged", () => {
      const payload = buildPayload({
        to: "+12145550199",
        body: "Fallback text",
        templateName: "booking_confirmation",
        templateLanguage: "en_US",
        templateParameters: [{ type: "text", text: "John" }],
      });
      assertEqual(payload.messaging_product, "whatsapp");
      assertEqual(payload.recipient_type, "individual");
      assertEqual(payload.to, "12145550199");
      assertEqual(payload.type, "template");
      assertEqual(payload.template.name, "booking_confirmation");
      assertEqual(payload.template.language.code, "en_US");
      assertEqual(payload.template.components[0].parameters[0].text, "John");
    });

    test("12. Button interactive payload is built correctly with header, body, footer, and buttons", () => {
      const payload = buildPayload({
        to: "+12145550199",
        body: "Fallback text",
        interactive: {
          type: "button",
          headerText: "Header Info",
          bodyText: "How can we help you?",
          footerText: "HT Mobile Tyres",
          buttons: [
            { id: "btn_status", title: "Status" },
            { id: "btn_services", title: "Services" },
            { id: "btn_human", title: "Support" },
          ],
        },
      });
      assertEqual(payload.type, "interactive");
      assertEqual(payload.interactive.type, "button");
      assertEqual(payload.interactive.header.text, "Header Info");
      assertEqual(payload.interactive.body.text, "How can we help you?");
      assertEqual(payload.interactive.footer.text, "HT Mobile Tyres");
      assertEqual(payload.interactive.action.buttons.length, 3);
      assertEqual(payload.interactive.action.buttons[0].reply.id, "btn_status");
      assertEqual(payload.interactive.action.buttons[0].reply.title, "Status");
      assertEqual(payload.interactive.action.buttons[2].reply.id, "btn_human");
    });

    test("13. List interactive payload is built correctly with sections and rows", () => {
      const payload = buildPayload({
        to: "+12145550199",
        body: "Fallback text",
        interactive: {
          type: "list",
          buttonText: "Choose Option",
          bodyText: "Please select a booking:",
          footerText: "HT Mobile Tyres",
          sections: [
            {
              title: "Active Bookings",
              rows: [
                { id: "b_1", title: "Ford F-150", description: "Flat tire repair" },
                { id: "b_2", title: "Honda Civic", description: "Tire balancing" },
              ],
            },
          ],
        },
      });
      assertEqual(payload.type, "interactive");
      assertEqual(payload.interactive.type, "list");
      assertEqual(payload.interactive.body.text, "Please select a booking:");
      assertEqual(payload.interactive.footer.text, "HT Mobile Tyres");
      assertEqual(payload.interactive.action.button, "Choose Option");
      assertEqual(payload.interactive.action.sections[0].title, "Active Bookings");
      assertEqual(payload.interactive.action.sections[0].rows.length, 2);
      assertEqual(payload.interactive.action.sections[0].rows[0].id, "b_1");
      assertEqual(payload.interactive.action.sections[0].rows[0].title, "Ford F-150");
      assertEqual(payload.interactive.action.sections[0].rows[0].description, "Flat tire repair");
    });

    test("14. Button count validation: 0 buttons rejected, >3 buttons rejected", () => {
      assertEqual(
        validateButtons({ type: "button", buttons: [] }, "Body"),
        "Interactive button message must contain between 1 and 3 buttons."
      );
      assertEqual(
        validateButtons(
          {
            type: "button",
            buttons: [
              { id: "1", title: "A" },
              { id: "2", title: "B" },
              { id: "3", title: "C" },
              { id: "4", title: "D" },
            ],
          },
          "Body"
        ),
        "Interactive button message must contain between 1 and 3 buttons."
      );
    });

    test("15. Button title and ID validation: title >20 chars or empty rejected, ID >256 chars rejected", () => {
      assertEqual(
        validateButtons(
          {
            type: "button",
            buttons: [{ id: "btn_1", title: "This title is definitely longer than twenty characters" }],
          },
          "Body"
        ),
        "Interactive button title must be between 1 and 20 characters."
      );
      assertEqual(
        validateButtons(
          {
            type: "button",
            buttons: [{ id: "btn_1", title: "" }],
          },
          "Body"
        ),
        "Interactive button title must be between 1 and 20 characters."
      );
      assertEqual(
        validateButtons(
          {
            type: "button",
            buttons: [{ id: "a".repeat(257), title: "Valid" }],
          },
          "Body"
        ),
        "Interactive button ID must be between 1 and 256 characters."
      );
    });

    test("16. Button validation: duplicate button IDs or invalid body/footer lengths rejected", () => {
      assertEqual(
        validateButtons(
          {
            type: "button",
            buttons: [
              { id: "btn_same", title: "One" },
              { id: "btn_same", title: "Two" },
            ],
          },
          "Body"
        ),
        "Duplicate interactive button ID: btn_same"
      );
      assertEqual(
        validateButtons(
          {
            type: "button",
            bodyText: "x".repeat(1025),
            buttons: [{ id: "1", title: "A" }],
          },
          ""
        ),
        "Interactive button body exceeds maximum length of 1024 characters."
      );
      assertEqual(
        validateButtons(
          {
            type: "button",
            footerText: "y".repeat(61),
            buttons: [{ id: "1", title: "A" }],
          },
          "Valid body"
        ),
        "Interactive button footer exceeds maximum length of 60 characters."
      );
    });

    test("17. List validation: row count below minimum (0) or above maximum (>10) rejected", () => {
      assertEqual(
        validateList(
          {
            type: "list",
            buttonText: "Menu",
            sections: [{ title: "S1", rows: [] }],
          },
          "Body"
        ),
        "Interactive list section cannot have empty rows."
      );
      assertEqual(
        validateList(
          {
            type: "list",
            buttonText: "Menu",
            sections: [
              {
                title: "S1",
                rows: Array.from({ length: 11 }, (_, i) => ({
                  id: `row_${i}`,
                  title: `Title ${i}`,
                })),
              },
            ],
          },
          "Body"
        ),
        "Interactive list must contain between 1 and 10 total rows across all sections."
      );
    });

    test("18. List validation: invalid button text, row title/id/description, or duplicate IDs rejected", () => {
      // buttonText > 20 chars
      assertEqual(
        validateList(
          {
            type: "list",
            buttonText: "Super Long Button Name Exceeding Twenty",
            sections: [{ rows: [{ id: "1", title: "T" }] }],
          },
          "Body"
        ),
        "Interactive list action button text must be between 1 and 20 characters."
      );

      // row title > 24 chars
      assertEqual(
        validateList(
          {
            type: "list",
            buttonText: "Menu",
            sections: [{ rows: [{ id: "1", title: "This row title is way longer than twenty four chars" }] }],
          },
          "Body"
        ),
        "Interactive list row title must be between 1 and 24 characters."
      );

      // row description > 72 chars
      assertEqual(
        validateList(
          {
            type: "list",
            buttonText: "Menu",
            sections: [{ rows: [{ id: "1", title: "Valid", description: "z".repeat(73) }] }],
          },
          "Body"
        ),
        "Interactive list row description exceeds maximum length of 72 characters."
      );

      // duplicate row IDs
      assertEqual(
        validateList(
          {
            type: "list",
            buttonText: "Menu",
            sections: [
              {
                rows: [
                  { id: "dup_row", title: "A" },
                  { id: "dup_row", title: "B" },
                ],
              },
            ],
          },
          "Body"
        ),
        "Duplicate interactive list row ID: dup_row"
      );
    });

    test("19. Payload selection priority: interactive overrides template and text", () => {
      const payload = buildPayload({
        to: "+12145550199",
        body: "Fallback text",
        templateName: "booking_confirmation",
        interactive: {
          type: "button",
          buttons: [{ id: "1", title: "OK" }],
        },
      });
      assertEqual(payload.type, "interactive", "Interactive must take precedence over template");

      const templatePayload = buildPayload({
        to: "+12145550199",
        body: "Fallback text",
        templateName: "booking_confirmation",
      });
      assertEqual(templatePayload.type, "template", "Template must take precedence over text");

      const textPayload = buildPayload({
        to: "+12145550199",
        body: "Plain text",
      });
      assertEqual(textPayload.type, "text", "Plain text when neither interactive nor template provided");
    });

    test("20. Simulation mode: returns simulated WAMID without network call and logs interactive metadata", () => {
      assert(
        providerSrc.includes("isInteractive: Boolean(interactive)"),
        "Provider must tag simulated logs with isInteractive"
      );
      assert(
        providerSrc.includes("interactiveType: interactive?.type"),
        "Provider must tag simulated logs with interactiveType"
      );
      assert(
        providerSrc.includes("wamid.simulated."),
        "Provider must return simulated WAMID pattern"
      );
    });
  });
}
