import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession, ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

    const isValid = await verifyAdminSession(token);

    if (!isValid) {
      return Response.json(
        {
          success: false,
          error: "Administrator access required.",
        },
        { status: 401 }
      );
    }

    try {
      const emergencyRequests = await prisma.emergencyRequest.findMany({
        orderBy: {
          createdAt: "desc",
        },
        include: {
          customer: true,
          service: true,
        },
      });

      return Response.json({
        success: true,
        count: emergencyRequests.length,
        emergencyRequests,
      });
    } catch (prismaErr) {
      logger.warn("admin_emergency_requests.prisma_fallback", { error: prismaErr });
      const supabase: any = createAdminClient();
      const { data: reqData, error: sbError } = await (supabase.from("emergency_requests") as any)
        .select("*, customer:customers(*), service:services(*)")
        .order("created_at", { ascending: false });

      if (sbError) {
        throw sbError;
      }

      const formatted = (reqData || []).map((r: any) => ({
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

      return Response.json({
        success: true,
        count: formatted.length,
        emergencyRequests: formatted,
      });
    }
  } catch (error: any) {
    logger.error("admin_emergency_requests.get_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to load emergency requests. Please try again.",
      },
      { status: 500 }
    );
  }
}