/**
 * Unit Tests: Safari-Safe Date & Time Formatting Utility
 * HT Mobile Services / Admin Console
 *
 * Verifies compatibility for:
 * - PostgreSQL SQL TIME: "14:00:00", "12:00:00", "00:00:00", "16:30:00", "14:30"
 * - Prisma serialized SQL TIME: "1970-01-01T14:00:00.000Z"
 * - ISO timestamps: "2026-10-07T14:30:00Z"
 * - Bare SQL dates: "2026-10-05"
 * - Invalid, malformed, null, undefined values
 * - Null-safe status formatting
 * - Zero throw guarantee
 */

import { describe, test, assert, assertEqual, printSummaryAndExit, resetTestCounts } from "../helpers/test-runner.mjs";
import {
  safeParseDate,
  formatAdminTime,
  formatAdminDate,
  formatAdminDateTime,
  formatAdminStatus,
} from "../../../frontend/src/lib/utils/date-format.ts";

export function runSafariDateFormatTests() {
  describe("Safari-Safe Date Utility: safeParseDate", () => {
    test("Parses valid ISO timestamp string", () => {
      const d = safeParseDate("2026-10-07T14:30:00Z");
      assert(d instanceof Date, "Should return Date instance");
      assert(!isNaN(d.getTime()), "Date should be valid");
    });

    test("Parses bare SQL date string (YYYY-MM-DD)", () => {
      const d = safeParseDate("2026-10-05");
      assert(d instanceof Date, "Should return Date instance");
      assertEqual(d.getFullYear(), 2026);
      assertEqual(d.getMonth(), 9); // October (0-indexed)
      assertEqual(d.getDate(), 5);
    });

    test("Accepts existing valid Date instance", () => {
      const now = new Date();
      const d = safeParseDate(now);
      assertEqual(d, now);
    });

    test("Handles invalid Date instance safely without throwing", () => {
      const invalidDate = new Date("invalid-date-string");
      const d = safeParseDate(invalidDate);
      assertEqual(d, null);
    });

    test("Handles null, undefined, empty string safely", () => {
      assertEqual(safeParseDate(null), null);
      assertEqual(safeParseDate(undefined), null);
      assertEqual(safeParseDate(""), null);
      assertEqual(safeParseDate(false), null);
      assertEqual(safeParseDate({}), null);
    });

    test("Handles impossible / malformed date strings safely", () => {
      assertEqual(safeParseDate("not-a-date"), null);
      assertEqual(safeParseDate("2026-99-99"), null);
    });
  });

  describe("Safari-Safe Time Formatter: formatAdminTime", () => {
    test("Bare SQL TIME: 14:00:00 -> 02:00 PM", () => {
      assertEqual(formatAdminTime("14:00:00"), "02:00 PM");
    });

    test("Bare SQL TIME: 12:00:00 -> 12:00 PM", () => {
      assertEqual(formatAdminTime("12:00:00"), "12:00 PM");
    });

    test("Bare SQL TIME: 00:00:00 -> 12:00 AM", () => {
      assertEqual(formatAdminTime("00:00:00"), "12:00 AM");
    });

    test("Bare SQL TIME: 16:30:00 -> 04:30 PM", () => {
      assertEqual(formatAdminTime("16:30:00"), "04:30 PM");
    });

    test("Bare SQL TIME: 14:30 -> 02:30 PM", () => {
      assertEqual(formatAdminTime("14:30"), "02:30 PM");
    });

    test("Bare SQL TIME: 09:15:00 -> 09:15 AM", () => {
      assertEqual(formatAdminTime("09:15:00"), "09:15 AM");
    });

    test("Prisma serialized SQL TIME: 1970-01-01T14:00:00.000Z -> 02:00 PM", () => {
      assertEqual(formatAdminTime("1970-01-01T14:00:00.000Z"), "02:00 PM");
    });

    test("Prisma serialized SQL TIME: 1970-01-01T00:00:00.000Z -> 12:00 AM", () => {
      assertEqual(formatAdminTime("1970-01-01T00:00:00.000Z"), "12:00 AM");
    });

    test("Prisma serialized SQL TIME: 1970-01-01T16:30:00.000Z -> 04:30 PM", () => {
      assertEqual(formatAdminTime("1970-01-01T16:30:00.000Z"), "04:30 PM");
    });

    test("Full ISO timestamp formats with locale time", () => {
      const iso = "2026-10-07T14:30:00Z";
      const formatted = formatAdminTime(iso);
      assert(typeof formatted === "string" && formatted.length > 0, "Should format ISO timestamp");
      assert(formatted.includes("AM") || formatted.includes("PM"), "Should include AM/PM");
    });

    test("Null, undefined, empty returns custom fallback or empty string", () => {
      assertEqual(formatAdminTime(null), "");
      assertEqual(formatAdminTime(undefined), "");
      assertEqual(formatAdminTime("", "N/A"), "N/A");
      assertEqual(formatAdminTime(null, "--:--"), "--:--");
    });

    test("Malformed values return fallback or raw string safely without throwing", () => {
      assertEqual(formatAdminTime("not-a-time", "default"), "not-a-time");
      assertEqual(formatAdminTime({}, "fallback"), "fallback");
      assertEqual(formatAdminTime([], "fallback"), "fallback");
    });
  });

  describe("Safari-Safe Date Formatter: formatAdminDate", () => {
    test("Valid ISO timestamp formats to readable date", () => {
      const res = formatAdminDate("2026-10-07T14:30:00Z");
      assert(res.includes("Oct"), "Should include month Oct");
      assert(res.includes("2026"), "Should include year 2026");
    });

    test("Bare SQL date formats without timezone shift", () => {
      const res = formatAdminDate("2026-10-05");
      assertEqual(res, "Oct 5, 2026");
    });

    test("Null, undefined, empty returns fallback", () => {
      assertEqual(formatAdminDate(null), "N/A");
      assertEqual(formatAdminDate(undefined), "N/A");
      assertEqual(formatAdminDate("", "No Date"), "No Date");
      assertEqual(formatAdminDate(null, "--"), "--");
    });

    test("Invalid date string returns raw string or fallback without throwing", () => {
      assertEqual(formatAdminDate("invalid-date-string"), "invalid-date-string");
      assertEqual(formatAdminDate({}), "N/A");
    });
  });

  describe("Safari-Safe DateTime Formatter: formatAdminDateTime", () => {
    test("Valid ISO timestamp formats to readable datetime", () => {
      const res = formatAdminDateTime("2026-10-07T14:30:00Z");
      assert(res.includes("Oct"), "Should include month Oct");
      assert(res.includes("AM") || res.includes("PM"), "Should include AM/PM");
    });

    test("Null, undefined, empty returns fallback", () => {
      assertEqual(formatAdminDateTime(null), "N/A");
      assertEqual(formatAdminDateTime(undefined), "N/A");
      assertEqual(formatAdminDateTime("", "N/A"), "N/A");
    });

    test("Invalid string returns raw string or fallback without throwing", () => {
      assertEqual(formatAdminDateTime("malformed-timestamp"), "malformed-timestamp");
      assertEqual(formatAdminDateTime(1234567890000).length > 0, true);
    });
  });

  describe("Safari-Safe Status Formatter: formatAdminStatus", () => {
    test("Replaces underscores with spaces", () => {
      assertEqual(formatAdminStatus("in_progress"), "in progress");
      assertEqual(formatAdminStatus("quote_sent"), "quote sent");
      assertEqual(formatAdminStatus("confirmed"), "confirmed");
      assertEqual(formatAdminStatus("payment_pending"), "payment pending");
    });

    test("Safely handles null without throwing", () => {
      assertEqual(formatAdminStatus(null), "pending");
      assertEqual(formatAdminStatus(null, "unknown"), "unknown");
    });

    test("Safely handles undefined without throwing", () => {
      assertEqual(formatAdminStatus(undefined), "pending");
      assertEqual(formatAdminStatus(undefined, "none"), "none");
    });

    test("Safely handles non-string values without throwing", () => {
      assertEqual(formatAdminStatus(123), "pending");
      assertEqual(formatAdminStatus({}), "pending");
      assertEqual(formatAdminStatus(false), "pending");
    });
  });
}

// Direct execution support
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("safari-date-format.test.mjs")) {
  resetTestCounts();
  runSafariDateFormatTests();
  setTimeout(() => {
    printSummaryAndExit();
  }, 50);
}
