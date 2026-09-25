# PHASE 3C — HT MOBILE SMS NOTIFICATION SYSTEM
## CUSTOMER SMS NOTIFICATIONS — IMPLEMENTATION REPORT

**Project:** HT Mobile Services / HT Mobile Tyres  
**Codebase:** `tire-mobile-clinic-next`  
**Phase:** 3C — Customer SMS Notifications  
**Status:** COMPLETE  
**Date:** 2026-09-22  

---

### 1. Files Changed

#### Primary Implementation Files:
1. `lib/notifications.ts`
   - Added customer notification helpers: `sendCustomerBookingConfirmedAlert()`, `sendCustomerTechnicianAssignedAlert()`, `sendCustomerTechnicianEnRouteAlert()`, `sendCustomerTechnicianArrivedAlert()`, and `sendCustomerBookingCancelledAlert()`.
   - Harmonized `sendQuoteReadyNotification()` to use `buildServiceCompletedSms()`, `resolveCustomerNotificationPhone()`, `buildServiceCompletedKey()`, and canonical event type `SERVICE_COMPLETED`.
   - Enhanced `hasExistingNotification()` with optional `recipient` filtering so that Admin and Customer cancellations on the same booking do not collide.
   - Added `primaryService` and `technician` properties to `BookingNotificationPayload`.
2. `app/actions/bookings/admin.ts`
   - In `confirmBookingAction()`: Attached non-blocking `sendCustomerBookingConfirmedAlert` post-commit.
   - In `assignTechnicianAction()`: Attached non-blocking `sendCustomerTechnicianAssignedAlert` post-commit.
   - In `cancelBookingAction()`: Attached non-blocking `sendCustomerBookingCancelledAlert` post-commit alongside existing admin cancellation alert.
3. `app/actions/bookings/technician.ts`
   - In `markTechnicianArrivedAction()`: Attached non-blocking `sendCustomerTechnicianArrivedAlert` post-commit.
   - Implemented `startTechnicianTripAction(bookingId, token?)`: Enforces dispatch token / staff auth, validates `confirmed` booking state, keeps booking in `confirmed` status, and dispatches non-blocking `sendCustomerTechnicianEnRouteAlert`.
4. `app/actions/bookings/customer.ts`
   - In `cancelCustomerBookingAction()`: Attached non-blocking `sendCustomerBookingCancelledAlert` post-commit alongside existing admin cancellation alert.

#### Testing Files:
5. `tests/integration/customer-sms-notifications.test.mjs` (Created)
   - 13 comprehensive integration tests covering all 6 customer SMS events, recipient safety, failure isolation, duplicate protection, and technician privacy.
6. `tests/run-all.mjs` (Modified)
   - Registered and executed `runCustomerSmsNotificationsIntegrationTests()`.

---

### 2. Customer Events Implemented

All six audited canonical customer SMS events have been implemented:
1. `BOOKING_CONFIRMED`: Dispatches confirmation SMS with short booking reference, appointment date/time, vehicle, and business support contact.
2. `TECHNICIAN_ASSIGNED`: Dispatches assignment alert with technician first name only, date/time, and business support contact.
3. `TECHNICIAN_EN_ROUTE`: Dispatches on-the-way alert with technician first name, optional ETA minutes, customer tracking URL, and business support contact.
4. `TECHNICIAN_ARRIVED`: Dispatches arrival alert with technician first name, service name, accessible vehicle instructions, and business support contact.
5. `SERVICE_COMPLETED`: Dispatches itemized invoice ready alert with total amount formatted to 2 decimals, link to account receipt, and business support contact.
6. `BOOKING_CANCELLED`: Dispatches cancellation notice with short booking reference and business support hotline.

---

### 3. Exact Trigger Paths

| Canonical Event | Trigger Location | Mutation Context | Invocation Point |
|:---|:---|:---|:---|
| **`BOOKING_CONFIRMED`** | `app/actions/bookings/admin.ts` | `confirmBookingAction(bookingId)` | Post-commit after `prisma.booking.update({ data: { status: "confirmed" } })` |
| **`TECHNICIAN_ASSIGNED`** | `app/actions/bookings/admin.ts` | `assignTechnicianAction(bookingId, technicianId)` | Post-commit after `prisma.booking.update({ data: { technicianId } })` |
| **`TECHNICIAN_EN_ROUTE`** | `app/actions/bookings/technician.ts` | `startTechnicianTripAction(bookingId, token?)` | After verifying token/admin auth & `confirmed` status (status remains `confirmed`) |
| **`TECHNICIAN_ARRIVED`** | `app/actions/bookings/technician.ts` | `markTechnicianArrivedAction(bookingId, token?)` | Post-commit after `prisma.booking.update({ data: { status: "in_progress", arrivedAt } })` |
| **`SERVICE_COMPLETED`** | `app/actions/bookings/quote.ts` | `completeAndQuoteAction(params)` | Post-commit via harmonized `sendQuoteReadyNotification()` |
| **`BOOKING_CANCELLED`** (Customer) | `app/actions/bookings/customer.ts` | `cancelCustomerBookingAction(bookingId)` | Post-commit after `prisma.booking.update({ data: { status: "cancelled" } })` |
| **`BOOKING_CANCELLED`** (Admin) | `app/actions/bookings/admin.ts` | `cancelBookingAction(bookingId, reason)` | Post-commit after `prisma.booking.update({ data: { status: "cancelled" } })` |

---

### 4. Notification Helper Changes

All customer notification helpers were integrated into `lib/notifications.ts`:
- `sendCustomerBookingConfirmedAlert(booking)`
- `sendCustomerTechnicianAssignedAlert({ booking, technician })`
- `sendCustomerTechnicianEnRouteAlert({ booking, etaMinutes })`
- `sendCustomerTechnicianArrivedAlert(booking)`
- `sendCustomerBookingCancelledAlert(booking)`
- `sendQuoteReadyNotification()` harmonized with `buildServiceCompletedSms()` and `resolveCustomerNotificationPhone()`.

Each helper strictly follows the uniform architectural contract:
1. Resolve recipient via `resolveCustomerNotificationPhone()`.
2. Skip safely if customer phone is missing (`{ success: false, skipped: true, reason: "no_customer_phone" }`).
3. Check duplicate via `hasExistingNotification()`.
4. Compile SMS body using pure templates from `lib/sms/templates.ts`.
5. Dispatch via `sendSms()` -> `dispatchSms()` -> `AndroidGatewayProvider`.
6. Record result in `NotificationLog`.

---

### 5. Duplicate Protection

- Built on deterministic identity keys from `lib/notifications/identity.ts`:
  - `buildBookingConfirmedKey(booking.id)`
  - `buildTechnicianAssignedKey(booking.id, technicianId)`
  - `buildTechnicianEnRouteKey(booking.id)`
  - `buildTechnicianArrivedKey(booking.id)`
  - `buildServiceCompletedKey(booking.id)`
  - `buildBookingCancelledKey(booking.id, "customer_notice")`
- Application-level verification queries `NotificationLog.findFirst` for matching `entityId`, `type`, and `recipient` with status `SENT` or `PENDING`.
- **Concurrency Note:** Concurrency-safe atomic serialization is not guaranteed at the database level because schema migrations were prohibited. The application-level check prevents sequential double-clicks and repeated trip start actions.

---

### 6. Recipient Handling

- All customer SMS dispatchers strictly route through `resolveCustomerNotificationPhone(source)` from `lib/notifications/recipients.ts`.
- Supports raw phone strings or entity objects (`{ phone }`, `{ customer: { phone } }`, `{ user: { phone } }`).
- Normalizes to E.164 via `normalizePhoneToE164`.
- Safely strips invalid input (`"N/A"`, `"null"`, `"undefined"`, empty strings) and returns `null` without throwing.
- If `null` is returned, dispatch is safely skipped and logged as an application warning; the primary business mutation succeeds unconditionally.

---

### 7. Technician Privacy Protection

Strict privacy rules verified across all customer templates:
- **No Personal Phone Numbers:** Customer templates accept only technician first name (`extractFirstName`). No phone fields are accepted or rendered.
- **Support Routing:** All customer questions/support instructions are directed strictly to the business hotline (`BUSINESS_PHONE_DISPLAY`).
- Verified in tests:
  - `buildTechnicianAssignedSms`: Contains technician first name only.
  - `buildTechnicianEnRouteSms`: Contains technician first name only.
  - `buildTechnicianArrivedSms`: Contains technician first name only.

---

### 8. Tracking URL Security

- In `sendCustomerTechnicianEnRouteAlert`, the live tracking URL sent to customers is strictly:
  `${APP_URL}/account/bookings/${booking.id}`
- **Security Guard:** The technician internal driver console URL (`/technician/tracking/[bookingId]?token=...`) and HMAC dispatch tokens are **never** included or leaked to customers.

---

### 9. Failure Isolation

- In all six events, database state updates and transaction commits execute before SMS dispatch begins.
- Dispatches are wrapped in post-commit `try / catch` blocks.
- If the Android SMS Gateway times out, fails, or is offline:
  - An error row is recorded in `NotificationLog` with `status: "FAILED"`.
  - The error is caught locally.
  - The business action (confirmation, assignment, departure, arrival, completion, or cancellation) returns success to the user.

---

### 10. NotificationLog Behavior

Customer SMS dispatches adhere to standard `NotificationLog` semantics:
- `channel`: `"sms"`
- `type`: Canonical event name (`BOOKING_CONFIRMED`, `TECHNICIAN_ASSIGNED`, `TECHNICIAN_EN_ROUTE`, `TECHNICIAN_ARRIVED`, `SERVICE_COMPLETED`, `BOOKING_CANCELLED`)
- `entityType`: `"booking"`
- `entityId`: Booking UUID
- `recipient`: E.164 customer phone
- `status`: `"SENT"` upon gateway acceptance, `"FAILED"` upon transmission error
- `deliveryStatus`: Initialized as `"PENDING"` (or `null`), updated independently by carrier webhooks without modifying `status: "SENT"`.

---

### 11. Tests Added

Created `tests/integration/customer-sms-notifications.test.mjs` containing 13 integration test cases:
1. `BOOKING_CONFIRMED`: Dispatches confirmation SMS with short booking reference and business contact.
2. `BOOKING_CONFIRMED`: Application-level duplicate check prevents duplicate confirmation SMS.
3. `BOOKING_CONFIRMED`: Missing customer phone skips dispatch safely without throwing.
4. `BOOKING_CONFIRMED`: Gateway failure records `FAILED` in `NotificationLog` without throwing.
5. `TECHNICIAN_ASSIGNED`: Dispatches technician assigned SMS with technician first name only (zero personal phone).
6. `TECHNICIAN_ASSIGNED`: Duplicate assignment check suppresses second notification for same booking.
7. `TECHNICIAN_EN_ROUTE`: Dispatches en route SMS with customer portal tracking URL and no driver token.
8. `TECHNICIAN_EN_ROUTE`: En route notification does NOT mutate booking status (remains `confirmed`).
9. `TECHNICIAN_ARRIVED`: Dispatches arrival SMS with accessibility instructions.
10. `SERVICE_COMPLETED`: Dispatches completion SMS with total amount and account invoice link.
11. `BOOKING_CANCELLED`: Dispatches customer cancellation notice and coexists with Admin alert.
12. Recipient Safety: `resolveCustomerNotificationPhone` normalizes raw input safely.
13. Privacy Guard: Technician personal phone is never included in any customer template.

---

### 12. Master Regression Result

Command: `node tests/run-all.mjs`
- **Previous Baseline:** 221 tests
- **Tests Added in Phase 3C:** 13 tests
- **Total Tests Run:** 234
- **Passed:** 234
- **Failed:** 0
- **Regression Breaches:** None. Zero existing tests broken.

---

### 13. TypeScript Result

Command: `npx tsc --noEmit`
- Exit Code: 0
- Type Errors: 0
- Full strict type safety maintained across all modified actions and helpers.

---

### 14. Production Build Result

Command: `npm run build`
- Tool: Next.js 16.3.1 (Turbopack)
- Exit Code: 0
- Compilation: Compiled successfully in 5.2s
- TypeScript Typecheck: Passed in 7.1s (0 errors)
- Static Generation: 67/67 routes generated successfully.

---

### 15. Scope Verification

Repository diff inspection confirms:
- `prisma/schema.prisma`: UNTOUCHED
- `prisma/migrations/*`: UNTOUCHED (0 migrations)
- `lib/sms/providers/android-gateway.ts`: UNTOUCHED
- `lib/sms/index.ts`: UNTOUCHED
- `lib/sms/templates.ts`: UNTOUCHED
- `lib/sms/webhook-verification.ts`: UNTOUCHED
- `app/api/webhooks/sms-gateway/route.ts`: UNTOUCHED
- `app/api/notifications/retry/route.ts`: UNTOUCHED
- `lib/admin-auth.ts`: UNTOUCHED
- `lib/technician-auth.ts`: UNTOUCHED
- `lib/bookings/state-machine.ts`: UNTOUCHED

---

### 16. Deviations from the Audit

- **Deviations:** NONE.
- Implemented exactly the 6 customer events audited in Phase 3C.
- Preserved all Phase 3B admin notifications and email dispatch paths.

---

### 17. Remaining Risks

1. **Application-Level Duplicate Check Concurrency:**
   - Under high-frequency simultaneous requests (sub-millisecond), two parallel workers could pass `NotificationLog.findFirst` before either commits. This is documented and accepted due to the strict prohibition against database schema migrations.
2. **Missing Customer Phone Numbers:**
   - Legacy bookings or test accounts without valid phone numbers will gracefully skip SMS dispatch. Operators must ensure customer intake forms collect E.164-compatible phone numbers.

---

### 18. Real SMS Status

- **Status:** MOCKED / SIMULATED (No real SMS sent during automated build/test).
- Real SMS delivery requires staging deployment with active Android Gateway hardware.
- No live secrets or API keys exposed.

---

============================================================
PHASE 3C IMPLEMENTATION STATUS: COMPLETE

CUSTOMER SMS EVENTS IMPLEMENTED:
- BOOKING_CONFIRMED
- TECHNICIAN_ASSIGNED
- TECHNICIAN_EN_ROUTE
- TECHNICIAN_ARRIVED
- SERVICE_COMPLETED
- BOOKING_CANCELLED

ADMIN SMS INTACT: YES

DATABASE CHANGES: NONE

MIGRATIONS CREATED: NONE

SMS PROVIDER CHANGES: NONE

WEBHOOK CHANGES: NONE

RETRY WORKER CHANGES: NONE

AUTHENTICATION CHANGES: NONE

STATE MACHINE CHANGES: NONE

MASTER REGRESSION: 234/234 PASS

TYPESCRIPT: PASS (EXIT 0)

PRODUCTION BUILD: PASS (EXIT 0)

READY FOR PHASE 3C FOCUSED TESTING REVIEW: YES

STOP HERE.
============================================================
