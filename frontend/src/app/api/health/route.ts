import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const diagnostics: Record<string, any> = {
      supabaseRest: { status: "pending" },
      prismaPostgres: { status: "pending" },
    };

    // 1. Test Supabase REST Client
    const restStartTime = Date.now();
    try {
      const supabase: any = createAdminClient();
      const { error: sbError } = await (supabase.from("customers") as any)
        .select("id", { count: "exact", head: true });

      if (sbError) {
        logger.error("health_check.supabase_error", {
          message: sbError?.message,
          code: sbError?.code,
        });
        diagnostics.supabaseRest = {
          status: "error",
          latencyMs: Date.now() - restStartTime,
          error: "Supabase service unavailable",
        };
      } else {
        diagnostics.supabaseRest = {
          status: "connected",
          latencyMs: Date.now() - restStartTime,
          error: null,
        };
      }
    } catch (err: any) {
      logger.error("health_check.supabase_exception", { message: err?.message });
      diagnostics.supabaseRest = {
        status: "error",
        latencyMs: Date.now() - restStartTime,
        error: "Supabase service unavailable",
      };
    }

    // 2. Test Prisma Direct Database Connection
    const prismaStartTime = Date.now();
    try {
      const timeoutPrisma = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Prisma query timed out after 6000ms")), 6000)
      );
      await Promise.race([
        prisma.$queryRaw`SELECT 1 as connected`,
        timeoutPrisma,
      ]);

      diagnostics.prismaPostgres = {
        status: "connected",
        latencyMs: Date.now() - prismaStartTime,
        error: null,
      };
    } catch (err: any) {
      logger.error("health_check.prisma_exception", { message: err?.message });
      diagnostics.prismaPostgres = {
        status: "error",
        latencyMs: Date.now() - prismaStartTime,
        error: "Database connection unavailable",
      };
    }

    const isHealthy =
      diagnostics.supabaseRest.status === "connected" ||
      diagnostics.prismaPostgres.status === "connected";

    return Response.json(
      {
        status: isHealthy ? "ok" : "error",
        db: isHealthy ? "connected" : "disconnected",
        diagnostics,
        timestamp: new Date().toISOString(),
      },
      { status: isHealthy ? 200 : 503 }
    );
  } catch (fatalErr: any) {
    logger.error("health_check.fatal_exception", { message: fatalErr?.message });
    return Response.json(
      {
        status: "error",
        db: "disconnected",
        diagnostics: {
          supabaseRest: { status: "error", error: "Supabase service unavailable" },
          prismaPostgres: { status: "error", error: "Database connection unavailable" },
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
