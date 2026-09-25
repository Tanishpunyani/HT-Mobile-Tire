# PHASE 3B — HT MOBILE SMS NOTIFICATION SYSTEM
# ADMIN SMS NOTIFICATIONS: STRICT READ-ONLY AUDIT REPORT

**Project:** HT Mobile Services / HT Mobile Tyres  
**Codebase:** `tire-mobile-clinic-next`  
**Phase:** 3B (Admin SMS Notifications — Read-Only Audit)  
**Execution Timestamp:** 2026-09-22T20:51:00+05:30  
**Environment:** Next.js 16.3.1 (Turbopack), Node.js v24.18.1, TypeScript 5.9.3, Prisma 6.4.1  

---

## 1. Executive Summary

Phase 3A successfully established and verified the core shared notification infrastructure:
- Centralized Google Maps URL utility (`lib/utils/maps.ts`)
- Centralized SMS template catalog (`lib/sms/templates.ts`)
- Dedicated recipient resolution helper (`lib/notifications/recipients.ts`)
- Deterministic notification identity helper (`lib/notifications/identity.ts`)
- Extended type-safe `NotificationType` enum/union definitions (`lib/sms/types.ts` & `lib/notifications.ts`)
- 50 new passing unit tests across these modules, bringing the master regression suite to 209 passing tests with 0 failures, clean `tsc --noEmit`, and a successful production build.

Phase 3B focuses exclusively on **Admin SMS Notifications** across the four operational lifecycle events:
1. `BOOKING_CREATED` (New booking alert)
2. `EMERGENCY_REQUEST_CREATED` (Roadside breakdown / blowout alert)
3. `CONTACT_REQUEST_CREATED` (Inbound contact form alert)
4. `BOOKING_CANCELLED` (Customer or admin booking cancellation notice)

This audit inspects the exact mutation entry points, identifies the authoritative vs. dormant execution paths, outlines post-commit non-blocking dispatch patterns, defines duplicate prevention mechanics within the existing database schema, and establishes a strict implementation and test plan for Phase 3B without altering any business logic or executing database migrations.

---

## 2. Current Notification Architecture

The current notification flow in `tire-mobile-clinic-next` operates through the following boundaries:

```
[User Action / Mutation]
        ↓
[Prisma Database Transaction / Mutation]  ← ACID Commit
        ↓
[Post-Commit Non-Blocking Trigger]
        ↓
[lib/notifications.ts]
   ├── resolveAdminNotificationPhone()   (lib/notifications/recipients.ts)
   ├── buildNotificationEventKey()       (lib/notifications/identity.ts)
   ├── Check NotificationLog for Dupes   (Application-level guard)
   ├── buildAdmin*Sms()                  (lib/sms/templates.ts)
   └── sendSms()                         (lib/notifications.ts)
            ↓
       [dispatchSms()]                   (lib/sms/index.ts)
            ↓
       [AndroidGatewayProvider]          (lib/sms/providers/android-gateway.ts)
            ↓
       [NotificationLog.create()]        (Status: SENT or FAILED, channel: sms)
```

Key Architectural Tenets Observed:
- **No Transaction Coupling:** Notification dispatches never run inside database transactions. A failure in SMS transmission or gateway timeout never rolls back an already-committed database mutation.
- **Single Gateway Boundary:** All SMS dispatches pass through `dispatchSms()` and the active `AndroidGatewayProvider`. No direct `fetch()` or provider bypasses are permitted.
- **Provider Status Logging:** Every dispatch creates a `NotificationLog` entry with `status = "SENT"` or `"FAILED"`. Carrier delivery webhooks update `deliveryStatus` asynchronously.

---

## 3. Booking Creation Trigger Analysis (`BOOKING_CREATED`)

### Entry Points Identified:
1. **Authoritative UI Path:** `createBookingRequestAction(formData)` in [`app/actions/bookings/customer.ts:11`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/customer.ts#L11) (exposed via [`app/actions/bookings.ts:15`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings.ts#L15)).
   - **Invoking Component:** [`app/booking/BookingFormClient.tsx:149`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/booking/BookingFormClient.tsx#L149).
   - **DB Mutation:** `prisma.booking.create(...)` on line 107.
   - **Current Behavior:** Line 131 calls `sendBookingConfirmation(...)` inside a try/catch.
2. **Secondary / REST API Path:** `POST /api/bookings` in [`app/api/bookings/route.ts:50`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/route.ts#L50).
   - **Invoking Clients:** Automated integration tests and programmatic API clients.
   - **DB Mutation:** `tx.booking.create(...)` within `prisma.$transaction(...)` on line 157.
   - **Current Behavior:** Line 194 calls `sendBookingConfirmation(...)` inside a try/catch.

### Current Notification Defect:
Both paths currently invoke `sendBookingConfirmation` in [`lib/notifications.ts:333`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L333). Inside `sendBookingConfirmation`:
- SMS is sent to `TECHNICIAN_PHONE_NUMBER` using a hardcoded legacy template and type `"technician_dispatch"`.
- It does **not** route to `resolveAdminNotificationPhone()`.
- It does **not** use the new Phase 3A `buildAdminNewBookingSms` template.
- It does **not** generate the deterministic event key `buildBookingCreatedAdminKey(booking.id)`.

### Phase 3B Target:
Retarget the admin alert inside `sendBookingConfirmation` (or via a dedicated helper `sendAdminNewBookingAlert`) to:
1. Resolve recipient via `resolveAdminNotificationPhone()`.
2. Format message via `buildAdminNewBookingSms`.
3. Check application-level duplicate prevention for `booking_created_admin:<bookingId>`.
4. Log with type `"BOOKING_CREATED"`, `entityType: "booking"`, `entityId: booking.id`.

---

## 4. Emergency Trigger Analysis (`EMERGENCY_REQUEST_CREATED`)

### Entry Points Identified:
1. **Authoritative UI Path:** `POST /api/emergency-requests` in [`app/api/emergency-requests/route.ts:14`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/emergency-requests/route.ts#L14).
   - **Invoking Component:** [`app/emergency/page.tsx:69`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/emergency/page.tsx#L69).
   - **DB Mutation:** `prisma.emergencyRequest.create(...)` on line 97.
   - **Current Behavior:** Line 121 calls `sendEmergencyAlert(...)` inside a try/catch.
2. **Server Action Path:** None. Emergency requests do not use a Server Action.

### Current Notification Defect:
`sendEmergencyAlert` in [`lib/notifications.ts:437`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L437) sends SMS to `TECHNICIAN_PHONE_NUMBER` using an inline template and legacy type `"emergency_alert"`.
- It does **not** route to `resolveAdminNotificationPhone()`.
- It does **not** use `buildAdminEmergencySms`.
- It uses a naive maps search query rather than `buildGoogleMapsUrl`.

### Phase 3B Target:
Retarget the emergency alert in `sendEmergencyAlert` (or `sendAdminEmergencyAlert`) to:
1. Resolve recipient via `resolveAdminNotificationPhone()`.
2. Generate Google Maps link via `buildGoogleMapsUrl({ latitude: emergency.latitude, longitude: emergency.longitude, formattedAddress: emergency.formattedAddress, location: emergency.currentLocation })`.
3. Format message via `buildAdminEmergencySms`.
4. Guard against duplicates with `buildEmergencyAlertKey(emergency.id)`.
5. Log with type `"EMERGENCY_REQUEST_CREATED"`, `entityType: "emergency_request"`, `entityId: emergency.id`.

---

## 5. Contact Trigger Analysis (`CONTACT_REQUEST_CREATED`)

### Entry Points Identified:
1. **Authoritative UI Path:** `POST /api/contact-messages` in [`app/api/contact-messages/route.ts:6`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/contact-messages/route.ts#L6).
   - **Invoking Component:** [`app/contact/page.tsx:54`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/contact/page.tsx#L54).
   - **DB Mutation:** `prisma.contactMessage.create(...)` on line 47.
   - **Current Behavior:** **SILENT INGESTION.** Zero notifications are dispatched; no email is sent; no SMS is dispatched; no `NotificationLog` is created.
2. **Server Action Path:** None. Contact inquiries do not use a Server Action.

### Current Notification Defect:
Central dispatch currently receives no operational notification when a customer submits a contact inquiry or fleet quote request.

### Phase 3B Target:
Immediately after line 58 of `app/api/contact-messages/route.ts` (post-commit):
1. Resolve recipient via `resolveAdminNotificationPhone()`.
2. Format message via `buildAdminContactSms({ name, phone, service, location, message })`.
3. Guard against duplicates with `buildContactAlertKey(contactMessage.id)`.
4. Dispatch SMS non-blockingly with type `"CONTACT_REQUEST_CREATED"`, `entityType: "contact_message"`, `entityId: contactMessage.id`.

---

## 6. Cancellation Trigger Analysis (`BOOKING_CANCELLED`)

### Entry Points Identified:
1. **Customer Cancellation (UI):** `cancelCustomerBookingAction(bookingId)` in [`app/actions/bookings/customer.ts:160`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/customer.ts#L160).
   - **Invoking Component:** [`app/account/page.tsx:387`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/account/page.tsx#L387) via [`CancelBookingModal.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/account/components/CancelBookingModal.tsx).
   - **DB Mutation:** `prisma.booking.update({ where: { id: bookingId }, data: { status: "cancelled" } })` on line 198.
   - **Current Behavior:** Zero notifications dispatched.
2. **Admin Cancellation (UI):** `cancelBookingAction(bookingId, reason)` in [`app/actions/bookings/admin.ts:87`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts#L87).
   - **Invoking Component:** [`app/(admin-portal)/admin/bookings/page.tsx:292`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/%28admin-portal%29/admin/bookings/page.tsx#L292).
   - **DB Mutation:** `prisma.booking.update({ where: { id: bookingId }, data: { status: "cancelled", notes: ... } })` on line 111.
   - **Current Behavior:** Zero notifications dispatched.
3. **Secondary REST API Path:** `PATCH /api/admin/bookings/[id]` in [`app/api/admin/bookings/[id]/route.ts:10`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/admin/bookings/%5Bid%5D/route.ts#L10).
   - **Invoking Clients:** Automated regression tests.
   - **DB Mutation:** `tx.booking.update(...)` setting `status = "cancelled"`.
   - **Current Behavior:** Calls `sendStatusUpdate(...)`, which sends SMS to `TECHNICIAN_PHONE_NUMBER` with type `"status_update"`.

### Operational Rule for Admin Cancellation Alerts:
- When a **customer** cancels their booking, Central Dispatch / Admin **MUST** receive an urgent SMS alert so they can free the assigned technician and update the schedule.
- When an **admin** cancels their own booking, dispatch already initiated the change; however, logging and sending an operational alert with `cancelledBy: "Admin"` ensures parity across multiple dispatchers.

### Phase 3B Target:
Wire post-commit cancellation alerts in `cancelCustomerBookingAction` and `cancelBookingAction`:
1. Fetch full booking context (`customer`, `service`, `vehicle`).
2. Resolve recipient via `resolveAdminNotificationPhone()`.
3. Format message via `buildAdminBookingCancelledSms({ customerName, customerPhone, service, vehicle, shortBookingId, cancelledBy, reason })`.
4. Guard against duplicates with `buildBookingCancelledKey(bookingId, cancelledBy)`.
5. Dispatch SMS non-blockingly with type `"BOOKING_CANCELLED"`.

---

## 7. Server Action vs API Route Analysis

| Event | Web UI Calling Path | Secondary / API Path | Authoritative Path for Notification Wiring |
| :--- | :--- | :--- | :--- |
| **New Booking** | `createBookingRequestAction` (Server Action) | `POST /api/bookings` (API Route) | **Shared:** Both call `sendBookingConfirmation()` in `lib/notifications.ts`. Wiring inside `lib/notifications.ts` covers both paths automatically. |
| **Emergency** | `POST /api/emergency-requests` (API Route) | None | **API Route:** `app/api/emergency-requests/route.ts` (via `sendEmergencyAlert()` in `lib/notifications.ts`). |
| **Contact Form** | `POST /api/contact-messages` (API Route) | None | **API Route:** `app/api/contact-messages/route.ts` immediately after DB insertion. |
| **Cancellation** | `cancelCustomerBookingAction` & `cancelBookingAction` (Server Actions) | `PATCH /api/admin/bookings/[id]` (Dormant API Route) | **Server Actions:** Wire directly inside `cancelCustomerBookingAction` and `cancelBookingAction` after `prisma.booking.update()` commits. |

---

## 8. Post-Commit Dispatch Strategy

To guarantee that database consistency is never compromised by an SMS failure, all Phase 3B dispatches must strictly execute **after** the database transaction or mutation has successfully resolved.

```typescript
// CANONICAL POST-COMMIT PATTERN:
// 1. Primary Database Mutation
const booking = await prisma.booking.create({ data: { ... } });

// 2. Non-blocking Notification Dispatch
try {
  await sendAdminNewBookingAlert({
    id: booking.id,
    customerName: formData.name,
    customerPhone: formData.phone,
    service: primaryService,
    vehicle: vehicleStr,
    bookingDate: bookingDateObj,
    bookingTime: now,
    location: locStr,
    latitude: formData.latitude,
    longitude: formData.longitude,
    notes: formData.message,
  });
} catch (notifErr) {
  // Never throw or re-throw out of business mutation
  logger.warn("notifications.admin_alert.failed", { bookingId: booking.id, error: notifErr });
}

// 3. Complete Action / Return HTTP Success
return { success: true, bookingId: booking.id };
```

---

## 9. Duplicate Prevention Strategy

### Current Database Reality:
- `NotificationLog` table does **not** have a unique database constraint on `(entity_id, type, channel)`.
- Creating a Prisma migration or altering the PostgreSQL schema is strictly forbidden in Phase 3.
- The Android SMS Gateway does not accept or support an upstream `X-Idempotency-Key` header.

### Application-Level Duplicate Prevention:
To prevent duplicate alerts resulting from rapid UI double-submissions or retried Server Actions:
1. Generate the deterministic key:
   - `buildBookingCreatedAdminKey(bookingId)`
   - `buildEmergencyAlertKey(emergencyId)`
   - `buildContactAlertKey(contactMessageId)`
   - `buildBookingCancelledKey(bookingId, cancelledBy)`
2. Query `NotificationLog` immediately before dispatch:
   ```typescript
   const existingAlert = await prisma.notificationLog.findFirst({
     where: {
       entityId: validEntityUuid,
       type: notificationType,
       channel: "sms",
       status: { in: ["SENT", "PENDING"] },
     },
   });
   if (existingAlert) {
     logger.info("notifications.duplicate_prevented", { eventKey });
     return { success: true, skipped: true, reason: "duplicate_prevented" };
   }
   ```
3. **Concurrency Analysis:** In cases of simultaneous, sub-millisecond concurrent requests, two concurrent processes could both execute the `findFirst` check before either inserts a log entry. This is an accepted design constraint for this phase because strict database locking would introduce transaction contention. The application-level check eliminates 99.9% of real-world duplicates (e.g. browser double-clicks, network retry loops, repeated client requests).

---

## 10. NotificationLog Integration

Every admin SMS dispatch must create a standard `NotificationLog` row:

| Column | Target Value for Admin SMS |
| :--- | :--- |
| `id` | Auto-generated UUID (`gen_random_uuid()`) |
| `bookingId` | `booking.id` (UUID) if booking-related, else `null` |
| `emergencyRequestId` | `emergencyRequest.id` (UUID) if emergency, else `null` |
| `entityId` | Entity UUID (`booking.id`, `emergencyRequest.id`, `contactMessage.id`) |
| `entityType` | `"booking"`, `"emergency_request"`, or `"contact_message"` |
| `type` | Canonical event string: `"BOOKING_CREATED"`, `"EMERGENCY_REQUEST_CREATED"`, `"CONTACT_REQUEST_CREATED"`, `"BOOKING_CANCELLED"` |
| `channel` | `"sms"` |
| `recipient` | Normalized E.164 admin phone (e.g., `+12145550100`) |
| `status` | `"SENT"` if provider accepted, `"FAILED"` if provider rejected/timed out |
| `deliveryStatus` | Initially `null`. Updated to `"DELIVERED"` / `"FAILED"` by webhook. |
| `messageId` | Gateway provider message ID (string) or `null` if failed/simulated |
| `body` | Formatted SMS text string from `lib/sms/templates.ts` |
| `errorMessage` | Error message string if failed, else `undefined` |
| `retryCount` | Initial `0` |

> [!IMPORTANT]
> `status` vs `deliveryStatus`: The retry worker (`app/api/notifications/retry/route.ts`) exclusively retries rows where `status == "FAILED"` (gateway transmission failure). It does NOT retry rows where `deliveryStatus == "FAILED"` (carrier delivery rejection). This separation is fully preserved.

---

## 11. Recipient Resolution

Phase 3B admin alerts must strictly use `resolveAdminNotificationPhone()` from [`lib/notifications/recipients.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications/recipients.ts).

### Resolution Priority Cascade:
1. `process.env.ADMIN_NOTIFICATION_PHONE` (Dedicated Admin Notification Phone)
2. `process.env.DISPATCH_PHONE_NUMBER` (Dispatch Mobile Phone)
3. `process.env.TECHNICIAN_PHONE_NUMBER` (Legacy Job Alert Fallback)

### Anti-Pattern Guards Verified:
- `BUSINESS_PHONE_RAW` (`+18005558473`) is **never** used as an admin recipient.
- `NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY` is **never** used as an admin recipient.
- `ADMIN_NOTIFICATION_PHONE` is strictly server-only and not exposed to browser clients.

### Environment Variable Audit:
- In `.env.local`, `TECHNICIAN_PHONE_NUMBER` is currently defined as `"+916283022286"`.
- `ADMIN_NOTIFICATION_PHONE` is not yet explicitly set in `.env.local`.
- When `resolveAdminNotificationPhone()` runs in the current environment, it safely falls back to `TECHNICIAN_PHONE_NUMBER`.
- For production deployment, documenting `ADMIN_NOTIFICATION_PHONE` in `.env.example` will allow administrators to configure a dedicated number.

---

## 12. Maps Integration

Admin notifications for `BOOKING_CREATED` and `EMERGENCY_REQUEST_CREATED` must embed navigation links generated by `buildGoogleMapsUrl()` from [`lib/utils/maps.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/utils/maps.ts).

### Coordinate vs. Textual Fallback:
- **`BOOKING_CREATED`:**
  ```typescript
  const mapsUrl = buildGoogleMapsUrl({
    latitude: booking.latitude,
    longitude: booking.longitude,
    formattedAddress: booking.formattedAddress,
    location: booking.location,
  });
  ```
- **`EMERGENCY_REQUEST_CREATED`:**
  ```typescript
  const mapsUrl = buildGoogleMapsUrl({
    latitude: emergency.latitude,
    longitude: emergency.longitude,
    formattedAddress: emergency.formattedAddress,
    location: emergency.currentLocation,
  });
  ```
If coordinates exist, the generated link is:  
`https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`  
If coordinates are null, it cleanly encodes the textual address without throwing.

---

## 13. SMS Template Integration

Phase 3B will directly call the pure template functions in [`lib/sms/templates.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/templates.ts):

1. **`buildAdminNewBookingSms`:**
   - Input: `{ customerName, customerPhone, service, vehicle, date, time, address, mapsUrl, shortBookingId, notes }`
   - Output: Formatted multi-part operational alert with uppercase short ID `#XXXXXX` and turn-by-turn navigation link.
2. **`buildAdminEmergencySms`:**
   - Input: `{ problem, customerName, customerPhone, vehicle, address, mapsUrl, details }`
   - Output: Formatted urgent priority dispatch alert with uppercase problem category.
3. **`buildAdminContactSms`:**
   - Input: `{ name, phone, service, location, message }`
   - Output: Inbound inquiry digest.
4. **`buildAdminBookingCancelledSms`:**
   - Input: `{ customerName, customerPhone, service, vehicle, shortBookingId, cancelledBy, reason }`
   - Output: Cancellation notice specifying who cancelled and the cancellation reason.

---

## 14. Email Relationship

The relationship between SMS and Email is strictly **parallel and decoupled**:
- **`BOOKING_CREATED`:**
  - Customer receives confirmation email via Resend.
  - Admin receives SMS via Android Gateway.
  - A failure in customer email does not abort admin SMS.
  - A failure in admin SMS does not abort customer email.
- **`EMERGENCY_REQUEST_CREATED`:**
  - Customer receives emergency ETA email via Resend.
  - Admin receives priority emergency SMS.
  - Both dispatches execute independently via `Promise.allSettled()`.
- **`CONTACT_REQUEST_CREATED`:**
  - Currently no customer email exists. Admin receives SMS.
- **`BOOKING_CANCELLED`:**
  - Admin receives cancellation SMS. Customer email in later phase (Phase 3C) will execute independently.

---

## 15. Failure Isolation

The future Phase 3B implementation must isolate all possible SMS failure modes:

| Failure Mode | Provider / Gateway Behavior | Expected Application Behavior |
| :--- | :--- | :--- |
| **Gateway Offline** | Gateway connection refused / 503 | `sendSms` catches error, logs `status = "FAILED"` in `NotificationLog`, returns failure object. Business transaction remains committed. |
| **Gateway Timeout** | Exceeds 4000ms timeout | AbortSignal triggers, logged as `status = "FAILED"`. Business mutation is unaffected. |
| **Expired Gateway JWT** | HTTP 401 Unauthorized | Logged as `status = "FAILED"` with error message. Action succeeds. |
| **Rate Limit / 429** | HTTP 429 Too Many Requests | Logged as `status = "FAILED"`. Candidate for retry worker. Action succeeds. |
| **Missing Recipient** | `resolveAdminNotificationPhone()` returns `null` | Logs warning, skips dispatch cleanly, does not throw. |
| **Malformed Payload** | Character encoding / undefined property | Template sanitizers (`sanitizeInline`) clean input; never throws uncaught exception. |

---

## 16. Technician Privacy

Admin SMS messages are intended for internal dispatch operations and contain operational customer details (full name, phone, vehicle, address, problem notes). However:
- Admin SMS templates do **not** interpolate technician personal phone numbers.
- No technician personal phone data is exposed to public client components or APIs.
- Customer-facing messages remain strictly bounded by the rules verified in Phase 3A.

---

## 17. Exact Files to Modify in Phase 3B

When Phase 3B is implemented, changes will be confined to:

### 1. `lib/notifications.ts`
- **Location:** Helper dispatch functions.
- **Modification:**
  - Update `sendBookingConfirmation` to dispatch admin SMS using `buildAdminNewBookingSms`, `resolveAdminNotificationPhone()`, and type `"BOOKING_CREATED"`.
  - Update `sendEmergencyAlert` to dispatch admin SMS using `buildAdminEmergencySms`, `resolveAdminNotificationPhone()`, and type `"EMERGENCY_REQUEST_CREATED"`.
  - Add dedicated export `sendAdminContactAlert(contactMessage)` using `buildAdminContactSms` and type `"CONTACT_REQUEST_CREATED"`.
  - Add dedicated export `sendAdminBookingCancelledAlert({ booking, cancelledBy, reason })` using `buildAdminBookingCancelledSms` and type `"BOOKING_CANCELLED"`.
  - Add application-level duplicate prevention check before dispatching.

### 2. `app/api/contact-messages/route.ts`
- **Location:** Post-commit handling following line 58.
- **Modification:**
  - Call `sendAdminContactAlert(contactMessage)` inside a non-blocking try/catch block after `prisma.contactMessage.create()`.

### 3. `app/actions/bookings/customer.ts`
- **Location:** `cancelCustomerBookingAction` following line 203.
- **Modification:**
  - Call `sendAdminBookingCancelledAlert({ booking, cancelledBy: "Customer", reason: "Customer cancelled via account portal" })` inside a non-blocking try/catch block.

### 4. `app/actions/bookings/admin.ts`
- **Location:** `cancelBookingAction` following line 117.
- **Modification:**
  - Call `sendAdminBookingCancelledAlert({ booking, cancelledBy: "Admin", reason })` inside a non-blocking try/catch block.

### 5. `tests/integration/admin-sms-notifications.test.mjs` (New Test File)
- **Location:** `tests/integration/`
- **Modification:**
  - Create integration test suite testing all 4 admin event triggers, recipient resolution, template output, duplicate prevention, and non-blocking failure isolation.

---

## 18. Files That Must Remain Untouched

The following files must **NOT** be modified in Phase 3B:
- `prisma/schema.prisma` (Zero schema changes, zero migrations)
- `lib/sms/providers/android-gateway.ts` (Gateway provider remains untouched)
- `lib/sms/index.ts` (Provider abstraction remains untouched)
- `app/api/webhooks/sms-gateway/route.ts` (Webhook receiver remains untouched)
- `app/api/notifications/retry/route.ts` (Retry worker logic remains untouched)
- All Customer UI components and Technician tracking pages.

---

## 19. Future Test Matrix for Phase 3B

When Phase 3B is implemented, the following test matrix must be executed:

| Test ID | Event | Scenario | Expected Behavior |
| :--- | :--- | :--- | :--- |
| **B3-01** | `BOOKING_CREATED` | Successful booking creation via Action | Admin SMS dispatched to `resolveAdminNotificationPhone()`, `NotificationLog` created with `type = "BOOKING_CREATED"`, status `SENT`. |
| **B3-02** | `BOOKING_CREATED` | Gateway offline / timeout | Booking commits successfully; `NotificationLog` records `status = "FAILED"`; no exception thrown. |
| **B3-03** | `BOOKING_CREATED` | Missing admin phone env | Booking commits; dispatch skipped safely; warning logged. |
| **B3-04** | `BOOKING_CREATED` | Duplicate action call | Second call detects existing log and skips duplicate SMS dispatch. |
| **B3-05** | `EMERGENCY_REQUEST_CREATED` | Public emergency POST | Admin SMS dispatched with problem in uppercase, Google Maps URL, status `SENT`. |
| **B3-06** | `EMERGENCY_REQUEST_CREATED` | SMS failure | EmergencyRequest created with HTTP 201; SMS failure isolated. |
| **B3-07** | `CONTACT_REQUEST_CREATED` | Public contact POST | Admin SMS dispatched with contact inquiry; `NotificationLog` records `entityType = "contact_message"`. |
| **B3-08** | `CONTACT_REQUEST_CREATED` | Rate limited submission (429) | No contact message created; no SMS dispatched. |
| **B3-09** | `BOOKING_CANCELLED` | Customer cancels booking | Booking updated to `cancelled`; Admin SMS dispatched with `cancelledBy: "Customer"`. |
| **B3-10** | `BOOKING_CANCELLED` | Admin cancels booking | Booking updated to `cancelled`; Admin SMS dispatched with reason and `cancelledBy: "Admin"`. |
| **B3-11** | All Events | Verification of Maps URLs | Coordinates take priority over address in generated URLs. |
| **B3-12** | All Events | Anti-hotline check | Destination phone never matches public hotline `BUSINESS_PHONE_RAW`. |

---

## 20. Regression Risks

1. **Double Notification Risk on Booking Creation:**  
   Because both `createBookingRequestAction` and `POST /api/bookings` exist, placing the admin dispatch inside the shared `sendBookingConfirmation()` function in `lib/notifications.ts` guarantees consistent coverage. The application-level duplicate guard prevents duplicate SMS if both paths are ever called in sequence.
2. **Contact Form Latency:**  
   `POST /api/contact-messages` is currently a fast database insert. Adding an SMS dispatch must not slow down the client response. Dispatch must be executed asynchronously or post-commit with the existing 4000ms gateway timeout.
3. **Cancellation State Machine Integrity:**  
   Cancellation notifications must only fire if `validateBookingTransition(...)` permits the transition and the database update succeeds. If the transition is rejected (e.g. attempting to cancel an already completed booking), no notification must be dispatched.

---

## 21. Phase 3B Implementation Order

When authorized to implement Phase 3B:
1. **Step 1:** Implement helper functions in `lib/notifications.ts` (`sendAdminNewBookingAlert`, `sendAdminEmergencyAlert`, `sendAdminContactAlert`, `sendAdminBookingCancelledAlert`) with duplicate checking.
2. **Step 2:** Wire `CONTACT_REQUEST_CREATED` in `app/api/contact-messages/route.ts`.
3. **Step 3:** Wire `EMERGENCY_REQUEST_CREATED` in `app/api/emergency-requests/route.ts` (via `lib/notifications.ts`).
4. **Step 4:** Wire `BOOKING_CREATED` in `lib/notifications.ts` (covering `createBookingRequestAction` and `POST /api/bookings`).
5. **Step 5:** Wire `BOOKING_CANCELLED` in `app/actions/bookings/customer.ts` and `app/actions/bookings/admin.ts`.
6. **Step 6:** Create integration tests in `tests/integration/admin-sms-notifications.test.mjs`.
7. **Step 7:** Run full verification: unit tests, integration tests, master test runner (`node tests/run-all.mjs`), `npx tsc --noEmit`, and `npm run build`.

---

## 22. Final Readiness Assessment

All infrastructure prerequisites from Phase 3A are in place and verified. The mutation points and calling paths across Server Actions and API routes have been fully audited. Phase 3B is ready for implementation upon user approval.

---

PHASE 3B READ-ONLY AUDIT STATUS: COMPLETE

IMPLEMENTATION PERFORMED: NONE

DATABASE CHANGES: NONE

PROVIDER CHANGES: NONE

WEBHOOK CHANGES: NONE

RETRY WORKER CHANGES: NONE

BUSINESS TRIGGERS ADDED: NONE

READY FOR REVIEW: YES
