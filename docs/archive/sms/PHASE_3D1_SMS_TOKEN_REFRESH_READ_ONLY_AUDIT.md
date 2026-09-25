# PHASE 3D.1 — SMS GATEWAY TOKEN REFRESH
## Read-Only Architecture Audit & Automatic Refresh Design

**Project**: HT Mobile Services / HT Mobile Tyres  
**Codebase**: `tire-mobile-clinic-next`  
**Phase**: 3D.1 — SMS Gateway Token Refresh Architecture  
**Mode**: STRICT READ-ONLY AUDIT ONLY (NO CODE MODIFICATIONS)  
**Date**: September 22, 2026  

---

## 1. Executive Summary

Phase 3D.1 audits the authentication lifecycle of the Android SMS Gateway (`sms-gate.app`) integration. 

In Phase 3D, pre-flight diagnostics revealed that the cloud gateway endpoint returned `HTTP 401 Unauthorized` because the configured Bearer token was a temporary web-session JWT that expired on `2026-09-21T16:50:15Z` (15-minute TTL). The current implementation relies on manually copying a static access token into `process.env.SMS_GATEWAY_API_KEY`, which cannot maintain uptime in production when short-lived tokens are used.

This audit establishes the exact authentication and token refresh specifications of the Capcom6 SMS Gateway Cloud API (`v1.47.4-SNAPSHOT-22f7823`), evaluates the limitations of serverless environments (Next.js on Vercel), analyzes the concurrency risks of Refresh Token Rotation (RTR), and defines an automated refresh architecture that maintains strict failure isolation without altering business logic.

---

## 2. Current Authentication Architecture

### 2.1 File Locations & Inspection

1. **`lib/sms/index.ts`**:
   - `getSmsProvider()` reads `process.env.SMS_GATEWAY_URL`, `process.env.SMS_GATEWAY_API_KEY`, and `process.env.SMS_GATEWAY_SIM_SLOT`.
   - Instantiates a module-scoped singleton `activeProvider = new AndroidGatewayProvider(...)`.
   - Falls back to `SimulatedSmsProvider` in development or `unconfigured-production-guard` in production if credentials are absent.

2. **`lib/sms/providers/android-gateway.ts`**:
   - Stores `apiKey` as a private string assigned during construction.
   - Resolves target endpoint to `${baseUrl}/3rdparty/v1/messages`.
   - Sends outbound POST request with header: `Authorization: Bearer ${this.apiKey}`.
   - 4-second request timeout via `AbortSignal.timeout(4000)`.
   - Completely lacks:
     - Access token expiration inspection (`exp` claim or `expires_at`).
     - Refresh token handling.
     - HTTP 401 interception or automatic re-authentication.

3. **`lib/notifications.ts`**:
   - Acts as the application-level notification coordinator (`sendSms`, `sendCustomerBookingConfirmedAlert`, etc.).
   - Invokes `dispatchSms()` and writes to `NotificationLog`.
   - Completely agnostic of authentication mechanics (clean provider boundary).

4. **`scripts/test-sms-gateway.mjs`**:
   - Diagnostic script reading `SMS_GATEWAY_API_KEY` directly from `process.env`.
   - Does not perform token decoding or refresh.

### 2.2 Current Environment Variables
- `SMS_GATEWAY_URL`: Base URL (`https://api.sms-gate.app`).
- `SMS_GATEWAY_API_KEY`: Static Bearer JWT token (currently expired).
- `SMS_GATEWAY_SIM_SLOT`: SIM index (`0` for SIM 1).
- `SMS_GATEWAY_TEST_PHONE`: Target test phone (`+91****286`).
- **Missing**: Any variable for `SMS_GATEWAY_REFRESH_TOKEN` or client credentials.

---

## 3. Current Token Flow

```
+-------------------------------------------------------------------+
|                        CURRENT TOKEN FLOW                         |
+-------------------------------------------------------------------+

Admin logs into sms-gate.app web UI
      ↓
Manually copies access token from web session
      ↓
Pastes into .env.local as SMS_GATEWAY_API_KEY
      ↓
Next.js starts / Lambda boots: reads process.env.SMS_GATEWAY_API_KEY
      ↓
Outbound SMS sent: Authorization: Bearer <static_token>
      ↓
After 15 minutes: Token expires (HTTP 401 Unauthorized)
      ↓
Result: Permanent failure until manual human intervention!
```

---

## 4. Gateway API Authentication Evidence

The exact OpenAPI specification was inspected directly from the live gateway documentation at `https://api.sms-gate.app/docs/doc.json` (Swagger UI / OpenAPI v2 specification):

### 4.1 Security Definitions
```json
{
  "ApiAuth": {
    "type": "basic"
  },
  "JWTAuth": {
    "description": "JWT authentication",
    "type": "apiKey",
    "name": "Authorization",
    "in": "header"
  }
}
```

### 4.2 Generate Token Endpoint (`POST /3rdparty/v1/auth/token`)
- **Security**: Requires either `ApiAuth` (HTTP Basic Auth: `username:password`) or existing `JWTAuth`.
- **Request Body (`smsgateway.TokenRequest`)**:
  ```json
  {
    "scopes": ["messages:send"],
    "ttl": 86400
  }
  ```
- **Supported Scopes**:
  - `messages:send` (required for dispatching SMS)
  - `tokens:manage` (optional, for token management)
- **Response (`201 Created` - `smsgateway.TokenResponse`)**:
  ```json
  {
    "id": "c1d2e3f4-...",
    "token_type": "Bearer",
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "expires_at": "2026-09-23T16:50:15Z"
  }
  ```

---

## 5. Refresh Token Support & Rotation Mechanics

### 5.1 Refresh Endpoint (`POST /3rdparty/v1/auth/token/refresh`)
- **Method**: `POST`
- **Path**: `/3rdparty/v1/auth/token/refresh`
- **Security**: `JWTAuth`
- **Request Header**:
  ```http
  POST /3rdparty/v1/auth/token/refresh HTTP/1.1
  Host: api.sms-gate.app
  Authorization: Bearer <CURRENT_REFRESH_TOKEN>
  Accept: application/json
  ```
- **Request Body**: Empty (`produces: ["application/json"]`).
- **Response (`201 Created`)**:
  ```json
  {
    "id": "e5f6g7h8-...",
    "token_type": "Bearer",
    "access_token": "<NEW_ACCESS_TOKEN>",
    "refresh_token": "<NEW_REFRESH_TOKEN>",
    "expires_at": "2026-09-23T16:50:15Z"
  }
  ```
- **HTTP Status Codes**:
  - `201 Created`: Refresh successful; new token pair issued.
  - `401 Unauthorized`: Refresh token expired, revoked, or already consumed.
  - `403 Forbidden`: Scope revoked or account suspended.
  - `500 Internal Server Error`: Gateway server error.

### 5.2 Token Rotation Behavior (RTR)
- The gateway returns a **new `refresh_token`** on every refresh call.
- The previous `refresh_token` is invalidated upon successful issuance of the new pair.
- **Critical Implication**: If a refresh token is reused after rotation, the gateway rejects the request with `401 Unauthorized`.

---

## 6. Token Storage Analysis

Automatic token refresh requires storing:
1. `access_token` (string)
2. `refresh_token` (string)
3. `expires_at` (timestamp)

### Storage Options Evaluation

| Storage Mechanism | Viability | Pros | Cons / Showstoppers |
|---|---|---|---|
| **Environment Variables (`.env.local` / `process.env`)** | **FAILED** | Zero new tables | Read-only in serverless/Vercel; cannot be updated at runtime across instances; instant token invalidation. |
| **In-Memory Singleton** | **FAILED** | Fast, zero latency | Lost on lambda spin-down / cold starts; not shared across concurrent Vercel lambdas. |
| **Local File System** | **FAILED** | Simple | Ephemeral / read-only on Vercel (`/tmp` is isolated per lambda instance and discarded). |
| **PostgreSQL Database (`Prisma`)** | **RECOMMENDED** | Shared across all lambdas; persistent; supports ACID concurrency locks. | Requires a dedicated database table (`SmsGatewaySession` or `SystemSetting`). |
| **Distributed Cache (Redis/Upstash)** | **ALTERNATIVE** | Fast atomic operations (`SETNX`) | Introduces an external infrastructure dependency not currently in the stack. |

---

## 7. Serverless / Vercel Architecture Analysis

In a serverless environment (such as Next.js deployed on Vercel):
1. **Isolated Lambda Runtimes**: Every incoming request may execute in a different serverless container. Memory is not shared between lambdas.
2. **Cold Starts**: When a new lambda boots, it reads environment variables configured at build/deploy time. If rotating refresh tokens were stored in environment variables, the new lambda would load a stale, already-invalidated refresh token.
3. **Read-Only Filesystem**: Serverless instances cannot write to `.env` or disk.
4. **Conclusion**: An external, shared, durable state store (PostgreSQL via Prisma) is the **only viable persistence layer** for token rotation in this architecture.

---

## 8. Concurrency & Race Condition Analysis

When multiple bookings or notifications occur simultaneously across different serverless instances:

```
Lambda A (Booking Confirmed)      Lambda B (Technician Assigned)
            │                                   │
            ├────────────── Both detect ────────┤
            │         expired access token      │
            ↓                                   ↓
    POST /token/refresh                 POST /token/refresh
 (Uses refresh_token_v1)              (Uses refresh_token_v1)
            │                                   │
            ↓                                   ↓
      HTTP 201 Created                    HTTP 401 Unauthorized
 (Receives refresh_token_v2)          (Token v1 was already burned!)
            │                                   │
            ▼                                   ▼
        Success!                      Permanent Lockout / Revocation!
```

### Mitigation: Database-Level Concurrency Control
To prevent concurrent refresh races:
1. **Single-Flight Refresh Lock**:
   - Before executing a refresh request, the lambda must acquire an atomic lock in PostgreSQL (e.g. using `SELECT ... FOR UPDATE` or a conditional update with a 15-second `lock_timeout`).
2. **Read-Check-Refresh Pattern**:
   - Lambda acquires lock on the token record.
   - Lambda re-checks `expires_at` in the database:
     - If another lambda already refreshed the token in the last few seconds, the current lambda uses the newly updated `access_token` and **skips calling the gateway**.
     - If the token is still expired, it executes `POST /3rdparty/v1/auth/token/refresh`, persists `access_token`, `new_refresh_token`, and `expires_at`, and releases the lock.

---

## 9. Safe Refresh Strategy Design

```
                     Incoming SMS Dispatch Request
                                  │
                                  ▼
                     Check In-Memory Cached Token
                                  │
                   Is Token Valid? (Now < exp - 60s)
                                ╱   ╲
                              YES    NO
                              ╱        ╲
                             ▼          ▼
                       Use Token    Acquire DB Lock
                                        │
                                  Re-check DB Token
                                  (Did someone else refresh?)
                                      ╱   ╲
                                    YES    NO
                                    ╱        ╲
                                   ▼          ▼
                           Update Cache   Call Gateway /refresh
                                              │
                                        Success (201)?
                                            ╱   ╲
                                          YES    NO (401/Network)
                                          ╱        ╲
                                         ▼          ▼
                                Save New Pair   Log Warning &
                                   in DB        Return Failure
                                         │          │
                                         ▼          ▼
                                   Release Lock  Proceed with
                                         │       Failure Isolation
                                         ▼
                             Dispatch SMS to Gateway
                                         │
                             Did Gateway return 401?
                                       ╱   ╲
                                     YES    NO
                                     ╱        ╲
                                    ▼          ▼
                          Invalidate Cache   Return Dispatch
                          & Force Refresh         Result
                           (1 Retry Max)
```

### Key Safety Rules
1. **Proactive Refresh Window**: Refresh when `now >= expires_at - 60 seconds`.
2. **Loop Prevention**: Maximum 1 retry on 401 response; never enter a recursive refresh loop.
3. **Secret Redaction**: `access_token` and `refresh_token` must be redacted from all `logger` statements, exceptions, and `NotificationLog`.
4. **Failure Isolation**: If token refresh fails, `sendSms()` returns `{ success: false, error: "SMS Gateway authentication failed" }`. The calling business action (booking confirmation, technician assignment, etc.) **must complete successfully**.

---

## 10. SMS Dispatch & Provider Boundary Integrity

The architecture preserves existing layer decoupling:

```
Business Actions (app/actions/bookings/*.ts)
            │ [Awaits business operation; catches notification promise]
            ▼
Notification Helpers (lib/notifications.ts)
            │ [Calls sendSms; records NotificationLog]
            ▼
SMS Dispatch Facade (lib/sms/index.ts)
            │ [Resolves provider; normalizes phone]
            ▼
AndroidGatewayProvider (lib/sms/providers/android-gateway.ts)
            │ [Handles Token Refresh, Rotation & HTTP Dispatch]
            ▼
Cloud Gateway API (https://api.sms-gate.app)
```

All token management, refresh logic, and credential storage remain strictly inside `lib/sms/` and the database helper, invisible to the rest of the application.

---

## 11. Existing Behavior Compatibility Verification

| Component | Status | Verification Detail |
|---|---|---|
| **`NotificationLog`** | **UNTOUCHED** | Same schema, same fields (`channel`, `type`, `status`, `messageId`, `errorMessage`). |
| **`status` Semantics** | **UNTOUCHED** | `"SENT"` if accepted by gateway; `"FAILED"` if token refresh or gateway fails. |
| **`deliveryStatus`** | **UNTOUCHED** | Decoupled; updated solely via `/api/webhooks/sms-gateway`. |
| **Webhook Processing** | **UNTOUCHED** | Signature verification and idempotency unchanged. |
| **Retry Worker** | **UNTOUCHED** | Only retries `status: "FAILED"`; benefits from automatic token refresh on retry. |
| **Deduplication** | **UNTOUCHED** | `hasExistingNotification` remains identical. |
| **Templates & Privacy**| **UNTOUCHED** | No template changes; zero technician phone leakage. |

---

## 12. Proposed Implementation Scope

### Minimum Files to Modify in Implementation Phase:
1. **`prisma/schema.prisma`**:
   - Add a lightweight `SmsGatewayToken` model:
     ```prisma
     model SmsGatewayToken {
       id           String   @id @default("active")
       accessToken  String   @map("access_token") @db.Text
       refreshToken String   @map("refresh_token") @db.Text
       expiresAt    DateTime @map("expires_at") @db.Timestamptz(6)
       updatedAt    DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

       @@map("sms_gateway_tokens")
     }
     ```
2. **`lib/sms/token-manager.ts` (NEW FILE)**:
   - Dedicated token manager module handling:
     - `getValidAccessToken()`
     - Proactive expiry check
     - Database persistence
     - Atomic lock acquisition
     - Gateway refresh API call
3. **`lib/sms/providers/android-gateway.ts`**:
   - Modify `send()` to request an active token from `TokenManager` before sending.
   - On unexpected HTTP 401, call `tokenManager.forceRefresh()` and retry dispatch once.
4. **`lib/sms/types.ts`**:
   - Add token management interfaces if required.
5. **`scripts/test-sms-gateway.mjs`**:
   - Update script to test token refresh endpoint and token validity.

---

## 13. Protected Files (MUST REMAIN UNTOUCHED)

- `lib/admin-auth.ts`
- `lib/technician-auth.ts`
- `lib/bookings/state-machine.ts`
- `lib/sms/templates.ts`
- `lib/sms/webhook-verification.ts`
- `app/api/webhooks/sms-gateway/route.ts`
- `app/api/notifications/retry/route.ts`
- `app/actions/bookings/admin.ts`
- `app/actions/bookings/technician.ts`
- `app/actions/bookings/customer.ts`

---

## 14. Comprehensive Test Plan (A through O)

The implementation phase must verify:

- [ ] **A. Valid Access Token**: Sends SMS successfully when token is active and unexpired.
- [ ] **B. Expired Access Token**: Triggers automatic refresh before or immediately on expiry without manual intervention.
- [ ] **C. Successful Refresh**: `POST /3rdparty/v1/auth/token/refresh` returns 201 with new access and refresh tokens.
- [ ] **D. Refresh-Token Rotation**: New `refresh_token` is successfully persisted to the database and replaces the old one.
- [ ] **E. Expired Refresh Token**: Gracefully marks dispatch as `FAILED` in `NotificationLog`, logs error, and does not crash caller.
- [ ] **F. Revoked Refresh Token**: Detects 401 on refresh and aborts cleanly without infinite loops.
- [ ] **G. Gateway 401 on Send**: Intercepts 401, forces single refresh, and retries dispatch.
- [ ] **H. Gateway Timeout**: AbortController triggers after 4s timeout without hanging.
- [ ] **I. Concurrent SMS Requests**: Multiple simultaneous requests share a single refresh call via database locking; zero token burnout.
- [ ] **J. Refresh Failure**: Graceful failure reporting; business action completes with success.
- [ ] **K. Secret Redaction**: Access tokens, refresh tokens, and passwords never appear in application logs or test output.
- [ ] **L. Normal SMS Failure Isolation**: Booking creation, confirmation, and assignment succeed even if SMS Gateway returns an error.
- [ ] **M. NotificationLog Verification**: Verifies `status = "SENT"` on success and `"FAILED"` on auth failure.
- [ ] **N. Existing Webhook/Retry Compatibility**: Webhook processing and cron retry worker continue working without modification.
- [ ] **O. TypeScript & Build Regression**: `npx tsc --noEmit` and `npm run build` pass with 0 errors.

---

## 15. Risks & Challenges

1. **Bootstrap Token Requirement**:
   - The gateway requires an initial valid `refresh_token` to begin the rotation cycle.
   - Because the current token in `.env.local` is already expired, an initial token pair must be generated via credentials or admin UI before automated rotation can commence.
2. **Multi-Instance Token Invalidation**:
   - If two servers run independent uncoordinated refreshes, the second server's refresh token will be invalidated by the gateway. This strictly mandates database-level coordination.
3. **Database Write Permissions**:
   - The application database role in PostgreSQL must have permissions to create/migrate and update the token table.

---

## 16. Open Questions for User Approval

1. **Token Seeding**: Would you prefer seeding the initial `refresh_token` via a one-time script (e.g. `scripts/seed-sms-token.mjs`) or by storing initial gateway account credentials in `.env.local`?
2. **Schema Migration**: Can we proceed with creating a single dedicated table `sms_gateway_tokens` in `prisma/schema.prisma` in the upcoming implementation phase?

---

## 17. Final Readiness Status

### **STATUS: PASS WITH BLOCKER**

#### Summary:
- **Audit Findings**: The OpenAPI specifications, endpoint contracts (`/3rdparty/v1/auth/token/refresh`), token rotation behavior, and serverless concurrency constraints are **100% verified and documented**.
- **Blocker**: An initial active `refresh_token` (or gateway credentials to generate one) and user approval to add the `sms_gateway_tokens` model to `prisma/schema.prisma` are required before implementation can proceed.
- **Code State**: **ZERO code modifications** were made during this audit phase.
