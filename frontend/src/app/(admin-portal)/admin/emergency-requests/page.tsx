export const dynamic = "force-dynamic";

import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import EmergencyRequestsManagementClient, {
  EmergencyRequest,
} from "./EmergencyRequestsManagementClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export default async function AdminEmergencyRequestsPage() {
  await requireAdminSession();

  let initialRequests: EmergencyRequest[] = [];

  try {
    const rawRequests = await prisma.emergencyRequest.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        customer: true,
        service: true,
      },
    });

    initialRequests = serializeDecimal(rawRequests) as unknown as EmergencyRequest[];
  } catch (prismaErr) {
    logger.warn("admin_emergency_requests_page.prisma_fallback", { error: prismaErr });
    try {
      const supabase: any = createAdminClient();
      const { data: reqData, error: sbError } = await (supabase.from("emergency_requests") as any)
        .select("*, customer:customers(*), service:services(*)")
        .order("created_at", { ascending: false });

      if (!sbError && reqData) {
        initialRequests = reqData.map((r: any) => ({
          id: r.id,
          currentLocation: r.current_location,
          problem: r.problem,
          problemDetails: r.problem_details,
          vehicle: r.vehicle,
          status: r.status,
          createdAt: r.created_at,
          customer: r.customer,
          service: r.service,
        }));
      }
    } catch (fallbackErr) {
      logger.error("admin_emergency_requests_page.fallback_failed", { error: fallbackErr });
    }
  }

  return <EmergencyRequestsManagementClient initialRequests={initialRequests} />;
}