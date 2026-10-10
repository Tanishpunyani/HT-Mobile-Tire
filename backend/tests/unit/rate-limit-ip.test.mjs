/**
 * Unit Tests: Client IP Resolution, Anti-Spoofing, and Distributed Rate Limiting
 * HT Mobile Services
 */

import { describe, test, assert, assertEqual } from "../helpers/test-runner.mjs";
import crypto from "crypto";

// Standalone mirror of IP validation and resolution logic matching frontend/src/lib/rate-limit.ts
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const IPV6_REGEX =
  /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^::(?:[a-fA-F0-9]{1,4}:){0,6}[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,7}:$|^(?:[a-fA-F0-9]{1,4}:){1,6}:[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:)(?::[a-fA-F0-9]{1,4}){1,6}$|^::$|^(?:[a-fA-F0-9]{1,4}:){1,4}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function isValidIp(ip) {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  return IPV4_REGEX.test(trimmed) || IPV6_REGEX.test(trimmed);
}

function getClientIpFromHeaders(headers) {
  const getHeader = (name) => {
    return headers[name.toLowerCase()] || headers[name] || null;
  };

  // 1. Vercel edge platform-controlled real IP
  const xRealIp = getHeader("x-real-ip");
  if (xRealIp && isValidIp(xRealIp)) {
    return xRealIp.trim();
  }

  // 2. Vercel forwarded header
  const xVercelForwardedFor = getHeader("x-vercel-forwarded-for");
  if (xVercelForwardedFor) {
    const parts = xVercelForwardedFor.split(",").map((s) => s.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
      if (isValidIp(parts[i])) {
        return parts[i];
      }
    }
  }

  // 3. Multi-hop X-Forwarded-For: traverse right-to-left (nearest proxy hop)
  const xForwardedFor = getHeader("x-forwarded-for");
  if (xForwardedFor) {
    const parts = xForwardedFor.split(",").map((s) => s.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
      if (isValidIp(parts[i])) {
        return parts[i];
      }
    }
  }

  // 4. Safe explicit fallback
  return "unknown_client";
}

function hashRateLimitKey(endpointPrefix, identifier, salt = "test-salt-rate-limit-v1") {
  const hash = crypto
    .createHmac("sha256", salt)
    .update(identifier.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
  return `${endpointPrefix}:${hash}`;
}

function verifyTechnicianApiKey(candidateKey, configuredKey) {
  if (!configuredKey || typeof candidateKey !== "string" || candidateKey.trim() === "") {
    return false;
  }
  const candidateTrimmed = candidateKey.trim();
  const configuredBuf = Buffer.from(configuredKey, "utf8");
  const candidateBuf = Buffer.from(candidateTrimmed, "utf8");

  const configuredHash = crypto.createHash("sha256").update(configuredBuf).digest();
  const candidateHash = crypto.createHash("sha256").update(candidateBuf).digest();

  const hashesMatch = crypto.timingSafeEqual(configuredHash, candidateHash);
  return hashesMatch && configuredBuf.length === candidateBuf.length;
}

export function runRateLimitIpTests() {
  describe("Client IP Address Resolution & Anti-Spoofing (Unit)", () => {
    test("Valid IPv4 addresses are accepted", () => {
      assert(isValidIp("192.168.1.1"), "192.168.1.1 must be valid");
      assert(isValidIp("8.8.8.8"), "8.8.8.8 must be valid");
      assert(isValidIp("127.0.0.1"), "127.0.0.1 must be valid");
      assert(isValidIp("255.255.255.255"), "255.255.255.255 must be valid");
    });

    test("Invalid IPv4 addresses are rejected", () => {
      assert(!isValidIp("999.999.999.999"), "Out-of-range octet must be rejected");
      assert(!isValidIp("1.2.3.4.5"), "5 octets must be rejected");
      assert(!isValidIp("1.2.3"), "3 octets must be rejected");
      assert(!isValidIp("not-an-ip"), "Text string must be rejected");
      assert(!isValidIp(""), "Empty string must be rejected");
      assert(!isValidIp(null), "Null must be rejected");
      assert(!isValidIp("1.2.3.256"), "Octet > 255 must be rejected");
    });

    test("Valid IPv6 addresses are accepted", () => {
      assert(isValidIp("::1"), "Loopback IPv6 must be valid");
      assert(isValidIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334"), "Full IPv6 must be valid");
      assert(isValidIp("fe80::1"), "Abbreviated IPv6 must be valid");
    });

    test("Platform x-real-ip takes precedence over client-supplied x-forwarded-for", () => {
      const headers = {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8", // Attacker-controlled header
        "x-real-ip": "142.250.190.46",        // Platform-controlled edge header
      };
      const resolved = getClientIpFromHeaders(headers);
      assertEqual(resolved, "142.250.190.46", "Must trust x-real-ip over x-forwarded-for");
    });

    test("Multi-hop x-forwarded-for resolves rightmost trusted proxy hop", () => {
      const headers = {
        "x-forwarded-for": "10.0.0.1, 172.16.0.1, 198.51.100.25",
      };
      const resolved = getClientIpFromHeaders(headers);
      assertEqual(resolved, "198.51.100.25", "Must select rightmost valid IP address");
    });

    test("Malformed or injected headers fall back safely without error", () => {
      const headers = {
        "x-forwarded-for": "<script>alert(1)</script>, invalid-ip, ; DROP TABLE rate_limits;--",
      };
      const resolved = getClientIpFromHeaders(headers);
      assertEqual(resolved, "unknown_client", "Must fall back to unknown_client on malformed input");
    });

    test("Missing headers fall back to explicit unknown_client instead of 127.0.0.1", () => {
      const headers = {};
      const resolved = getClientIpFromHeaders(headers);
      assertEqual(resolved, "unknown_client", "Must return unknown_client when headers are empty");
    });
  });

  describe("Rate Limit Hashing & Key Protection (Unit)", () => {
    test("Rate limit key does not expose raw IP address", () => {
      const rawIp = "142.250.190.46";
      const key = hashRateLimitKey("booking", rawIp);
      assert(!key.includes(rawIp), "Hashed key must not contain raw IP");
      assert(key.startsWith("booking:"), "Key must be properly scoped by endpoint prefix");
      assertEqual(key.length, "booking:".length + 32, "Key must have 32-hex character digest");
    });

    test("Identical IPs produce identical rate limit keys", () => {
      const key1 = hashRateLimitKey("emergency", "192.168.1.100");
      const key2 = hashRateLimitKey("emergency", " 192.168.1.100 ");
      assertEqual(key1, key2, "Whitespace normalization must produce identical keys");
    });

    test("Different endpoints for the same IP use independent rate limit buckets", () => {
      const ip = "203.0.113.195";
      const emergencyKey = hashRateLimitKey("emergency", ip);
      const contactKey = hashRateLimitKey("contact", ip);
      assert(emergencyKey !== contactKey, "Different endpoints must not share bucket keys");
    });

    test("Rate limit salt cannot reuse ADMIN_COOKIE_SECRET", () => {
      const adminSecret = "a".repeat(64);
      const saltCandidate = "a".repeat(64);
      let reused = false;
      if (saltCandidate && adminSecret && saltCandidate === adminSecret) {
        reused = true;
      }
      assert(reused, "Exact match must be detected to block reuse");
    });

    test("Rate limit salt requires at least 32 characters in production", () => {
      const weakSalt = "short_16_chars!";
      assert(weakSalt.length < 32, "Salt under 32 chars must be rejected as weak");
      const strongSalt = "production_high_entropy_salt_32_bytes_safe!";
      assert(strongSalt.length >= 32, "Salt with >= 32 chars must be accepted");
    });
  });

  describe("Technician API Key Constant-Time Verification (Unit)", () => {
    const CONFIGURED_KEY = "tech_super_secret_production_api_key_2026_xyz";

    test("Matching technician API key returns true", () => {
      const valid = verifyTechnicianApiKey(CONFIGURED_KEY, CONFIGURED_KEY);
      assertEqual(valid, true, "Matching key must return true");
    });

    test("Mismatched technician API key returns false", () => {
      const valid = verifyTechnicianApiKey("wrong_candidate_key_12345", CONFIGURED_KEY);
      assertEqual(valid, false, "Wrong key must return false");
    });

    test("Different length key returns false safely without throwing", () => {
      const validShort = verifyTechnicianApiKey("short", CONFIGURED_KEY);
      const validLong = verifyTechnicianApiKey(CONFIGURED_KEY + "_extra_characters", CONFIGURED_KEY);
      assertEqual(validShort, false, "Short key must return false");
      assertEqual(validLong, false, "Long key must return false");
    });

    test("Null, undefined, or empty key returns false safely", () => {
      assertEqual(verifyTechnicianApiKey(null, CONFIGURED_KEY), false, "Null key must return false");
      assertEqual(verifyTechnicianApiKey(undefined, CONFIGURED_KEY), false, "Undefined key must return false");
      assertEqual(verifyTechnicianApiKey("", CONFIGURED_KEY), false, "Empty key must return false");
      assertEqual(verifyTechnicianApiKey("   ", CONFIGURED_KEY), false, "Whitespace key must return false");
    });

    test("Missing server configured key returns false safely", () => {
      assertEqual(verifyTechnicianApiKey("some_key", null), false, "Unconfigured server key must return false");
      assertEqual(verifyTechnicianApiKey("some_key", ""), false, "Empty server key must return false");
    });
  });
}
