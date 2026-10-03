-- DropForeignKey
ALTER TABLE IF EXISTS "whatsapp_messages" DROP CONSTRAINT IF EXISTS "whatsapp_messages_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "whatsapp_conversations" DROP CONSTRAINT IF EXISTS "whatsapp_conversations_customer_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "whatsapp_conversations" DROP CONSTRAINT IF EXISTS "whatsapp_conversations_active_booking_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "whatsapp_messages";

-- DropTable
DROP TABLE IF EXISTS "whatsapp_conversations";
