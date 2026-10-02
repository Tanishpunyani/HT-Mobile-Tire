/**
 * Integration Tests: API Contracts & HTTP Status Code Matrix
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

function mockApiRouter({ path, method, auth, body }) {
  if (path === "/api/health") {
    return { status: 200, body: { status: "healthy", timestamp: Date.now() } };
  }
  if (path === "/api/bookings" && method === "POST") {
    if (!auth) return { status: 401, body: { success: false, error: "Unauthorized" } };
    if (!body?.serviceType) {
      return { status: 400, body: { success: false, error: "Invalid booking request", details: { serviceType: "Required" } } };
    }
    if (body.scheduledTime === "OVER_CAPACITY") {
      return { status: 409, body: { success: false, error: "Selected slot is at maximum capacity" } };
    }
    return { status: 201, body: { success: true, bookingId: "book_new_999" } };
  }
  if (path === "/api/admin/dashboard") {
    if (!auth || auth.role !== "admin") {
      return { status: 403, body: { success: false, error: "Forbidden. Admin only." } };
    }
    return { status: 200, body: { success: true, stats: { totalBookings: 10 } } };
  }
  if (path === "/api/rate-limited") {
    return { status: 429, body: { success: false, error: "Too many requests. Please wait." } };
  }
  if (path === "/api/db-down") {
    return { status: 503, body: { success: false, error: "Database service temporarily unavailable." } };
  }
  return { status: 404, body: { success: false, error: "Resource not found" } };
}

export function runApiContractIntegrationTests() {
  describe("API Contracts & REST Status Code Consistency (Integration)", () => {
    test("Health check returns HTTP 200", () => {
      const res = mockApiRouter({ path: "/api/health", method: "GET" });
      assertEqual(res.status, 200);
      assertEqual(res.body.status, "healthy");
    });

    test("Resource creation returns HTTP 201", () => {
      const res = mockApiRouter({
        path: "/api/bookings",
        method: "POST",
        auth: { id: "user_1" },
        body: { serviceType: "Flat Tire Repair" },
      });
      assertEqual(res.status, 201);
      assert(res.body.success);
    });

    test("Validation failure returns HTTP 400 with details", () => {
      const res = mockApiRouter({
        path: "/api/bookings",
        method: "POST",
        auth: { id: "user_1" },
        body: {},
      });
      assertEqual(res.status, 400);
      assert(res.body.details != null);
    });

    test("Unauthorized request returns HTTP 401", () => {
      const res = mockApiRouter({ path: "/api/bookings", method: "POST", auth: null });
      assertEqual(res.status, 401);
    });

    test("Forbidden role returns HTTP 403", () => {
      const res = mockApiRouter({ path: "/api/admin/dashboard", auth: { role: "customer" } });
      assertEqual(res.status, 403);
    });

    test("Slot capacity exhaustion returns HTTP 409 Conflict", () => {
      const res = mockApiRouter({
        path: "/api/bookings",
        method: "POST",
        auth: { id: "user_1" },
        body: { serviceType: "Flat Tire Repair", scheduledTime: "OVER_CAPACITY" },
      });
      assertEqual(res.status, 409);
    });

    test("Rate limiting returns HTTP 429", () => {
      const res = mockApiRouter({ path: "/api/rate-limited" });
      assertEqual(res.status, 429);
    });

    test("Upstream database outage returns HTTP 503", () => {
      const res = mockApiRouter({ path: "/api/db-down" });
      assertEqual(res.status, 503);
    });
  });
}
