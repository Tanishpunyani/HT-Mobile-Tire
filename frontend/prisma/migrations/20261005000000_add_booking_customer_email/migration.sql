-- AlterTable
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "customer_email" TEXT;

-- Safe Backfill: Backfill from customers where email is valid and not an admin email
UPDATE "bookings" b
SET "customer_email" = LOWER(TRIM(c."email"))
FROM "customers" c
WHERE b."customer_id" = c."id"
  AND b."customer_email" IS NULL
  AND c."email" IS NOT NULL
  AND TRIM(c."email") <> ''
  AND LOWER(TRIM(c."email")) NOT LIKE '%admin%'
  AND LOWER(TRIM(c."email")) NOT IN (
    'tanishpunyani87@gmail.com',
    'admin@mobiletire.clinic'
  );
