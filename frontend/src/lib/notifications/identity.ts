/**
 * Deterministic Notification Identity & Event Key Generator
 * HT Mobile Services / Tire Mobile Clinic
 *
 * Provides pure, deterministic application-level event keys to uniquely identify
 * business notification occurrences and establish a duplicate-prevention foundation.
 *
 * RULES:
 * 1. Strictly deterministic (no Date.now(), Math.random(), or process-specific state).
 * 2. Same entity ID + event + qualifier ALWAYS produces identical event keys.
 * 3. Does not depend on database constraints or gateway-specific headers.
 */

export interface NotificationIdentityParams {
  eventName: string;
  entityId: string;
  qualifier?: string | null;
}

/**
 * Normalizes entity IDs by trimming whitespace and converting to lowercase.
 */
function cleanId(id: string): string {
  if (!id || typeof id !== "string") return "unknown";
  return id.trim().toLowerCase();
}

/**
 * Core deterministic event key builder.
 * Format: `<event_name>:<entity_id>` or `<event_name>:<entity_id>:<qualifier>`
 */
export function buildNotificationEventKey({
  eventName,
  entityId,
  qualifier,
}: NotificationIdentityParams): string {
  const cleanEvent = (eventName || "notification").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const entity = cleanId(entityId);
  const cleanQual = qualifier ? cleanId(qualifier).replace(/[^a-z0-9_-]/g, "_") : null;

  if (cleanQual) {
    return `${cleanEvent}:${entity}:${cleanQual}`;
  }
  return `${cleanEvent}:${entity}`;
}

// ============================================================================
// TYPED EVENT KEY CONVENIENCE BUILDERS
// ============================================================================

export function buildBookingCreatedAdminKey(bookingId: string): string {
  return buildNotificationEventKey({
    eventName: "booking_created_admin",
    entityId: bookingId,
  });
}

export function buildBookingConfirmedKey(bookingId: string): string {
  return buildNotificationEventKey({
    eventName: "booking_confirmation",
    entityId: bookingId,
  });
}

export function buildTechnicianAssignedKey(bookingId: string, technicianId?: string | null): string {
  return buildNotificationEventKey({
    eventName: "technician_assigned",
    entityId: bookingId,
    qualifier: technicianId || undefined,
  });
}

export function buildTechnicianEnRouteKey(bookingId: string): string {
  return buildNotificationEventKey({
    eventName: "technician_en_route",
    entityId: bookingId,
  });
}

export function buildTechnicianArrivedKey(bookingId: string): string {
  return buildNotificationEventKey({
    eventName: "technician_arrived",
    entityId: bookingId,
  });
}

export function buildServiceCompletedKey(bookingId: string): string {
  return buildNotificationEventKey({
    eventName: "service_completed",
    entityId: bookingId,
  });
}

export function buildEmergencyAlertKey(emergencyId: string): string {
  return buildNotificationEventKey({
    eventName: "emergency_alert",
    entityId: emergencyId,
  });
}

export function buildContactAlertKey(contactMessageId: string): string {
  return buildNotificationEventKey({
    eventName: "contact_alert",
    entityId: contactMessageId,
  });
}

export function buildBookingCancelledKey(bookingId: string, cancelledBy?: string | null): string {
  return buildNotificationEventKey({
    eventName: "booking_cancelled",
    entityId: bookingId,
    qualifier: cancelledBy || "unknown",
  });
}

export function buildPaymentReceivedKey(bookingId: string): string {
  return buildNotificationEventKey({
    eventName: "payment_received",
    entityId: bookingId,
  });
}

