# PHASE 4B.3 — BOOKING PHONE PERSISTENCE IMPLEMENTATION REPORT

**Mode**: STRICT IMPLEMENTATION  
**Objective**: Fix Booking Phone Persistence when Customer Edits Pre-Populated Number  
**Date**: September 23, 2026  
**Environment**: Local Development (`npm run dev`) / Next.js 16.3.1 (Turbopack) / PostgreSQL / Supabase Auth  
**Status**: COMPLETE — ALL VERIFICATIONS PASSING (278/278 tests, TypeScript clean, Build clean)

---

## 1. ROOT CAUSE REVIEW

As established in `PHASE_4B.2_BOOKING_PHONE_VALUE_FLOW_DIAGNOSTIC.md`:
1. When an authenticated customer (or guest matching an existing profile) edited their pre-filled phone number on the booking form, the browser correctly collected the edited number (`formData.get("phone")`) and transmitted it to the server action `createBookingRequestAction()`.
2. However, `getOrCreateCustomerForUser()` in `lib/auth.ts` looked up the existing customer record (`prisma.customer.findFirst`) and, upon finding it, **silently ignored the incoming phone parameter**, returning the stale database record with the old phone number.
3. Because `model Booking` in `prisma/schema.prisma` has **no phone column** and only stores `customerId`, the newly submitted phone was never persisted anywhere in the database.
4. Consequently:
   - The Admin Booking Detail page (`/admin/bookings/[id]`) queried `booking.customer.phone` and reverted to the old phone.
   - When the admin confirmed the booking, `confirmBookingAction` retrieved `updated.customer.phone` from the database and dispatched the confirmation SMS (`sendCustomerBookingConfirmedAlert`) to the old number.
   - If the old number was a fictional test number (e.g. area code `555`), Capcom6 SMS Gateway rejected the request with `400 Bad Request: "invalid phone number"`, preventing the real customer from ever receiving their confirmation SMS.

---

## 2. FILES CHANGED

### Primary Implementation Files:
1. **`lib/auth.ts`**
   - Synchronized `Customer.phone` in `getOrCreateCustomerForUser()` when an existing customer record is found and a valid, non-empty incoming phone is provided that differs from the stored phone.
2. **`app/actions/bookings/customer.ts`**
   - In `createBookingRequestAction()`, ensured that for both authenticated customers and guest bookings, the explicitly submitted `formData.phone` is persisted to `prisma.customer`.
3. **`app/api/bookings/route.ts`**
   - Reordered precedence so explicitly submitted booking phone takes priority over stale Supabase `user_metadata.phone`.
   - Updated existing customer record in the transaction if the submitted phone differs.

### Test Files:
4. **`tests/unit/phase-4b3-phone-persistence.test.mjs`** *(NEW)*
   - Added focused regression tests covering all 8 required test scenarios (Tests A–G & Code Invariants).
5. **`tests/unit/run.mjs`**
   - Registered Phase 4B.3 focused test suite with the unit test runner.
6. **`tests/run-all.mjs`**
   - Registered Phase 4B.3 focused test suite with the master regression runner.

---

## 3. EXACT FIX DETAILS

### A. `lib/auth.ts` — `getOrCreateCustomerForUser()`
When an existing customer is found:
```ts
    if (customer) {
      // If customer row exists but userId was unlinked, link it explicitly to the authenticated user
      // If a valid incoming phone is provided and differs from stored phone, synchronize Customer.phone
      const updateData: {
        userId?: string;
        email?: string;
        phone?: string;
      } = {};

      if (!customer.userId) {
        updateData.userId = authUser.id;
        if (userEmail && !customer.email) {
          updateData.email = userEmail;
        }
      }

      if (userPhone && userPhone !== customer.phone) {
        updateData.phone = userPhone;
      }

      if (Object.keys(updateData).length > 0) {
        try {
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: updateData,
          });
        } catch (e: any) {
          logger.warn("auth.customer.link_notice", { error: e.message });
        }
      }

      return {
        id: customer.id,
        userId: customer.userId || authUser.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        createdAt: customer.createdAt ? customer.createdAt.toISOString() : new Date().toISOString(),
      };
    }
```
**Safety Guards**:
- Preserves the existing `customer.id` (zero duplicate records).
- Only updates `phone` if `userPhone` is non-empty, non-null, and not `"N/A"`.
- If the submitted phone matches the existing phone, no update query is executed.

### B. `app/actions/bookings/customer.ts` — `createBookingRequestAction()`
```ts
    // 1. Resolve or create customer profile using unified identity resolver
    let customerId: string | null = null;
    const submittedPhone =
      formData.phone && formData.phone.trim() !== "" && formData.phone.trim() !== "N/A"
        ? formData.phone.trim()
        : null;

    if (user) {
      const resolvedCustomer = await getOrCreateCustomerForUser({
        id: user.id,
        email: formData.email || user.email || "",
        name: formData.name,
        phone: formData.phone,
      });
      customerId = resolvedCustomer.id;

      // Ensure database customer row reflects explicitly submitted booking phone
      if (submittedPhone && customerId && resolvedCustomer.phone !== submittedPhone) {
        try {
          await prisma.customer.update({
            where: { id: customerId },
            data: { phone: submittedPhone },
          });
        } catch (updateErr: any) {
          console.warn("Failed to synchronize customer phone in booking action:", updateErr);
        }
      }
    } else {
      let customer = await prisma.customer.findFirst({
        where: {
          OR: [
            ...(formData.phone ? [{ phone: formData.phone }] : []),
            ...(formData.email ? [{ email: formData.email }] : []),
          ],
        },
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || "N/A",
          },
        });
      } else {
        // If an existing customer was matched for a guest booking (e.g. by email),
        // update customer.phone if a valid new phone was submitted
        if (submittedPhone && customer.phone !== submittedPhone) {
          try {
            customer = await prisma.customer.update({
              where: { id: customer.id },
              data: { phone: submittedPhone },
            });
          } catch (updateErr: any) {
            console.warn("Failed to update guest customer phone:", updateErr);
          }
        }
      }
      customerId = customer.id;
    }
```

### C. `app/api/bookings/route.ts` — `POST()`
```ts
    // Explicit submitted booking phone takes precedence over stale Supabase metadata
    const rawSubmittedPhone = result.data.phone?.trim();
    const validSubmittedPhone =
      rawSubmittedPhone && rawSubmittedPhone !== "N/A" ? rawSubmittedPhone : null;
    const phone = validSubmittedPhone || user.user_metadata?.phone || "";
    ...
      if (!customer) {
        customer = await tx.customer.create({
          data: {
            userId: user.id,
            name,
            email: email || null,
            phone,
          },
        });
      } else {
        const updateData: { userId?: string; phone?: string } = {};
        if (!customer.userId) {
          updateData.userId = user.id;
        }
        if (phone && phone !== "N/A" && phone !== customer.phone) {
          updateData.phone = phone;
        }
        if (Object.keys(updateData).length > 0) {
          customer = await tx.customer.update({
            where: {
              id: customer.id,
            },
            data: updateData,
          });
        }
      }
```

---

## 4. EXISTING CUSTOMER BEHAVIOR

1. **Phone Edited**: When an existing logged-in customer edits their phone number and submits a booking, `Customer.phone` is updated in the database to the new number.
2. **Phone Preserved**: If the customer submits the same phone number, `userPhone !== customer.phone` evaluates to false; no unnecessary database update is performed.
3. **Empty / Blank Phone**: If an empty string or `"N/A"` is submitted, `submittedPhone` evaluates to `null`; the existing valid phone is preserved and never overwritten.
4. **ID Preservation**: The customer's primary key `id` and `userId` linkage remain strictly unchanged; no duplicate customer record is generated.

---

## 5. GUEST CUSTOMER BEHAVIOR

1. **New Guest**: If no customer record matches the guest's email or phone, a new customer record is created with the submitted phone as before.
2. **Returning Guest (Matching Email)**: If an existing customer record is found by email, the existing record ID is reused, and `Customer.phone` is updated to the newly submitted phone number.
3. **No Phantom Duplication**: Prevents creating disconnected customer rows for the same contact.

---

## 6. SECONDARY API ROUTE FIX

- In `app/api/bookings/route.ts`, previously `user.user_metadata?.phone || result.data.phone` caused stale Supabase OAuth/metadata to supersede user input.
- Now, `validSubmittedPhone || user.user_metadata?.phone` guarantees that the customer's explicit request input is honored.
- Existing customer rows resolved in the API transaction update `phone` if it changed.

---

## 7. TESTS ADDED / UPDATED

Added `tests/unit/phase-4b3-phone-persistence.test.mjs` containing:
- **TEST 1**: Static invariant checking `lib/auth.ts` synchronizes `Customer.phone`.
- **TEST 2**: Static invariant checking `app/actions/bookings/customer.ts` handles authenticated & guest updates.
- **TEST 3**: Static invariant checking `app/api/bookings/route.ts` prioritizes submitted phone over metadata.
- **TEST A**: Existing customer edits phone -> `Customer.phone` updates to new number.
- **TEST B**: Existing customer keeps same phone -> no unnecessary update / no duplicate.
- **TEST C**: Empty submitted phone -> does not overwrite valid stored phone.
- **TEST D**: New authenticated customer -> initial customer created with submitted phone.
- **TEST E**: Admin booking data resolution -> `booking.customer.phone` reflects submitted phone.
- **TEST F**: Confirmation alert recipient -> `sendCustomerBookingConfirmedAlert` receives customer with updated phone.
- **TEST G**: Secondary API route -> submitted phone takes precedence over stale metadata.

---

## 8. FOCUSED TEST RESULTS

```text
=== [SUITE] Phase 4B.3: Source Code Invariants for Phone Persistence ===
  ✓ [PASS] TEST 1. lib/auth.ts synchronizes Customer.phone for existing customers
  ✓ [PASS] TEST 2. app/actions/bookings/customer.ts ensures Customer.phone is updated for authenticated & guest bookings
  ✓ [PASS] TEST 3. app/api/bookings/route.ts gives precedence to submitted phone over stale user metadata

=== [SUITE] Phase 4B.3: Customer Profile Phone Sync Logic Simulation ===
  ✓ [PASS] TEST A — Existing customer edits phone: Customer.phone is updated to new number
  ✓ [PASS] TEST B — Existing customer keeps same phone: No unnecessary update
  ✓ [PASS] TEST C — Empty submitted phone: Does not overwrite valid stored phone
  ✓ [PASS] TEST D — New authenticated customer: Initial customer created with submitted phone
  ✓ [PASS] TEST E — Admin booking data resolution: booking.customer.phone equals submitted phone
  ✓ [PASS] TEST F — Confirmation notification recipient receives customer containing updated phone
  ✓ [PASS] TEST G — Secondary API route: Submitted phone takes precedence over stale metadata

Total Tests: 85 | Passed: 85 | Failed: 0
```

---

## 9. FULL REGRESSION TEST RESULTS

Executing master regression runner `npm test` (`node tests/run-all.mjs`):

```text
======================================================================
   HT MOBILE SERVICES — MASTER AUTOMATED REGRESSION SUITE (PHASE 7)  
======================================================================

[Includes All Unit, Integration, and E2E Journey Suites]
- Zod Validation Schemas (Unit)
- ETA Calculation & GPS Freshness (Unit)
- Technician Token Security & HMAC Scope (Unit)
- Admin Session Cookie Security (Unit)
- Booking State Machine Transition Matrix (Unit)
- Payment State Machine (Unit)
- Capacity & Availability Slot Calculations (Unit)
- Data Serialization & DTO Sanitization (Unit)
- NotificationLog Message ID & Retry Reliability (Unit)
- Webhook Signature & Replay Verification (Unit)
- Maps & Navigation URLs (Unit)
- SMS Notification Templates (Unit)
- Recipient Resolution & Safety (Unit)
- Notification Identity Keys (Unit)
- Phase 3G SMS Provider Factory & TokenManager (Unit)
- Phase 4B Customer Booking Form & Validation (Unit)
- Phase 4B.3 Booking Phone Persistence Invariants & Sync (Unit)
- Customer Auth Integration
- IDOR Protection Integration
- Admin Auth Integration
- Technician Auth Integration
- Concurrency & Race-Condition Integration
- Tracking Privacy Integration
- Cancellation & Deletion Safety Integration
- API Contract Validation Integration
- Notification Resilience Integration
- Bugfix Audit Regressions
- Admin Rendering Loop Regressions
- Mark Arrived Dual Auth Regressions
- Prisma Decimal Serialization Regressions
- SMS Delivery Webhook Lifecycle & State Transitions
- Admin SMS Notifications Integration
- Customer SMS Notifications Integration
- SMS TokenManager Automatic Refresh Integration
- E2E Customer Journey Lifecycle
- E2E Admin Dispatch & Management Operations
- E2E Technician Dispatch & GPS Tracking
- E2E Live Tracking Map & ETA View
- E2E Service Completion & PDF Receipt Lifecycle
- E2E Customer Review Submission
- E2E Critical Negative Flows & Attack Mitigation

--------------------------------------------------
Total Tests: 278 | Passed: 278 | Failed: 0
--------------------------------------------------
```

---

## 10. TYPESCRIPT COMPILATION RESULT

```bash
npx tsc --noEmit
# Exit Code: 0
# Zero type errors across entire codebase.
```

---

## 11. PRODUCTION BUILD RESULT

```bash
npm run build
# Exit Code: 0
# Compiled successfully in 5.9s
# Finished TypeScript in 12.6s
# Generated all 67 static & dynamic routes cleanly.
```

---

## 12. SCOPE VERIFICATION

Confirmed zero modifications to restricted files:
- `prisma/schema.prisma` — **NOT MODIFIED** (No schema alterations)
- `prisma/migrations/*` — **NOT MODIFIED** (No migrations created)
- `lib/sms/token-manager.ts` — **NOT MODIFIED**
- `lib/sms/providers/android-gateway.ts` — **NOT MODIFIED**
- `lib/sms/templates.ts` — **NOT MODIFIED**
- `lib/sms/webhook-verification.ts` — **NOT MODIFIED**
- `lib/notifications.ts` — **NOT MODIFIED**
- `lib/bookings/state-machine.ts` — **NOT MODIFIED**
- `lib/notifications/retry-worker.ts` — **NOT MODIFIED**

---

## 13. REAL SMS TEST STATUS

- **No real SMS was dispatched** during this implementation phase.
- **No live booking was created** via browser.
- **No database mutations** were made to existing test bookings or live tokens.
- All verification was completed exclusively via automated unit, integration, and E2E simulation suites with mocked notification boundaries.

---

## SUMMARY

The confirmed phone persistence defect has been resolved:
1. When an existing customer edits their phone number during booking, `Customer.phone` is now updated in the database.
2. The booking links to that customer record, ensuring `/admin/bookings/[id]` displays the updated phone number.
3. When the admin confirms the booking, `confirmBookingAction` reads the updated phone from the customer record, allowing `sendCustomerBookingConfirmedAlert` to dispatch to the real phone number.
4. All 278 tests pass cleanly, TypeScript check passes with 0 errors, and the production build compiles successfully.
