/**
 * Integration Test: Prisma Decimal Serialization & Server Action Boundary Protection
 * HT Mobile Services — Problem 2 Regression Suite
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import { serializeDecimal, serializePrisma } from "../../../frontend/src/lib/utils/serialize-prisma.ts";

// Mock Prisma Decimal object matching Decimal.js internals used by Prisma Client
class MockPrismaDecimal {
  constructor(value) {
    this.value = String(value);
    this.d = [Number(value)];
    this.e = 2;
    this.s = 1;
  }
  toNumber() {
    return Number(this.value);
  }
  toFixed(digits = 2) {
    return Number(this.value).toFixed(digits);
  }
  toString() {
    return this.value;
  }
  valueOf() {
    return this.value;
  }
}

// Simulates Server Action completeAndQuoteAction return boundary
function simulateCompleteAndQuoteActionResponse(mockDbBooking) {
  // Primary fix: Server Action returns serializeDecimal(updated)
  return {
    success: true,
    booking: serializeDecimal(mockDbBooking),
  };
}

export function runPrismaDecimalSerializationRegressionTests() {
  describe("Problem 2: Prisma Decimal Serialization Boundary (Integration)", () => {
    test("Quote Completion: Returns plain serializable number for totalAmount", () => {
      const rawPrismaBooking = {
        id: "book_test_101",
        status: "completed",
        paymentStatus: "quote_sent",
        totalAmount: new MockPrismaDecimal("145.50"),
        extraServices: [
          { name: "Laser Balancing", price: 30.0 },
        ],
        notes: "Torqued lugs to spec",
        createdAt: new Date("2026-10-01T10:00:00.000Z"),
        updatedAt: new Date("2026-10-01T11:00:00.000Z"),
      };

      const res = simulateCompleteAndQuoteActionResponse(rawPrismaBooking);
      assert(res.success, "Action response must be successful");
      assertEqual(typeof res.booking.totalAmount, "number", "totalAmount must serialize as a primitive number");
      assertEqual(res.booking.totalAmount, 145.50);

      // Verify no Decimal instance remains
      assert(!(res.booking.totalAmount instanceof MockPrismaDecimal), "Must not be Decimal instance");

      // Verify valid JSON serializability for Next.js flight protocol
      const jsonString = JSON.stringify(res);
      const parsed = JSON.parse(jsonString);
      assertEqual(parsed.booking.totalAmount, 145.50);
    });

    test("Financial Precision: Preserves exact values for varied price scales", () => {
      const testCases = [
        { raw: "30.00", expected: 30.0 },
        { raw: "85.25", expected: 85.25 },
        { raw: "145.50", expected: 145.5 },
        { raw: "999.99", expected: 999.99 },
        { raw: "5000.00", expected: 5000.0 },
      ];

      for (const { raw, expected } of testCases) {
        const rawBooking = {
          id: "book_scale",
          totalAmount: new MockPrismaDecimal(raw),
        };
        const res = simulateCompleteAndQuoteActionResponse(rawBooking);
        assertEqual(res.booking.totalAmount, expected, `Precision failed for ${raw}`);
      }
    });

    test("Null & Undefined Handling: totalAmount = null serializes cleanly", () => {
      const rawBookingWithNull = {
        id: "book_pending",
        totalAmount: null,
      };
      const res = simulateCompleteAndQuoteActionResponse(rawBookingWithNull);
      assertEqual(res.booking.totalAmount, null);

      const rawBookingUndefined = {
        id: "book_undef",
        totalAmount: undefined,
      };
      const resUndef = simulateCompleteAndQuoteActionResponse(rawBookingUndefined);
      assertEqual(resUndef.booking.totalAmount, undefined);
    });

    test("Nested Decimal Serialization: Handles nested service price & depositAmount", () => {
      const rawBookingWithService = {
        id: "book_nested",
        totalAmount: new MockPrismaDecimal("180.00"),
        service: {
          id: "srv_1",
          name: "New Tire Installation",
          price: new MockPrismaDecimal("150.00"),
          depositAmount: new MockPrismaDecimal("25.00"),
        },
      };

      const res = simulateCompleteAndQuoteActionResponse(rawBookingWithService);
      assertEqual(typeof res.booking.totalAmount, "number");
      assertEqual(res.booking.totalAmount, 180.0);
      assertEqual(typeof res.booking.service.price, "number");
      assertEqual(res.booking.service.price, 150.0);
      assertEqual(typeof res.booking.service.depositAmount, "number");
      assertEqual(res.booking.service.depositAmount, 25.0);
    });

    test("serializePrisma alias maintains identical behavior", () => {
      const testObj = {
        price: new MockPrismaDecimal("95.00"),
      };
      const direct = serializeDecimal(testObj);
      const aliased = serializePrisma(testObj);
      assertEqual(direct.price, aliased.price);
      assertEqual(typeof aliased.price, "number");
    });
  });
}
