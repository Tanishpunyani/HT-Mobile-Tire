# PHASE 1 — HT MOBILE SMS NOTIFICATION SYSTEM
## READ-ONLY AUDIT REPORT

**Author:** Google DeepMind Advanced Agentic Coding Pair  
**Target Codebase:** HT Mobile Services / HT Mobile Tyres (`tire-mobile-clinic-next`)  
**Audit Scope:** Read-Only Codebase Audit & Architectural Assessment  
**Mode:** STRICT READ-ONLY — NO SOURCE CODE OR DATABASE MUTATIONS  
**Date:** September 2026  

---

## 1. Executive Summary

This audit evaluates the existing codebase of **HT Mobile Services / HT Mobile Tyres** to determine how an automated, reliable SMS business notification system can be integrated across customer and administrative operational workflows without disturbing existing business logic, database integrity, or authentication mechanisms.

### Key Audit Findings:
1. **SMS Gateway & Telephony Abstraction is Production-Ready:**  
   The underlying SMS Gateway provider infrastructure is fully implemented in [`lib/sms/`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms). It supports the Android Capcom6 SMS Gateway (`AndroidGatewayProvider`), a fallback development provider (`SimulatedSmsProvider`), phone number E.164 normalization, dual-SIM slot selection, request timeouts (4000ms), idempotency keys, and HMAC-SHA256 signed delivery webhooks with replay protection.
2. **Notification Layer is Split and Partially Disconnected:**  
   High-level notifications reside in [`lib/notifications.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts), while low-level SMS dispatch utilities also exist in [`lib/sms.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms.ts). The functions in `lib/sms.ts` (`sendQuoteSms` and `sendBookingRequestSms`) are dead code—unreferenced across the entire project—and bypass the `NotificationLog` audit table.
3. **Inverted Recipient Logic (Technician vs Admin vs Customer):**  
   Presently, the system sends dispatch SMS notifications almost exclusively to `TECHNICIAN_PHONE_NUMBER` (which falls back to `DISPATCH_PHONE_NUMBER` or `BUSINESS_PHONE_RAW`), treating the technician/dispatch phone as the single recipient for booking creation, emergency alerts, and status changes. Customers currently receive **Resend HTML emails**, not SMS notifications, with the sole exception of the service completion quote (`quote_ready`).
4. **Action vs Route Divergence & Duplication Risk:**  
   Booking creation and status updates exist in duplicate across Next.js Server Actions ([`app/actions/bookings/`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings)) and API Route Handlers ([`app/api/bookings/`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings) and [`app/api/admin/bookings/`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/admin/bookings)). The Admin UI exclusively invokes Server Actions (e.g. `confirmBookingAction`), which currently do **not** dispatch notifications, whereas the unused API endpoint `PATCH /api/admin/bookings/[id]` does. If notifications are attached naively to both or in the wrong layer, duplicate SMS will be sent.
5. **Database State Alignment:**  
   The `Booking` model and booking state machine support 5 statuses: `"pending"`, `"confirmed"`, `"in_progress"`, `"completed"`, and `"cancelled"`. Intermediate operational milestones such as *"technician en route"* and *"technician arrived"* do **not** exist as standalone enum values in `Booking.status`; arrival is tracked via the timestamp column `arrivedAt: DateTime?`, and en-route status is tracked dynamically via active technician GPS telemetry (`TechnicianLocation`).

---

## 2. Current Notification Architecture

### 2.1 File Structure and Responsibilities
- [`lib/notifications.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts): Central dispatching hub for high-level business notifications. Contains:
  - `sendSms({ to, body, type, entityId, entityType })`: Calls `dispatchSms()` from `lib/sms`, then logs to `prisma.notificationLog`.
  - `sendEmail({ to, subject, html, type, entityId, entityType })`: Calls Resend API (or simulates in dev), then logs to `prisma.notificationLog`.
  - `logNotification(data)`: Persists dispatch metadata to PostgreSQL `notification_logs`.
  - High-level business handlers: `sendBookingConfirmation()`, `sendEmergencyAlert()`, `sendStatusUpdate()`, `sendQuoteReadyNotification()`.
  - Maintenance & Reliability: `retryFailedNotifications(limit)`, `pruneOldNotificationLogs(retentionDays)`.
- [`app/actions/notifications.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/notifications.ts): Next.js Server Actions exposing wrapper methods (`notifyBookingCreatedAction`, `notifyEmergencyCreatedAction`, `notifyStatusUpdateAction`, `triggerNotificationRetryAction`). **Audit finding:** None of these Server Actions are currently called by any component or client form in the application; they are dormant wrappers.
- [`lib/sms.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms.ts): Exports `sendQuoteSms()` and `sendBookingRequestSms()`. Both bypass `NotificationLog` and are unreferenced in the codebase.
- [`lib/email.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/email.ts): Secondary email helper using Resend for quotes/receipts.

### 2.2 Execution Flow Diagram
```
Business Event Trigger (API Route / Server Action)
                     │
                     ▼
         High-Level Notification Function
           (e.g., sendBookingConfirmation)
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
     sendSms()               sendEmail()
         │                       │
         ▼                       ▼
    dispatchSms()           Resend SDK
 (lib/sms/index.ts)              │
         │                       │
         ▼                       ▼
  Active Provider          logNotification()
(AndroidGateway / Sim)   (Prisma: notification_logs)
         │
         ▼
  logNotification()
(Prisma: notification_logs)
```

### 2.3 Error Handling & Non-Blocking Design
- All high-level notification calls in `lib/notifications.ts` employ `Promise.allSettled()`.
- Dispatch failures in the SMS Gateway or Resend do **not** throw exceptions to the calling business transaction.
- If the SMS Gateway times out or returns HTTP 5xx, the error is caught, logged via Winston `logger.error`, and recorded in `notification_logs` with `status = "FAILED"`.

---

## 3. Current SMS Gateway Architecture

The pluggable SMS Gateway architecture is cleanly encapsulated in [`lib/sms/`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms).

### 3.1 Components
- **Provider Interface** ([`lib/sms/types.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/types.ts)):
  ```typescript
  export interface ISmsProvider {
    readonly name: string;
    send(params: SmsDispatchParams): Promise<NormalizedSmsResult>;
  }
  ```
- **Android Gateway Provider** ([`lib/sms/providers/android-gateway.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/providers/android-gateway.ts)):
  - Resolves Capcom6 Cloud endpoint (`/3rdparty/v1/messages`) or local server endpoint (`/message`).
  - Converts params to standard Capcom6 payload:
    ```json
    {
      "textMessage": { "text": "..." },
      "phoneNumbers": ["+1XXXXXXXXXX"],
      "simNumber": 1,
      "withDeliveryReport": true
    }
    ```
  - Attaches `Authorization: Bearer <SMS_GATEWAY_API_KEY>` and `X-Idempotency-Key`.
  - AbortController timeout enforced at `4000ms`.
  - Never leaks sensitive bearer credentials in logs.
- **Simulated Provider** ([`lib/sms/providers/simulated.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/providers/simulated.ts)):
  - Activated automatically in development or test when `SMS_GATEWAY_URL` or `SMS_GATEWAY_API_KEY` are unset.
  - Returns `success: true` with simulated message IDs (`sim_sms_<timestamp>_<rand>`).
- **Production Guard** ([`lib/sms/index.ts:65-76`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/index.ts#L65-L76)):
  - In `NODE_ENV === "production"`, if credentials are missing, it refuses to simulate silently; it returns `success: false` with an explicit configuration error.
- **Phone Normalization** ([`lib/sms/index.ts:18-41`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/index.ts#L18-L41)):
  - `normalizePhoneToE164(phone)` removes non-digits, checks for leading `+`, strips formatting, and automatically prepends `+1` for 10-digit US numbers.

---

## 4. Booking Lifecycle Audit

The booking lifecycle is governed by the state machine in [`lib/bookings/state-machine.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/bookings/state-machine.ts) and enforced in Prisma schemas and actions.

| Event | Exists? | Current State | Entry Point | Data Available | Existing Notification | Safe Future Trigger Point |
|---|---|---|---|---|---|---|
| **Booking Creation (Customer)** | **EXISTS** | `pending` | 1. `createBookingRequestAction` ([`app/actions/bookings/customer.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/customer.ts))<br>2. `POST /api/bookings` ([`app/api/bookings/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/route.ts)) | Customer name, phone, email, vehicle, location, formattedAddress, lat/lng, bookingDate, bookingTime, primaryService, notes | 1. SMS to `TECHNICIAN_PHONE_NUMBER` (`technician_dispatch`)<br>2. Resend HTML email to customer | Immediately after `prisma.booking.create()` commit |
| **Booking Confirmed (Admin)** | **EXISTS** | `confirmed` | 1. `confirmBookingAction` ([`app/actions/bookings/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts))<br>2. `PATCH /api/admin/bookings/[id]` | Booking ID, Customer name/phone/email, Vehicle, Service, `serviceConfirmedAt` | **Discrepancy:**<br>- `confirmBookingAction`: **NONE**<br>- `PATCH /api/admin/bookings/[id]`: SMS to Tech phone + Email to Customer | After `prisma.booking.update({ data: { status: "confirmed" } })` |
| **Technician Assigned** | **EXISTS** | `confirmed` (or unchanged) | `assignTechnicianAction` ([`app/actions/bookings/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts)) | Booking ID, `technicianId`, Technician `name`, `phone`, `role`, Customer name/phone | **NONE** | After `prisma.booking.update({ data: { technicianId } })` commit |
| **Technician En Route** | **NOT FOUND IN CURRENT CODEBASE (as discrete state)** | `confirmed` or `in_progress` | `POST /api/technician/location` (starts GPS stream) | Technician GPS coordinates, heading, speed, Booking ID, Customer address, calculated ETA | **NONE** (Customer views live map if browsing `/account/bookings/[id]`) | Future milestone trigger (e.g. upon first active GPS broadcast or explicit "Start Trip" action) |
| **Technician Arrived** | **PARTIALLY EXISTS (Data field exists, state mapped to `in_progress`)** | `in_progress` (`arrivedAt` timestamp set) | `markTechnicianArrivedAction` ([`app/actions/bookings/technician.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/technician.ts)) | Booking ID, `arrivedAt`, Customer details, Technician details | **NONE** | After `prisma.booking.update({ data: { arrivedAt, status } })` commit |
| **Service Started** | **PARTIALLY EXISTS** | `in_progress` | 1. `startServiceAction` ([`app/actions/bookings/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts))<br>2. `PATCH /api/admin/bookings/[id]` | Booking ID, Customer, Vehicle, Service | - `startServiceAction`: **NONE**<br>- `PATCH /api/admin/bookings/[id]`: SMS to Tech + Email to Customer | After `prisma.booking.update({ data: { status: "in_progress" } })` |
| **Service Completed & Invoiced** | **EXISTS** | `completed` (`paymentStatus = "quote_sent"`) | `completeAndQuoteAction` ([`app/actions/bookings/quote.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/quote.ts)) | Booking ID, Customer name/phone/email, Vehicle, Service, `basePrice`, `extraServices`, `totalAmount`, PDF receipt URL | 1. SMS to Customer (`quote_ready`)<br>2. Resend HTML Email to Customer | After `prisma.booking.update()` and `generateQuotePdf()` |
| **Payment Settled** | **EXISTS** | `completed` (`paymentStatus = "paid"`) | `markBookingPaidAction` ([`app/actions/bookings/quote.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/quote.ts)) | Booking ID, Customer details, Total Amount | **NONE** | After `prisma.booking.update({ data: { paymentStatus: "paid" } })` |
| **Booking Cancelled (Customer)** | **EXISTS** | `cancelled` | 1. `cancelCustomerBookingAction` ([`app/actions/bookings/customer.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/customer.ts))<br>2. `DELETE /api/bookings/[id]`<br>3. `PUT /api/bookings/[id]` | Booking ID, Customer name/phone, Vehicle, Service | **NONE** across all customer cancellation routes | After `prisma.booking.update({ data: { status: "cancelled" } })` |
| **Booking Cancelled (Admin)** | **EXISTS** | `cancelled` | 1. `cancelBookingAction` ([`app/actions/bookings/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts))<br>2. `PATCH /api/admin/bookings/[id]` | Booking ID, Customer name/phone, Cancel reason | - `cancelBookingAction`: **NONE**<br>- `PATCH /api/admin/bookings/[id]`: SMS to Tech + Email to Customer | After `prisma.booking.update({ data: { status: "cancelled" } })` |
| **Rescheduling** | **NOT FOUND IN CURRENT CODEBASE (as explicit event)** | N/A | `PUT /api/bookings/[id]` (updates `bookingDate` / `bookingTime`) | Booking ID, new date, new time | **NONE** | After `prisma.booking.update()` commit |

---

## 5. Technician Lifecycle Audit

| Event / Capability | Exists? | Implementation Details | File / Function Responsible | Available Data | Privacy / Security Safeguards |
|---|---|---|---|---|---|
| **Technician Authentication** | **EXISTS** | Dual-path: 1) HMAC-SHA256 scoped dispatch token (`token`), 2) Admin session cookie, 3) Supabase staff role (`technician` or `admin`) | [`lib/technician-auth.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/technician-auth.ts), [`app/actions/bookings/technician.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/technician.ts) | `technicianId`, `bookingId`, token expiration (12 hours) | HMAC verified using `TECHNICIAN_DISPATCH_SECRET`. Rejects cross-booking access. |
| **Identity & Storage** | **EXISTS** | Stored in PostgreSQL `technicians` table: `id`, `name`, `role`, `phone`, `isActive` | [`prisma/schema.prisma:215-227`](file:///d:/Tire-Services/tire-mobile-clinic-next/prisma/schema.prisma#L215-L227) | Full technician record | Unique technician name constraint. |
| **Technician Assignment** | **EXISTS** | Admin links `booking.technicianId` to `technicians.id`. Auto-promotes `pending` -> `confirmed`. | `assignTechnicianAction` in [`app/actions/bookings/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts) | Technician name, phone, booking details | **Zero notifications triggered currently.** |
| **GPS Telemetry Updates** | **EXISTS** | `POST /api/technician/location` writes to `technician_locations` (1-to-1 with `bookingId`) | [`app/api/technician/location/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/technician/location/route.ts) | `latitude`, `longitude`, `heading`, `speed`, `updatedAt` | Rate limited to 15 req/min. Scoped token verified. Raw GPS sanitized before customer API responses. |
| **En Route State** | **INFERRED** | Dynamically computed: `status === "in_progress"` or (`status === "confirmed" && technicianId != null`) with fresh GPS (<5 min) | [`app/api/bookings/[id]/route.ts:73`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/%5Bid%5D/route.ts#L73) | Coordinates, calculated ETA minutes, distance in miles | **No discrete database column or trigger exists.** |
| **Arrival Recording** | **EXISTS** | Sets `arrivedAt = new Date()`, updates `status` to `in_progress`. Idempotent (does not overwrite existing `arrivedAt`). | `markTechnicianArrivedAction` in [`app/actions/bookings/technician.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/technician.ts) | `bookingId`, `arrivedAt`, `technicianId` | Rejects arrival if booking is completed/cancelled. **Zero notifications triggered currently.** |
| **Technician Phone Exposure Risk** | **ATTENTION REQUIRED** | `Technician.phone` exists in DB. [`app/api/bookings/[id]/route.ts:92`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/%5Bid%5D/route.ts#L92) returns `booking.technician.phone` directly in customer API tracking endpoint! | [`app/api/bookings/[id]/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/%5Bid%5D/route.ts) | Personal technician phone | **Must be masked in SMS and customer payloads with `BUSINESS_PHONE_DISPLAY`.** |

---

## 6. Emergency Flow Audit

- **Entry Point:** `POST /api/emergency-requests` ([`app/api/emergency-requests/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/emergency-requests/route.ts))
- **Validation:** Validated via `emergencySchema` in [`lib/validations/emergency.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/validations/emergency.ts).
- **Authentication:** Publicly accessible endpoint (emergency roadside assistance requires no prior login).
- **Rate Limiting:** Guarded by IP rate limiter (`5 requests / 60 seconds`). If exceeded, returns HTTP 429 advising the caller to dial `BUSINESS_PHONE_DISPLAY`.
- **Database Mutation:**
  1. Finds or creates `Customer` by phone number.
  2. Creates `EmergencyRequest` row: `customerId`, `serviceId`, `currentLocation`, `formattedAddress`, `latitude`, `longitude`, `city`, `state`, `zipCode`, `problem`, `problemDetails`, `vehicle`, `status: "pending"`.
- **Notification Logic:**
  - Invokes `sendEmergencyAlert()` in `lib/notifications.ts`.
  - **SMS Output:** Sends SMS to `TECHNICIAN_PHONE_NUMBER` with template:
    ```
    🚨 [EMERGENCY - URGENT DISPATCH]
    Problem: <PROBLEM>
    Customer: <NAME> (<PHONE>)
    Vehicle: <VEHICLE>
    Location: <CURRENT_LOCATION>
    Google Maps: https://www.google.com/maps/search/?api=1&query=...
    Details: "..."
    Status: Immediate dispatch required.
    ```
  - **Email Output:** Sends branded HTML email to `customer.email` with 30–45 min arrival expectation and direct hotline link.
- **Safe Future Trigger Point:** Immediately after `prisma.emergencyRequest.create()` commits.
- **Audit Finding:** The emergency SMS currently targets `TECHNICIAN_PHONE_NUMBER`. No SMS is sent to the customer (only email).

---

## 7. Contact Flow Audit

- **Entry Point:** `POST /api/contact-messages` ([`app/api/contact-messages/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/contact-messages/route.ts))
- **Validation:** Validated via `contactSchema` in [`lib/validations/contact.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/validations/contact.ts).
- **Authentication:** Publicly accessible.
- **Rate Limiting:** IP rate limiter (`5 requests / 60 seconds`).
- **Database Mutation:**
  - Creates `ContactMessage` row: `name`, `phone`, `email`, `service`, `location`, `emergency` (boolean), `message`, `status: "new"`.
- **Notification Logic:**
  - **NOT FOUND IN CURRENT CODEBASE.**
  - Zero notification logic exists in `POST /api/contact-messages`. No SMS is dispatched, no email is sent, and no `NotificationLog` is generated.
- **Safe Future Trigger Point:** Immediately following line 58 of `app/api/contact-messages/route.ts` after `prisma.contactMessage.create()` succeeds.

---

## 8. Location / Google Maps Audit

### 8.1 Current Database Representation
- **`Booking` Model:**
  - `location: String` (User-entered address string, required)
  - `formattedAddress: String?` (Normalized Geocoded address from SerpApi/Google)
  - `latitude: Float?`
  - `longitude: Float?`
  - `city: String?`, `state: String?`, `zipCode: String?`
- **`EmergencyRequest` Model:**
  - `currentLocation: String` (Required)
  - `formattedAddress: String?`
  - `latitude: Float?`, `longitude: Float?`
  - `city: String?`, `state: String?`, `zipCode: String?`
- **`ContactMessage` Model:**
  - `location: String?` (Free-form text only; no coordinates or place ID)

### 8.2 Google Maps Link Generation
- Currently, Google Maps URLs are generated inline and inconsistently across the codebase:
  1. In `lib/notifications.ts:309` and `:437`:
     `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
  2. In UI components ([`StaticMapPreview.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/components/StaticMapPreview.tsx), [`app/technician/page.tsx:417`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/technician/page.tsx#L417)):
     `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}` if coordinates exist, falling back to query search.
- **Audit Assessment:** No centralized Google Maps utility function exists. For Admin SMS notifications, clickable navigation links can be reliably constructed using existing data: if `latitude` and `longitude` are present, use the Google Turn-by-Turn Navigation/Direction URL scheme (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`); otherwise fall back to the URL-encoded `formattedAddress` or `location`.

---

## 9. Admin Recipient / Data Audit

### 9.1 Source of Contact Information
- **Admin / Dispatch Phone Number:**
  - Sourced in `lib/notifications.ts:11-15`:
    ```typescript
    const TECHNICIAN_PHONE_NUMBER =
      process.env.TECHNICIAN_PHONE_NUMBER ||
      process.env.DISPATCH_PHONE_NUMBER ||
      BUSINESS_PHONE_RAW;
    ```
  - `BUSINESS_PHONE_RAW` is defined in [`lib/constants/phone.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/constants/phone.ts) as `process.env.NEXT_PUBLIC_BUSINESS_PHONE || "+18005558473"`.
  - **Finding:** There is **no explicit `ADMIN_PHONE_NUMBER` environment variable**. The system uses `TECHNICIAN_PHONE_NUMBER` and `DISPATCH_PHONE_NUMBER` interchangeably to represent central dispatch.
- **Business Phone Number:**
  - `BUSINESS_PHONE_DISPLAY` (`(800) 555-TIRE (8473)`) and `BUSINESS_PHONE_RAW` (`+18005558473`).
- **Admin Notification Preferences:**
  - **NOT FOUND IN CURRENT CODEBASE.** No database table or configuration model stores toggle preferences (e.g. "receive SMS on new booking"). All dispatches are currently hardcoded in application logic.

### 9.2 Environment Variable References (Values Redacted)
- `SMS_GATEWAY_URL` = referenced in `lib/sms/index.ts`
- `SMS_GATEWAY_API_KEY` = referenced in `lib/sms/index.ts`
- `SMS_GATEWAY_SIM_SLOT` = referenced in `lib/sms/index.ts`
- `SMS_GATEWAY_WEBHOOK_SECRET` = referenced in `app/api/webhooks/sms-gateway/route.ts`
- `TECHNICIAN_PHONE_NUMBER` = referenced in `lib/notifications.ts`
- `DISPATCH_PHONE_NUMBER` = referenced in `lib/notifications.ts`
- `NEXT_PUBLIC_BUSINESS_PHONE` = referenced in `lib/constants/phone.ts`
- `NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY` = referenced in `lib/constants/phone.ts`
- `CRON_SECRET` = referenced in `app/api/notifications/retry/route.ts`

---

## 10. Customer Recipient / Data Audit

| Field | Source Model / Type | Notes |
|---|---|---|
| **Customer Name** | `Customer.name` or `User.name` or `formData.name` | Required string across all booking and emergency flows. |
| **Customer Phone** | `Customer.phone` or `User.phone` or `formData.phone` | Cleaned via `normalizePhoneToE164()` before SMS dispatch. |
| **Customer Email** | `Customer.email` or `User.email` or `formData.email` | Optional in emergency requests; required for account holders. |
| **Booking Reference / ID** | `Booking.id` (UUID) | Formatted in quotes as short reference (`INV-XXXXXXXX` or last 6 characters). |
| **Requested Service** | `Booking.primaryService` & `Booking.extraServices` | Stored as string name and JSON array of `{ name, price }`. |
| **Vehicle Information** | `Booking.vehicle` | Stored as combined string (e.g. `"2022 Ford F-150"`) or parsed from `vehicleDetails`. |
| **Location Data** | `Booking.location`, `formattedAddress`, `latitude`, `longitude` | Full address string and optional GPS coordinates. |

---

## 11. Existing Notification Types

### 11.1 Defined Enums and Types
In [`lib/sms/types.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/types.ts) and [`lib/notifications.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts):
```typescript
export type NotificationType =
  | "booking_confirmation"
  | "emergency_alert"
  | "status_update"
  | "technician_dispatch"
  | "quote_ready"
  | "customer_message";
```

### 11.2 Status of the 10 Conceptual Business Events

| Conceptual Business Event | Codebase Status | Existing Implementation / Mapping |
|---|---|---|
| `BOOKING_CREATED` | **PARTIALLY EXISTS** | Uses `technician_dispatch` (SMS to Tech phone) and `booking_confirmation` (Email to Customer). Admin SMS is not separated from tech SMS. |
| `BOOKING_CONFIRMED` | **PARTIALLY EXISTS** | Handled in `sendStatusUpdate()` (`status_update`), but only dispatches SMS to Tech phone and email to Customer. Not called by admin Server Action. |
| `TECHNICIAN_ASSIGNED` | **DOES NOT EXIST** | No notification logic in `assignTechnicianAction`. |
| `TECHNICIAN_EN_ROUTE` | **DOES NOT EXIST** | No event, type, or notification trigger exists for en-route state. |
| `TECHNICIAN_ARRIVED` | **DOES NOT EXIST** | `markTechnicianArrivedAction` sets `arrivedAt` in DB, but sends zero SMS/email notifications. |
| `SERVICE_STARTED` | **DOES NOT EXIST** | `startServiceAction` sets `status = "in_progress"`, but sends zero SMS/email notifications. |
| `SERVICE_COMPLETED` | **PARTIALLY EXISTS** | Handled via `quote_ready` in `sendQuoteReadyNotification()`. Dispatches SMS and Email to Customer. |
| `EMERGENCY_REQUEST_CREATED` | **EXISTS** | Handled via `emergency_alert` in `sendEmergencyAlert()`. Dispatches SMS to Tech phone and Email to Customer. |
| `CONTACT_REQUEST_CREATED` | **DOES NOT EXIST** | `POST /api/contact-messages` does not dispatch any notifications. |
| `BOOKING_CANCELLED` | **PARTIALLY EXISTS** | Handled inside `sendStatusUpdate()` if `newStatus = "cancelled"`, but no customer cancellation action or DELETE route triggers it. |

---

## 12. Existing SMS Templates

All existing SMS messages are constructed as **raw inline template strings**:

1. **New Booking Alert** ([`lib/notifications.ts:314-325`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L314-L325)):
   ```
   [NEW BOOKING - HT MOBILE TIRES]
   Customer: <name> (<phone>)
   Service: <serviceName>
   Vehicle: <vehicle>
   Requested: <formattedDate> at <formattedTime>
   Location: <location>
   Map: https://www.google.com/maps/search/?api=1&query=...
   Notes: "..."
   ```
   *Recipient:* `TECHNICIAN_PHONE_NUMBER`  
   *Type:* `technician_dispatch`

2. **Emergency Alert** ([`lib/notifications.ts:442-453`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L442-L453)):
   ```
   🚨 [EMERGENCY - URGENT DISPATCH]
   Problem: <PROBLEM>
   Customer: <name> (<phone>)
   Vehicle: <vehicle>
   Location: <currentLocation>
   Google Maps: https://www.google.com/maps/search/?api=1&query=...
   Details: "..."
   Status: Immediate dispatch required.
   ```
   *Recipient:* `TECHNICIAN_PHONE_NUMBER`  
   *Type:* `emergency_alert`

3. **Status Update** ([`lib/notifications.ts:611-613`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L611-L613)):
   ```
   [STATUS UPDATE] Booking for <name> (<vehicle>) updated to "<NEW_STATUS>". Notes: <notes>
   ```
   *Recipient:* `TECHNICIAN_PHONE_NUMBER`  
   *Type:* `status_update`

4. **Invoice / Quote Ready** ([`lib/notifications.ts:730-736`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L730-L736)):
   ```
   [HT MOBILE TIRES - INVOICE READY]
   Hi <name>, your mobile tire service invoice is ready.
   Service: <serviceName> (<vehicle>)
   Total: $<amount>
   View receipt & details: <accountUrl>
   Questions? Call (800) 555-TIRE (8473)
   ```
   *Recipient:* `customerPhone`  
   *Type:* `quote_ready`

5. **Unused / Dead Templates** ([`lib/sms.ts:33-35`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms.ts#L33-L35) and [`:76`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms.ts#L76)):
   - `sendQuoteSms`: `Hi <name>, your HT Mobile Tires service is complete! Total due: $...`
   - `sendBookingRequestSms`: `HT Mobile Tires: Hi <name>, we received your on-demand 24/7 service request...`

**Finding:** There is currently no centralized template rendering engine or dictionary. Templates are hardcoded inside dispatcher functions.

---

## 13. NotificationLog Audit

The PostgreSQL table `notification_logs` is defined in [`prisma/schema.prisma:160-185`](file:///d:/Tire-Services/tire-mobile-clinic-next/prisma/schema.prisma#L160-L185):

```prisma
model NotificationLog {
  id                 String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  bookingId          String?   @map("booking_id") @db.Uuid
  emergencyRequestId String?   @map("emergency_request_id") @db.Uuid
  entityId           String?   @map("entity_id") @db.Uuid
  entityType         String?   @map("entity_type")
  type               String    
  channel            String?   // "sms" | "email"
  status             String    @default("PENDING") // "SENT" | "FAILED" | "PENDING"
  recipient          String
  content            String?   @db.Text
  subject            String?
  body               String?   @db.Text
  errorMessage       String?   @map("error_message") @db.Text
  retryCount         Int       @default(0) @map("retry_count")
  messageId          String?   @map("message_id")
  deliveryStatus     String?   @map("delivery_status") // "DELIVERED" | "FAILED" | "CANCELLED"
  deliveredAt        DateTime? @map("delivered_at") @db.Timestamptz(6)
  providerEventId    String?   @map("provider_event_id")
  createdAt          DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt          DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([createdAt, status])
  @@index([messageId])
  @@map("notification_logs")
}
```

### Key Architectural Behaviors:
- **`status` vs `deliveryStatus` Separation:**
  - `status`: Reflects **application dispatch state** (`"PENDING"`, `"SENT"`, `"FAILED"`). Set to `"SENT"` when the SMS Gateway accepts the HTTP POST.
  - `deliveryStatus`: Reflects **telecom carrier delivery state** (`"DELIVERED"`, `"FAILED"`, `"CANCELLED"`). Updated exclusively via inbound webhook callbacks from the gateway device.
- **Message Correlation:** The gateway's assigned ID is stored in `messageId`, indexed for constant-time correlation upon webhook receipt.
- **Idempotency Key:** `providerEventId` stores the unique webhook event ID from the Android Gateway device, preventing duplicate processing of retried webhooks.

---

## 14. Retry and Failure Handling

The retry worker is implemented in [`lib/notifications.ts:839-933`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L839-L933) (`retryFailedNotifications`):

1. **Eligibility Filter:**
   Selects records where `status == "FAILED"` and `retryCount < 3`, ordered by `createdAt ASC`.
2. **Atomic Concurrency Protection:**
   Uses row-level atomic claiming:
   ```typescript
   const claimed = await prisma.notificationLog.updateMany({
     where: { id: log.id, status: "FAILED", retryCount: log.retryCount },
     data: { retryCount: { increment: 1 } },
   });
   if (claimed.count === 0) continue; // Claimed by concurrent worker
   ```
3. **Direct Dispatch (Duplicate Log Row Prevention):**
   The retry loop calls `dispatchSms()` directly rather than `sendSms()`. This guarantees that retries update the **existing** `NotificationLog` row rather than creating recursive duplicate rows.
4. **Non-Interference with Carrier Failures:**
   Carrier delivery failures update `deliveryStatus = "FAILED"`, but leave `status = "SENT"`. Because the retry worker queries `where: { status: "FAILED" }`, **carrier-failed deliveries are never incorrectly re-dispatched by the worker**.
5. **Trigger Endpoints:**
   - Next.js API Route: `POST /api/notifications/retry` (Authorized via `Bearer <CRON_SECRET>` or Admin cookie).
   - Server Action: `triggerNotificationRetryAction` (Admin portal manual trigger).

---

## 15. SMS Webhook / Delivery Tracking

The webhook endpoint is implemented in [`app/api/webhooks/sms-gateway/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/webhooks/sms-gateway/route.ts):

1. **Cryptographic Verification:**
   - Validates `X-Signature` and `X-Timestamp` headers before parsing the body.
   - Enforces a 5-minute replay window (`toleranceSeconds = 300`).
   - Computes `HMAC-SHA256(secret, rawBody + timestamp)` and uses `crypto.timingSafeEqual()` to eliminate timing attacks.
2. **Payload Size Guard:**
   Rejects bodies exceeding 64KB (`HTTP 413`).
3. **Supported Lifecycle Events:**
   - `sms:sent`: Records `providerEventId`, keeps `status = "SENT"`.
   - `sms:delivered`: Sets `deliveryStatus = "DELIVERED"` and populates `deliveredAt`.
   - `sms:failed`: Sets `deliveryStatus = "FAILED"`, appends carrier reason, preserves `status = "SENT"`.
   - `sms:cancelled`: Sets `deliveryStatus = "CANCELLED"`.
4. **Terminal State Immutability:**
   If a notification is already in `deliveryStatus === "DELIVERED"`, subsequent out-of-order `sms:failed` or `sms:sent` events are safely ignored and cannot downgrade the terminal status.
5. **Decoupling from Event System:**
   Webhook updates are strictly operational/telemetric; they do not alter booking state or emit new business notifications.

---

## 16. Duplicate Notification Risks

The audit identified several areas where duplicate SMS notifications could occur if not guarded against:

1. **Dual Booking Creation Paths (CRITICAL):**
   - Customer UI uses Server Action: `createBookingRequestAction` ([`app/actions/bookings/customer.ts:131`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/customer.ts#L131)).
   - Public API endpoint also exists: `POST /api/bookings` ([`app/api/bookings/route.ts:194`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/route.ts#L194)).
   - Both entry points currently execute `await sendBookingConfirmation(...)`. If a client were to call both, or if a webhook/integration triggered the API while the user submitted the form, two separate SMS dispatches would occur.
2. **Admin Status Update Divergence:**
   - Admin Bookings UI calls Server Actions: `confirmBookingAction`, `startServiceAction`, etc. These currently have **zero notification calls**.
   - Meanwhile, `PATCH /api/admin/bookings/[id]` calls `sendStatusUpdate()`.
   - If notification logic is added to Server Actions without checking or deprecating the PATCH endpoint, any automated script or admin tool using the PATCH endpoint would cause double notifications.
3. **Status Transitions Without Change Detection (No-Op Updates):**
   - In `app/actions/bookings/admin.ts`, `confirmBookingAction` checks `transition.isNoop` and returns early. This is good.
   - However, `assignTechnicianAction` allows re-assigning the same technician or changing technicians without checking whether the status or technician actually changed before firing potential notifications.
4. **Customer Cancellation Multiplicity:**
   - Cancellations can occur via:
     1. `cancelCustomerBookingAction` in `app/actions/bookings/customer.ts`
     2. `cancelBookingAction` in `app/actions/bookings/admin.ts`
     3. `DELETE /api/bookings/[id]`
     4. `PUT /api/bookings/[id]`
     5. `PATCH /api/admin/bookings/[id]`
   - Currently, none of the customer-facing cancellation routes send notifications. When implementing `BOOKING_CANCELLED` SMS, notification logic must be centralized in a single domain layer or guarded by an `oldStatus !== "cancelled"` check to avoid duplicate messages.

---

## 17. Transaction and Ordering Analysis

### Current Architectural Pattern:
In all audited business flows, notifications strictly adhere to the following sequence:
```
1. Validate Request / Schema
2. Check Authorization / Permissions
3. Execute Database Mutation (or Prisma $transaction)
4. Database Commit
5. NON-BLOCKING Notification Trigger (try/catch or Promise.allSettled)
6. Return Success Response to Client
```

### Verification Against Core Rule:
- **Notifications are NEVER executed inside database transactions.**
- In `POST /api/bookings`, the transaction `await prisma.$transaction(...)` resolves completely on line 180 before `sendBookingConfirmation()` is invoked on line 194.
- In `POST /api/admin/bookings/[id]`, the transaction commits on line 112 before `sendStatusUpdate()` is called on line 131.
- In `app/actions/bookings/quote.ts`, `prisma.booking.update()` completes on line 57 before `sendQuoteReadyNotification()` is triggered on line 82.

**Conclusion:** The codebase already adheres to the safe pattern:
$$\text{State Change} \longrightarrow \text{DB Commit} \longrightarrow \text{Notification Event} \longrightarrow \text{SMS Dispatch}$$

---

## 18. Privacy / Data Exposure Considerations

### 18.1 Admin SMS vs Customer SMS Data Minimization

| Data Attribute | Admin / Dispatch SMS | Customer SMS | Rationale |
|---|---|---|---|
| **Customer Name** | Full Name | First Name or Salutation | Admin needs full name; customer only needs confirmation. |
| **Customer Phone** | Full Phone Number | Masked or Omitted | Admin needs to contact customer directly. |
| **Customer Full Address** | Included with GPS Map link | Brief Address (e.g. City / Street) | Admin/Tech needs navigation; customer knows where they are. |
| **Technician Personal Phone** | Internal record only | **STRICTLY FORBIDDEN** | Protects technician privacy. Must display `BUSINESS_PHONE_DISPLAY`. |
| **Technician Name** | Full Name | First Name only (e.g., "Mike") | Sufficient for customer peace of mind. |
| **Pricing / Line Items** | Internal costs / totals | Customer Total & PDF link | Keeps SMS concise under 160 characters. |
| **Internal Database IDs** | Short ref (last 6 chars) | Short ref (last 6 chars) | Avoid exposing full raw UUIDs in text messages. |

---

## 19. Proposed Future Notification Matrix

*Note: This is a proposed design matrix based on audit findings for review before Phase 2. Do not implement in Phase 1.*

| Event | Recipient | Priority | Required Data Payload | Current Support | Proposed Future Work |
|---|---|---|---|---|---|
| **`BOOKING_CREATED`** | **Admin** | **HIGH** | Customer Name, Phone, Vehicle, Service, Full Location, Google Maps URL, Booking Date/Time | Supported (sent to Tech phone) | Re-target recipient to dedicated Admin/Dispatch phone; standardize maps link. |
| **`BOOKING_CONFIRMED`** | **Customer** | **HIGH** | Customer Name, Service, Date/Time, Vehicle, Short Booking ID, Business Hotline | Partially Supported (email only; no SMS to customer) | Add customer SMS dispatch after admin confirms booking. |
| **`TECHNICIAN_ASSIGNED`** | **Customer** | **NORMAL** | Customer Name, Tech First Name, Service Date/Time, Business Hotline | Not Supported | Trigger SMS to customer upon `assignTechnicianAction`. |
| **`TECHNICIAN_EN_ROUTE`** | **Customer** | **HIGH** | Customer Name, Tech First Name, ETA Minutes, Live Tracking Link, Business Hotline | Not Supported | Add trigger upon technician initiating route / starting GPS stream. |
| **`TECHNICIAN_ARRIVED`** | **Customer** | **NORMAL** | Customer Name, Tech First Name, Arrival confirmation, Safety instructions | Not Supported | Add customer SMS trigger in `markTechnicianArrivedAction`. |
| **`SERVICE_STARTED`** | **Customer** | **NORMAL** | Customer Name, Vehicle, Estimated service duration (e.g. 45 min) | Not Supported | Add customer SMS trigger in `startServiceAction`. |
| **`SERVICE_COMPLETED`** | **Customer** | **HIGH** | Customer Name, Service Name, Total Amount, Account/Receipt Link, Business Hotline | Supported (`quote_ready`) | Retain existing `sendQuoteReadyNotification` template and flow. |
| **`EMERGENCY_REQUEST_CREATED`** | **Admin** | **CRITICAL** | Customer Name, Phone, Vehicle, Problem Description, Location, Google Maps URL | Supported (sent to Tech phone) | Ensure immediate dispatch; provide turn-by-turn navigation link. |
| **`CONTACT_REQUEST_CREATED`** | **Admin** | **NORMAL** | Name, Phone, Email, Service, Message snippet | Not Supported | Add admin SMS alert in `POST /api/contact-messages`. |
| **`BOOKING_CANCELLED`** | **Customer & Admin** | **HIGH** | Booking ID, Customer Name, Vehicle, Cancellation Reason | Partially Supported (email only) | Add bidirectional SMS alert on all cancellation paths. |

---

## 20. Required Future Changes

### Must Change (in Implementation Phase)
1. **Unify Admin Booking Actions with Notifications:**  
   In [`app/actions/bookings/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts), attach notification events to `confirmBookingAction`, `startServiceAction`, `assignTechnicianAction`, and `cancelBookingAction` after database commits.
2. **Implement Customer SMS for Booking Confirmation:**  
   Create customer SMS dispatch for confirmed bookings instead of relying solely on email.
3. **Add Contact Form Admin Notification:**  
   In [`app/api/contact-messages/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/contact-messages/route.ts), emit an admin SMS notification after message insertion.
4. **Mask Technician Phone:**  
   Ensure technician personal phone numbers are never returned in customer SMS templates or customer API responses; replace with `BUSINESS_PHONE_DISPLAY`.
5. **Separate Admin vs Technician Phone Configuration:**  
   Introduce explicit `ADMIN_NOTIFICATION_PHONE` configuration to prevent admin alerts from conflating with technician mobile devices.

### Should Change
1. **Centralize Google Maps URL Generator:**  
   Create a reusable helper (`lib/utils/maps.ts`) that outputs `https://www.google.com/maps/dir/?api=1&destination=lat,lng` when coordinates are available, and query search otherwise.
2. **Centralize SMS Template Engine:**  
   Consolidate all SMS message string construction into a dedicated module (`lib/sms/templates.ts`).
3. **Clean Up Dead Code in `lib/sms.ts`:**  
   Remove or re-route uncalled functions (`sendQuoteSms`, `sendBookingRequestSms`) in `lib/sms.ts` that bypass `NotificationLog`.

### Optional
1. **Admin Notification Preference Model:**  
   Add database or configuration-level flags to enable/disable specific SMS notifications (e.g. disable Contact Form SMS during off-hours).
2. **Short URL Service for Tracking Links:**  
   Implement a short link redirector for live van tracking URLs to keep SMS under standard 160-character GSM limits.

### No Change Required
1. **SMS Provider Factory & Providers:**  
   [`lib/sms/index.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/index.ts) and [`lib/sms/providers/android-gateway.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/providers/android-gateway.ts) are fully functioning and require zero changes.
2. **SMS Webhook Verification & Delivery Tracking:**  
   [`lib/sms/webhook-verification.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/webhook-verification.ts) and [`app/api/webhooks/sms-gateway/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/webhooks/sms-gateway/route.ts) require zero changes.
3. **Notification Retry Worker:**  
   [`lib/notifications.ts:839-933`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L839-L933) correctly handles atomic claiming and status preservation.

---

## 21. Files That Must NOT Be Changed During Initial Implementation

To preserve system stability, the following core business and infrastructural files should remain untouched:

1. [`lib/bookings/state-machine.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/bookings/state-machine.ts): The authoritative state machine governs all role permissions and state transitions.
2. [`lib/sms/webhook-verification.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/webhook-verification.ts): Cryptographic HMAC verification and replay protection.
3. [`app/api/webhooks/sms-gateway/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/webhooks/sms-gateway/route.ts): Handles inbound delivery reports with terminal state guards.
4. [`lib/sms/providers/android-gateway.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/providers/android-gateway.ts): Telecom carrier and Android SIM provider driver.
5. [`lib/technician-auth.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/technician-auth.ts): HMAC dispatch token cryptography.
6. [`prisma/schema.prisma`](file:///d:/Tire-Services/tire-mobile-clinic-next/prisma/schema.prisma): Existing schema adequately supports all required notification logs and booking fields.

---

## 22. Risks and Edge Cases

1. **SMS Gateway Offline / Power Loss:**  
   Android devices may experience battery exhaustion or network drops. The existing architecture gracefully degrades: HTTP dispatch times out after 4000ms, logs as `FAILED`, and the retry worker picks it up on the next cycle without crashing the user flow.
2. **Missing Customer Phone Number:**  
   Some legacy or guest requests may have missing or invalid phone numbers. The system must validate phone presence and E.164 compliance before dispatching to avoid unnecessary failed log entries.
3. **Carrier Delivery Failure vs Dispatch Failure:**  
   If the recipient’s phone is disconnected or roaming, the gateway marks `deliveryStatus = "FAILED"`. The retry worker correctly avoids re-dispatching carrier failures because `status` remains `"SENT"`.
4. **Duplicate Submissions via Double Click / Network Lag:**  
   Client form submissions without debouncing could invoke Server Actions twice. Unique idempotency keys (e.g. `sms_${type}_${bookingId}`) mitigate gateway duplication.
5. **Concurrent Admin Actions:**  
   If two admins confirm or assign a booking simultaneously, database updates are serialized by Prisma, but duplicate notifications could trigger unless guarded by `oldStatus !== newStatus` checks.

---

## 23. Implementation Dependency Map

```
Business Event Trigger
       │
       ▼
Existing Server Action / Route
 (e.g. confirmBookingAction)
       │
       ▼
Database State Update Committed
 (e.g. status: "confirmed")
       │
       ▼
Future Notification Dispatcher
 (e.g. emitBookingConfirmedEvent)
       │
       ├──► Resolve Recipient (Customer Phone vs Admin Phone)
       ├──► Construct Message via Centralized Template
       │
       ▼
dispatchSms() / sendSms()
       │
       ├──► AndroidGatewayProvider (HTTP Post to Android SIM Device)
       └──► Prisma NotificationLog Created (status: "SENT" | "FAILED")
                 │
                 ▼ (Async Callback via Carrier SMSC)
           /api/webhooks/sms-gateway
                 │
                 ▼
           Update NotificationLog (deliveryStatus: "DELIVERED")
```

---

## 24. Recommended Implementation Order

For future phases, the following sequential implementation order is recommended to minimize risk:

1. **Phase 2:** Review and approve the Phase 1 Read-Only Audit with stakeholders.
2. **Phase 3A (Infrastructure & Templates):**
   - Create centralized template helper (`lib/sms/templates.ts`).
   - Create Google Maps navigation URL generator (`lib/utils/maps.ts`).
   - Define dedicated recipient resolution helpers (Admin vs Customer).
3. **Phase 3B (Admin Notifications):**
   - Wire `CONTACT_REQUEST_CREATED` admin SMS in `app/api/contact-messages/route.ts`.
   - Update `EMERGENCY_REQUEST_CREATED` and `BOOKING_CREATED` admin SMS formatting with turn-by-turn map links.
4. **Phase 3C (Customer Notifications):**
   - Wire `BOOKING_CONFIRMED` customer SMS in `confirmBookingAction`.
   - Wire `TECHNICIAN_ASSIGNED` customer SMS in `assignTechnicianAction`.
   - Wire `TECHNICIAN_ARRIVED` customer SMS in `markTechnicianArrivedAction`.
   - Wire `BOOKING_CANCELLED` customer & admin SMS across cancellation paths.
5. **Phase 4 (Testing & Verification):**
   - Unit tests for template rendering and map link generation.
   - Integration tests simulating end-to-end booking state changes and asserting `NotificationLog` entries.
6. **Phase 5 (Review):** Final operational review.

---

## 25. Read-Only Verification

- **Inspected Files:**
  - `prisma/schema.prisma`
  - `lib/notifications.ts`
  - `lib/sms.ts`
  - `lib/sms/index.ts`
  - `lib/sms/types.ts`
  - `lib/sms/providers/android-gateway.ts`
  - `lib/sms/providers/simulated.ts`
  - `lib/sms/webhook-verification.ts`
  - `lib/bookings/state-machine.ts`
  - `lib/constants/phone.ts`
  - `app/actions/notifications.ts`
  - `app/actions/bookings.ts`
  - `app/actions/bookings/customer.ts`
  - `app/actions/bookings/admin.ts`
  - `app/actions/bookings/technician.ts`
  - `app/actions/bookings/quote.ts`
  - `app/api/bookings/route.ts`
  - `app/api/bookings/[id]/route.ts`
  - `app/api/admin/bookings/route.ts`
  - `app/api/admin/bookings/[id]/route.ts`
  - `app/api/emergency-requests/route.ts`
  - `app/api/contact-messages/route.ts`
  - `app/api/technician/location/route.ts`
  - `app/api/webhooks/sms-gateway/route.ts`
  - `app/api/notifications/retry/route.ts`
  - `app/(admin-portal)/admin/bookings/page.tsx`
  - `app/technician/page.tsx`
  - `app/technician/tracking/[bookingId]/page.tsx`
  - `tests/unit/android-gateway.test.mjs`
  - `tests/unit/notification-retry-reliability.test.mjs`
  - `tests/unit/webhook-verification.test.mjs`
  - `tests/integration/sms-delivery-webhook.test.mjs`
  - `.env.example`
- **Modifications Performed:** NONE.
- **Source Code Altered:** NONE.
- **Database Changed:** NO.
- **Migrations Created:** NO.
- **Dependencies Installed/Changed:** NO.

---

# PHASE 1 STATUS

**AUDIT STATUS:**  
PASS WITH FINDINGS

**FILES MODIFIED:**  
NONE

**IMPLEMENTATION PERFORMED:**  
NONE

**DATABASE CHANGED:**  
NO

**MIGRATIONS CREATED:**  
NO

**DEPENDENCIES CHANGED:**  
NO

---

### Critical Findings to Review Before Phase 2:
1. **Server Action vs API Route Discrepancy:** The Admin UI invokes Server Actions (`confirmBookingAction`, `startServiceAction`, etc.), which currently contain **no notification dispatch logic**. Meanwhile, the dormant `PATCH /api/admin/bookings/[id]` route does contain notifications. All future notifications must be hooked into the Server Actions, not just the API routes.
2. **Missing Contact Form Notification:** `POST /api/contact-messages` has no notification trigger whatsoever.
3. **Technician Phone Privacy:** `Technician.phone` exists in the database and is currently leaked in `/api/bookings/[id]`. In all customer SMS notifications, the business dispatch number (`BUSINESS_PHONE_DISPLAY`) must be used instead of the technician's personal number.
4. **Customer SMS Omission:** Customers currently receive emails for confirmations and status updates; SMS to customers is only sent when an invoice/quote is finalized (`quote_ready`). Customer SMS needs to be added for `BOOKING_CONFIRMED`, `TECHNICIAN_ASSIGNED`, and `TECHNICIAN_ARRIVED`.
5. **Dedicated Admin Phone Configuration:** The codebase currently uses `TECHNICIAN_PHONE_NUMBER` as the default destination for admin dispatch alerts. A dedicated `ADMIN_NOTIFICATION_PHONE` setting should be introduced.
