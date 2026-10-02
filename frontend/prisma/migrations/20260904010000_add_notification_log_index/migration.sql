-- CreateIndex
CREATE INDEX "notification_logs_created_at_status_idx" ON "notification_logs"("created_at", "status");
