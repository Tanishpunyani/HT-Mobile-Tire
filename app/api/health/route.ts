import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const diagnostics: Record<string, any> = {
    supabaseRest: { status: "pending" },
    prismaPostgres: { status: "pending" },
  };

  // 1. Test Supabase REST Client
  const restStartTime = Date.now();
  try {
    const supabase: any = createAdminClient();
    const { data, error: sbError } = await (supabase.from("customers") as any)
      .select("id", { count: "exact", head: true });

    diagnostics.supabaseRest = {
      status: sbError ? "error" : "connected",
      latencyMs: Date.now() - restStartTime,
      error: sbError ? sbError.message : null,
    };
  } catch (err: any) {
    diagnostics.supabaseRest = {
      status: "error",
      latencyMs: Date.now() - restStartTime,
      error: err?.message || "Failed to reach Supabase REST endpoint",
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
    };
  } catch (err: any) {
    diagnostics.prismaPostgres = {
      status: "error",
      latencyMs: Date.now() - prismaStartTime,
      error: err?.message || "Prisma PostgreSQL connection failed",
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
}
