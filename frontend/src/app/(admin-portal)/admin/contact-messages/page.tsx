export const dynamic = "force-dynamic";

import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import ContactMessagesManagementClient, {
  ContactMessage,
} from "./ContactMessagesManagementClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export default async function AdminContactMessagesPage() {
  await requireAdminSession();

  let initialMessages: ContactMessage[] = [];

  try {
    const rawMessages = await prisma.contactMessage.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    initialMessages = serializeDecimal(rawMessages) as unknown as ContactMessage[];
  } catch (prismaErr) {
    logger.warn("admin_contact_messages_page.prisma_fallback", { error: prismaErr });
    try {
      const supabase: any = createAdminClient();
      const { data: messages, error: sbError } = await (supabase.from("contact_messages") as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (!sbError && messages) {
        initialMessages = messages.map((m: any) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          phone: m.phone,
          service: m.service,
          location: m.location,
          emergency: m.emergency,
          message: m.message,
          status: m.status,
          createdAt: m.created_at || m.createdAt,
        }));
      }
    } catch (fallbackErr) {
      logger.error("admin_contact_messages_page.fallback_failed", { error: fallbackErr });
    }
  }

  return <ContactMessagesManagementClient initialMessages={initialMessages} />;
}