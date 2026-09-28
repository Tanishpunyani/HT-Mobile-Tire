/**
 * Provider-neutral Phone Number Normalization Utility
 * HT Mobile Services / Tire Mobile Clinic
 *
 * Cleans formatting characters while preserving international E.164 conventions.
 * Does not assume any single country code (avoids hardcoding US +1 or India +91).
 */

export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone || typeof phone !== "string") return "";

  const trimmed = phone.trim();
  if (!trimmed) return "";

  // Remove whitespace, hyphens, parentheses, and dots
  const cleaned = trimmed.replace(/[\s\-().]/g, "");

  // If already starts with +, keep leading + and strip any non-digit remaining characters
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  // Strip all non-digit characters
  const digits = cleaned.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

/**
 * Standard alias for backward compatibility across existing services.
 */
export const normalizePhoneToE164 = normalizePhoneNumber;

/**
 * Generates deterministic lookup candidates for a given phone number.
 * Used for database matching across international E.164, raw digits,
 * national formats, and common domestic punctuation styles.
 *
 * Supports at least:
 * - India (+91)
 * - United States / Canada (+1)
 * - United Kingdom (+44)
 * - Australia (+61)
 *
 * Strictly avoids fuzzy or wildcard queries that could cross-match different customer records.
 */
export function getPhoneCandidates(phone: string | null | undefined): string[] {
  if (!phone || typeof phone !== "string") return [];

  const trimmed = phone.trim();
  if (!trimmed) return [];

  const candidates = new Set<string>();

  // 1. Always include trimmed raw input
  candidates.add(trimmed);

  // 2. Extract digits only and E.164 normalized
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return Array.from(candidates);

  candidates.add(digits);
  const normalized = normalizePhoneNumber(phone);
  if (normalized) {
    candidates.add(normalized);
  }

  // 3. International Country Handling
  // US / Canada (+1)
  if (digits.length === 11 && digits.startsWith("1")) {
    const nat = digits.slice(1); // 10 digits
    candidates.add(nat);
    candidates.add(`(${nat.slice(0, 3)}) ${nat.slice(3, 6)}-${nat.slice(6)}`);
    candidates.add(`${nat.slice(0, 3)}-${nat.slice(3, 6)}-${nat.slice(6)}`);
    candidates.add(`${nat.slice(0, 3)} ${nat.slice(3, 6)} ${nat.slice(6)}`);
    candidates.add(`${nat.slice(0, 3)}.${nat.slice(3, 6)}.${nat.slice(6)}`);
    candidates.add(`+1 ${nat.slice(0, 3)}-${nat.slice(3, 6)}-${nat.slice(6)}`);
    candidates.add(`+1 (${nat.slice(0, 3)}) ${nat.slice(3, 6)}-${nat.slice(6)}`);
    candidates.add(`+1 ${nat.slice(0, 3)} ${nat.slice(3, 6)} ${nat.slice(6)}`);
  } else if (digits.length === 10 && !trimmed.startsWith("+")) {
    // 10 digits without country code (common in US domestic forms or India 10-digit mobile)
    candidates.add(`+1${digits}`);
    candidates.add(`1${digits}`);
    candidates.add(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);
    candidates.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
    candidates.add(`${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`);
    candidates.add(`${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`);
    // Also include India 10-digit format
    candidates.add(`+91${digits}`);
    candidates.add(`91${digits}`);
    candidates.add(`0${digits}`);
    candidates.add(`${digits.slice(0, 5)} ${digits.slice(5)}`);
    candidates.add(`${digits.slice(0, 5)}-${digits.slice(5)}`);
  }

  // India (+91)
  if (digits.length === 12 && digits.startsWith("91")) {
    const nat = digits.slice(2); // 10 digits
    candidates.add(nat);
    candidates.add(`0${nat}`);
    candidates.add(`${nat.slice(0, 5)} ${nat.slice(5)}`);
    candidates.add(`${nat.slice(0, 5)}-${nat.slice(5)}`);
    candidates.add(`+91 ${nat.slice(0, 5)} ${nat.slice(5)}`);
    candidates.add(`+91-${nat.slice(0, 5)}-${nat.slice(5)}`);
    candidates.add(`+91 ${nat}`);
    candidates.add(`+91-${nat}`);
  }

  // United Kingdom (+44)
  if (digits.startsWith("44") && digits.length >= 11 && digits.length <= 13) {
    const nat = digits.slice(2);
    candidates.add(nat);
    candidates.add(`0${nat}`);
    if (nat.length === 10) {
      candidates.add(`0${nat.slice(0, 4)} ${nat.slice(4)}`);
      candidates.add(`0${nat.slice(0, 4)}-${nat.slice(4)}`);
      candidates.add(`+44 ${nat.slice(0, 4)} ${nat.slice(4)}`);
      candidates.add(`+44 (0)${nat.slice(0, 4)} ${nat.slice(4)}`);
      candidates.add(`+44 ${nat}`);
    }
  }

  // Australia (+61)
  if (digits.startsWith("61") && digits.length >= 10 && digits.length <= 12) {
    const nat = digits.slice(2);
    candidates.add(nat);
    candidates.add(`0${nat}`);
    if (nat.length === 9) {
      candidates.add(`0${nat.slice(0, 3)} ${nat.slice(3, 6)} ${nat.slice(6)}`);
      candidates.add(`0${nat.slice(0, 3)}-${nat.slice(3, 6)}-${nat.slice(6)}`);
      candidates.add(`+61 ${nat.slice(0, 3)} ${nat.slice(3, 6)} ${nat.slice(6)}`);
      candidates.add(`+61 (0)${nat.slice(0, 3)} ${nat.slice(3, 6)} ${nat.slice(6)}`);
      candidates.add(`+61 ${nat}`);
    }
  }

  return Array.from(candidates).filter(Boolean);
}
