# PHASE 3D.2 — SMS GATEWAY AUTOMATIC TOKEN REFRESH
## Implementation & Verification Report

**Project**: HT Mobile Services / HT Mobile Tyres  
**Codebase**: `tire-mobile-clinic-next`  
**Phase**: 3D.2 — SMS Gateway Automatic Token Refresh  
**Mode**: IMPLEMENTATION & VERIFICATION  
**Date**: September 22, 2026  

---

## 1. Executive Summary

Phase 3D.2 successfully implements an automated access-token refresh architecture for the Android SMS Gateway (`sms-gate.app`) integration. 

The previous implementation relied solely on a static or manually refreshed Bearer token configured in `SMS_GATEWAY_API_KEY`, which failed as soon as the gateway's short-lived web token expired.

The new architecture introduces:
1. **Durable Database Persistence**: A dedicated PostgreSQL table (`sms_gateway_tokens`) storing the active `access_token`, `refresh_token`, and `expires_at`.
2. **Dedicated TokenManager (`lib/sms/token-manager.ts`)**: Proactively monitors token validity (refreshing within a 60-second window prior to expiration) and orchestrates single-flight token rotation.
3. **Database-Level Concurrency Control**: Uses PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) within an isolated transaction to prevent concurrent lambdas/requests from burning the same rotating refresh token simultaneously.
4. **Provider Interception & Single Retry**: `AndroidGatewayProvider` obtains valid tokens from `TokenManager` before sending. If the gateway unexpectedly responds with `HTTP 401 Unauthorized`, it invalidates the local cache, triggers a single forced refresh, and retries the dispatch exactly once.
5. **Absolute Secret Safety**: Access tokens, refresh tokens, passwords, and authorization headers are never logged or exposed.
6. **Zero Business Logic Modification**: Existing notification handlers, booking state transitions, webhooks, and retry workers remain completely decoupled and untouched.

---

## 2. Files Changed & Implementation Scope

### Allowed Files Modified / Created:
1. **`prisma/schema.prisma`**:
   - Added dedicated `SmsGatewayToken` model.
2. **`prisma/migrations/20260922000000_add_sms_gateway_tokens/migration.sql`**:
   - Migration script creating the `sms_gateway_tokens` table.
3. **`lib/sms/types.ts`**:
   - Added `SmsGatewayTokenPair` and `ITokenManager` interfaces.
4. **`lib/sms/token-manager.ts` [NEW]**:
   - Core `TokenManager` implementation featuring PostgreSQL row locking, proactive refresh, in-memory cache optimization, and safe error handling.
5. **`lib/sms/providers/android-gateway.ts`**:
   - Integrated `TokenManager` into outbound SMS dispatch with HTTP 401 interception and single retry.
6. **`scripts/test-sms-gateway.mjs`**:
   - Diagnostic script supporting token state inspection, safe initial seeding, and controlled real SMS testing.
7. **`tests/integration/sms-token-manager.test.mjs` [NEW]**:
   - Focused unit and integration test suite covering all 15 required token-manager scenarios.
8. **`tests/run-all.mjs`**:
   - Registered `runSmsTokenManagerTests()` in the master regression suite.

### Protected Files Preserved (100% Untouched):
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

## 3. Database Model & Migration

### Prisma Model
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

### Migration Applied
- **File**: `prisma/migrations/20260922000000_add_sms_gateway_tokens/migration.sql`
- **Execution**: Applied to the Supabase PostgreSQL database using `prisma db push` (sync completed with exit code 0).
- **Client Generation**: Regenerated via `prisma generate` to `generated/prisma`.

---

## 4. TokenManager Architecture

```
                      Outbound SMS Request
                               │
                               ▼
               AndroidGatewayProvider.send(params)
                               │
                               ▼
                 tokenManager.getValidAccessToken()
                               │
            Is in-memory token valid? (now < exp - 60s)
                           ╱       ╲
                         YES        NO (or expired)
                         ╱            ╲
                        ▼              ▼
                 Return Token   Begin DB Transaction
                                       │
                                SELECT ... FOR UPDATE
                                (Row lock on 'active')
                                       │
                                Re-check expires_at
                             (Did another worker refresh?)
                                  ╱         ╲
                                YES          NO
                                ╱             ╲
                               ▼               ▼
                        Return Cached      Call Gateway:
                            Token       POST /auth/token/refresh
                                               │
                                         HTTP 201 Response?
                                             ╱    ╲
                                           YES     NO (401/Timeout)
                                           ╱         ╲
                                          ▼           ▼
                                     Save New Pair   Log sanitized error
                                     in DB & cache   & return null
                                          │           │
                                          ▼           ▼
                                     Commit TX    Commit TX
                                     (Release)    (Release)
```

---

## 5. Concurrency Protection & Refresh Token Rotation (RTR)

Because the Capcom6 Gateway enforces **Refresh Token Rotation**, two concurrent requests must never dispatch the same `refresh_token` to `/3rdparty/v1/auth/token/refresh`.

**Solution Implemented**:
1. When multiple serverless instances detect token expiration, they enter `prisma.$transaction`.
2. The first instance executes:
   ```sql
   SELECT id, access_token, refresh_token, expires_at 
   FROM sms_gateway_tokens 
   WHERE id = 'active' 
   FOR UPDATE
   ```
3. Subsequent concurrent transactions are queued by PostgreSQL until the lock is released.
4. When the second transaction unblocks, it reads the freshly committed record. Since `now < expires_at - 60000`, it immediately uses the newly generated `access_token` and **never calls the gateway again**.
5. Verified in automated test scenario 10: Two simultaneous callers share exactly one refresh execution.

---

## 6. HTTP 401 Interception & Single Retry Flow

In `AndroidGatewayProvider.send()`:
1. Dispatches SMS to `${baseUrl}/3rdparty/v1/messages` with `Authorization: Bearer ${token}`.
2. If the gateway returns `401 Unauthorized`:
   - Provider logs: `"sms.android_gateway_unauthorized_forcing_refresh"`.
   - Calls `tokenManager.forceRefresh()`.
   - If a new token is obtained, it retries the dispatch request **exactly once**.
   - If the retry succeeds, it logs `"sms.android_gateway_dispatched_after_refresh"` and returns `{ success: true, messageId }`.
   - If the retry also fails (e.g. another 401 or network error), it returns `{ success: false, error }` without entering a recursive loop.

---

## 7. Security & Secret Redaction

- **No Secret Logging**: `TokenManager` and `AndroidGatewayProvider` scrub Bearer tokens, JWT strings, and secret credentials from all logs and error messages.
- **Controlled Error Messages**: Notification logs and caller exceptions receive sanitized diagnostic strings such as `"SMS Gateway authentication failed: Unable to refresh access token"`.
- **Seeding Support**: The utility script `scripts/test-sms-gateway.mjs --seed` reads `SMS_GATEWAY_SEED_ACCESS_TOKEN` and `SMS_GATEWAY_SEED_REFRESH_TOKEN` directly into PostgreSQL without printing them to console or disk.

---

## 8. Verification Results

### 8.1 Focused TokenManager Test Suite
Executed: `node tests/integration/sms-token-manager.test.mjs`
```
=== [SUITE] Phase 3D.2: SMS Gateway Automatic Token Refresh ===
  ✓ [PASS] 1. Valid unexpired token is returned without invoking refresh endpoint
  ✓ [PASS] 2. Proactive refresh triggers when token is within 60s of expiration
  ✓ [PASS] 3. Expired token triggers refresh and returns newly issued access token
  ✓ [PASS] 4. Gateway refresh endpoint sends empty body and Bearer refresh_token
  ✓ [PASS] 5. Rotated refresh token replaces old refresh token in database
  ✓ [PASS] 6. Refresh failure returns null gracefully and does not throw unhandled error
  ✓ [PASS] 7. Refresh 401 returns null and aborts without infinite loops
  ✓ [PASS] 8. Outbound SMS receiving 401 forces single refresh and succeeds on retry
  ✓ [PASS] 9. When retry after 401 also fails, provider halts without further refresh
  ✓ [PASS] 10. Concurrent refresh callers share single execution and do not burn refresh token
  ✓ [PASS] 11. Error messages and logs never leak tokens or Authorization headers
  ✓ [PASS] 12. Provider authentication failure produces failure result without throwing
  ✓ [PASS] 13. Failed authentication preserves NotificationLog status = FAILED semantics
  ✓ [PASS] 14. Delivery webhooks function independently of TokenManager state
  ✓ [PASS] 15. Retry worker picks up status = FAILED and attempts dispatch with fresh token

Summary: 15/15 PASS (100%)
```

### 8.2 TypeScript Check
Executed: `npx tsc --noEmit`
- **Exit Code**: `0`
- **Errors**: `0`

### 8.3 Master Regression Test Suite
Executed: `node tests/run-all.mjs`
- **Total Tests**: `249` (234 previous + 15 new token refresh tests)
- **Passed**: `249`
- **Failed**: `0`
- **Skipped**: `0`

### 8.4 Production Build
Executed: `npm run build`
- **Result**: Successful production build via Next.js 16.3.1 (Turbopack).
- **Routes Compiled**: 67/67 routes generated with zero build errors.
- **Exit Code**: `0`

---

## 9. Real SMS Hardware Status

```
REAL SMS TEST: NOT EXECUTED (DELIBERATE SAFETY GUARD)
```

**Reason**: Real SMS was not executed during this implementation phase to avoid unnecessary cellular carrier costs and duplicate message risks. The automated provider tests thoroughly verified payload formatting, authentication headers, error classification, and retry semantics. Live dispatch can be triggered on demand using:
```bash
node --env-file=.env.local scripts/test-sms-gateway.mjs --send-sms
```

---

## 10. Known Limitations & Operational Notes

1. **Initial Seed Requirement**:
   - The automatic refresh loop requires an initial token pair to be seeded into `sms_gateway_tokens`.
   - The operator can run `scripts/test-sms-gateway.mjs --seed` with initial credentials or insert a row directly into PostgreSQL.
2. **Fallback Compatibility**:
   - If the database table is unseeded, `AndroidGatewayProvider` falls back to `process.env.SMS_GATEWAY_API_KEY` to preserve backward compatibility.

---

## 11. Final Implementation Status

### **PHASE 3D.2 IMPLEMENTATION STATUS: PASSED**

- **Database Model & Migration**: Applied and verified in PostgreSQL.
- **TokenManager**: Fully implemented with single-flight concurrency locking.
- **AndroidGatewayProvider**: Integrated with proactive expiry checks, 401 interception, and single retry.
- **Focused Tests**: 15/15 PASS.
- **Master Regression**: 249/249 PASS.
- **TypeScript**: PASS (Exit 0).
- **Production Build**: PASS (Exit 0).
- **Protected Files**: 100% Untouched.
- **Real SMS**: NOT EXECUTED (Safety guard preserved).
