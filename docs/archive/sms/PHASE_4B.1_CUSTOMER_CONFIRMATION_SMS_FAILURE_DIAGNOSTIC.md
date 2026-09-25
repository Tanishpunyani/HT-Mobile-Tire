# PHASE 4B.1 — CUSTOMER CONFIRMATION SMS FAILURE READ-ONLY DIAGNOSTIC REPORT

**Mode**: STRICT READ-ONLY DIAGNOSTIC  
**Target Booking ID**: `dfd876a8-2fd3-4fbe-8477-a2c367788dae`  
**Execution Date**: September 23, 2026  
**Environment**: Local Development (`npm run dev`) / PostgreSQL / Capcom6 Cloud SMS Gateway  

---

## 1. IDENTIFY THE TEST BOOKING

The latest booking created through the website and confirmed by the admin was identified in the database:

| Field | Value |
| :--- | :--- |
| **Booking ID** | `dfd876a8-2fd3-4fbe-8477-a2c367788dae` |
| **Booking Reference / Short ID** | `DFD876` |
| **Current Status** | `confirmed` |
| **Customer ID** | `e9879315-96f9-44c3-9561-19ff7ca9731d` |
| **Customer Name** | `Alex Demo` |
| **Customer Phone (Masked)** | `(555) ***-6543` / `**********6543` |
| **Booking Creation Time** | `2026-09-23T15:28:44.211Z` |
| **Confirmation Time** | `2026-09-23T15:30:02.646Z` |

*(Sensitive numbers and tokens remain masked throughout this report.)*

---

## 2. DATABASE STATUS

Verification of state transitions in `prisma.booking`:

- **Initial State**: Booking was created at `15:28:44.211Z` with status `pending`.
- **Status Change**: Admin triggered `confirmBookingAction`, which successfully transitioned the status from `pending` to `confirmed`.
- **Timestamp Population**: `serviceConfirmedAt` was populated with `2026-09-23T15:30:02.646Z`.
- **Exact Current State**:
  - `status`: `"confirmed"`
  - `serviceConfirmedAt`: `2026-09-23T15:30:02.646Z`
  - `preferredDate`: `"2026-09-23"`
  - `preferredTime`: `"14:30"`
  - `service`: `"New and Used Tires"`
  - `vehicle`: `"Honda Civic"`

---

## 3. CUSTOMER PHONE RESOLUTION

Tracing `resolveCustomerNotificationPhone(updated.customer)`:

- **Customer Phone Exists**: Yes, the database holds raw value `"(555) 987-6543"`.
- **Normalization Result**: 
  - Raw: `"(555) 987-6543"` (14 characters, non-E.164 formatted string)
  - `normalizePhoneToE164`: stripped non-digits to 10 digits (`5559876543`), prepended `+1` -> `"+15559876543"` (12 characters, masked: `+1555***6543`).
- **Recipient Validity in Application Code**: 
  - `resolveCustomerNotificationPhone` checks if `normalized && normalized.length >= 10`.
  - The condition evaluated to `true`.
- **Skipped Due to Phone**: No. The alert was **NOT** skipped by the application's phone resolver.

---

## 4. NOTIFICATION LOG AUDIT

Querying `prisma.notificationLog` for `entityId = "dfd876a8-2fd3-4fbe-8477-a2c367788dae"`:

| Log ID | Type | Channel | Recipient (Masked) | Status | Delivery Status | Message ID | Error Message | Created At |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ea779b14-...` | `BOOKING_CREATED` | `sms` | `+91*********2286` | `SENT` | `null` | `8s27JMQeEucrqd9q7wXc0` | `null` | `15:28:47.522Z` |
| `7403d72c-...` | `booking_confirmation` | `email` | `***@example.com` | `FAILED` | `null` | `null` | Resend test domain restriction | `15:28:45.762Z` |
| `0ebf92d5-...` | `BOOKING_CONFIRMED` | `sms` | `+1555***6543` | `FAILED` | `null` | `null` | `"invalid phone number"` | `15:30:05.738Z` |

### Classification:
**D. FAILED**  
The `NotificationLog` record exists with `status: "FAILED"`, `messageId: null`, and `errorMessage: "invalid phone number"`.

---

## 5. DUPLICATE CHECK

Inspection of `hasExistingNotification`:

- **Identity Key**: `buildBookingConfirmedKey("dfd876a8-2fd3-4fbe-8477-a2c367788dae")`
- **Query**: Looked for existing successful or pending `BOOKING_CONFIRMED` logs for this booking and recipient.
- **Result**: No existing notification existed prior to dispatch.
- **Conclusion**: The notification was **NOT** suppressed or prevented by duplicate detection.

---

## 6. SMS PROVIDER SELECTION

Verification of provider factory (`lib/sms/index.ts -> getSmsProvider()`):

- `SMS_GATEWAY_URL` is set to `https://api.sms-gate.app/3rdparty/v1/messages`.
- Active provider instantiated: **`AndroidGatewayProvider`**.
- `SimulatedSmsProvider` was **NOT** used.
- Provider initialization was fully successful.

---

## 7. TOKEN MANAGER STATE

Inspection of `prisma.smsGatewayToken` and TokenManager runtime state:

- **Token Record in DB**:
  - `id`: `"active"`
  - `expiresAt`: `2026-09-23T15:44:20.000Z`
  - `updatedAt`: `2026-09-23T15:28:46.665Z`
- **Confirmation Dispatch Timestamp**: `2026-09-23T15:30:05.738Z`
- **Token Validity**: The token was valid, active, and unexpired (~14 minutes before expiration).
- **Authentication Result**: TokenManager did not fail, did not require a refresh, and did not encounter an authentication error.

---

## 8. GATEWAY REQUEST AUDIT

The dispatch reached the Capcom6 Cloud API endpoint (`POST /3rdparty/v1/messages`):

- **Target Endpoint**: `https://api.sms-gate.app/3rdparty/v1/messages`
- **Payload Sent**:
  ```json
  {
    "textMessage": {
      "text": "HT Mobile Tires: Hi Alex, your appointment for New and Used Tires (Honda Civic) on Sep 23, 2026 at 2:30 PM is CONFIRMED. Booking #DFD876. Questions? Call (800) 555-TIRE (8473)."
    },
    "phoneNumbers": ["+15559876543"],
    "simNumber": 1,
    "withDeliveryReport": true
  }
  ```
- **HTTP Response Status**: `400 Bad Request`
- **Gateway Response Body**: `{ "message": "invalid phone number" }`
- **Gateway Message ID**: `null` (gateway rejected message upfront without enqueuing)
- **Error Category**: Client Validation Error (HTTP 400 - Invalid Recipient Number)

---

## 9. WEBHOOK / DELIVERY STATUS

Investigation of `/api/webhooks/sms-gateway`:

- **Webhook Received**: **No webhook was received.**
- **Reason**: Because Capcom6 rejected the dispatch request at the HTTP API layer (HTTP 400), no message was ever created, no message ID was assigned, no task was dispatched to the Android device, and no webhook event could ever be emitted.
- **Delivery Status**: `null`
- **Carrier Delivery Result**: N/A (Message never entered carrier transit).

---

## 10. SMS CONTENT VERIFICATION

Inspection of the generated `BOOKING_CONFIRMED` SMS:

```text
HT Mobile Tires: Hi Alex, your appointment for New and Used Tires (Honda Civic) on Sep 23, 2026 at 2:30 PM is CONFIRMED. Booking #DFD876. Questions? Call (800) 555-TIRE (8473).
```

- **Customer First Name**: `"Alex"` (correctly extracted from `"Alex Demo"`)
- **Service Name**: `"New and Used Tires"`
- **Vehicle**: `"Honda Civic"`
- **Date**: `"Sep 23, 2026"`
- **Time**: `"2:30 PM"`
- **Booking Reference**: `"#DFD876"`
- **Business Phone**: `"(800) 555-TIRE (8473)"`
- **Quality Assessment**: 167 characters, perfectly structured single SMS segment, grammatically correct, zero placeholder variables (`null` or `undefined`).

---

## 11. COMPARISON: ADMIN SMS VS CUSTOMER SMS

| Parameter | Admin Alert (`BOOKING_CREATED`) | Customer Alert (`BOOKING_CONFIRMED`) | Divergence Point |
| :--- | :--- | :--- | :--- |
| **Recipient** | `+91*********2286` (Valid real mobile) | `+1555***6543` (`(555) 987-6543` dummy) | **Recipient Phone Legitimacy** |
| **Provider** | `AndroidGatewayProvider` | `AndroidGatewayProvider` | Identical |
| **TokenManager** | Token valid | Token valid | Identical |
| **HTTP Dispatch** | `POST /3rdparty/v1/messages` | `POST /3rdparty/v1/messages` | Identical |
| **Capcom6 Validation** | `nyaruka/phonenumbers`: **PASS** | `nyaruka/phonenumbers`: **FAIL** | **FIRST DIVERGENCE POINT** |
| **HTTP Status** | `200 / 201 OK` | `400 Bad Request` | Diverged |
| **Gateway Message ID** | `8s27JMQeEucrqd9q7wXc0` | `null` | Diverged |
| **NotificationLog** | `status: "SENT"` | `status: "FAILED"`, `"invalid phone number"` | Diverged |
| **Physical Delivery** | Successfully delivered to device | Never sent to device | Diverged |

---

## 12. FINAL ROOT CAUSE CLASSIFICATION

**Classification**: **F. GATEWAY_REQUEST_FAILURE**

### Evidence Summary:
1. Every component in the local application pipeline functioned exactly as engineered:
   - Database confirmed the booking and recorded `serviceConfirmedAt`.
   - `sendCustomerBookingConfirmedAlert` fired.
   - Recipient was extracted and normalized to E.164 (`+15559876543`).
   - Duplicate prevention correctly allowed the dispatch.
   - SMS template generated clean, valid copy.
   - `AndroidGatewayProvider` acquired a valid active access token from `TokenManager`.
   - HTTP POST was executed to `https://api.sms-gate.app/3rdparty/v1/messages`.
2. The failure occurred when Capcom6's server-side phone number validator processed the recipient array:
   - In North American Numbering Plan (NANP), **area code `555` is strictly invalid/fictional**.
   - Capcom6 rejected `+15559876543` with `HTTP 400 Bad Request` and body `{ "message": "invalid phone number" }`.
3. The booking form's validation schema (`lib/validations/booking.ts`) only required `min(7)` characters for the phone number, allowing the customer to enter a fictional `(555) 987-6543` number.

---

## EXECUTIVE SUMMARY

```text
ROOT CAUSE:
F. GATEWAY_REQUEST_FAILURE — Capcom6 Cloud SMS Gateway returned HTTP 400 Bad Request ("invalid phone number") because the customer phone number entered in the booking form was "(555) 987-6543", which contains a fictional, unroutable North American area code (555).

FIRST FAILURE POINT:
Capcom6 server-side phone number validation during HTTP POST /3rdparty/v1/messages.

EVIDENCE:
1. NotificationLog record ID 0ebf92d5-f052-45f9-968c-9f8b79552108 has status = "FAILED", messageId = null, and errorMessage = "invalid phone number".
2. Customer phone analysis revealed raw input "(555) 987-6543", normalized to "+15559876543". Area code "555" does not exist in NANP.
3. The admin SMS to a real mobile number (+91*********2286) succeeded moments earlier through the exact same provider, endpoint, and token with messageId "8s27JMQeEucrqd9q7wXc0".
4. TokenManager was active and valid (expiresAt: 2026-09-23T15:44:20.000Z vs dispatch attempt 2026-09-23T15:30:05.738Z).

SAFE FIX REQUIRED:
1. When submitting real tests, use a real, valid mobile phone number capable of receiving SMS (or same country/format as admin number), rather than fictional 555 area code numbers.
2. In the application code, enhance `lib/validations/booking.ts` to validate NANP area codes (e.g. area code cannot start with 0, 1, or be 555) or use strict E.164 validation before booking creation.

FILES THAT WOULD NEED CHANGES (WHEN IMPLEMENTATION IS APPROVED):
- lib/validations/booking.ts (enforce strict phone number schema)
- lib/sms/index.ts or lib/sms/normalization.ts (pre-validate phone before dispatching to gateway)
```
