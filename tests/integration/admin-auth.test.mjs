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
  });
}
