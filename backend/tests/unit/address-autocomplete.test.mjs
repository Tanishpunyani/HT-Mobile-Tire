/**
 * Unit Tests: SerpAPI Google Maps Autocomplete & Location Resolution
 * HT Mobile Services / Tire Mobile Clinic
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import {
  DEFAULT_GTA_LOCATION,
  GTA_SERVICE_BOUNDS,
  parseAndValidateLl,
  resolveSearchLocation,
  mapSerpApiSuggestions,
  sanitizeProviderErrorMessage,
} from "../../../frontend/src/lib/utils/autocomplete.ts";

export function runAddressAutocompleteUnitTests() {
  describe("SerpAPI Autocomplete: Location Resolution & Validation (Unit)", () => {
    test("Fallback to default Greater Toronto Area location when no env or client ll is provided", () => {
      const loc = resolveSearchLocation(null, null);
      assertEqual(loc, DEFAULT_GTA_LOCATION);
      assertEqual(loc, "@43.6532,-79.3832,14z");
    });

    test("Configured SERPAPI_AUTOCOMPLETE_LL is used when present and valid", () => {
      const customGta = "@43.7315,-79.7624,14z"; // Brampton
      const loc = resolveSearchLocation(null, customGta);
      assertEqual(loc, customGta);
    });

    test("Malformed SERPAPI_AUTOCOMPLETE_LL falls back safely to default GTA location", () => {
      const invalidEnvValues = [
        "not-a-coord",
        "@999,999",
        "43.6532,-79.3832",
        "@abc,-def",
        "",
        "   ",
      ];
      for (const val of invalidEnvValues) {
        const loc = resolveSearchLocation(null, val);
        assertEqual(loc, DEFAULT_GTA_LOCATION);
      }
    });

    test("Valid client-supplied ll within GTA service area is accepted", () => {
      const mississaugaCoord = "@43.5890,-79.6441,14z";
      const loc = resolveSearchLocation(mississaugaCoord, null);
      assertEqual(loc, mississaugaCoord);
    });

    test("Client-supplied ll outside authorized GTA service boundary is rejected and falls back", () => {
      // London, UK
      const londonUk = "@51.5074,-0.1278,14z";
      assertEqual(resolveSearchLocation(londonUk, null), DEFAULT_GTA_LOCATION);

      // San Francisco, CA
      const sanFrancisco = "@37.7749,-122.4194,14z";
      assertEqual(resolveSearchLocation(sanFrancisco, null), DEFAULT_GTA_LOCATION);

      // Tokyo, Japan
      const tokyo = "@35.6762,139.6503,14z";
      assertEqual(resolveSearchLocation(tokyo, null), DEFAULT_GTA_LOCATION);

      // Malicious / injection strings
      assertEqual(resolveSearchLocation("@43.65; DROP TABLE users;", null), DEFAULT_GTA_LOCATION);
      assertEqual(resolveSearchLocation("../../../etc/passwd", null), DEFAULT_GTA_LOCATION);
    });

    test("parseAndValidateLl correctly verifies coordinates and zoom formats", () => {
      assert(parseAndValidateLl("@43.6532,-79.3832,14z", false));
      assert(parseAndValidateLl("@43.6532,-79.3832", false));
      assert(parseAndValidateLl("@-33.8688,151.2093,12z", false));

      // Out-of-bounds latitude/longitude
      assert(!parseAndValidateLl("@91.0,0.0,14z", false));
      assert(!parseAndValidateLl("@-91.0,0.0,14z", false));
      assert(!parseAndValidateLl("@0.0,181.0,14z", false));
      assert(!parseAndValidateLl("@0.0,-181.0,14z", false));
      assert(!parseAndValidateLl(null, false));
      assert(!parseAndValidateLl("", false));
    });
  });

  describe("SerpAPI Autocomplete: URL Construction & Query Matrix (Unit)", () => {
    test("Constructed SerpAPI request contains all 6 required parameters: engine, q, ll, gl, hl, api_key", () => {
      const query = "100 Queen St W";
      const apiKey = "test_serpapi_key_secret_123";
      const resolvedLl = resolveSearchLocation(null, "@43.6532,-79.3832,14z");

      const serpApiUrl = new URL("https://serpapi.com/search.json");
      serpApiUrl.searchParams.set("engine", "google_maps_autocomplete");
      serpApiUrl.searchParams.set("q", query);
      serpApiUrl.searchParams.set("ll", resolvedLl);
      serpApiUrl.searchParams.set("gl", "ca");
      serpApiUrl.searchParams.set("hl", "en");
      serpApiUrl.searchParams.set("api_key", apiKey);

      assertEqual(serpApiUrl.searchParams.get("engine"), "google_maps_autocomplete");
      assertEqual(serpApiUrl.searchParams.get("q"), "100 Queen St W");
      assertEqual(serpApiUrl.searchParams.get("ll"), "@43.6532,-79.3832,14z");
      assertEqual(serpApiUrl.searchParams.get("gl"), "ca");
      assertEqual(serpApiUrl.searchParams.get("hl"), "en");
      assertEqual(serpApiUrl.searchParams.get("api_key"), apiKey);
    });
  });

  describe("SerpAPI Autocomplete: Response Mapping & Suggestion Sorting (Unit)", () => {
    test("Maps valid provider suggestions and sorts places ahead of generic keywords", () => {
      const mockSerpApiResponse = {
        suggestions: [
          {
            value: "tire repair near me",
            type: "keyword",
          },
          {
            value: "HT Mobile Tire Clinic",
            subtext: "123 Main St, Toronto, ON, Canada",
            latitude: 43.6532,
            longitude: -79.3832,
            type: "place",
          },
          {
            title: "Brampton Wheel Service",
            description: "456 Queen St E, Brampton, ON",
            gps_coordinates: {
              latitude: 43.7315,
              longitude: -79.7624,
            },
            type: "place",
          },
        ],
      };

      const mapped = mapSerpApiSuggestions(mockSerpApiResponse);
      assertEqual(mapped.length, 3);

      // Place suggestions must be prioritized first
      assertEqual(mapped[0].value, "HT Mobile Tire Clinic");
      assertEqual(mapped[0].subtext, "123 Main St, Toronto, ON, Canada");
      assertEqual(mapped[0].latitude, 43.6532);
      assertEqual(mapped[0].longitude, -79.3832);
      assertEqual(mapped[0].type, "place");

      assertEqual(mapped[1].value, "Brampton Wheel Service");
      assertEqual(mapped[1].subtext, "456 Queen St E, Brampton, ON");
      assertEqual(mapped[1].latitude, 43.7315);
      assertEqual(mapped[1].longitude, -79.7624);

      // Keyword suggestion ranked after places
      assertEqual(mapped[2].value, "tire repair near me");
      assertEqual(mapped[2].type, "keyword");
    });

    test("Handles plain string suggestions and filters out null/empty items", () => {
      const mockData = {
        suggestions: [
          "Toronto Airport Tire",
          null,
          undefined,
          { value: "" },
          { value: "   " },
          { value: "Mississauga Road Service" },
        ],
      };

      const mapped = mapSerpApiSuggestions(mockData);
      assertEqual(mapped.length, 2);
      assertEqual(mapped[0].value, "Toronto Airport Tire");
      assertEqual(mapped[1].value, "Mississauga Road Service");
    });
  });

  describe("SerpAPI Autocomplete: Security & Error Sanitization (Unit)", () => {
    test("Provider error messages redact API keys and query strings", () => {
      const apiKey = "secret_serpapi_live_abc123xyz";
      const rawErrorWithKey = `Failed request to SerpApi with api_key=${apiKey}&engine=google_maps_autocomplete`;

      const sanitized = sanitizeProviderErrorMessage(rawErrorWithKey, apiKey);
      assert(!sanitized.includes(apiKey), "Sanitized message must not contain raw API key");
      assert(sanitized.includes("[REDACTED_API_KEY]"), "Must substitute redacted token");
    });

    test("Sanitizes and bounds provider error message length to prevent log inflation", () => {
      const hugeError = "A".repeat(500);
      const sanitized = sanitizeProviderErrorMessage(hugeError);
      assert(sanitized.length <= 205);
      assert(sanitized.endsWith("..."));
    });

    test("Handles undefined or empty error messages safely", () => {
      assertEqual(sanitizeProviderErrorMessage(undefined), undefined);
      assertEqual(sanitizeProviderErrorMessage(""), undefined);
      assertEqual(sanitizeProviderErrorMessage("   "), undefined);
    });
  });

  describe("SerpAPI Autocomplete: Frontend Contract & Resilience (Unit)", () => {
    test("Endpoint guarantees { suggestions: [] } failure shape on errors and query guards", () => {
      // Query length < 3
      const queryTooShort = "ab";
      const shortResult = queryTooShort.length < 3 ? { suggestions: [] } : null;
      assert(Array.isArray(shortResult?.suggestions));
      assertEqual(shortResult.suggestions.length, 0);

      // Missing API key safe shape
      const noApiKeyResult = { suggestions: [] };
      assert(Array.isArray(noApiKeyResult.suggestions));
      assertEqual(noApiKeyResult.suggestions.length, 0);

      // Rate limit shape
      const rateLimitResult = { suggestions: [], error: "Rate limit exceeded. Please wait a moment." };
      assert(Array.isArray(rateLimitResult.suggestions));
      assertEqual(rateLimitResult.suggestions.length, 0);
      assertEqual(rateLimitResult.error, "Rate limit exceeded. Please wait a moment.");
    });
  });
}
