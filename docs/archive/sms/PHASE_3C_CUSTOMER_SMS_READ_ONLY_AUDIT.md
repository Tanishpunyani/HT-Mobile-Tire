# PHASE 3C — HT MOBILE SMS NOTIFICATION SYSTEM
## CUSTOMER SMS NOTIFICATIONS — READ-ONLY AUDIT

**Project:** HT Mobile Services / HT Mobile Tyres  
**Codebase:** `tire-mobile-clinic-next`  
**Phase:** 3C — Customer SMS Notifications  
**Mode:** STRICT READ-ONLY AUDIT ONLY (NO IMPLEMENTATION)  
**Date:** 2026-09-22  

---

### 1. Current Customer Notification Architecture

The current customer notification architecture is heavily reliant on email, with SMS largely deferred:

1. **Booking Created (`sendBookingConfirmation`):**
   - **Customer:** Receives an HTML confirmation email via Resend (`type: "booking_confirmation"`). **No customer SMS** is dispatched (only Admin SMS is sent via Phase 3B).
2. **Emergency Request Created (`sendEmergencyAlert`):**
   - **Customer:** Receives an HTML emergency email with estimated ETA via Resend (`type: "emergency_alert"`). **No customer SMS** is dispatched.
3. **Admin Status Changes (`sendStatusUpdate`):**
   - Triggered exclusively by the dormant secondary REST endpoint `PATCH /api/admin/bookings/[id]` and test action `app/actions/notifications.ts`.
   - Sends SMS strictly to `TECHNICIAN_PHONE_NUMBER` (`type: "status_update"`) and an HTML email to the customer. **Zero customer SMS** is sent.
4. **Service Completed & Quote Ready (`sendQuoteReadyNotification`):**
   - Dispatched in `completeAndQuoteAction` (`app/actions/bookings/quote.ts`).
   - Dispatches an itemized HTML email via Resend and an SMS to `customerPhone` (`type: "quote_ready"`).
   - **Gap:** Uses an inline string template rather than the centralized Phase 3A template `buildServiceCompletedSms`, does not use `resolveCustomerNotificationPhone`, and lacks deterministic identity duplicate prevention.
5. **Customer & Admin Cancellations:**
   - Dispatches `sendAdminBookingCancelledAlert` to the admin (implemented in Phase 3B). **Zero customer cancellation SMS** is sent.
6. **Technician Milestones (`assignTechnicianAction`, `markTechnicianArrivedAction`):**
   - Execute database updates and cache revalidations with **zero notification dispatch logic**.

---

### 2. BOOKING_CONFIRMED Flow

- **Authoritative Mutation Path:**
  - `app/actions/bookings/admin.ts` -> `confirmBookingAction(bookingId)`
- **Secondary Path:**
  - `app/api/admin/bookings/[id]/route.ts` -> `PATCH /api/admin/bookings/[id]` with `status: "confirmed"`
- **Current Behavior:**
  - `confirmBookingAction` validates admin session, validates transition (`validateBookingTransition(booking.status, "confirmed", "admin")`), updates `status: "confirmed"` and `serviceConfirmedAt: new Date()`, and revalidates paths.
  - **Zero notifications are dispatched** in `confirmBookingAction`.
- **Phase 3C Requirements:**
  - Add post-commit non-blocking dispatch to customer:
    ```typescript
    await sendCustomerBookingConfirmedAlert(booking);
    ```
  - **Template:** `buildBookingConfirmedSms({ customerFirstName, service, vehicle, date, time, shortBookingId, businessPhone })`
  - **Recipient:** `resolveCustomerNotificationPhone(booking.customer)`
  - **NotificationType:** `BOOKING_CONFIRMED`
  - **Identity Key:** `buildBookingConfirmedKey(booking.id)`
  - **Deduplication:** Application-level check on `(booking.id, "BOOKING_CONFIRMED")`.

---

### 3. TECHNICIAN_ASSIGNED Flow

- **Authoritative Mutation Path:**
  - `app/actions/bookings/admin.ts` -> `assignTechnicianAction(bookingId, technicianId)`
- **Current Behavior:**
  - Validates admin session, checks technician `isActive`, updates `technicianId`, and updates `status = "confirmed"` if previously `"pending"`.
  - **Zero notifications are dispatched.**
- **Phase 3C Requirements:**
  - After database commit, hydrate technician and customer data:
    ```typescript
    await sendCustomerTechnicianAssignedAlert({ booking, technician });
    ```
  - **Template:** `buildTechnicianAssignedSms({ customerFirstName, technicianFirstName, service, date, time, shortBookingId, businessPhone })`
  - **Recipient:** `resolveCustomerNotificationPhone(booking.customer)`
  - **NotificationType:** `TECHNICIAN_ASSIGNED`
  - **Identity Key:** `buildTechnicianAssignedKey(booking.id, technician.id)`
  - **Technician Privacy:** Strictly pass `extractFirstName(technician.name)`. Never include technician phone number.

---

### 4. TECHNICIAN_EN_ROUTE Flow

- **Current Codebase State:**
  - There is currently **no explicit route departure action** in `app/actions/bookings/technician.ts`.
  - The technician portal currently provides `markTechnicianArrivedAction` and `getTechnicianPortalDataAction`.
  - `app/api/technician/location/route.ts` records raw GPS coordinates but does not trigger departure notifications.
- **Phase 3C Architectural Strategy:**
  - Implement a dedicated Server Action in `app/actions/bookings/technician.ts`:
    ```typescript
    export async function startTechnicianTripAction(bookingId: string, token?: string)
    ```
  - Validates dispatch token / staff auth, confirms booking is in `confirmed` status, sets initial departure timestamp if needed, and dispatches customer SMS.
  - **Template:** `buildTechnicianEnRouteSms({ customerFirstName, technicianFirstName, etaMinutes, trackingUrl, businessPhone })`
  - **Tracking URL:** Must resolve to the authenticated customer tracking view:
    `${APP_URL}/account/bookings/${booking.id}`
    *(CRITICAL: Never send the driver console `/technician/tracking/[bookingId]?token=...` to the customer!)*
  - **Recipient:** `resolveCustomerNotificationPhone(booking.customer)`
  - **NotificationType:** `TECHNICIAN_EN_ROUTE`
  - **Identity Key:** `buildTechnicianEnRouteKey(booking.id)`
  - **Duplicate Protection:** Enforce exactly-once delivery per booking to avoid duplicate SMS if a technician rejoins or restarts the GPS stream.

---

### 5. TECHNICIAN_ARRIVED Flow

- **Authoritative Mutation Path:**
  - `app/actions/bookings/technician.ts` -> `markTechnicianArrivedAction(bookingId, token)`
- **Current Behavior:**
  - Dual-auth model (HMAC token or admin session).
  - State machine transition: `confirmed` -> `in_progress`.
  - Updates `arrivedAt: new Date()` and `status: "in_progress"`.
  - Revalidates paths.
  - **Zero notifications are dispatched.**
- **Phase 3C Requirements:**
  - After database commit, dispatch customer SMS:
    ```typescript
    await sendCustomerTechnicianArrivedAlert(booking);
    ```
  - **Template:** `buildTechnicianArrivedSms({ customerFirstName, technicianFirstName, service, businessPhone })`
  - **Recipient:** `resolveCustomerNotificationPhone(booking.customer)`
  - **NotificationType:** `TECHNICIAN_ARRIVED`
  - **Identity Key:** `buildTechnicianArrivedKey(booking.id)`
  - **Technician Privacy:** Passes `extractFirstName(booking.technician?.name)`.

---

### 6. SERVICE_COMPLETED Flow

- **Authoritative Mutation Path:**
  - `app/actions/bookings/quote.ts` -> `completeAndQuoteAction(params)`
- **Current Behavior:**
  - Validates `completeQuoteSchema`, updates `status: "completed"`, `paymentStatus: "quote_sent"`, `totalAmount`.
  - Generates PDF invoice/receipt.
  - Calls `sendQuoteReadyNotification()` in `lib/notifications.ts`.
  - `sendQuoteReadyNotification` sends an uncentralized inline SMS with `type: "quote_ready"`.
- **Phase 3C Requirements:**
  - Harmonize `sendQuoteReadyNotification()` to use Phase 3A infrastructure:
    - **Template:** `buildServiceCompletedSms({ customerFirstName, service, totalAmount, accountUrl, businessPhone })`
    - **Recipient:** `resolveCustomerNotificationPhone(customerPhone || booking.customer)`
    - **NotificationType:** Canonical `SERVICE_COMPLETED` (or backward-compatible `quote_ready` / `service_completed`)
    - **Identity Key:** `buildServiceCompletedKey(bookingId)`
    - **Duplicate Protection:** Application-level check prevents duplicate invoice SMS if quote is regenerated.

---

### 7. BOOKING_CANCELLED Flow

- **Authoritative Mutation Paths:**
  - Customer Action: `app/actions/bookings/customer.ts` -> `cancelCustomerBookingAction(bookingId)`
  - Admin Action: `app/actions/bookings/admin.ts` -> `cancelBookingAction(bookingId, reason)`
- **Current Behavior:**
  - Both actions update status to `cancelled` and dispatch `sendAdminBookingCancelledAlert` (Phase 3B).
  - **Zero cancellation SMS is dispatched to the customer.**
- **Phase 3C Requirements:**
  - In both customer and admin cancellation flows, dispatch customer cancellation confirmation SMS:
    ```typescript
    await sendCustomerBookingCancelledAlert(booking);
    ```
  - **Template:** `buildBookingCancelledCustomerSms({ customerFirstName, service, shortBookingId, businessPhone })`
  - **Recipient:** `resolveCustomerNotificationPhone(booking.customer)`
  - **NotificationType:** `BOOKING_CANCELLED`
  - **Identity Key:** `buildBookingCancelledKey(booking.id, "customer_notice")`

---

### 8. Customer Recipient Resolution

The Phase 3A recipient resolution helper is already implemented in `lib/notifications/recipients.ts`:
```typescript
export function resolveCustomerNotificationPhone(
  source?: CustomerPhoneSource,
  normalizer: (phone: string) => string = normalizePhoneToE164
): string | null
```
- Accepts direct string, `{ phone }`, `{ customer: { phone } }`, or `{ user: { phone } }`.
- Sanitizes and filters out `"N/A"`, `"undefined"`, `"null"`.
- Normalizes to E.164.
- Safe contract: Returns `null` on missing/unparseable numbers; **never throws**.
- If `null` is returned, dispatch is skipped with a warning, and business mutation succeeds.

---

### 9. Templates

All 6 required Customer SMS templates are already implemented in `lib/sms/templates.ts`:
1. `buildBookingConfirmedSms(data: BookingConfirmedTemplateData): string`
2. `buildTechnicianAssignedSms(data: TechnicianAssignedTemplateData): string`
3. `buildTechnicianEnRouteSms(data: TechnicianEnRouteTemplateData): string`
4. `buildTechnicianArrivedSms(data: TechnicianArrivedTemplateData): string`
5. `buildServiceCompletedSms(data: ServiceCompletedTemplateData): string`
6. `buildBookingCancelledCustomerSms(data: BookingCancelledCustomerTemplateData): string`

**Template Features Verified:**
- Inline length truncation (`sanitizeInline`, `extractFirstName`).
- No `undefined` or `null` substrings.
- Support inquiries strictly directed to `businessPhone` (`BUSINESS_PHONE_RAW` / `BUSINESS_PHONE_DISPLAY`).

---

### 10. NotificationLog / Duplicate Handling

- Deterministic event keys exist in `lib/notifications/identity.ts`:
  - `buildBookingConfirmedKey(booking.id)`
  - `buildTechnicianAssignedKey(booking.id, technician.id)`
  - `buildTechnicianEnRouteKey(booking.id)`
  - `buildTechnicianArrivedKey(booking.id)`
  - `buildServiceCompletedKey(booking.id)`
  - `buildBookingCancelledKey(booking.id, "customer_notice")`
- **Application-Level Duplicate Verification:**
  - Queries `NotificationLog` via `hasExistingNotification({ entityId, type, channel: "sms" })` for records with `status IN ["SENT", "PENDING"]`.
  - **Concurrency Limitation:** Not guaranteed safe against sub-millisecond simultaneous requests due to prohibition of database schema changes.

---

### 11. Delivery Webhook Compatibility

- Customer SMS dispatches will log entries in `NotificationLog` with:
  - `channel: "sms"`
  - `status: "SENT"`
  - `deliveryStatus: null` or `"PENDING"`
  - `messageId` populated from provider
- The existing webhook route `app/api/webhooks/sms-gateway/route.ts` handles delivery reports (`sms:delivered`, `sms:failed`) by correlating `messageId` and updating `deliveryStatus` while keeping `status = "SENT"`.
- 100% compatible without modifying webhook code.

---

### 12. Retry Compatibility

- When gateway dispatch fails during customer SMS sending:
  - `NotificationLog.status` is set to `"FAILED"`.
- The existing retry worker (`app/api/notifications/retry/route.ts`) queries rows where:
  - `channel = "sms"`
  - `status = "FAILED"`
  - `retryCount < 3`
- Carrier delivery failures (`deliveryStatus = "FAILED"`, `status = "SENT"`) are correctly excluded from retry loops.
- 100% compatible without modifying retry worker code.

---

### 13. Failure Isolation

- **Architectural Rule:** Primary business state transitions (booking confirmation, technician assignment, trip departure, arrival, quote completion, cancellation) must complete and commit to the database BEFORE notification dispatch.
- **Serverless Safe Non-Blocking Pattern:**
  ```typescript
  try {
    await sendCustomerNotificationHelper(...);
  } catch (err) {
    logger.warn("customer_sms.dispatch_failed", { error: err });
  }
  ```
- Gateway timeouts, offline gateway phones, or bad carrier numbers will log an error in `NotificationLog` as `status: "FAILED"`, but will **never** cause the business action or API call to fail or rollback.

---

### 14. Technician Privacy & Security

- **Strict Privacy Rule:** Customer SMS messages must **NEVER** include the technician's personal phone number.
- Verified in `lib/sms/templates.ts`:
  - `TechnicianAssignedTemplateData` accepts `technicianFirstName`, NOT `technicianPhone`.
  - `TechnicianEnRouteTemplateData` accepts `technicianFirstName`, NOT `technicianPhone`.
  - `TechnicianArrivedTemplateData` accepts `technicianFirstName`, NOT `technicianPhone`.
- **Live Tracking Security:**
  - Customer tracking links must point to `${APP_URL}/account/bookings/${booking.id}`.
  - Never link to `${APP_URL}/technician/tracking/...` (which exposes dispatch HMAC tokens).

---

### 15. Exact Implementation Files for Phase 3C

When Phase 3C begins, changes will be restricted to:
1. `lib/notifications.ts`
   - Implement customer notification helper functions:
     - `sendCustomerBookingConfirmedAlert(booking)`
     - `sendCustomerTechnicianAssignedAlert({ booking, technician })`
     - `sendCustomerTechnicianEnRouteAlert({ booking, etaMinutes })`
     - `sendCustomerTechnicianArrivedAlert(booking)`
     - `sendCustomerBookingCancelledAlert(booking)`
   - Harmonize `sendQuoteReadyNotification()` with `buildServiceCompletedSms`.
2. `app/actions/bookings/admin.ts`
   - Wire `sendCustomerBookingConfirmedAlert` into `confirmBookingAction`.
   - Wire `sendCustomerTechnicianAssignedAlert` into `assignTechnicianAction`.
   - Wire `sendCustomerBookingCancelledAlert` into `cancelBookingAction`.
3. `app/actions/bookings/technician.ts`
   - Implement `startTechnicianTripAction(bookingId, token)` and wire `sendCustomerTechnicianEnRouteAlert`.
   - Wire `sendCustomerTechnicianArrivedAlert` into `markTechnicianArrivedAction`.
4. `app/actions/bookings/customer.ts`
   - Wire `sendCustomerBookingCancelledAlert` into `cancelCustomerBookingAction`.
5. `tests/integration/customer-sms-notifications.test.mjs` (New test file for Phase 3C)
6. `tests/run-all.mjs` (Register Phase 3C test suite)

---

### 16. Files That Must Remain Untouched

- `prisma/schema.prisma`
- `prisma/migrations/*`
- `lib/sms/providers/android-gateway.ts`
- `lib/sms/index.ts`
- `lib/sms/templates.ts`
- `lib/sms/webhook-verification.ts`
- `app/api/webhooks/sms-gateway/route.ts`
- `app/api/notifications/retry/route.ts`
- Authentication & Authorization modules (`lib/admin-auth.ts`, `lib/technician-auth.ts`)
- Booking State Machine definitions (`lib/bookings/state-machine.ts`)

---

### 17. Risks & Gaps

1. **Missing Route Departure Action:**
   - There is currently no `startTechnicianTripAction` in `app/actions/bookings/technician.ts`. It must be added cleanly without breaking the booking state machine (status remains `confirmed` until arrival).
2. **Missing Customer Phone Numbers:**
   - Incomplete customer profile data or test data may have `null` or invalid phone numbers. `resolveCustomerNotificationPhone()` safely handles this, but operations must be aware that SMS will be skipped.
3. **Double Invocations on Route Departure:**
   - Technicians moving in and out of cellular coverage could trigger multiple trip departures. Enforcing `buildTechnicianEnRouteKey(booking.id)` in `NotificationLog` duplicate checking is essential.

---

### 18. Recommended Phase 3C Implementation Plan

1. **Step 1: Customer Dispatch Helpers in `lib/notifications.ts`**
   - Add type-safe customer notification dispatchers using Phase 3A templates, `resolveCustomerNotificationPhone`, and deterministic keys.
   - Refactor `sendQuoteReadyNotification` to use `buildServiceCompletedSms`.
2. **Step 2: Admin Confirmation & Assignment Hooks**
   - Attach customer alerts to `confirmBookingAction` and `assignTechnicianAction` in `app/actions/bookings/admin.ts`.
3. **Step 3: Technician En-Route & Arrival Hooks**
   - Implement `startTechnicianTripAction` and attach `markTechnicianArrivedAction` alert in `app/actions/bookings/technician.ts`.
4. **Step 4: Cancellation Hooks**
   - Wire customer cancellation confirmation into `cancelCustomerBookingAction` and `cancelBookingAction`.
5. **Step 5: Testing & Verification**
   - Create `tests/integration/customer-sms-notifications.test.mjs`.
   - Run master regression suite, TypeScript compiler, and production build.

---

### 19. Audit Conclusion

The Phase 3C Customer SMS Notifications architecture is fully vetted. All required foundational elements—including pure SMS templates, customer recipient resolvers, deterministic identity builders, and non-blocking failure isolation patterns—were successfully established in Phase 3A and validated in Phase 3B. The implementation boundaries, trigger paths, and privacy constraints are clearly defined.

---

### 20. STOP — DO NOT IMPLEMENT

============================================================
PHASE 3C READ-ONLY AUDIT STATUS: COMPLETE

CUSTOMER SMS EVENTS AUDITED:
- BOOKING_CONFIRMED
- TECHNICIAN_ASSIGNED
- TECHNICIAN_EN_ROUTE
- TECHNICIAN_ARRIVED
- SERVICE_COMPLETED
- BOOKING_CANCELLED

INFRASTRUCTURE READY: YES
TEMPLATES READY: YES
RECIPIENT RESOLUTION READY: YES
IDENTITY KEYS READY: YES

PRODUCTION CODE MODIFIED: NONE
DATABASE SCHEMA MODIFIED: NONE
MIGRATIONS CREATED: NONE

READY FOR PHASE 3C IMPLEMENTATION PLANNING: YES

STOP HERE. DO NOT IMPLEMENT.
============================================================
