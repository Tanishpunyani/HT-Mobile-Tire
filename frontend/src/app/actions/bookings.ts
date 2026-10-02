"use server";

/**
 * Central Server Actions Delegation Hub for Bookings Domain
 * HT Mobile Services / Tire Mobile Clinic
 */

import * as customerModule from "./bookings/customer";
import * as adminModule from "./bookings/admin";
import * as techModule from "./bookings/technician";
import * as quoteModule from "./bookings/quote";

export type { CompleteAndQuoteParams } from "./bookings/quote";

export async function createBookingRequestAction(
  ...args: Parameters<typeof customerModule.createBookingRequestAction>
) {
  return customerModule.createBookingRequestAction(...args);
}

export async function cancelCustomerBookingAction(
  ...args: Parameters<typeof customerModule.cancelCustomerBookingAction>
) {
  return customerModule.cancelCustomerBookingAction(...args);
}

export async function confirmBookingAction(
  ...args: Parameters<typeof adminModule.confirmBookingAction>
) {
  return adminModule.confirmBookingAction(...args);
}

export async function startServiceAction(
  ...args: Parameters<typeof adminModule.startServiceAction>
) {
  return adminModule.startServiceAction(...args);
}

export async function cancelBookingAction(
  ...args: Parameters<typeof adminModule.cancelBookingAction>
) {
  return adminModule.cancelBookingAction(...args);
}

export async function assignTechnicianAction(
  ...args: Parameters<typeof adminModule.assignTechnicianAction>
) {
  return adminModule.assignTechnicianAction(...args);
}

export async function markTechnicianArrivedAction(
  ...args: Parameters<typeof techModule.markTechnicianArrivedAction>
) {
  return techModule.markTechnicianArrivedAction(...args);
}

export async function startTechnicianTripAction(
  ...args: Parameters<typeof techModule.startTechnicianTripAction>
) {
  return techModule.startTechnicianTripAction(...args);
}

export async function getTechnicianPortalDataAction(
  ...args: Parameters<typeof techModule.getTechnicianPortalDataAction>
) {
  return techModule.getTechnicianPortalDataAction(...args);
}

export async function completeAndQuoteAction(
  ...args: Parameters<typeof quoteModule.completeAndQuoteAction>
) {
  return quoteModule.completeAndQuoteAction(...args);
}

export async function markBookingPaidAction(
  ...args: Parameters<typeof quoteModule.markBookingPaidAction>
) {
  return quoteModule.markBookingPaidAction(...args);
}
