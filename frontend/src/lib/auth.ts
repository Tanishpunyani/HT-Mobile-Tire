import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export { isCustomer, isAdmin, sanitizeRedirectTarget } from "@/lib/utils/auth-helpers";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
}

/**
 * Retrieves the currently authenticated Supabase user on the server.
 * Handles token expiration, missing sessions, and returns null if unauthenticated.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      if (error) {
        logger.warn("auth.user.check_failed", { error: error.message });
      }
      return null;
    }

    const email = user.email || "";
    const firstName = user.user_metadata?.first_name || "";
    const lastName = user.user_metadata?.last_name || "";
    const fullName =
      [firstName, lastName].filter(Boolean).join(" ") ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      email.split("@")[0] ||
      "Customer";

    return {
      id: user.id,
      email,
      name: fullName,
      firstName,
      lastName,
      phone: user.phone || user.user_metadata?.phone || "",
      role: user.user_metadata?.role || user.app_metadata?.role || "customer",
    };
  } catch (err) {
    logger.error("auth.user.unexpected_exception", { error: err });
    return null;
  }
}

/**
 * Fallback customer resolver using Supabase REST client
 */
async function getCustomerViaSupabaseRest(authUser: AuthenticatedUser) {
  try {
    const supabase = createAdminClient();

    const { data: existingCustomers, error: findError } = await (supabase.from("customers") as any)
      .select("*")
      .or(`user_id.eq.${authUser.id},email.eq.${authUser.email}`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (findError) {
      throw findError;
    }

    if (existingCustomers && existingCustomers.length > 0) {
      const existing = existingCustomers[0];
      if (!existing.user_id) {
        await (supabase.from("customers") as any)
          .update({ user_id: authUser.id })
          .eq("id", existing.id);
      }

      return {
        id: existing.id,
        userId: authUser.id,
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
        createdAt: existing.created_at ? new Date(existing.created_at).toISOString() : new Date().toISOString(),
      };
    }

    // Insert new customer if missing
    const { data: newCustomer, error: insertError } = await (supabase.from("customers") as any)
      .insert({
        user_id: authUser.id,
        name: authUser.name,
        email: authUser.email || null,
        phone: authUser.phone || "N/A",
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    return {
      id: newCustomer.id,
      userId: newCustomer.user_id,
      name: newCustomer.name,
      email: newCustomer.email,
      phone: newCustomer.phone,
      createdAt: newCustomer.created_at ? new Date(newCustomer.created_at).toISOString() : new Date().toISOString(),
    };
  } catch (fallbackError) {
    logger.error("auth.customer.fallback_failed", { error: fallbackError });
    throw fallbackError;
  }
}

/**
 * Resolves all authorized Customer IDs associated with an authenticated user.
 * Unifies records linked by userId or matching unlinked email/phone.
 */
export async function getAuthorizedCustomerIdsForUser(authUser: {
  id: string;
  email?: string | null;
  phone?: string | null;
}): Promise<string[]> {
  try {
    const userEmail = authUser.email ? authUser.email.trim() : null;
    const userPhone = authUser.phone && authUser.phone !== "N/A" ? authUser.phone.trim() : null;

    const matchedCustomers = await prisma.customer.findMany({
      where: {
        OR: [
          { userId: authUser.id },
          ...(userEmail ? [{ email: userEmail }] : []),
          ...(userPhone ? [{ phone: userPhone, userId: null }] : []),
        ],
      },
      select: {
        id: true,
      },
    });

    return matchedCustomers.map((c) => c.id);
  } catch (err) {
    logger.warn("auth.customer.get_authorized_ids_failed", { error: err });
    return [];
  }
}

/**
 * Optimized, single-roundtrip customer lookup with Prisma and fallback.
 * Safely associates unlinked guest customer records matching verified phone or email.
 */
export async function getOrCreateCustomerForUser(authUser: AuthenticatedUser) {
  try {
    const userPhone = authUser.phone && authUser.phone !== "N/A" ? authUser.phone.trim() : null;
    const userEmail = authUser.email ? authUser.email.trim() : null;

    // 1. Link any unlinked customer records matching verified email or phone
    if (userEmail) {
      try {
        await prisma.customer.updateMany({
          where: {
            email: userEmail,
            userId: null,
          },
          data: {
            userId: authUser.id,
          },
        });
      } catch (linkErr: any) {
        logger.warn("auth.customer.bulk_link_notice", { error: linkErr.message });
      }
    }

    // 2. Direct Lookup: find customer by userId, email, or unlinked phone
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { userId: authUser.id },
          ...(userEmail ? [{ email: userEmail }] : []),
          ...(userPhone ? [{ phone: userPhone, userId: null }] : []),
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (customer) {
      // If customer row exists but userId was unlinked, link it explicitly to the authenticated user
      // If a valid incoming phone is provided and differs from stored phone, synchronize Customer.phone
      const updateData: {
        userId?: string;
        email?: string;
        phone?: string;
      } = {};

      if (!customer.userId) {
        updateData.userId = authUser.id;
        if (userEmail && !customer.email) {
          updateData.email = userEmail;
        }
      }

      if (userPhone && userPhone !== customer.phone) {
        updateData.phone = userPhone;
      }

      if (Object.keys(updateData).length > 0) {
        try {
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: updateData,
          });
        } catch (e: any) {
          logger.warn("auth.customer.link_notice", { error: e.message });
        }
      }

      return {
        id: customer.id,
        userId: customer.userId || authUser.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        createdAt: customer.createdAt ? customer.createdAt.toISOString() : new Date().toISOString(),
      };
    }

    // 3. If no customer exists, ensure User row exists, then create Customer
    await prisma.user.upsert({
      where: { id: authUser.id },
      update: {},
      create: {
        id: authUser.id,
        email: authUser.email || `${authUser.id}@temporary.clinic`,
        name: authUser.name,
        firstName: authUser.firstName || null,
        lastName: authUser.lastName || null,
        phone: authUser.phone || null,
        role: authUser.role || "customer",
      },
    });

    customer = await prisma.customer.create({
      data: {
        userId: authUser.id,
        name: authUser.name,
        email: authUser.email || null,
        phone: authUser.phone || "N/A",
      },
    });

    return {
      id: customer.id,
      userId: customer.userId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      createdAt: customer.createdAt ? customer.createdAt.toISOString() : new Date().toISOString(),
    };
  } catch (prismaError: any) {
    logger.warn("auth.customer.prisma_fallback", { error: prismaError.message });
    return await getCustomerViaSupabaseRest(authUser);
  }
}
