-- CreateTable
CREATE TABLE "whatsapp_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "customer_phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'bot_active',
    "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_booking_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "wamid" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "type" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT,
    "raw_payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_conversations_customer_phone_idx" ON "whatsapp_conversations"("customer_phone");

-- CreateIndex
CREATE INDEX "whatsapp_conversations_customer_id_idx" ON "whatsapp_conversations"("customer_id");

-- CreateIndex
CREATE INDEX "whatsapp_conversations_last_message_at_idx" ON "whatsapp_conversations"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_wamid_key" ON "whatsapp_messages"("wamid");

-- CreateIndex
CREATE INDEX "whatsapp_messages_conversation_id_idx" ON "whatsapp_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_wamid_idx" ON "whatsapp_messages"("wamid");

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_active_booking_id_fkey" FOREIGN KEY ("active_booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
