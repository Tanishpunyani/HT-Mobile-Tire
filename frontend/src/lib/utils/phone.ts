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
