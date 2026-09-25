# PHASE 6G — ADMIN & OPERATIONAL CONSISTENCY READ-ONLY AUDIT
**HT Mobile Services (Tire Mobile Clinic Next)**  
**Audit Mode:** STRICT READ-ONLY AUDIT  
**Date:** September 24, 2026  
**Status:** PASS WITH ACTIONABLE FINDINGS

---

## 1. Executive Summary

This audit evaluates the administrative and operational systems of the HT Mobile Services application following the backend lifecycle hardening (Phases 6B, 6D) and customer privacy hardening (Phase 6F). The scope covers administrative dashboards, booking details, technician dispatch/assignment workflows, server actions versus REST API route parity, quote and payment lifecycles, operational visibility in notification logs, technician privacy, and business hotline consistency.

### High-Level Verdict
The core administrative lifecycle guards (`confirmBookingAction`, `startServiceAction`, `markTechnicianArrivedAction`, `completeAndQuoteAction`, `markBookingPaidAction`) correctly protect database state machine transitions. Terminal states (`completed` and `cancelled`) cannot be reopened or reactivated. However, the audit identified **7 actionable findings** across UI completeness, API consistency, technician privacy leakage, and notification status reporting:
1. **Critical Privacy Leak in Customer Booking List API:** While `GET /api/bookings/[id]` was hardened in Phase 6F, `GET /api/bookings` (the paginated customer booking list endpoint) includes the full Prisma `technician` object with the unmasked `technician.phone` field.
2. **Major Functional Incompleteness on Admin Booking Detail Page:** `/admin/bookings/[bookingId]` lacks quote/invoicing controls, payment display, payment marking buttons, receipt access links, live GPS tracking entry, arrival timestamp indicators, and service commencement controls.
3. **Technician Assignment Auto-Confirm Side Effect:** `assignTechnicianAction` silently auto-transitions `pending` bookings to `confirmed` without validating capacity, without populating `serviceConfirmedAt`, and without emitting the canonical `BOOKING_CONFIRMED` event. Furthermore, it permits technician assignment on `completed` or `cancelled` bookings and lacks re-assignment deduplication.
4. **Lifecycle Bypass via REST API:** `PATCH /api/admin/bookings/[id]` allows transitioning a booking directly from `in_progress` to `completed` without validating quote line items, without updating `totalAmount`, without creating an invoice PDF, and without setting `paymentStatus`.
5. **Silent Cancellation Bypasses in Customer API:** `DELETE /api/bookings/[id]` and `PUT /api/bookings/[id]` mutate booking status to `cancelled` without dispatching admin or customer cancellation SMS notifications.
6. **Notification UI Inversion of Operational Truth:** `/admin/notifications` displays SMS messages with gateway status `SENT` as `"✓ Delivered"` and tallies them under `"Successfully Delivered"`, violating the SMSGate protocol contract where `SENT` indicates SMSC transmission and `DELIVERED` requires carrier handset confirmation.
7. **Permissive Payment Server Action:** `markBookingPaidAction` enforces payment status transitions (`pending`/`quote_sent` -> `paid`), but does not verify that the parent booking is in `completed` status, allowing an admin to mark a booking as paid while still `pending` or `confirmed`.

---

## 2. Scope

- **Audit Target:** Administrative console, operational workflows, dispatch actions, server actions, REST APIs, and database mutation paths.
- **Constraints Applied:** Strict Read-Only. No code changes, no database migrations, no schema alterations, no live SMS dispatch, and no payment operations.
- **Verification Performed:** Full regression test suite (`tests/run-all.mjs`), TypeScript compiler verification (`tsc --noEmit`), and Next.js Turbopack production build (`npm run build`).

---

## 3. Files Inspected

- [`app/(admin-portal)/admin/bookings/page.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/%28admin-portal%29/admin/bookings/page.tsx)
- [`app/(admin-portal)/admin/bookings/[bookingId]/page.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/%28admin-portal%29/admin/bookings/%5BbookingId%5D/page.tsx)
- [`app/(admin-portal)/admin/bookings/[bookingId]/AdminBookingDetailActions.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/%28admin-portal%29/admin/bookings/%5BbookingId%5D/AdminBookingDetailActions.tsx)
- [`app/(admin-portal)/admin/dashboard/page.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/%28admin-portal%29/admin/dashboard/page.tsx)
- [`app/(admin-portal)/admin/notifications/page.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/%28admin-portal%29/admin/notifications/page.tsx)
- [`app/api/admin/bookings/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/admin/bookings/route.ts)
- [`app/api/admin/bookings/[id]/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/admin/bookings/%5Bid%5D/route.ts)
- [`app/api/bookings/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/route.ts)
- [`app/api/bookings/[id]/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/%5Bid%5D/route.ts)
- [`app/api/bookings/[id]/receipt/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/%5Bid%5D/receipt/route.ts)
- [`app/api/technician/location/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/technician/location/route.ts)
- [`app/actions/bookings/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts)
- [`app/actions/bookings/quote.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/quote.ts)
- [`app/actions/bookings/technician.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/technician.ts)
- [`app/actions/bookings/customer.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/customer.ts)
- [`lib/bookings/state-machine.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/bookings/state-machine.ts)
- [`lib/notifications/recipients.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications/recipients.ts)
- [`lib/notifications/identity.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications/identity.ts)
- [`lib/constants/phone.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/constants/phone.ts)
- [`lib/notifications.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts)

---

## 4. Admin Booking Dashboard Audit

### Status Representation & Integrity
In [`app/(admin-portal)/admin/bookings/page.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/%28admin-portal%29/admin/bookings/page.tsx):
- **Pending:** Renders `"Pending Dispatch"` badge with `"Confirm Booking"` action button.
- **Confirmed:** Renders `"Confirmed"` badge. If `arrivedAt` is populated, renders secondary pill `"Arrived On-Site"`. Exposes technician reassignment dropdown and `"Start Service"` button.
- **In Progress:** Renders `"In Progress"` badge and `"Complete & Quote"` modal launcher.
- **Completed:** Renders `"Completed"` badge and `"Edit / Re-send Quote"` button.
- **Cancelled:** Renders `"Cancelled"` badge. Action buttons are disabled or hidden.
- **Payment Badges:** Correctly renders `"Quote Sent ($XXX)"`, `"Paid ($XXX)"`, or `"Quote Pending"`.

### Dashboard Aggregation & Filtering
- **Status Counts:** Handled on `/admin/dashboard` via in-memory aggregation of all bookings loaded through Prisma. Status counts match the database accurately.
- **Missing Filters & Search:** The booking management page (`/admin/bookings`) contains **zero** filter controls (no status tabs), **no search input**, and **no pagination**. It loads all records in a single query (`prisma.booking.findMany`).
- **Supabase Fallback Degradation:** In [`app/api/admin/bookings/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/admin/bookings/route.ts#L49-L87), if Prisma fails, the route falls back to Supabase. In this fallback:
  - `technicians` list is **omitted** (returns `undefined`).
  - `arrivedAt` and `technicianId` are **not mapped** into the returned objects.
  - Technician assignment dropdowns in the UI fail to render any options.

---

## 5. Admin Booking Detail Audit

Comparing `/admin/bookings` (table view) with `/admin/bookings/[bookingId]` (detail view):

| Field / Feature | `/admin/bookings` (Table) | `/admin/bookings/[bookingId]` (Detail) | Consistent? | Notes |
| --------------- | ------------------------- | ------------------------------------- | ----------- | ----- |
| Customer Name, Phone, Email | Present | Present | Yes | Correctly rendered |
| Service & Vehicle | Present | Present | Yes | Correctly rendered |
| Location & Coordinates | Present (Maps link) | Present (Coordinates + Maps link) | Yes | Authoritative DB state |
| Schedule & Confirmed Time | Present | Present | Yes | Includes `serviceConfirmedAt` |
| Tire Size & Notes | Present | Present | Yes | Customer message & admin notes |
| Booking Status | Present | Present | Yes | Consistent badge styling |
| Assigned Technician | Present | Present | Yes | Shows name, role, phone |
| Reassign Technician Control | Present | Present | Yes | Reassignment select element |
| Confirm & Cancel Buttons | Present | Present | Yes | Modal confirmation |
| **Arrival State (`arrivedAt`)** | **Present** (`Arrived On-Site`) | **MISSING** | **NO** | Detail page omits arrival badge |
| **Payment Status** | **Present** (`Paid`, `Quote Sent`) | **MISSING** | **NO** | Detail page omits payment state |
| **Quote Line Items / Extra Services** | **Present** (List + amounts) | **MISSING** | **NO** | Detail page omits extra services |
| **Total Amount** | **Present** (`$XXX.XX`) | **MISSING** | **NO** | Detail page omits total price |
| **Receipt / Invoice Link** | Modal view | **MISSING** | **NO** | No receipt view or download |
| **Start Service Action** | **Present** | **MISSING** | **NO** | Admin cannot start service from detail |
| **Complete & Quote Action** | **Present** | **MISSING** | **NO** | Admin cannot quote from detail |
| **Mark Paid Action** | **Present** | **MISSING** | **NO** | Admin cannot mark paid from detail |
| **Live GPS Telemetry Modal** | **Present** | **MISSING** | **NO** | Admin cannot view live GPS from detail |

---

## 6. Technician Assignment & Reassignment Audit

### Authority & Integrity
In [`app/actions/bookings/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts#L192-L258) (`assignTechnicianAction`):
1. **Authorization:** Requires active admin session via `requireAdminSession()`.
2. **Technician Validation:** Ensures `technician` exists and `technician.isActive === true`.
3. **Notification:** Triggers `sendCustomerTechnicianAssignedAlert`.

### Identified Flaws & Risks
1. **Silent Auto-Confirmation Side Effect:**
   Lines 218-220:
   ```typescript
   data: {
     technicianId,
     status: booking.status === "pending" ? "confirmed" : booking.status,
   }
   ```
   If a booking is `pending`, assigning a technician mutates the status to `confirmed`. However:
   - It **does not check slot capacity** (`checkSlotCapacity`).
   - It **does not set `serviceConfirmedAt: new Date()`**.
   - It **does not emit `sendCustomerBookingConfirmedAlert`** (customer only gets technician assigned alert, not booking confirmed alert).
2. **Missing State Guard (Terminal Invariance):**
   `assignTechnicianAction` does **not** check `booking.status`. An admin can execute assignment on `completed` or `cancelled` bookings, mutating `technicianId` on immutable terminal records.
3. **Duplicate Assignment Notification:**
   If an admin assigns the same technician repeatedly (`booking.technicianId === technicianId`), the action still runs the database update and sends a duplicate SMS alert.

---

## 7. Status Control Audit

Audit of all code paths capable of mutating booking status:

| Action / Route | Current Status Requirement | Technician Required? | Result Status | Notification Triggered | Authorization Enforced |
| -------------- | -------------------------- | -------------------- | ------------- | ---------------------- | ---------------------- |
| `confirmBookingAction` (`admin.ts`) | `pending` | No | `confirmed` | `sendCustomerBookingConfirmedAlert` | Admin Session (`requireAdminSession`) |
| `startServiceAction` (`admin.ts`) | `confirmed` | **Yes** (`technicianId` check) | `in_progress` | **None** | Admin Session (`requireAdminSession`) |
| `cancelBookingAction` (`admin.ts`) | `pending`, `confirmed`, `in_progress` | No | `cancelled` | `sendAdminBookingCancelledAlert` + `sendCustomerBookingCancelledAlert` | Admin Session (`requireAdminSession`) |
| `assignTechnicianAction` (`admin.ts`) | Any (Flaw: unvalidated) | Active technician required | Auto `confirmed` if `pending`; else unchanged | `sendCustomerTechnicianAssignedAlert` | Admin Session (`requireAdminSession`) |
| `completeAndQuoteAction` (`quote.ts`) | `in_progress` (or `completed` for quote edits) | No explicit check (inherited) | `completed` | `sendQuoteReadyNotification` | Admin Session (`requireAdminSession`) |
| `markBookingPaidAction` (`quote.ts`) | Any status (Flaw: unvalidated booking status) | No | Unchanged (`paymentStatus = paid`) | `sendCustomerPaymentReceivedAlert` | Admin Session (`requireAdminSession`) |
| `markTechnicianArrivedAction` (`technician.ts`) | `confirmed` | **Yes** (`technicianId` check) | `confirmed` (sets `arrivedAt`) | `sendCustomerTechnicianArrivedAlert` | Technician Dispatch Token or Admin Session |
| `startTechnicianTripAction` (`technician.ts`) | `confirmed`, `in_progress` | **Yes** (`technicianId` check) | Unchanged (milestone trigger) | `sendCustomerTechnicianEnRouteAlert` | Technician Dispatch Token or Admin Session |
| `cancelCustomerBookingAction` (`customer.ts`) | `pending` | No | `cancelled` | `sendAdminBookingCancelledAlert` + `sendCustomerBookingCancelledAlert` | Authenticated Customer Ownership |
| `PATCH /api/admin/bookings/[id]` | Validated via `validateBookingTransition` | Yes for `in_progress`; **No for `completed` (Flaw)** | Target `status` | `sendCustomerBookingConfirmedAlert` (if confirmed) or `sendStatusUpdate` | Admin Session (`verifyAdminSession`) |
| `PUT /api/bookings/[id]` | `pending` | No | `cancelled` (if requested) | **None (Flaw: Silent mutation)** | Customer Ownership |
| `DELETE /api/bookings/[id]` | `pending` | No | `cancelled` | **None (Flaw: Silent mutation)** | Customer Ownership |

---

## 8. Admin vs REST API Consistency

| Operation | Server Action Behavior | REST API Behavior | Match? | Risk Assessment |
| --------- | ---------------------- | ----------------- | ------ | --------------- |
| **Confirm Booking** | Enforces `pending` status. Updates `serviceConfirmedAt`. Sends confirmed SMS/email. **Omits capacity check.** | Enforces `pending` status. **Enforces slot capacity check.** Updates `serviceConfirmedAt`. Sends confirmed SMS/email. | **PARTIAL** | Server Action could confirm booking into an over-capacity slot if capacity check is bypassed. |
| **Start Service** | Enforces `confirmed`. Requires assigned technician. Transitions to `in_progress`. **Sends no SMS.** | Enforces `confirmed`. Requires assigned technician. Transitions to `in_progress`. **Dispatches `sendStatusUpdate`.** | **PARTIAL** | Notification disparity: REST API notifies customer and technician; Server Action executes silently. |
| **Complete Service** | Validates quote line items. Calculates `totalAmount`. Preserves `paid` if settled. Generates PDF invoice. Sends `quote_ready` SMS/email. | `PATCH /api/admin/bookings/[id]` accepts `status: "completed"`. **Zero quote validation, zero PDF generation, zero total calculation, leaves paymentStatus as pending.** | **NO** | **High Operational Risk:** An external API call or script calling PATCH with `completed` bypasses the entire invoicing and payment workflow. |
| **Customer Cancellation** | Enforces `pending`. Sets status `cancelled`. Dispatches **both** admin and customer SMS alerts. | `DELETE /api/bookings/[id]` and `PUT /api/bookings/[id]` set status `cancelled`. **Dispatches zero notifications.** | **NO** | **Medium Operational Risk:** Customer cancellations via API endpoints leave technicians and central dispatch uninformed. |
| **Admin Cancellation** | Enforces `pending`/`confirmed`/`in_progress`. Appends reason to `notes`. Dispatches dedicated `BOOKING_CANCELLED` alerts to Admin and Customer. | Enforces state machine. Dispatches generic `sendStatusUpdate`. Does not record cancellation reason in `notes`. | **PARTIAL** | Minor disparity in notes and notification payload formatting. |

---

## 9. Technician Information Privacy Audit

### 1. `GET /api/bookings/[id]` (Customer Single Booking Detail)
- Sanitized in Phase 6F: `tracking.technician.phone = null` and `booking.technician.phone = null`.
- **Verdict: SECURE.**

### 2. `GET /api/bookings` (Customer Booking List)
- In [`app/api/bookings/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/route.ts#L294-L316):
  ```typescript
  include: {
    service: true,
    reviews: true,
    technician: true,
    technicianLocation: true,
  }
  ```
  `delete safeB.technicianLocation` is executed, but `technician.phone` is **not sanitized**.
- Any authenticated customer viewing their bookings list receives the unmasked personal phone numbers of all technicians ever assigned to their jobs.
- **Verdict: VULNERABILITY (HIGH).**

### 3. `GET /api/technician/location`
- Returns `booking.technician.phone || BUSINESS_PHONE_RAW`.
- Protected by strict dispatch token / technician key / admin session guard. Inaccessible to customers.
- **Verdict: SECURE.**

### 4. Live Van Tracker Customer UI
- Verified: All `tel:` links point strictly to `businessPhone` (`BUSINESS_PHONE_RAW`).
- **Verdict: SECURE.**

---

## 10. Business Phone Consistency

Detailed findings answering the 6 mandatory questions:

1. **What is the configured business phone?**
   - Defined in [`lib/constants/phone.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/constants/phone.ts):
     - `BUSINESS_PHONE_RAW` = `process.env.NEXT_PUBLIC_BUSINESS_PHONE || "+18005558473"`
     - `BUSINESS_PHONE_DISPLAY` = `process.env.NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY || "(800) 555-TIRE (8473)"`
2. **What is the configured dispatch/admin phone?**
   - Resolved dynamically via [`lib/notifications/recipients.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications/recipients.ts) (`resolveAdminNotificationPhone()`):
     - Hierarchy: `ADMIN_NOTIFICATION_PHONE` -> `DISPATCH_PHONE_NUMBER` -> `TECHNICIAN_PHONE_NUMBER`.
     - In `.env.local`: `TECHNICIAN_PHONE_NUMBER="+916283022286"`.
3. **What phone does customer UI display?**
   - Consistently displays `BUSINESS_PHONE_DISPLAY` (`(800) 555-TIRE (8473)`).
4. **What phone does customer SMS display?**
   - Consistently uses `BUSINESS_PHONE_DISPLAY` in all message templates.
5. **What phone does LiveVanTracker use?**
   - Dial links: `href="tel:${businessPhone}"` where `businessPhone = BUSINESS_PHONE_RAW` (`+18005558473`).
   - Button labels: `Call Dispatch: (800) 555-TIRE (8473)`.
6. **Are any hard-coded fallback numbers inconsistent with configuration?**
   - In [`app/layout.tsx:16`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/layout.tsx#L16): An inlined fallback exists: `const businessPhone = process.env.NEXT_PUBLIC_BUSINESS_PHONE || "+18005558473";` (consistent with `lib/constants/phone.ts`, but duplicates constant definition).
   - In [`lib/notifications.ts:41-44`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L41-L44): An unused legacy constant falls back to `BUSINESS_PHONE_RAW`. This is dead code because active dispatches use `resolveAdminNotificationPhone()`, but it should be cleaned up.

---

## 11. Admin Access & Authorization Audit

1. **Server-Side Enforcement:**
   - All admin server actions call `requireAdminSession()`. Unauthenticated requests immediately throw or return `{ success: false, error: "Unauthorized" }`.
   - `GET /api/admin/bookings` and `PATCH /api/admin/bookings/[id]` call `verifyAdminSession(token)` from the cookie jar.
2. **Direct URL Route Protection:**
   - Navigating directly to `/admin/bookings` or `/admin/bookings/[id]` invokes `requireAdminSession()` during server component rendering, redirecting unauthenticated users to `/admin/login`.
3. **Customer Isolation:**
   - Customer accounts and public tokens cannot invoke admin actions or admin REST endpoints.
4. **Permissive Payment Marking:**
   - `markBookingPaidAction` is properly restricted to admins, but does not enforce that `booking.status === "completed"`.

---

## 12. Race Conditions & Concurrency Audit

1. **Double Confirm:** Handled safely. State machine marks identical transitions as `isNoop: true`, bypassing redundant DB updates and notifications.
2. **Double Start Service:** Handled safely via `isNoop: true`.
3. **Double Mark Paid:** Handled safely via `isNoop: true`.
4. **Double Assign:** **Unsafe.** Assigning technician X when technician X is already assigned executes `prisma.booking.update` and dispatches `sendCustomerTechnicianAssignedAlert` again.
5. **Concurrent Admin Actions:**
   - `PATCH /api/admin/bookings/[id]` wraps execution in `prisma.$transaction` with capacity verification.
   - Server Actions in `app/actions/bookings/admin.ts` execute atomic individual Prisma calls (`update`), but read-then-write sequences are not wrapped in transactions or advisory locks. Under simultaneous clicks by two administrators (e.g., one confirming while another cancels), the second transaction sees the updated status and fails gracefully via state machine transition validation.

---

## 13. Terminal Bookings Audit (`completed`, `cancelled`)

1. **Immutability:**
   - Both `completed` and `cancelled` states are strictly enforced as terminal in `lib/bookings/state-machine.ts`.
   - Attempting to transition to any other status yields:
     - `completed`: `"Cannot modify a completed booking. Completed records are permanent and immutable."`
     - `cancelled`: `"Cannot modify a cancelled booking. Cancelled records cannot be reactivated."`
2. **Quote Editing Exception:**
   - `completeAndQuoteAction` permits quote editing on `completed` bookings via `validateBookingTransition("completed", "completed")` which evaluates to `{ allowed: true, isNoop: true }`.
   - `booking.paymentStatus === "paid"` is preserved; it is never reverted to `quote_sent`.
3. **Technician Re-assignment Hole:**
   - `assignTechnicianAction` does **not** check whether `booking.status === "completed"` or `"cancelled"`. Admins can overwrite `technicianId` on historical records.

---

## 14. Direct Database Mutation Audit

All database mutations modifying `Booking.status`, `technicianId`, or `paymentStatus`:

1. `app/actions/bookings/admin.ts:38` (`confirmBookingAction`) -> Enforces transition, sets `serviceConfirmedAt`, notifies customer.
2. `app/actions/bookings/admin.ts:108` (`startServiceAction`) -> Enforces transition & assigned tech, transitions to `in_progress`.
3. `app/actions/bookings/admin.ts:147` (`cancelBookingAction`) -> Enforces transition, appends reason, notifies admin & customer.
4. `app/actions/bookings/admin.ts:215` (`assignTechnicianAction`) -> **Direct mutation.** Auto-confirms pending booking without capacity check or `serviceConfirmedAt`. Allows assignment on completed/cancelled bookings.
5. `app/actions/bookings/quote.ts:54` (`completeAndQuoteAction`) -> Enforces transition, calculates total, preserves payment status, generates PDF.
6. `app/actions/bookings/quote.ts:142` (`markBookingPaidAction`) -> Enforces payment transition, updates `paymentStatus: "paid"`.
7. `app/actions/bookings/technician.ts:132` (`markTechnicianArrivedAction`) -> Enforces `confirmed`, updates `arrivedAt`.
8. `app/actions/bookings/customer.ts:296` (`cancelCustomerBookingAction`) -> Enforces customer ownership & transition, notifies admin & customer.
9. `app/api/admin/bookings/[id]/route.ts:97` (`PATCH`) -> Atomic transaction. **Allows setting `status: completed` without quote/invoice pipeline.**
10. `app/api/bookings/[id]/route.ts:228` (`PUT`) -> **Direct mutation to `cancelled` without notification.**
11. `app/api/bookings/[id]/route.ts:298` (`DELETE`) -> **Direct mutation to `cancelled` without notification.**

---

## 15. Notification Trigger Duplication Audit

| Canonical Event | Authoritative Trigger | Secondary / Duplicate Triggers | Identity / Deduplication Key | Post-Commit Enforced? | Failure Isolation? |
| --------------- | --------------------- | ------------------------------ | ---------------------------- | --------------------- | ------------------ |
| `BOOKING_CREATED` | `createBookingRequestAction` | `POST /api/bookings` | `BOOKING_CREATED:${bookingId}:${recipient}` | Yes | Non-blocking try/catch |
| `BOOKING_CONFIRMED` | `confirmBookingAction` | `PATCH /api/admin/bookings/[id]` | `BOOKING_CONFIRMED:${bookingId}:${recipient}` | Yes | Non-blocking try/catch |
| `TECHNICIAN_ASSIGNED` | `assignTechnicianAction` | None | `TECHNICIAN_ASSIGNED:${bookingId}:${techId}` | Yes | **Missing idempotency check in action** |
| `TECHNICIAN_EN_ROUTE` | `startTechnicianTripAction` | None | `TECHNICIAN_EN_ROUTE:${bookingId}` | Yes | Non-blocking try/catch |
| `TECHNICIAN_ARRIVED` | `markTechnicianArrivedAction`| None | `TECHNICIAN_ARRIVED:${bookingId}` | Yes | Non-blocking try/catch |
| `SERVICE_COMPLETED` | `completeAndQuoteAction` | `PATCH /api/admin/bookings/[id]` (sends generic update) | `SERVICE_COMPLETED:${bookingId}` | Yes | Non-blocking try/catch |
| `PAYMENT_RECEIVED` | `markBookingPaidAction` | None | `PAYMENT_RECEIVED:${bookingId}` | Yes | Non-blocking try/catch |
| `BOOKING_CANCELLED` | `cancelBookingAction` & `cancelCustomerBookingAction` | `DELETE` / `PUT /api/bookings/[id]` (sends nothing) | `BOOKING_CANCELLED:${bookingId}:${recipient}` | Yes | Non-blocking try/catch |
| `EMERGENCY_REQUEST_CREATED` | `POST /api/emergency-requests` | None | `EMERGENCY_REQUEST_CREATED:${id}` | Yes | Non-blocking try/catch |
| `CONTACT_REQUEST_CREATED` | `POST /api/contact-messages` | None | `CONTACT_REQUEST_CREATED:${id}` | Yes | Non-blocking try/catch |

---

## 16. Consolidated Findings Table

| ID | Severity | Area | File | Finding | Evidence | Recommended Next Phase |
| -- | -------- | ---- | ---- | ------- | -------- | ---------------------- |
| **G-01** | **HIGH** | Privacy | [`app/api/bookings/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/route.ts#L294-L316) | Customer bookings list API exposes `technician.phone` unmasked | `include: { technician: true }` without sanitizing `safeB.technician.phone` to `null` | Phase 6H |
| **G-02** | **HIGH** | Admin Detail UI | [`app/(admin-portal)/admin/bookings/[bookingId]/page.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/%28admin-portal%29/admin/bookings/%5BbookingId%5D/page.tsx) | Detail page missing payment, quote, arrival, receipt, and service execution controls | Compare table view vs detail view: detail view lacks payment status, total amount, extra services, quote actions, receipt links, and arrived indicator | Phase 6H |
| **G-03** | **HIGH** | State Machine & Dispatch | [`app/actions/bookings/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts#L215-L225) | `assignTechnicianAction` auto-confirms pending bookings without capacity validation or `serviceConfirmedAt`, and allows assignment on terminal bookings | `status: booking.status === "pending" ? "confirmed" : booking.status` without calling `checkSlotCapacity` or checking if status is terminal | Phase 6H |
| **G-04** | **HIGH** | Lifecycle & API Parity | [`app/api/admin/bookings/[id]/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/admin/bookings/%5Bid%5D/route.ts#L97-L115) | `PATCH` endpoint allows transition to `completed` while bypassing quote, invoice PDF, total amount calculation, and payment status setup | `status: "completed"` allowed by `validateBookingTransition`, but route does not compute pricing or invoke `generateQuotePdf` | Phase 6H |
| **G-05** | **MEDIUM** | Notifications & API Parity | [`app/api/bookings/[id]/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/%5Bid%5D/route.ts#L239-L306) | `DELETE` and `PUT` customer endpoints cancel bookings silently without dispatching cancellation SMS | Direct `prisma.booking.update({ data: { status: "cancelled" } })` with zero notification calls | Phase 6H |
| **G-06** | **MEDIUM** | Operational Visibility | [`app/(admin-portal)/admin/notifications/page.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/%28admin-portal%29/admin/notifications/page.tsx#L160-L337) | Notification logs display `SENT` status as `"✓ Delivered"`, conflating SMSC acceptance with carrier handset receipt | `{isSent ? "✓ Delivered" : ...}` and stat card `"Successfully Delivered"` ignores separate `deliveryStatus` column | Phase 6H |
| **G-07** | **LOW** | Payment State Machine | [`app/actions/bookings/quote.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/quote.ts#L114-L148) | `markBookingPaidAction` does not verify that booking status is `completed` | Only checks `validatePaymentTransition(booking.paymentStatus, "paid")`; could mark un-serviced booking paid | Phase 6H |

---

## 17. Regression Verification Results

### 1. Test Suite Execution (`node tests/run-all.mjs`)
- **Total Tests:** 320
- **Passed:** 320
- **Failed:** 0
- **Suites:** 16/16 Passed

### 2. TypeScript Compilation (`npx tsc --noEmit`)
- **Exit Code:** 0
- **Errors:** 0

### 3. Production Turbopack Build (`npm run build`)
- **Exit Code:** 0
- **Compilation Time:** 4.6s
- **TypeScript Time:** 5.8s
- **Static Pages Generated:** 67/67 in 2.4s

---

## 18. Recommended Next Phase (Phase 6H)

Phase 6H should execute targeted implementations for the findings identified above:
1. **Fix G-01:** Sanitize `technician.phone = null` in `GET /api/bookings` (`app/api/bookings/route.ts`).
2. **Fix G-02:** Upgrade `/admin/bookings/[bookingId]` to render payment badges, total amount, extra services, arrival pill, receipt link, and lifecycle action controls (Start Service, Complete & Quote, Mark Paid, Live GPS).
3. **Fix G-03:** Refactor `assignTechnicianAction`:
   - Prevent assignment on `completed` and `cancelled` bookings.
   - Prevent redundant notifications when reassigning the exact same technician.
   - If auto-confirming pending bookings, enforce capacity check and populate `serviceConfirmedAt`.
4. **Fix G-04:** Guard `PATCH /api/admin/bookings/[id]` against direct transitions to `completed` (mandating use of `completeAndQuoteAction`).
5. **Fix G-05:** Wire cancellation SMS alerts into `DELETE` and `PUT` in `app/api/bookings/[id]/route.ts`.
6. **Fix G-06:** Correct `/admin/notifications/page.tsx` UI labels to distinguish `SENT` (Dispatched to SMSC) from `DELIVERED` (Handset Confirmed via Webhook).
7. **Fix G-07:** Require `booking.status === "completed"` in `markBookingPaidAction`.

---

## PHASE 6G STATUS: PASS WITH ACTIONABLE FINDINGS
