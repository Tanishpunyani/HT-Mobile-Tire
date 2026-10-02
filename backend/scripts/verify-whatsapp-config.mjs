#!/usr/bin/env node

/**
 * HT Mobile Tyres — WhatsApp Production Configuration Checker
 *
 * SAFE, READ-ONLY configuration validator.
 *
 * Guarantees:
 * - NEVER sends WhatsApp messages
 * - NEVER calls Meta Graph API
 * - NEVER modifies database records or files
 * - NEVER modifies process.env or environment variables
 * - NEVER logs or exposes sensitive tokens, secrets, or keys
 *
 * Inspects process.env only.
 */

// ANSI Color Helpers
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const GRAY = "\x1b[90m";

function checkPresence(val) {
  if (val === undefined || val === null) return "MISSING";
  if (typeof val === "string" && val.trim() === "") return "EMPTY";
  return "PRESENT";
}

function validateUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string" || rawUrl.trim() === "") {
    return { valid: false, reason: "Missing or empty" };
  }
  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, reason: `Unsupported protocol: ${parsed.protocol}` };
    }
    return { valid: true, protocol: parsed.protocol, host: parsed.host };
  } catch (err) {
    return { valid: false, reason: `Invalid URL format (${err.message})` };
  }
}

console.log(`${BOLD}${CYAN}======================================================================${RESET}`);
console.log(`${BOLD}${CYAN}   HT MOBILE TYRES — WHATSAPP PRODUCTION CONFIGURATION CHECKER       ${RESET}`);
console.log(`${BOLD}${CYAN}======================================================================${RESET}`);
console.log(`${GRAY}Mode: Read-only inspection of process.env (No external network calls)${RESET}\n`);

const issues = [];
const warnings = [];

// 1. WHATSAPP_ACCESS_TOKEN (Secret, Server-only, Required)
const accessTokenState = checkPresence(process.env.WHATSAPP_ACCESS_TOKEN);
if (accessTokenState === "PRESENT") {
  console.log(`  [OK] ${BOLD}WHATSAPP_ACCESS_TOKEN${RESET}: ${GREEN}PRESENT${RESET} ${GRAY}(Secret masked)${RESET}`);
} else {
  console.log(`  [FAIL] ${BOLD}WHATSAPP_ACCESS_TOKEN${RESET}: ${RED}${accessTokenState}${RESET} ${GRAY}(Required: Meta System User access token)${RESET}`);
  issues.push("WHATSAPP_ACCESS_TOKEN is required for WhatsApp API communications.");
}

// 2. WHATSAPP_PHONE_NUMBER_ID (Identifier, Server-only, Required)
const phoneIdState = checkPresence(process.env.WHATSAPP_PHONE_NUMBER_ID);
if (phoneIdState === "PRESENT") {
  console.log(`  [OK] ${BOLD}WHATSAPP_PHONE_NUMBER_ID${RESET}: ${GREEN}PRESENT${RESET} ${GRAY}(Meta phone number identifier)${RESET}`);
} else {
  console.log(`  [FAIL] ${BOLD}WHATSAPP_PHONE_NUMBER_ID${RESET}: ${RED}${phoneIdState}${RESET} ${GRAY}(Required: WhatsApp Phone Number ID)${RESET}`);
  issues.push("WHATSAPP_PHONE_NUMBER_ID is required to identify the sending phone number.");
}

// 3. WHATSAPP_BUSINESS_ACCOUNT_ID (Identifier, Server-only, Required)
const wabaIdState = checkPresence(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID);
if (wabaIdState === "PRESENT") {
  console.log(`  [OK] ${BOLD}WHATSAPP_BUSINESS_ACCOUNT_ID${RESET}: ${GREEN}PRESENT${RESET} ${GRAY}(WABA ID)${RESET}`);
} else {
  console.log(`  [FAIL] ${BOLD}WHATSAPP_BUSINESS_ACCOUNT_ID${RESET}: ${RED}${wabaIdState}${RESET} ${GRAY}(Required: WhatsApp Business Account ID)${RESET}`);
  issues.push("WHATSAPP_BUSINESS_ACCOUNT_ID is required for Meta Business ownership.");
}

// 4. WHATSAPP_VERIFY_TOKEN (Secret, Server-only, Required)
const verifyTokenState = checkPresence(process.env.WHATSAPP_VERIFY_TOKEN);
if (verifyTokenState === "PRESENT") {
  console.log(`  [OK] ${BOLD}WHATSAPP_VERIFY_TOKEN${RESET}: ${GREEN}PRESENT${RESET} ${GRAY}(Secret masked)${RESET}`);
} else {
  console.log(`  [FAIL] ${BOLD}WHATSAPP_VERIFY_TOKEN${RESET}: ${RED}${verifyTokenState}${RESET} ${GRAY}(Required: Webhook verification challenge token)${RESET}`);
  issues.push("WHATSAPP_VERIFY_TOKEN is required to complete Meta webhook verification.");
}

// 5. WHATSAPP_APP_SECRET (Secret, Server-only, Required)
const appSecretState = checkPresence(process.env.WHATSAPP_APP_SECRET);
if (appSecretState === "PRESENT") {
  console.log(`  [OK] ${BOLD}WHATSAPP_APP_SECRET${RESET}: ${GREEN}PRESENT${RESET} ${GRAY}(Secret masked)${RESET}`);
} else {
  console.log(`  [FAIL] ${BOLD}WHATSAPP_APP_SECRET${RESET}: ${RED}${appSecretState}${RESET} ${GRAY}(Required: Webhook HMAC-SHA256 signature verification)${RESET}`);
  issues.push("WHATSAPP_APP_SECRET is required to verify Meta webhook signatures.");
}

// 6. WHATSAPP_ENABLED (Flag, Server-only, Optional)
const enabledRaw = process.env.WHATSAPP_ENABLED;
const isLive = enabledRaw === "true";
if (isLive) {
  console.log(`  [OK] ${BOLD}WHATSAPP_ENABLED${RESET}: ${GREEN}true${RESET} ${YELLOW}[LIVE MODE ACTIVE — Outbound messages will be sent to Meta]${RESET}`);
} else {
  console.log(`  [INFO] ${BOLD}WHATSAPP_ENABLED${RESET}: ${YELLOW}${enabledRaw || "not set (default: false)"}${RESET} ${GRAY}[SIMULATION MODE — Messages will be safely simulated]${RESET}`);
  warnings.push("WHATSAPP_ENABLED is not 'true'. Outbound messages will operate in simulated mode.");
}

// 7. WHATSAPP_API_VERSION (Config, Server-only, Optional)
const apiVersion = process.env.WHATSAPP_API_VERSION || "v20.0";
const isCustomVersion = Boolean(process.env.WHATSAPP_API_VERSION);
console.log(`  [OK] ${BOLD}WHATSAPP_API_VERSION${RESET}: ${GREEN}${apiVersion}${RESET} ${GRAY}${isCustomVersion ? "(custom)" : "(default)"}${RESET}`);

// 8. NEXT_PUBLIC_APP_URL (URL, Public-safe, Required)
const appUrlRaw = process.env.NEXT_PUBLIC_APP_URL;
const appUrlValidation = validateUrl(appUrlRaw);
if (appUrlValidation.valid) {
  const isHttps = appUrlValidation.protocol === "https:";
  console.log(`  [OK] ${BOLD}NEXT_PUBLIC_APP_URL${RESET}: ${GREEN}${appUrlValidation.protocol}//${appUrlValidation.host}${RESET}`);
  if (!isHttps) {
    warnings.push("NEXT_PUBLIC_APP_URL does not use HTTPS protocol. Production deployments require HTTPS.");
  }
} else {
  console.log(`  [FAIL] ${BOLD}NEXT_PUBLIC_APP_URL${RESET}: ${RED}${appUrlValidation.reason}${RESET}`);
  issues.push("NEXT_PUBLIC_APP_URL must be a valid URL (required for live tracking and receipt links).");
}

// 9. NEXT_PUBLIC_BUSINESS_PHONE (Phone, Public-safe, Optional with code fallback)
const businessPhoneRaw = process.env.NEXT_PUBLIC_BUSINESS_PHONE;
if (businessPhoneRaw && businessPhoneRaw.trim() !== "") {
  console.log(`  [OK] ${BOLD}NEXT_PUBLIC_BUSINESS_PHONE${RESET}: ${GREEN}${businessPhoneRaw.trim()}${RESET}`);
} else {
  console.log(`  [INFO] ${BOLD}NEXT_PUBLIC_BUSINESS_PHONE${RESET}: ${GRAY}not set (default fallback: +18005558473)${RESET}`);
}

// 10. NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY (Display text, Public-safe, Optional with code fallback)
const businessPhoneDisplayRaw = process.env.NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY;
if (businessPhoneDisplayRaw && businessPhoneDisplayRaw.trim() !== "") {
  console.log(`  [OK] ${BOLD}NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY${RESET}: ${GREEN}${businessPhoneDisplayRaw.trim()}${RESET}`);
} else {
  console.log(`  [INFO] ${BOLD}NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY${RESET}: ${GRAY}not set (default fallback: (800) 555-TIRE (8473))${RESET}`);
}

console.log(`\n${BOLD}======================================================================${RESET}`);
console.log(`${BOLD}   SUMMARY                                                           ${RESET}`);
console.log(`${BOLD}======================================================================${RESET}`);

if (issues.length === 0) {
  console.log(`${GREEN}${BOLD}✓ ALL REQUIRED PRODUCTION CONFIGURATION ITEMS ARE SATISFIED.${RESET}`);
  if (warnings.length > 0) {
    console.log(`\n${YELLOW}${BOLD}Operational Notices:${RESET}`);
    for (const w of warnings) {
      console.log(`  • ${YELLOW}${w}${RESET}`);
    }
  }
  console.log(`\n${GRAY}Environment is ready for WhatsApp production operations.${RESET}`);
  process.exit(0);
} else {
  console.log(`${RED}${BOLD}✗ CONFIGURATION INCOMPLETE: ${issues.length} required variable(s) missing or invalid:${RESET}\n`);
  for (const issue of issues) {
    console.log(`  • ${RED}${issue}${RESET}`);
  }
  if (warnings.length > 0) {
    console.log(`\n${YELLOW}${BOLD}Operational Notices:${RESET}`);
    for (const w of warnings) {
      console.log(`  • ${YELLOW}${w}${RESET}`);
    }
  }
  console.log(`\n${GRAY}Tip: If verifying a local file, run with: node --env-file=frontend/.env.local backend/scripts/verify-whatsapp-config.mjs${RESET}\n`);
  process.exit(1);
}
