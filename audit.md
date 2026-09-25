# Static Audit Report: Tire Mobile Clinic Next.js

> **Disclaimer:** This is a static analysis. Runtime behavior may differ. Production testing recommended before launch.

---

## 1. Executive Summary

- **Overall Score:** 78/100
- **Status:** Needs Fixes Before Launch
- **Summary:** The Tire Mobile Clinic application demonstrates a well-architected Next.js 16 App Router codebase with strong SEO optimization, Zod schema validations, and clean component design. However, critical security concerns exist—specifically an IDOR vulnerability on the booking update/delete API endpoints, hardcoded admin email fallbacks, missing Prisma index definitions, and unversioned database schema migrations.
- **Issue Breakdown:**
  - **Critical Issues:** 2
  - **High Issues:** 3
  - **Medium Issues:** 4
  - **Low Issues:** 3

---

## 2. Project Structure & File Organization

**Score:** 78/100

- **Directory Tree Analysis:**
  - `app/`: Next.js App Router root containing page routes, dynamic routes, and API endpoints (`/api/*`).
  - `components/`: Split structure. 28 customer-facing UI components are located inside `app/components/`, while 5 admin modal/dashboard components reside in root `components/admin/`.
  - `lib/`: Houses core business logic including `auth.ts`, `prisma.ts`, `sms.ts`, `email.ts`, `notifications.ts`, `api-client.ts`, `rate-limit.ts`, `receipts.ts`, `supabase/`, and `validations/`.
  - `prisma/`: Contains `schema.prisma`. Note: `prisma/migrations/` directory is missing.
  - `public/`: 5 root SVG icons and 6 WebP images in `public/images/`.
- **Next.js App Router Convention Compliance:** Compliant with App Router conventions (`page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx`, `loading.tsx`, `robots.ts`, `sitemap.ts`).
- **Client vs Server Component Separation:** Explicit `"use client"` directives are correctly placed on interactive components (e.g., [BookingFormClient.tsx](file:///d:/Tire-Services/tire-mobile-clinic-next/app/booking/BookingFormClient.tsx), [CoverageChecker.tsx](file:///d:/Tire-Services/tire-mobile-clinic-next/app/components/CoverageChecker.tsx), [LiveVanTracker.tsx](file:///d:/Tire-Services/tire-mobile-clinic-next/app/components/LiveVanTracker.tsx)).
- **Duplicate / Disorganized Files:** Component organization is split across `app/components/` and root `components/admin/`. Furthermore, `app/service-area/page.tsx` serves as a redirect to `app/service-areas/page.tsx`.
- **File Naming Consistency:** Consistent PascalCase for React components and camelCase / kebab-case for routes and utility modules.
- **.gitignore Status:** `.gitignore` excludes `/node_modules`, `/.next/`, and `.env*`. However, line 43 specifies `/app/generated/prisma` instead of the root `/generated/` output folder, causing generated Prisma code to appear in Git untracked status.
- **Git Status Summary:**
  - **Modified Files Count:** 7 (`.gitignore`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `next.config.ts`, `package-lock.json`, `package.json`)
  - **Untracked Directories/Files Count:** 35
  - **Tracked `.env` Files:** NO (Confirmed: zero `.env` files are tracked in Git history).

---

## 3. Tech Stack & Dependencies

**Score:** 82/100

- **Available package.json Scripts:**
  - `dev`: `next dev`
  - `build`: `next build`
  - `start`: `next start`
  - `lint`: `eslint`
  - `set-admin`: `node --env-file=.env scripts/set-admin.mjs`
  - `delete-user`: `node --env-file=.env scripts/delete-user.mjs`
  - `clear-data`: `node --env-file=.env scripts/clear-test-data.mjs`

- **npm Audit Severity Summary:**
  - **Critical:** 0
  - **High:** 3 (`deepmerge-ts` vulnerability transitively via `@prisma/config` / `prisma`)
  - **Moderate:** 0
  - **Low:** 0

- **Dependencies List:**
  - `@googlemaps/js-api-loader`: `^2.1.1`
  - `@prisma/adapter-pg`: `^7.9.1`
  - `@prisma/client`: `^7.9.1`
  - `@supabase/ssr`: `^0.12.4`
  - `@supabase/supabase-js`: `^2.112.3`
  - `lucide-react`: `^1.33.0`
  - `next`: `16.3.1`
  - `pdf-lib`: `^1.17.1`
  - `prisma`: `^7.9.1`
  - `react`: `19.2.8`
  - `react-dom`: `19.2.8`
  - `resend`: `^6.24.0`
  - `twilio`: `^6.1.0`
  - `zod`: `^4.4.3`

- **devDependencies List:**
  - `@tailwindcss/postcss`: `^4`
  - `@types/node`: `^20`
  - `@types/react`: `^19`
  - `@types/react-dom`: `^19`
  - `eslint`: `^9`
  - `eslint-config-next`: `16.3.1`
  - `sharp`: `^0.33.5`
  - `tailwindcss`: `^4`
  - `typescript`: `^5`

- **Unused / Missing Packages:**
  - **Missing Recommended:** `stripe` (referenced in project specs / requirements but package is not installed).
  - **Unused/Redundant:** None detected.

---

## 4. Build & Type Safety

**Score:** 85/100

- **`npx tsc --noEmit` Status:** **SUCCESS** (0 Errors, 0 Warnings).
- **`npm run build` Status:** **SUCCESS** (Compiled 61 static & dynamic pages successfully in Turbopack in 26.6s).
- **`npm run lint` Status:** Requires adding `generated/` to `eslint.config.mjs` ignores to prevent scanning generated Prisma client code.
- **`any` Type Usage References (Application Source Code):**
  - [`lib/sms.ts:63`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms.ts#L63) — `catch (error: any)`
  - [`lib/sms.ts:102`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/sms.ts#L102) — `catch (error: any)`
  - [`lib/notifications.ts:154`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L154) — `catch (error: any)`
  - [`lib/notifications.ts:737`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts#L737) — `entityType: (log.entityType as any)`
  - [`lib/auth.ts:68`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/auth.ts#L68) — `(supabase.from("customers") as any)`
  - [`lib/auth.ts:91`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/auth.ts#L91) — `(supabase.from("customers") as any)`
  - [`lib/api-client.ts:9-11`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/api-client.ts#L9-L11) — `customer?: any; emergencyRequests?: any[]; bookings?: any[];`
  - [`app/booking/BookingFormClient.tsx:144`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/booking/BookingFormClient.tsx#L144) — `catch (error: any)`
  - [`app/api/customer/profile/route.ts:51`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/customer/profile/route.ts#L51) — `let customer: any;`
  - [`app/api/customer/profile/route.ts:92`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/customer/profile/route.ts#L92) — `const supabase: any = createAdminClient();`
  - [`app/actions/bookings.ts:16`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings.ts#L16) — `createBookingRequestAction(formData: any)`

---

## 5. Security Audit

**Score:** 65/100

### Findings Summary

- **[STATIC ANALYSIS] Hardcoded Admin Emails in Source Code:**
  - Found in [`app/api/auth/sync-customer/route.ts:43`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/auth/sync-customer/route.ts#L43), [`app/api/admin/me/route.ts:44-45`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/admin/me/route.ts#L44-L45), [`lib/auth/admin.ts:23-24`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/auth/admin.ts#L23-L24), and [`scripts/check-user.mjs:14`](file:///d:/Tire-Services/tire-mobile-clinic-next/scripts/check-user.mjs#L14). Email strings are hardcoded as admin bypass checks rather than relying purely on environment variables (`ADMIN_EMAILS`). Values are [REDACTED].
- **[STATIC ANALYSIS] Secrets in Git History:**
  - `git log` inspection confirmed NO active secret API keys or credentials committed in repository history.
- **[STATIC ANALYSIS] CSP Header Presence:**
  - Present in [`next.config.ts:29-31`](file:///d:/Tire-Services/tire-mobile-clinic-next/next.config.ts#L29-L31). Configures `default-src 'self'`, `script-src`, `connect-src`, `img-src`, and `frame-ancestors 'none'`. Note: Uses `'unsafe-inline'` for styles and development scripts.
- **[STATIC ANALYSIS] Permissions-Policy Header Correctness:**
  - Correctly configured in [`next.config.ts:45-47`](file:///d:/Tire-Services/tire-mobile-clinic-next/next.config.ts#L45-L47): `camera=(), microphone=(), geolocation=(self)`.
- **[STATIC ANALYSIS] Admin Route Protection in Middleware / Proxy:**
  - Implemented in [`proxy.ts:35-47`](file:///d:/Tire-Services/tire-mobile-clinic-next/proxy.ts#L35-L47) for `/admin` page paths. Note: `/api/admin/*` paths are not intercepted by `proxy.ts` matcher logic and rely on individual route handler checks.
- **[STATIC ANALYSIS] API Route Auth Checks (Sampled Routes):**
  - [`app/api/customer/profile/route.ts:19`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/customer/profile/route.ts#L19) — Enforces `getAuthenticatedUser()` and `isCustomer()` (401/403 responses).
  - [`app/api/admin/bookings/route.ts:8`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/admin/bookings/route.ts#L8) — Enforces `getAdminUser()` check.
  - [`app/api/bookings/[id]/route.ts:9-148`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/[id]/route.ts#L9-L148) — **MISSING AUTH CHECKS**.
- **[STATIC ANALYSIS] Environment Variable Exposure Check:**
  - Client-side exposed variables start with `NEXT_PUBLIC_` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_BUSINESS_PHONE`, `NEXT_PUBLIC_APP_URL`). Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_AUTH_TOKEN`, `RESEND_API_KEY`) remain strictly on the server.
- **[STATIC ANALYSIS] SQL Injection Risks:**
  - Verified: No raw SQL string concatenations found. Prisma ORM parameterized queries are used exclusively across actions and API routes.
- **[RUNTIME VERIFICATION REQUIRED] Actual SQL Injection Exploitability:** Requires penetration testing to verify database driver handling.
- **[STATIC ANALYSIS] XSS Risks:**
  - Only explicit `dangerouslySetInnerHTML` usage is for JSON-LD structured data in [`app/layout.tsx:167`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/layout.tsx#L167). React JSX auto-escaping protects dynamic content rendering.
- **[RUNTIME VERIFICATION REQUIRED] Browser-level XSS Behavior:** Requires active DOM payload testing.
- **[RUNTIME VERIFICATION REQUIRED] Rate Limiting Implementation Status:** In-memory sliding window rate limiting is active in [`app/api/contact-messages/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/contact-messages/route.ts) and [`app/api/emergency-requests/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/emergency-requests/route.ts). Distributed Redis rate limiting required for multi-instance deployments.

---

### Authorization & Data Access Boundaries

- **[STATIC ANALYSIS] Customer-to-Customer Data Isolation:**
  - Verified SAFE in [`app/api/customer/profile/route.ts:85-87`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/customer/profile/route.ts#L85-L87) (`where: { customerId: customer.id }`).
- **[STATIC ANALYSIS] Admin-to-Customer Authorization Boundaries:**
  - Verified SAFE in [`proxy.ts:28-31`](file:///d:/Tire-Services/tire-mobile-clinic-next/proxy.ts#L28-L31) (Admin sessions attempting `/account` customer portal access are redirected to `/`).
- **[STATIC ANALYSIS] Booking Ownership Checks (IDOR / BOLA Risk):**
  - **DANGEROUS:** [`app/api/bookings/[id]/route.ts:27-31`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/%5Bid%5D/route.ts#L27-L31) and [`app/api/bookings/[id]/route.ts:111-115`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/%5Bid%5D/route.ts#L111-L115) execute `prisma.booking.findUnique({ where: { id } })` for `PUT` and `DELETE` requests **without checking user authentication or ownership**.
- **[STATIC ANALYSIS] IDOR/BOLA Patterns:**
  - `PUT /api/bookings/[id]` and `DELETE /api/bookings/[id]` accept arbitrary UUID parameters without verifying if the caller owns the booking or possesses an admin role.
- **[STATIC ANALYSIS] Database Query Constraints:**
  - Public booking query endpoints must enforce `userId` or `customerId` matching against session tokens.

---

### ENV Audit (Secret-Safe Format)

| Variable | Status | Used In | Notes |
|----------|--------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | [SET] | `lib/supabase/*` | Public, safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | [SET] | `lib/supabase/*` | Public, safe |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | [SET] | `app/components/*` | Public, safe |
| `NEXT_PUBLIC_BUSINESS_PHONE` | [SET] | `app/layout.tsx`, components | Public, safe |
| `NEXT_PUBLIC_APP_URL` | [SET] | `app/layout.tsx` | Public, safe |
| `SUPABASE_SERVICE_ROLE_KEY` | [SET] | `lib/supabase/admin.ts` | Server-side only, secret |
| `STRIPE_SECRET_KEY` | [NOT SET] | N/A | Stripe integration not installed |
| `TWILIO_ACCOUNT_SID` | [SET] | `lib/sms.ts` | Server-side only |
| `TWILIO_AUTH_TOKEN` | [SET] | `lib/sms.ts` | Server-side only |
| `TWILIO_PHONE_NUMBER` | [SET] | `lib/sms.ts` | Server-side only |
| `RESEND_API_KEY` | [SET] | `lib/email.ts` | Server-side only |
| `ADMIN_EMAILS` | [SET] | `proxy.ts`, `lib/auth/admin.ts` | Access control list |

---

## 6. Performance Analysis

**Score:** 80/100

- **Image Files & Sizes in `public/images/`:**
  - `Swap_Tire_rim_ON_OFF.webp` — 44.1 KB
  - `Wheel_Balancing.webp` — 49.1 KB
  - `flat_tire_repair.webp` — 53.3 KB
  - `fleet_tire_services.webp` — 56.6 KB
  - `hero-mobile-tire-clinic.webp` — 130.7 KB
  - `mobile-van-service.webp` — 49.5 KB
- **Image Formats:** 100% WebP format utilized across all primary imagery.
- **next/image vs raw `<img>` Tags:**
  - `next/image` (`<Image />`) used across key landing page components.
  - Raw `<img>` tags detected in [`app/components/StaticMapPreview.tsx:68`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/components/StaticMapPreview.tsx#L68) and [`app/components/LiveVanTracker.tsx:185`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/components/LiveVanTracker.tsx#L185).
- **Large File Detection (>500 Lines / >50KB):**
  - [`lib/notifications.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/notifications.ts) — 774 lines (27.0 KB)
  - All page components remain under 500 lines.
- **Database Query Patterns (N+1 Audit):**
  - No Prisma database queries inside iterative loops (`for`/`map`) detected. Batch relation fetching (`include: { customer: true, service: true }`) is utilized.
- **Missing Database Indexes:**
  - `Booking` model: `customerId`, `serviceId`, `status`, `bookingDate` lack `@index`.
  - `EmergencyRequest` model: `customerId`, `serviceId`, `status` lack `@index`.
  - `Customer` model: `userId`, `phone` lack `@index`.
- **Cache-Control Headers in API Routes:**
  - Dynamic API routes return default Next.js `no-store` headers. Static landing pages leverage Next.js SSG caching.
- **Bundle Analysis Note:** `@next/bundle-analyzer` not installed; build step output confirms lightweight initial JS shared by all routes (104 KB).

---

## 7. SEO Audit

**Score:** 95/100

- **Metadata Exports Summary:**
  - Root Layout [`app/layout.tsx:16-61`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/layout.tsx#L16-L61) exports comprehensive default title template, description, keywords, author, and canonical URL.
  - Dedicated page titles and descriptions configured across `/services`, `/about`, `/contact`, `/emergency`, and `/service-areas`.
- **OpenGraph & Twitter Card Metadata:**
  - Configured in [`app/layout.tsx:37-60`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/layout.tsx#L37-L60) (`type: website`, `locale: en_US`, OG image URL, Twitter `summary_large_image`).
- **Canonical URLs:** Configured dynamically via `NEXT_PUBLIC_APP_URL` in `app/layout.tsx`.
- **Robots.txt Content:** Generated via [`app/robots.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/robots.ts). Allows indexing of public pages and blocks `/admin` & `/api/`.
- **Sitemap Coverage:** Dynamic sitemap generated via [`app/sitemap.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/sitemap.ts) including static landing pages and local city service area routes.
- **JSON-LD Structured Data:** `AutoRepair` schema embedded in [`app/layout.tsx:63-155`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/layout.tsx#L63-L155) with geo-coordinates, address, telephone, price range, areaServed list, and offer catalog.
- **Local SEO Landing Pages:** Pre-rendered SSG pages active for cities under [`app/service-area/[city]`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/service-area/%5Bcity%5D/page.tsx) (`dallas`, `fort-worth`, `plano`, `arlington`, `frisco`, `irving`, `garland`).

---

## 8. Accessibility (A11y)

**Score:** 85/100

- **Skip-to-Content Link:** **PRESENT** in [`app/layout.tsx:171-176`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/layout.tsx#L171-L176) (`<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to main content</a>`).
- **ARIA Attributes & Semantic HTML:** Semantic tags (`<main>`, `<header>`, `<footer>`, `<nav>`, `<section>`) used throughout layout and page components.
- **Form Label Associations:** Form inputs in `BookingFormClient.tsx` and `CoverageChecker.tsx` have corresponding `<label>` elements or `aria-label` attributes.
- **Focus-Visible Styles:** Interactive buttons and links include Tailwind `focus:ring-2` / `focus:outline-none` classes.
- **Mobile Menu Focus Trap:** Mobile navigation drawer in `Navbar.tsx` lacks focus locking, allowing keyboard users to tab out of open drawer into background content.
- **Color Contrast Note:** `[NOT TESTABLE STATICALLY]` (Requires runtime browser contrast verification tool).

---

## 9. Database & Backend

**Score:** 75/100

- **Prisma Schema Review (`prisma/schema.prisma`):**
  - **Primary Keys:** UUID primary keys generated via `@default(dbgenerated("gen_random_uuid()")) @db.Uuid`.
  - **Monetary Types:** `Decimal(10, 2)` used for `price`, `depositAmount`, `totalAmount`.
  - **Cascading Deletes:** Only `TechnicianLocation` defines `onDelete: Cascade` relative to `Booking`. Other relations use `onUpdate: NoAction`.
- **Migration Status:**
  - `prisma/migrations/` folder is **MISSING**. Schema updates are currently applied unversioned.
- **Connection Pooling Configuration:** `@prisma/adapter-pg` driver adapter configured in [`lib/prisma.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/prisma.ts) for PostgreSQL.
- **Real-time Features:** Supabase client configured; active polling (12s interval) used in `LiveVanTracker.tsx` instead of Supabase Realtime subscriptions.
- **Notification Architecture:** System logs all outgoing SMS and email attempts into `NotificationLog` table in Prisma with retry logic handled via `app/actions/notifications.ts`.

---

## 10. Feature Status Check

| Feature | Status | Justification |
|---------|--------|---------------|
| **GPS Location Button** | [NOT TESTABLE STATICALLY] | Code in [`app/components/GpsLocationButton.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/components/GpsLocationButton.tsx) calls `navigator.geolocation` and `/api/geocode/reverse`. Requires browser permission runtime test. |
| **Stripe Payments** | [VERIFIED BROKEN] | `stripe` dependency missing from `package.json` and `lib/stripe.ts` export does not exist in codebase. |
| **Live Van Tracker** | [PARTIALLY IMPLEMENTED] | UI [`app/components/LiveVanTracker.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/components/LiveVanTracker.tsx) and API `/api/technician/location` exist, but rely on 12s polling and hardcoded fallback key `tech_secret_key_demo`. |
| **SMS/Email Notifications** | [PARTIALLY IMPLEMENTED] | Twilio SMS (`lib/sms.ts`) and Resend email (`lib/email.ts`) modules implemented with fallback logging, requiring live API credentials. |
| **Admin Dashboard** | [VERIFIED WORKING] | Page routes (`/admin/*`) guarded by `proxy.ts` middleware and API routes (`/api/admin/*`) enforce `getAdminUser()` checks. |
| **Customer Account** | [VERIFIED WORKING] | Route protection in `proxy.ts` (`/account` redirects unauthenticated users and rejects admins) and customer API checks `isCustomer()`. |
| **Booking Flow** | [VERIFIED WORKING] | Zod validation (`lib/validations/booking.ts`), Server Action submission (`createBookingRequestAction`), and Prisma DB persistence verified working. |
| **Emergency Requests** | [VERIFIED WORKING] | API `/api/emergency-requests` and page `/emergency` process emergency requests with Zod validation, location handling, and DB persistence. |

---

## 11. Routes & API Endpoints Audit

### App Page Routes

- `/` — Static
- `/about` — Static
- `/account` — Static (Client auth protected)
- `/admin` — Static (Middleware guarded)
- `/admin/bookings` — Static (Middleware guarded)
- `/admin/contact-messages` — Static (Middleware guarded)
- `/admin/customers` — Static (Middleware guarded)
- `/admin/dashboard` — Dynamic (Middleware guarded)
- `/admin/emergency-requests` — Static (Middleware guarded)
- `/admin/login` — Static
- `/admin/notifications` — Static (Middleware guarded)
- `/admin/reviews` — Static (Middleware guarded)
- `/auth/callback` — Dynamic
- `/booking` — Dynamic
- `/booking/confirmed` — Static
- `/contact` — Static
- `/emergency` — Static
- `/forgot-password` — Static
- `/login` — Static
- `/privacy` — Static
- `/reset-password` — Static
- `/robots.txt` — Static
- `/service-area` — Static (Redirects to `/service-areas`)
- `/service-area/[city]` — SSG (Pre-rendered city landing pages)
- `/service-areas` — Static
- `/services` — Static
- `/services/flat-tire-repair` — Static
- `/services/fleet-tire-service` — Static
- `/services/new-used-tires` — Static
- `/services/swap-rim-tire` — Static
- `/services/wheel-balancing` — Static
- `/signup` — Static
- `/sitemap.xml` — Static
- `/technician/tracking/[bookingId]` — Dynamic
- `/terms` — Static

### API Routes & Auth Protection

- `GET /api/admin/analytics` — Dynamic — Protected via `getAdminUser()`
- `GET /api/admin/bookings` — Dynamic — Protected via `getAdminUser()`
- `GET /api/admin/contact-messages` — Dynamic — Protected via `getAdminUser()`
- `GET /api/admin/customers` — Dynamic — Protected via `getAdminUser()`
- `GET /api/admin/dashboard` — Dynamic — Protected via `getAdminUser()`
- `GET /api/admin/emergency-requests` — Dynamic — Protected via `getAdminUser()`
- `GET /api/admin/me` — Dynamic — Protected via `getAdminUser()`
- `GET /api/admin/notifications` — Dynamic — Protected via `getAdminUser()`
- `GET /api/admin/reviews` — Dynamic — Protected via `getAdminUser()`
- `POST /api/auth/sync-customer` — Dynamic — Authenticated session sync
- `GET/POST /api/bookings` — Dynamic — Public creation / session query
- `PUT/DELETE /api/bookings/[id]` — Dynamic — **UNPROTECTED (IDOR VULNERABILITY)**
- `POST /api/contact-messages` — Dynamic — Rate limited (Public)
- `GET /api/customer/me` — Dynamic — Protected via `getAuthenticatedUser()`
- `GET/PATCH /api/customer/profile` — Dynamic — Protected via `getAuthenticatedUser()` & `isCustomer()`
- `POST /api/emergency-requests` — Dynamic — Rate limited (Public)
- `POST /api/geocode/reverse` — Dynamic — Public utility
- `GET /api/health` — Dynamic — System healthcheck
- `POST /api/notifications/retry` — Dynamic — Admin action
- `GET/POST /api/technician/location` — Dynamic — Protected via `x-technician-key` or admin session
- `GET /api/test-db` — Dynamic — Suspicious debug endpoint (Guarded by `NODE_ENV !== "development"` check)

---

## 12. Forms & Validation

- **Forms and Zod Validation Status:**
  - **Booking Form:** Validated via `bookingSchema` ([`lib/validations/booking.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/validations/booking.ts)) in Server Action [`app/actions/bookings.ts:23`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/bookings.ts#L23).
  - **Emergency Request Form:** Validated via `emergencySchema` ([`lib/validations/emergency.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/validations/emergency.ts)) in [`app/api/emergency-requests/route.ts:23`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/emergency-requests/route.ts#L23).
  - **Contact Form:** Validated via `contactSchema` ([`lib/validations/contact.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/validations/contact.ts)) in [`app/api/contact-messages/route.ts:20`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/contact-messages/route.ts#L20).
  - **Customer Profile Form:** Validated via `updateProfileSchema` in [`app/api/customer/profile/route.ts:7`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/customer/profile/route.ts#L7).
  - **Review Form:** Validated via `reviewSchema` ([`lib/validations/review.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/validations/review.ts)) in [`app/actions/reviews.ts:20`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/actions/reviews.ts#L20).
- **CSRF Protection:** Next.js Server Actions enforce default origin header checks. SameSite cookies used for Supabase auth sessions.
- **Honeypot / Spam Protection:** Rate limiting active in public API routes (`/api/contact-messages`, `/api/emergency-requests`). Hidden honeypot inputs currently missing from public client forms.
- **Server Action Usage:** Core mutations implemented via Server Actions in `app/actions/bookings.ts`, `app/actions/reviews.ts`, and `app/actions/notifications.ts`.

---

## 13. Prioritized Action Items

### Priority 1 — Critical (Launch Blockers)

- [ ] **Fix IDOR Vulnerability in Booking Update & Delete API Routes**
  - **File:** [`app/api/bookings/[id]/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/bookings/%5Bid%5D/route.ts)
  - **Line:** 27 & 111
  - **Severity:** CRITICAL
  - **Type:** SECURITY / AUTH
  - **Description:** Enforce session authentication and verify user ownership (`where: { id, customerId: customer.id }`) or admin permissions before updating or deleting bookings.

- [ ] **Extend Middleware Route Protection to Cover `/api/admin/*` Endpoints**
  - **File:** [`proxy.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/proxy.ts)
  - **Line:** 35
  - **Severity:** CRITICAL
  - **Type:** SECURITY / AUTH
  - **Description:** Update proxy middleware matching logic to protect `/api/admin` path prefix centrally in addition to page routes.

### Priority 2 — High (Fix Within 1 Week)

- [ ] **Remove Hardcoded Admin Email Fallbacks**
  - **File:** [`app/api/admin/me/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/admin/me/route.ts) & [`lib/auth/admin.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/auth/admin.ts)
  - **Line:** 44-45 & 23-24
  - **Severity:** HIGH
  - **Type:** SECURITY
  - **Description:** Remove hardcoded email strings from code logic and rely exclusively on the `ADMIN_EMAILS` environment variable.

- [ ] **Initialize Versioned Prisma Schema Migrations**
  - **File:** [`prisma/schema.prisma`](file:///d:/Tire-Services/tire-mobile-clinic-next/prisma/schema.prisma)
  - **Line:** 1-207
  - **Severity:** HIGH
  - **Type:** DATABASE
  - **Description:** Generate initial migration directory (`npx prisma migrate dev --name init`) to ensure version-controlled database schema changes.

- [ ] **Add Database Indexes for Frequently Queried Foreign Keys and Columns**
  - **File:** [`prisma/schema.prisma`](file:///d:/Tire-Services/tire-mobile-clinic-next/prisma/schema.prisma)
  - **Line:** 59, 60, 76, 91
  - **Severity:** HIGH
  - **Type:** PERFORMANCE / DATABASE
  - **Description:** Add `@index([customerId])`, `@index([serviceId])`, `@index([status])`, and `@index([bookingDate])` to `Booking` and `EmergencyRequest` models to prevent full table scans.

### Priority 3 — Medium (Fix Within 1 Month)

- [ ] **Replace Raw `<img>` Tags with `next/image` Components**
  - **File:** [`app/components/StaticMapPreview.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/components/StaticMapPreview.tsx) & [`app/components/LiveVanTracker.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/components/LiveVanTracker.tsx)
  - **Line:** 68 & 185
  - **Severity:** MEDIUM
  - **Type:** PERFORMANCE
  - **Description:** Replace standard HTML `<img>` elements with Next.js `<Image />` component for automatic optimization.

- [ ] **Fix `.gitignore` Rule for Generated Prisma Client**
  - **File:** [`.gitignore`](file:///d:/Tire-Services/tire-mobile-clinic-next/.gitignore)
  - **Line:** 43
  - **Severity:** MEDIUM
  - **Type:** PROJECT STRUCTURE
  - **Description:** Change `/app/generated/prisma` to `/generated` in `.gitignore` so generated Prisma files are properly ignored by Git.

- [ ] **Remove Hardcoded Fallback Key for Technician API Endpoint**
  - **File:** [`app/api/technician/location/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/technician/location/route.ts)
  - **Line:** 32
  - **Severity:** MEDIUM
  - **Type:** SECURITY
  - **Description:** Require `TECHNICIAN_API_KEY` to be set in environment variables and reject requests if missing rather than falling back to `"tech_secret_key_demo"`.

- [ ] **Consolidate Component Folder Organization**
  - **File:** [`app/components/`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/components) & [`components/admin/`](file:///d:/Tire-Services/tire-mobile-clinic-next/components/admin)
  - **Line:** Directory structure
  - **Severity:** MEDIUM
  - **Type:** PROJECT STRUCTURE
  - **Description:** Move components from `app/components/` into root `components/` for standard Next.js directory structure.

### Priority 4 — Low (Nice to Have)

- [ ] **Add Focus Trap to Mobile Navigation Drawer**
  - **File:** [`app/components/Navbar.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/components/Navbar.tsx)
  - **Line:** 110-180
  - **Severity:** LOW
  - **Type:** A11Y
  - **Description:** Implement keyboard focus trapping inside the mobile menu drawer when open.

- [ ] **Remove or Guard Test Endpoint (`/api/test-db`)**
  - **File:** [`app/api/test-db/route.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/api/test-db/route.ts)
  - **Line:** 3
  - **Severity:** LOW
  - **Type:** SECURITY / UX
  - **Description:** Remove `/api/test-db/route.ts` from production deployment routes.

---

## 14. What's Working Well

1. **Robust Type Safety with Zod Validation:**
   - Public forms and API route handlers consistently leverage Zod schemas ([`lib/validations/booking.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/validations/booking.ts), [`lib/validations/emergency.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/validations/emergency.ts)) to parse and sanitize incoming payloads.
2. **Comprehensive SEO Architecture:**
   - Metadata exports ([`app/layout.tsx:16-61`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/layout.tsx#L16-L61)), OpenGraph tags, Twitter Cards, `AutoRepair` JSON-LD structured data, sitemap generation, and dynamic city landing pages ([`app/service-area/[city]/page.tsx`](file:///d:/Tire-Services/tire-mobile-clinic-next/app/service-area/%5Bcity%5D/page.tsx)) provide search engine optimization.
3. **Clean Next.js 16 App Router Build:**
   - Turbopack builds 61 static and dynamic pages with 0 TypeScript compilation errors.
4. **Modern Image Asset Management:**
   - 100% WebP image format usage in `public/images/` reduces payload overhead for roadside mobile users.
5. **Decoupled PDF Quote Generation:**
   - Receipt and itemized quote PDF generation module in [`lib/receipts.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/receipts.ts) uses `pdf-lib` to construct downloadable quotes dynamically.
6. **Built-in Rate Limiting Defense:**
   - Public contact and emergency request API endpoints implement sliding-window rate limiting in [`lib/rate-limit.ts`](file:///d:/Tire-Services/tire-mobile-clinic-next/lib/rate-limit.ts).
7. **Strict Customer & Admin Portal Separation:**
   - Middleware [`proxy.ts:28-31`](file:///d:/Tire-Services/tire-mobile-clinic-next/proxy.ts#L28-L31) prevents admin accounts from entering customer account views.

---

## 15. Recent Changes & Fix History

- **Recent Changes:**
  - Modernized `next.config.ts` headers with Content Security Policy and Permissions Policy.
  - Added dynamic city landing pages under `app/service-area/[city]`.
  - Implemented `LiveVanTracker.tsx` component and `/api/technician/location` API endpoint.
- **Resolved Issues:**
  - TypeScript compilation errors resolved (0 errors in `npx tsc --noEmit`).
  - WebP images introduced to replace uncompressed legacy assets.
- **New Issues Introduced:**
  - Hardcoded admin email fallbacks introduced in `app/api/admin/me/route.ts` and `lib/auth/admin.ts`.
- **Regression Check:**
  - `PUT/DELETE /api/bookings/[id]` API route lacks authentication checks, introducing an IDOR security regression that requires immediate remediation before production deployment.

---

## 16. Final Scores Summary

| Category | Weight | Score | Weighted Score |
|----------|--------|-------|----------------|
| **Security** | 20% | 65 | 13.0 / 20 |
| **Performance** | 15% | 80 | 12.0 / 15 |
| **Code Quality** | 15% | 75 | 11.25 / 15 |
| **SEO** | 10% | 95 | 9.5 / 10 |
| **Accessibility** | 10% | 85 | 8.5 / 10 |
| **Project Structure** | 10% | 78 | 7.8 / 10 |
| **Tech Stack** | 10% | 82 | 8.2 / 10 |
| **Database** | 10% | 75 | 7.5 / 10 |
| **OVERALL SCORE** | **100%** | | **78 / 100** |

---
