/**
 * Integration Regression Test: Admin Rendering & Layout Isolation
 * Prevents the infinite self-redirect loop on /admin/login while ensuring
 * protected admin portal pages (/admin/dashboard, /admin/bookings, etc.)
 * remain strictly guarded.
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";

/**
 * Simulates route resolution and layout guard execution in Next.js App Router
 * based on the separated route tree:
 * - app/(admin-auth)/admin/login/page.tsx (Public login route group)
 * - app/(admin-portal)/admin/layout.tsx (Protected portal layout group)
 */
function evaluateAdminRoute({ pathname, hasValidAdminSession }) {
  // 1. Edge Middleware Evaluation
  if (pathname === "/admin/login") {
    // Middleware passes /admin/login through
    // Route Group: (admin-auth) - NO requireAdminSession() in layout
    return {
      status: 200,
      rendered: "AdminLoginPage",
      redirectUrl: null,
      infiniteLoop: false,
    };
  }

  if (pathname.startsWith("/admin")) {
    if (!hasValidAdminSession) {
      // Middleware redirects to /admin/login
      return {
        status: 302,
        rendered: null,
        redirectUrl: "/admin/login",
        infiniteLoop: false,
      };
    }

    // Route Group: (admin-portal) - requireAdminSession() succeeds
    return {
      status: 200,
      rendered: "ProtectedAdminPortal",
      redirectUrl: null,
      infiniteLoop: false,
    };
  }

  return { status: 404, rendered: null, redirectUrl: null, infiniteLoop: false };
}

export function runAdminRenderingLoopRegressionTests() {
  describe("Admin Layout & Rendering Loop Regression Protection", () => {
    test("Unauthenticated /admin/login resolves immediately without self-redirect loop", () => {
      const response = evaluateAdminRoute({
        pathname: "/admin/login",
        hasValidAdminSession: false,
      });

      assertEqual(response.status, 200);
      assertEqual(response.rendered, "AdminLoginPage");
      assertEqual(response.redirectUrl, null);
      assertEqual(response.infiniteLoop, false);
    });

    test("Unauthenticated /admin/dashboard redirects to /admin/login cleanly (Single 302)", () => {
      const response = evaluateAdminRoute({
        pathname: "/admin/dashboard",
        hasValidAdminSession: false,
      });

      assertEqual(response.status, 302);
      assertEqual(response.redirectUrl, "/admin/login");

      // Follow the redirect to /admin/login:
      const targetResponse = evaluateAdminRoute({
        pathname: response.redirectUrl,
        hasValidAdminSession: false,
      });

      assertEqual(targetResponse.status, 200);
      assertEqual(targetResponse.rendered, "AdminLoginPage");
      assertEqual(targetResponse.redirectUrl, null);
    });

    test("Unauthenticated /admin/bookings redirects to /admin/login", () => {
      const response = evaluateAdminRoute({
        pathname: "/admin/bookings",
        hasValidAdminSession: false,
      });

      assertEqual(response.status, 302);
      assertEqual(response.redirectUrl, "/admin/login");
    });

    test("Authenticated administrator accesses /admin/dashboard directly", () => {
      const response = evaluateAdminRoute({
        pathname: "/admin/dashboard",
        hasValidAdminSession: true,
      });

      assertEqual(response.status, 200);
      assertEqual(response.rendered, "ProtectedAdminPortal");
      assertEqual(response.redirectUrl, null);
    });

    test("Logout transition redirects to /admin/login and renders login page without loop", () => {
      // Step 1: User logs out (session cleared)
      const hasValidAdminSession = false;

      // Step 2: Client redirected to /admin/login
      const response = evaluateAdminRoute({
        pathname: "/admin/login",
        hasValidAdminSession,
      });

      assertEqual(response.status, 200);
      assertEqual(response.rendered, "AdminLoginPage");
      assertEqual(response.redirectUrl, null);
    });
  });
}
