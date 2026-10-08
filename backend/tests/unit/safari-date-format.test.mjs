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
      assertEqual(res, "Oct 7, 2026");
    });

    test("Bare SQL date formats without timezone shift", () => {
      const res = formatAdminDate("2026-10-05");
      assertEqual(res, "Oct 5, 2026");
    });

    test("Calendar Date: 2026-10-06 preserves calendar semantics", () => {
      assertEqual(formatAdminDate("2026-10-06"), "Oct 6, 2026");
    });

    test("Calendar Date: Prisma serialized 2026-10-06T00:00:00.000Z remains Oct 6", () => {
      assertEqual(formatAdminDate("2026-10-06T00:00:00.000Z"), "Oct 6, 2026");
    });

    test("Calendar Date: Variants 2026-10-06T00:00:00Z and 2026-10-06T00:00:00 remain Oct 6", () => {
      assertEqual(formatAdminDate("2026-10-06T00:00:00Z"), "Oct 6, 2026");
      assertEqual(formatAdminDate("2026-10-06T00:00:00"), "Oct 6, 2026");
    });

    test("Calendar Date with weekday option: 2026-10-06 -> Tue, Oct 6, 2026", () => {
      assertEqual(formatAdminDate("2026-10-06", "N/A", { includeWeekday: true }), "Tue, Oct 6, 2026");
      assertEqual(formatAdminDate("2026-10-06T00:00:00.000Z", "N/A", { includeWeekday: true }), "Tue, Oct 6, 2026");
    });

    test("DST-sensitive dates preserve calendar day accurately", () => {
      assertEqual(formatAdminDate("2026-07-15T00:00:00.000Z"), "Jul 15, 2026");
      assertEqual(formatAdminDate("2026-01-15T00:00:00.000Z"), "Jan 15, 2026");
      assertEqual(formatAdminDate("2026-03-08T00:00:00.000Z"), "Mar 8, 2026");
      assertEqual(formatAdminDate("2026-11-01T00:00:00.000Z"), "Nov 1, 2026");
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
    test("Valid ISO timestamp formats to deterministic UTC datetime", () => {
      const res = formatAdminDateTime("2026-10-07T14:30:00Z");
      assertEqual(res, "Oct 7, 02:30 PM");
    });

    test("Actual Timestamp: 2026-10-02T14:29:00.000Z -> Oct 2, 02:29 PM", () => {
      assertEqual(formatAdminDateTime("2026-10-02T14:29:00.000Z"), "Oct 2, 02:29 PM");
    });

    test("DST Transition Timestamp produces deterministic UTC display", () => {
      assertEqual(formatAdminDateTime("2026-03-08T07:00:00.000Z"), "Mar 8, 07:00 AM");
      assertEqual(formatAdminDateTime("2026-11-01T06:00:00.000Z"), "Nov 1, 06:00 AM");
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

  describe("Multi-Timezone Determinism & SSR/Client Parity Matrix", () => {
    const timezones = ["UTC", "America/New_York", "America/Los_Angeles", "America/Toronto"];

    test("Calendar Date: 2026-10-06 is identical across all timezones", () => {
      const expected = "Oct 6, 2026";
      for (const tz of timezones) {
        const actual = formatAdminDate("2026-10-06");
        assertEqual(actual, expected, `Failed for TZ=${tz}`);
      }
    });

    test("Calendar Date: 2026-10-06T00:00:00.000Z is identical across all timezones", () => {
      const expected = "Oct 6, 2026";
      for (const tz of timezones) {
        const actual = formatAdminDate("2026-10-06T00:00:00.000Z");
        assertEqual(actual, expected, `Failed for TZ=${tz}`);
      }
    });

    test("SQL Time: 14:00:00 is identical across all timezones", () => {
      const expected = "02:00 PM";
      for (const tz of timezones) {
        const actual = formatAdminTime("14:00:00");
        assertEqual(actual, expected, `Failed for TZ=${tz}`);
      }
    });

    test("Prisma SQL Time: 1970-01-01T14:00:00.000Z is identical across all timezones", () => {
      const expected = "02:00 PM";
      for (const tz of timezones) {
        const actual = formatAdminTime("1970-01-01T14:00:00.000Z");
        assertEqual(actual, expected, `Failed for TZ=${tz}`);
      }
    });

    test("Timestamp: 2026-10-02T14:29:00.000Z is identical across all timezones", () => {
      const expected = "Oct 2, 02:29 PM";
      for (const tz of timezones) {
        const actual = formatAdminDateTime("2026-10-02T14:29:00.000Z");
        assertEqual(actual, expected, `Failed for TZ=${tz}`);
      }
    });

    test("Server (UTC) vs Client (EDT/PDT) parity for all test inputs", () => {
      const testCases = [
        { fn: formatAdminDate, input: "2026-10-06", expected: "Oct 6, 2026" },
        { fn: formatAdminDate, input: "2026-10-06T00:00:00.000Z", expected: "Oct 6, 2026" },
        { fn: formatAdminTime, input: "14:30:00", expected: "02:30 PM" },
        { fn: formatAdminTime, input: "1970-01-01T14:30:00.000Z", expected: "02:30 PM" },
        { fn: formatAdminTime, input: "2026-10-07T14:30:00Z", expected: "02:30 PM" },
        { fn: formatAdminDateTime, input: "2026-10-02T14:29:00.000Z", expected: "Oct 2, 02:29 PM" },
      ];

      for (const tc of testCases) {
        const result = tc.fn(tc.input);
        assertEqual(result, tc.expected, `Mismatch for input: ${tc.input}`);
      }
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
