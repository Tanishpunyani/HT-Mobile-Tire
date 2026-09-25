/**
 * Unit Tests: Zod Validation Schemas
 * HT Mobile Services
 */

import { describe, test, assert } from "../helpers/test-runner.mjs";
import { z } from "zod";

// Replicating actual domain schemas for deterministic unit testing
const bookingSchema = z.object({
  serviceType: z.string().min(1, "Service type is required"),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  scheduledTime: z.string().min(1, "Time is required"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid E.164 or US phone number"),
  vehicleDetails: z.object({
    year: z.string().regex(/^\d{4}$/, "Year must be 4 digits"),
    make: z.string().min(1),
    model: z.string().min(1),
    tireSize: z.string().optional(),
  }),
});

const emergencySchema = z.object({
  name: z.string().min(1),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  location: z.string().min(3),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  issueDescription: z.string().min(3),
});

const completeQuoteSchema = z.object({
  bookingId: z.string().min(1),
  extraServices: z
    .array(
      z.object({
        description: z.string().min(1),
        amount: z.number().nonnegative(),
      })
    )
    .optional(),
  customerNote: z.string().max(500).optional(),
});

export function runValidationTests() {
  describe("Zod Validation Schemas (Unit)", () => {
    test("Valid booking data is accepted", () => {
      const valid = {
        serviceType: "Flat Tire Repair",
        scheduledDate: "2026-10-15",
        scheduledTime: "09:00 AM",
        address: "123 Main St, Dallas, TX",
        phone: "12145550199",
        latitude: 32.7767,
        longitude: -96.797,
        vehicleDetails: {
          year: "2023",
          make: "Honda",
          model: "Accord",
          tireSize: "225/50R17",
        },
      };
      const result = bookingSchema.safeParse(valid);
      assert(result.success, "Valid booking payload should pass validation");
    });

    test("Booking with malformed date format is rejected", () => {
      const invalid = {
        serviceType: "Flat Tire Repair",
        scheduledDate: "15-10-2026", // invalid format
        scheduledTime: "09:00 AM",
        address: "123 Main St, Dallas, TX",
        phone: "12145550199",
        vehicleDetails: { year: "2023", make: "Honda", model: "Accord" },
      };
      const result = bookingSchema.safeParse(invalid);
      assert(!result.success, "Invalid date format should fail");
    });

    test("Booking with invalid phone number is rejected", () => {
      const invalid = {
        serviceType: "Flat Tire Repair",
        scheduledDate: "2026-10-15",
        scheduledTime: "09:00 AM",
        address: "123 Main St, Dallas, TX",
        phone: "invalid-phone",
        vehicleDetails: { year: "2023", make: "Honda", model: "Accord" },
      };
      const result = bookingSchema.safeParse(invalid);
      assert(!result.success, "Invalid phone should fail");
    });

    test("Emergency request requiring mandatory GPS coordinates is accepted", () => {
      const validEmergency = {
        name: "Driver In Distress",
        phone: "12145559999",
        location: "I-35E & Loop 12, Dallas, TX",
        latitude: 32.785,
        longitude: -96.81,
        issueDescription: "Blown steer tire on highway shoulder",
      };
      const result = emergencySchema.safeParse(validEmergency);
      assert(result.success, "Valid emergency request should pass");
    });

    test("Emergency request with out-of-range latitude is rejected", () => {
      const invalidEmergency = {
        name: "Driver",
        phone: "12145559999",
        location: "I-35E, Dallas, TX",
        latitude: 195.0, // out of bounds
        longitude: -96.81,
        issueDescription: "Blown tire",
      };
      const result = emergencySchema.safeParse(invalidEmergency);
      assert(!result.success, "Latitude > 90 must fail");
    });

    test("Complete quote schema with positive extra charges is accepted", () => {
      const validQuote = {
        bookingId: "book_101",
        extraServices: [
          { description: "Valve stem replacement", amount: 15.0 },
          { description: "Disposal fee", amount: 5.0 },
        ],
        customerNote: "Completed in 35 minutes",
      };
      const result = completeQuoteSchema.safeParse(validQuote);
      assert(result.success, "Valid quote payload should pass");
    });

    test("Complete quote schema with negative amount is rejected", () => {
      const invalidQuote = {
        bookingId: "book_101",
        extraServices: [{ description: "Invalid discount", amount: -25.0 }],
      };
      const result = completeQuoteSchema.safeParse(invalidQuote);
      assert(!result.success, "Negative charge amount must fail");
    });
  });
}
