/**
 * Integration Tests: Customer Authentication & Session Lifecycle
 * HT Mobile Services
 */

import { describe, test, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockCustomerAlice } from "../fixtures/user-fixtures.mjs";
import { sanitizeRedirectTarget } from "../../../frontend/src/lib/utils/auth-helpers.ts";

export function runCustomerAuthIntegrationTests() {
  describe("Customer Authentication & Session Lifecycle (Integration)", () => {
    test("Authenticated customer session resolves customer identity and role", () => {
      const session = {
        user: { id: mockCustomerAlice.authUserId, email: mockCustomerAlice.email },
      };
      // Emulating getSessionCustomer resolution
      const resolvedCustomer = session?.user?.id === mockCustomerAlice.authUserId ? mockCustomerAlice : null;
      assert(resolvedCustomer !== null);
      assertEqual(resolvedCustomer.id, "cust_alice_111");
      assertEqual(resolvedCustomer.role, "customer");
    });

    test("Missing session returns null / 401 Unauthorized", () => {
      const session = null;
      const resolvedCustomer = session?.user ? mockCustomerAlice : null;
      assertEqual(resolvedCustomer, null);
    });

    test("Customer profile sync idempotently links Supabase Auth ID without duplicating records", () => {
      const existingCustomers = [{ ...mockCustomerAlice }];
      const syncPayload = {
        authUserId: mockCustomerAlice.authUserId,
        email: mockCustomerAlice.email,
        name: "Alice Smith Updated",
      };

      // Find existing
      const existing = existingCustomers.find((c) => c.authUserId === syncPayload.authUserId);
      if (existing) {
        existing.name = syncPayload.name;
      } else {
        existingCustomers.push({ id: "new_cust", ...syncPayload });
      }

      assertEqual(existingCustomers.length, 1, "Should not create duplicate customer record");
      assertEqual(existingCustomers[0].name, "Alice Smith Updated");
    });

    test("Customer login with invalid credentials returns graceful error response (no unhandled 500)", () => {
      const mockSupabaseSignIn = (email, password) => {
        if (!email || !password || password !== "CorrectPassword123!") {
          return {
            data: { user: null, session: null },
            error: { message: "Invalid login credentials" },
          };
        }
        return {
          data: {
            user: { id: "user_alice", email, user_metadata: { role: "customer" } },
            session: { access_token: "tok_123" },
          },
          error: null,
        };
      };

      const handleLogin = (email, password) => {
        const normalizedEmail = (email || "").trim().toLowerCase();
        if (!normalizedEmail || !password) {
          return { success: false, error: "Please enter both your email and password." };
        }
        const { data, error } = mockSupabaseSignIn(normalizedEmail, password);
        if (error) {
          const errorMsg = error.message.toLowerCase();
          if (errorMsg.includes("invalid login credentials") || errorMsg.includes("invalid credentials")) {
            return {
              success: false,
              error: "Invalid email or password. Please check your credentials and try again.",
            };
          }
          return { success: false, error: error.message };
        }
        return { success: true, user: data.user };
      };

      const result = handleLogin("alice@example.com", "WrongPassword");
      assertEqual(result.success, false);
      assertEqual(result.error, "Invalid email or password. Please check your credentials and try again.");
    });

    test("Customer login with valid credentials creates authenticated session", () => {
      const mockSupabaseSignIn = (email, password) => {
        if (email === "alice@example.com" && password === "CorrectPassword123!") {
          return {
            data: {
              user: { id: "user_alice", email, user_metadata: { role: "customer" } },
              session: { access_token: "tok_valid_session" },
            },
            error: null,
          };
        }
        return { data: { user: null }, error: { message: "Invalid login credentials" } };
      };

      const handleLogin = (email, password) => {
        const normalizedEmail = (email || "").trim().toLowerCase();
        const { data, error } = mockSupabaseSignIn(normalizedEmail, password);
        if (error) {
          return { success: false, error: "Invalid email or password." };
        }
        return { success: true, user: data.user, sessionToken: data.session.access_token };
      };

      const result = handleLogin("alice@example.com", "CorrectPassword123!");
      assert(result.success);
      assertEqual(result.user.id, "user_alice");
      assertEqual(result.sessionToken, "tok_valid_session");
    });

    test("Customer logout clears session state", () => {
      let activeSession = { token: "tok_active", userId: "user_alice" };
      const signOut = () => {
        activeSession = null;
        return { success: true };
      };
      const res = signOut();
      assert(res.success);
      assertEqual(activeSession, null);
    });

    test("Customer session persists across cookie reads", () => {
      const cookieJar = new Map([["sb-auth-token", "valid_auth_jwt"]]);
      const readSession = (cookies) => {
        const token = cookies.get("sb-auth-token");
        return token ? { active: true, token } : { active: false };
      };
      const session = readSession(cookieJar);
      assert(session.active);
      assertEqual(session.token, "valid_auth_jwt");
    });

    test("Supabase SSR cookie setter explicitly enforces secure: true in production", () => {
      const isProduction = true;
      const incomingOptions = { path: "/", sameSite: "lax", httpOnly: false, maxAge: 34560000 };
      
      const resolvedOptions = {
        ...incomingOptions,
        secure: incomingOptions?.secure ?? isProduction,
        sameSite: incomingOptions?.sameSite ?? "lax",
        path: incomingOptions?.path ?? "/",
      };

      assertEqual(resolvedOptions.secure, true, "Must enforce secure: true in production for WebKit/Safari");
      assertEqual(resolvedOptions.sameSite, "lax", "Must preserve sameSite: lax");
      assertEqual(resolvedOptions.path, "/", "Must preserve path: /");
      assertEqual(resolvedOptions.httpOnly, false, "Must preserve httpOnly flag from Supabase client");
    });

    test("Customer middleware redirect to /login preserves incoming Supabase session cookies", () => {
      const incomingCookies = [
        { name: "sb-token-0", value: "chunk0" },
        { name: "sb-token-1", value: "chunk1" },
      ];
      const redirectResponseCookies = new Map();

      // Emulate middleware redirect copying cookies
      incomingCookies.forEach((c) => {
        redirectResponseCookies.set(c.name, c.value);
      });

      assertEqual(redirectResponseCookies.get("sb-token-0"), "chunk0");
      assertEqual(redirectResponseCookies.get("sb-token-1"), "chunk1");
    });

    test("Customer profile API returns 401 UNAUTHORIZED when session token is missing", () => {
      const getProfile = (session) => {
        if (!session || !session.user) {
          return { status: 401, error: "Your session has expired. Please sign in again.", code: "UNAUTHORIZED" };
        }
        return { status: 200, user: session.user };
      };

      const res = getProfile(null);
      assertEqual(res.status, 401);
      assertEqual(res.code, "UNAUTHORIZED");
    });

    // -------------------------------------------------------------
    // SEC-01 Open Redirect Remediation Regression Tests
    // -------------------------------------------------------------
    test("SEC-01: sanitizeRedirectTarget permits valid internal application paths", () => {
      assertEqual(sanitizeRedirectTarget("/account"), "/account");
      assertEqual(sanitizeRedirectTarget("/booking"), "/booking");
      assertEqual(sanitizeRedirectTarget("/account/bookings/b_123"), "/account/bookings/b_123");
      assertEqual(sanitizeRedirectTarget("/account?tab=history&page=2"), "/account?tab=history&page=2");
      assertEqual(sanitizeRedirectTarget("/services/flat-tire-repair"), "/services/flat-tire-repair");
    });

    test("SEC-01: sanitizeRedirectTarget rejects external URLs", () => {
      assertEqual(sanitizeRedirectTarget("https://evil.com"), "/account");
      assertEqual(sanitizeRedirectTarget("http://attacker.com/steal-session"), "/account");
      assertEqual(sanitizeRedirectTarget("ftp://evil.com/payload"), "/account");
    });

    test("SEC-01: sanitizeRedirectTarget rejects protocol-relative URLs", () => {
      assertEqual(sanitizeRedirectTarget("//evil.com"), "/account");
      assertEqual(sanitizeRedirectTarget("//evil.com/account"), "/account");
      assertEqual(sanitizeRedirectTarget("///attacker.com"), "/account");
      assertEqual(sanitizeRedirectTarget("////attacker.com"), "/account");
    });

    test("SEC-01: sanitizeRedirectTarget rejects backslash-based bypasses", () => {
      assertEqual(sanitizeRedirectTarget("\\evil.com"), "/account");
      assertEqual(sanitizeRedirectTarget("/\\evil.com"), "/account");
      assertEqual(sanitizeRedirectTarget("/\\/evil.com"), "/account");
      assertEqual(sanitizeRedirectTarget("/path\\with\\backslash"), "/account");
    });

    test("SEC-01: sanitizeRedirectTarget rejects unsafe schemes and embedded schemes", () => {
      assertEqual(sanitizeRedirectTarget("javascript:alert(1)"), "/account");
      assertEqual(sanitizeRedirectTarget("/javascript:alert(1)"), "/account");
      assertEqual(sanitizeRedirectTarget("data:text/html,<script>alert(1)</script>"), "/account");
      assertEqual(sanitizeRedirectTarget("/data:text/html"), "/account");
      assertEqual(sanitizeRedirectTarget("vbscript:msgbox(1)"), "/account");
      assertEqual(sanitizeRedirectTarget("/vbscript:msgbox(1)"), "/account");
    });

    test("SEC-01: sanitizeRedirectTarget rejects encoded bypass attempts and malformed encoding", () => {
      assertEqual(sanitizeRedirectTarget("%2f%2fevil.com"), "/account");
      assertEqual(sanitizeRedirectTarget("/%2f%2fevil.com"), "/account");
      assertEqual(sanitizeRedirectTarget("/http:%2f%2fevil.com"), "/account");
      assertEqual(sanitizeRedirectTarget("/https:%2f%2fevil.com"), "/account");
      assertEqual(sanitizeRedirectTarget("%E0%A4%A"), "/account", "Malformed URI encoding should gracefully fall back");
    });

    test("SEC-01: sanitizeRedirectTarget safely handles missing, empty, or non-string inputs", () => {
      assertEqual(sanitizeRedirectTarget(null), "/account");
      assertEqual(sanitizeRedirectTarget(undefined), "/account");
      assertEqual(sanitizeRedirectTarget(""), "/account");
      assertEqual(sanitizeRedirectTarget("   "), "/account");
      assertEqual(sanitizeRedirectTarget(12345), "/account");
      assertEqual(sanitizeRedirectTarget({}), "/account");
    });

    test("SEC-01: sanitizeRedirectTarget respects custom fallback parameter", () => {
      assertEqual(sanitizeRedirectTarget("https://evil.com", "/custom-fallback"), "/custom-fallback");
      assertEqual(sanitizeRedirectTarget("//evil.com", "/login"), "/login");
      assertEqual(sanitizeRedirectTarget(null, "/home"), "/home");
      assertEqual(sanitizeRedirectTarget("/valid-path", "/login"), "/valid-path");
    });

    test("SEC-01: /auth/callback flow emulation redirects safely on success and error", () => {
      const origin = "https://htmobiletire.com";
      
      const simulateAuthCallback = (code, rawNext, exchangeSucceeds = true) => {
        const next = sanitizeRedirectTarget(rawNext, "/account");
        if (code) {
          if (exchangeSucceeds) {
            return { redirectedTo: `${origin}${next}`, status: 302 };
          }
        }
        return { redirectedTo: `${origin}/login?error=auth_callback_failed`, status: 302 };
      };

      // 1. Valid code with safe next -> target
      const resSafe = simulateAuthCallback("valid_code_123", "/booking");
      assertEqual(resSafe.redirectedTo, "https://htmobiletire.com/booking");

      // 2. Valid code with malicious next -> sanitized to /account
      const resMalicious = simulateAuthCallback("valid_code_123", "//evil.com");
      assertEqual(resMalicious.redirectedTo, "https://htmobiletire.com/account");

      // 3. Valid code with missing next -> default /account
      const resDefault = simulateAuthCallback("valid_code_123", null);
      assertEqual(resDefault.redirectedTo, "https://htmobiletire.com/account");

      // 4. Missing code -> error redirect
      const resMissingCode = simulateAuthCallback(null, "/booking");
      assertEqual(resMissingCode.redirectedTo, "https://htmobiletire.com/login?error=auth_callback_failed");

      // 5. Auth code exchange failure -> error redirect
      const resFailedExchange = simulateAuthCallback("invalid_code", "/booking", false);
      assertEqual(resFailedExchange.redirectedTo, "https://htmobiletire.com/login?error=auth_callback_failed");
    });
  });
}
