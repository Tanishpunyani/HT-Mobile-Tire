/**
 * Lightweight, dependency-free structured server logger for HT Mobile Tires.
 *
 * Formats logs as JSON in production and structured readable logs in development.
 * Provides built-in PII and secret sanitization to prevent sensitive data leakage.
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogMetadata {
  [key: string]: unknown;
}

const REDACTED_KEYS = new Set([
  "password",
  "pass",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "auth",
  "cookie",
  "cookies",
  "session",
  "sessionid",
  "session_id",
  "cronsecret",
  "cron_secret",
  "technicianapikey",
  "technician_api_key",
  "supabase_service_role_key",
  "body",
  "emailbody",
  "email_body",
  "messagebody",
  "message_body",
  "rawbody",
  "notes",
  "customernotes",
]);

const EMAIL_KEYS = new Set([
  "email",
  "customeremail",
  "customer_email",
  "useremail",
  "user_email",
  "recipientemail",
  "recipient_email",
  "toemail",
  "to_email",
]);

const PHONE_KEYS = new Set([
  "phone",
  "customerphone",
  "customer_phone",
  "phonenumber",
  "phone_number",
  "recipientphone",
  "recipient_phone",
  "tophone",
  "to_phone",
]);

/**
 * Mask an email address to protect customer PII.
 * Example: john.doe@example.com -> j***e@example.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return "";
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return "***@***";
  }
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (local.length <= 1) {
    return `*@${domain}`;
  }
  if (local.length === 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Mask a phone number to protect customer PII while keeping troubleshooting context.
 * Example: +18005558473 -> +1800***8473 / ***-8473
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== "string") return "";
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return "***";

  const last4 = cleaned.slice(-4);
  const prefix = cleaned.length > 7 ? cleaned.slice(0, cleaned.length - 7) : "";
  return prefix ? `${prefix}***${last4}` : `***-${last4}`;
}

/**
 * Format an error object safely without leaking unhandled structures.
 */
function serializeError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    };
  }
  if (typeof err === "string") {
    return { name: "Error", message: err };
  }
  return { name: "UnknownError", message: String(err) };
}

/**
 * Sanitize metadata objects recursively to mask PII and remove sensitive secrets.
 */
export function sanitizeLogMetadata(meta: unknown, depth = 0): unknown {
  if (depth > 4) return "[Max Depth Reached]";
  if (meta === null || meta === undefined) return meta;

  if (meta instanceof Error) {
    return serializeError(meta);
  }

  if (typeof meta !== "object") {
    return meta;
  }

  if (Array.isArray(meta)) {
    return meta.map((item) => sanitizeLogMetadata(item, depth + 1));
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (REDACTED_KEYS.has(normalizedKey)) {
      result[key] = "[REDACTED]";
      continue;
    }

    if (EMAIL_KEYS.has(normalizedKey)) {
      result[key] = typeof value === "string" ? maskEmail(value) : "[MASKED_EMAIL]";
      continue;
    }

    if (PHONE_KEYS.has(normalizedKey)) {
      result[key] = typeof value === "string" ? maskPhone(value) : "[MASKED_PHONE]";
      continue;
    }

    if (normalizedKey === "recipient" || normalizedKey === "to") {
      if (typeof value === "string") {
        result[key] = value.includes("@") ? maskEmail(value) : maskPhone(value);
      } else {
        result[key] = "[MASKED_RECIPIENT]";
      }
      continue;
    }

    if (value instanceof Error) {
      result[key] = serializeError(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitizeLogMetadata(value, depth + 1);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function outputLog(level: LogLevel, event: string, meta?: LogMetadata): void {
  const isProd = process.env.NODE_ENV === "production";
  const timestamp = new Date().toISOString();
  const sanitized = meta ? (sanitizeLogMetadata(meta) as Record<string, unknown>) : undefined;

  if (isProd) {
    const payload = {
      timestamp,
      level,
      event,
      ...(sanitized && typeof sanitized === "object" ? sanitized : {}),
    };

    const serialized = JSON.stringify(payload);
    if (typeof process !== "undefined" && process.stdout && typeof process.stdout.write === "function") {
      if (level === "error") {
        process.stderr.write(serialized + "\n");
      } else {
        process.stdout.write(serialized + "\n");
      }
    } else {
      if (level === "error") {
        console.error(serialized);
      } else if (level === "warn") {
        console.warn(serialized);
      } else {
        console.info(serialized);
      }
    }
  } else {
    // Development mode: clean, legible output
    const metaSuffix = sanitized && Object.keys(sanitized).length > 0 ? " " + JSON.stringify(sanitized) : "";
    const formatted = `[${timestamp}] [${level.toUpperCase()}] ${event}${metaSuffix}`;

    if (level === "error") {
      console.error(formatted);
    } else if (level === "warn") {
      console.warn(formatted);
    } else if (level === "debug") {
      console.debug(formatted);
    } else {
      console.info(formatted);
    }
  }
}

export const logger = {
  info(event: string, meta?: LogMetadata): void {
    outputLog("info", event, meta);
  },
  warn(event: string, meta?: LogMetadata): void {
    outputLog("warn", event, meta);
  },
  error(event: string, meta?: LogMetadata): void {
    outputLog("error", event, meta);
  },
  debug(event: string, meta?: LogMetadata): void {
    outputLog("debug", event, meta);
  },
};
