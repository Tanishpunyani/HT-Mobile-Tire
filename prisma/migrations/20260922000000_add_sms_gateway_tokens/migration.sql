-- CreateTable
CREATE TABLE "sms_gateway_tokens" (
    "id" TEXT NOT NULL DEFAULT 'active',
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_gateway_tokens_pkey" PRIMARY KEY ("id")
);
