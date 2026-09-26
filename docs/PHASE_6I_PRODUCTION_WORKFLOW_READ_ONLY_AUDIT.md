# PHASE 6I — PRODUCTION WORKFLOW READ-ONLY AUDIT REPORT
**HT Mobile Services / Tire Mobile Clinic**  
**Audit Date:** September 24, 2026  
**Auditor:** Antigravity AI (DeepMind)  
**Audit Mode:** STRICT READ-ONLY (No code modified, no database mutations, no secrets rotated)  
**Phase Status:** `PHASE 6I STATUS: PASS WITH ACTIONABLE FINDINGS`

---

## 1. Executive Summary

A comprehensive, end-to-end read-only audit of the HT Mobile Services production workflow was conducted following the completion of Phase 6H. The entire lifecycle from Customer Booking Submission $\rightarrow$ Central Dispatch $\rightarrow$ Technician Allocation $\rightarrow$ GPS Telemetry $\rightarrow$ Arrival $\rightarrow$ Service Execution $\rightarrow$ Quote/Invoice Generation $\rightarrow$ Payment Settlement $\rightarrow$ Customer Review was systematically inspected across Server Actions, REST endpoints, database schemas, carrier notification pipelines, and client UI components.

### Audit Verdict:
The core production booking, payment, and dispatch state machine is **internally consistent, resilient against failures, and protected against unauthorized data leakage**.
- **Privacy Boundary:** Customer endpoints strictly sanitize technician personal phone numbers (`technician.phone = null`).
- **Payment & Completion Guard:** Only `completed` bookings can transition to `paid`; REST PATCH directly completing bookings remains blocked.
- **Notification Truth:** Carrier delivery receipts (`DELIVERED`) are strictly distinguished from SMS gateway dispatches (`SENT`).
- **Resilience:** All SMS and email notifications are non-blocking, post-commit, and failure-isolated; notification timeouts cannot abort or roll back business transactions.
- **Test Baseline:** 352/352 tests pass (100%), TypeScript compiles with 0 errors, and all 67 Next.js production routes build cleanly.

One medium finding was discovered: `confirmBookingAction` in `app/actions/bookings/admin.ts` does not call `checkSlotCapacity()` when directly confirming a booking without technician assignment, whereas both `assignTechnicianAction()` and `PATCH /api/admin/bookings/[id]` enforce capacity checks.

---

## 2. Scope

The audit traced the complete production operational workflow and its edge cases:
1. Customer Booking Creation (`createBookingRequestAction`, `POST /api/bookings`)
2. Notification Dispatch: `BOOKING_CREATED`
3. Admin Review (`/admin/bookings`, `/admin/bookings/[bookingId]`)
4. Booking Confirmation (`confirmBookingAction`, `PATCH /api/admin/bookings/[id]`)
5. Technician Assignment (`assignTechnicianAction`)
6. Technician En Route (`startTechnicianTripAction`)
7. GPS Telemetry (`POST /api/technician/location`, `GET /api/technician/location`, `LiveVanTracker`)
8. Technician Arrival (`markTechnicianArrivedAction`)
9. Service Start (`startServiceAction`)
10. Completion & Quote Generation (`completeAndQuoteAction`)
11. Payment Recording (`markBookingPaidAction`)
12. Digital PDF Invoice/Receipt (`GET /api/bookings/[id]/receipt`)
13. Customer Booking History (`GET /api/bookings`, `GET /api/bookings/[id]`)
14. Cancellation Pathways (`cancelBookingAction`, `cancelCustomerBookingAction`, `PUT /api/bookings/[id]`, `DELETE /api/bookings/[id]`)
15. Notification Infrastructure (Matrix, Gateway Webhooks, TokenManager, Retry Worker)
16. Security, Authorization, and Production Environment Variables

---

## 3. Files Inspected

```text
app/actions/bookings/admin.ts
app/actions/bookings/customer.ts
app/actions/bookings/quote.ts
app/actions/bookings/technician.ts
app/actions/notifications.ts
app/api/bookings/route.ts
app/api/bookings/[id]/route.ts
app/api/bookings/[id]/receipt/route.ts
app/api/admin/bookings/route.ts
app/api/admin/bookings/[id]/route.ts
app/api/technician/location/route.ts
app/api/webhooks/sms-gateway/route.ts
app/api/notifications/retry/route.ts
app/api/emergency-requests/route.ts
app/api/contact-messages/route.ts
app/(admin-portal)/admin/bookings/page.tsx
app/(admin-portal)/admin/bookings/[bookingId]/page.tsx
app/(admin-portal)/admin/bookings/[bookingId]/AdminBookingDetailActions.tsx
app/(admin-portal)/admin/notifications/page.tsx
app/account/bookings/[bookingId]/page.tsx
app/technician/tracking/[bookingId]/page.tsx
app/components/LiveVanTracker.tsx
lib/auth.ts
lib/admin-auth.ts
lib/technician-auth.ts
lib/bookings/availability.ts
lib/bookings/state-machine.ts
lib/notifications.ts
lib/notifications/identity.ts
lib/notifications/recipients.ts
lib/sms/index.ts
lib/sms/token-manager.ts
lib/sms/providers/android-gateway.ts
lib/sms/webhook-verification.ts
lib/receipts.ts
prisma/schema.prisma
```

---

## 4. Customer Booking Creation Audit

### Pathways Analyzed:
- **Server Action:** `createBookingRequestAction` in `app/actions/bookings/customer.ts`
- **REST API:** `POST /api/bookings` in `app/api/bookings/route.ts`

### Findings:
1. **Initial Status Integrity:** Both pathways strictly initialize new bookings with `status: "pending"` and `paymentStatus: "pending"`. No client input can bypass this to create a pre-confirmed, in-progress, or paid booking.
2. **Customer Identity Resolution:**
   - Authenticated users resolve via `getOrCreateCustomerForUser()` linking `userId` to `Customer`.
   - Guests resolve by matching existing phone/email records or creating a new `Customer` profile.
   - Explicitly submitted booking telephone numbers are synchronized to the customer record.
3. **Capacity Check:** `createBookingRequestAction` verifies slot capacity via `checkSlotCapacity()` prior to row insertion. If the slot limit is reached, it returns `{ success: false, error: "Selected time slot is no longer available..." }`.
4. **Post-Commit Isolation:** Both endpoints dispatch `sendBookingConfirmation()` inside a `try/catch` block **after** the database record is committed. An SMS Gateway or Resend failure logs an error but does not roll back the booking creation.

---

## 5. Booking Confirmation Audit

### Pathways Analyzed:
- **Server Action:** `confirmBookingAction` in `app/actions/bookings/admin.ts`
- **REST API:** `PATCH /api/admin/bookings/[id]` in `app/api/admin/bookings/[id]/route.ts`

### Findings:
1. **Authorization:** Both require active admin sessions (`requireAdminSession()` / `verifyAdminSession()`).
2. **State Transition:** Enforces `validateBookingTransition(status, "confirmed", "admin")`. Rejects transitions from terminal statuses (`completed`, `cancelled`).
3. **Service Confirmation Milestone:** Both record `serviceConfirmedAt: new Date()` upon confirmation.
4. **Disparity Identified (Finding I-01):**
   - `PATCH /api/admin/bookings/[id]` executes `checkSlotCapacity(tx, ...)` and returns `409 Conflict` (`SLOT_FULL`) if slot limit is reached.
   - `assignTechnicianAction()` executes `checkSlotCapacity(prisma, ...)` when auto-confirming pending bookings.
   - `confirmBookingAction()` in `app/actions/bookings/admin.ts` **omits** `checkSlotCapacity()`. An admin clicking "Confirm" directly without assigning a technician bypasses capacity checks.

---

## 6. Technician Assignment Audit

### Pathway Analyzed:
- `assignTechnicianAction` in `app/actions/bookings/admin.ts`

### Findings:
1. **Admin Authorization:** Enforced via `requireAdminSession()`.
2. **Terminal Protection (G-03.A):** Returns action failure if `status` is `completed` or `cancelled`. No mutation occurs.
3. **Same-Technician Safe No-Op (G-03.B):** If `booking.technicianId === technicianId`, returns `{ success: true }` immediately without database updates or duplicate SMS notifications.
4. **Pending Auto-Confirm Integrity (G-03.C):** If booking is in `pending` status:
   - Validates slot capacity via `checkSlotCapacity()`.
   - Sets `status: "confirmed"` and `serviceConfirmedAt: new Date()`.
   - Dispatches `sendCustomerBookingConfirmedAlert()`.
   - Dispatches `sendCustomerTechnicianAssignedAlert()`.
   - Sequence is strictly deterministic and duplicate protected.

---

## 7. Technician En Route Audit

### Pathway Analyzed:
- `startTechnicianTripAction` in `app/actions/bookings/technician.ts`

### Findings:
1. **Dual Authorization:** Accepts either a valid HMAC-signed `technicianDispatchToken` or an authenticated admin session.
2. **Scope Verification:** The dispatch token is cryptographically verified to match `expectedBookingId` and `expectedTechnicianId`.
3. **Status Preservation:** Does not mutate database status (booking remains `confirmed`).
4. **Notification Dispatch:** Fires `sendCustomerTechnicianEnRouteAlert()` with live tracking URL (`/account/bookings/[id]`).
5. **No Telemetry Interference:** GPS coordinate updates sent to `POST /api/technician/location` do not re-trigger `startTechnicianTripAction` or repeated `TECHNICIAN_EN_ROUTE` alerts.

---

## 8. GPS Telemetry Audit

### Pathways Analyzed:
- `POST /api/technician/location`
- `GET /api/technician/location`
- `app/components/LiveVanTracker.tsx`

### Findings:
1. **Authentication & Rate Limiting:** `POST` is rate-limited to 15 requests/minute per IP and requires dispatch token or technician API key.
2. **Access Boundary:** `GET /api/technician/location` is restricted to admin operators and authorized technicians. Customers **cannot** query raw technician coordinates directly from this endpoint.
3. **Customer Live Tracking:** Customers receive sanitized tracking data via `GET /api/bookings/[id]` where `technician.phone` is strictly `null` and `technicianLocation` coordinates are only provided if the booking is currently active and within signal freshness limits.
4. **Signal Freshness:** Computes `waiting` (no signal), `fresh` (<60s), `stale` (1-5 min), or `offline` (>5 min).
5. **Isolation:** Coordinate updates only upsert `technicianLocation` records; they never alter booking status or trigger outbound SMS.

---

## 9. Technician Arrival Audit

### Pathway Analyzed:
- `markTechnicianArrivedAction` in `app/actions/bookings/technician.ts`

### Findings:
1. **Milestone Logic:** Populates `arrivedAt: new Date()`. The booking status remains `confirmed` (Phase 6B lifecycle). Arrival **does not** prematurely transition the booking to `in_progress`.
2. **Required State:** Booking must be `confirmed` with an assigned `technicianId`.
3. **Idempotency:** If `arrivedAt` is already set, it preserves the original timestamp.
4. **Notification:** Dispatches `sendCustomerTechnicianArrivedAlert()`.
5. **UI Truth:** Both customer tracking and admin booking detail render `"Arrived On-Site"` badges based on `confirmed + arrivedAt`.

---

## 10. Start Service Audit

### Pathway Analyzed:
- `startServiceAction` in `app/actions/bookings/admin.ts`

### Findings:
1. **Authorization:** Admin session required.
2. **Assigned Technician Requirement:** Rejects service start if `booking.technicianId` is missing.
3. **Arrival Milestone Dependency:**
   - `startServiceAction` checks `validateBookingTransition(booking.status, "in_progress", "admin")`.
   - **Current Rule:** Arrival is **not mandatory** before starting service. An admin operator can transition a booking from `confirmed` directly to `in_progress` if a technician is assigned, even if `arrivedAt` was not recorded (allowing operational overrides during mobile connectivity dropouts).

---

## 11. Completion & Quote Audit

### Pathway Analyzed:
- `completeAndQuoteAction` in `app/actions/bookings/quote.ts`

### Findings:
1. **Authorization & State Validation:** Admin session required. Booking must be in `in_progress` status.
2. **Direct REST Completion Blocked (G-04):** `PATCH /api/admin/bookings/[id]` explicitly returns `400 Bad Request` if `status: "completed"` is requested, guaranteeing all completions pass through `completeAndQuoteAction`.
3. **Quote Reconciliation:**
   - Validates `completeQuoteSchema` (base price $\ge 0$, extra services array).
   - Reconciles `totalAmount = basePrice + extraServicesTotal`.
   - Preserves `paymentStatus = "paid"` if the booking was already settled (Phase 6D Fix 1). Otherwise sets `quote_sent`.
4. **Document Generation:** Automatically generates branded invoice PDF (`generateQuotePdf`).
5. **Customer Alert:** Dispatches `sendQuoteReadyNotification()` with itemized pricing.

---

## 12. Payment Audit

### Pathway Analyzed:
- `markBookingPaidAction` in `app/actions/bookings/quote.ts`

### Findings:
1. **Status Requirement (G-07):** Rejects payment settlement unless `booking.status === "completed"`. Bookings in `pending`, `confirmed`, `in_progress`, or `cancelled` cannot be marked as paid.
2. **Transition Validation:** Enforces `validatePaymentTransition(booking.paymentStatus, "paid", "admin")`.
3. **Idempotency:** If already `paid`, returns `{ success: true }` without redundant DB writes or notifications.
4. **Alert:** Dispatches `sendCustomerPaymentReceivedAlert()` post-commit.

---

## 13. Receipt / Invoice Audit

### Pathway Analyzed:
- `GET /api/bookings/[id]/receipt` in `app/api/bookings/[id]/receipt/route.ts`

### Findings:
1. **Dual Authorization:** Allows Admin session or authenticated customer.
2. **Multi-Customer IDOR Defense:** Validates ownership against `getAuthorizedCustomerIdsForUser()`. Cross-customer access attempts receive `403 Forbidden`.
3. **Completion Guard:** Requires `booking.status === "completed"`. Non-completed bookings receive `400 Bad Request`.
4. **PDF Streaming:** Generates PDF dynamically using `pdf-lib` and returns `application/pdf` with `Content-Disposition: attachment`.
5. **No Credential Leakage:** Only public business details, customer name/vehicle, and line items are rendered on the receipt.

---

## 14. Customer Booking History Audit

### Pathways Analyzed:
- `GET /api/bookings`
- `GET /api/bookings/[id]`
- `/account/bookings/[bookingId]`

### Findings:
1. **Privacy Boundary (G-01 & 6F):** Both the list endpoint and detail endpoint explicitly serialize `technician.phone = null`. Raw `technicianLocation` objects are stripped.
2. **Ownership Scoping:** Bookings are filtered using `OR: [{ customer: { userId: user.id } }, { customerId: { in: authorizedCustomerIds } }]`.
3. **Financial Serialization:** All `Prisma.Decimal` values (`totalAmount`, prices) are serialized to numbers/strings before response transmission.

---

## 15. Cancellation Audit

### Pathways Analyzed:
- `cancelBookingAction` (Admin)
- `cancelCustomerBookingAction` (Customer)
- `PUT /api/bookings/[id]` (Customer REST)
- `DELETE /api/bookings/[id]` (Customer REST)

### Findings:
1. **Terminal Protection:** All pathways reject cancellation of already `completed` or `cancelled` bookings.
2. **Customer Constraint:** Customers may only cancel `pending` bookings. Confirmed or in-progress bookings cannot be self-cancelled by customers.
3. **Notification Parity (G-05):** All 4 cancellation pathways dispatch both `sendAdminBookingCancelledAlert()` and `sendCustomerBookingCancelledAlert()` post-commit.
4. **Failure Isolation:** SMS alert errors during cancellation do not roll back the database transaction.

---

## 16. Canonical Notification Matrix

| Event | Authoritative Trigger | Recipient | Identity Key | DB First? | Post-Commit? | Failure Isolated? | Duplicate Protected? |
|---|---|---|---|---|---|---|---|
| `BOOKING_CREATED` | `createBookingRequestAction`, `POST /api/bookings` | Admin SMS (`ADMIN_NOTIFICATION_PHONE`), Customer Email | `booking_created_admin:<id>` | Yes | Yes | Yes (try/catch) | Yes (`hasExistingNotification`) |
| `BOOKING_CONFIRMED` | `confirmBookingAction`, `assignTechnicianAction`, `PATCH /api/admin/bookings` | Customer SMS (`customer.phone`) | `booking_confirmation:<id>` | Yes | Yes | Yes (try/catch) | Yes (`hasExistingNotification`) |
| `TECHNICIAN_ASSIGNED` | `assignTechnicianAction` | Customer SMS (`customer.phone`) | `technician_assigned:<id>:<techId>` | Yes | Yes | Yes (try/catch) | Yes (qualifier key) |
| `TECHNICIAN_EN_ROUTE` | `startTechnicianTripAction` | Customer SMS (`customer.phone`) | `technician_en_route:<id>` | Yes | Yes | Yes (try/catch) | Yes |
| `TECHNICIAN_ARRIVED` | `markTechnicianArrivedAction` | Customer SMS (`customer.phone`) | `technician_arrived:<id>` | Yes | Yes | Yes (try/catch) | Yes |
| `SERVICE_COMPLETED` | `completeAndQuoteAction` | Customer SMS & Email | `service_completed:<id>` | Yes | Yes | Yes (try/catch) | Yes |
| `PAYMENT_RECEIVED` | `markBookingPaidAction` | Customer SMS (`customer.phone`) | `payment_received:<id>` | Yes | Yes | Yes (try/catch) | Yes |
| `BOOKING_CANCELLED` | All 4 cancellation paths | Admin SMS & Customer SMS | `booking_cancelled:<id>:<role>` | Yes | Yes | Yes (try/catch) | Yes |
| `EMERGENCY_REQUEST_CREATED` | `POST /api/emergency-requests` | Admin SMS (`ADMIN_NOTIFICATION_PHONE`) | `emergency_alert:<id>` | Yes | Yes | Yes (try/catch) | Yes |
| `CONTACT_REQUEST_CREATED` | `POST /api/contact-messages` | Admin SMS (`ADMIN_NOTIFICATION_PHONE`) | `contact_alert:<id>` | Yes | Yes | Yes (try/catch) | Yes |

---

## 17. SMS Gateway Operational Truth Audit

### Status Model:
The system strictly separates **Application Dispatch Status** from **Carrier Delivery Status**:
- `status: "PENDING"`: Notification record created, awaiting provider dispatch attempt.
- `status: "SENT"`: Successfully accepted and dispatched by SMS Gateway or SMSC. **Not proof of handset arrival.**
- `status: "FAILED"`: Gateway rejected dispatch, network timed out, or unconfigured credentials.
- `deliveryStatus: "DELIVERED"`: Handset delivery confirmed via cryptographic gateway webhook callback (`sms:delivered`).
- `deliveryStatus: "FAILED"`: Carrier reported delivery failure (e.g. absent subscriber, invalid number).

### UI Truth (G-06):
The Admin Notification console (`/admin/notifications`) accurately labels `SENT` as `"Dispatched (SMSC Sent)"` and reserves `"Handset Delivered"` strictly for records with `deliveryStatus: "DELIVERED"`.

---

## 18. Token Lifecycle Audit (TokenManager)

1. **Storage:** Stored in PostgreSQL `sms_gateway_tokens` table with row ID `"active"`.
2. **Concurrency Guard:** Uses `SELECT ... FOR UPDATE` row-level locks inside Prisma transactions to prevent race conditions during refresh token rotation.
3. **Proactive Refresh:** Automatically requests a fresh access token 60 seconds before expiration.
4. **Secret Safety:** Tokens and authorization headers are stripped from logs. Server-only execution.

---

## 19. Notification Retry Audit

### Route: `POST /api/notifications/retry`
1. **Authorization:** Requires `Authorization: Bearer ${CRON_SECRET}` or an active Admin session.
2. **Record Selection:** Targets `status: "FAILED"` where `retryCount < 3`. Does not retry carrier-failed deliveries where dispatch succeeded.
3. **Atomic Claim:** Increments `retryCount` during selection via `updateMany` to prevent concurrent workers from claiming the same record.
4. **Direct Dispatch:** Calls provider dispatch directly, preventing infinite recursive record creation.
5. **Cap:** Hard limit of 3 retry attempts before permanent failure.

---

## 20. Failure Isolation Audit

Across all inspected operational paths:
- **DB First:** Database state changes are committed before notification dispatches are attempted.
- **Try/Catch Encapsulation:** Every notification call is wrapped in exception-handling blocks.
- **No Transaction Rollback:** Simulated provider 401s, 503s, socket timeouts, and network dropouts do **not** abort customer booking submissions, payments, cancellations, or completions.

---

## 21. Authorization Matrix

| Operation | Customer | Technician | Admin | Guest |
|---|---|---|---|---|
| **Create booking** | Allowed | Allowed (as customer) | Allowed | Allowed |
| **View own booking** | Allowed | Denied | Allowed | Denied (unless synced) |
| **View another booking** | **Denied (403/404)** | **Denied (403)** | Allowed | **Denied (401/403)** |
| **Assign technician** | **Denied** | **Denied** | Allowed | **Denied** |
| **Confirm booking** | **Denied** | **Denied** | Allowed | **Denied** |
| **Start service** | **Denied** | **Denied** | Allowed | **Denied** |
| **Mark arrival** | **Denied** | Allowed (Token) | Allowed | **Denied** |
| **Complete & Quote** | **Denied** | **Denied** | Allowed | **Denied** |
| **Mark paid** | **Denied** | **Denied** | Allowed | **Denied** |
| **Cancel booking** | Allowed (Pending only) | **Denied** | Allowed | **Denied** |
| **View receipt** | Allowed (Completed only) | **Denied** | Allowed | **Denied** |
| **View technician GPS** | Allowed (Sanitized own only) | Allowed (Token) | Allowed | **Denied** |

---

## 22. Security & Privacy Audit

1. **Technician Phone Privacy:** Search across `app/` confirms technician phone is never exposed to customer bundles or public responses. All customer telephone links (`tel:`) route to central dispatch (`+18005558473`).
2. **Customer Data Isolation:** Multi-customer authorization (`getAuthorizedCustomerIdsForUser`) prevents IDOR attacks between customer accounts.
3. **Environment Prefix Safety:** No secrets or private tokens carry the `NEXT_PUBLIC_` prefix. Only public variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_BUSINESS_PHONE`, etc.) are exposed to the browser.
4. **Webhook Security:** Incoming webhooks require HMAC-SHA256 signatures (`X-Signature`) with 300s timestamp replay tolerance. Payloads >64KB are rejected with 413.

---

## 23. Production Environment Audit

| Variable | Scope | Required? | Fallback | Evaluated Status |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public / Client | Yes | `"http://localhost:3000"` | Clean |
| `NEXT_PUBLIC_BUSINESS_PHONE` | Public / Client | Yes | `"+18005558473"` | Clean |
| `NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY` | Public / Client | Yes | `"(800) 555-TIRE (8473)"` | Clean |
| `NEXT_PUBLIC_SUPABASE_URL` | Public / Client | Yes | None | Clean |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public / Client | Yes | None | Clean |
| `DATABASE_URL` / `DIRECT_URL` | Server-Only | Yes | None | Clean |
| `SMS_GATEWAY_URL` | Server-Only | Yes | `"https://api.sms-gate.app"` | Clean |
| `SMS_GATEWAY_API_KEY` | Server-Only | Conditional | None | Clean (TokenManager active) |
| `SMS_GATEWAY_WEBHOOK_SECRET` | Server-Only | Yes | None | Clean |
| `ADMIN_NOTIFICATION_PHONE` | Server-Only | Yes | `DISPATCH_PHONE_NUMBER` | Clean |
| `DISPATCH_PHONE_NUMBER` | Server-Only | Optional | `TECHNICIAN_PHONE_NUMBER` | Clean |
| `TECHNICIAN_PHONE_NUMBER` | Server-Only | Optional | None | Clean |
| `TECHNICIAN_DISPATCH_SECRET` | Server-Only | Yes | None | Clean |
| `RESEND_API_KEY` | Server-Only | Yes | None | Clean |
| `CRON_SECRET` | Server-Only | Yes | None | Clean |

---

## 24. End-to-End Lifecycle Consistency Matrix

| Stage | DB Status | UI Label | Notification Dispatched | Customer Visibility | Admin Action Parity |
|---|---|---|---|---|---|
| **Created** | `pending` | Pending | `BOOKING_CREATED` | "Request Received" | Confirm / Assign / Cancel |
| **Confirmed** | `confirmed` | Confirmed | `BOOKING_CONFIRMED` | "Confirmed" | Assign / Cancel / Start Service |
| **Assigned** | `confirmed` | Tech Assigned | `TECHNICIAN_ASSIGNED` | Shows Tech Name/Role | Tech Contact / Reassign |
| **En Route** | `confirmed` | On The Way | `TECHNICIAN_EN_ROUTE` | Live Van Tracking active | Live GPS modal active |
| **Arrived** | `confirmed` (`arrivedAt` set) | Arrived On-Site | `TECHNICIAN_ARRIVED` | "Technician On-Site" | "Arrived On-Site" badge |
| **In Progress** | `in_progress` | In Progress | None | Pulsing "In Progress" | Complete & Quote enabled |
| **Completed** | `completed` | Completed | `SERVICE_COMPLETED` | Line items & PDF receipt | Line items & PDF receipt |
| **Paid** | `completed` (`paymentStatus = "paid"`) | Paid | `PAYMENT_RECEIVED` | "Paid" | "Paid ($xx.xx)" badge |
| **Cancelled** | `cancelled` | Cancelled | `BOOKING_CANCELLED` | Red "Cancelled" card | Red "Cancelled" badge |

---

## 25. Demo / Test Data Audit (Read-Only)

Database inspection via read-only PostgreSQL query revealed:
- **`users`:** 7 total rows (contains demo accounts such as `alex.demo@example.com` and developer accounts).
- **`customers`:** 22 total rows.
- **`technicians`:** 5 seeded active technicians (`Alex Morgan`, `Daniel Brooks`, `Ryan Carter`, `Ethan Wilson`, `Noah Bennett`).
  - *Observation:* All 5 seeded technicians currently have `phone: null` in the database.
- **`bookings`:** 38 total rows (22 `completed`, 16 `cancelled`). Zero active pending or in-progress bookings currently in the database.
- **`notification_logs`:** 123 rows (2 `DELIVERED`, 33 `SENT`, 88 `FAILED` from previous development/test runs).
- *Recommendation:* Prior to formal production go-live, a dedicated data-cleanup script should prune old test logs and populate real technician mobile numbers.

---

## 26. Regression Test Results

```text
node tests/run-all.mjs
--------------------------------------------------
Total Tests: 352 | Passed: 352 | Failed: 0
--------------------------------------------------
Exit code: 0

npx tsc --noEmit
Exit code: 0 (0 errors)

npm run build
✓ Generating static pages using 7 workers (67/67) in 2.6s
Finalizing page optimization ...
Exit code: 0 (67/67 routes generated cleanly)
```

---

## 27. Consolidated Findings

| ID | Severity | Workflow | File | Finding | Evidence | Production Impact | Recommended Phase |
|---|---|---|---|---|---|---|---|
| **I-01** | **MEDIUM** | Booking Confirmation | `app/actions/bookings/admin.ts:15` | `confirmBookingAction` does not check slot capacity | `PATCH /api/admin/bookings/[id]` and `assignTechnicianAction` check capacity; `confirmBookingAction` only checks state transition | An admin confirming a booking directly without assigning a technician can confirm over-capacity slots | Phase 7 |
| **I-02** | **LOW** | Technician Dispatch | Database `technicians` table | Seeded technicians have `phone: null` | `SELECT phone FROM technicians` returns `null` for all 5 techs | Fallback to `NEXT_PUBLIC_BUSINESS_PHONE` occurs; personal tech direct SMS alert skipped | Phase 7 (Data Setup) |
| **I-03** | **LOW** | UI Layout | `app/layout.tsx:16` | Inlined fallback for business phone | Duplicates `BUSINESS_PHONE_RAW` constant definition | Zero runtime failure (strings match), minor maintenance redundancy | Phase 7 |
| **I-04** | **INFORMATIONAL** | Service Execution | `app/actions/bookings/admin.ts:77` | Start Service allows manual override without arrival milestone | `startServiceAction` requires `technicianId` but does not enforce `arrivedAt !== null` | Intended operational flexibility for cellular dead zones | Documentation Only |

---

## 28. Recommended Next Phase

### Phase 7: Production Readiness & Hardening
1. Add `checkSlotCapacity()` validation inside `confirmBookingAction()` in `app/actions/bookings/admin.ts` to achieve 100% confirmation parity with `PATCH /api/admin/bookings/[id]`.
2. Seed or update active technician phone numbers in production database.
3. Clean up historical test notification logs and reset demo bookings prior to final DNS switchover.

---

## Final Status

```text
PHASE 6I STATUS: PASS WITH ACTIONABLE FINDINGS
```
