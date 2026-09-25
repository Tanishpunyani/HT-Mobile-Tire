import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const email = user.email;

    if (!email) {
      return Response.json(
        {
          success: false,
          error: "Authenticated user does not have an email address.",
        },
        { status: 400 }
      );
    }

    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      email.split("@")[0];

    const phone = user.user_metadata?.phone || "";

    // 1. Find or create the Prisma user (Customer role strictly)
    let dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: user.id },
          { email },
        ],
      },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          id: user.id,
          name,
          email,
          phone,
          role: "customer",
        },
      });
    } else if (dbUser.id !== user.id) {
      dbUser = await prisma.user.update({
        where: {
          id: dbUser.id,
        },
        data: {
          id: user.id,
        },
      });
    }

    // 2. Find or create the customer profile
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { userId: dbUser.id },
          { email: dbUser.email },
          ...(dbUser.phone ? [{ phone: dbUser.phone }] : []),
        ],
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          userId: dbUser.id,
          name: dbUser.name || "Customer",
          email: dbUser.email,
          phone: dbUser.phone || "",
        },
      });
    } else {
      customer = await prisma.customer.update({
        where: {
          id: customer.id,
        },
        data: {
          userId: dbUser.id,
          name: dbUser.name || customer.name,
          email: dbUser.email || customer.email,
          phone: dbUser.phone || customer.phone,
        },
      });
    }

    return Response.json({
      success: true,
      role: "customer",
      user: dbUser,
      customer,
    });
  } catch (error) {
    logger.error("auth.sync_customer_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to synchronize customer account.",
      },
      { status: 500 }
    );
  }
}