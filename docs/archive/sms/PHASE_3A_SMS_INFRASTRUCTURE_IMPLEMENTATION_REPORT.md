# PHASE 3A — HT MOBILE SMS NOTIFICATION SYSTEM
# SHARED NOTIFICATION INFRASTRUCTURE & TEMPLATES IMPLEMENTATION REPORT

**Project:** HT Mobile Services / HT Mobile Tyres  
**Codebase:** `tire-mobile-clinic-next`  
**Phase:** 3A (Implementation Only — Shared Infrastructure & Templates)  
**Execution Timestamp:** 2026-09-22T20:39:00+05:30  
**Environment:** Next.js 16.3.1 (Turbopack), Node.js v24.18.1, TypeScript 5.9.3, Prisma 6.4.1  

---

## 1. Objective

The objective of Phase 3A was to construct the shared, pure, and type-safe notification infrastructure necessary to support Phase 3B (Admin Notifications) and Phase 3C (Customer Notifications) without introducing any business notification triggers, without modifying the database schema, and without altering the existing Android SMS Gateway provider or webhook handlers.

Established foundations:
1. **Centralized Google Maps navigation URL generation:** pure, deterministic coordinate-first fallback utility.
2. **Centralized SMS template catalog:** 10 pure, strongly typed template functions (4 Admin, 6 Customer) adhering to character budgets and technician privacy rules.
3. **Dedicated recipient resolution helper:** server-only phone resolver enforcing fallback hierarchy and strictly preventing admin routing to customer hotlines.
4. **Deterministic notification identity helper:** collision-resistant, pure event key generator providing an application-level foundation for duplicate prevention.
5. **Type-safe notification event definitions:** backward-compatible extension of the existing `NotificationType` union.

---

## 2. Files Created

| File | Purpose |
| :--- | :--- |
| `lib/utils/maps.ts` | Pure Google Maps navigation URL builder prioritizing lat/lng coordinates over textual addresses with safe URL encoding and absolute fallback. |
| `lib/sms/templates.ts` | Centralized catalog of 10 SMS templates with inline/multiline sanitizers, dynamic field truncation, and strict privacy controls. |
| `lib/notifications/recipients.ts` | Server-only admin and customer recipient phone resolution helper with E.164 normalization and safety guards. |
| `lib/notifications/identity.ts` | Pure deterministic business notification event key generator for idempotent event identification. |
| `tests/unit/maps.test.mjs` | 10 unit tests for Google Maps URL generation covering coordinates, fallbacks, encoding, and edge cases. |
| `tests/unit/sms-templates.test.mjs` | 15 unit tests covering all 10 templates, technician phone exclusion, character limits, and sanitizers. |
| `tests/unit/notification-recipients.test.mjs` | 14 unit tests for recipient hierarchy, hotline exclusion, null-safety, and customer object normalization. |
| `tests/unit/notification-identity.test.mjs` | 11 unit tests verifying pure determinism, absence of randomness/Date.now(), and event key formatting. |

---

## 3. Files Modified

| File | Changes Made |
| :--- | :--- |
| `lib/sms/types.ts` | Extended `NotificationType` union backward-compatibly with Phase 2 canonical event types (`BOOKING_CREATED`, `BOOKING_CONFIRMED`, `TECHNICIAN_ASSIGNED`, `TECHNICIAN_EN_ROUTE`, `TECHNICIAN_ARRIVED`, `SERVICE_STARTED`, `SERVICE_COMPLETED`, `EMERGENCY_REQUEST_CREATED`, `CONTACT_REQUEST_CREATED`, `BOOKING_CANCELLED`). Preserved all existing strings. |
| `lib/notifications.ts` | Extended local `NotificationType` union to align with `lib/sms/types.ts`, and re-exported Phase 3A infrastructure (`buildGoogleMapsUrl`, templates, recipients, and identity helpers). |
| `tests/run-all.mjs` | Imported and executed all 4 new Phase 3A unit test suites within the master automated regression suite. |

---

## 4. Files Intentionally Untouched

To preserve the strict boundaries of Phase 3A, the following operational components were kept completely untouched:

- `lib/sms/providers/android-gateway.ts` — Android SMS Gateway dispatch, endpoint resolution, and headers remain identical.
- `lib/sms/index.ts` — Provider instantiation and `normalizePhoneToE164` behavior preserved.
- `app/api/webhooks/sms-gateway/route.ts` — Webhook delivery status transitions and signature checks remain intact.
- `app/api/notifications/retry/route.ts` — Notification retry worker logic remains untouched.
- `prisma/schema.prisma` — Zero schema modifications, zero column additions.
- All Server Actions (`app/actions/*.ts`) — Zero business triggers or notification calls added.
- All API route handlers (`app/api/bookings/*`, `app/api/emergency-requests/*`, `app/api/contact-messages/*`) — No notification wiring.
- All UI components and state machines — Untouched.

---

## 5. Maps Utility Implementation

Implemented in `lib/utils/maps.ts`:
- **Function:** `buildGoogleMapsUrl(params: MapsUrlParams): string`
- **Interface:**
  ```ts
  export interface MapsUrlParams {
    latitude?: number | null;
    longitude?: number | null;
    formattedAddress?: string | null;
    location?: string | null;
  }
  ```
- **Behavior & Fallback Hierarchy:**
  1. **Coordinates (Highest Priority):** Validates finite numbers, latitude $\in [-90, 90]$, longitude $\in [-180, 180]$. Returns `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`.
  2. **Formatted Address Fallback:** If coordinates are missing/invalid, safely encodes `formattedAddress` with `encodeURIComponent()`. Returns `https://www.google.com/maps/dir/?api=1&destination=ENCODED_ADDRESS`.
  3. **Location Fallback:** If `formattedAddress` is missing, safely encodes raw `location`.
  4. **Absolute Fallback:** Returns `https://www.google.com/maps` if no usable location data exists.
- **Purity:** Pure function, zero network requests, zero Google API keys required, zero browser-only globals.

---

## 6. Template Catalog Implementation

Implemented in `lib/sms/templates.ts`:
- **Pure Functions:** Receive strongly typed data objects and return plain SMS string payloads. Zero database queries, zero environment reads inside templates, zero gateway calls.
- **Sanitizers:**
  - `sanitizeInline(text, maxLength)`: Strips newlines, control characters, collapses whitespace, and applies safe truncation with an ellipsis if needed.
  - `sanitizeMultiLine(text, maxLines, maxLength)`: Preserves line breaks but collapses excess blank lines and removes control characters.
  - `extractFirstName(fullName)`: Gracefully isolates the customer's or technician's first name, falling back to a safe generic default.
- **Catalog Functions (10 Total):**
  1. `buildAdminNewBookingSms(data)` — Operational alert with customer name, phone, service, vehicle, appointment time, address, Google Maps link, uppercase short booking reference, and notes.
  2. `buildAdminEmergencySms(data)` — Urgent roadside alert with uppercase problem category, customer contact, vehicle, address, Google Maps link, and details.
  3. `buildAdminContactSms(data)` — Central dispatch inquiry alert with submitter name, phone, requested service, location, and message excerpt.
  4. `buildAdminBookingCancelledSms(data)` — Notice with actor distinction (Customer vs Admin), service, vehicle, and optional reason.
  5. `buildBookingConfirmedSms(data)` — Customer confirmation with first name, service, vehicle, appointment date/time, short reference `#XXXXXX`, and business hotline.
  6. `buildTechnicianAssignedSms(data)` — Notification with technician first name ONLY, appointment time, and business phone.
  7. `buildTechnicianEnRouteSms(data)` — Real-time notification with technician first name, optional ETA minutes, optional live tracking URL, and business phone.
  8. `buildTechnicianArrivedSms(data)` — Arrival notice informing customer that technician is on site.
  9. `buildServiceCompletedSms(data)` — Completion notice with formatted total amount ($XX.XX), receipt/account URL, and business hotline.
  10. `buildBookingCancelledCustomerSms(data)` — Empathetic cancellation notice directing customer to call business hotline for rescheduling.
- **Length Safety:** Customer messages are crafted for single-segment (target $\le 160$ GSM-7 characters) or at most double-segment (target $\le 306$ characters). Admin messages are concise yet provide complete operational context.

---

## 7. Recipient Resolution Implementation

Implemented in `lib/notifications/recipients.ts`:
- **Admin Phone Resolution (`resolveAdminNotificationPhone`):**
  - Priority 1: `process.env.ADMIN_NOTIFICATION_PHONE`
  - Priority 2: `process.env.DISPATCH_PHONE_NUMBER`
  - Priority 3: `process.env.TECHNICIAN_PHONE_NUMBER` (legacy fallback)
  - Returns: Normalized E.164 string or `null`.
  - **Anti-Pattern Guard:** Under no circumstances does it use or fall back to `BUSINESS_PHONE_RAW` or `NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY`.
- **Customer Phone Resolution (`resolveCustomerNotificationPhone`):**
  - Accepts raw string or polymorphic object structures (`booking.customer.phone`, `booking.phone`, `booking.user.phone`).
  - Filters out empty values and invalid placeholders (`"N/A"`, `"undefined"`, `"null"`).
  - Normalizes through `normalizePhoneToE164`.
  - Returns: Normalized E.164 string or `null`.
- **Non-blocking:** Never throws an exception on missing or corrupt input; returns `null` safely.

---

## 8. Deterministic Notification Identity Implementation

Implemented in `lib/notifications/identity.ts`:
- **Core Builder:** `buildNotificationEventKey({ eventName, entityId, qualifier? })`
  - Format: `<event_name>:<entity_id>` or `<event_name>:<entity_id>:<qualifier>`
  - Normalizes IDs and event names (lowercasing, trimming, removing non-alphanumeric separator characters).
- **Pure Determinism:** Zero dependencies on `Date.now()`, `Math.random()`, or process memory. Same input arguments always yield identical keys.
- **Catalog Builders:**
  - `buildBookingCreatedAdminKey(bookingId)`
  - `buildBookingConfirmedKey(bookingId)`
  - `buildTechnicianAssignedKey(bookingId, technicianId?)`
  - `buildTechnicianEnRouteKey(bookingId)`
  - `buildTechnicianArrivedKey(bookingId)`
  - `buildServiceCompletedKey(bookingId)`
  - `buildEmergencyAlertKey(emergencyId)`
  - `buildContactAlertKey(contactMessageId)`
  - `buildBookingCancelledKey(bookingId, cancelledBy?)`
- **Application-Level Foundation:** Acts as a deterministic identifier for deduplication prior to database writes in future phases. Does not transmit unsupported headers to the Android SMS Gateway.

---

## 9. Privacy and Security Safeguards

1. **Technician Personal Phone Protection:**
   - The TypeScript interfaces for customer templates (`BookingConfirmedTemplateData`, `TechnicianAssignedTemplateData`, `TechnicianEnRouteTemplateData`, `TechnicianArrivedTemplateData`, `ServiceCompletedTemplateData`, `BookingCancelledCustomerTemplateData`) strictly omit technician phone fields.
   - Only `technicianFirstName` is permitted.
   - Surnames and personal phone numbers (`Technician.phone`) are never accepted or interpolated into customer SMS.
   - Customer-facing contact numbers must be provided via the explicit `businessPhone` argument.
2. **Admin Phone Confidentiality:**
   - `ADMIN_NOTIFICATION_PHONE` is strictly server-side (no `NEXT_PUBLIC_` prefix).
   - Never exposed to client components, customer SMS, or client-visible API responses.
3. **Database Entity Protection:**
   - Customer templates format references using uppercase short IDs (e.g., `#A1B2C3`), never exposing internal 36-character database UUIDs.

---

## 10. Tests Added

Four dedicated unit test suites were implemented in `tests/unit/`:

| Test Suite | Test File | Test Count | Status |
| :--- | :--- | :---: | :---: |
| Google Maps Utility | `tests/unit/maps.test.mjs` | 10 | **PASS (10/10)** |
| SMS Templates Catalog | `tests/unit/sms-templates.test.mjs` | 15 | **PASS (15/15)** |
| Recipient Resolution | `tests/unit/notification-recipients.test.mjs` | 14 | **PASS (14/14)** |
| Notification Identity | `tests/unit/notification-identity.test.mjs` | 11 | **PASS (11/11)** |
| **Phase 3A New Tests Total** | | **50** | **ALL PASS** |

Key test scenarios verified:
- Coordinates take precedence over formatted addresses.
- Textual addresses with spaces, ampersands, and quotes are URL-encoded correctly.
- Invalid coordinates (e.g. NaN, >90 lat) trigger graceful address fallback.
- All 10 SMS templates produce exact expected text.
- Customer templates are constrained within $\le 306$ characters.
- Injected rogue technician phone numbers are ignored by customer templates.
- Admin recipient resolves across priority cascade and refuses business hotline fallback.
- Customer recipient extracts phone from strings and nested objects (`booking.customer.phone`).
- Deterministic event keys produce identical outputs across 100 consecutive iterations.

---

## 11. Existing Regression Tests

All 159 pre-existing automated regression tests continue to pass with zero failures:

- **Unit Suites:** Validations (12), ETA (7), Tech Token (7), Admin Cookie (7), State Machine (12), Payment State Machine (6), Capacity (8), Serialization (6), Notification Retry Reliability (10), Webhook Verification (8).
- **Integration Suites:** Customer Auth (4), IDOR Protection (4), Admin Auth (4), Tech Auth (5), Concurrency (3), Tracking Privacy (3), Soft Cancellation (2), API Contracts (8), Notification Resilience (3), Bug Audit Regression (10), Admin Rendering Loops (5), Mark Arrived Dual Auth (10), Prisma Decimal Boundary (5), SMS Delivery Webhook Lifecycle (14).
- **E2E Journeys:** Customer (1), Admin (1), Technician (1), Live Tracking (1), Quote/Receipt (1), Reviews (1), Critical Negative Flows (10).

**Master Regression Suite Results:**
- **Previous Tests:** 159
- **Phase 3A Tests Added:** 50
- **Total Master Tests:** 209
- **Passed:** 209
- **Failed:** 0

---

## 12. TypeScript Verification Result

Executed: `npx tsc --noEmit`
- **Exit Code:** 0
- **Errors:** 0
- **Status:** Clean type check across the entire project.

---

## 13. Production Build Result

Executed: `npm run build`
- **Compiler:** Next.js 16.3.1 (Turbopack)
- **Compilation Time:** 16.4s
- **TypeScript Verification:** 11.4s (0 errors)
- **Static Page Generation:** 67/67 routes generated successfully
- **Exit Code:** 0
- **Status:** Production build succeeded without warnings or failures.

---

## 14. Database Changes

- **Columns Added:** None (0)
- **Columns Modified:** None (0)
- **Models Modified:** None (0)
- `NotificationLog` schema remains completely untouched.

---

## 15. Migration Changes

- **Prisma Migrations Created:** None (0)
- **Prisma Migrations Pending:** None (0)

---

## 16. Dependency Changes

- **Packages Added:** None (0)
- **Packages Removed:** None (0)
- No third-party SMS SDKs (e.g. Twilio) installed.

---

## 17. Deviations from Prompt

- **None.** All deliverables were implemented strictly within the specified boundaries without exceeding the Phase 3A scope.

---

## 18. Remaining Risks

- **Phase 3B Trigger Risk:** In Phase 3B, when wiring admin notification triggers to booking creation, cancellation, and emergency requests, all dispatches must execute in post-commit non-blocking blocks to ensure primary business mutations are never aborted if SMS transmission fails or times out.
- **SMS Length Variance:** Extremely long vehicle descriptions or problem notes could expand multi-segment SMS sizes. The sanitizers in `lib/sms/templates.ts` enforce safe truncation boundaries to mitigate this risk.

---

## 19. Confirmation of Business Trigger Boundary

**CONFIRMED:**
- Zero business notification triggers were implemented in Phase 3A.
- No SMS dispatch logic was attached to booking mutations, emergency requests, contact forms, or cancellations.
- No Server Actions or API route handlers were modified to trigger notifications.
- All trigger implementations remain reserved for Phase 3B (Admin) and Phase 3C (Customer).

---

## 20. Final Phase 3A Status

```
============================================================
PHASE 3A STATUS: COMPLETE
READY FOR PHASE 3B: YES
============================================================
```
