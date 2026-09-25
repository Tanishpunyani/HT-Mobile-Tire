-- CreateTable
CREATE TABLE "technicians" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Mobile Tire Technician',
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "technician_id" UUID;

-- AlterTable
ALTER TABLE "technician_locations" ADD COLUMN "technician_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "technicians_name_key" ON "technicians"("name");

-- CreateIndex
CREATE INDEX "bookings_technician_id_idx" ON "bookings"("technician_id");

-- CreateIndex
CREATE INDEX "technician_locations_technician_id_idx" ON "technician_locations"("technician_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "technician_locations" ADD CONSTRAINT "technician_locations_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
