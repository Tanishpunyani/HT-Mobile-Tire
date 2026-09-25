/**
 * Edge-compatible admin session cookie validation using native Web Crypto API.
 * Contains ZERO Node.js / database / logger dependencies so it runs cleanly in Edge Middleware.
 */

export const ADMIN_SESSION_COOKIE_NAME = "admin_session";

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function validateAdminCookieEdge(
  cookieValue: string | null | undefined
): Promise<{ valid: boolean; rawToken?: string; expiresAtMs?: number; error?: string }> {
  if (!cookieValue || typeof cookieValue !== "string" || cookieValue.trim() === "") {
    return { valid: false, error: "Missing admin session cookie." };
  }

  const trimmed = cookieValue.trim();
  const parts = trimmed.split(".");

  // 1. Signed format: <rawToken>.<expiresAtMs>.<signature>
  if (parts.length === 3) {
    const [rawToken, expStr, signature] = parts;
    const expiresAtMs = parseInt(expStr, 10);

    if (!rawToken || rawToken.length !== 64 || isNaN(expiresAtMs) || !signature) {
      return { valid: false, error: "Malformed signed admin session cookie." };
    }

    if (expiresAtMs <= Date.now()) {
      return { valid: false, error: "Admin session cookie has expired." };
    }

    const secret = (process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_EMAIL || "").trim();
    if (!secret) {
      return { valid: false, error: "Server admin secret is unconfigured." };
    }
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    try {
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const dataToSign = encoder.encode(`${rawToken}.${expiresAtMs}`);
      const signatureBuffer = await crypto.subtle.sign("HMAC", key, dataToSign);

      const bytes = new Uint8Array(signatureBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const expectedSignature = btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      if (!timingSafeEqualStrings(signature, expectedSignature)) {
        return { valid: false, error: "Invalid admin session signature." };
      }

      return { valid: true, rawToken, expiresAtMs };
    } catch {
      return { valid: false, error: "Cryptographic signature validation failed." };
    }
  }

  // 2. Allow raw 64-hex tokens for backward compatibility
  if (parts.length === 1 && /^[a-f0-9]{64}$/i.test(parts[0])) {
    return { valid: true, rawToken: parts[0] };
  }

  return { valid: false, error: "Invalid admin session cookie format." };
}
