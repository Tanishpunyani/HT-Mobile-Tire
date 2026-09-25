# PHASE 2 — HT MOBILE SMS NOTIFICATION SYSTEM
## NOTIFICATION MATRIX & IMPLEMENTATION PLANNING REPORT

**Project:** HT Mobile Services / HT Mobile Tyres  
**Codebase:** `tire-mobile-clinic-next`  
**Phase:** Phase 2 — Read-Only Notification Architecture & Implementation Planning  
**Execution Mode:** STRICT READ-ONLY — NO SOURCE CODE OR DATABASE MUTATIONS  
**Date:** September 2026  

---

## 1. Phase 2 Objective

Phase 1 established an authoritative baseline of the existing notification and SMS infrastructure with an audit result of **PASS WITH FINDINGS**. 

The objective of **Phase 2** is to produce a comprehensive, battle-tested blueprint that transitions the HT Mobile Services application from its current fragmented notification state to a unified, reliable business notification system.

This plan addresses:
1. Exact recipient segregation (**Admin / Dispatch** vs. **Customer** vs. **Technician**).
2. The authoritative single-trigger mapping for each business event.
3. Strict duplicate prevention across Next.js Server Actions and REST API routes.
4. Privacy boundaries protecting technician personal telemetry and phone numbers.
5. Standardized Google Maps turn-by-turn navigation URLs.
6. A centralized SMS template catalog tailored for real cellular carrier constraints.
7. A step-by-step, low-risk Phase 3 file implementation plan and test matrix.

> **CRITICAL RULE:** This report is strictly analytical and architectural. **Zero code or database changes have been performed during this phase.**

---

## 2. Phase 1 Findings Incorporated

This planning document incorporates all key findings discovered during the Phase 1 audit:

1. **SMS Gateway Driver Ready:** [`lib/sms/index.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/index.ts), [`lib/sms/providers/android-gateway.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/providers/android-gateway.ts), and the HMAC webhook in [`app/api/webhooks/sms-gateway/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/webhooks/sms-gateway/route.ts) are production-ready and will remain untouched.
2. **Server Action vs. API Divergence:** The Admin UI relies entirely on Next.js Server Actions ([`app/actions/bookings/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts)), which currently contain **zero notification triggers**. Conversely, the unused `PATCH /api/admin/bookings/[id]` route contains notifications. Phase 3 must place triggers inside Server Actions while preventing duplicate fires if the REST API is called.
3. **Contact Form Silent Ingestion:** `POST /api/contact-messages` saves to the database but fires zero alerts.
4. **Technician Personal Phone Exposure:** The database field `Technician.phone` exists and must never be transmitted in customer SMS or customer tracking payloads.
5. **Inverted Recipient Logic:** Central dispatch notifications have historically been sent to `TECHNICIAN_PHONE_NUMBER` (or fallback `BUSINESS_PHONE_RAW`). Phase 3 must introduce explicit separation via `ADMIN_NOTIFICATION_PHONE`.
6. **Dead Code Elimination:** Functions in [`lib/sms.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms.ts) (`sendQuoteSms` and `sendBookingRequestSms`) are unreferenced and bypass `NotificationLog`.

---

## 3. Current Notification Architecture

The current notification flow is structured as follows:

```
┌────────────────────────────────────────────────────────┐
│                   Business Trigger                     │
│  (Customer Form, Emergency API, Admin Server Actions)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               Database Mutation & Commit               │
│          (Prisma $transaction / update)                │
└───────────────────────────┬────────────────────────────┘
                            │ (Post-Commit / Non-blocking)
                            ▼
┌────────────────────────────────────────────────────────┐
│               High-Level Dispatcher Hub                │
│               (lib/notifications.ts)                   │
├───────────────────────────┬────────────────────────────┤
│         sendSms()         │        sendEmail()         │
└─────────────┬─────────────┴─────────────┬──────────────┘
              │                           │
              ▼                           ▼
┌───────────────────────────┐ ┌──────────────────────────┐
│   dispatchSms()           │ │ Resend SDK               │
│   (lib/sms/index.ts)      │ │ (HTML templates)         │
├───────────────────────────┤ └───────────┬──────────────┘
│ AndroidGatewayProvider    │             │
│ (SIM / Capcom6 HTTP Post) │             │
└─────────────┬─────────────┘             │
              │                           │
              ▼                           ▼
┌────────────────────────────────────────────────────────┐
│            Prisma: notification_logs Table             │
│  (Records messageId, status: SENT/FAILED, recipient)   │
└────────────────────────────────────────────────────────┘
```

### Existing Strengths to Preserve:
- Strict non-blocking execution via `try/catch` and `Promise.allSettled`.
- Explicit separation between dispatch status (`SENT` / `FAILED`) and carrier delivery status (`DELIVERED` / `FAILED` / `CANCELLED`).
- Concurrency-safe atomic retry worker using row-level increment locks.

---

## 4. Proposed Notification Event Model

To decouple business actions from SMS string formatting and delivery channels, Phase 3 will introduce a unified domain event model:

```typescript
export type NotificationEventName =
  | "BOOKING_CREATED"
  | "BOOKING_CONFIRMED"
  | "TECHNICIAN_ASSIGNED"
  | "TECHNICIAN_EN_ROUTE"
  | "TECHNICIAN_ARRIVED"
  | "SERVICE_STARTED"
  | "SERVICE_COMPLETED"
  | "EMERGENCY_REQUEST_CREATED"
  | "CONTACT_REQUEST_CREATED"
  | "BOOKING_CANCELLED";
```

### Event Payload Schema
Every event will emit a standardized, strongly typed payload containing:
- `eventId`: Unique event execution ID (`evt_<timestamp>_<rand>`).
- `entityId`: UUID of the booking, emergency request, or contact message.
- `entityType`: `"booking"` | `"emergency_request"` | `"contact_message"`.
- `data`: Complete entity snapshot (Customer, Service, Technician, Location).
- `metadata`: Trigger source (`"server_action"` | `"api_route"`), actor role (`"customer"` | `"admin"` | `"technician"`).

---

## 5. Definitive Notification Matrix

| Event | Authoritative Trigger | Recipient | Priority | Required Data | SMS? | Email? | Existing Status | Phase 3 Action |
|---|---|---|---|---|---|---|---|---|
| **`BOOKING_CREATED`** | `createBookingRequestAction` (`app/actions/bookings/customer.ts`) | **Admin / Dispatch** | **HIGH** | Customer name, phone, vehicle, service, address, lat/lng, date, time, notes | **YES** | **YES** (to Cust) | Dispatches SMS to Tech phone + Email to Customer | Retarget SMS to Admin phone with turn-by-turn Google Maps link; keep customer email. |
| **`BOOKING_CONFIRMED`** | `confirmBookingAction` (`app/actions/bookings/admin.ts`) | **Customer** | **HIGH** | Customer name, phone, service, date, time, vehicle, short booking ID, business phone | **YES** | **YES** | Server Action sends **nothing**; API PATCH sends Tech SMS + Cust Email | Wire customer SMS in `confirmBookingAction` upon `pending -> confirmed` transition. |
| **`TECHNICIAN_ASSIGNED`** | `assignTechnicianAction` (`app/actions/bookings/admin.ts`) | **Customer** | **HIGH** | Customer name, phone, technician first name, service, date/time, short booking ID, business phone | **YES** | **NO** | Server Action sends **nothing** | Wire customer SMS in `assignTechnicianAction` upon successful technician assignment. |
| **`TECHNICIAN_EN_ROUTE`** | Explicit "Start Trip" or first GPS stream start (`app/actions/bookings/technician.ts`) | **Customer** | **HIGH** | Customer name, phone, tech first name, service, calculated ETA, live tracking link, business phone | **YES** | **NO** | **NOT FOUND** (no event exists) | Implement explicit trip departure trigger with customer SMS containing live tracking URL. |
| **`TECHNICIAN_ARRIVED`** | `markTechnicianArrivedAction` (`app/actions/bookings/technician.ts`) | **Customer** | **NORMAL** | Customer name, phone, tech first name, service, vehicle, business phone | **YES** | **NO** | Updates `arrivedAt` in DB, sends **nothing** | Wire customer SMS in `markTechnicianArrivedAction` after setting `arrivedAt`. |
| **`SERVICE_STARTED`** | `startServiceAction` (`app/actions/bookings/admin.ts`) | **Customer** | **NORMAL** | Customer name, phone, vehicle, service, estimated duration (45m) | **OPTIONAL** | **NO** | Sets `status: in_progress`, sends **nothing** | Evaluate omission to prevent SMS fatigue (since `ARRIVED` was just sent). |
| **`SERVICE_COMPLETED`** | `completeAndQuoteAction` (`app/actions/bookings/quote.ts`) | **Customer** | **HIGH** | Customer name, phone, service, vehicle, total amount, account URL, business phone | **YES** | **YES** | `sendQuoteReadyNotification` sends SMS + Email to Customer | Retain existing `quote_ready` SMS. Harmonize into unified event. |
| **`EMERGENCY_REQUEST_CREATED`** | `POST /api/emergency-requests` (`app/api/emergency-requests/route.ts`) | **Admin / Dispatch** | **CRITICAL** | Customer name, phone, problem, vehicle, address, lat/lng, notes | **YES** | **YES** (to Cust) | Dispatches priority SMS to Tech phone + Email to Customer | Retarget SMS to Admin phone with turn-by-turn Google Maps URL; keep customer email. |
| **`CONTACT_REQUEST_CREATED`** | `POST /api/contact-messages` (`app/api/contact-messages/route.ts`) | **Admin / Dispatch** | **NORMAL** | Name, phone, email, service, location, emergency flag, message | **YES** | **NO** | Saves to DB, sends **nothing** | Add admin SMS dispatch immediately after contact message database commit. |
| **`BOOKING_CANCELLED`** | `cancelCustomerBookingAction` & `cancelBookingAction` | **Customer & Admin** | **HIGH** | Customer name, phone, service, vehicle, date, cancel reason, short ID | **YES** | **YES** (Cust Email) | Server Actions send **nothing**; API PATCH sends Tech SMS + Cust Email | Wire bidirectional SMS: notify Customer of cancellation; notify Admin if cancelled by Customer. |

---

## 6. Authoritative Trigger Map

A major vulnerability identified in Phase 1 was trigger multiplicity (Server Actions vs. API routes). Phase 3 will designate **exactly one authoritative entry point** per event:

```
Event                         Authoritative File & Function                               Primary Invoker
──────────────────────────────────────────────────────────────────────────────────────────────────────────
BOOKING_CREATED               app/actions/bookings/customer.ts -> createBookingRequestAction  Customer Booking Form Client
BOOKING_CONFIRMED             app/actions/bookings/admin.ts    -> confirmBookingAction        Admin Bookings Management UI
TECHNICIAN_ASSIGNED           app/actions/bookings/admin.ts    -> assignTechnicianAction      Admin Bookings Management UI
TECHNICIAN_EN_ROUTE           app/actions/bookings/technician.ts -> startTechnicianTripAction  Technician Portal (Start Route)
TECHNICIAN_ARRIVED            app/actions/bookings/technician.ts -> markTechnicianArrivedAction Technician Portal ("I Have Arrived")
SERVICE_STARTED               app/actions/bookings/admin.ts    -> startServiceAction          Admin Bookings Management UI
SERVICE_COMPLETED             app/actions/bookings/quote.ts    -> completeAndQuoteAction      Admin Invoicing Modal
EMERGENCY_REQUEST_CREATED     app/api/emergency-requests/route.ts -> POST                      Public Emergency Roadside Form
CONTACT_REQUEST_CREATED       app/api/contact-messages/route.ts   -> POST                      Public Contact Ingestion Form
BOOKING_CANCELLED (Cust)      app/actions/bookings/customer.ts -> cancelCustomerBookingAction Customer Account Dashboard
BOOKING_CANCELLED (Admin)     app/actions/bookings/admin.ts    -> cancelBookingAction         Admin Bookings Management UI
```

### Protection Against Secondary API Triggers
- `POST /api/bookings`: Will call the exact same domain dispatcher `emitBookingCreated()` but pass an idempotency header check.
- `PATCH /api/admin/bookings/[id]`: Refactored to delegate directly to the respective Server Action (`confirmBookingAction`, etc.) to eliminate code divergence.

---

## 7. Booking Notification Architecture

### Flow: New Booking Creation (`BOOKING_CREATED`)
```
Customer submits form
         ↓
createBookingRequestAction (Validates capacity, resolves customer)
         ↓
prisma.booking.create()
         ↓
Database Commit (Booking ID generated)
         ↓
emitBookingCreatedNotification(bookingId) [NON-BLOCKING]
         ├──► Admin SMS dispatched to ADMIN_NOTIFICATION_PHONE
         └──► Customer Confirmation Email dispatched via Resend
         ↓
Client receives { success: true, bookingId }
```

### Flow: Booking Confirmation (`BOOKING_CONFIRMED`)
```
Admin clicks "Confirm Appointment"
         ↓
confirmBookingAction(bookingId)
         ↓
validateBookingTransition(booking.status, "confirmed", "admin")
         ↓
prisma.booking.update({ status: "confirmed", serviceConfirmedAt: now() })
         ↓
Database Commit
         ↓
emitBookingConfirmedNotification(bookingId) [NON-BLOCKING]
         └──► Customer SMS dispatched: "Hi [Name], your HT Mobile Tires service has been confirmed..."
         ↓
Admin UI updates via revalidatePath()
```

---

## 8. Technician Notification Architecture

### En Route State Milestone Selection Analysis

Phase 1 revealed that `en_route` is not an explicit database state. Four architectural options were evaluated for Phase 2:

| Option | Description | Code Support | Duplicate Risk | Recommendation |
|---|---|---|---|---|
| **A: First GPS Ping** | Trigger SMS on first `POST /api/technician/location` | Exists | **EXTREMELY HIGH:** GPS jitter, app restarts, or signal drops cause repeated SMS. | **REJECTED** |
| **B: Explicit "Start Trip" Action** | Dedicated button in Tech Portal: *"Start Route / On My Way"* | Minor addition | **LOWEST:** Explicit, human-initiated single trigger. | **RECOMMENDED FOR PHASE 3** |
| **C: Derived State from UI** | Infer en-route when customer opens tracking map | Partial | **UNRELIABLE:** Dependent on customer browsing behavior. | **REJECTED** |
| **D: New DB Status `en_route`** | Alter Prisma schema to add `en_route` to `BookingStatus` | Requires migration | **MEDIUM:** Breaks existing state machine (`confirmed -> in_progress`). | **REJECTED (Avoids DB schema change)** |

### Phase 3 En Route Strategy:
Phase 3 will adopt **Option B**:
- Create a non-breaking Server Action `startTechnicianTripAction(bookingId, token)`.
- It verifies the technician dispatch token, confirms the booking is in `confirmed` status, sets a flag or initial timestamp, and fires `TECHNICIAN_EN_ROUTE` customer SMS **exactly once**.
- The existing state machine (`confirmed -> in_progress`) remains 100% untouched.

### Flow: Technician Arrival (`TECHNICIAN_ARRIVED`)
```
Technician clicks "I Have Arrived" on-site
         ↓
markTechnicianArrivedAction(bookingId, token)
         ↓
Validates token & booking status
         ↓
prisma.booking.update({ arrivedAt: now(), status: "in_progress" })
         ↓
Database Commit
         ↓
emitTechnicianArrivedNotification(bookingId) [NON-BLOCKING]
         └──► Customer SMS dispatched: "Our mobile technician [TechName] has arrived at your location..."
         ↓
Tech UI confirms arrival state
```

---

## 9. Emergency Notification Architecture

Emergency roadside assistance requests require the lowest possible latency and highest delivery assurance:

```
Customer submits Emergency Form
         ↓
POST /api/emergency-requests (Validates emergencySchema, IP rate limit 5/min)
         ↓
prisma.emergencyRequest.create({ status: "pending", ... })
         ↓
Database Commit
         ↓
emitEmergencyAlertNotification(emergencyId) [NON-BLOCKING]
         ├──► Immediate Priority SMS to ADMIN_NOTIFICATION_PHONE:
         │    "🚨 [EMERGENCY DISPATCH] Problem: FLAT TIRE. Customer: John (214-555-0199). Map: https://maps.google.com/..."
         └──► Resend Branded HTML Email to customer with 30-45m ETA banner
         ↓
Client receives HTTP 201 { success: true, emergencyRequest }
```

- **Priority:** `CRITICAL`
- **Idempotency Key:** `sms_emergency_${emergencyId}`
- **Carrier SIM Routing:** Explicitly assigned to primary SIM (`simSlot = 0`).

---

## 10. Contact Notification Architecture

Phase 1 confirmed that `POST /api/contact-messages` currently saves to the database without sending any notification.

### Phase 3 Integration:
```
Customer submits Contact Form
         ↓
POST /api/contact-messages (Validates contactSchema, IP rate limit 5/min)
         ↓
prisma.contactMessage.create({ status: "new", ... })
         ↓
Database Commit (Message ID generated)
         ↓
emitContactMessageNotification(messageId) [NON-BLOCKING]
         └──► Admin SMS dispatched to ADMIN_NOTIFICATION_PHONE:
              "[HT MOBILE CONTACT] From: Jane Doe (214-555-0199). Service: Tire Replacement. Msg: Need 4 tires replaced..."
         ↓
Client receives HTTP 201 { success: true, contactMessage }
```

- **Priority:** `NORMAL`
- **Duplicate Protection:** Idempotency key `sms_contact_${messageId}` prevents multiple dispatches on form resubmissions.

---

## 11. Cancellation Notification Architecture

Cancellations occur through both customer and admin paths:

```
Customer Cancels via Account Dashboard             Admin Cancels via Bookings Portal
         │                                                         │
         ▼                                                         ▼
cancelCustomerBookingAction()                             cancelBookingAction()
         │                                                         │
         └─────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
             validateBookingTransition(status, "cancelled")
                                   │
                                   ▼
                prisma.booking.update({ status: "cancelled" })
                                   │
                                   ▼
                            Database Commit
                                   │
                                   ▼
              emitBookingCancelledNotification(bookingId, cancelledBy)
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
         Customer SMS                               Admin SMS
    (If cancelled by Admin:                    (If cancelled by Customer:
   "Your booking has been                     "Customer Jane cancelled
  cancelled. Call 800-555-8473")              Booking #A1B2C3. Reason: ...")
```

- **Duplicate Guard:** Checks `oldStatus !== "cancelled"`. If the booking is already cancelled, the notification call is a strict no-op.

---

## 12. Admin Recipient Architecture

### Recipient Configuration Strategy
The audit proved that using `TECHNICIAN_PHONE_NUMBER` for admin alerts is risky because the technician on duty is not always the central business administrator.

Phase 3 will establish the following environment variable hierarchy:

```
1. process.env.ADMIN_NOTIFICATION_PHONE   <-- Primary dedicated destination for admin alerts
2. process.env.DISPATCH_PHONE_NUMBER       <-- Secondary backward-compatible fallback
3. process.env.TECHNICIAN_PHONE_NUMBER     <-- Legacy fallback
```

### Safety Rules for Admin Notifications:
1. **Server-Side Only:** `ADMIN_NOTIFICATION_PHONE` must never be prefixed with `NEXT_PUBLIC_` to prevent leaking it to client browser bundles.
2. **Never Route to Inbound Business Hotline:** `BUSINESS_PHONE_RAW` (`+18005558473`) must **NEVER** be used as a notification destination. Sending SMS to your own inbound voice hotline will result in carrier rejection.
3. **Safe Missing Fallback:** If no admin phone number is configured, the system must log an operational warning via Winston and gracefully exit without throwing exceptions or blocking the user transaction.

---

## 13. Customer Recipient Architecture

1. **Phone Number Discovery:**
   - Primary: `booking.customer.phone` or `emergency.customer.phone`.
   - Fallback: `user.phone` from Supabase session metadata.
2. **Format Normalization:**
   - All recipient numbers must pass through `normalizePhoneToE164()` before dispatch.
   - 10-digit US numbers (`2145550199`) automatically normalize to `+12145550199`.
3. **Missing Phone Handling:**
   - If a customer record lacks a valid phone number, SMS dispatch is safely bypassed, a `NotificationLog` entry is written with `status = "FAILED"` and `errorMessage = "Missing valid customer phone"`, and email dispatch proceeds normally.

---

## 14. Technician Privacy Rules

### STRICT PRIVACY CONSTRAINTS
1. **Technician Personal Phone Number Must Never Be Exposed:**
   - The field `Technician.phone` in PostgreSQL stores the technician's private cell phone.
   - **RULE:** Under no circumstances may `technician.phone` be included in customer SMS messages.
   - **RULE:** In all customer communications, the contact phone must be hardcoded to `BUSINESS_PHONE_DISPLAY` (`(800) 555-TIRE (8473)`).
2. **Technician Name Minimization:**
   - Customer SMS will only use the technician's first name (e.g. `"Your technician, Marcus, is on the way"`), omitting full legal surnames where appropriate.
3. **Separate Follow-up on API Exposure:**
   - As documented in Phase 1, [`app/api/bookings/[id]/route.ts:92`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/%5Bid%5D/route.ts#L92) currently leaks `booking.technician.phone` in the JSON response.
   - **Phase 2 Decision:** Mark as **SEPARATE FOLLOW-UP**; Phase 3 SMS implementation will strictly consume `BUSINESS_PHONE_DISPLAY` in all message templates.

---

## 15. Google Maps Link Strategy

### Centralized Utility Specification
Rather than repeating inline query string formatting across multiple files, Phase 3 will introduce a dedicated, pure helper:

- **File:** `lib/utils/maps.ts`
- **Function:** `buildGoogleMapsUrl(params: MapsUrlParams): string`

```typescript
export interface MapsUrlParams {
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
  location?: string | null;
}

export function buildGoogleMapsUrl({
  latitude,
  longitude,
  formattedAddress,
  location,
}: MapsUrlParams): string {
  // 1. If GPS coordinates exist, generate a turn-by-turn navigation URL
  if (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }

  // 2. Fallback to geocoded formatted address or raw location query
  const targetAddress = formattedAddress?.trim() || location?.trim() || "";
  if (targetAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(targetAddress)}`;
  }

  // 3. Absolute fallback
  return "https://www.google.com/maps";
}
```

---

## 16. SMS Template Architecture

Templates will be isolated in a centralized catalog: [`lib/sms/templates.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/templates.ts).

### Message Length & GSM Encoding Budget:
- Standard single-part GSM-7 limit: **160 characters**.
- Multi-part concatenated SMS limit: **153 characters per segment**.
- **Rule:** Customer status messages should ideally fit within 1 segment (≤ 160 chars) or max 2 segments (≤ 306 chars).
- Admin dispatch alerts are informational multi-part messages (2–3 segments, ~300–450 chars).

### Catalog Specifications:

#### 1. Admin — New Booking Alert
```
[NEW BOOKING - HT MOBILE]
Customer: {name} ({phone})
Service: {service} ({vehicle})
Time: {date} at {time}
Address: {address}
Nav: {mapsUrl}
Ref: #{shortId}
```
*Budget: ~250–320 chars (2 segments)*

#### 2. Admin — Emergency Roadside Alert
```
🚨 [EMERGENCY DISPATCH - HT MOBILE]
Problem: {problem}
Customer: {name} ({phone})
Vehicle: {vehicle}
Location: {address}
Nav: {mapsUrl}
```
*Budget: ~220–280 chars (2 segments)*

#### 3. Admin — Contact Form Message
```
[CONTACT FORM - HT MOBILE]
From: {name} ({phone})
Service: {service}
Location: {location}
Msg: "{shortMessage}"
```
*Budget: ~150–220 chars (1–2 segments)*

#### 4. Customer — Booking Confirmed
```
HT Mobile Tires: Hi {name}, your appointment for {service} ({vehicle}) on {date} at {time} is CONFIRMED. Booking #{shortId}. Questions? Call {businessPhone}.
```
*Budget: ~155–170 chars (1–2 segments)*

#### 5. Customer — Technician Assigned
```
HT Mobile Tires: Technician {techFirstName} has been assigned to your service on {date} at {time} (Booking #{shortId}). Questions? Call {businessPhone}.
```
*Budget: ~145–160 chars (1 segment)*

#### 6. Customer — Technician En Route
```
HT Mobile Tires: {techFirstName} is on the way to your location! Est. Arrival: {etaMinutes} mins. Track van: {trackingUrl} or call {businessPhone}.
```
*Budget: ~150–165 chars (1 segment)*

#### 7. Customer — Technician Arrived
```
HT Mobile Tires: Your technician, {techFirstName}, has arrived at your location for your {service}. Please ensure your vehicle is accessible.
```
*Budget: ~135–150 chars (1 segment)*

#### 8. Customer — Service Completed & Invoice Ready
```
[HT MOBILE TIRES]
Hi {name}, your tire service is complete! Total due: ${totalAmount}. View receipt: {accountUrl}. Questions? Call {businessPhone}.
```
*Budget: ~145–160 chars (1 segment)*

#### 9. Customer — Booking Cancelled
```
HT Mobile Tires: Your booking #{shortId} for {service} has been CANCELLED. If this was a mistake, please call {businessPhone} immediately.
```
*Budget: ~140–155 chars (1 segment)*

---

## 17. Notification Type Design

To maintain strict database alignment without requiring migrations, Phase 3 will standardize type strings stored in `NotificationLog.type`:

| Standard Type String | `entityType` | Category | Associated Event |
|---|---|---|---|
| `"booking_confirmation"` | `"booking"` | Customer Status | `BOOKING_CONFIRMED` |
| `"technician_dispatch"` | `"booking"` | Admin Operational | `BOOKING_CREATED` |
| `"technician_assigned"` | `"booking"` | Customer Status | `TECHNICIAN_ASSIGNED` |
| `"technician_en_route"` | `"booking"` | Customer Status | `TECHNICIAN_EN_ROUTE` |
| `"technician_arrived"` | `"booking"` | Customer Status | `TECHNICIAN_ARRIVED` |
| `"quote_ready"` | `"booking"` | Customer Invoicing | `SERVICE_COMPLETED` |
| `"booking_cancelled"` | `"booking"` | Customer / Admin | `BOOKING_CANCELLED` |
| `"emergency_alert"` | `"emergency_request"` | Admin Operational | `EMERGENCY_REQUEST_CREATED` |
| `"contact_alert"` | `"contact_message"` | Admin Operational | `CONTACT_REQUEST_CREATED` |

*Note: In `lib/sms/types.ts`, `NotificationType` will be expanded in TypeScript definitions without changing the database column (which is raw `String`).*

---

## 18. NotificationLog Strategy

`NotificationLog` is the single source of truth for all dispatch audits. Every SMS attempt must populate:

- `entityId`: UUID of the booking, emergency request, or contact message.
- `entityType`: `"booking"` | `"emergency_request"` | `"contact_message"`.
- `bookingId`: UUID populated if entity is a booking.
- `emergencyRequestId`: UUID populated if entity is an emergency request.
- `type`: Standard type string from Section 17.
- `channel`: `"sms"`.
- `recipient`: E.164 formatted phone number.
- `content`: Plaintext body.
- `status`: `"SENT"` if gateway returns 200/202; `"FAILED"` if timeout or HTTP error.
- `messageId`: Captured from gateway response payload (`data.id` or `data.messageId`).
- `deliveryStatus`: `null` initially; populated asynchronously via inbound delivery webhooks (`DELIVERED`, `FAILED`, `CANCELLED`).
- `retryCount`: `0` on initial dispatch.

---

## 19. Retry and Failure Strategy

The Phase 1 audit confirmed that the retry worker in [`lib/notifications.ts:839-933`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L839-L933) is architecturally sound. Phase 3 will maintain strict adherence:

1. **Automatic Retry Criteria:**
   - Only records where `status === "FAILED"` and `retryCount < 3` are retried.
   - Retries occur on network timeouts, Android Gateway temporary offline states, or server 5xx errors.
2. **Non-Retryable Conditions:**
   - **Carrier Delivery Failures:** If the gateway accepts the message (`status = "SENT"`) but the mobile carrier reports delivery failure (`deliveryStatus = "FAILED"` due to disconnected phone or invalid number), the worker **DOES NOT RETRY**.
3. **Atomic Claiming:**
   - Concurrency protection via `updateMany({ where: { id, status: "FAILED", retryCount }, data: { retryCount: { increment: 1 } } })` guarantees no duplicate worker executions.
4. **Single Row Lifecycle:**
   - Retries must call `dispatchSms()` directly and update the existing row, preventing row multiplication.

---

## 20. Duplicate Prevention Strategy

Phase 3 will enforce a four-layer duplicate prevention defense:

```
Layer 1: State Machine Transition Guard
         └─ Example: confirmBookingAction checks transition.isNoop.
            If booking is ALREADY confirmed, exit immediately before notification logic.

Layer 2: Idempotency Key Generation
         └─ Example: idempotencyKey = `sms_${eventName}_${entityId}`
            Passed in headers to Android Gateway to prevent radio-level duplicate sends.

Layer 3: NotificationLog Pre-Flight Check
         └─ For high-risk operations (e.g. Booking Created or Confirmed), check:
            prisma.notificationLog.findFirst({ where: { entityId, type: eventName, status: "SENT" } })
            If an SMS was already dispatched for this event, suppress duplicate.

Layer 4: Debounced UI Actions
         └─ Client-side button disabling and transition locks prevent rapid double-clicks.
```

---

## 21. Email + SMS Relationship

| Event | SMS Action | Email Action | Strategy |
|---|---|---|---|
| `BOOKING_CREATED` | SMS to Admin | HTML Email to Customer | **KEEP EMAIL, ADD ADMIN SMS** |
| `BOOKING_CONFIRMED` | SMS to Customer | HTML Email to Customer | **KEEP EMAIL, ADD CUSTOMER SMS** |
| `TECHNICIAN_ASSIGNED` | SMS to Customer | None | **ADD CUSTOMER SMS** |
| `TECHNICIAN_EN_ROUTE` | SMS to Customer | None | **ADD CUSTOMER SMS** |
| `TECHNICIAN_ARRIVED` | SMS to Customer | None | **ADD CUSTOMER SMS** |
| `SERVICE_COMPLETED` | SMS to Customer | HTML Email to Customer | **KEEP EXISTING SMS & EMAIL (`quote_ready`)** |
| `EMERGENCY_REQUEST_CREATED` | SMS to Admin | HTML Email to Customer | **KEEP EMAIL, ADD ADMIN SMS** |
| `CONTACT_REQUEST_CREATED` | SMS to Admin | None | **ADD ADMIN SMS** |
| `BOOKING_CANCELLED` | SMS to Customer & Admin | HTML Email to Customer | **KEEP EMAIL, ADD BIDIRECTIONAL SMS** |

---

## 22. Priority Model

| Priority Level | Events | Telecom Routing & Behavior |
|---|---|---|
| **CRITICAL** | `EMERGENCY_REQUEST_CREATED` | Immediate dispatch, dedicated SIM slot 0, zero queue delay, timeout override (5000ms). |
| **HIGH** | `BOOKING_CREATED`, `BOOKING_CONFIRMED`, `TECHNICIAN_ASSIGNED`, `TECHNICIAN_EN_ROUTE`, `SERVICE_COMPLETED`, `BOOKING_CANCELLED` | Direct dispatch, standard timeout (4000ms), standard retry eligibility. |
| **NORMAL** | `CONTACT_REQUEST_CREATED`, `TECHNICIAN_ARRIVED` | Standard dispatch, queued behind high-priority traffic if gateway is busy. |

---

## 23. Exact Phase 3 File Change Plan

### MUST CHANGE

#### 1. [`lib/sms/types.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/types.ts)
- **FUNCTION:** Type definitions.
- **CHANGE:** Add new notification event type literals to `NotificationType`.
- **REASON:** Strongly type all 10 domain notification events.
- **RISK:** None.
- **TEST:** TypeScript compilation check.

#### 2. [`lib/utils/maps.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/utils/maps.ts) [NEW FILE]
- **FUNCTION:** `buildGoogleMapsUrl(params)`.
- **CHANGE:** Pure utility generating turn-by-turn navigation URLs with fallbacks.
- **REASON:** Eliminate fragmented inline Google Maps link generation.
- **RISK:** None.
- **TEST:** Unit tests for GPS coordinate vs. string query fallbacks.

#### 3. [`lib/sms/templates.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/templates.ts) [NEW FILE]
- **FUNCTION:** Centralized message formatting functions.
- **CHANGE:** Pure template functions for all Admin and Customer SMS messages.
- **REASON:** Strict character budget control and complete separation of concerns.
- **RISK:** None.
- **TEST:** Unit tests asserting length boundaries and variable injection.

#### 4. [`lib/notifications.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts)
- **FUNCTION:** High-level dispatcher hub.
- **CHANGE:** 
  - Add recipient resolution logic (`ADMIN_NOTIFICATION_PHONE`).
  - Add domain emitters: `emitBookingConfirmed()`, `emitTechnicianAssigned()`, `emitTechnicianEnRoute()`, `emitTechnicianArrived()`, `emitContactCreated()`, `emitBookingCancelled()`.
  - Update `sendBookingConfirmation()` and `sendEmergencyAlert()` to use `buildGoogleMapsUrl()`.
- **REASON:** Centralize business dispatch logic while preserving `NotificationLog` integrity.
- **RISK:** Regression in existing email or retry behavior if not isolated.
- **TEST:** Integration tests asserting `NotificationLog` entries and mock gateway invocations.

#### 5. [`app/actions/bookings/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/admin.ts)
- **FUNCTION:** `confirmBookingAction`, `assignTechnicianAction`, `cancelBookingAction`.
- **CHANGE:** Attach non-blocking notification emitters immediately after successful database update commits.
- **REASON:** Admin UI relies exclusively on Server Actions; notifications are currently missing.
- **RISK:** Blocking client response if notifications are awaited synchronously without error catch.
- **TEST:** End-to-end admin action execution tests.

#### 6. [`app/actions/bookings/technician.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings/technician.ts)
- **FUNCTION:** `markTechnicianArrivedAction` and add `startTechnicianTripAction`.
- **CHANGE:** 
  - Attach `emitTechnicianArrivedNotification()` post-commit.
  - Implement `startTechnicianTripAction()` to trigger `TECHNICIAN_EN_ROUTE`.
- **REASON:** Provide customer milestone updates during technician travel and arrival.
- **RISK:** Invalid token access; must maintain existing HMAC verification.
- **TEST:** Technician token authentication and notification dispatch tests.

#### 7. [`app/api/contact-messages/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/contact-messages/route.ts)
- **FUNCTION:** `POST`.
- **CHANGE:** Invoke `emitContactCreatedNotification()` after `prisma.contactMessage.create()` commits.
- **REASON:** Notify admin immediately upon contact form receipt.
- **RISK:** None.
- **TEST:** Contact submission test asserting admin SMS generation.

#### 8. [`app/api/admin/bookings/[id]/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/admin/bookings/%5Bid%5D/route.ts)
- **FUNCTION:** `PATCH`.
- **CHANGE:** Refactor to delegate status updates through the centralized domain emitters or Server Actions.
- **REASON:** Prevent duplicate notifications between API routes and Server Actions.
- **RISK:** Breaking legacy external API integrations if response schema changes.
- **TEST:** API contract integration tests.

---

### MAY CHANGE

#### 1. [`app/technician/tracking/[bookingId]/page.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/technician/tracking/%5BbookingId%5D/page.tsx)
- **CHANGE:** Add an explicit "Start Route / I'm On My Way" button that invokes `startTechnicianTripAction`.
- **REASON:** Enable intentional, human-controlled en-route SMS dispatch.

#### 2. [`lib/sms.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms.ts)
- **CHANGE:** Deprecate or remove unreferenced dead helper functions (`sendQuoteSms`, `sendBookingRequestSms`).
- **REASON:** Code cleanliness and preventing confusion with `lib/notifications.ts`.

---

### MUST NOT CHANGE

1. [`lib/bookings/state-machine.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/bookings/state-machine.ts): Authoritative state transition matrix.
2. [`lib/sms/providers/android-gateway.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/providers/android-gateway.ts): Low-level HTTP telecom driver.
3. [`lib/sms/webhook-verification.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms/webhook-verification.ts): HMAC signature verification algorithms.
4. [`app/api/webhooks/sms-gateway/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/webhooks/sms-gateway/route.ts): Webhook ingestion and terminal delivery guards.
5. [`lib/technician-auth.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/technician-auth.ts): HMAC-SHA256 token security.
6. [`prisma/schema.prisma`](file:///d:/Tire-Services/tire-mobile-clinic-next/prisma/schema.prisma): Zero database schema migrations required.

---

## 24. Files That Must NOT Change

To preserve absolute system stability, the following core infrastructural files will remain locked and unmodified throughout Phase 3:

```
prisma/schema.prisma
lib/bookings/state-machine.ts
lib/bookings/availability.ts
lib/admin-auth.ts
lib/technician-auth.ts
lib/rate-limit.ts
lib/sms/providers/android-gateway.ts
lib/sms/providers/simulated.ts
lib/sms/webhook-verification.ts
app/api/webhooks/sms-gateway/route.ts
```

---

## 25. Phase 3 Implementation Order

To maintain continuous testability and zero regressions, Phase 3 will follow a strict five-stage sequence:

```
STAGE 1: Pure Utilities & Types (Zero side effects)
  1.1 Update NotificationType in lib/sms/types.ts
  1.2 Implement lib/utils/maps.ts (Google Maps URL generator)
  1.3 Implement lib/sms/templates.ts (Template catalog)
  1.4 Unit test templates & map links

STAGE 2: Domain Emitter Layer (lib/notifications.ts)
  2.1 Implement recipient resolution (ADMIN_NOTIFICATION_PHONE hierarchy)
  2.2 Implement domain notification emitters with idempotency guards
  2.3 Integrate templates with existing sendSms() and NotificationLog
  2.4 Unit test dispatcher functions with MockDatabase / MockGateway

STAGE 3: Admin Operational Triggers
  3.1 Wire contact form admin SMS in app/api/contact-messages/route.ts
  3.2 Update emergency request admin SMS formatting with map navigation links
  3.3 Update new booking admin SMS formatting with map navigation links
  3.4 Integration test admin notification receipt

STAGE 4: Customer Status Triggers (Server Actions)
  4.1 Wire customer confirmation SMS in confirmBookingAction (app/actions/bookings/admin.ts)
  4.2 Wire customer assignment SMS in assignTechnicianAction (app/actions/bookings/admin.ts)
  4.3 Implement startTechnicianTripAction in app/actions/bookings/technician.ts
  4.4 Wire customer arrival SMS in markTechnicianArrivedAction (app/actions/bookings/technician.ts)
  4.5 Wire cancellation SMS in cancelCustomerBookingAction and cancelBookingAction

STAGE 5: End-to-End Regression Verification
  5.1 Run complete unit test suite
  5.2 Run complete integration test suite
  5.3 Verify zero regressions in email delivery, retry worker, and webhook ingestion
```

---

## 26. Phase 3 Test Matrix

### Unit Tests (`tests/unit/`)
- `maps-url.test.mjs`: Asserts turn-by-turn navigation URL generated when lat/lng provided; search query generated when only address provided; graceful fallback on empty input.
- `sms-templates.test.mjs`: Asserts each template produces exact expected string; verifies character count limits (≤ 160 chars for customer SMS, ≤ 320 chars for admin); verifies absence of `undefined` or `null` text.
- `privacy-guard.test.mjs`: Asserts that passing a technician object with a private phone number into customer templates strictly outputs `BUSINESS_PHONE_DISPLAY` and never leaks the personal phone.

### Integration Tests (`tests/integration/`)
- `booking-confirmation-flow.test.mjs`: Simulates `confirmBookingAction`; verifies database status moves to `confirmed`; verifies single `NotificationLog` created with `type = "booking_confirmation"`; verifies correct customer recipient.
- `technician-lifecycle-notifications.test.mjs`: Simulates assignment, departure, and arrival; verifies correct sequence of `NotificationLog` entries; verifies idempotent arrival (subsequent calls do not dispatch duplicate SMS).
- `emergency-and-contact-notifications.test.mjs`: Submits emergency request and contact message; verifies `NotificationLog` created for `ADMIN_NOTIFICATION_PHONE`.
- `cancellation-notification.test.mjs`: Simulates cancellation from customer and admin; asserts bidirectional notification rules.
- `failure-isolation.test.mjs`: Injects SMS Gateway network timeouts (4000ms) and HTTP 500 errors; asserts that database transactions commit successfully despite SMS failure; asserts `NotificationLog` records `status = "FAILED"`.

---

## 27. Risks and Edge Cases

1. **Cellular Carrier Network Latency:**  
   Carrier SMS delivery can take between 2 seconds and 2 minutes depending on recipient signal.  
   *Mitigation:* The system uses `withDeliveryReport: true` and logs delivery via async webhooks; application response time is completely insulated because dispatches are non-blocking.
2. **Double Click / Repeated Submissions:**  
   Users double-clicking confirmation or arrival buttons.  
   *Mitigation:* State machine checks (`transition.isNoop`) combined with idempotency keys (`sms_${type}_${bookingId}`) prevent duplicate dispatch.
3. **Gateway Device Running Out of Power / Wi-Fi Drop:**  
   The physical Android phone hosting the SIM card may lose connectivity.  
   *Mitigation:* HTTP calls timeout safely after 4000ms, mark log as `FAILED`, and the background cron worker automatically retries up to 3 times upon reconnection.
4. **Customer Entering Landline or International Number:**  
   *Mitigation:* `normalizePhoneToE164()` cleans input; if the number is unparseable or rejected by the carrier, the gateway webhooks record `deliveryStatus = "FAILED"` without triggering retry storms.

---

## 28. Open Questions / Decisions Required

The following operational and business decisions should be reviewed by stakeholders prior to Phase 3 execution:

### 1. Technician En Route Triggering Mechanism
- **Proposed:** Add an explicit "Start Route / I'm On My Way" action button in the Technician Portal.
- **Alternative:** Automatically trigger en-route SMS upon the technician's first active GPS location broadcast after assignment.
- *Recommendation:* **Explicit Button.** Automatic GPS triggers risk firing prematurely when a technician is simply testing their app or parked at headquarters.

### 2. Service Started Notification Necessity
- **Proposed:** **Omit `SERVICE_STARTED` SMS.**
- *Rationale:* Customers already receive `TECHNICIAN_ARRIVED` when the van pulls up. Sending another SMS 3 minutes later saying "Service has started" feels like unnecessary notification clutter.
- *Decision Needed:* Does the business require an explicit `SERVICE_STARTED` text message, or is `TECHNICIAN_ARRIVED` sufficient?

### 3. Dedicated Admin Phone Configuration
- **Proposed:** Introduce `ADMIN_NOTIFICATION_PHONE` as a dedicated server environment variable.
- *Recommendation:* **Approve.** This decouples business owner alerts from individual technician phone numbers.

### 4. Service Completed vs. Quote Ready Unification
- **Proposed:** Unify into a single customer SMS: `[HT MOBILE TIRES] Your service is complete! Total: $XX.XX. View invoice: [URL]`.
- *Recommendation:* **Approve.** Avoids sending two separate SMS messages within seconds of each other.

---

## 29. Final Phase 3 Readiness Assessment

- **Codebase Readiness:** **HIGH**
- **Infrastructure:** The SMS Gateway driver, retry worker, and delivery webhook are robust and require no modifications.
- **Database Architecture:** Existing `NotificationLog`, `Booking`, `Technician`, and `EmergencyRequest` models support the entire proposed matrix with zero schema migrations.
- **Implementation Complexity:** **LOW TO MODERATE** (Concentrated in template formatting, helper utilities, and Server Action event triggers).

---

## 30. Read-Only Verification

- **Files Inspected:**
  - `prisma/schema.prisma`
  - `lib/notifications.ts`
  - `lib/sms.ts`
  - `lib/sms/index.ts`
  - `lib/sms/types.ts`
  - `lib/sms/providers/android-gateway.ts`
  - `lib/sms/webhook-verification.ts`
  - `lib/bookings/state-machine.ts`
  - `app/actions/bookings/admin.ts`
  - `app/actions/bookings/customer.ts`
  - `app/actions/bookings/technician.ts`
  - `app/actions/bookings/quote.ts`
  - `app/api/bookings/route.ts`
  - `app/api/emergency-requests/route.ts`
  - `app/api/contact-messages/route.ts`
  - `app/api/admin/bookings/[id]/route.ts`
  - `app/api/webhooks/sms-gateway/route.ts`
  - `app/technician/tracking/[bookingId]/page.tsx`
  - `tests/unit/android-gateway.test.mjs`
  - `tests/integration/sms-delivery-webhook.test.mjs`
- **Files Modified:** NONE.
- **Source Code Modified:** NO.
- **Database Changed:** NO.
- **Migrations Created:** NO.
- **Dependencies Changed:** NO.

---

# PHASE 2 STATUS

**PLANNING STATUS:**  
PASS WITH FINDINGS

**READ-ONLY:**  
YES

**FILES MODIFIED:**  
NONE

**SOURCE CODE MODIFIED:**  
NO

**DATABASE CHANGED:**  
NO

**MIGRATIONS CREATED:**  
NO

**DEPENDENCIES CHANGED:**  
NO

**ENVIRONMENT CHANGED:**  
NO

**SMS GATEWAY CHANGED:**  
NO

**WEBHOOK CHANGED:**  
NO

**RETRY LOGIC CHANGED:**  
NO

**IMPLEMENTATION PERFORMED:**  
NONE

**PHASE 3 READY:**  
YES WITH DECISIONS

---

### Top 5 Decisions to Review Before Phase 3 Implementation:
1. **Approve `ADMIN_NOTIFICATION_PHONE`:** Confirm that a dedicated environment variable should be introduced to separate admin alerts from technician cell phones.
2. **Technician En Route Trigger:** Confirm adopting Option B (explicit "Start Route / On My Way" action button in the technician portal) to prevent GPS ping spam.
3. **Combine Service Completed & Invoice Ready:** Confirm that completion and quote delivery should remain a single unified customer text message rather than two separate messages.
4. **Omit Service Started SMS:** Confirm that `SERVICE_STARTED` will not send an SMS (relying on `TECHNICIAN_ARRIVED` and `SERVICE_COMPLETED`), minimizing customer message fatigue.
5. **Bidirectional Cancellation Alerts:** Confirm that cancellations send an SMS to the customer (if initiated by admin) and an SMS to the admin (if initiated by customer).
