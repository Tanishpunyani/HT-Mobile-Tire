-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "service_confirmed_at" TIMESTAMPTZ(6);
ALTER TABLE "bookings" ADD COLUMN "estimated_duration_minutes" INTEGER DEFAULT 45;
