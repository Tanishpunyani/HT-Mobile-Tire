import { checkRateLimitDistributed, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  type AutocompleteSuggestion,
  resolveSearchLocation,
  mapSerpApiSuggestions,
  sanitizeProviderErrorMessage,
} from "@/lib/utils/autocomplete";

export type { AutocompleteSuggestion };

interface CacheEntry {
  suggestions: AutocompleteSuggestion[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache to preserve SerpApi quota

// Periodic stale cache sweep
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now > entry.expiresAt) {
        cache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export async function GET(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimitDistributed("address_autocomplete", clientIp, 10, 60 * 1000);

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

    const resolvedLl = resolveSearchLocation(searchParams.get("ll"));
    const cacheKey = `${resolvedLl}:${query.toLowerCase()}`;
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
    serpApiUrl.searchParams.set("engine", "google_maps_autocomplete");
    serpApiUrl.searchParams.set("q", query);
    serpApiUrl.searchParams.set("ll", resolvedLl);
    serpApiUrl.searchParams.set("gl", "ca");
    serpApiUrl.searchParams.set("hl", "en");
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
        let providerError: string | undefined;
        try {
          const errorText = await response.text();
          try {
            const parsed = JSON.parse(errorText);
            providerError =
              typeof parsed?.error === "string"
                ? parsed.error
                : typeof parsed?.message === "string"
                ? parsed.message
                : errorText.slice(0, 150);
          } catch {
            providerError = errorText.slice(0, 150);
          }
        } catch {
          // Ignore read error
        }

        const sanitizedError = sanitizeProviderErrorMessage(providerError, apiKey);

        logger.warn("address_autocomplete.serpapi_error", {
          status: response.status,
          statusText: response.statusText,
          ...(sanitizedError ? { providerMessage: sanitizedError } : {}),
        });
        return Response.json({ suggestions: [] });
      }

      const data = await response.json();
      const suggestions = mapSerpApiSuggestions(data);

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
      const rawMessage = fetchError?.message || String(fetchError);
      const sanitizedMessage = sanitizeProviderErrorMessage(rawMessage, apiKey);
      logger.warn("address_autocomplete.fetch_aborted_or_failed", {
        message: sanitizedMessage,
      });
      return Response.json({ suggestions: [] });
    }
  } catch (error: any) {
    logger.error("address_autocomplete.unhandled_exception", { error });
    return Response.json({ suggestions: [] });
  }
}
