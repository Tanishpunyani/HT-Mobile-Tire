import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { verifyAdminSession, getAdminSessionToken } from "@/lib/admin-auth";
import { verifyTechnicianDispatchToken, createTechnicianDispatchToken, verifyTechnicianApiKey } from "@/lib/technician-auth";
import { logger } from "@/lib/logger";
import { checkRateLimitDistributed, getClientIp } from "@/lib/rate-limit";
import { BUSINESS_PHONE_RAW } from "@/lib/constants/phone";

// Calculate Great-Circle distance between two coordinates in miles (Haversine formula)
function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimitDistributed("tech_loc_post", clientIp, 15, 60 * 1000);

    if (!rateLimit.allowed) {
      return Response.json(
        { success: false, error: "Too many location updates. Please wait a moment." },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    const headerApiKey =
      request.headers.get("x-api-key") ||
      request.headers.get("x-technician-key") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    let body: any = null;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { bookingId, latitude, longitude, heading, speed, technicianKey, dispatchToken: bodyToken, token: bodyTokenAlt } = body || {};
    const dispatchToken = request.headers.get("x-dispatch-token") || bodyToken || bodyTokenAlt;

    let isTokenVerified = false;
    let verifiedTechId: string | null = null;
    if (dispatchToken) {
      const tokenResult = verifyTechnicianDispatchToken(dispatchToken);
      if (tokenResult.valid && tokenResult.technicianId) {
        isTokenVerified = true;
        verifiedTechId = tokenResult.technicianId;
      }
    }

    // Constant-time key comparison: check header first, then body technicianKey for backwards compatibility
    const isKeyValid = verifyTechnicianApiKey(headerApiKey) || verifyTechnicianApiKey(technicianKey);

    let isAuthorized = isKeyValid || isTokenVerified;

    if (!isAuthorized) {
      const token = await getAdminSessionToken();
      if (token) {
        const adminSession = await verifyAdminSession(token);
        if (adminSession) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const adminUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        if (adminUser?.role === "admin" || adminUser?.role === "technician") {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return Response.json(
        { success: false, error: "Unauthorized access." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 1. Validate booking ID format
    if (!bookingId || typeof bookingId !== "string" || bookingId.trim() === "") {
      return Response.json(
        { success: false, error: "Valid bookingId is required." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2. Validate GPS coordinates
    if (
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return Response.json(
        { success: false, error: "Invalid latitude or longitude coordinates." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Optional heading validation
    const validHeading =
      typeof heading === "number" && Number.isFinite(heading)
        ? Math.max(0, Math.min(360, heading))
        : null;

    // Optional speed validation (reject unreasonable values above 120 mph)
    let validSpeed: number | null = null;
    if (typeof speed === "number" && Number.isFinite(speed)) {
      if (speed < 0 || speed > 120) {
        return Response.json(
          { success: false, error: "Invalid speed telemetry." },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      validSpeed = speed;
    }

    // 3. Load booking with assigned technician from DB
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        technician: true,
      },
    });

    if (!booking) {
      return Response.json(
        { success: false, error: "Booking not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 4. Validate technician assignment and status
    if (!booking.technicianId || !booking.technician) {
      return Response.json(
        { success: false, error: "No technician is assigned to this booking." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!booking.technician.isActive) {
      return Response.json(
        { success: false, error: "Assigned technician is inactive." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (isTokenVerified) {
      const scopedResult = verifyTechnicianDispatchToken(dispatchToken, {
        expectedBookingId: booking.id,
        expectedTechnicianId: booking.technicianId,
      });
      if (!scopedResult.valid) {
        return Response.json(
          { success: false, error: scopedResult.error || "Forbidden. Dispatch token is not valid for this booking." },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // 5. Enforce valid status (confirmed or in_progress only)
    if (booking.status !== "confirmed" && booking.status !== "in_progress") {
      return Response.json(
        { success: false, error: `GPS updates are not allowed for ${booking.status} bookings.` },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 6. Upsert technician location strictly bound to booking.technicianId
    const updatedLocation = await prisma.technicianLocation.upsert({
      where: { bookingId },
      create: {
        bookingId,
        technicianId: booking.technicianId,
        latitude,
        longitude,
        heading: validHeading,
        speed: validSpeed,
        isActive: true,
      },
      update: {
        technicianId: booking.technicianId,
        latitude,
        longitude,
        heading: validHeading,
        speed: validSpeed,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    return Response.json(
      {
        success: true,
        message: "Location updated.",
        updatedAt: updatedLocation.updatedAt.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    logger.error("technician_location.post_failed", { error });
    return Response.json(
      { success: false, error: "Failed to update technician location." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimitDistributed("tech_loc_get", clientIp, 30, 60 * 1000);

    if (!rateLimit.allowed) {
      return Response.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get("bookingId");

    if (!bookingId || typeof bookingId !== "string" || bookingId.trim() === "") {
      return Response.json(
        { success: false, error: "Booking ID is required." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 1. Fetch booking with customer, technician, and location
    let booking: any = null;
    try {
      booking = await prisma.booking.findUnique({
        where: { id: bookingId.trim() },
        include: {
          technicianLocation: true,
          technician: true,
          customer: true,
        },
      });
    } catch {
      return Response.json(
        { success: false, error: "Booking not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!booking) {
      return Response.json(
        { success: false, error: "Booking not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2. Authorization Check (Admin Session, Technician Key, Dispatch Token, or Staff User)
    let isAuthorized = false;

    // Check Admin Session
    const adminToken = await getAdminSessionToken();
    if (adminToken) {
      const isValidAdmin = await verifyAdminSession(adminToken);
      if (isValidAdmin) {
        isAuthorized = true;
      }
    }

    // Check Technician API Key (timing-safe)
    if (!isAuthorized) {
      const headerApiKey =
        request.headers.get("x-api-key") ||
        request.headers.get("x-technician-key") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (verifyTechnicianApiKey(headerApiKey)) {
        isAuthorized = true;
      }
    }

    // Check Technician Dispatch Token with scope verification
    if (!isAuthorized) {
      const dispatchToken =
        request.headers.get("x-dispatch-token") ||
        searchParams.get("token") ||
        searchParams.get("dispatchToken");
      if (dispatchToken) {
        const tokenResult = verifyTechnicianDispatchToken(dispatchToken, {
          expectedBookingId: booking.id,
          expectedTechnicianId: booking.technicianId || undefined,
        });
        if (tokenResult.valid && tokenResult.technicianId && tokenResult.technicianId === booking.technicianId) {
          isAuthorized = true;
        }
      }
    }

    // Check Authenticated Staff User (Admin / Technician role)
    if (!isAuthorized) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });

        if (dbUser?.role === "admin" || dbUser?.role === "technician") {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return Response.json(
        { success: false, error: "Unauthorized access. Tracking telemetry is restricted to authorized dispatch staff." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 3. Compute Signal Freshness & Location Data
    const techLoc = booking.technicianLocation;
    const isEnRoute = booking.status === "in_progress";
    const isCompleted = booking.status === "completed";

    let signalFreshness: "waiting" | "fresh" | "stale" | "offline" = "waiting";

    if (techLoc && techLoc.isActive && techLoc.updatedAt) {
      const ageMs = Date.now() - new Date(techLoc.updatedAt).getTime();
      if (ageMs < 60 * 1000) {
        signalFreshness = "fresh";
      } else if (ageMs <= 5 * 60 * 1000) {
        signalFreshness = "stale";
      } else {
        signalFreshness = "offline";
      }
    }

    const isLive = Boolean(
      techLoc &&
        techLoc.isActive &&
        (signalFreshness === "fresh" || signalFreshness === "stale")
    );

    const customerLat = booking.latitude || null;
    const customerLng = booking.longitude || null;

    let distanceMiles: number | null = null;
    let etaMinutes: number | null = null;

    if (techLoc && customerLat !== null && customerLng !== null) {
      distanceMiles = calculateDistanceMiles(techLoc.latitude, techLoc.longitude, customerLat, customerLng);
      etaMinutes = Math.max(2, Math.round((distanceMiles / 30) * 60) + 3);
    }

    const technicianPayload = booking.technician
      ? {
          name: booking.technician.name,
          role: booking.technician.role,
          phone: booking.technician.phone || process.env.NEXT_PUBLIC_BUSINESS_PHONE || BUSINESS_PHONE_RAW,
        }
      : null;

    const locationPayload = techLoc
      ? {
          latitude: techLoc.latitude,
          longitude: techLoc.longitude,
          heading: techLoc.heading ?? null,
          speed: techLoc.speed ?? null,
          updatedAt: techLoc.updatedAt.toISOString(),
        }
      : null;

    const hasArrived = Boolean(booking.arrivedAt);
    const arrivedAt = booking.arrivedAt ? booking.arrivedAt.toISOString() : null;

    let dispatchToken: string | null = null;
    let dispatchUrl: string | null = null;
    if (booking.technicianId) {
      const host = request.headers.get("host") || "localhost:3000";
      const protocol =
        request.headers.get("x-forwarded-proto") ||
        (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
      try {
        dispatchToken = createTechnicianDispatchToken(booking.technicianId, booking.id);
        dispatchUrl = `${protocol}://${host}/technician/tracking/${booking.id}?token=${encodeURIComponent(dispatchToken)}`;
      } catch {
        // Fallback to direct technician tracking console URL without token (authorized via admin session)
        dispatchUrl = `${protocol}://${host}/technician/tracking/${booking.id}`;
      }
    }

    return Response.json(
      {
        success: true,
        bookingId: booking.id,
        bookingStatus: booking.status,
        isEnRoute,
        isCompleted,
        isLive,
        hasArrived,
        arrivedAt,
        dispatchToken,
        dispatchUrl,
        technician: technicianPayload,
        technicianLocation: locationPayload,
        customerLocation: {
          address: booking.formattedAddress || booking.location,
          latitude: customerLat,
          longitude: customerLng,
        },
        distanceMiles,
        etaMinutes,
        signalFreshness,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    logger.error("technician_location.get_failed", { error });
    return Response.json(
      { success: false, error: "Unable to retrieve tracking information." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
