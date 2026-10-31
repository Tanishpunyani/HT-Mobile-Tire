/**
 * Canonical Application URL Utility for HT Mobile Tire.
 *
 * Resolves, validates, and normalizes the public-facing canonical application URL.
 * Standardizes on the official production canonical WWW host (https://www.htmobiletire.com).
 * Production apex requests (https://htmobiletire.com) are redirected to www via HTTP 308 on Vercel.
 */

export const DEFAULT_PRODUCTION_URL = "https://ht-mobile-tire.vercel.app";

/**
 * Official canonical WWW domain for HT Mobile Tire SEO, sitemaps, Open Graph, and metadata.
 */
export const CANONICAL_SITE_URL = "https://www.htmobiletire.com";

/**
 * Resolves the confirmed public canonical site URL for SEO.
 */
export function getCanonicalSiteUrl(): string {
  return CANONICAL_SITE_URL;
}

/**
 * Normalizes apex business-domain references (htmobiletire.com) to the official canonical WWW host.
 * Unrelated domains (e.g. preview branches or custom hostnames) are preserved intact.
 */
function resolveBusinessDomain(normalizedUrl: string): string {
  try {
    const parsed = new URL(normalizedUrl);
    if (parsed.hostname.toLowerCase() === "htmobiletire.com") {
      parsed.protocol = "https:";
      parsed.hostname = "www.htmobiletire.com";
      return parsed.toString().replace(/\/+$/, "");
    }
  } catch {
    // Fallback on raw string if parsing fails
  }
  return normalizedUrl;
}

/**
 * Builds an absolute canonical URL on the official canonical domain (https://www.htmobiletire.com).
 * Preserves query strings, handles leading slashes cleanly, and avoids double-slashes.
 */
export function buildCanonicalSiteUrl(pathAndQuery: string): string {
  const cleanPath = (pathAndQuery || "").trim();
  if (!cleanPath || cleanPath === "/") {
    return CANONICAL_SITE_URL;
  }
  if (/^https?:\/\//i.test(cleanPath)) {
    const normalized = normalizeBaseUrl(cleanPath);
    if (normalized) return resolveBusinessDomain(normalized);
  }
  const formattedPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  return `${CANONICAL_SITE_URL}${formattedPath}`;
}

/**
 * Validates and normalizes an application base URL string.
 *
 * Rules:
 * 1. Safely trims leading/trailing whitespace.
 * 2. Strips all trailing slashes to prevent double-slash path concatenation.
 * 3. Requires an absolute URL with valid "http:" or "https:" protocol.
 * 4. Rejects malformed strings, relative paths, and unexpected protocols (e.g. javascript:, ftp:).
 * 5. Returns the clean normalized base URL, or null if invalid.
 */
export function normalizeBaseUrl(candidate: string | null | undefined): string | null {
  if (!candidate || typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed || trimmed === "..." || trimmed.toLowerCase() === "undefined") {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.hostname || parsed.hostname.trim() === "") {
      return null;
    }

    // Strip trailing slashes safely while preserving origin and any base pathname
    const cleanUrl = trimmed.replace(/\/+$/, "");
    return cleanUrl;
  } catch {
    return null;
  }
}

/**
 * Resolves the active canonical base URL for the application.
 *
 * Resolution Order:
 * 1. Explicit candidate URL (if supplied and valid).
 * 2. NEXT_PUBLIC_APP_URL environment variable (custom domains, localhost, or explicit URLs).
 * 3. VERCEL_ENV === "production" fallback to CANONICAL_SITE_URL (prevents transient VERCEL_URL hashes from leaking into production metadata).
 * 4. VERCEL_URL platform environment variable for preview deployments (prepended with https://).
 * 5. DEFAULT_PRODUCTION_URL ("https://ht-mobile-tire.vercel.app").
 *
 * Rules:
 * - Any apex business-domain reference (htmobiletire.com) automatically resolves to www.htmobiletire.com.
 * - WWW input remains www.htmobiletire.com.
 * - Explicit custom domains and localhost URLs are preserved.
 * - Preview branches resolve their own Vercel deployment hostname.
 */
export function getCanonicalBaseUrl(customCandidate?: string | null): string {
  if (customCandidate) {
    const normalized = normalizeBaseUrl(customCandidate);
    if (normalized) return resolveBusinessDomain(normalized);
  }

  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envAppUrl) {
    const normalized = normalizeBaseUrl(envAppUrl);
    if (normalized) return resolveBusinessDomain(normalized);
  }

  const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercelEnv === "production") {
    return CANONICAL_SITE_URL;
  }

  const vercelUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercelUrl) {
    const candidate = vercelUrl.startsWith("http://") || vercelUrl.startsWith("https://")
      ? vercelUrl
      : `https://${vercelUrl}`;
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return resolveBusinessDomain(normalized);
  }

  return DEFAULT_PRODUCTION_URL;
}

/**
 * Builds an absolute canonical URL with the given path and optional query parameters.
 * Preserves query strings, handles leading slashes cleanly, and avoids double-slashes.
 */
export function buildCanonicalUrl(pathAndQuery: string, baseUrl?: string | null): string {
  const base = getCanonicalBaseUrl(baseUrl);
  const cleanPath = (pathAndQuery || "").trim();

  if (!cleanPath) {
    return base;
  }

  // If already an absolute HTTP/HTTPS URL, return it if valid (resolving apex to www if business domain)
  if (/^https?:\/\//i.test(cleanPath)) {
    const normalized = normalizeBaseUrl(cleanPath);
    if (normalized) return resolveBusinessDomain(normalized);
  }

  const formattedPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  return `${base}${formattedPath}`;
}
