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
