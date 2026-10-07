export const dynamic = "force-dynamic";

import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import NotificationsManagementClient, {
  NotificationLog,
} from "./NotificationsManagementClient";
import { logger } from "@/lib/logger";

export default async function AdminNotificationsPage() {
  await requireAdminSession();

  let initialLogs: NotificationLog[] = [];

  try {
    const rawLogs = await prisma.notificationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    initialLogs = serializeDecimal(rawLogs) as unknown as NotificationLog[];
  } catch (error) {
    logger.error("admin_notifications_page.get_failed", { error });
  }

  return <NotificationsManagementClient initialLogs={initialLogs} />;
}
