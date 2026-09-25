/**
 * HT Mobile Tires — Central Dynamic Technician Arrival ETA Utility
 *
 * Single source of truth for calculating customer-safe estimated arrival times.
 * Pure server-side logic using Great-Circle Haversine distance, realistic road
 * tortuosity factors, and technician GPS signal freshness.
 *
 * PRIVACY GUARANTEE:
 * Returns derived timing and presentation states ONLY. Never exposes raw GPS
 * coordinates, speed, heading, or telemetry to customer viewports.
 */

// Central Named Constants
export const ROAD_FACTOR = 1.25; // Urban road network distance multiplier
export const AVERAGE_SPEED_MPH = 28; // Realistic average mobile service van speed in urban/suburban traffic
export const MIN_ETA_MINUTES = 3; // Minimum realistic arrival buffer
export const DISPATCH_BUFFER_MINUTES = 2; // Parking, equipment prep, and access buffer
export const FRESH_AGE_MS = 60 * 1000; // 60 seconds = live signal
export const STALE_AGE_MS = 5 * 60 * 1000; // 5 minutes = stale signal (recalculating)

export type ArrivalStatus =
  | "unavailable" // No technician assigned yet or terminal state
  | "updating" // Technician assigned but GPS offline / stale / coordinates missing
  | "estimated" // Valid dynamic arrival estimate available
  | "arrived" // Technician has arrived on-site
  | "in_progress"; // Technician is currently working on vehicle

export interface CustomerEtaResult {
  arrivalStatus: ArrivalStatus;
  etaMinutes: number | null;
  estimatedArrivalAt: string | null;
  distanceMiles: number | null;
  updatedAt: string | null;
}

export interface BookingEtaInput {
  status: string;
  technicianId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  arrivedAt?: Date | string | null;
}

export interface TechnicianLocationEtaInput {
  latitude: number;
  longitude: number;
  isActive?: boolean;
  updatedAt: Date | string;
}

/**
 * Calculates Great-Circle distance between two coordinates in miles (Haversine formula).
 */
export function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return 0;
  }

  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Number((R * c).toFixed(2));
}

/**
 * Calculates dynamic technician arrival ETA from real server-side inputs.
 * Strictly outputs customer-safe presentation values.
 */
export function calculateCustomerEta(
  booking: BookingEtaInput | null | undefined,
  technicianLocation: TechnicianLocationEtaInput | null | undefined
): CustomerEtaResult {
  if (!booking) {
    return {
      arrivalStatus: "unavailable",
      etaMinutes: null,
      estimatedArrivalAt: null,
      distanceMiles: null,
      updatedAt: null,
    };
  }

  // 1. Terminal booking states have no arrival ETA
  if (booking.status === "completed" || booking.status === "cancelled") {
    return {
      arrivalStatus: "unavailable",
      etaMinutes: null,
      estimatedArrivalAt: null,
      distanceMiles: null,
      updatedAt: null,
    };
  }

  // 2. Technician on-site arrival overrides all travel estimates
  if (booking.arrivedAt) {
    return {
      arrivalStatus: "arrived",
      etaMinutes: null,
      estimatedArrivalAt: null,
      distanceMiles: null,
      updatedAt: new Date(booking.arrivedAt).toISOString(),
    };
  }

  // 3. Service in progress on vehicle has no future arrival ETA
  if (booking.status === "in_progress") {
    return {
      arrivalStatus: "in_progress",
      etaMinutes: null,
      estimatedArrivalAt: null,
      distanceMiles: null,
      updatedAt: null,
    };
  }

  // 4. Pending or unassigned booking
  if (booking.status === "pending" || !booking.technicianId) {
    return {
      arrivalStatus: "unavailable",
      etaMinutes: null,
      estimatedArrivalAt: null,
      distanceMiles: null,
      updatedAt: null,
    };
  }

  // 5. Technician assigned, but no GPS broadcast or inactive
  if (!technicianLocation || technicianLocation.isActive === false) {
    return {
      arrivalStatus: "updating",
      etaMinutes: null,
      estimatedArrivalAt: null,
      distanceMiles: null,
      updatedAt: null,
    };
  }

  // 6. Check GPS Signal Freshness
  const techUpdatedAt = new Date(technicianLocation.updatedAt).getTime();
  if (isNaN(techUpdatedAt)) {
    return {
      arrivalStatus: "updating",
      etaMinutes: null,
      estimatedArrivalAt: null,
      distanceMiles: null,
      updatedAt: null,
    };
  }

  const ageMs = Math.max(0, Date.now() - techUpdatedAt);

  // If GPS signal is older than 5 minutes (offline/stale), mark as updating
  if (ageMs > STALE_AGE_MS) {
    return {
      arrivalStatus: "updating",
      etaMinutes: null,
      estimatedArrivalAt: null,
      distanceMiles: null,
      updatedAt: new Date(techUpdatedAt).toISOString(),
    };
  }

  // 7. Check Customer Coordinates
  const custLat = booking.latitude;
  const custLng = booking.longitude;
  if (
    typeof custLat !== "number" ||
    !Number.isFinite(custLat) ||
    typeof custLng !== "number" ||
    !Number.isFinite(custLng)
  ) {
    return {
      arrivalStatus: "updating",
      etaMinutes: null,
      estimatedArrivalAt: null,
      distanceMiles: null,
      updatedAt: new Date(techUpdatedAt).toISOString(),
    };
  }

  // 8. Compute Real Dynamic Haversine Travel Distance
  const straightDistance = haversineDistanceMiles(
    technicianLocation.latitude,
    technicianLocation.longitude,
    custLat,
    custLng
  );

  const roadDistance = straightDistance * ROAD_FACTOR;
  const travelMinutes = (roadDistance / AVERAGE_SPEED_MPH) * 60;
  const etaMinutes = Math.max(
    MIN_ETA_MINUTES,
    Math.round(travelMinutes) + DISPATCH_BUFFER_MINUTES
  );

  const arrivalTimeMs = Date.now() + etaMinutes * 60 * 1000;
  const estimatedArrivalAt = new Date(arrivalTimeMs).toISOString();

  return {
    arrivalStatus: "estimated",
    etaMinutes,
    estimatedArrivalAt,
    distanceMiles: Number(roadDistance.toFixed(1)),
    updatedAt: new Date(techUpdatedAt).toISOString(),
  };
}
