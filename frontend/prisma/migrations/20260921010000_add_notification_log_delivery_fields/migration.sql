-- AlterTable
ALTER TABLE "notification_logs" ADD COLUMN "delivery_status" TEXT;
ALTER TABLE "notification_logs" ADD COLUMN "delivered_at" TIMESTAMPTZ(6);
ALTER TABLE "notification_logs" ADD COLUMN "provider_event_id" TEXT;

-- CreateIndex
CREATE INDEX "notification_logs_message_id_idx" ON "notification_logs"("message_id");
