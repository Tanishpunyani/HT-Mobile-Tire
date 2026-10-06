export const BUSINESS_PHONE_DISPLAY =
  process.env.NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY || "+1 (647) 995-6665";

export interface BrandedEmailLayoutOptions {
  badgeText: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
  headerAccentColor?: string;
  title: string;
  subtitle?: string;
  bodyContentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNotice?: string;
}

/**
 * Base responsive branded HTML layout wrapper for all HT Mobile Tire notification emails.
 * Table-based and inline-styled for universal email client compatibility (Apple Mail, Gmail, Outlook).
 */
export function renderBrandedEmailLayout({
  badgeText,
  badgeBgColor = "#2563eb",
  badgeTextColor = "#ffffff",
  headerAccentColor = "#e11d48",
  title,
  subtitle = "On-Demand Roadside & Driveway Tire Service",
  bodyContentHtml,
  ctaText,
  ctaUrl,
  footerNotice,
}: BrandedEmailLayoutOptions): string {
  const ctaButtonHtml =
    ctaText && ctaUrl
      ? `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px;">
          <tr>
            <td align="center">
              <a href="${ctaUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #e11d48; color: #ffffff !important; text-align: center; padding: 14px 24px; border-radius: 10px; font-weight: 700; font-size: 15px; text-decoration: none; letter-spacing: 0.3px; -webkit-text-size-adjust: none;">
                ${ctaText} &rarr;
              </a>
            </td>
          </tr>
        </table>
      `
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; }
    a { color: #2563eb; }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 0 !important; }
      .content-cell { padding: 24px 16px !important; }
      .header-cell { padding: 28px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f1f5f9;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding: 0 12px;">
        <!-- Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="container-table" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
          <!-- Top Accent Bar -->
          <tr>
            <td height="5" style="background-color: ${headerAccentColor}; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <!-- Header -->
          <tr>
            <td class="header-cell" style="background-color: #0f172a; padding: 32px 28px; text-align: center;">
              <div style="display: inline-block; background-color: ${badgeBgColor}; color: ${badgeTextColor}; padding: 5px 14px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;">
                ${badgeText}
              </div>
              <h1 style="margin: 0 0 6px 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2;">
                HT Mobile Tire
              </h1>
              <p style="margin: 0; color: #94a3b8; font-size: 13px; font-weight: 500;">
                ${subtitle}
              </p>
            </td>
          </tr>
          <!-- Content Body -->
          <tr>
            <td class="content-cell" style="padding: 32px 28px; color: #1e293b; font-size: 15px; line-height: 1.6;">
              ${bodyContentHtml}
              ${ctaButtonHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.5;">
              ${footerNotice ? `<p style="margin: 0 0 10px 0; color: #475569;">${footerNotice}</p>` : ""}
              <p style="margin: 0 0 6px 0; font-weight: 700; color: #334155;">
                HT Mobile Tire &bull; Fast Roadside &amp; On-Site Tire Care
              </p>
              <p style="margin: 0 0 4px 0;">
                Need immediate assistance or customer support? Call <strong><a href="tel:${BUSINESS_PHONE_DISPLAY.replace(/[^0-9+]/g, "")}" style="color: #0f172a; text-decoration: none;">${BUSINESS_PHONE_DISPLAY}</a></strong>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                &copy; ${new Date().getFullYear()} HT Mobile Tire. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDisplayDate(date: Date | string | null | undefined): string {
  if (!date) return "Scheduled Window";
  if (typeof date === "string" && !date.includes("T")) return date;
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(date);
  }
}

function formatDisplayTime(time: Date | string | null | undefined): string {
  if (!time) return "Standard Appointment";
  if (typeof time === "string" && !time.includes("T")) return time;
  try {
    return new Date(time).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(time);
  }
}

function renderDetailsTable(rows: Array<{ label: string; value: string; highlight?: boolean }>): string {
  const rowHtml = rows
    .filter((r) => r.value)
    .map(
      (r) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 0; font-size: 13px; color: #64748b; font-weight: 600; width: 38%; vertical-align: top;">
          ${r.label}
        </td>
        <td style="padding: 10px 0; font-size: 14px; color: ${r.highlight ? "#0f172a" : "#334155"}; font-weight: ${r.highlight ? "700" : "600"}; text-align: right; vertical-align: top;">
          ${r.value}
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px 18px; margin: 20px 0;">
      ${rowHtml}
    </table>
  `;
}

// ============================================================================
// CUSTOMER TEMPLATES (11)
// ============================================================================

export interface CustomerBookingTemplateData {
  customerName?: string | null;
  bookingId: string;
  serviceName: string;
  vehicle: string;
  location: string;
  bookingDate?: Date | string | null;
  bookingTime?: Date | string | null;
  notes?: string | null;
  technicianName?: string | null;
  etaMinutes?: number | null;
  trackingUrl?: string | null;
  accountUrl?: string | null;
  totalAmount?: number | null;
  cancellationReason?: string | null;
}

/**
 * 1. Customer: Booking Received
 */
export function renderBookingReceivedEmail(data: CustomerBookingTemplateData): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();
  const name = data.customerName || "Customer";
  const dateStr = formatDisplayDate(data.bookingDate);
  const timeStr = formatDisplayTime(data.bookingTime);

  const subject = `Booking Received: #${shortId} - HT Mobile Tire`;
  const text = `HT Mobile Tire — Booking Received\n\nHi ${name},\n\nWe have received your mobile tire service request for booking #${shortId} (${data.serviceName}).\n\nVehicle: ${data.vehicle}\nLocation: ${data.location}\nScheduled: ${dateStr} at ${timeStr}\n\nOur service team is assigning an equipped mobile technician to your location.\n\nManage Booking: ${data.accountUrl || "https://ht-mobile-tire.vercel.app/account?tab=bookings"}\nSupport: ${BUSINESS_PHONE_DISPLAY}`;

  const bodyContentHtml = `
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">
      Hello <strong>${name}</strong>,
    </p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      Thank you for choosing <strong>HT Mobile Tire</strong>! We have received your service request. Our service team is reviewing your schedule and assigning an equipped mobile service van.
    </p>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      { label: "Service", value: data.serviceName, highlight: true },
      { label: "Vehicle", value: data.vehicle },
      { label: "Location", value: data.location },
      { label: "Requested Date", value: dateStr },
      { label: "Requested Time", value: timeStr },
      ...(data.notes ? [{ label: "Customer Notes", value: `"${data.notes}"` }] : []),
    ])}

    <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 16px 0 0 0;">
      You will receive an automated confirmation email once a technician is formally scheduled for your time slot.
    </p>
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Request Received",
    badgeBgColor: "#0284c7",
    headerAccentColor: "#0284c7",
    title: "Booking Request Received",
    subtitle: "Service Request in Progress",
    bodyContentHtml,
    ctaText: "View Booking Details in Account",
    ctaUrl: data.accountUrl || undefined,
    footerNotice: `Questions about this request? Call us at ${BUSINESS_PHONE_DISPLAY}.`,
  });

  return { subject, html, text };
}

/**
 * 2. Customer: Booking Confirmed
 */
export function renderBookingConfirmedEmail(data: CustomerBookingTemplateData): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();
  const name = data.customerName || "Customer";
  const dateStr = formatDisplayDate(data.bookingDate);
  const timeStr = formatDisplayTime(data.bookingTime);

  const subject = `Booking Confirmed: #${shortId} (${data.serviceName}) - HT Mobile Tire`;
  const text = `Hi ${name},\n\nYour mobile tire appointment for booking #${shortId} (${data.serviceName}) has been CONFIRMED!\n\nDate & Time: ${dateStr} at ${timeStr}\nVehicle: ${data.vehicle}\nLocation: ${data.location}\n\nManage Booking: ${data.accountUrl || "https://ht-mobile-tire.vercel.app/account?tab=bookings"}\nSupport: ${BUSINESS_PHONE_DISPLAY}`;

  const bodyContentHtml = `
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">
      Hello <strong>${name}</strong>,
    </p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      Great news! Your mobile tire service appointment has been <strong style="color: #16a34a;">CONFIRMED</strong>. A mobile service van is scheduled for your appointment window.
    </p>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      { label: "Service", value: data.serviceName, highlight: true },
      { label: "Appointment Date", value: dateStr },
      { label: "Appointment Time", value: timeStr },
      { label: "Vehicle", value: data.vehicle },
      { label: "Service Location", value: data.location },
    ])}

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #166534; line-height: 1.5;">
      <strong>Appointment Preparation:</strong> Please ensure the vehicle is parked in an accessible, level location where our service van can park safely adjacent to it.
    </div>
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Booking Confirmed",
    badgeBgColor: "#16a34a",
    headerAccentColor: "#16a34a",
    title: "Booking Confirmed",
    subtitle: "Appointment Approved & Scheduled",
    bodyContentHtml,
    ctaText: "Manage Booking & View Schedule",
    ctaUrl: data.accountUrl || undefined,
    footerNotice: `Need to reschedule or update your address? Call us at ${BUSINESS_PHONE_DISPLAY}.`,
  });

  return { subject, html, text };
}

/**
 * 3. Customer: Technician Assigned
 */
export function renderTechnicianAssignedEmail(data: CustomerBookingTemplateData): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();
  const name = data.customerName || "Customer";
  const techName = data.technicianName || "HT Mobile Technician";
  const dateStr = formatDisplayDate(data.bookingDate);

  const subject = `Technician Assigned: #${shortId} - HT Mobile Tire`;
  const text = `Hi ${name},\n\nYour ${techName} has been assigned to your booking #${shortId} (${data.serviceName}) for your ${data.vehicle}.\n\nScheduled Date: ${dateStr}\nLocation: ${data.location}\n\nWe will notify you with live updates as soon as the technician is en route.\nSupport: ${BUSINESS_PHONE_DISPLAY}`;

  const bodyContentHtml = `
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">
      Hello <strong>${name}</strong>,
    </p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      A dedicated mobile technician has been assigned to your upcoming service appointment.
    </p>

    <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 12px; padding: 18px; text-align: center; margin: 18px 0;">
      <span style="font-size: 11px; font-weight: 800; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px;">Assigned Specialist</span>
      <div style="font-size: 20px; font-weight: 800; color: #1e3a8a; margin-top: 4px;">
        ${techName}
      </div>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #3b82f6;">Mobile Tire Specialist</p>
    </div>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      { label: "Service", value: data.serviceName },
      { label: "Vehicle", value: data.vehicle },
      { label: "Location", value: data.location },
      { label: "Date", value: dateStr },
    ])}

    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
      You will receive a notification with an ETA and live tracking link as soon as our technician begins traveling to your location.
    </p>
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Technician Assigned",
    badgeBgColor: "#2563eb",
    headerAccentColor: "#2563eb",
    title: "Technician Assigned",
    subtitle: "Technician Preparing for Your Service",
    bodyContentHtml,
    ctaText: "View Booking in Account",
    ctaUrl: data.accountUrl || undefined,
  });

  return { subject, html, text };
}

/**
 * 4. Customer: Technician En Route
 */
export function renderTechnicianEnRouteEmail(data: CustomerBookingTemplateData): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();
  const name = data.customerName || "Customer";
  const etaText = data.etaMinutes ? `${data.etaMinutes} minutes` : "30-45 minutes";
  const trackingUrl = data.trackingUrl || data.accountUrl;

  const subject = `Technician En Route: #${shortId} (ETA ${etaText}) - HT Mobile Tire`;
  const text = `Hi ${name},\n\nOur mobile technician is now on the way to your location for booking #${shortId}!\n\nEstimated Arrival: ${etaText}\nVehicle: ${data.vehicle}\nLocation: ${data.location}\n\nTrack Technician Live: ${trackingUrl || "https://ht-mobile-tire.vercel.app"}\nHotline: ${BUSINESS_PHONE_DISPLAY}`;

  const bodyContentHtml = `
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">
      Hello <strong>${name}</strong>,
    </p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      Our fully-equipped mobile service van has departed and is currently traveling to your location.
    </p>

    <!-- ETA Banner -->
    <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
      <span style="font-size: 12px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">Estimated Arrival Time</span>
      <div style="font-size: 28px; font-weight: 900; color: #78350f; margin-top: 4px;">
        ${etaText}
      </div>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #b45309;">Technician is en route to ${data.location}</p>
    </div>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      { label: "Service", value: data.serviceName },
      { label: "Vehicle", value: data.vehicle },
      { label: "Service Destination", value: data.location },
      ...(data.technicianName ? [{ label: "Technician", value: "HT Mobile Technician" }] : []),
    ])}

    <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #475569;">
      <strong>Driver Notice:</strong> Please ensure your phone is reachable so the technician can contact you if gate or building access is required.
    </div>
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Technician En Route",
    badgeBgColor: "#f59e0b",
    headerAccentColor: "#f59e0b",
    title: "Technician Is On The Way",
    subtitle: `Estimated Arrival: ${etaText}`,
    bodyContentHtml,
    ctaText: trackingUrl ? "Track Technician Live" : "View Booking in Account",
    ctaUrl: trackingUrl || undefined,
    footerNotice: `Need to speak with us? Call ${BUSINESS_PHONE_DISPLAY}.`,
  });

  return { subject, html, text };
}

/**
 * 5. Customer: Technician Arrived
 */
export function renderTechnicianArrivedEmail(data: CustomerBookingTemplateData): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();
  const name = data.customerName || "Customer";

  const subject = `Technician Arrived On-Site: #${shortId} - HT Mobile Tire`;
  const text = `Hi ${name},\n\nOur mobile tire technician has arrived on-site at ${data.location} for booking #${shortId} (${data.vehicle}).\n\nPlease ensure the vehicle is accessible.\nSupport Hotline: ${BUSINESS_PHONE_DISPLAY}`;

  const bodyContentHtml = `
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">
      Hello <strong>${name}</strong>,
    </p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      Our mobile technician has arrived at <strong>${data.location}</strong> and is preparing the service van to begin work on your vehicle.
    </p>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      { label: "Service", value: data.serviceName },
      { label: "Vehicle", value: data.vehicle },
      { label: "Location", value: data.location },
      ...(data.technicianName ? [{ label: "Technician", value: "HT Mobile Technician" }] : []),
    ])}

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #166534; line-height: 1.5;">
      <strong>Action Required:</strong> Please unlock or make your vehicle accessible if required. If keys or wheel lock nuts are needed, please hand them to our technician.
    </div>
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Arrived On-Site",
    badgeBgColor: "#16a34a",
    headerAccentColor: "#16a34a",
    title: "Technician Has Arrived",
    subtitle: "Mobile Van Positioned & Ready",
    bodyContentHtml,
    ctaText: "View Booking Details",
    ctaUrl: data.accountUrl || undefined,
  });

  return { subject, html, text };
}

/**
 * 6. Customer: Service Started
 */
export function renderServiceStartedEmail(data: CustomerBookingTemplateData): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();
  const name = data.customerName || "Customer";

  const subject = `Service Started: #${shortId} - HT Mobile Tire`;
  const text = `Hi ${name},\n\nWork on your booking #${shortId} (${data.serviceName}) has now started on your ${data.vehicle} at ${data.location}.\n\nOur technician is currently working on your vehicle.\nSupport: ${BUSINESS_PHONE_DISPLAY}`;

  const bodyContentHtml = `
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">
      Hello <strong>${name}</strong>,
    </p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      Our mobile technician has commenced work on your <strong>${data.vehicle}</strong>. All tire mounting, balancing, or repair will be executed to factory specifications.
    </p>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      { label: "Service In Progress", value: data.serviceName, highlight: true },
      { label: "Vehicle", value: data.vehicle },
      { label: "Location", value: data.location },
      ...(data.technicianName ? [{ label: "Technician", value: data.technicianName }] : []),
    ])}

    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
      You do not need to wait outside while the work is performed. We will send an email and invoice summary once all service steps and quality torque checks are complete.
    </p>
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Service In Progress",
    badgeBgColor: "#8b5cf6",
    headerAccentColor: "#8b5cf6",
    title: "Service Underway",
    subtitle: "Professional Roadside & Driveway Execution",
    bodyContentHtml,
    ctaText: "View Live Booking Status",
    ctaUrl: data.accountUrl || undefined,
  });

  return { subject, html, text };
}

/**
 * 7. Customer: Service Completed
 */
export function renderServiceCompletedEmail(data: CustomerBookingTemplateData & {
  hasPdfAttachment?: boolean;
}): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();
  const name = data.customerName || "Customer";
  const amountStr = typeof data.totalAmount === "number" ? `$${data.totalAmount.toFixed(2)}` : null;

  const subject = `Service Completed: #${shortId} - HT Mobile Tire`;
  const text = `Hi ${name},\n\nYour mobile tire service for booking #${shortId} (${data.serviceName}) has been completed successfully.\n\nVehicle: ${data.vehicle}\nLocation: ${data.location}\n${amountStr ? `Total Amount: ${amountStr}\n` : ""}Status: Completed\n\nThank you for choosing HT Mobile Tire!\nSupport: ${BUSINESS_PHONE_DISPLAY}`;

  const bodyContentHtml = `
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">
      Hello <strong>${name}</strong>,
    </p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      Your mobile tire service has been <strong style="color: #16a34a;">completed successfully</strong>. All lug nuts have been torqued to manufacturer specifications, and tire pressures have been verified.
    </p>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      { label: "Service", value: data.serviceName },
      { label: "Vehicle", value: data.vehicle },
      { label: "Location", value: data.location },
      ...(amountStr ? [{ label: "Total Amount", value: amountStr, highlight: true }] : []),
      ...(data.technicianName ? [{ label: "Completed By", value: data.technicianName }] : []),
    ])}

    ${
      data.hasPdfAttachment
        ? `
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #1e40af;">
        <strong>Official Receipt Attached:</strong> A PDF copy of your service summary and invoice is attached to this email for your records.
      </div>
    `
        : ""
    }

    <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 16px;">
      Thank you for choosing HT Mobile Tire. We look forward to keeping you safe on the road!
    </p>
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Service Completed",
    badgeBgColor: "#16a34a",
    headerAccentColor: "#16a34a",
    title: "Service Completed Successfully",
    subtitle: "Factory Spec Verified & Torqued",
    bodyContentHtml,
    ctaText: "View Receipt in Account",
    ctaUrl: data.accountUrl || undefined,
  });

  return { subject, html, text };
}

/**
 * 8. Customer: Booking Cancelled
 */
export function renderBookingCancelledEmail(data: CustomerBookingTemplateData): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();
  const name = data.customerName || "Customer";

  const subject = `Booking Cancelled: #${shortId} - HT Mobile Tire`;
  const text = `Hi ${name},\n\nYour mobile tire appointment #${shortId} for ${data.vehicle} has been cancelled.\n${data.cancellationReason ? `Reason: ${data.cancellationReason}\n` : ""}If you need to rebook or have questions, visit https://ht-mobile-tire.vercel.app/booking or call ${BUSINESS_PHONE_DISPLAY}.`;

  const bodyContentHtml = `
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">
      Hello <strong>${name}</strong>,
    </p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      This email confirms that your mobile tire appointment for booking <strong>#${shortId}</strong> has been <strong style="color: #dc2626;">cancelled</strong>.
    </p>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      { label: "Service", value: data.serviceName },
      { label: "Vehicle", value: data.vehicle },
      { label: "Location", value: data.location },
      ...(data.cancellationReason ? [{ label: "Reason", value: data.cancellationReason }] : []),
    ])}

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
      If this cancellation was in error or you would like to reschedule for a future date, you may submit a new booking online or contact our customer support.
    </div>
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Booking Cancelled",
    badgeBgColor: "#dc2626",
    headerAccentColor: "#dc2626",
    title: "Appointment Cancelled",
    subtitle: "Status Update Notice",
    bodyContentHtml,
    ctaText: "Book a New Appointment",
    ctaUrl: "https://ht-mobile-tire.vercel.app/booking",
    footerNotice: `Questions about this cancellation? Call us at ${BUSINESS_PHONE_DISPLAY}.`,
  });

  return { subject, html, text };
}

/**
 * 9. Customer: Payment Received
 */
export function renderPaymentReceivedEmail(data: CustomerBookingTemplateData & {
  amountPaid: number;
  paymentMethod?: string;
}): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();
  const name = data.customerName || "Customer";
  const amountStr = `$${Number(data.amountPaid).toFixed(2)}`;

  const subject = `Payment Confirmation: #${shortId} - HT Mobile Tire`;
  const text = `Hi ${name},\n\nThank you! We have received your payment of ${amountStr} for Booking #${shortId} (${data.serviceName}).\n\nYour receipt and invoice are available in your account:\n${data.accountUrl || "https://ht-mobile-tire.vercel.app/account?tab=bookings"}\n\nThank you for choosing HT Mobile Tire!`;

  const bodyContentHtml = `
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">
      Hello <strong>${name}</strong>,
    </p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      Thank you for your business! We have successfully received and processed your payment for Booking <strong>#${shortId}</strong>.
    </p>

    <!-- Payment Amount Card -->
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
      <span style="font-size: 12px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Amount Paid</span>
      <div style="font-size: 32px; font-weight: 900; color: #15803d; margin-top: 4px;">
        ${amountStr}
      </div>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #16a34a;">Status: Paid in Full</p>
    </div>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      { label: "Service", value: data.serviceName },
      { label: "Vehicle", value: data.vehicle },
      ...(data.paymentMethod ? [{ label: "Payment Method", value: data.paymentMethod }] : []),
    ])}

    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
      Your official tax invoice and service completion receipt are stored safely in your customer account.
    </p>
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Payment Received",
    badgeBgColor: "#16a34a",
    headerAccentColor: "#16a34a",
    title: "Payment Received &amp; Verified",
    subtitle: "Official Transaction Receipt",
    bodyContentHtml,
    ctaText: "View & Download Full Receipt",
    ctaUrl: data.accountUrl || undefined,
  });

  return { subject, html, text };
}

/**
 * 10. Customer: Quote / Invoice Ready
 */
export interface QuoteEmailData {
  customerName?: string | null;
  bookingId: string;
  primaryService: string;
  basePrice: number;
  extraServices?: Array<{ name: string; price: number }>;
  totalAmount: number;
  vehicle?: string;
  location?: string;
  serviceDate?: string;
  notes?: string | null;
  accountUrl?: string;
  hasPdfAttachment?: boolean;
}

export function renderQuoteReadyEmail(data: QuoteEmailData): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();
  const name = data.customerName || "Customer";
  const extras = data.extraServices || [];

  const extraRowsHtml = extras
    .map(
      (extra) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 0; color: #334155; font-size: 13px;">
          <strong>+ ${extra.name}</strong>
          <span style="display: block; font-size: 11px; color: #64748b;">Technician add-on</span>
        </td>
        <td style="padding: 10px 0; text-align: right; color: #0f172a; font-weight: 700; font-size: 13px;">
          $${Number(extra.price).toFixed(2)}
        </td>
      </tr>
    `
    )
    .join("");

  const subject = `Your Invoice & Quote: #${shortId} - HT Mobile Tire`;
  const text = `Hi ${name},\n\nYour mobile tire service quote and invoice for booking #${shortId} is ready.\n\nTotal Amount: $${Number(data.totalAmount).toFixed(2)}\nPrimary Service: ${data.primaryService} ($${Number(data.basePrice).toFixed(2)})\n${data.vehicle ? `Vehicle: ${data.vehicle}\n` : ""}\nView details & receipt: ${data.accountUrl || "https://ht-mobile-tire.vercel.app/account?tab=bookings"}\nSupport: ${BUSINESS_PHONE_DISPLAY}`;

  const bodyContentHtml = `
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">
      Hello <strong>${name}</strong>,
    </p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      Your mobile tire service quote and invoice has been finalized. Below is the itemized summary for Booking <strong>#${shortId}</strong>.
    </p>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      ...(data.vehicle ? [{ label: "Vehicle", value: data.vehicle }] : []),
      ...(data.location ? [{ label: "Location", value: data.location }] : []),
      ...(data.serviceDate ? [{ label: "Date", value: data.serviceDate }] : []),
    ])}

    <!-- Itemized Breakdown Table -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 2px solid #cbd5e1; text-align: left;">
          <th style="padding-bottom: 8px; color: #475569; font-size: 11px; text-transform: uppercase; font-weight: 700;">Service Item</th>
          <th style="padding-bottom: 8px; text-align: right; color: #475569; font-size: 11px; text-transform: uppercase; font-weight: 700;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; color: #0f172a; font-size: 13px;">
            <strong>${data.primaryService}</strong>
            <span style="display: block; font-size: 11px; color: #64748b;">Primary Booked Service</span>
          </td>
          <td style="padding: 12px 0; text-align: right; color: #0f172a; font-weight: 700; font-size: 13px;">
            $${Number(data.basePrice).toFixed(2)}
          </td>
        </tr>
        ${extraRowsHtml}
      </tbody>
    </table>

    <!-- Total Card -->
    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 18px; text-align: center; margin-top: 20px;">
      <span style="font-size: 11px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Total Amount</span>
      <div style="font-size: 32px; font-weight: 900; color: #1e3a8a; margin-top: 4px;">
        $${Number(data.totalAmount).toFixed(2)}
      </div>
    </div>

    ${
      data.notes
        ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #334155;">
        <strong style="color: #2563eb; font-size: 11px; text-transform: uppercase;">Technician Notes:</strong>
        <p style="margin: 4px 0 0 0;">${data.notes}</p>
      </div>
    `
        : ""
    }

    ${
      data.hasPdfAttachment
        ? `
      <p style="font-size: 12px; color: #2563eb; font-weight: 600; text-align: center; margin-top: 14px;">
        &#128206; Official PDF Invoice attached to this email
      </p>
    `
        : ""
    }
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Quote & Invoice",
    badgeBgColor: "#2563eb",
    headerAccentColor: "#2563eb",
    title: "Official Service Quote",
    subtitle: "Itemized Billing & Invoice Breakdown",
    bodyContentHtml,
    ctaText: "View Details in Customer Portal",
    ctaUrl: data.accountUrl || undefined,
    footerNotice: `Questions about this invoice? Call us at ${BUSINESS_PHONE_DISPLAY}.`,
  });

  return { subject, html, text };
}

/**
 * 11. Customer: Emergency Request Confirmation
 */
export interface EmergencyEmailData {
  id: string;
  customerName?: string | null;
  problem: string;
  problemDetails?: string | null;
  vehicle: string;
  currentLocation: string;
  accountUrl?: string;
}

export function renderEmergencyRequestCustomerEmail(data: EmergencyEmailData): { subject: string; html: string; text: string } {
  const shortId = data.id.slice(-6).toUpperCase();
  const name = data.customerName || "Customer";

  const subject = `[EMERGENCY ASSISTANCE] Help is On The Way - HT Mobile Tire`;
  const text = `Hi ${name},\n\nWe have received your Roadside Emergency Request #${shortId}!\n\nIssue: ${data.problem}\nVehicle: ${data.vehicle}\nLocation: ${data.currentLocation}\nEstimated Arrival: 30-45 minutes\n\nPlease stay in a safe spot away from traffic.\nDirect Hotline: ${BUSINESS_PHONE_DISPLAY}\nTrack: ${data.accountUrl || "https://ht-mobile-tire.vercel.app/account?tab=emergency"}`;

  const bodyContentHtml = `
    <!-- ETA Callout -->
    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 18px; margin-bottom: 20px; text-align: center;">
      <h2 style="color: #e11d48; margin: 0 0 4px 0; font-size: 22px; font-weight: 800;">Estimated Arrival: 30&ndash;45 Minutes</h2>
      <p style="color: #991b1b; margin: 0; font-size: 13px; font-weight: 600;">Your roadside emergency is prioritized for immediate mobile service.</p>
    </div>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-top: 0;">
      Hello <strong>${name}</strong>, our nearest mobile technician van has received your vehicle location. Please stay in a safe spot away from oncoming traffic.
    </p>

    ${renderDetailsTable([
      { label: "Emergency Ref", value: `#${shortId}`, highlight: true },
      { label: "Issue Reported", value: data.problem, highlight: true },
      { label: "Vehicle", value: data.vehicle },
      { label: "Location", value: data.currentLocation },
      ...(data.problemDetails ? [{ label: "Details", value: data.problemDetails }] : []),
    ])}

    <!-- Hotline Card -->
    <div style="background-color: #0f172a; color: #ffffff; border-radius: 12px; padding: 16px; text-align: center; margin-top: 20px;">
      <p style="margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Direct Technician &amp; Support Hotline (24/7)</p>
      <a href="tel:${BUSINESS_PHONE_DISPLAY.replace(/[^0-9+]/g, "")}" style="color: #fb7185; font-weight: 800; text-decoration: none; font-size: 20px; display: inline-block; margin-top: 4px;">
        &#128222; ${BUSINESS_PHONE_DISPLAY}
      </a>
    </div>
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Roadside Emergency",
    badgeBgColor: "#dc2626",
    headerAccentColor: "#dc2626",
    title: "Emergency Roadside Assistance",
    subtitle: "Technician on the Way to Your Location",
    bodyContentHtml,
    ctaText: "Track Status in Customer Account",
    ctaUrl: data.accountUrl || undefined,
  });

  return { subject, html, text };
}

// ============================================================================
// ADMIN TEMPLATES (5)
// ============================================================================

/**
 * 1. Admin: New Booking Created
 */
export function renderAdminBookingCreatedEmail(data: {
  bookingId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  serviceName: string;
  vehicle: string;
  location: string;
  bookingDate?: Date | string | null;
  bookingTime?: Date | string | null;
  notes?: string | null;
  adminBookingUrl?: string;
}): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();
  const dateStr = formatDisplayDate(data.bookingDate);
  const timeStr = formatDisplayTime(data.bookingTime);

  const subject = `[ADMIN DISPATCH] New Booking #${shortId}: ${data.serviceName}`;
  const text = `NEW BOOKING REQUEST\nBooking: #${shortId}\nCustomer: ${data.customerName || "Customer"} (${data.customerPhone || "N/A"})\nService: ${data.serviceName}\nVehicle: ${data.vehicle}\nLocation: ${data.location}\nDate: ${dateStr} at ${timeStr}\n\nOpen booking in Admin Dashboard:\n${data.adminBookingUrl || "https://ht-mobile-tire.vercel.app/admin/bookings"}`;

  const bodyContentHtml = `
    <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #1e40af;">
      <strong>Action Required:</strong> A new customer booking has been created and requires technician allocation.
    </div>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      { label: "Service", value: data.serviceName, highlight: true },
      { label: "Customer Name", value: data.customerName || "N/A" },
      { label: "Customer Phone", value: data.customerPhone || "N/A" },
      { label: "Customer Email", value: data.customerEmail || "N/A" },
      { label: "Vehicle", value: data.vehicle },
      { label: "Location", value: data.location },
      { label: "Scheduled Date", value: dateStr },
      { label: "Scheduled Time", value: timeStr },
      ...(data.notes ? [{ label: "Notes", value: data.notes }] : []),
    ])}
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Admin Alert",
    badgeBgColor: "#2563eb",
    headerAccentColor: "#2563eb",
    title: "New Booking Created",
    subtitle: "Central Dispatch Queue",
    bodyContentHtml,
    ctaText: "Open Booking in Admin Dashboard",
    ctaUrl: data.adminBookingUrl || undefined,
  });

  return { subject, html, text };
}

/**
 * 2. Admin: Emergency Request Alert
 */
export function renderAdminEmergencyAlertEmail(data: {
  emergencyId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  problem: string;
  problemDetails?: string | null;
  vehicle: string;
  location: string;
  adminEmergencyUrl?: string;
}): { subject: string; html: string; text: string } {
  const shortId = data.emergencyId.slice(-6).toUpperCase();

  const subject = `[URGENT ROADSIDE] Emergency Request #${shortId} (${data.problem})`;
  const text = `EMERGENCY ROADSIDE ALERT\nEmergency Ref: #${shortId}\nCustomer: ${data.customerName || "Customer"} (${data.customerPhone || "N/A"})\nProblem: ${data.problem}\nVehicle: ${data.vehicle}\nLocation: ${data.location}\n\nOpen in Dispatch Portal:\n${data.adminEmergencyUrl || "https://ht-mobile-tire.vercel.app/admin/emergency"}`;

  const bodyContentHtml = `
    <div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 10px; padding: 16px; margin-bottom: 20px; text-align: center;">
      <h2 style="color: #dc2626; margin: 0 0 4px 0; font-size: 20px; font-weight: 800;">&#128680; PRIORITY ROADSIDE DISPATCH</h2>
      <p style="color: #991b1b; margin: 0; font-size: 13px; font-weight: 600;">Immediate technician routing recommended.</p>
    </div>

    ${renderDetailsTable([
      { label: "Emergency Ref", value: `#${shortId}`, highlight: true },
      { label: "Issue", value: data.problem, highlight: true },
      { label: "Customer Name", value: data.customerName || "N/A" },
      { label: "Customer Phone", value: data.customerPhone || "N/A", highlight: true },
      { label: "Customer Email", value: data.customerEmail || "N/A" },
      { label: "Vehicle", value: data.vehicle },
      { label: "Current Location", value: data.location },
      ...(data.problemDetails ? [{ label: "Details", value: data.problemDetails }] : []),
    ])}
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Urgent Roadside",
    badgeBgColor: "#dc2626",
    headerAccentColor: "#dc2626",
    title: "Emergency Roadside Alert",
    subtitle: "Immediate Van Dispatch Required",
    bodyContentHtml,
    ctaText: "Open Emergency Dispatch Portal",
    ctaUrl: data.adminEmergencyUrl || undefined,
  });

  return { subject, html, text };
}

/**
 * 3. Admin: Contact Form Submission Alert
 */
export function renderAdminContactAlertEmail(data: {
  contactId: string;
  name: string;
  phone: string;
  email?: string | null;
  service?: string | null;
  location?: string | null;
  message?: string | null;
  emergency?: boolean;
}): { subject: string; html: string; text: string } {
  const shortId = data.contactId.slice(-6).toUpperCase();
  const isEmergency = Boolean(data.emergency);

  const subject = `[ADMIN CONTACT] ${isEmergency ? "URGENT Inquiry" : "New Inquiry"} from ${data.name} (#${shortId})`;
  const text = `HT Mobile Tire — New Contact Request\n\nName: ${data.name}\nPhone: ${data.phone}\nEmail: ${data.email || "N/A"}\nService: ${data.service || "General Inquiry"}\nLocation: ${data.location || "N/A"}\nMessage: "${data.message || ""}"`;

  const bodyContentHtml = `
    <p style="font-size: 14px; color: #475569; margin-top: 0;">
      A new contact inquiry has been submitted via the website.
    </p>

    ${renderDetailsTable([
      { label: "Inquiry ID", value: `#${shortId}`, highlight: true },
      { label: "Name", value: data.name, highlight: true },
      { label: "Phone", value: data.phone, highlight: true },
      { label: "Email", value: data.email || "N/A" },
      { label: "Service Needed", value: data.service || "General Inquiry" },
      { label: "Location", value: data.location || "N/A" },
      { label: "Emergency Flag", value: isEmergency ? "YES (URGENT)" : "No" },
    ])}

    ${
      data.message
        ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 18px 0;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Message Content:</span>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #1e293b; line-height: 1.5; white-space: pre-wrap;">${data.message}</p>
      </div>
    `
        : ""
    }
  `;

  const html = renderBrandedEmailLayout({
    badgeText: isEmergency ? "Urgent Contact" : "Contact Inquiry",
    badgeBgColor: isEmergency ? "#dc2626" : "#475569",
    headerAccentColor: isEmergency ? "#dc2626" : "#2563eb",
    title: "New Customer Contact",
    subtitle: "Inbound Customer Message",
    bodyContentHtml,
    ctaText: data.phone ? `Call Customer: ${data.phone}` : undefined,
    ctaUrl: data.phone ? `tel:${data.phone.replace(/[^0-9+]/g, "")}` : undefined,
  });

  return { subject, html, text };
}

/**
 * 4. Admin: Booking Cancellation Alert
 */
export function renderAdminBookingCancelledEmail(data: {
  bookingId: string;
  cancelledBy: string;
  customerName?: string | null;
  customerPhone?: string | null;
  vehicle?: string | null;
  serviceName?: string | null;
  reason?: string | null;
  adminBookingUrl?: string;
}): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();

  const subject = `[ADMIN ALERT] Booking #${shortId} Cancelled by ${data.cancelledBy}`;
  const text = `HT Mobile Tire — Booking Cancelled Alert\n\nBooking: #${shortId}\nCancelled by: ${data.cancelledBy}\nCustomer: ${data.customerName || "N/A"} (${data.customerPhone || "N/A"})\nVehicle: ${data.vehicle || "N/A"}\nReason: ${data.reason || "None provided"}`;

  const bodyContentHtml = `
    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #991b1b;">
      <strong>Booking Cancelled:</strong> Booking #${shortId} was cancelled by <strong>${data.cancelledBy}</strong>. Van schedule slot has been freed.
    </div>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      { label: "Cancelled By", value: data.cancelledBy, highlight: true },
      { label: "Customer", value: `${data.customerName || "N/A"} (${data.customerPhone || "N/A"})` },
      { label: "Service", value: data.serviceName || "Mobile Tire Service" },
      { label: "Vehicle", value: data.vehicle || "N/A" },
      ...(data.reason ? [{ label: "Reason Given", value: data.reason }] : []),
    ])}
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Booking Cancelled",
    badgeBgColor: "#dc2626",
    headerAccentColor: "#dc2626",
    title: "Booking Cancelled Alert",
    subtitle: "Central Dispatch Schedule Update",
    bodyContentHtml,
    ctaText: "View Cancelled Booking in Admin",
    ctaUrl: data.adminBookingUrl || undefined,
  });

  return { subject, html, text };
}

/**
 * 5. Admin: Important Booking Status Update Alert
 */
export function renderAdminStatusUpdateEmail(data: {
  bookingId: string;
  newStatus: string;
  customerName?: string | null;
  customerPhone?: string | null;
  vehicle?: string | null;
  technicianName?: string | null;
  technicianNotes?: string | null;
  adminBookingUrl?: string;
}): { subject: string; html: string; text: string } {
  const shortId = data.bookingId.slice(-6).toUpperCase();

  const subject = `[STATUS UPDATE] Booking #${shortId} &rarr; ${data.newStatus.toUpperCase()}`;
  const text = `Booking Status Changed\nBooking: #${shortId}\nStatus: ${data.newStatus}\nCustomer: ${data.customerName || "N/A"}\nTechnician: ${data.technicianName || "N/A"}\nNotes: ${data.technicianNotes || "None"}`;

  const bodyContentHtml = `
    <p style="font-size: 14px; color: #475569; margin-top: 0;">
      A booking status transition has occurred on the dispatch board.
    </p>

    ${renderDetailsTable([
      { label: "Booking Reference", value: `#${shortId}`, highlight: true },
      { label: "New Status", value: data.newStatus.toUpperCase(), highlight: true },
      { label: "Customer", value: `${data.customerName || "N/A"} (${data.customerPhone || "N/A"})` },
      { label: "Vehicle", value: data.vehicle || "N/A" },
      ...(data.technicianName ? [{ label: "Technician", value: data.technicianName }] : []),
      ...(data.technicianNotes ? [{ label: "Technician Notes", value: data.technicianNotes }] : []),
    ])}
  `;

  const html = renderBrandedEmailLayout({
    badgeText: "Status Transition",
    badgeBgColor: "#0f172a",
    headerAccentColor: "#2563eb",
    title: "Booking Status Update",
    subtitle: "Operational Event Notification",
    bodyContentHtml,
    ctaText: "Open Booking in Admin Dashboard",
    ctaUrl: data.adminBookingUrl || undefined,
  });

  return { subject, html, text };
}
