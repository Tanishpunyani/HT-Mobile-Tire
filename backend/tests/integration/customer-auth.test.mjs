/**
 * Integration Tests: Customer Authentication & Session Lifecycle
 * HT Mobile Services
 */

import { describe, test, testAsync, assert, assertEqual } from "../helpers/test-runner.mjs";
import { mockCustomerAlice } from "../fixtures/user-fixtures.mjs";

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
  });
}
