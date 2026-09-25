/**
 * @deprecated Legacy admin auth module.
 * All admin authorization is now separated into @/lib/admin-auth using persistent database sessions.
 */

import { verifyAdminSession, getAdminSessionToken, requireAdminSession } from "@/lib/admin-auth";

export async function getAdminUser() {
  const token = await getAdminSessionToken();
  const isValid = await verifyAdminSession(token);
  if (!isValid) return null;
  return {
    email: (process.env.ADMIN_EMAIL || "admin@mobiletire.clinic").trim().toLowerCase(),
    role: "admin" as const,
  };
}

export async function requireAdmin() {
  return await requireAdminSession();
}