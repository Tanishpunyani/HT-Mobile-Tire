/**
 * SerpAPI Google Maps Autocomplete Utilities
 * HT Mobile Services / Tire Mobile Clinic
 *
 * Provides location resolution, strict validation, response mapping,
 * and error sanitization for the address autocomplete endpoint.
 */

export interface AutocompleteSuggestion {
  value: string;
  subtext?: string;
  latitude?: number;
  longitude?: number;
  type?: string;
}

export const DEFAULT_GTA_LOCATION = "@43.6532,-79.3832,14z";

/**
 * Greater Toronto Area and Southern Ontario operational service boundaries:
 * Latitude: 43.0 to 44.5 N
 * Longitude: -80.5 to -78.5 W
 */
export const GTA_SERVICE_BOUNDS = {
  minLat: 43.0,
  maxLat: 44.5,
  minLng: -80.5,
  maxLng: -78.5,
};

/**
 * Validates whether an ll string matches the SerpAPI/Google Maps format:
 * @[latitude],[longitude],[zoom]z or @[latitude],[longitude]
 *
 * When enforceServiceArea is true, also restricts coordinates to the
 * authorized Greater Toronto Area service boundary to prevent abuse.
 */
export function parseAndValidateLl(
  llString: string | null | undefined,
  enforceServiceArea = false
): boolean {
  if (!llString || typeof llString !== "string") return false;
  const trimmed = llString.trim();
  const match = trimmed.match(/^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+)z)?$/);
  if (!match) return false;

  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }

  if (enforceServiceArea) {
    if (
      lat < GTA_SERVICE_BOUNDS.minLat ||
      lat > GTA_SERVICE_BOUNDS.maxLat ||
      lng < GTA_SERVICE_BOUNDS.minLng ||
      lng > GTA_SERVICE_BOUNDS.maxLng
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Resolves the geographic location parameter for SerpAPI Google Maps Autocomplete.
 * 1. If client provided an 'll' parameter, strictly validate within GTA service boundary.
 * 2. If client 'll' is absent or invalid/out-of-bounds, check SERPAPI_AUTOCOMPLETE_LL env var.
 * 3. Fallback to sensible Greater Toronto Area origin (@43.6532,-79.3832,14z).
 */
export function resolveSearchLocation(
  clientLl?: string | null,
  envOverride?: string | null
): string {
  // 1. Client-supplied parameter: strictly enforce service area boundary
  if (clientLl && typeof clientLl === "string") {
    const trimmed = clientLl.trim();
    if (parseAndValidateLl(trimmed, true)) {
      return trimmed;
    }
  }

  // 2. Configured environment variable
  const envLl = envOverride !== undefined ? envOverride : process.env.SERPAPI_AUTOCOMPLETE_LL;
  if (envLl && typeof envLl === "string") {
    const trimmedEnv = envLl.trim();
    if (parseAndValidateLl(trimmedEnv, false)) {
      return trimmedEnv;
    }
  }

  // 3. Fallback to Greater Toronto Area default
  return DEFAULT_GTA_LOCATION;
}

/**
 * Maps and cleans SerpAPI raw suggestions into the strict AutocompleteSuggestion contract.
 * Prioritizes place suggestions over generic keyword queries.
 */
export function mapSerpApiSuggestions(data: any): AutocompleteSuggestion[] {
  const rawSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];

  const suggestions: AutocompleteSuggestion[] = rawSuggestions
    .map((item: any): AutocompleteSuggestion | null => {
      if (!item) return null;

      // Handle simple string completions
      if (typeof item === "string" && item.trim().length > 0) {
        return { value: item.trim() };
      }

      // Handle structured suggestions
      if (typeof item === "object") {
        const rawValue =
          typeof item.value === "string"
            ? item.value
            : typeof item.title === "string"
            ? item.title
            : typeof item.text === "string"
            ? item.text
            : "";
        const value = rawValue.trim();
        if (!value) return null;

        const suggestion: AutocompleteSuggestion = { value };

        const rawSubtext =
          typeof item.subtext === "string"
            ? item.subtext
            : typeof item.description === "string"
            ? item.description
            : "";
        const subtext = rawSubtext.trim();
        if (subtext) {
          suggestion.subtext = subtext;
        }

        const lat =
          typeof item.latitude === "number" && Number.isFinite(item.latitude)
            ? item.latitude
            : typeof item.gps_coordinates?.latitude === "number" &&
              Number.isFinite(item.gps_coordinates.latitude)
            ? item.gps_coordinates.latitude
            : undefined;
        if (typeof lat === "number") {
          suggestion.latitude = lat;
        }

        const lng =
          typeof item.longitude === "number" && Number.isFinite(item.longitude)
            ? item.longitude
            : typeof item.gps_coordinates?.longitude === "number" &&
              Number.isFinite(item.gps_coordinates.longitude)
            ? item.gps_coordinates.longitude
            : undefined;
        if (typeof lng === "number") {
          suggestion.longitude = lng;
        }

        if (typeof item.type === "string" && item.type.trim().length > 0) {
          suggestion.type = item.type.trim();
        }

        return suggestion;
      }

      return null;
    })
    .filter((item: AutocompleteSuggestion | null): item is AutocompleteSuggestion =>
      Boolean(item && item.value)
    );

  // Prioritize place suggestions over generic keyword completions
  suggestions.sort((a, b) => {
    const aIsPlace = a.type === "place" || Boolean(a.subtext);
    const bIsPlace = b.type === "place" || Boolean(b.subtext);
    if (aIsPlace && !bIsPlace) return -1;
    if (!aIsPlace && bIsPlace) return 1;
    return 0;
  });

  return suggestions;
}

/**
 * Sanitizes provider error messages so secrets, full query strings,
 * or API keys are never exposed in logs or user responses.
 */
export function sanitizeProviderErrorMessage(
  rawError: string | undefined,
  apiKey?: string
): string | undefined {
  if (!rawError || typeof rawError !== "string") return undefined;

  let cleaned = rawError.replace(/[\r\n\t]+/g, " ").trim();

  // Redact API key if present
  if (apiKey && apiKey.length > 5) {
    cleaned = cleaned.replaceAll(apiKey, "[REDACTED_API_KEY]");
  }

  // Remove full search URL query strings if echoed back
  cleaned = cleaned.replace(/api_key=[^&\s]+/gi, "api_key=[REDACTED_API_KEY]");

  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 200) + "...";
  }

  return cleaned || undefined;
}
