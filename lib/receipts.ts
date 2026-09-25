import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";

export interface QuotePdfData {
  quoteNumber: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  vehicle: string;
  location: string;
  primaryService: string;
  basePrice: number;
  extraServices?: Array<{ name: string; price: number }>;
  totalAmount: number;
  notes?: string | null;
  date: string;
}

/**
 * Generates an official, branded Service Quote & Invoice PDF using pdf-lib
 */
export async function generateQuotePdf(data: QuotePdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Palette
  const colorPrimary = rgb(0.15, 0.39, 0.92); // #2563eb
  const colorDark = rgb(0.06, 0.09, 0.16); // #0f172a
  const colorSlate = rgb(0.4, 0.45, 0.55); // #64748b
  const colorLightBg = rgb(0.97, 0.98, 0.99); // #f8fafc
  const colorBorder = rgb(0.89, 0.91, 0.94); // #e2e8f0
  const colorBlueBg = rgb(0.94, 0.96, 1.0); // #eff6ff

  // Top Dark Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 120,
    width,
    height: 120,
    color: colorDark,
  });

  // Top Accent Line
  page.drawRectangle({
    x: 0,
    y: height - 124,
    width,
    height: 4,
    color: colorPrimary,
  });

  // Brand Header
  page.drawText("HT MOBILE TIRES", {
    x: 40,
    y: height - 55,
    size: 22,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("On-Demand Mobile Tire Repair & Roadside Services", {
    x: 40,
    y: height - 75,
    size: 10,
    font: fontRegular,
    color: rgb(0.8, 0.84, 0.9),
  });

  page.drawText("SERVICE QUOTE & INVOICE", {
    x: width - 240,
    y: height - 55,
    size: 12,
    font: fontBold,
    color: rgb(0.58, 0.77, 1.0),
  });

  page.drawText(`Quote #: ${data.quoteNumber}`, {
    x: width - 240,
    y: height - 73,
    size: 9.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Date: ${data.date}`, {
    x: width - 240,
    y: height - 89,
    size: 9.5,
    font: fontRegular,
    color: rgb(0.8, 0.84, 0.9),
  });

  // Customer & Service Info Box
  let currentY = height - 160;

  page.drawRectangle({
    x: 40,
    y: currentY - 110,
    width: width - 80,
    height: 110,
    color: colorLightBg,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  // Column 1: Customer Details
  page.drawText("CUSTOMER DETAILS:", {
    x: 60,
    y: currentY - 25,
    size: 9,
    font: fontBold,
    color: colorSlate,
  });

  page.drawText(data.customerName, {
    x: 60,
    y: currentY - 45,
    size: 12,
    font: fontBold,
    color: colorDark,
  });

  page.drawText(`Phone: ${data.customerPhone}`, {
    x: 60,
    y: currentY - 63,
    size: 9.5,
    font: fontRegular,
    color: colorDark,
  });

  if (data.customerEmail) {
    page.drawText(`Email: ${data.customerEmail}`, {
      x: 60,
      y: currentY - 79,
      size: 9.5,
      font: fontRegular,
      color: colorDark,
    });
  }

  // Column 2: Vehicle & Service Location
  const col2X = 320;
  page.drawText("SERVICE LOCATION:", {
    x: col2X,
    y: currentY - 25,
    size: 9,
    font: fontBold,
    color: colorSlate,
  });

  page.drawText(`Vehicle: ${data.vehicle}`, {
    x: col2X,
    y: currentY - 45,
    size: 10,
    font: fontBold,
    color: colorDark,
  });

  const displayLocation =
    data.location.length > 35
      ? data.location.substring(0, 35) + "..."
      : data.location;

  page.drawText(`Location: ${displayLocation}`, {
    x: col2X,
    y: currentY - 63,
    size: 9.5,
    font: fontRegular,
    color: colorDark,
  });

  page.drawText(`Booking Ref: #${data.bookingId.slice(-6).toUpperCase()}`, {
    x: col2X,
    y: currentY - 79,
    size: 9.5,
    font: fontRegular,
    color: colorSlate,
  });

  // Itemized Table
  currentY -= 145;

  // Table Header
  page.drawRectangle({
    x: 40,
    y: currentY - 25,
    width: width - 80,
    height: 25,
    color: rgb(0.12, 0.16, 0.24),
  });

  page.drawText("ITEM / SERVICE DESCRIPTION", {
    x: 55,
    y: currentY - 17,
    size: 8.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("CATEGORY", {
    x: 340,
    y: currentY - 17,
    size: 8.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("AMOUNT", {
    x: width - 110,
    y: currentY - 17,
    size: 8.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Row 1: Primary Service
  currentY -= 50;
  page.drawText(data.primaryService, {
    x: 55,
    y: currentY,
    size: 10.5,
    font: fontBold,
    color: colorDark,
  });

  page.drawText("Primary Booked Mobile Service", {
    x: 55,
    y: currentY - 14,
    size: 8.5,
    font: fontRegular,
    color: colorSlate,
  });

  page.drawText("Primary Service", {
    x: 340,
    y: currentY,
    size: 9.5,
    font: fontRegular,
    color: colorDark,
  });

  page.drawText(`$${Number(data.basePrice).toFixed(2)}`, {
    x: width - 110,
    y: currentY,
    size: 10.5,
    font: fontBold,
    color: colorDark,
  });

  // Extra Services Rows
  if (data.extraServices && data.extraServices.length > 0) {
    for (const extra of data.extraServices) {
      currentY -= 36;
      page.drawText(`+ ${extra.name}`, {
        x: 55,
        y: currentY,
        size: 9.5,
        font: fontBold,
        color: colorDark,
      });

      page.drawText("On-Site Add-on", {
        x: 340,
        y: currentY,
        size: 9,
        font: fontRegular,
        color: colorSlate,
      });

      page.drawText(`$${Number(extra.price).toFixed(2)}`, {
        x: width - 110,
        y: currentY,
        size: 9.5,
        font: fontBold,
        color: colorDark,
      });
    }
  }

  // Divider Line
  page.drawLine({
    start: { x: 40, y: currentY - 20 },
    end: { x: width - 40, y: currentY - 20 },
    thickness: 1,
    color: colorBorder,
  });

  // Total Card
  currentY -= 55;
  page.drawRectangle({
    x: 280,
    y: currentY - 10,
    width: width - 320,
    height: 38,
    color: colorBlueBg,
    borderColor: rgb(0.75, 0.86, 1.0),
    borderWidth: 1,
  });

  page.drawText("TOTAL QUOTE DUE:", {
    x: 295,
    y: currentY + 3,
    size: 10.5,
    font: fontBold,
    color: colorPrimary,
  });

  page.drawText(`$${Number(data.totalAmount).toFixed(2)}`, {
    x: width - 110,
    y: currentY + 1,
    size: 14,
    font: fontBold,
    color: colorDark,
  });

  // Notes Section if present
  if (data.notes) {
    currentY -= 65;
    page.drawRectangle({
      x: 40,
      y: currentY - 10,
      width: width - 80,
      height: 48,
      color: colorLightBg,
      borderColor: colorBorder,
      borderWidth: 1,
    });

    page.drawText("TECHNICIAN NOTES:", {
      x: 55,
      y: currentY + 22,
      size: 8.5,
      font: fontBold,
      color: colorPrimary,
    });

    page.drawText(data.notes.slice(0, 80), {
      x: 55,
      y: currentY + 6,
      size: 9,
      font: fontRegular,
      color: colorDark,
    });
  }

  // Terms / Footer Notice
  currentY -= 60;
  page.drawText("Payment Terms: Due upon service completion via Mobile Card Terminal, Apple Pay, or Cash.", {
    x: 40,
    y: currentY,
    size: 8.5,
    font: fontOblique,
    color: colorSlate,
  });

  page.drawText(`Questions? Central Dispatch Hotline: ${BUSINESS_PHONE_DISPLAY}`, {
    x: 40,
    y: currentY - 15,
    size: 8.5,
    font: fontRegular,
    color: colorSlate,
  });

  return await pdfDoc.save();
}
