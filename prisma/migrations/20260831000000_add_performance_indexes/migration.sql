-- CreateIndex
CREATE INDEX "customers_user_id_idx" ON "customers"("user_id");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");

-- CreateIndex
CREATE INDEX "bookings_service_id_idx" ON "bookings"("service_id");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_booking_date_idx" ON "bookings"("booking_date");

-- CreateIndex
CREATE INDEX "emergency_requests_customer_id_idx" ON "emergency_requests"("customer_id");

-- CreateIndex
CREATE INDEX "emergency_requests_service_id_idx" ON "emergency_requests"("service_id");

-- CreateIndex
CREATE INDEX "emergency_requests_status_idx" ON "emergency_requests"("status");
