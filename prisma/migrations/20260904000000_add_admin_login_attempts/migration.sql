-- CreateTable
CREATE TABLE "admin_login_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "first_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blocked_until" TIMESTAMPTZ(6),

    CONSTRAINT "admin_login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_login_attempts_key_key" ON "admin_login_attempts"("key");

-- CreateIndex
CREATE INDEX "admin_login_attempts_key_idx" ON "admin_login_attempts"("key");

-- CreateIndex
CREATE INDEX "admin_login_attempts_blocked_until_idx" ON "admin_login_attempts"("blocked_until");
