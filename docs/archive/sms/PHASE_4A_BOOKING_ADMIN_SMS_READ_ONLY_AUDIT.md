# PHASE 4A — BOOKING TO ADMIN SMS WORKFLOW
# STRICT READ-ONLY AUDIT REPORT

**Project:** HT Mobile Services / Tire Mobile Clinic  
**Codebase:** `tire-mobile-clinic-next`  
**Phase:** 4A (Booking to Admin SMS Workflow — Read-Only Audit)  
**Execution Timestamp:** 2026-09-23T20:41:00+05:30  
**Environment:** Next.js 16.3.1 (Turbopack), Node.js v24.18.1, TypeScript 5.9.3, Prisma 6.4.1  
**Mode:** STRICT READ-ONLY AUDIT (Zero file edits, zero database mutations, zero real SMS sent)

---

## 1. Executive Summary

This audit assesses the end-to-end operational lifecycle from Customer Booking submission through Admin SMS alert, Admin Review, Confirmation/Rejection, and Customer Confirmation SMS dispatch:

$$\text{Customer Booking} \xrightarrow{} \text{PENDING} \xrightarrow{} \text{Admin Real SMS} \xrightarrow{} \text{Admin Portal} \xrightarrow{} \text{Confirm/Reject} \xrightarrow{} \text{CONFIRMED} \xrightarrow{} \text{Customer SMS}$$

### Key Findings Summary:
1. **Authoritative Flow Operational:** The customer booking form (`BookingFormClient.tsx`) successfully creates bookings with initial status `pending` and immediately triggers the `BOOKING_CREATED` admin notification via the real Android SMS Gateway (`https://api.sms-gate.app`).
2. **Real Gateway Active:** The production-grade `AndroidGatewayProvider` backed by `TokenManager` with automated token refresh is active in the environment (`SMS_GATEWAY_URL` configured). `SimulatedSmsProvider` is **not** active.
3. **Admin SMS Link Missing (Critical Gap):** The `BOOKING_CREATED` SMS template (`buildAdminNewBookingSms`) provides customer details, service, address, and Google Maps navigation, but **lacks any link** for the admin to directly review or confirm the booking.
4. **No Single-Booking Admin View Page:** The admin portal features a comprehensive list management interface at `/admin/bookings`, but lacks a dedicated single-booking route (e.g. `/admin/bookings/[bookingId]`).
5. **No Stateless Admin Action Token:** All admin actions (`confirmBookingAction`, `cancelBookingAction`, `assignTechnicianAction`) strictly require an authenticated browser session (`admin_session` cookie validated in PostgreSQL `admin_sessions`). Unauthorized or unauthenticated access is strictly blocked by middleware and server-side guards.
6. **Customer Booking Form Omits Date & Time Pickers:** `BookingFormClient.tsx` collects contact details, vehicle, service, and GPS/autocomplete location, but contains **no UI fields for preferred date or time**, defaulting bookings to today's date and the current submission timestamp.
7. **Coordinate Dropping in Server Action:** `createBookingRequestAction` successfully persists `latitude` and `longitude` in the `Booking` database table, but **omits them when constructing the notification payload**, causing the admin SMS navigation link to fall back to a generic textual address search rather than an exact GPS coordinate pin.
8. **Confirmation Flow Fully Operational:** When an admin confirms a booking via `/admin/bookings`, `confirmBookingAction` transitions status to `confirmed` and dispatches `BOOKING_CONFIRMED` SMS to the customer via `buildBookingConfirmedSms` with strict technician privacy preservation.

---

## 2. Current Booking Flow Architecture

```
[CUSTOMER]
   │
   ▼
[app/booking/BookingFormClient.tsx]
   │ (Form submission: Name, Phone, Email, Service, Vehicle, Location, GPS lat/lng, Notes)
   ▼
[app/actions/bookings/customer.ts : createBookingRequestAction()]
   │
   ├─► 1. Resolve / Create Customer Profile (PostgreSQL `customers`)
   ├─► 2. Slot Capacity Guard (`checkSlotCapacity`)
   ├─► 3. ACID Insert: `prisma.booking.create()` (Status: PENDING, paymentStatus: PENDING)
   │
   ▼ (Post-Commit Non-Blocking Trigger)
[lib/notifications.ts : sendBookingConfirmation()]
   │
   ├─► resolveAdminNotificationPhone() -> `+916283022286`
   ├─► hasExistingNotification() -> Duplicate check for `booking_created_admin:<id>`
   ├─► buildAdminNewBookingSms() -> Template formatting
   ├─► dispatchSms() -> getSmsProvider() -> AndroidGatewayProvider
   ├─► TokenManager -> Fetch valid token from `sms_gateway_tokens`
   └─► POST https://api.sms-gate.app/3rdparty/v1/messages (Sim Slot 0)
         │
         ▼
[NotificationLog created] (status: "SENT", type: "BOOKING_CREATED", channel: "sms")
         │
         ▼
[ADMIN RECEIVES REAL SMS]
   │
   ├─► Contains: Customer, Phone, Service, Vehicle, Time, Address, Nav (Google Maps), Ref #
   └─► GAP: No review/action link in SMS body
         │
         ▼
[ADMIN OPENS ADMIN PORTAL] (/admin/bookings)
   │
   ├─► Middleware & Server Guard: Checks `admin_session` cookie against `admin_sessions` DB
   ├─► Renders table / cards with full customer & booking details
   │
   ▼
[ADMIN ACTION: CONFIRM / REJECT / ASSIGN]
   │
   ▼
[app/actions/bookings/admin.ts : confirmBookingAction()]
   │
   ├─► 1. Verify requireAdminSession()
   ├─► 2. Validate validateBookingTransition("pending" -> "confirmed")
   ├─► 3. Database Update: `prisma.booking.update()` (status = "confirmed", serviceConfirmedAt = now)
   │
   ▼ (Post-Commit Non-Blocking Trigger)
[lib/notifications.ts : sendCustomerBookingConfirmedAlert()]
   │
   ├─► resolveCustomerNotificationPhone(booking.customer)
   ├─► hasExistingNotification() -> Duplicate check for `booking_confirmation:<id>`
   ├─► buildBookingConfirmedSms() -> Customer template
   ├─► AndroidGatewayProvider -> Real SMS Gateway
   └─► NotificationLog created (status: "SENT", type: "BOOKING_CONFIRMED")
         │
         ▼
[CUSTOMER RECEIVES CONFIRMATION SMS]
```

---

## 3. Customer Booking Form Audit (`AUDIT 1`)

File Inspected: [`app/booking/BookingFormClient.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/booking/BookingFormClient.tsx)  
Server Action: [`app/actions/bookings/customer.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/customer.ts)  
Prisma Model: `Booking` & `Customer` in [`prisma/schema.prisma`](file:///d:/Tire-Services/tire-mobile-clinic-next/prisma/schema.prisma)

### Detailed Field-by-Field Matrix

| Field | UI Location | Client Validation | Backend Field | Database Column | Persisted Correctly? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Customer Name** | `BookingFormClient.tsx:266-281`<br>`<input id="name">` | HTML5 `required`, trimmed on submit | `formData.name` | `Customer.name`<br>(`customers.name`) | **YES** |
| **Phone** | `BookingFormClient.tsx:283-299`<br>`<input id="phone" type="tel">` | HTML5 `required`, trimmed on submit | `formData.phone` | `Customer.phone`<br>(`customers.phone`) | **YES** |
| **Email** | `BookingFormClient.tsx:301-316`<br>`<input id="email" type="email">` | Optional HTML5 `type="email"` | `formData.email` | `Customer.email`<br>(`customers.email`) | **YES** |
| **Service** | `BookingFormClient.tsx:321-352`<br>Button selector + `<input name="service" type="hidden">` | Matched against `SERVICE_NAMES`, default fallback | `formData.service` | `Booking.primaryService`<br>(`bookings.primary_service`) | **YES** |
| **Vehicle** | `BookingFormClient.tsx:358-379`<br>`<input id="vehicle">` | HTML5 `required`, trimmed on submit | `formData.vehicle` | `Booking.vehicle`<br>(`bookings.vehicle`) | **YES** |
| **Location** | `BookingFormClient.tsx:383-421`<br>`AddressAutocomplete` (`id="location-address"`) | Explicit check: `if (!locationAddress.trim())` | `formData.location` | `Booking.location`<br>(`bookings.location`) | **YES** |
| **Latitude** | Captured via `GpsLocationButton` or `AddressAutocomplete` | Checked for `typeof lat === "number"` | `formData.latitude` | `Booking.latitude`<br>(`bookings.latitude`) | **YES (DB)**<br>*(Dropped in notif payload)* |
| **Longitude** | Captured via `GpsLocationButton` or `AddressAutocomplete` | Checked for `typeof lng === "number"` | `formData.longitude` | `Booking.longitude`<br>(`bookings.longitude`) | **YES (DB)**<br>*(Dropped in notif payload)* |
| **Google Maps Link** | **NOT** collected on UI | Derived dynamically via `buildGoogleMapsUrl` | Derived dynamically on server | **None** (Computed dynamically) | **COMPUTED**<br>*(Falls back to query string)* |
| **Preferred Date** | **MISSING FROM UI**<br>No date picker or calendar exists | None (Not present in DOM) | `formData.scheduledDate` or `bookingDate` | `Booking.bookingDate`<br>(`bookings.booking_date`) | **CAVEAT:** Defaults to server's today date (`new Date().toISOString().split("T")[0]`) |
| **Preferred Time** | **MISSING FROM UI**<br>No time picker or slot picker exists | None (Not present in DOM) | `formData.scheduledTime` or `bookingTime` | `Booking.bookingTime`<br>(`bookings.booking_time`) | **CAVEAT:** Defaults to server submission timestamp (`now`) |
| **Additional Message** | `BookingFormClient.tsx:424-441`<br>`<textarea id="message">` | Optional | `formData.message` | `Booking.message`<br>(`bookings.message`) | **YES** |

### Additional Form Field:
- **Tire Size:** `BookingFormClient.tsx:355` (`TireSizeSelector`), passed as `formData.tireSize` and persisted in `Booking.tireSize` (`bookings.tire_size`).

---

## 4. Booking Creation Trace (`AUDIT 2`)

### 1. Authoritative vs. Secondary Paths
- **Authoritative UI Path:** `createBookingRequestAction(formData)` in [`app/actions/bookings/customer.ts:15`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/customer.ts#L15) (re-exported via [`app/actions/bookings.ts:15`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings.ts#L15)).
- **Secondary REST API Path:** `POST /api/bookings` in [`app/api/bookings/route.ts:11`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/route.ts#L11) (used for programmatic API clients and automated tests).

### 2. Execution Trace in Authoritative Server Action
1. **User Identity:** Reads session via `createClient().auth.getUser()`. If authenticated, calls `getOrCreateCustomerForUser(user)`. If unauthenticated (guest booking), looks up existing `Customer` by phone or email, or creates a new `Customer` record via `prisma.customer.create`.
2. **Date / Time Normalization:**
   ```typescript
   const scheduledDateStr = formData.scheduledDate || formData.bookingDate || new Date().toISOString().split("T")[0];
   const scheduledTimeStr = formData.scheduledTime || formData.bookingTime || "09:00 AM";
   const now = new Date();
   const [year, month, day] = scheduledDateStr.split("-").map(Number);
   const bookingDateObj = new Date(Date.UTC(year || now.getFullYear(), (month || 1) - 1, day || now.getDate()));
   ```
3. **Capacity Validation:** Calls `checkSlotCapacity(prisma, { bookingDate: bookingDateObj, bookingTime: scheduledTimeStr })`. Rejects with error if slot is over capacity.
4. **Database Insertion:** Inserts record via `prisma.booking.create({ data: { ... } })`.
5. **Initial Status:** Sets `status: "pending"` and `paymentStatus: "pending"`.
6. **Notification Trigger:** Executes immediately post-insert inside a try/catch:
   ```typescript
   try {
     await sendBookingConfirmation({
       id: booking.id,
       status: "pending",
       bookingDate: bookingDateObj,
       bookingTime: now,
       location: locStr,
       vehicle: vehicleStr,
       customer: { name: formData.name, phone: formData.phone, email: formData.email },
       service: { name: primaryService },
     });
   } catch (notifErr) {
     console.warn("Failed to dispatch booking notification:", notifErr);
   }
   ```
7. **Cache Invalidation:** Calls `revalidatePath("/account")` and `revalidatePath("/admin/bookings")`.
8. **Client Redirect:** Returns `{ success: true, bookingId: booking.id }`. `BookingFormClient.tsx:182` routes to `/booking/confirmed?booking_id=${result.bookingId}`.

### 3. Transaction Boundaries & Error Handling
- **Persistence Priority:** The booking record is committed to PostgreSQL **before** any SMS dispatch begins.
- **Fault Isolation:** SMS gateway timeout, invalid token, or SIM failure cannot roll back the booking.
- **Transaction Scope:** `createBookingRequestAction` uses individual Prisma queries rather than a multi-table interactive `$transaction`. If customer creation succeeds but booking creation fails, the customer profile persists.

### 4. Duplicate Booking Prevention
- **Client Guard:** `BookingFormClient.tsx` sets `loading = true` and disables `<button disabled={loading}>`.
- **Server Guard Defect:** There is **no database unique constraint** on `(customerId, bookingDate, bookingTime)` or client-side idempotency token in `createBookingRequestAction`. A double submit or parallel network request can create duplicate booking rows.

### 5. Divergence Between UI and REST API Paths
| Feature | Authoritative UI Server Action | Secondary REST API (`POST /api/bookings`) |
| :--- | :--- | :--- |
| **Authentication** | Allows guest bookings (no login required) | Requires Supabase user (`401` if guest) |
| **Validation** | Ad-hoc runtime parameter checks | Formal Zod schema (`bookingSchema.safeParse`) |
| **Coordinates** | Accepts & persists `latitude` / `longitude` | Ignores/omits `latitude` / `longitude` |
| **Tire Size** | Persists `tireSize` | Does not persist `tireSize` |
| **Transaction** | Sequential Prisma calls | Atomic `prisma.$transaction` block |

---

## 5. BOOKING_CREATED Admin SMS Trace (`AUDIT 3`)

### 1. Notification Dispatch Pipeline
```
BOOKING_CREATED Trigger (`sendBookingConfirmation`)
        │
        ├─► Recipient: resolveAdminNotificationPhone() (`lib/notifications/recipients.ts`)
        │     1. process.env.ADMIN_NOTIFICATION_PHONE (unset)
        │     2. process.env.DISPATCH_PHONE_NUMBER (unset)
        │     3. process.env.TECHNICIAN_PHONE_NUMBER = "+916283022286"
        │     Resolved: "+916283022286"
        │
        ├─► Deduplication: hasExistingNotification() (`lib/notifications.ts:372`)
        │     Checks NotificationLog: type="BOOKING_CREATED", channel="sms", entityId=booking.id
        │
        ├─► Template: buildAdminNewBookingSms() (`lib/sms/templates.ts:78`)
        │
        ├─► SMS Gateway Dispatcher: dispatchSms() (`lib/sms/index.ts:95`)
        │     getSmsProvider() -> resolves AndroidGatewayProvider
        │
        ├─► Token Resolution: TokenManager (`lib/sms/token-manager.ts`)
        │     SELECT access_token FROM sms_gateway_tokens WHERE id = 'active' FOR UPDATE
        │     Refreshes proactively if within 60s of expiry
        │
        ├─► Network Request: AndroidGatewayProvider (`lib/sms/providers/android-gateway.ts`)
        │     POST https://api.sms-gate.app/3rdparty/v1/messages
        │     Headers: Authorization: Bearer <JWT>, X-Idempotency-Key: sms_BOOKING_CREATED_<id>
        │     Body: { phoneNumbers: ["+916283022286"], message: "...", simNumber: 0 }
        │
        └─► Audit Persistence: logNotification() (`lib/notifications.ts:302`)
              INSERT INTO notification_logs (booking_id, type="BOOKING_CREATED", status="SENT", ...)
```

### 2. Provider Verification
- **Configured Gateway URL:** `https://api.sms-gate.app` (in `.env.local:30`).
- **Active Provider:** `AndroidGatewayProvider`.
- **Simulated Provider Status:** Inactive (`SimulatedSmsProvider` is only selected when `SMS_GATEWAY_URL` is empty in development).

### 3. SMS Message Content Audit
Inspected template: `buildAdminNewBookingSms` in [`lib/sms/templates.ts:78`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/templates.ts#L78)

```typescript
export function buildAdminNewBookingSms(data: AdminNewBookingTemplateData): string {
  const lines = [
    "[NEW BOOKING - HT MOBILE]",
    `Customer: ${sanitizeInline(data.customerName, 40)} (${sanitizeInline(data.customerPhone, 30)})`,
    `Service: ${sanitizeInline(data.service, 40)} (${sanitizeInline(data.vehicle, 30)})`,
    `Time: ${sanitizeInline(data.date, 25)} at ${sanitizeInline(data.time, 25)}`,
    `Address: ${sanitizeInline(data.address, 70)}`,
    `Nav: ${sanitizeInline(data.mapsUrl)}`,
    `Ref: #${sanitizeInline(data.shortBookingId, 15).toUpperCase()}`,
  ];

  const notes = sanitizeMultiLine(data.notes, 100);
  if (notes) {
    lines.push(`Notes: "${notes}"`);
  }

  return lines.join("\n");
}
```

| Element | Status | Actual Content / Format |
| :--- | :--- | :--- |
| **New Booking Request Header** | **PASS** | `[NEW BOOKING - HT MOBILE]` |
| **Customer Name** | **PASS** | `Customer: <name>` (sanitized inline, max 40 chars) |
| **Customer Phone** | **PASS** | `(<phone>)` (sanitized inline, max 30 chars) |
| **Service** | **PASS** | `Service: <service>` (sanitized inline, max 40 chars) |
| **Vehicle** | **PASS** | `(<vehicle>)` (sanitized inline, max 30 chars) |
| **Preferred Date / Time** | **PASS WITH CAVEAT** | `Time: <date> at <time>` *(date/time defaulted to today/now)* |
| **Location** | **PASS** | `Address: <address>` (sanitized inline, max 70 chars) |
| **Google Maps Link** | **PASS WITH CAVEAT** | `Nav: <mapsUrl>` *(falls back to address text query because `latitude`/`longitude` were dropped in `createBookingRequestAction`)* |
| **Reference Number** | **PASS** | `Ref: #<shortBookingId>` (6-char uppercase hex) |
| **Notes / Message** | **PASS** | `Notes: "<notes>"` (sanitized multi-line, max 100 chars) |
| **Secure Admin Booking Link** | **GAP** | **NOT PRESENT**. The template contains no URL link to review, view, or confirm the booking. |

---

## 6. Admin SMS Link Security Analysis (`AUDIT 4`)

### 1. Existing Admin Authentication Architecture
The current application enforces **session-based authentication** for the administrator portal:
- **Admin Session Model:** Stored in PostgreSQL `admin_sessions` table (`id`, `token` (64-char hex), `expires_at`, `created_at`).
- **Session Cookie:** Cookie name `admin_session`. Format: `<rawToken>.<expiresAtMs>.<signature>` signed via HMAC-SHA256 using server-only secret (`ADMIN_PASSWORD_HASH` or `ADMIN_EMAIL`).
- **Edge Middleware (`middleware.ts:12-26`):**
  - Intercepts all requests matching `/admin/*`.
  - Excludes `/admin/login`.
  - Validates cookie structure, HMAC-SHA256 signature, and expiration timestamp at edge via `validateAdminCookieEdge`.
  - If cookie is invalid or missing, **immediately redirects to `/admin/login`**.
- **Server Guard (`lib/admin-auth.ts:232`):**
  - `requireAdminSession()` verifies the session token against PostgreSQL `admin_sessions`. If expired or absent, redirects to `/admin/login`.
- **Server Actions Authorization:**
  - `confirmBookingAction(bookingId)` calls `await requireAdminSession()`.
  - `cancelBookingAction(bookingId, reason)` calls `await requireAdminSession()`.
  - `assignTechnicianAction(bookingId, technicianId)` calls `await requireAdminSession()`.
  - `startServiceAction(bookingId)` calls `await requireAdminSession()`.
  If the session is missing or invalid, every Server Action returns `{ success: false, error: "Unauthorized. Admin session required." }`.
- **Booking ID Alone Cannot Authorize:** Knowing or guessing a `bookingId` grants zero ability to view, confirm, reject, or assign technicians. All mutations are strictly authorized server-side.

### 2. What Happens If Admin Clicks an SMS Link Today?
1. **Current State:** No link exists in the SMS body (only Google Maps navigation).
2. **If a standard link to `/admin/bookings` is clicked:**
   - If the admin has an active session cookie in their mobile browser: The page opens directly to `/admin/bookings`.
   - If the admin has no active session cookie: Middleware intercepts the request and redirects to `/admin/login`.
3. **If a deep link to `/admin/bookings/[bookingId]` is clicked:**
   - **404 Not Found:** There is currently **no route handler or page** at `/admin/bookings/[id]` or `/admin/bookings/[bookingId]`. The route does not exist.

### 3. Action Token Mechanism Comparison
- **Technician Dispatch:** Implements a dedicated HMAC-SHA256 signed action token via `createTechnicianDispatchToken({ technicianId, bookingId })` in `lib/technician-auth.ts`. Technicians access `/technician?token=...` or `/technician/tracking/[bookingId]?token=...` without logging in with credentials.
- **Admin Workflow:** Does **NOT** have an action token system. Admins must maintain an active cookie session.
- **Security Assessment:**
  - Requiring admin login is secure and prevents unauthorized confirmation via forwarded SMS.
  - However, lacking a dedicated deep-linkable booking view or signed action token forces the admin to log in and manually search the general bookings table.

---

## 7. Admin Booking Page Audit (`AUDIT 5`)

File Inspected: [`app/(admin-portal)/admin/bookings/page.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/%28admin-portal%29/admin/bookings/page.tsx) (1,112 lines)

### 1. Data Fields Displayed

| Field | Table View (Desktop) | Card View (Mobile) | Implementation Source |
| :--- | :--- | :--- | :--- |
| **Customer Name** | Line 774 | Line 478 | `booking.customer?.name \|\| "N/A"` |
| **Customer Phone** | Line 775 (`tel:` link) | Line 481 (`tel:` link) | `booking.customer?.phone` |
| **Customer Email** | Line 778 | Line 487 | `booking.customer?.email` |
| **Service Name** | Line 790 | Line 460 | `booking.primaryService \|\| booking.service?.name` |
| **Extra Services** | Line 792 | Line 576 | `booking.extraServices` (tags with prices) |
| **Vehicle** | Line 808 | Line 593 | `booking.vehicle` |
| **Tire Size** | Line 810 | Line 595 | `booking.tireSize` (badge) |
| **Location** | Line 835 | Line 611 | `booking.formattedAddress \|\| booking.location` |
| **Coordinates (lat/lng)** | Line 840 (in Maps link) | Line 463 (in Maps link) | `booking.latitude`, `booking.longitude` |
| **Google Maps Link** | Line 839 (`Route in Maps →`) | Line 614 (`Route in Maps →`) | Direct link (`destination=lat,lng` or search query) |
| **Preferred Date** | Line 820 | Line 603 | `formatDate(booking.bookingDate)` |
| **Preferred Time** | Line 822 | Line 604 | `formatTime(booking.bookingTime)` |
| **Additional Details** | Line 853 | Line 625 | `booking.notes` |
| **Booking Status** | Line 781 | Line 491 | `renderStatusBadge(booking.status, booking.arrivedAt)` |
| **Booking ID / Ref** | Header | Header | Truncated uppercase reference |

### 2. Interactive Operational Actions

#### A. Confirm Booking
- **UI Trigger:** Line 636 (mobile) & Line 882 (desktop): `<button onClick={() => handleConfirm(booking.id)}>`
- **Condition:** Visible only when `booking.status === "pending"`.
- **Client Handler:** Calls `confirmBookingAction(id)`.
- **Server Action:** `app/actions/bookings/admin.ts:14`.
- **Database Mutation:** `prisma.booking.update({ where: { id }, data: { status: "confirmed", serviceConfirmedAt: new Date() } })`.
- **Post-Commit Notification:** Dispatches `sendCustomerBookingConfirmedAlert`.

#### B. Reject / Cancel Booking
- **UI Trigger:** Line 725 (mobile) & Line 978 (desktop): `<button onClick={() => setCancellingBooking(booking)}>`
- **Condition:** Visible when `status === "pending"` or `status === "confirmed"`.
- **Client Handler:** Opens modal prompt for cancellation reason, then calls `cancelBookingAction(booking.id, cancelReason)`.
- **Server Action:** `app/actions/bookings/admin.ts:114`.
- **Database Mutation:** `prisma.booking.update({ where: { id }, data: { status: "cancelled", notes: ... } })`.
- **Post-Commit Notification:** Dispatches `sendAdminBookingCancelledAlert` and `sendCustomerBookingCancelledAlert`.

#### C. Technician Assignment
- **UI Trigger:** Line 518 (mobile) & Line 862 (desktop): `<select onChange={(e) => handleAssignTechnician(booking.id, e.target.value)}>`
- **Condition:** Available for `confirmed` bookings.
- **Client Handler:** Calls `assignTechnicianAction(bookingId, technicianId)`.
- **Server Action:** `app/actions/bookings/admin.ts:184`.
- **Database Mutation:** `prisma.booking.update({ where: { id: bookingId }, data: { technicianId, status: booking.status === "pending" ? "confirmed" : booking.status } })`.
- **Post-Commit Notification:** Dispatches `sendCustomerTechnicianAssignedAlert`.

---

## 8. Booking Confirmation Trace (`AUDIT 6`)

### 1. Complete Confirmation Execution Path
```
Admin Clicks [Confirm Booking] on /admin/bookings
   │
   ▼
[app/(admin-portal)/admin/bookings/page.tsx : handleConfirm()]
   │
   ▼
[app/actions/bookings/admin.ts : confirmBookingAction(bookingId)]
   │
   ├─► 1. requireAdminSession() -> Checks PostgreSQL `admin_sessions` (Unauthorized -> 401)
   ├─► 2. prisma.booking.findUnique({ where: { id: bookingId } })
   ├─► 3. validateBookingTransition(booking.status, "confirmed", "admin")
   │      - Valid from: "pending"
   │      - Invalid from: "completed", "cancelled"
   │
   ├─► 4. Database Mutation:
   │      prisma.booking.update({
   │        where: { id: bookingId },
   │        data: {
   │          status: "confirmed",
   │          serviceConfirmedAt: new Date(),
   │        },
   │        include: { customer: true, service: true }
   │      })
   │
   ▼ (Post-Commit Non-Blocking Trigger)
[lib/notifications.ts : sendCustomerBookingConfirmedAlert(updated)]
   │
   ├─► resolveCustomerNotificationPhone(updated.customer) -> Normalized E.164
   ├─► hasExistingNotification() -> Key: buildBookingConfirmedKey(booking.id)
   ├─► buildBookingConfirmedSms() (`lib/sms/templates.ts:211`)
   ├─► dispatchSms() -> AndroidGatewayProvider -> TokenManager -> Capcom6 Gateway
   └─► logNotification() -> NotificationLog (type="BOOKING_CONFIRMED", status="SENT")
   │
   ▼
Revalidate Paths:
   revalidatePath("/admin/bookings")
   revalidatePath(`/admin/bookings/${bookingId}`)
   return { success: true }
```

### 2. Fault Isolation Verification
Line 63 of `app/actions/bookings/admin.ts`:
```typescript
try {
  await sendCustomerBookingConfirmedAlert({ ... });
} catch (notifErr) {
  console.warn("Failed to dispatch customer booking confirmation SMS:", notifErr);
}
```
If the Android Gateway is unreachable, the token has expired, or the customer phone is unreachable, the exception is caught and logged. The booking **remains confirmed** in PostgreSQL.

---

## 9. Customer Confirmation SMS Audit (`AUDIT 7`)

Template Inspected: `buildBookingConfirmedSms` in [`lib/sms/templates.ts:198-221`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/templates.ts#L198-L221)

```typescript
export interface BookingConfirmedTemplateData {
  customerFirstName: string;
  service: string;
  vehicle: string;
  date: string;
  time: string;
  shortBookingId: string;
  businessPhone: string;
}

export function buildBookingConfirmedSms(data: BookingConfirmedTemplateData): string {
  const name = extractFirstName(data.customerFirstName);
  const service = sanitizeInline(data.service, 35);
  const vehicle = sanitizeInline(data.vehicle, 25);
  const date = sanitizeInline(data.date, 20);
  const time = sanitizeInline(data.time, 20);
  const ref = sanitizeInline(data.shortBookingId, 15).toUpperCase();
  const phone = sanitizeInline(data.businessPhone, 30);

  return `HT Mobile Tires: Hi ${name}, your appointment for ${service} (${vehicle}) on ${date} at ${time} is CONFIRMED. Booking #${ref}. Questions? Call ${phone}.`;
}
```

### Content Audit:
- **Service Confirmed:** Included (`${service}`) — PASS.
- **Vehicle Information:** Included (`(${vehicle})`) — PASS.
- **Booking Reference:** Included (`Booking #${ref}`) — PASS.
- **Date & Time:** Included (`on ${date} at ${time}`) — PASS WITH CAVEAT *(date/time defaulted during booking creation)*.
- **Business Support Phone:** Included (`Questions? Call ${phone}`) — PASS.
- **View Booking Link:** **NOT INCLUDED**. There is no link back to the customer portal (`/account`) in this SMS.
- **Technician Personal Phone Number Privacy:** **STRICT PASS**. The template does not accept, store, or expose any technician personal phone number. Customer inquiries are routed exclusively to `businessPhone` (`(737) 250-8034`).

---

## 10. NotificationLog & Reliability Audit (`AUDIT 8`)

### 1. `NotificationLog` Schema & Lifecycle
Model inspected in [`prisma/schema.prisma:160-185`](file:///d:/Tire-Services/tire-mobile-clinic-next/prisma/schema.prisma#L160-L185):
- `id`: UUID primary key.
- `bookingId`: Direct relational foreign key.
- `type`: Notification event type (`"BOOKING_CREATED"`, `"BOOKING_CONFIRMED"`, etc.).
- `channel`: `"sms"` or `"email"`.
- `status`: Application dispatch state (`"PENDING"`, `"SENT"`, `"FAILED"`).
- `recipient`: Normalized E.164 phone number.
- `content` / `body`: Full message payload.
- `messageId`: Upstream provider message ID returned by Capcom6 gateway.
- `deliveryStatus`: Carrier state (`"DELIVERED"`, `"FAILED"`, `"CANCELLED"`).
- `deliveredAt`: Timestamp from carrier delivery receipt.
- `providerEventId`: Deduplication ID from webhook payload.
- `retryCount`: Count of retry attempts.

### 2. Event Key Determinism & Duplicate Prevention
- Generator: `buildNotificationEventKey` in [`lib/notifications/identity.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications/identity.ts).
- Deterministic Keys:
  - Admin Booking Created: `booking_created_admin:<bookingId>`
  - Customer Booking Confirmed: `booking_confirmation:<bookingId>`
  - Customer Technician Assigned: `technician_assigned:<bookingId>:<technicianId>`
- Guard: `hasExistingNotification()` queries `NotificationLog` for existing records with matching `entityId`, `type`, `channel`, and non-failed status before dispatching.

### 3. Asynchronous Webhook Correlation
- Endpoint: `POST /api/webhooks/sms-gateway` in [`app/api/webhooks/sms-gateway/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/webhooks/sms-gateway/route.ts).
- Security: Cryptographic HMAC-SHA256 signature verification (`X-Signature`) and timestamp replay protection (`X-Timestamp`).
- Separation of Concerns: Updates `deliveryStatus` without overwriting application dispatch `status`. Terminal states (`DELIVERED`) are strictly protected against out-of-order delivery.

### 4. Background Retry Compatibility
- Function: `retryFailedNotifications(limit = 10)` in [`lib/notifications.ts:1428`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L1428).
- Concurrency Protection: Uses atomic row-level claim (`updateMany` where `retryCount < 3` and `status = "FAILED"`).
- Idempotency: Re-dispatches with unique retry key `sms_retry_${type}_${entityId}_${retryCount + 1}`.

---

## 11. Security & Privacy Audit (`AUDIT 9`)

| Security Concern | Current Implementation | Verdict |
| :--- | :--- | :--- |
| **Admin Phone Recipient** | Resolved server-side via `resolveAdminNotificationPhone()`. Hierarchy: `ADMIN_NOTIFICATION_PHONE` -> `DISPATCH_PHONE_NUMBER` -> `TECHNICIAN_PHONE_NUMBER`. Never bundled to client. | **PASS** |
| **Customer Phone Normalization** | Processed through `normalizePhoneToE164()` before gateway dispatch. Handles 10-digit US, 11-digit +1, and international numbers safely. | **PASS** |
| **Technician Phone Privacy** | Zero customer templates accept or render technician phone numbers. Customer templates only render `businessPhone`. | **PASS** |
| **Admin Route Protection** | Edge middleware validates HMAC signature on `admin_session` cookie. Unauthenticated requests are redirected to `/admin/login`. | **PASS** |
| **Admin Mutation Authorization** | All Server Actions call `requireAdminSession()`. Database verifies session token existence and expiration. Unauthorized calls return error. | **PASS** |
| **Booking ID Forgery Resistance** | Guessing or tampering with a `bookingId` does not permit confirmation, rejection, or reassignment without an active admin session. | **PASS** |
| **Customer Booking Isolation** | Customers can only access their own bookings in `/account` via `getAuthorizedCustomerIdsForUser`. | **PASS** |
| **SMS Link Data Exposure** | No customer personal data is exposed via public query parameters. No unauthenticated admin action links exist. | **PASS** |

---

## 12. Existing SMS Gateway Path (`AUDIT 10`)

The existing SMS gateway infrastructure remains completely unchanged and verified:
- **Provider Implementation:** `AndroidGatewayProvider` in [`lib/sms/providers/android-gateway.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/providers/android-gateway.ts).
- **Token Manager:** `TokenManager` in [`lib/sms/token-manager.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/token-manager.ts) utilizing row-level database locking (`SELECT ... FOR UPDATE`) in `sms_gateway_tokens`.
- **Target Gateway:** Capcom6 Cloud SMS Gateway (`https://api.sms-gate.app`).
- **Target Endpoint:** `POST /3rdparty/v1/messages`.
- **Outbound Hardware:** Connected Android device with dedicated business SIM card (Slot `0`).
- **Integrity Verified:** Zero changes made to credentials, provider factory, token rotation, webhooks, or retry mechanism.

---

## 13. Exact Files Reviewed

1. [`prisma/schema.prisma`](file:///d:/Tire-Services/tire-mobile-clinic-next/prisma/schema.prisma)
2. [`app/booking/page.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/booking/page.tsx)
3. [`app/booking/BookingFormClient.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/booking/BookingFormClient.tsx)
4. [`app/actions/bookings.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings.ts)
5. [`app/actions/bookings/customer.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/customer.ts)
6. [`app/actions/bookings/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts)
7. [`app/api/bookings/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/route.ts)
8. [`app/api/admin/bookings/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/admin/bookings/route.ts)
9. [`app/api/admin/bookings/[id]/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/admin/bookings/%5Bid%5D/route.ts)
10. [`app/(admin-portal)/admin/bookings/page.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/%28admin-portal%29/admin/bookings/page.tsx)
11. [`middleware.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/middleware.ts)
12. [`lib/admin-auth.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/admin-auth.ts)
13. [`lib/technician-auth.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/technician-auth.ts)
14. [`lib/notifications.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts)
15. [`lib/notifications/recipients.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications/recipients.ts)
16. [`lib/notifications/identity.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications/identity.ts)
17. [`lib/sms/index.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/index.ts)
18. [`lib/sms/types.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/types.ts)
19. [`lib/sms/templates.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/templates.ts)
20. [`lib/sms/token-manager.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/token-manager.ts)
21. [`lib/sms/providers/android-gateway.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/providers/android-gateway.ts)
22. [`lib/sms/webhook-verification.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/webhook-verification.ts)
23. [`app/api/webhooks/sms-gateway/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/webhooks/sms-gateway/route.ts)
24. [`.env.local`](file:///d:/Tire-Services/tire-mobile-clinic-next/.env.local)

---

## 14. Classification of Audit Items

| Audit Item | Description | Classification | Reason / Notes |
| :--- | :--- | :--- | :--- |
| **AUDIT 1** | Customer Booking Form | **PASS WITH CAVEAT** | Form collects Name, Phone, Email, Service, Vehicle, Location, GPS lat/lng, and Notes correctly. However, **Preferred Date and Time fields are absent from the UI**, causing submissions to default to today/now. |
| **AUDIT 2** | Booking Creation Trace | **PASS WITH CAVEAT** | Authoritative creation path (`createBookingRequestAction`) persists booking to DB before SMS with `status: "pending"`. SMS failures do not abort booking. However, server action lacks multi-submit deduplication and diverges from REST API schema. |
| **AUDIT 3** | BOOKING_CREATED Admin SMS | **PASS WITH CAVEAT** | Real Android Gateway is active. Alert contains customer info, service, vehicle, date/time, and address. However, **Secure Review & Confirm Booking Link is missing from the template**, and coordinates are dropped from the payload causing maps search fallback. |
| **AUDIT 4** | Admin SMS Link Security | **PASS WITH CAVEAT** | Admin operations require a valid, signed server-side session (`admin_session` cookie). Unauthorized users cannot confirm/reject. Booking ID alone cannot authorize actions. However, no action token mechanism or dedicated booking detail page exists for SMS deep linking. |
| **AUDIT 5** | Admin Booking Page | **PASS** | `/admin/bookings` displays complete customer, service, vehicle, location, GPS maps link, and notes. Confirm, Reject, and Technician Assignment actions are fully wired to authorized server actions. |
| **AUDIT 6** | Booking Confirmation Trace | **PASS** | Confirm button triggers `confirmBookingAction`, transitions status `pending` -> `confirmed`, persists `serviceConfirmedAt`, and non-blocking trigger calls `sendCustomerBookingConfirmedAlert`. SMS failure never rolls back confirmation. |
| **AUDIT 7** | Customer Confirmation SMS | **PASS** | `BOOKING_CONFIRMED` SMS correctly sends customer first name, service, vehicle, date/time, short booking reference, and business hotline. Zero technician personal phone numbers are exposed. |
| **AUDIT 8** | Notification Reliability | **PASS** | `NotificationLog` properly records channel, recipient, status, and message ID. Deterministic event keys prevent duplicates. Delivery webhooks correlate via `messageId`. Retries operate safely. |
| **AUDIT 9** | Security & Privacy | **PASS** | Admin recipient is protected server-side. Customer phone normalized to E.164. Strict technician privacy. Server-side session verification on all admin mutations. |
| **AUDIT 10** | Existing SMS Gateway | **PASS** | Real Android Gateway provider with TokenManager proactive refresh remains active, unmodified, and fully operational. |

---

## 15. Exact Gaps Identified

### Critical Gaps:
1. **Gap 1: Missing Admin Review Link in `BOOKING_CREATED` SMS**  
   `buildAdminNewBookingSms` in `lib/sms/templates.ts:78` does not include any URL link to review, manage, or confirm the booking in the admin portal.
2. **Gap 2: Missing Admin Dedicated Booking Detail Route**  
   There is no page component or route handler for `/admin/bookings/[id]` or `/admin/bookings/[bookingId]`. If a link were placed in the SMS pointing to `/admin/bookings/<bookingId>`, Next.js would return a 404 error.
3. **Gap 3: Missing Preferred Date & Time Selection in Booking Form UI**  
   `app/booking/BookingFormClient.tsx` does not render date or time inputs. Every booking created via the customer UI defaults to today's date (`new Date().toISOString().split("T")[0]`) and current timestamp (`now`). Customers cannot request future appointment dates or time windows.
4. **Gap 4: Dropped Geolocation Coordinates in Notification Payload**  
   In `app/actions/bookings/customer.ts:135`, `createBookingRequestAction` passes `id`, `status`, `bookingDate`, `bookingTime`, `location`, `vehicle`, `customer`, and `service` into `sendBookingConfirmation`, but **omits `latitude`, `longitude`, and `formattedAddress`**. As a result, `buildGoogleMapsUrl` falls back to a textual address search rather than an exact navigation pin (`destination=lat,lng`).

### Secondary / Non-Blocking Gaps:
5. **Gap 5: Server Action vs. REST API Path Divergence**  
   `POST /api/bookings` requires Supabase login, validates via Zod, but drops geolocation coordinates. `createBookingRequestAction` allows guest bookings, captures coordinates, but lacks Zod validation and transaction boundaries.
6. **Gap 6: Dormant API Route Status Update Defect**  
   The dormant endpoint `PATCH /api/admin/bookings/[id]` calls legacy `sendStatusUpdate()`, which attempts to send an SMS to `TECHNICIAN_PHONE_NUMBER` with type `"status_update"` instead of calling `sendCustomerBookingConfirmedAlert`.
7. **Gap 7: Customer Confirmation SMS Lacks Direct Account Portal Link**  
   `buildBookingConfirmedSms` provides the business phone number, but does not provide a direct link for customers to view their booking status online.

---

## 16. Exact Recommended Phase 4B Scope

Phase 4B should implement the missing workflow components while strictly preserving existing notification infrastructure, gateway credentials, and database schemas:

1. **Add Dedicated Admin Booking Detail Route:**
   - Create `app/(admin-portal)/admin/bookings/[bookingId]/page.tsx` displaying the single booking's full customer details, vehicle, tire size, service, address, GPS navigation link, and notes.
   - Include direct [Confirm Booking], [Cancel Booking], and [Assign Technician] action controls guarded by `requireAdminSession()`.
2. **Add Admin Review Link to `buildAdminNewBookingSms`:**
   - Update `buildAdminNewBookingSms` in `lib/sms/templates.ts` to include:  
     `Review: ${APP_URL}/admin/bookings/${bookingId}` (or `/admin/bookings?id=${bookingId}`).
   - Update `sendBookingConfirmation` in `lib/notifications.ts` to pass the full booking ID / review link.
3. **Forward Geolocation Coordinates to Admin SMS:**
   - Update `createBookingRequestAction` in `app/actions/bookings/customer.ts` to include `latitude`, `longitude`, and `formattedAddress` in the `sendBookingConfirmation` payload so `buildGoogleMapsUrl` generates exact `destination=lat,lng` navigation links.
4. **Add Preferred Date & Time Selection to `BookingFormClient.tsx`:**
   - Add accessible date picker (minimum: today) and time slot selector to `BookingFormClient.tsx`.
   - Pass selected `bookingDate` and `bookingTime` to `createBookingRequestAction` to replace the hardcoded today/now fallback.
5. **Add Optional Direct "View Booking" Link in Customer Confirmation SMS:**
   - Update `buildBookingConfirmedSms` to optionally include `${APP_URL}/account?tab=bookings`.
6. **Align `PATCH /api/admin/bookings/[id]`:**
   - Ensure `PATCH /api/admin/bookings/[id]` delegates status changes to `confirmBookingAction` or `sendCustomerBookingConfirmedAlert` to eliminate notification divergence.

---

## Summary Assessment

- **Overall Status:** **PASS WITH CAVEATS**  
  (Core booking creation, real Android Gateway SMS delivery, admin UI management, and customer confirmation SMS are fully operational; critical workflow gaps exist in SMS link generation, detail route availability, and form date/time collection).
- **Blocking Issues:** **None** (System is live and running with 256 passing tests and clean type check).
- **Non-Blocking Issues:**
  1. Admin SMS does not contain a review link.
  2. No dedicated `/admin/bookings/[bookingId]` page exists.
  3. Booking form UI does not collect preferred appointment date or time.
  4. Coordinates dropped in booking creation notification payload.
- **Phase 4B Implementation Ready:** Full audit complete. Ready for Phase 4B implementation upon user approval.
