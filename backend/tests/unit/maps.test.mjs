/**
 * Unit Tests: Google Maps Navigation URL Generator
 * HT Mobile Services / Phase 3A
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import { buildGoogleMapsUrl } from "../../../frontend/src/lib/utils/maps.ts";

export function runMapsUnitTests() {
  describe("Google Maps URL Generator (Unit)", () => {
    test("Valid coordinates generate turn-by-turn navigation URL", () => {
      const url = buildGoogleMapsUrl({ latitude: 32.7767, longitude: -96.797 });
      assertEqual(url, "https://www.google.com/maps/dir/?api=1&destination=32.7767,-96.797");
    });

    test("Zero coordinates (0, 0) are handled as valid coordinates", () => {
      const url = buildGoogleMapsUrl({ latitude: 0, longitude: 0 });
      assertEqual(url, "https://www.google.com/maps/dir/?api=1&destination=0,0");
    });

    test("Negative coordinates are correctly preserved", () => {
      const url = buildGoogleMapsUrl({ latitude: -33.8688, longitude: -70.6693 });
      assertEqual(url, "https://www.google.com/maps/dir/?api=1&destination=-33.8688,-70.6693");
    });

    test("Coordinates take precedence over formattedAddress and location", () => {
      const url = buildGoogleMapsUrl({
        latitude: 32.7767,
        longitude: -96.797,
        formattedAddress: "123 Elm St, Dallas, TX 75201",
        location: "Dallas Downtown",
      });
      assertEqual(url, "https://www.google.com/maps/dir/?api=1&destination=32.7767,-96.797");
    });

    test("Formatted address is used when coordinates are null or missing", () => {
      const url = buildGoogleMapsUrl({
        latitude: null,
        longitude: null,
        formattedAddress: "123 Main St, Dallas, TX 75201",
        location: "Downtown",
      });
      assertEqual(url, "https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Dallas%2C%20TX%2075201");
    });

    test("Raw location is used when coordinates and formattedAddress are missing", () => {
      const url = buildGoogleMapsUrl({
        location: "777 Commerce St, Dallas, TX",
      });
      assertEqual(url, "https://www.google.com/maps/search/?api=1&query=777%20Commerce%20St%2C%20Dallas%2C%20TX");
    });

    test("Invalid/Non-finite coordinates fall back to formattedAddress", () => {
      const url = buildGoogleMapsUrl({
        latitude: NaN,
        longitude: Infinity,
        formattedAddress: "456 Oak Rd, Plano, TX",
      });
      assertEqual(url, "https://www.google.com/maps/search/?api=1&query=456%20Oak%20Rd%2C%20Plano%2C%20TX");
    });

    test("Out-of-range coordinates fall back to text address", () => {
      const url = buildGoogleMapsUrl({
        latitude: 95.5, // > 90
        longitude: -96.7,
        formattedAddress: "789 Pine Ave, Arlington, TX",
      });
      assertEqual(url, "https://www.google.com/maps/search/?api=1&query=789%20Pine%20Ave%2C%20Arlington%2C%20TX");
    });

    test("Special characters in address are properly URI encoded", () => {
      const url = buildGoogleMapsUrl({
        formattedAddress: "Suite #200 & B, 100 Main St, Dallas/Fort Worth, TX",
      });
      assertEqual(
        url,
        "https://www.google.com/maps/search/?api=1&query=Suite%20%23200%20%26%20B%2C%20100%20Main%20St%2C%20Dallas%2FFort%20Worth%2C%20TX"
      );
    });

    test("Empty or whitespace-only inputs return absolute maps fallback", () => {
      assertEqual(buildGoogleMapsUrl({}), "https://www.google.com/maps");
      assertEqual(buildGoogleMapsUrl(null), "https://www.google.com/maps");
      assertEqual(buildGoogleMapsUrl(undefined), "https://www.google.com/maps");
      assertEqual(buildGoogleMapsUrl({ formattedAddress: "   ", location: "" }), "https://www.google.com/maps");
    });
  });
}

// Direct execution support
if (process.argv[1]?.endsWith("maps.test.mjs")) {
  runMapsUnitTests();
}
