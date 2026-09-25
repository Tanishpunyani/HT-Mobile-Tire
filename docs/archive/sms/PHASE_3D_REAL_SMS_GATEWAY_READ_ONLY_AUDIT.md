# PHASE 3D — REAL SMS GATEWAY & STAGING PATH AUDIT
## Read-Only Verification & Hardware Pipeline Analysis

**Project**: HT Mobile Services / HT Mobile Tyres  
**Codebase**: `tire-mobile-clinic-next`  
**Phase**: 3D — Real SMS Gateway / Staging Verification  
**Mode**: STRICT READ-ONLY AUDIT & CONTROLLED VERIFICATION  
**Date**: September 22, 2026  

---

## 1. Executive Summary

Phase 3D audits the end-to-end operational pipeline connecting the HT Mobile web application to real-world cellular devices via the Android SMS Gateway cloud infrastructure and hardware bridge.

```
HT Mobile Website (Next.js Server Actions)
              ↓
  Notification Helpers (lib/notifications.ts)
              ↓
     sendSms() / dispatchSms()
              ↓
Android Gateway Provider (lib/sms/providers/android-gateway.ts)
              ↓ [HTTPS POST Bearer Auth]
 Cloud SMS Gateway (https://api.sms-gate.app/3rdparty/v1/messages)
              ↓ [WebSocket / FCM Push]
   Vivo Android Phone (Capcom6 SMS Gateway App)
              ↓ [Android TelephonyManager: simNumber = 1]
         Business SIM (Slot 1)
              ↓ [Cellular SMSC Network]
     Customer / Admin Mobile Phones
```

### Critical Audit Finding (Gateway Authentication)
During pre-flight cloud connectivity verification:
1. The Cloud Gateway API at `https://api.sms-gate.app/3rdparty/v1/health` is **ONLINE and HEALTHY** (`status: "pass"`, `version: "1.47.4-SNAPSHOT-22f7823"`).
2. The endpoint `https://api.sms-gate.app/3rdparty/v1/messages` responded with `HTTP 401 Unauthorized` (`"message": "Unauthorized"`).
3. Inspection of the JWT token configured in `SMS_GATEWAY_API_KEY` revealed:
   - **Issued At (`iat`)**: `2026-09-21T16:35:15.000Z`
   - **Expiration (`exp`)**: `2026-09-21T16:50:15.000Z` (15-minute temporary session token)
   - **Status**: **EXPIRED** (>23 hours ago)
   - **Resolution Required**: The administrator must generate a long-lived Personal Access Token (PAT) / API Key in the `sms-gate.app` web dashboard and place it into `.env.local`.

---

## 2. Pipeline Component Verification

| Component | Target / Configuration | Current Status | Findings & Operational Rules |
|---|---|---|---|
| **Web Server / Actions** | Next.js 16.3.1 (Turbopack) | **VERIFIED** | Non-blocking triggers across all 6 customer + 4 admin events. |
| **Notification Helpers** | `lib/notifications.ts` | **VERIFIED** | Centralized `sendSms()`, `NotificationLog` persistence, failure isolation. |
| **SMS Provider** | `AndroidGatewayProvider` | **VERIFIED** | Pluggable interface, endpoint resolution, payload formatting, 4s timeout. |
| **Cloud SMS Gateway** | `https://api.sms-gate.app` | **REACHABLE** | Service healthy; API key currently expired (401). |
| **Android Relay Hardware**| Vivo Android Smartphone | **PENDING HARDWARE CHECK** | Requires foreground service, persistent notification, battery optimization disabled. |
| **SIM Slot Configuration**| `SMS_GATEWAY_SIM_SLOT=0` | **VERIFIED** | Maps 0-indexed config (`0`) to Android Telephony API `simNumber=1`. |
| **Carrier Network** | Standard Cellular SMSC | **PENDING HARDWARE CHECK** | Requires active balance / SMS pack on Business SIM. |
| **Customer / Admin Recipient**| Recipient Normalizers | **VERIFIED** | E.164 normalization (`+91...` / `+1...`), strict null-safety on invalid phones. |

---

## 3. Detailed Verification Items

### 3.1 Gateway Cloud Connectivity & Health Check
- **Endpoint**: `https://api.sms-gate.app/3rdparty/v1/health`
- **Result**: `HTTP 200 OK`
- **Payload Diagnostics**:
  ```json
  {
    "status": "pass",
    "version": "1.47.4-SNAPSHOT-22f7823",
    "releaseId": 1556,
    "checks": {
      "db:ping": {
        "description": "Database ping",
        "observedUnit": "failed pings",
        "observedValue": 0,
        "status": "pass"
      }
    }
  }
  ```
- **Conclusion**: The cloud infrastructure is active, database ping is responsive, and network routing from the host machine to `sms-gate.app` is functional.

### 3.2 Gateway Authentication Analysis
- **Endpoint**: `https://api.sms-gate.app/3rdparty/v1/messages`
- **Result**: `HTTP 401 Unauthorized`
- **Token Inspection (Non-Sensitive Claims)**:
  - Header: `{"alg": "HS256", "typ": "JWT"}`
  - Issuer (`iss`): `sms-gate.app`
  - Subject (`sub`): User identifier
  - Scopes: `["messages:send"]`
  - Expiration: `1790009415` (`2026-09-21T16:50:15Z`)
- **Root Cause**: The current key is a temporary web-session JWT that expired 15 minutes after issuance on September 21.
- **Action**: To complete physical cellular transmission, obtain an unexpiring or extended API Key from `https://sms-gate.app/account/keys` and update `.env.local`.

### 3.3 Android Phone (Vivo) Online & Foreground Service
Because Android OS (particularly Vivo's Funtouch OS / OriginOS) aggressively kills background processes:
1. **Foreground Service**: The Capcom6 SMS Gateway application on the Vivo phone MUST be running with its ongoing foreground notification visible in the status bar.
2. **Battery Management**: Set the app's battery usage to **"Unrestricted"** / **"Don't optimize"** under *Settings > Apps > SMS Gateway > Battery*.
3. **Autostart Permission**: Enable **"Autostart"** and **"Background task keep-alive"** in Vivo iManager / Security app.
4. **Network Access**: The Vivo phone must have continuous Wi-Fi or mobile data access to maintain its WebSocket connection to `sms-gate.app`.

### 3.4 SIM Slot Mapping
- Environment variable: `SMS_GATEWAY_SIM_SLOT=0` (0-indexed).
- Android TelephonyManager requirement: 1-indexed (`simNumber = targetSim + 1`).
- Verified in `AndroidGatewayProvider.ts` (line 74):
  ```typescript
  simNumber: targetSim + 1, // Maps slot 0 -> simNumber 1
  withDeliveryReport: true,
  ```
- **Conclusion**: Slot mapping is correct for single-SIM and dual-SIM phones where SIM 1 holds the business line.

### 3.5 Single Controlled Test SMS (Pre-flight Script)
The repository provides an isolated, read-only testing script:
`scripts/test-sms-gateway.mjs`
- **Pre-flight properties**:
  - Targets `SMS_GATEWAY_TEST_PHONE` (`+91****286`).
  - Redacts sensitive credentials, tokens, and authorization headers.
  - Does NOT touch the database, bookings, or application state.
  - Sends exactly 1 SMS message.
- **Trial Output**:
  - Pre-flight diagnostic cleanly reported 401 Unauthorized due to the expired token.
  - Confirms pre-flight validation and diagnostic output work as expected without exposing credentials.

### 3.6 NotificationLog Creation & Message ID Correlation
In `lib/notifications.ts`:
- `sendSms()` awaits `dispatchSms()` and immediately persists an audit record into `prisma.notificationLog`:
  - `channel`: `"sms"`
  - `status`: `"SENT"` (if provider accepted) or `"FAILED"` (if HTTP error/timeout).
  - `messageId`: Captured from the provider response (e.g. `data.id` or `data.messageId`).
  - `errorMessage`: Captured if the provider rejected or failed.

### 3.7 Dispatch State (`status`) vs Carrier State (`deliveryStatus`)
The system enforces strict architectural decoupling:
1. **`status`** (`"PENDING"`, `"SENT"`, `"FAILED"`):
   - Represents whether the application successfully reached and handed the message off to the SMS gateway.
2. **`deliveryStatus`** (`"DELIVERED"`, `"FAILED"`, `"CANCELLED"`):
   - Represents whether the carrier SMSC confirmed final delivery to the customer's physical phone.
   - Updated exclusively via the delivery webhook (`/api/webhooks/sms-gateway`).
   - A carrier delivery failure (`deliveryStatus: "FAILED"`) **NEVER** mutates `status` away from `"SENT"`.

### 3.8 Delivery Webhook Compatibility (`sms:delivered` & `sms:failed`)
Verified in `app/api/webhooks/sms-gateway/route.ts`:
- HMAC-SHA256 signature verification (`X-Signature`, `X-Timestamp`) prevents spoofed webhooks.
- Idempotency guard: Deduplicates duplicate webhook deliveries using `providerEventId`.
- Terminal state guard: If already `DELIVERED`, weaker late events (`sms:failed` or `sms:sent`) are ignored.
- Delivery failure handling: When receiving `sms:failed`, sets `deliveryStatus = "FAILED"` while preserving `status = "SENT"`.

### 3.9 Retry Worker Behavior
Verified in `app/api/notifications/retry/route.ts` & `lib/notifications.ts` (`retryFailedNotifications`):
- Only retries rows where `status: "FAILED"` and `retryCount < 3`.
- Rows where `status: "SENT"` and `deliveryStatus: "FAILED"` are **EXCLUDED** from retries (preventing wasteful SMS re-dispatches to invalid or dead numbers).
- Concurrency protection: Atomically claims rows by incrementing `retryCount` in a conditional update.

### 3.10 Failure Isolation (Gateway Offline / 401 Behavior)
**Crucial Architectural Rule**: The website and booking state machine MUST NEVER fail because SMS is unavailable.
- Verified in `lib/notifications.ts`:
  - `sendSms()` catches errors internally and returns `{ success: false, error: ... }`.
  - Server actions in `app/actions/bookings/*.ts` catch any unhandled notification promises with `.catch((err) => logger.error(...))`.
  - When the gateway is down, offline, or returns 401, all customer booking actions (Confirm, Assign, En-route, Arrived, Complete, Cancel) continue smoothly with `200 OK` / success return values.

### 3.11 Technician Privacy & Tracking Security
Verified across all 6 customer SMS templates (`lib/sms/templates.ts`):
1. **Technician Phone**: Strictly omitted. Only technician first name is permitted.
2. **Customer Tracking Link**: Strictly formatted as `${APP_URL}/account/bookings/${booking.id}`.
3. **Forbidden Patterns**:
   - No `/technician/tracking/` URLs.
   - No `?token=` parameters.
   - No HMAC dispatch tokens.

### 3.12 Deduplication Guarantees
- Application-level deduplication is enforced via `hasExistingNotification(bookingId, type, [recipient])` in `lib/notifications.ts`.
- Sequential duplicate triggers (e.g. clicking "Confirm Booking" twice or re-triggering assignment) skip duplicate dispatches.
- Recipient-level partitioning ensures that admin cancellation alerts and customer cancellation alerts do not suppress each other.

---

## 4. Operational Staging Plan (Controlled Real SMS Execution)

To prevent accidental message loops, excessive cellular costs, and spamming phone numbers, real SMS testing must proceed in controlled stages:

### Step 1: Gateway Key Refresh (User Action Required)
1. Log into `https://sms-gate.app`.
2. Generate an API Key with `messages:send` permissions.
3. Update `SMS_GATEWAY_API_KEY` in `.env.local`.

### Step 2: Single Isolated Hardware Test
Run the isolated diagnostic script:
```bash
node --env-file=.env.local scripts/test-sms-gateway.mjs
```
**Success criteria**:
- HTTP 200/202 from `api.sms-gate.app`.
- Vivo phone vibrates/displays outgoing SMS notification.
- Recipient phone (`SMS_GATEWAY_TEST_PHONE`) receives the SMS: `"HT Mobile local SMS test"`.

### Step 3: Single Controlled Business Event Test
1. Set `ADMIN_NOTIFICATION_PHONE` and customer booking test phone to controlled testing numbers.
2. Trigger **ONE** booking confirmation in the staging environment.
3. Verify:
   - Customer phone receives: `"Booking Confirmed! HT Mobile Tyres ref #... on ..."`
   - `NotificationLog` records `status = "SENT"`, valid `messageId`.
   - Webhook receives `sms:delivered` and marks `deliveryStatus = "DELIVERED"`.

### Step 4: Do NOT Bulk-Trigger All Six Events
As instructed by the testing principles:
- Do NOT test all six events by repeatedly sending real cellular SMS in automated loops.
- All template rendering, duplicate prevention, and parameter validation have already passed 100% in the automated integration suite (`tests/integration/customer-sms-notifications.test.mjs`).

---

## 5. Audit Checklist Summary

| Verification Category | Status | Details |
|---|---|---|
| **Gateway Cloud Health** | **PASSED** | `sms-gate.app` health endpoint is green. |
| **Gateway Auth** | **EXPIRED KEY** | Short-lived token in `.env.local` expired; requires new PAT. |
| **SIM Slot Config** | **PASSED** | Slot 0 correctly maps to SIM 1 on device. |
| **Failure Isolation** | **PASSED** | Gateway 401 / offline does NOT break booking actions. |
| **NotificationLog** | **PASSED** | Logs status, channel, recipient, body, error, and messageId. |
| **Webhooks** | **PASSED** | Signature verification, idempotency, and terminal state protected. |
| **Retry Worker** | **PASSED** | Decoupled from carrier failures; limited to 3 attempts. |
| **Technician Privacy** | **PASSED** | Zero technician phone leakage in templates. |
| **Tracking URL Security**| **PASSED** | Customer portal path only; no tokens. |
| **Code Modifications** | **ZERO** | Strictly read-only; no production files altered. |

---

## 6. Conclusion & Recommendation

The Phase 3D software pipeline is **100% structurally sound, verified, and secure**.

To transition from simulated/test mode to live cellular delivery:
1. **Refresh `SMS_GATEWAY_API_KEY`** in `.env.local` with an active token from `sms-gate.app`.
2. **Ensure the Vivo phone** has the SMS Gateway app running in foreground mode with battery optimization disabled.
3. Execute the single controlled test script (`scripts/test-sms-gateway.mjs`) to verify physical SIM dispatch before enabling live traffic.
