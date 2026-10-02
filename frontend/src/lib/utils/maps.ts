/**
 * Google Maps Navigation URL Generator
 * HT Mobile Services / Tire Mobile Clinic
 *
 * Pure, deterministic utility to construct Google Maps turn-by-turn navigation
 * or location search URLs for admin dispatch alerts and technician routing.
 */

export interface MapsUrlParams {
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
  location?: string | null;
}

const ABSOLUTE_MAPS_FALLBACK = "https://www.google.com/maps";

/**
 * Builds a deterministic Google Maps URL from coordinates or text addresses.
 * 
 * Rules:
 * 1. If finite, valid latitude and longitude exist:
 *    https://www.google.com/maps/dir/?api=1&destination=LAT,LNG
 * 2. Otherwise if formattedAddress exists (non-empty):
 *    https://www.google.com/maps/search/?api=1&query=ENCODED_ADDRESS
 * 3. Otherwise if location exists (non-empty):
 *    https://www.google.com/maps/search/?api=1&query=ENCODED_LOCATION
 * 4. Otherwise:
 *    https://www.google.com/maps
 */
export function buildGoogleMapsUrl(params?: MapsUrlParams | null): string {
  if (!params) {
    return ABSOLUTE_MAPS_FALLBACK;
  }

  const { latitude, longitude, formattedAddress, location } = params;

  // 1. Coordinate check: valid finite numbers within earth GPS bounds
  const hasValidCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  if (hasValidCoordinates) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }

  // 2. Formatted address fallback (preferred over raw location string)
  const trimmedFormatted = typeof formattedAddress === "string" ? formattedAddress.trim() : "";
  if (trimmedFormatted.length > 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedFormatted)}`;
  }

  // 3. Raw location string fallback
  const trimmedLocation = typeof location === "string" ? location.trim() : "";
  if (trimmedLocation.length > 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedLocation)}`;
  }

  // 4. Absolute fallback
  return ABSOLUTE_MAPS_FALLBACK;
}
