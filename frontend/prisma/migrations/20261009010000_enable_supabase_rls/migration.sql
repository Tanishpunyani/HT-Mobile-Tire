-- Migration: 20261009010000_enable_supabase_rls
-- Purpose: Enable Row Level Security (RLS) across all tables and establish least-privilege PostgREST policies and table/column grants.
-- Server-side Prisma connections (using direct postgres connection) bypass RLS.
-- This protects against unauthorized data exposure or modification via the public Supabase PostgREST Data API.

-- ============================================================================
-- 1. Enable RLS on all 14 public tables
-- ============================================================================
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emergency_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "technicians" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "technician_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_login_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Revoke table-level and column-level privileges from public API roles
--    (Preserves postgres and service_role administrative privileges)
-- ============================================================================
REVOKE ALL PRIVILEGES ON TABLE "users" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "services" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "customers" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "bookings" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "emergency_requests" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "contact_messages" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "reviews" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "notification_logs" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "booking_drafts" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "technicians" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "technician_locations" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "admin_sessions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "admin_login_attempts" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "rate_limits" FROM PUBLIC, anon, authenticated;

-- Explicitly revoke column-level UPDATE privileges on all known columns of users and customers
-- (In PostgreSQL, table-level REVOKE does not remove separately granted column-level privileges)
REVOKE UPDATE (
    "id", "name", "email", "phone", "role",
    "created_at", "updated_at", "first_name", "last_name"
)
ON TABLE "users"
FROM PUBLIC, anon, authenticated;

REVOKE UPDATE (
    "id", "user_id", "name", "phone", "email",
    "created_at", "updated_at"
)
ON TABLE "customers"
FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 3. Restore least-privilege table-level SELECT grants
-- ============================================================================
-- Public active catalog read
GRANT SELECT ON TABLE "services" TO anon, authenticated;
GRANT SELECT ON TABLE "reviews" TO anon, authenticated;

-- Authenticated customer portal access
GRANT SELECT ON TABLE "users" TO authenticated;
GRANT SELECT ON TABLE "customers" TO authenticated;
GRANT SELECT ON TABLE "bookings" TO authenticated;

-- ============================================================================
-- 4. Grant least-privilege column-level UPDATE grants
--    (Strictly protects users.role, id, email, customer_id, and other immutable fields)
-- ============================================================================
GRANT UPDATE ("name", "phone", "updated_at", "first_name", "last_name") ON TABLE "users" TO authenticated;
GRANT UPDATE ("name", "phone", "updated_at") ON TABLE "customers" TO authenticated;

-- ============================================================================
-- 5. Row Level Security Policies (Restricting rows accessible to permitted roles)
-- ============================================================================

-- Services: Public read for active catalog items
DROP POLICY IF EXISTS "Allow public read of active services" ON "services";
CREATE POLICY "Allow public read of active services"
    ON "services"
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- Reviews: Public read for approved reviews
DROP POLICY IF EXISTS "Allow public read of approved reviews" ON "reviews";
CREATE POLICY "Allow public read of approved reviews"
    ON "reviews"
    FOR SELECT
    TO anon, authenticated
    USING (is_approved = true);

-- Users: Customers can read own record
DROP POLICY IF EXISTS "Users can read own record" ON "users";
CREATE POLICY "Users can read own record"
    ON "users"
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Users: Customers can update own record (restricted to granted columns above)
DROP POLICY IF EXISTS "Users can update own record" ON "users";
CREATE POLICY "Users can update own record"
    ON "users"
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Customers: Customers can read own customer profile
DROP POLICY IF EXISTS "Customers can read own profile" ON "customers";
CREATE POLICY "Customers can read own profile"
    ON "customers"
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Customers: Customers can update own customer profile (restricted to granted columns above)
DROP POLICY IF EXISTS "Customers can update own profile" ON "customers";
CREATE POLICY "Customers can update own profile"
    ON "customers"
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Bookings: Authenticated customers can view only their own bookings
DROP POLICY IF EXISTS "Customers can read own bookings" ON "bookings";
CREATE POLICY "Customers can read own bookings"
    ON "bookings"
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    );

-- ============================================================================
-- 6. Sensitive / Internal Tables Summary
--    Explicitly NO privileges and NO policies granted to anon or authenticated on:
--    - admin_sessions
--    - admin_login_attempts
--    - rate_limits
--    - technicians
--    - technician_locations
--    - notification_logs
--    - booking_drafts
--    - emergency_requests
--    - contact_messages
--    PostgreSQL default with RLS enabled: Deny ALL operations for public API roles.
--    Direct server connections (Prisma / postgres / service_role) retain full access.
-- ============================================================================
