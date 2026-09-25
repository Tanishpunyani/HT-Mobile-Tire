# PHASE 3D.2A — PRISMA SCRIPT RUNTIME COMPATIBILITY FIX
## Root Cause Diagnosis & Minimal Fix Report

**Project**: HT Mobile Services / HT Mobile Tyres  
**Codebase**: `tire-mobile-clinic-next`  
**Phase**: 3D.2A — Standalone Script Runtime Compatibility Fix  
**Mode**: READ-ONLY DIAGNOSIS → MINIMAL IMPLEMENTATION ONLY  
**Date**: September 22, 2026  

---

## 1. Root Cause

When executing the standalone diagnostic script via Node:
```bash
node --env-file=.env.local scripts/test-sms-gateway.mjs --seed
```
Node failed with:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'D:\Tire-Services\tire-mobile-clinic-next\generated\prisma\client' imported from D:\Tire-Services\tire-mobile-clinic-next\lib\prisma.ts
```

### Detailed Mechanical Breakdown:
1. **Module Resolution Divergence**:
   - In Next.js with Turbopack, the project's `tsconfig.json` specifies `"moduleResolution": "bundler"`. Modern bundlers automatically resolve extensionless relative imports (such as `import { PrismaClient } from "../generated/prisma/client"` in `lib/prisma.ts`) by discovering `client.ts`.
   - In native Node.js ESM execution (Node 24 running `scripts/test-sms-gateway.mjs`), relative import specifiers **strictly require an explicit file extension** (e.g. `client.ts` or `client.js`).
2. **Cross-Boundary Coupling**:
   - `scripts/test-sms-gateway.mjs` was importing `../lib/prisma.ts`.
   - This forced native Node ESM to parse the Next.js bundler-targeted `lib/prisma.ts` file and attempt extensionless relative resolution on `../generated/prisma/client`, which fails under Node's native module loader without a bundler or custom module loader.
3. **Established Project Convention in `scripts/`**:
   - All other existing utility scripts in `scripts/` (`scripts/set-admin.mjs`, `scripts/create-admin.mjs`, `scripts/seed-technicians.mjs`) **do not import `lib/prisma.ts`**.
   - Instead, they connect directly to PostgreSQL using `import pg from "pg"` and `process.env.DIRECT_URL || process.env.DATABASE_URL`.

---

## 2. Files Inspected

1. **`package.json`**:
   - Uses standard CommonJS root configuration; `"pg": "^8.13.1"` and `@prisma/client` are installed dependencies.
2. **`prisma.config.ts`**:
   - Configures `DIRECT_URL` and `prisma/migrations` path.
3. **`tsconfig.json`**:
   - `"moduleResolution": "bundler"` allows Next.js/Turbopack to resolve extensionless imports cleanly during web builds.
4. **`lib/prisma.ts`**:
   - Correctly configured for Next.js bundler runtime using `import { PrismaClient } from "../generated/prisma/client"`.
5. **`scripts/test-sms-gateway.mjs`**:
   - Previously had cross-boundary imports to `../lib/prisma.ts` and `../lib/sms/token-manager.ts`.
6. **`prisma/schema.prisma`**:
   - Generator block specifies `output = "../generated/prisma"`.
7. **Existing Scripts**:
   - `scripts/set-admin.mjs`, `scripts/create-admin.mjs`, `scripts/seed-technicians.mjs` all use direct `pg.Client` for standalone database operations.

---

## 3. Files Changed

Only **ONE** file was modified:
* **[`scripts/test-sms-gateway.mjs`](file:///d:/Tire-Services/tire-mobile-clinic-next/scripts/test-sms-gateway.mjs)**

Zero changes were made to:
- `lib/prisma.ts`
- `package.json`
- `tsconfig.json`
- `prisma/schema.prisma`
- `lib/sms/token-manager.ts`
- `lib/sms/providers/android-gateway.ts`

---

## 4. Exact Minimal Fix

In `scripts/test-sms-gateway.mjs`:
1. Replaced the cross-boundary `import { prisma } from "../lib/prisma.ts"` with the project's standard script database pattern:
   ```javascript
   import pg from "pg";
   const { Client } = pg;
   ```
2. Connected using the existing database connection string:
   ```javascript
   const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
   const client = new Client({ connectionString: directUrl });
   ```
3. Queried and updated the `sms_gateway_tokens` PostgreSQL table directly using parameterized SQL queries:
   - Check: `SELECT id, access_token, refresh_token, expires_at FROM sms_gateway_tokens WHERE id = 'active' LIMIT 1`
   - Seed: `INSERT INTO sms_gateway_tokens ... ON CONFLICT (id) DO UPDATE ...`
4. Completely decoupled standalone script execution from Next.js bundler module resolution.

---

## 5. Why the Fix Does Not Affect Next.js Runtime

- **No Shared Code Touched**: The Next.js web application imports `lib/sms/token-manager.ts` and `lib/prisma.ts`, neither of which were modified.
- **Identical Database Table**: Both Prisma (`prisma.smsGatewayToken`) and `scripts/test-sms-gateway.mjs` target the exact same PostgreSQL table (`sms_gateway_tokens`) and schema columns (`access_token`, `refresh_token`, `expires_at`).
- **No Global Configuration Changes**: `package.json`, `tsconfig.json`, and `next.config.ts` remain unchanged, preventing any build regressions.

---

## 6. Prisma Generation Result

Executed: `npx prisma generate`
```
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.

✔ Generated Prisma Client (7.9.1) to .\generated\prisma in 205ms
Exit Code: 0
```

---

## 7. TypeScript Verification Result

Executed: `npx tsc --noEmit`
```
Exit Code: 0
Errors: 0
```

---

## 8. Master Regression Test Result

Executed: `node tests/run-all.mjs`
```
--------------------------------------------------
Total Tests: 249 | Passed: 249 | Failed: 0
--------------------------------------------------
Exit Code: 0
```
All 249 automated tests (including 15 Phase 3D.2 TokenManager tests, Phase 3C customer SMS tests, Phase 3B admin SMS tests, webhooks, and retry reliability tests) passed with 100% success.

---

## 9. Production Build Result

Executed: `npm run build`
```
▲ Next.js 16.3.1 (Turbopack)
✓ Compiled successfully in 3.4s
  Running TypeScript ...
  Finished TypeScript in 3.7s ...
✓ Generating static pages using 7 workers (67/67) in 2.1s
Exit Code: 0
```
All 67 static and dynamic application routes compiled cleanly.

---

## 10. `--check-tokens` Execution Result

Executed: `node --env-file=.env.local scripts/test-sms-gateway.mjs --check-tokens`
```
=================================================
  HT MOBILE - SMS TOKEN REFRESH DIAGNOSTICS      
=================================================

[1/3] Reading database token record (sms_gateway_tokens)...
❌ No active token pair found in database (table: sms_gateway_tokens).

   To seed an initial token pair, set in .env.local:
     SMS_GATEWAY_SEED_ACCESS_TOKEN=<token>
     SMS_GATEWAY_SEED_REFRESH_TOKEN=<token>
   Then run:
     node --env-file=.env.local scripts/test-sms-gateway.mjs --seed
```
- **Exit Code**: `0`
- **Result**: Successfully connected to PostgreSQL, queried `sms_gateway_tokens`, and reported actionable diagnostics without any module resolution errors or crashes.

---

## 11. Secret-Safety Verification

- No access tokens, refresh tokens, passwords, authorization headers, or database credentials were printed to console, logs, or reports.
- All sensitive fields are masked with `[REDACTED_SECRET]` or `[REDACTED]`.

---

## 12. Confirmation of Invariance

- **Real SMS Sent**: **NO**. Zero real SMS messages were dispatched.
- **SMS Token-Refresh Architecture Modified**: **NO**. The production `TokenManager`, `AndroidGatewayProvider`, concurrency row-locking, and retry semantics remain 100% identical.

---

## 13. Final Status

### **PHASE 3D.2A STATUS: PASS**
