# PHASE 3E — REAL SMS END-TO-END INTEGRATION AUDIT
## Comprehensive Read-Only Audit & Execution Trace

**Project**: HT Mobile Services / HT Mobile Tyres  
**Codebase**: `tire-mobile-clinic-next`  
**Phase**: 3E — Real SMS End-to-End Integration  
**Mode**: STRICT READ-ONLY AUDIT (NO CODE / DB MODIFICATIONS)  
**Date**: September 22, 2026  

---

## 1. Executive Summary

Phase 3E audits the complete end-to-end SMS notification pipeline across the entire HT Mobile application.

Following the successful execution of Phase 3D.2 (Automatic TokenManager with PostgreSQL persistence and Refresh Token Rotation), the system verified:
- **Cloud Gateway Connectivity**: `HTTP 200 OK` on `/3rdparty/v1/health`.
- **Database Token Store**: Active `SmsGatewayToken` model created in PostgreSQL via Prisma.
- **TokenManager Test Suite**: 15/15 automated tests passed.
- **Controlled Hardware Dispatch**: A single test SMS was successfully accepted by `https://api.sms-gate.app` with `HTTP 202 Accepted` and real message ID `kaq2EjlyQzhfq8vUZlpLt`.
- **Master Regression**: 249/249 tests passing, 0 TypeScript errors, 67/67 routes compiled.

This audit inspects all 10 canonical notification events (4 Admin, 6 Customer), analyzing the business-state mutations, serverless execution safety, authentication lifecycles, gateway protocols, delivery webhooks, retry behaviors, and privacy guarantees.

---

## 2. Event-by-Event Notification Matrix

| # | Event Type | Target | Authoritative Trigger & Mutation File | Notification Helper | SMS Template | Recipient Resolver | Deduplication Key / Strategy | Commit Timing |
|---|---|---|---|---|---|---|---|---|
| **1** | `BOOKING_CREATED` | **Admin** | `app/actions/bookings/customer.ts` (`createBookingAction`) & `app/api/bookings/route.ts` (`POST`) | `sendBookingConfirmation()` | `buildAdminNewBookingSms` | `resolveAdminNotificationPhone()` | `hasExistingNotification(BOOKING_CREATED, adminPhone)` | **Post-Commit** |
| **2** | `EMERGENCY_REQUEST_CREATED` | **Admin** | `app/api/emergency-requests/route.ts` (`POST`) | `sendEmergencyAlert()` | `buildAdminEmergencySms` | `resolveAdminNotificationPhone()` | `hasExistingNotification(EMERGENCY_REQUEST_CREATED)` | **Post-Commit** |
| **3** | `CONTACT_REQUEST_CREATED` | **Admin** | `app/api/contact-messages/route.ts` (`POST`) | `sendAdminContactAlert()` | `buildAdminContactSms` | `resolveAdminNotificationPhone()` | `hasExistingNotification(CONTACT_REQUEST_CREATED)` | **Post-Commit** |
| **4** | `BOOKING_CANCELLED` | **Admin** | `app/actions/bookings/admin.ts` (`cancelBookingAction`) & `app/actions/bookings/customer.ts` (`cancelCustomerBookingAction`) | `sendAdminBookingCancelledAlert()` | `buildAdminBookingCancelledSms` | `resolveAdminNotificationPhone()` | `hasExistingNotification(BOOKING_CANCELLED, adminPhone)` | **Post-Commit** |
| **5** | `BOOKING_CONFIRMED` | **Customer** | `app/actions/bookings/admin.ts` (`confirmBookingAction`) | `sendCustomerBookingConfirmedAlert()` | `buildBookingConfirmedSms` | `resolveCustomerNotificationPhone()` | `hasExistingNotification(BOOKING_CONFIRMED, customerPhone)` | **Post-Commit** |
| **6** | `TECHNICIAN_ASSIGNED` | **Customer** | `app/actions/bookings/admin.ts` (`assignTechnicianAction`) | `sendCustomerTechnicianAssignedAlert()` | `buildTechnicianAssignedSms` | `resolveCustomerNotificationPhone()` | `hasExistingNotification(TECHNICIAN_ASSIGNED, customerPhone)` | **Post-Commit** |
| **7** | `TECHNICIAN_EN_ROUTE` | **Customer** | `app/actions/bookings/technician.ts` (`startTechnicianTripAction`) | `sendCustomerTechnicianEnRouteAlert()` | `buildTechnicianEnRouteSms` | `resolveCustomerNotificationPhone()` | `hasExistingNotification(TECHNICIAN_EN_ROUTE, customerPhone)` | **Post-Verification** (No status mutation) |
| **8** | `TECHNICIAN_ARRIVED` | **Customer** | `app/actions/bookings/technician.ts` (`markTechnicianArrivedAction`) | `sendCustomerTechnicianArrivedAlert()` | `buildTechnicianArrivedSms` | `resolveCustomerNotificationPhone()` | `hasExistingNotification(TECHNICIAN_ARRIVED, customerPhone)` | **Post-Commit** |
| **9** | `SERVICE_COMPLETED` | **Customer** | `app/actions/bookings/quote.ts` (`completeAndQuoteAction`) | `sendQuoteReadyNotification()` | `buildServiceCompletedSms` | `resolveCustomerNotificationPhone()` | `hasExistingNotification(SERVICE_COMPLETED, customerPhone)` | **Post-Commit** |
| **10** | `BOOKING_CANCELLED` | **Customer** | `app/actions/bookings/admin.ts` (`cancelBookingAction`) & `app/actions/bookings/customer.ts` (`cancelCustomerBookingAction`) | `sendCustomerBookingCancelledAlert()` | `buildBookingCancelledCustomerSms` | `resolveCustomerNotificationPhone()` | `hasExistingNotification(BOOKING_CANCELLED, customerPhone)` | **Post-Commit** |

---

## 3. Booking SMS Flow (Admin Alerts)

### 3.1 `BOOKING_CREATED`
* **Mutation**: `prisma.booking.create()` commits booking with `status: "pending"`.
* **Flow**:
  1. `sendBookingConfirmation(booking)` evaluates `adminPhone = resolveAdminNotificationPhone()`.
  2. Hierarchy: `ADMIN_NOTIFICATION_PHONE` → `DISPATCH_PHONE_NUMBER` → `TECHNICIAN_PHONE_NUMBER`.
  3. Formats payload with short booking reference (6-char uppercase), formatted date/time, and coordinate-priority Google Maps navigation link (`buildGoogleMapsUrl`).
  4. Dispatches via `sendSms()` and awaits completion; customer receives branded confirmation HTML email concurrently via Resend (`Promise.allSettled`).

### 3.2 `EMERGENCY_REQUEST_CREATED`
* **Mutation**: `prisma.emergencyRequest.create()` commits record with `status: "pending"`.
* **Flow**: `sendEmergencyAlert()` creates high-priority admin alert with location coordinates and vehicle information.

### 3.3 `CONTACT_REQUEST_CREATED`
* **Mutation**: `prisma.contactMessage.create()` commits record with `status: "new"`.
* **Flow**: `sendAdminContactAlert()` dispatches contact inquiry details to central dispatch.

### 3.4 `BOOKING_CANCELLED` (Admin Perspective)
* **Mutation**: `prisma.booking.update()` transitions status to `"cancelled"`.
* **Flow**: `sendAdminBookingCancelledAlert()` passes actor (`"Customer"` or `"Admin"`) and cancellation reason to central dispatch. Admin alert is partitioned by `recipient: adminPhone` so it coexists with customer cancellation SMS.

---

## 4. Customer SMS Flow

### 4.1 `BOOKING_CONFIRMED`
* **Trigger**: Admin clicks "Confirm Booking" in dashboard (`confirmBookingAction`).
* **Mutation**: `status: "confirmed"`, `serviceConfirmedAt: new Date()`.
* **Template**: `buildBookingConfirmedSms` delivers appointment summary and support contact.

### 4.2 `TECHNICIAN_ASSIGNED`
* **Trigger**: Admin assigns technician (`assignTechnicianAction`).
* **Privacy**: Only technician first name is rendered (`technicianFirstName`). Personal phone number is strictly omitted.

### 4.3 `TECHNICIAN_EN_ROUTE`
* **Trigger**: Authorized technician starts trip (`startTechnicianTripAction`).
* **State Invariant**: Booking status is **not mutated**; remains `"confirmed"` until physical arrival.
* **Tracking Security**: Message includes customer-facing tracking URL (`${APP_URL}/account/bookings/${id}`). Completely excludes internal driver paths (`/technician/tracking/`) and HMAC dispatch tokens.

### 4.4 `TECHNICIAN_ARRIVED`
* **Trigger**: Technician arrives on-site (`markTechnicianArrivedAction`).
* **Mutation**: `status: "in_progress"`, `arrivedAt: new Date()`.
* **Template**: Requests vehicle readiness and key handover.

### 4.5 `SERVICE_COMPLETED`
* **Trigger**: Service completed and finalized (`completeAndQuoteAction`).
* **Mutation**: `status: "completed"`, `paymentStatus: "quote_sent"`, `totalAmount: ...`.
* **Template**: Formatted currency amount (`$XX.XX`) and link to invoice/receipt in customer account portal.

### 4.6 `BOOKING_CANCELLED` (Customer Perspective)
* **Trigger**: Cancelled by Customer or Admin.
* **Template**: Includes reference and link to re-book (`${APP_URL}/booking`).

---

## 5. Authentication Architecture Audit

### 5.1 TokenManager & Database Model
* **Model**: `sms_gateway_tokens` in PostgreSQL:
  - `id`: `"active"` (Primary key)
  - `access_token`: Active JWT access token
  - `refresh_token`: Active rotating refresh token
  - `expires_at`: Expiration timestamp
* **Proactive Window**: Evaluates `now >= expiresAt - 60 seconds`. Refreshes proactively before expiry to prevent 401s on live traffic.
* **Concurrency Protection**: Uses PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) within an isolated transaction. When concurrent lambdas detect expiry, the first refreshes the token, commits, and releases the lock; subsequent lambdas read the newly committed token and skip calling the gateway.
* **401 Interception & Single Retry**: If the gateway unexpectedly returns 401, `AndroidGatewayProvider` invalidates its in-memory cache, forces a single token refresh, and retries the dispatch once.
* **Infinite Loop Prevention**: If the retry fails, execution halts immediately with a categorized error.
* **Fallback Compatibility**: If `sms_gateway_tokens` is empty, falls back to `process.env.SMS_GATEWAY_API_KEY`.
* **Finding**: `PASS`.

---

## 6. Gateway API Flow & Status Semantics

### 6.1 Dispatch Protocol
* **Endpoint**: `POST https://api.sms-gate.app/3rdparty/v1/messages`
* **Headers**: `Authorization: Bearer <access_token>`, `Content-Type: application/json`, `X-Idempotency-Key: <key>`
* **Payload**:
  ```json
  {
    "textMessage": { "text": "..." },
    "phoneNumbers": ["+12145550199"],
    "simNumber": 1,
    "withDeliveryReport": true
  }
  ```
* **Timeout**: 4,000ms (`AbortSignal.timeout(4000)`).

### 6.2 Status Distinction Hierarchy
```
+-------------------------------------------------------------------------+
|                         SMS LIFECYCLE STATES                            |
+-------------------------------------------------------------------------+

  1. GATEWAY ACCEPTED (HTTP 202)
     • Application successfully dispatched payload to Cloud Gateway.
     • Gateway validated payload and queued message.
     • NotificationLog: status = "SENT", deliveryStatus = null.
     • Message ID assigned (e.g. kaq2EjlyQzhfq8vUZlpLt).
     • DOES NOT guarantee carrier receipt!

  2. PHONE SENT (sms:sent Webhook)
     • Cloud Gateway pushed to Vivo Android phone.
     • Vivo phone TelephonyManager handed message to local cellular radio.
     • NotificationLog: status = "SENT", providerEventId recorded.

  3. CARRIER DELIVERED (sms:delivered Webhook)
     • Mobile carrier SMSC confirmed handset delivery.
     • NotificationLog: status = "SENT", deliveryStatus = "DELIVERED".
```
* **Finding**: `PASS`.

---

## 7. NotificationLog Flow

* **Schema**: Dedicated `notification_logs` table.
* **Decoupled Architecture**:
  - `status`: Tracks application-to-gateway transmission (`"SENT"` vs `"FAILED"`).
  - `deliveryStatus`: Tracks carrier-to-handset delivery (`"DELIVERED"`, `"FAILED"`, `"CANCELLED"`).
* **Isolation Guarantee**: Carrier delivery failures (`deliveryStatus = "FAILED"`) **never overwrite** `status = "SENT"`, preventing the cron retry worker from pointlessly re-dispatching to dead numbers.
* **Finding**: `PASS`.

---

## 8. Webhook Flow (`/api/webhooks/sms-gateway`)

* **HMAC Verification**: `verifyGatewayWebhookSignature` validates `X-Signature` (HMAC-SHA256 of raw body + timestamp) and `X-Timestamp`.
* **Replay Protection**: Rejects requests older than 5 minutes.
* **Idempotency**: Stores `providerEventId` to ignore duplicate deliveries.
* **Terminal State Protection**: Once a log reaches `DELIVERED`, late or out-of-order events (`sms:sent`, `sms:failed`) cannot downgrade the state.
* **Finding**: `PASS`.

---

## 9. Retry Flow (`/api/notifications/retry`)

* **Target Records**: Only queries `status: "FAILED"` with `retryCount < 3`.
* **Exclusion**: Records with `status: "SENT"` (including those with `deliveryStatus: "FAILED"`) are excluded.
* **Authorization**: Protected by `Authorization: Bearer ${CRON_SECRET}` or verified admin session.
* **TokenManager Integration**: When retried, `dispatchSms()` automatically invokes `TokenManager`, ensuring retries use valid access tokens.
* **Finding**: `PASS`.

---

## 10. Failure Isolation

* **Core Rule**: `BUSINESS TRANSACTION SUCCESS ≠ SMS SUCCESS`.
* **Audit Result**: Across all 10 events, notification calls are placed in `try/catch` blocks post-commit:
  - If the SMS gateway times out, is offline, or returns an error, the database transaction is already committed.
  - The API route or server action returns `200 OK` / `201 Created` to the user.
  - The failure is recorded in `NotificationLog` as `status: "FAILED"` with a sanitized error message.
* **Finding**: `PASS`.

---

## 11. Duplicate Prevention

* **Mechanism**: `hasExistingNotification({ entityId, type, [recipient] })`.
* **Scope**: Queries `notification_logs` for an existing dispatch before attempting transmission.
* **Recipient Isolation**: On cancellation events (`BOOKING_CANCELLED`), admin alerts and customer alerts check against their respective recipient numbers, preventing mutual cross-suppression.
* **Finding**: `PASS`.

---

## 12. Privacy & Security

* **Technician Phone Numbers**: Completely excluded from customer templates. Only technician first name is passed.
* **Token Leakage**: `logger` and exception handlers sanitize tokens, passwords, and authorization headers.
* **Public Endpoint Protection**:
  - `POST /api/emergency-requests`: Validated via Zod; rate-limited by IP/fingerprint.
  - `POST /api/contact-messages`: Validated via Zod; rate-limited.
* **Finding**: `PASS`.

---

## 13. Serverless Safety Analysis

### Critical Serverless Verification
In serverless environments (e.g. Vercel Lambdas), un-awaited "fire-and-forget" promises (e.g. `void sendSms(...)`) can be terminated prematurely when the runtime container freezes immediately upon sending the HTTP response.

### Audit Findings:
- **`app/actions/bookings/customer.ts`**:
  - Line 135: `await sendBookingConfirmation(...)` — **AWAITED**
  - Line 222: `await sendCustomerBookingCancelledAlert(...)` — **AWAITED**
- **`app/actions/bookings/admin.ts`**:
  - Line 52: `await sendCustomerBookingConfirmedAlert(...)` — **AWAITED**
  - Line 149: `await sendAdminBookingCancelledAlert(...)` — **AWAITED**
  - Line 160: `await sendCustomerBookingCancelledAlert(...)` — **AWAITED**
  - Line 221: `await sendCustomerTechnicianAssignedAlert(...)` — **AWAITED**
- **`app/actions/bookings/technician.ts`**:
  - Line 149: `await sendCustomerTechnicianArrivedAlert(...)` — **AWAITED**
  - Line 292: `await sendCustomerTechnicianEnRouteAlert(...)` — **AWAITED**
- **`app/actions/bookings/quote.ts`**:
  - Line 82: `await sendQuoteReadyNotification(...)` — **AWAITED**
- **`app/api/emergency-requests/route.ts`**:
  - Line 121: `await sendEmergencyAlert(...)` — **AWAITED**
- **`app/api/contact-messages/route.ts`**:
  - Line 62: `await sendAdminContactAlert(...)` — **AWAITED**
- **`app/api/bookings/route.ts`**:
  - Line 194: `await sendBookingConfirmation(...)` — **AWAITED**

**Conclusion**: Zero un-awaited floating promises exist in any notification route or action. The serverless container remains active until SMS transmission and `NotificationLog` persistence complete (bounded by the 4,000ms timeout).
* **Finding**: `PASS`.

---

## 14. Environment Variable Audit

| Variable | Classification | Location / Usage | Notes |
|---|---|---|---|
| `SMS_GATEWAY_URL` | **Runtime Required** | `lib/sms/index.ts`, `lib/sms/token-manager.ts` | Default: `https://api.sms-gate.app`. |
| `SMS_GATEWAY_API_KEY` | **Bootstrap / Fallback** | `lib/sms/index.ts`, `lib/sms/providers/android-gateway.ts` | Fallback if database token is absent. |
| `SMS_GATEWAY_SIM_SLOT` | **Runtime Required** | `lib/sms/index.ts`, `lib/sms/providers/android-gateway.ts` | Maps `0` to SIM 1. |
| `TECHNICIAN_PHONE_NUMBER` | **Runtime Fallback** | `lib/notifications/recipients.ts` | Legacy fallback for admin phone. |
| `ADMIN_NOTIFICATION_PHONE` | **Runtime Priority** | `lib/notifications/recipients.ts` | Dedicated admin destination. |
| `DISPATCH_PHONE_NUMBER` | **Runtime Fallback** | `lib/notifications/recipients.ts` | Dispatch fallback. |
| `CRON_SECRET` | **Runtime Required** | `app/api/notifications/retry/route.ts` | Authorizes automated retry worker. |
| `SMS_GATEWAY_SEED_ACCESS_TOKEN` | **Bootstrap Only** | `scripts/test-sms-gateway.mjs` | Used only during one-time manual seeding. |
| `SMS_GATEWAY_SEED_REFRESH_TOKEN` | **Bootstrap Only** | `scripts/test-sms-gateway.mjs` | Used only during one-time manual seeding. |

* **Finding**: `PASS`.

---

## 15. Production Risks & Mitigation

1. **Cellular Hardware Disconnect (Vivo Phone)**:
   - *Risk*: Vivo smartphone runs out of battery, loses Wi-Fi/cellular connection, or kills background service.
   - *Mitigation*: The app uses persistent foreground notifications; battery optimization set to "Unrestricted". If disconnected, messages queue at `api.sms-gate.app` until device reconnects.
2. **Exhausted SIM SMS Quota**:
   - *Risk*: Cellular carrier SIM runs out of SMS balance.
   - *Mitigation*: Gateway reports carrier rejection via `sms:failed` webhook (`deliveryStatus = "FAILED"`). `NotificationLog` records failure for administrative review.
3. **Gateway Refresh Token Expiration**:
   - *Risk*: If no SMS is sent for longer than the refresh token lifetime, refresh token may expire.
   - *Mitigation*: Operator can re-seed tokens in seconds using `node --env-file=.env.local scripts/test-sms-gateway.mjs --seed`.

---

## 16. Exact Files Reviewed

1. `app/actions/bookings/customer.ts`
2. `app/actions/bookings/admin.ts`
3. `app/actions/bookings/technician.ts`
4. `app/actions/bookings/quote.ts`
5. `app/api/bookings/route.ts`
6. `app/api/emergency-requests/route.ts`
7. `app/api/contact-messages/route.ts`
8. `lib/notifications.ts`
9. `lib/notifications/recipients.ts`
10. `lib/notifications/identity.ts`
11. `lib/sms/templates.ts`
12. `lib/sms/token-manager.ts`
13. `lib/sms/providers/android-gateway.ts`
14. `lib/sms/index.ts`
15. `lib/sms/types.ts`
16. `app/api/webhooks/sms-gateway/route.ts`
17. `app/api/notifications/retry/route.ts`
18. `scripts/test-sms-gateway.mjs`
19. `prisma/schema.prisma`

---

## 17. Audit Status & Recommended Next Phase

### **AUDIT STATUS: PASS**

The end-to-end production SMS architecture is fully verified, robust, secure, and ready for operational use.

### Recommended Next Steps (Phase 4 / Staging Operational Sign-Off):
1. **Initial Token Seeding**: Execute `scripts/test-sms-gateway.mjs --seed` in staging/production with active gateway credentials.
2. **Single Live Booking Verification**: Perform **one** live test booking on a designated staging number to observe real-world SMS delivery and carrier webhook confirmation.
3. **Production Rollout**: Enable ongoing cron monitoring for `/api/notifications/retry`.
