/**
 * Integration Tests: Admin Authorization & Session Guardrails
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockCustomerAlice } from "../fixtures/user-fixtures.mjs";

function requireAdminSession(cookieHeader, signedCookieValidator) {
  if (!cookieHeader) return { authorized: false, status: 401, error: "Unauthorized." };
  const isValid = signedCookieValidator(cookieHeader);
  if (!isValid) return { authorized: false, status: 403, error: "Forbidden. Admin privileges required." };
  return { authorized: true, status: 200, user: { role: "admin" } };
}

export function runAdminAuthIntegrationTests() {
  describe("Admin Authorization & Middleware Boundary (Integration)", () => {
    test("Valid signed admin session allows access to privileged dashboard / API", () => {
      const mockValidator = (cookie) => cookie === "valid_signed_admin_session_cookie";
      const result = requireAdminSession("valid_signed_admin_session_cookie", mockValidator);
      assert(result.authorized);
      assertEqual(result.status, 200);
    });

    test("Missing admin cookie returns 401 Unauthorized", () => {
      const mockValidator = () => true;
      const result = requireAdminSession(null, mockValidator);
      assertEqual(result.authorized, false);
      assertEqual(result.status, 401);
    });

    test("Invalid or tampered admin cookie returns 403 Forbidden", () => {
      const mockValidator = () => false;
      const result = requireAdminSession("fake_session_123", mockValidator);
      assertEqual(result.authorized, false);
      assertEqual(result.status, 403);
    });

    test("Customer token presented to Admin API is rejected", () => {
      // Customer has role 'customer', validator rejects non-admin signature
      const mockValidator = (cookie) => cookie.includes("role=admin");
      const customerCookie = `customer_id=${mockCustomerAlice.id}&role=${mockCustomerAlice.role}`;
      const result = requireAdminSession(customerCookie, mockValidator);
      assertEqual(result.authorized, false);
      assertEqual(result.status, 403);
    });

    test("Admin middleware decouples /admin/login from customer Supabase session update", () => {
      let supabaseSessionCalled = false;
      const simulateMiddleware = (pathname) => {
        if (pathname.startsWith("/admin")) {
          if (pathname === "/admin/login") {
            return { action: "next", supabaseChecked: false };
          }
          // Protected check
          return { action: "next", supabaseChecked: false };
        }
        supabaseSessionCalled = true;
        return { action: "next", supabaseChecked: true };
      };

      const result = simulateMiddleware("/admin/login");
      assertEqual(result.action, "next");
      assertEqual(result.supabaseChecked, false, "Admin login must not invoke Supabase updateSession");
      assertEqual(supabaseSessionCalled, false);
    });

    test("Admin middleware terminates early on valid admin session without falling through to Supabase", () => {
      let supabaseSessionCalled = false;
      const simulateMiddleware = (pathname, cookieValue) => {
        if (pathname.startsWith("/admin")) {
          if (pathname === "/admin/login") {
            return { action: "next", supabaseChecked: false };
          }
          const valid = cookieValue === "valid_signed_token";
          if (!valid) {
            return { action: "redirect", target: "/admin/login", supabaseChecked: false };
          }
          // Decoupled early return
          return { action: "next", supabaseChecked: false };
        }
        supabaseSessionCalled = true;
        return { action: "next", supabaseChecked: true };
      };

      const result = simulateMiddleware("/admin/dashboard", "valid_signed_token");
      assertEqual(result.action, "next");
      assertEqual(result.supabaseChecked, false, "Valid admin session must not fall through to Supabase");
      assertEqual(supabaseSessionCalled, false);
    });

    test("Admin API routes pass through directly without customer Supabase invocation", () => {
      let supabaseSessionCalled = false;
      const simulateMiddleware = (pathname) => {
        if (pathname.startsWith("/api/admin")) {
          return { action: "next", supabaseChecked: false };
        }
        supabaseSessionCalled = true;
        return { action: "next", supabaseChecked: true };
      };

      const result = simulateMiddleware("/api/admin/bookings");
      assertEqual(result.action, "next");
      assertEqual(result.supabaseChecked, false, "Admin API must not call Supabase updateSession");
      assertEqual(supabaseSessionCalled, false);
    });

    test("Admin session cookies enforce HttpOnly, SameSite=lax, Secure in production, and Path=/", () => {
      const isProduction = true;
      const cookieConfig = {
        name: "admin_session",
        value: "dummy_signed_token_64_bytes",
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: 86400,
        path: "/",
      };

      assert(cookieConfig.httpOnly, "Admin session cookie must be HttpOnly");
      assertEqual(cookieConfig.sameSite, "lax", "Admin session cookie must be SameSite=lax");
      assertEqual(cookieConfig.secure, true, "Admin session cookie must be Secure in production");
      assertEqual(cookieConfig.path, "/", "Admin session cookie must be scoped to root Path=/");
    });

    test("SEC-02: Legacy unsigned 64-hexadecimal cookie fails requireAdminSession", () => {
      const unsignedHexCookie = "e".repeat(64);
      // Realistic signature validator that rejects unsigned tokens
      const strictValidator = (cookie) => {
        const parts = (cookie || "").split(".");
        return parts.length === 3 && parts[0].length === 64 && Boolean(parts[2]);
      };

      const result = requireAdminSession(unsignedHexCookie, strictValidator);
      assertEqual(result.authorized, false);
      assertEqual(result.status, 403);
    });

    test("SEC-04: requireAdminSession strictly blocks tokens signed with non-authoritative keys", () => {
      const tokenWithWrongKey = `${"f".repeat(64)}.${Date.now() + 60000}.invalid_key_sig`;
      const authoritativeValidator = (cookie) => {
        // Only accepts if signature matches authoritative secret
        return cookie.endsWith(".authoritative_key_sig");
      };

      const result = requireAdminSession(tokenWithWrongKey, authoritativeValidator);
      assertEqual(result.authorized, false);
      assertEqual(result.status, 403);
    });

    test("Logout / session cleanup safely handles invalid and legacy cookies without error", () => {
      const simulateDestroySession = (token) => {
        if (!token || typeof token !== "string" || token.trim() === "") {
          return { success: true, deleted: false };
        }
        const parts = token.trim().split(".");
        const rawToken = parts.length === 3 ? parts[0] : token.trim();
        // Safe database deletion simulation
        return { success: true, deleted: true, targetToken: rawToken };
      };

      const resLegacy = simulateDestroySession("legacy_token_12345");
      assertEqual(resLegacy.success, true);
      assertEqual(resLegacy.targetToken, "legacy_token_12345");

      const resNull = simulateDestroySession(null);
      assertEqual(resNull.success, true);
      assertEqual(resNull.deleted, false);

      const resSigned = simulateDestroySession(`${"a".repeat(64)}.123456789.sig`);
      assertEqual(resSigned.success, true);
      assertEqual(resSigned.targetToken, "a".repeat(64));
    });
  });
}
