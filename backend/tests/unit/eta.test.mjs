/**
 * Unit Tests: ETA Calculation & Freshness Utilities
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

function calculateHaversineDistanceMiles(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateETA({ techLat, techLon, destLat, destLon, speedMph = 30 }) {
  if (techLat == null || techLon == null || destLat == null || destLon == null) {
    return { error: "Missing coordinates" };
  }
  const distanceMiles = calculateHaversineDistanceMiles(techLat, techLon, destLat, destLon);
  if (distanceMiles < 0.05) {
    return {
      distanceMiles: 0,
      durationMinutes: 0,
      statusText: "Arrived",
    };
  }
  const effectiveSpeed = Math.max(speedMph, 15);
  const durationHours = distanceMiles / effectiveSpeed;
  const durationMinutes = Math.max(1, Math.round(durationHours * 60));
  return {
    distanceMiles: Number(distanceMiles.toFixed(1)),
    durationMinutes,
    statusText: `${durationMinutes} min away (${distanceMiles.toFixed(1)} miles)`,
  };
}

function getTelemetryFreshness(timestampMs, now = Date.now()) {
  const ageSeconds = Math.floor((now - timestampMs) / 1000);
  if (ageSeconds < 30) return "live";
  if (ageSeconds < 120) return "delayed";
  return "stale";
}

export function runEtaTests() {
  describe("ETA Calculation & GPS Freshness (Unit)", () => {
    test("Zero distance returns Arrived status and 0 duration", () => {
      const result = calculateETA({
        techLat: 32.7767,
        techLon: -96.797,
        destLat: 32.7767,
        destLon: -96.797,
      });
      assertEqual(result.durationMinutes, 0, "Duration should be 0");
      assertEqual(result.statusText, "Arrived", "Status should be Arrived");
    });

    test("Normal DFW distance (Dallas to Fort Worth ~30 miles) yields realistic ETA", () => {
      const result = calculateETA({
        techLat: 32.7767, // Dallas
        techLon: -96.797,
        destLat: 32.7555, // Fort Worth
        destLon: -97.3308,
        speedMph: 35,
      });
      assert(result.distanceMiles > 25 && result.distanceMiles < 35, "Distance ~31 miles");
      assert(result.durationMinutes > 40 && result.durationMinutes < 65, "ETA ~50-60 mins");
    });

    test("Close distance (< 1 mile) rounds to minimum 1-2 minutes", () => {
      const result = calculateETA({
        techLat: 32.7767,
        techLon: -96.797,
        destLat: 32.78,
        destLon: -96.799,
      });
      assert(result.durationMinutes >= 1, "Minimum duration should be at least 1 min");
    });

    test("Missing coordinates safely return error object without throwing", () => {
      const result = calculateETA({
        techLat: null,
        techLon: -96.797,
        destLat: 32.7767,
        destLon: -96.797,
      });
      assertEqual(result.error, "Missing coordinates");
    });

    test("GPS telemetry under 30 seconds old is classified as 'live'", () => {
      const now = 1000000;
      assertEqual(getTelemetryFreshness(now - 10000, now), "live");
    });

    test("GPS telemetry between 30-120 seconds old is classified as 'delayed'", () => {
      const now = 1000000;
      assertEqual(getTelemetryFreshness(now - 60000, now), "delayed");
    });

    test("GPS telemetry older than 120 seconds is classified as 'stale'", () => {
      const now = 1000000;
      assertEqual(getTelemetryFreshness(now - 180000, now), "stale");
    });
  });
}
