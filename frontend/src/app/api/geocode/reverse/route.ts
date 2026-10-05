import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";
import { logger } from "@/lib/logger";

const reverseGeocodeSchema = z.object({
  lat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  lng: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
});

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`reverse_geocode_${clientIp}`, 5, 60 * 1000);

    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const validation = reverseGeocodeSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        {
          success: false,
          error: "Valid latitude (-90 to 90) and longitude (-180 to 180) are required.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { lat, lng } = validation.data;

    const apiKey =
      process.env.GOOGLE_MAPS_SERVER_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      logger.info("geocode_reverse.no_api_key");
      return Response.json({
        success: true,
        address: {
          formattedAddress: `GPS Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          lat,
          lng,
        },
      });
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );

    const data = await response.json();

    if (data.status !== "OK" || !data.results?.[0]) {
      logger.warn("geocode_reverse.google_api_status", { status: data.status });
      return Response.json({
        success: true,
        address: {
          formattedAddress: `GPS Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          lat,
          lng,
        },
      });
    }

    const result = data.results[0];
    let streetNumber = "";
    let route = "";
    let city = "";
    let state = "";
    let zipCode = "";

    for (const comp of result.address_components) {
      if (comp.types.includes("street_number")) {
        streetNumber = comp.long_name;
      }
      if (comp.types.includes("route")) {
        route = comp.long_name;
      }
      if (comp.types.includes("locality")) {
        city = comp.long_name;
      }
      if (comp.types.includes("administrative_area_level_1")) {
        state = comp.short_name;
      }
      if (comp.types.includes("postal_code")) {
        zipCode = comp.long_name;
      }
    }

    const structuredAddress = {
      formattedAddress: result.formatted_address,
      streetNumber,
      route,
      streetAddress: streetNumber && route ? `${streetNumber} ${route}` : route,
      city,
      state,
      zipCode,
      lat,
      lng,
    };

    return Response.json({
      success: true,
      address: structuredAddress,
    });
  } catch (error: any) {
    logger.error("geocode_reverse.exception", { error });
    return Response.json(
      { success: false, error: error?.message || "Failed to reverse geocode location." },
      { status: 500 }
    );
  }
}
