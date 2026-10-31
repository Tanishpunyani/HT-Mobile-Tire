/**
 * Canonical Application URL Utility for HT Mobile Tire.
 *
 * Resolves, validates, and normalizes the public-facing canonical application URL.
 * Falls back strictly to the verified working production Vercel hostname until
 * an independently owned custom domain has been purchased and configured.
 */

export const DEFAULT_PRODUCTION_URL = "https://ht-mobile-tire.vercel.app";

/**
 * Official canonical apex domain for HT Mobile Tire SEO, sitemaps, Open Graph, and metadata.
 */
export const CANONICAL_SITE_URL = "https://htmobiletire.com";

/**
 * Resolves the confirmed public canonical site URL for SEO.
 */
export function getCanonicalSiteUrl(): string {
  return CANONICAL_SITE_URL;
}

/**
 * Builds an absolute canonical URL on the official canonical domain (https://htmobiletire.com).
 * Preserves query strings, handles leading slashes cleanly, and avoids double-slashes.
 */
export function buildCanonicalSiteUrl(pathAndQuery: string): string {
  const cleanPath = (pathAndQuery || "").trim();
  if (!cleanPath || cleanPath === "/") {
    return CANONICAL_SITE_URL;
  }
  if (/^https?:\/\//i.test(cleanPath)) {
    const normalized = normalizeBaseUrl(cleanPath);
    if (normalized) return normalized;
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
 * 2. NEXT_PUBLIC_APP_URL environment variable.
 * 3. VERCEL_URL platform environment variable (prepended with https://).
 * 4. DEFAULT_PRODUCTION_URL ("https://ht-mobile-tire.vercel.app").
 */
export function getCanonicalBaseUrl(customCandidate?: string | null): string {
  if (customCandidate) {
    const normalized = normalizeBaseUrl(customCandidate);
    if (normalized) return normalized;
  }

  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envAppUrl) {
    const normalized = normalizeBaseUrl(envAppUrl);
    if (normalized === "https://www.htmobiletire.com") {
      return CANONICAL_SITE_URL;
    }
    if (normalized) return normalized;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    const candidate = vercelUrl.startsWith("http://") || vercelUrl.startsWith("https://")
      ? vercelUrl
      : `https://${vercelUrl}`;
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
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

  // If already an absolute HTTP/HTTPS URL, return it if valid
  if (/^https?:\/\//i.test(cleanPath)) {
    const normalized = normalizeBaseUrl(cleanPath);
    if (normalized) return normalized;
  }

  const formattedPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  return `${base}${formattedPath}`;
}
