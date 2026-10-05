import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAdminSessionToken, verifyAdminSession } from "@/lib/admin-auth";
import { getAuthorizedCustomerIdsForUser } from "@/lib/auth";
import { generateQuotePdf } from "@/lib/receipts";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const bookingId = id?.trim();

    if (!bookingId) {
      return NextResponse.json({ error: "Booking ID is required" }, { status: 400 });
    }

    // 1. Check Admin Session first
    const adminToken = await getAdminSessionToken();
    const isAdmin = adminToken ? await verifyAdminSession(adminToken) : false;
    let authorizedCustomerIds: string[] = [];
    let authenticatedUserId: string | null = null;

    // 2. If not admin, check Supabase Customer Session and resolve all authorized customer IDs
    if (!isAdmin) {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      authenticatedUserId = user.id;
      authorizedCustomerIds = await getAuthorizedCustomerIdsForUser({
        id: user.id,
        email: user.email,
        phone: user.phone || user.user_metadata?.phone || "",
      });

      if (authorizedCustomerIds.length === 0) {
        return NextResponse.json({ error: "Customer profile not found" }, { status: 403 });
      }
    }

    // 3. Fetch Booking with Customer & Technician relations
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        service: true,
        technician: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // 4. Verify Customer Ownership (if not admin)
    if (!isAdmin) {
      const isAuthorizedOwner =
        (booking.customerId && authorizedCustomerIds.includes(booking.customerId)) ||
        (booking.customer?.userId && booking.customer.userId === authenticatedUserId);

      if (!isAuthorizedOwner) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // 5. Verify Terminal Completed Status
    if (booking.status !== "completed") {
      return NextResponse.json(
        { error: "Receipt is only available for completed services" },
        { status: 400 }
      );
    }

    // 6. Calculate authoritative itemized financial breakdown
    const totalAmount = Number(booking.totalAmount) || 0;
    const extraServices = Array.isArray(booking.extraServices)
      ? (booking.extraServices as Array<{ name: string; price: number }>)
      : [];

    const extraServicesSum = extraServices.reduce(
      (sum, item) => sum + (Number(item.price) || 0),
      0
    );

    const basePrice = Math.max(0, totalAmount - extraServicesSum);
    const primaryServiceName =
      booking.primaryService || booking.service?.name || "Mobile Tire Service";

    const formattedDate = booking.createdAt
      ? new Date(booking.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

    const quoteNumber = `MTC-${booking.id.slice(-6).toUpperCase()}`;

    // 7. Generate branded PDF
    const pdfBytes = await generateQuotePdf({
      quoteNumber,
      bookingId: booking.id,
      customerName: booking.customer?.name || "Valued Customer",
      customerPhone: booking.customer?.phone || "N/A",
      customerEmail: booking.customerEmail || undefined,
      vehicle: booking.vehicle,
      location: booking.formattedAddress || booking.location,
      primaryService: primaryServiceName,
      basePrice,
      extraServices,
      totalAmount,
      notes: booking.notes,
      date: formattedDate,
    });

    const shortId = booking.id.slice(-6).toUpperCase();
    const filename = `HT-Mobile-Tires-Receipt-${shortId}.pdf`;

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    logger.error("booking_receipt.download_failed", { error });
    return NextResponse.json(
      { error: "Unable to generate receipt. Please try again later." },
      { status: 500 }
    );
  }
}
