/**
 * Deterministic GPS & Telemetry Test Fixtures
 */

export const mockLocations = {
  dallasDowntown: {
    latitude: 32.7767,
    longitude: -96.797,
    address: "Downtown Dallas, TX",
  },
  fortWorthDowntown: {
    latitude: 32.7555,
    longitude: -97.3308,
    address: "Downtown Fort Worth, TX",
  },
  planoLegacy: {
    latitude: 33.0805,
    longitude: -96.8227,
    address: "Legacy West, Plano, TX",
  },
  arlingtonStadium: {
    latitude: 32.7473,
    longitude: -97.0945,
    address: "AT&T Stadium, Arlington, TX",
  },
};

export const mockTelemetryPacket = {
  bookingId: "book_alice_confirmed_102",
  technicianId: "tech_carlos_333",
  latitude: 32.779,
  longitude: -96.802,
  heading: 180,
  speed: 35,
  timestamp: Date.now(),
};
