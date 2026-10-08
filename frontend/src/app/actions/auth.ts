"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";

export type AuthActionResult = {
  success: boolean;
  error?: string;
  redirectUrl?: string;
};

export async function signup(formData: FormData): Promise<AuthActionResult | void> {
  const supabase = await createClient();
  const rawEmail = (formData.get("email") as string) || "";
  const email = rawEmail.trim().toLowerCase();
  const password = formData.get("password") as string;
  const firstName = (formData.get("firstName") as string)?.trim() || "";
  const lastName = (formData.get("lastName") as string)?.trim() || "";
  const phone = (formData.get("phone") as string)?.trim() || "";
  const name = (formData.get("name") as string)?.trim() || "";

  if (!email || !password) {
    return {
      success: false,
      error: "Please enter both your email and password.",
    };
  }

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
    return {
      success: false,
      error: authError.message || "Failed to create account. Please try again.",
    };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return {
      success: false,
      error: "User creation failed. Please try again.",
    };
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
    return {
      success: true,
      redirectUrl: "/account",
    };
  }

  return {
    success: true,
    redirectUrl: "/login?message=Check your email to confirm your account",
  };
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

export async function login(formData: FormData): Promise<AuthActionResult | void> {
  const rawEmail = (formData.get("email") as string) || "";
  const email = rawEmail.trim().toLowerCase();
  const password = (formData.get("password") as string) || "";
  const rawRedirect = (formData.get("redirect") as string) || "/account";
  const redirectTarget = sanitizeRedirectTarget(rawRedirect, "/account");

  if (!email || !password) {
    return {
      success: false,
      error: "Please enter both your email and password.",
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const errorMsg = error.message?.toLowerCase() || "";
    if (
      errorMsg.includes("invalid login credentials") ||
      errorMsg.includes("invalid credentials") ||
      errorMsg.includes("user not found")
    ) {
      return {
        success: false,
        error: "Invalid email or password. Please check your credentials and try again.",
      };
    }
    if (errorMsg.includes("email not confirmed")) {
      return {
        success: false,
        error: "Please verify your email address before signing in. Check your inbox for the confirmation link.",
      };
    }
    return {
      success: false,
      error: error.message || "Invalid email or password. Please check your credentials.",
    };
  }

  if (!data?.user) {
    return {
      success: false,
      error: "Unable to authenticate user. Please try again.",
    };
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
  const destination =
    role === "admin" || role === "superadmin"
      ? "/admin/dashboard"
      : redirectTarget;

  return {
    success: true,
    redirectUrl: destination,
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

