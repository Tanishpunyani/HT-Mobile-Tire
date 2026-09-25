/**
 * Unit Tests: Data Serialization & Sanitized DTO Generation
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

function sanitizeCustomerDto(rawCustomer) {
  if (!rawCustomer) return null;
  return {
    id: rawCustomer.id,
    name: rawCustomer.name || "",
    email: rawCustomer.email || "",
    phone: rawCustomer.phone || "",
    role: "customer",
    // Must NOT leak password hash or internal secret tokens
  };
}

function serializeBookingForApi(rawBooking) {
  if (!rawBooking) return null;
  return {
    id: rawBooking.id,
    customerId: rawBooking.customerId,
    serviceType: rawBooking.serviceType,
    status: rawBooking.status,
    paymentStatus: rawBooking.paymentStatus,
    scheduledDate: rawBooking.scheduledDate,
    scheduledTime: rawBooking.scheduledTime,
    address: rawBooking.address,
    // Convert Prisma Decimal to primitive Number
    price: rawBooking.price != null ? Number(rawBooking.price) : 0,
    extraCharges: rawBooking.extraCharges != null ? Number(rawBooking.extraCharges) : 0,
    totalPrice:
      (rawBooking.price != null ? Number(rawBooking.price) : 0) +
      (rawBooking.extraCharges != null ? Number(rawBooking.extraCharges) : 0),
    createdAt: rawBooking.createdAt instanceof Date ? rawBooking.createdAt.toISOString() : rawBooking.createdAt,
  };
}

function sanitizeTrackingDtoForCustomer(telemetry) {
  if (!telemetry) return null;
  return {
    bookingId: telemetry.bookingId,
    latitude: telemetry.latitude,
    longitude: telemetry.longitude,
    heading: telemetry.heading || 0,
    speed: telemetry.speed || 0,
    updatedAt: telemetry.timestamp || Date.now(),
    // Exclude raw technician personal cell phone, internal GPS device IMEI, etc.
  };
}

export function runSerializationTests() {
  describe("Data Serialization & DTO Sanitization (Unit)", () => {
    test("Customer DTO strips out password hashes and internal keys", () => {
      const internalCustomer = {
        id: "cust_1",
        name: "Alice",
        email: "alice@example.com",
        phone: "2145550101",
        passwordHash: "$2a$12$eX4mpL3H45hV4Lu3",
        secretToken: "internal_secret_999",
      };
      const dto = sanitizeCustomerDto(internalCustomer);
      assertEqual(dto.id, "cust_1");
      assertEqual(dto.name, "Alice");
      assertEqual(dto.passwordHash, undefined, "passwordHash must not leak");
      assertEqual(dto.secretToken, undefined, "secretToken must not leak");
    });

    test("Prisma Decimal objects correctly convert to primitive JS Numbers in JSON", () => {
      // Mocking Prisma Decimal structure
      const fakeDecimal = {
        toNumber: () => 145.5,
        valueOf: () => "145.5",
        toString: () => "145.5",
      };
      const rawBooking = {
        id: "b_1",
        customerId: "c_1",
        serviceType: "Tire Installation",
        status: "confirmed",
        paymentStatus: "pending",
        scheduledDate: "2026-10-15",
        scheduledTime: "10:00 AM",
        address: "100 Main St",
        price: fakeDecimal,
        extraCharges: 25.0,
        createdAt: new Date("2026-10-01T12:00:00.000Z"),
      };
      const serialized = serializeBookingForApi(rawBooking);
      assertEqual(typeof serialized.price, "number", "price must serialize as number");
      assertEqual(serialized.price, 145.5);
      assertEqual(serialized.totalPrice, 170.5);
      assertEqual(typeof serialized.createdAt, "string");
    });

    test("Tracking DTO provides sanitized GPS fields without raw hardware telemetry", () => {
      const rawTelemetry = {
        bookingId: "b_100",
        technicianId: "tech_1",
        latitude: 32.7767,
        longitude: -96.797,
        heading: 90,
        speed: 30,
        rawImei: "990000862471854",
        batteryLevel: "98%",
        timestamp: 1700000000000,
      };
      const customerDto = sanitizeTrackingDtoForCustomer(rawTelemetry);
      assertEqual(customerDto.bookingId, "b_100");
      assertEqual(customerDto.latitude, 32.7767);
      assertEqual(customerDto.rawImei, undefined, "IMEI must not be exposed");
      assertEqual(customerDto.batteryLevel, undefined, "Battery telemetry must not be exposed");
    });
  });
}
