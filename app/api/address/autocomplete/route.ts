import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export interface AutocompleteSuggestion {
  value: string;
  subtext?: string;
  latitude?: number;
  longitude?: number;
  type?: string;
}

interface CacheEntry {
  suggestions: AutocompleteSuggestion[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache to preserve SerpApi quota

// Periodic stale cache sweep
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function GET(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`address_autocomplete_${clientIp}`, 10, 60 * 1000);

    if (!rateLimit.allowed) {
      return Response.json(
        { suggestions: [], error: "Rate limit exceeded. Please wait a moment." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    if (query.length < 3) {
      return Response.json({ suggestions: [] });
    }

    const cacheKey = query.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return Response.json({ suggestions: cached.suggestions });
    }

    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      logger.info("address_autocomplete.no_api_key");
      return Response.json({ suggestions: [] });
    }

    const serpApiUrl = new URL("https://serpapi.com/search.json");
    // Engine set to Google Maps Autocomplete for authentic place and address suggestions
    serpApiUrl.searchParams.set("engine", "google_maps_autocomplete");
    serpApiUrl.searchParams.set("q", query);
    serpApiUrl.searchParams.set("gl", "us");
    serpApiUrl.searchParams.set("hl", "en");
    // Dallas–Fort Worth, Texas geographic center (approx. 32.7767 N, -96.7970 W) at zoom level 9z
    // to provide local DFW and Texas geographic context across the entire metroplex.
    serpApiUrl.searchParams.set("ll", "@32.7767,-96.7970,9z");
    serpApiUrl.searchParams.set("api_key", apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetch(serpApiUrl.toString(), {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn("address_autocomplete.serpapi_error", {
          status: response.status,
          statusText: response.statusText,
        });
        return Response.json({ suggestions: [] });
      }

      const data = await response.json();
      const rawSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];

      const suggestions: AutocompleteSuggestion[] = rawSuggestions
        .map((item: any) => {
          if (!item) return null;
          if (typeof item === "string") {
            return { value: item };
          }
          if (typeof item === "object" && typeof item.value === "string" && item.value.trim().length > 0) {
            const suggestion: AutocompleteSuggestion = {
              value: item.value.trim(),
            };
            if (typeof item.subtext === "string" && item.subtext.trim().length > 0) {
              suggestion.subtext = item.subtext.trim();
            }
            if (typeof item.latitude === "number" && !isNaN(item.latitude)) {
              suggestion.latitude = item.latitude;
            }
            if (typeof item.longitude === "number" && !isNaN(item.longitude)) {
              suggestion.longitude = item.longitude;
            }
            if (typeof item.type === "string") {
              suggestion.type = item.type;
            }
            return suggestion;
          }
          return null;
        })
        .filter((item: AutocompleteSuggestion | null): item is AutocompleteSuggestion => Boolean(item && item.value));

      // Prioritize place suggestions over generic keyword completions if mixed
      suggestions.sort((a, b) => {
        const aIsPlace = a.type === "place" || Boolean(a.subtext);
        const bIsPlace = b.type === "place" || Boolean(b.subtext);
        if (aIsPlace && !bIsPlace) return -1;
        if (!aIsPlace && bIsPlace) return 1;
        return 0;
      });

      // Store in memory cache (cap cache at 300 entries to prevent memory growth)
      if (cache.size > 300) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) cache.delete(oldestKey);
      }
      cache.set(cacheKey, {
        suggestions,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return Response.json({ suggestions });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      logger.warn("address_autocomplete.fetch_aborted_or_failed", {
        message: fetchError?.message,
      });
      return Response.json({ suggestions: [] });
    }
  } catch (error: any) {
    logger.error("address_autocomplete.unhandled_exception", { error });
    return Response.json({ suggestions: [] });
  }
}
