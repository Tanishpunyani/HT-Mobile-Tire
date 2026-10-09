/**
 * Pure client/server compatible auth helper utilities.
 * Does NOT import Node.js or Prisma server dependencies.
 *
 * Security Rule: Admin privileges NEVER come from Supabase customer sessions,
 * JWTs, customer emails, or user metadata.
 */

export type BaseUser = {
  email?: string | null;
  app_metadata?: Record<string, any> | null;
  user_metadata?: Record<string, any> | null;
  role?: string | null;
};

/**
 * Checks whether a user is a valid Supabase customer.
 * All Supabase authenticated accounts are strictly customer accounts.
 */
export function isCustomer(user: BaseUser | null | undefined): boolean {
  if (!user) return false;
  return true;
}

/**
 * Supabase users never have admin privileges.
 * Admin privileges require a separate server-side AdminSession token.
 */
export function isAdmin(user: BaseUser | null | undefined): boolean {
  return false;
}

/**
 * Sanitizes redirect destinations to prevent Open Redirect vulnerabilities.
 * Strictly permits only relative, internal application paths starting with a single "/".
 * Rejects protocol-relative URLs ("//"), backslashes, explicit schemes, and malformed encoding.
 */
export function sanitizeRedirectTarget(target: unknown, fallback = "/account"): string {
  if (typeof target !== "string") return fallback;
  const trimmed = target.trim();
  if (!trimmed) return fallback;

  // Must start with a single "/" and NOT start with "//" (protocol-relative URL)
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  // Must not contain backslashes that could trick browser URL resolution
  if (trimmed.includes("\\")) {
    return fallback;
  }

  // Must not contain a protocol scheme (e.g. javascript:, http:, https:, data:)
  try {
    const decoded = decodeURIComponent(trimmed);
    if (
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(decoded.replace(/^\/+/, ""))
    ) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return trimmed;
}
