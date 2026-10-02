"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const firstName = (formData.get("firstName") as string)?.trim() || "";
  const lastName = (formData.get("lastName") as string)?.trim() || "";
  const phone = (formData.get("phone") as string)?.trim() || "";
  const name = (formData.get("name") as string)?.trim() || "";

  const resolvedFirstName = firstName || name.split(" ")[0] || "";
  const resolvedLastName = lastName || name.split(" ").slice(1).join(" ") || "";
  const fullName = [resolvedFirstName, resolvedLastName].filter(Boolean).join(" ") || name || "Customer";

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: resolvedFirstName,
        last_name: resolvedLastName,
        full_name: fullName,
        phone,
      },
    },
  });

  if (authError) {
    throw new Error(authError.message);
  }

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error("User creation failed.");
  }

  try {
    // Check if user record already exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          id: userId,
          email,
          name: fullName,
          firstName: resolvedFirstName,
          lastName: resolvedLastName,
          phone,
          role: "customer",
        },
      });
    }

    // Link any unlinked Customer records matching verified email
    if (email) {
      await prisma.customer.updateMany({
        where: { email, userId: null },
        data: { userId },
      });
    }

    // Also find or create Customer record for bookings
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [{ userId }, ...(email ? [{ email }] : [])],
      },
    });

    if (!existingCustomer) {
      await prisma.customer.create({
        data: {
          userId,
          name: fullName,
          email,
          phone: phone || "N/A",
        },
      });
    }
  } catch (err) {
    logger.error("auth_action.signup_sync_failed", { error: err });
  }

  if (authData.session) {
    redirect("/account");
  }

  redirect("/login?message=Check your email to confirm your account");
}

function sanitizeRedirectTarget(target: unknown, fallback = "/account"): string {
  if (typeof target !== "string") return fallback;
  const trimmed = target.trim();
  if (!trimmed) return fallback;

  // Must start with a single "/" and NOT start with "//" (protocol-relative URL)
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  // Must not contain backslashes that could trick browser URL resolution
  if (trimmed.includes("\\")) {
    return fallback;
  }

  // Must not contain a protocol scheme (e.g. javascript:, http:, https:, data:)
  try {
    const decoded = decodeURIComponent(trimmed);
    if (
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(decoded.replace(/^\/+/, ""))
    ) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return trimmed;
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const rawRedirect = (formData.get("redirect") as string) || "/account";
  const redirectTarget = sanitizeRedirectTarget(rawRedirect, "/account");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Unable to authenticate user.");
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: data.user.id },
    });

    const firstName = data.user.user_metadata?.first_name || "";
    const lastName = data.user.user_metadata?.last_name || "";
    const fullName =
      [firstName, lastName].filter(Boolean).join(" ") ||
      data.user.user_metadata?.full_name ||
      "Customer";
    const phone = data.user.user_metadata?.phone || "";

    if (!existing) {
      await prisma.user.create({
        data: {
          id: data.user.id,
          email: data.user.email!,
          name: fullName,
          firstName,
          lastName,
          phone,
          role: "customer",
        },
      });
    }

    // Link any unlinked Customer records matching verified email
    if (data.user.email) {
      await prisma.customer.updateMany({
        where: { email: data.user.email, userId: null },
        data: { userId: data.user.id },
      });
    }

    // Sync customer record
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [{ userId: data.user.id }, ...(data.user.email ? [{ email: data.user.email }] : [])],
      },
    });

    if (!existingCustomer) {
      await prisma.customer.create({
        data: {
          userId: data.user.id,
          name: fullName,
          email: data.user.email!,
          phone: phone || "N/A",
        },
      });
    }
  } catch (err) {
    logger.error("auth_action.login_sync_failed", { error: err });
  }

  const role = data.user.user_metadata?.role || data.user.app_metadata?.role;
  if (role === "admin" || role === "superadmin") {
    redirect("/admin/dashboard");
  }

  redirect(redirectTarget);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
