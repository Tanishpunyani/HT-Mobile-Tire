import { createClient } from "../supabase/server";
import { prisma } from "../prisma";

export async function syncAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const email = user.email;

  if (!email) {
    throw new Error("Authenticated user does not have an email address.");
  }

  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "Customer";

  const existingUser = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
  });

  if (existingUser) {
    return existingUser;
  }

  const newUser = await prisma.user.create({
    data: {
      id: user.id,
      name: fullName,
      email,
      role: "customer",
    },
  });

  return newUser;
}