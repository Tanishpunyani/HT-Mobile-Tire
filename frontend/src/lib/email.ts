import { Resend } from "resend";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";
import { logger } from "@/lib/logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL =
  process.env.FROM_EMAIL ||
  process.env.RESEND_FROM_EMAIL ||
  "HT Mobile Tires <onboarding@resend.dev>";

function getResendClient() {
  if (RESEND_API_KEY) {
    try {
      return new Resend(RESEND_API_KEY);
    } catch (err) {
      logger.warn("email.resend_init_failed", { error: err });
    }
  }
  return null;
}

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

/**
 * Sends a branded Quote & Service Summary email to the customer with an optional PDF attachment.
 */
export async function sendQuoteEmail({
  customerEmail,
  customerName,
  bookingId,
  primaryService,
  basePrice,
  extraServices = [],
  totalAmount,
  notes,
  vehicle,
  location,
  serviceDate,
  pdfBytes,
}: SendQuoteEmailParams) {
  const resend = getResendClient();
  const shortId = bookingId.slice(-6).toUpperCase();

  if (!resend || !customerEmail) {
    logger.info("email.quote.simulated", {
      recipient: customerEmail,
      totalAmount,
      bookingId: shortId,
    });
    return { success: true, simulated: true };
  }

  const extraRowsHtml = extraServices
    .map(
      (extra) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 0; color: #334155; font-size: 14px;">
          <strong>+ ${extra.name}</strong>
          <span style="display: block; font-size: 12px; color: #64748b;">Additional technician service</span>
        </td>
        <td style="padding: 12px 0; text-align: right; color: #0f172a; font-weight: 700; font-size: 14px;">
          $${Number(extra.price).toFixed(2)}
        </td>
      </tr>
    `
    )
    .join("");

  const notesSectionHtml = notes
    ? `
    <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 14px 18px; margin: 24px 0;">
      <p style="margin: 0; font-size: 12px; text-transform: uppercase; font-weight: 700; color: #2563eb; letter-spacing: 0.5px;">Technician Service Notes</p>
      <p style="margin: 6px 0 0 0; font-size: 14px; color: #334155; line-height: 1.5;">${notes}</p>
    </div>
  `
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background: #0f172a; padding: 32px 24px; text-align: center; color: #ffffff; }
          .badge { display: inline-block; background: #2563eb; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
          .content { padding: 32px 28px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          .total-card { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; text-align: center; margin-top: 24px; }
          .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge">Service Completed</div>
            <h1 style="margin: 12px 0 4px 0; font-size: 24px; font-weight: 800;">HT Mobile Tires</h1>
            <p style="margin: 0; color: #94a3b8; font-size: 14px;">Official Service Quote & Invoice</p>
          </div>

          <div class="content">
            <p style="font-size: 16px; color: #0f172a; margin-top: 0;">
              Hello <strong>${customerName || "Customer"}</strong>,
            </p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              Your mobile tire service has been completed by our certified roadside technician. Below is the itemized quote and billing breakdown for Booking <strong>#${shortId}</strong>.
            </p>

            <!-- Booking Info Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #475569;">
              ${vehicle ? `<div style="margin-bottom: 4px;"><strong>Vehicle:</strong> ${vehicle}</div>` : ""}
              ${location ? `<div style="margin-bottom: 4px;"><strong>Location:</strong> ${location}</div>` : ""}
              ${serviceDate ? `<div><strong>Service Date:</strong> ${serviceDate}</div>` : ""}
            </div>

            <!-- Itemized Table -->
            <table class="table">
              <thead>
                <tr style="border-bottom: 2px solid #cbd5e1; text-align: left;">
                  <th style="padding-bottom: 8px; color: #475569; font-size: 12px; text-transform: uppercase;">Service Item</th>
                  <th style="padding-bottom: 8px; text-align: right; color: #475569; font-size: 12px; text-transform: uppercase;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 14px 0; color: #0f172a; font-size: 14px;">
                    <strong>${primaryService}</strong> (Primary Booked Service)
                  </td>
                  <td style="padding: 14px 0; text-align: right; color: #0f172a; font-weight: 700; font-size: 14px;">
                    $${Number(basePrice).toFixed(2)}
                  </td>
                </tr>
                ${extraRowsHtml}
              </tbody>
            </table>

            <!-- Total Box -->
            <div class="total-card">
              <span style="font-size: 12px; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Total Amount Due</span>
              <div style="font-size: 32px; font-weight: 900; color: #1e3a8a; margin-top: 4px;">
                $${Number(totalAmount).toFixed(2)}
              </div>
            </div>

            ${notesSectionHtml}

            <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0;"><strong>Payment Instructions:</strong> You may settle your balance on-site with our mobile technician via Card, Mobile Pay, or Cash. If you have questions or require commercial fleet invoicing, call our central dispatch at <strong>${BUSINESS_PHONE_DISPLAY}</strong>.</p>
            </div>
          </div>

          <div class="footer">
            <p style="margin: 0 0 6px 0; font-weight: 700; color: #334155;">HT Mobile Tires &mdash; Fast Roadside &amp; On-Site Tire Care</p>
            <p style="margin: 0;">Need immediate emergency assistance? Call ${BUSINESS_PHONE_DISPLAY}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const attachments = pdfBytes
      ? [
          {
            filename: `HTMobileTires_Quote_${shortId}.pdf`,
            content: Buffer.from(pdfBytes),
          },
        ]
      : undefined;

    const emailResponse = await resend.emails.send({
      from: FROM_EMAIL,
      to: customerEmail,
      subject: `Your HT Mobile Tires Service Quote - Booking #${shortId}`,
      html,
      attachments,
    });

    logger.info("email.quote.sent", {
      id: emailResponse.data?.id,
      recipient: customerEmail,
      bookingId: shortId,
    });
    return { success: true, id: emailResponse.data?.id };
  } catch (error: unknown) {
    logger.error("email.quote.failed", {
      error,
      bookingId: shortId,
    });
    const errMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errMessage };
  }
}
