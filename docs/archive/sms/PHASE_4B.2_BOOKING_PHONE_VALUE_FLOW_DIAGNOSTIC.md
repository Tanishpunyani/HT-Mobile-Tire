# PHASE 4B.2 — BOOKING PHONE VALUE FLOW READ-ONLY DIAGNOSTIC REPORT

**Mode**: STRICT READ-ONLY DIAGNOSTIC  
**Target Flow**: Customer Booking Phone Edit & Persistence Flow  
**Target Booking Examined**: `dfd876a8-2fd3-4fbe-8477-a2c367788dae`  
**Date**: September 23, 2026  
**Environment**: Local Development (`npm run dev`) / PostgreSQL / Supabase Auth  

---

## 1. EXECUTIVE SUMMARY

When an authenticated customer edits their pre-populated phone number on the booking form (e.g., from `(555) 987-6543` to `8360318923`):
1. **The browser and submit handler DO capture the new edited phone number** via `FormData.get("phone")` and send it to `createBookingRequestAction(data)`.
2. **The Server Action receives the new phone number** and passes it in-memory to `sendBookingConfirmation()`, which is why the initial admin SMS (`BOOKING_CREATED`) received the new number (`8360318923`).
3. **However, the new phone number is NEVER persisted in the database**:
   - `model Booking` in `prisma/schema.prisma` has **no phone column**; it relies exclusively on the relation `customerId -> Customer.phone`.
   - `getOrCreateCustomerForUser()` in `lib/auth.ts` queries the existing customer record (`e9879315-96f9-44c3-9561-19ff7ca9731d`), finds the existing row, and **silently discards the incoming phone**, returning the old phone `(555) 987-6543`.
   - `createBookingRequestAction()` creates the `Booking` row referencing only `customerId`.
4. **Consequently, every subsequent database-driven operation reverts to the old phone**:
   - The Admin Booking Detail page (`/admin/bookings/[id]`) queries `booking.customer.phone` and displays the old number `(555) 987-6543`.
   - When the admin clicks "Confirm Booking", `confirmBookingAction()` reads `updated.customer.phone` from the database and dispatches `sendCustomerBookingConfirmedAlert()` to the old number `(555) 987-6543`.
   - The confirmation SMS fails at the SMS gateway because `555` is an invalid North American area code, while the customer's real edited number was completely lost.

---

## 2. EXACT BOOKING FORM

- **Entry Point**: Clicking **"Book Now"** on any service card (`app/components/ServiceCard.tsx`, lines 41–44 & 84–89) navigates to:
  ```text
  /booking?service=<ServiceName>
  ```
- **Server Page**: `app/booking/page.tsx` (lines 9–38)
  - Loads authenticated user via `getAuthenticatedUser()`
  - Resolves profile via `getOrCreateCustomerForUser(authUser)`
  - Renders client component `<BookingFormClient initialCustomer={customer} initialAvailability={availability} />`
- **Client Component**: `app/booking/BookingFormClient.tsx` (lines 47–559)
  - Renders the full booking form with 6 sections (Contact Info, Service Selection, Tire Size, Vehicle, Location, Schedule).

---

## 3. PHONE INITIAL VALUE SOURCE

Tracing where the initial pre-filled phone number originates:
1. `app/booking/page.tsx` (line 15): `getAuthenticatedUser()` checks the active Supabase session.
2. `app/booking/page.tsx` (line 22): Calls `getOrCreateCustomerForUser(authUser)` in `lib/auth.ts`.
3. `lib/auth.ts` (lines 186–197): Executes `prisma.customer.findFirst({ where: { OR: [{ userId: authUser.id }, ...] } })`.
4. The database customer row for Alex Demo (`e9879315-96f9-44c3-9561-19ff7ca9731d`) has:
   ```json
   {
     "name": "Alex Demo",
     "phone": "(555) 987-6543",
     "email": "alex.demo@example.com"
   }
   ```
5. `initialCustomer` is passed to `BookingFormClient.tsx` (line 36):
   - State initialized: `const [customer, setCustomer] = useState<CustomerProfile | null>(initialCustomer);` (line 54)
   - Client fallback `useEffect` (lines 104–131): If `initialCustomer` was not provided on server, fetches `/api/customer/me` which returns the same database record.

---

## 4. PHONE INPUT IMPLEMENTATION

In `app/booking/BookingFormClient.tsx` (lines 306–322):

```tsx
<div>
  <label htmlFor="phone" className="mb-1 block text-xs font-bold text-foreground">
    Phone Number (for SMS Tracking) *
  </label>
  <div className="relative">
    <Phone className="absolute left-3 top-3 text-slate-400" size={16} />
    <input
      id="phone"
      name="phone"
      type="tel"
      required
      defaultValue={customer?.phone || ""}
      placeholder="(555) 000-0000"
      className="w-full rounded-xl border border-border bg-slate-50/50 pl-9 pr-4 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
    />
  </div>
</div>
```

### Component Properties Audit:
- **Controlled vs Uncontrolled**: **Uncontrolled input**. It uses `defaultValue={customer?.phone || ""}` and has **no `value` prop** and **no `onChange` handler**.
- **Initial Value**: `customer?.phone || ""` (evaluates to `"(555) 987-6543"`).
- **React State Variable**: Only `customer` (the whole object). There is no independent `phone` string state variable.
- **Form Field Name**: `name="phone"`.
- **Disabled / ReadOnly**: None. The field is fully editable by the user.
- **Hidden Inputs**: None for phone. (Line 374 has `<input type="hidden" name="service" ...>`, but no hidden phone field exists).

---

## 5. EDIT / CHANGE FLOW

1. Because the `<input>` is uncontrolled, when the customer types into the field, the DOM property `HTMLInputElement.value` updates immediately in the browser.
2. The visual text displayed to the user changes (e.g. to `8360318923`).
3. No React state is triggered during typing because there is no `onChange` handler.
4. **Displayed Phone Value** = `8360318923`.

---

## 6. SUBMIT FLOW

In `app/booking/BookingFormClient.tsx` (lines 133–172):

```tsx
async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  ...
  const form = event.currentTarget;
  const formData = new FormData(form);
  ...
  const data = {
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    ...
  };

  const result = await createBookingRequestAction(data);
```

### Extraction Audit:
- `formData.get("phone")` queries the current DOM input value.
- When the user edited the field to `8360318923`, `formData.get("phone")` evaluates to `"8360318923"`.
- **Submitted Phone Value** = `"8360318923"`.
- **Conclusion**: At the moment of form submission, **the displayed value and the submitted value are identical**. The client-side form does NOT revert to the old number.

---

## 7. SERVER ACTION FLOW

In `app/actions/bookings/customer.ts` (lines 15–80):

```ts
export async function createBookingRequestAction(formData: {
  ...
  name: string;
  email: string;
  phone: string;
  ...
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Resolve or create customer profile using unified identity resolver
    let customerId: string | null = null;
    if (user) {
      const resolvedCustomer = await getOrCreateCustomerForUser({
        id: user.id,
        email: formData.email || user.email || "",
        name: formData.name,
        phone: formData.phone,
      });
      customerId = resolvedCustomer.id;
    }
```

### Server Action Audit:
- `formData.phone` is received as `"8360318923"`.
- It is passed into `getOrCreateCustomerForUser({ id: user.id, phone: "8360318923", ... })`.
- Notice that `createBookingRequestAction` does **not** call `bookingSchema.safeParse` (it performs inline date/time checks only).

---

## 8. DATABASE PERSISTENCE FLOW (CRITICAL FAILURE POINT)

### Step A: Identity Resolution in `lib/auth.ts` (lines 163–216)

```ts
export async function getOrCreateCustomerForUser(authUser: AuthenticatedUser) {
  try {
    const userPhone = authUser.phone && authUser.phone !== "N/A" ? authUser.phone.trim() : null;
    const userEmail = authUser.email ? authUser.email.trim() : null;

    // 2. Direct Lookup: find customer by userId, email, or unlinked phone
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { userId: authUser.id },
          ...(userEmail ? [{ email: userEmail }] : []),
          ...(userPhone ? [{ phone: userPhone, userId: null }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (customer) {
      if (!customer.userId) {
        ...
      }

      // Customer row exists and is linked -> RETURN EXISTING ROW AS-IS!
      return {
        id: customer.id,
        userId: customer.userId || authUser.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone, // <--- PRESERVES EXISTING "(555) 987-6543"!
        createdAt: customer.createdAt.toISOString(),
      };
    }
```

**What happened:**
- `customer` already exists in `prisma.customer` for `userId: "7f8bab3e-5946-4f71-ab7e-a86bc5632f39"`.
- `customer.phone` in the database is `"(555) 987-6543"`.
- `getOrCreateCustomerForUser()` **never updates `customer.phone` or `customer.name`** when the customer record already exists!
- The function silently ignores `authUser.phone` (`"8360318923"`) and returns the customer object with the **old phone number** `"(555) 987-6543"`.

### Step B: Booking Row Creation in `app/actions/bookings/customer.ts` (lines 167–187)

```ts
    const booking = await prisma.booking.create({
      data: {
        customerId, // "e9879315-96f9-44c3-9561-19ff7ca9731d"
        serviceId: formData.serviceId || null,
        primaryService,
        bookingDate: bookingDateObj,
        bookingTime: bookingTimeObj,
        vehicle: vehicleStr,
        location: locStr,
        formattedAddress: formData.formattedAddress || null,
        latitude: formData.latitude ?? null,
        longitude: formData.longitude ?? null,
        city: formData.city ?? null,
        state: formData.state ?? null,
        zipCode: formData.zipCode ?? null,
        tireSize: formData.tireSize ?? null,
        message: formData.message || formData.notes || null,
        status: "pending",
        paymentStatus: "pending",
      },
    });
```

**Schema Reality in `prisma/schema.prisma`:**
- `model Booking` (lines 59–99) has **NO `phone` column**, **NO `name` column**, and **NO `email` column**.
- It only stores `customerId`.
- The edited phone `"8360318923"` was never written to `prisma.customer`, and cannot be written to `prisma.booking`.
- **The edited phone number is completely lost from the database.**

---

## 9. NOTIFICATION FLOW

### A. Initial Booking Created (Admin SMS):
In `app/actions/bookings/customer.ts` (lines 191–205):
```ts
await sendBookingConfirmation({
  id: booking.id,
  ...
  customer: {
    name: formData.name,
    phone: formData.phone, // In-memory "8360318923"
    email: formData.email,
  },
  ...
});
```
- In `lib/notifications.ts` (line 413): `customerPhone = booking.customer?.phone` receives `"8360318923"`.
- The Admin SMS (`BOOKING_CREATED`) body was built with:
  ```text
  Customer: Alex Demo (8360318923)
  ```
- **This explains why the admin SMS showed the new phone number.**

### B. Admin Views Booking in Admin Portal:
- The admin clicks the review URL `http://localhost:3000/admin/bookings/dfd876a8-2fd3-4fbe-8477-a2c367788dae`.
- `AdminBookingDetailPage` (`app/(admin-portal)/admin/bookings/[bookingId]/page.tsx`, lines 62–69 & 186–191) queries:
  ```ts
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true },
  });
  ```
- It renders:
  ```tsx
  {booking.customer?.phone || "No phone"}
  ```
- **The screen displays `(555) 987-6543` (the old database value).**

### C. Admin Confirms Booking (Customer SMS):
- In `app/actions/bookings/admin.ts` (lines 38–62):
  ```ts
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "confirmed", serviceConfirmedAt: new Date() },
    include: { customer: true, service: true },
  });

  await sendCustomerBookingConfirmedAlert({
    ...
    customer: updated.customer, // From DB: "(555) 987-6543"!
  });
  ```
- `resolveCustomerNotificationPhone(updated.customer)` extracts `updated.customer.phone` -> `"+15559876543"`.
- The SMS is dispatched to the unroutable fictional test number `+15559876543`, which fails with Capcom6 `400 Bad Request: "invalid phone number"`.
- **The real customer who typed `8360318923` never receives any SMS.**

---

## 10. EXACT VALUE AT EACH STAGE

| Stage | Component / Function | File & Lines | Value |
| :--- | :--- | :--- | :--- |
| **A. Initial Display** | `input defaultValue` | `BookingFormClient.tsx:317` | `"(555) 987-6543"` |
| **B. After User Edit** | `input.value` (DOM) | Browser DOM | `"8360318923"` |
| **C. FormData Collected** | `formData.get("phone")` | `BookingFormClient.tsx:152` | `"8360318923"` |
| **D. Server Action Received** | `formData.phone` | `actions/bookings/customer.ts:58` | `"8360318923"` |
| **E. Validated Phone** | In-memory `formData` | `actions/bookings/customer.ts:58` | `"8360318923"` |
| **F. Customer DB Record** | `customer.phone` in DB | `lib/auth.ts:186–216` | `"(555) 987-6543"` *(OLD)* |
| **G. Booking DB Record** | `Booking` table | `schema.prisma:59–99` | *Column does not exist* |
| **H. Admin SMS Body** | `buildAdminNewBookingSms` | `notifications.ts:468–471` | `"8360318923"` *(NEW)* |
| **I. Admin Portal UI** | `booking.customer.phone` | `admin/bookings/[id]/page.tsx:190` | `"(555) 987-6543"` *(OLD)* |
| **J. Customer Confirmed SMS** | `sendCustomerBookingConfirmedAlert` | `actions/bookings/admin.ts:60` | `"(555) 987-6543"` *(OLD)* |

---

## 11. FIRST DIVERGENCE POINT

```text
FIRST DIVERGENCE POINT:
File: lib/auth.ts
Function: getOrCreateCustomerForUser()
Lines: 186–216

When an existing customer record is found matching authUser.id, getOrCreateCustomerForUser() 
returns the existing database row without updating customer.phone with the user's submitted phone. 
Because model Booking lacks a phone column, the submitted phone number is completely dropped 
from persistence.
```

---

## 12. ROOT CAUSE CLASSIFICATION

**Classification**: **F. Customer profile value overriding submitted value**  
*(Compounded by the absence of a direct `phone` column on `model Booking`)*

### Detailed Explanation:
The bug is **not** a React controlled/uncontrolled state bug or a FormData collection bug. The client properly collected and sent `"8360318923"`.  
The failure occurs because the backend treats customer contact data as an immutable profile query (`getOrCreateCustomerForUser`) rather than updating the customer profile or recording the booking contact information with the newly submitted values.

---

## 13. AFFECTED FEATURES

| Feature / Area | Affected? | Impact Description |
| :--- | :---: | :--- |
| **Customer Confirmation SMS** | **YES** | Dispatches to old DB phone (`(555) 987-6543`), fails delivery. |
| **Customer Technician Assigned SMS** | **YES** | Dispatches to old DB phone. |
| **Customer Service Completed SMS** | **YES** | Dispatches to old DB phone. |
| **Admin Booking Detail Page** | **YES** | Admin sees and calls old phone instead of edited phone. |
| **Admin Booking List Page** | **YES** | Shows customer name/phone from old DB record. |
| **Database Customer Profile** | **YES** | Never updates customer phone number upon booking. |
| **Future Bookings** | **YES** | Continuously pre-fills stale phone number. |
| **Existing Logged-in Customers** | **YES** | Any logged-in customer editing their phone is ignored. |
| **Guest Bookings** | **PARTIAL** | If guest uses existing email, `findFirst` matches and ignores new phone. |
| **Secondary Route (`/api/bookings`)** | **YES** | Line 73 explicitly overrides: `user.user_metadata?.phone || result.data.phone`. |
| **Emergency Requests** | **NO** | `emergency-requests/route.ts` creates/finds by submitted phone. |
| **Contact Messages** | **NO** | `contact_messages` stores `phone` directly on the message row. |

---

## 14. MINIMAL SAFE FIX RECOMMENDATION (FOR FUTURE IMPLEMENTATION)

When authorized to implement a fix:

1. **Update `getOrCreateCustomerForUser` in `lib/auth.ts`**:
   When an existing customer is found and the incoming `authUser.phone` or `authUser.name` differs from the stored values, update the `Customer` record:
   ```ts
   if (customer) {
     const incomingPhone = authUser.phone && authUser.phone !== "N/A" ? authUser.phone.trim() : null;
     const incomingName = authUser.name ? authUser.name.trim() : null;

     if ((incomingPhone && incomingPhone !== customer.phone) || (incomingName && incomingName !== customer.name)) {
       customer = await prisma.customer.update({
         where: { id: customer.id },
         data: {
           ...(incomingPhone ? { phone: incomingPhone } : {}),
           ...(incomingName ? { name: incomingName } : {}),
         },
       });
     }
     return { ... };
   }
   ```
2. **Synchronize in `createBookingRequestAction` (`app/actions/bookings/customer.ts`)**:
   Ensure `prisma.customer.update({ where: { id: customerId }, data: { phone: formData.phone, name: formData.name } })` executes if `formData.phone` is provided, ensuring both guest and authenticated customer profiles always reflect the customer's latest contact number.
3. **Align `/api/bookings/route.ts` (line 73)**:
   Change `user.user_metadata?.phone || result.data.phone` to `result.data.phone || user.user_metadata?.phone` so the explicitly entered booking phone takes precedence over stale Supabase metadata.

---

## 15. FILES THAT WOULD NEED MODIFICATION (WHEN AUTHORIZED)

1. `lib/auth.ts` (update `getOrCreateCustomerForUser` to sync edited phone/name into `prisma.customer`)
2. `app/actions/bookings/customer.ts` (ensure `customer.phone` updates for both authenticated and guest bookings)
3. `app/api/bookings/route.ts` (ensure submitted form phone takes priority over stale user metadata)

---

## 16. FILES THAT MUST NOT BE MODIFIED

- `prisma/schema.prisma` (no schema changes or migrations needed)
- `lib/sms/token-manager.ts` (TokenManager is healthy and functioning properly)
- `lib/sms/providers/android-gateway.ts` (Gateway provider is healthy)
- `lib/sms/webhook-verification.ts` (Webhook logic is unrelated)
- `lib/sms/templates.ts` (Templates render valid SMS text)

---

## 17. VERIFICATION PLAN (WHEN AUTHORIZED)

1. **Unit Test**: Test `getOrCreateCustomerForUser` with updated phone to verify `prisma.customer.update` fires.
2. **Server Action Test**: Call `createBookingRequestAction` with an existing customer and a new phone number; verify that `prisma.customer.findUnique` reflects the updated phone.
3. **Admin Page Verification**: Verify `/admin/bookings/[id]` displays the new phone number.
4. **Confirmation Alert Verification**: Verify `confirmBookingAction()` triggers `sendCustomerBookingConfirmedAlert` to the new phone number.
5. **Full Regression Test**: Run `npm run test:unit` and verify all tests pass.
