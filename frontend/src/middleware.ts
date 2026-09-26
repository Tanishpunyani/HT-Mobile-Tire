import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  validateAdminCookieEdge,
  ADMIN_SESSION_COOKIE_NAME,
} from "@/lib/auth/admin-cookie";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Admin Page Routes (/admin/*)
  if (pathname.startsWith("/admin")) {
    // /admin/login is publicly accessible for entering credentials
    if (pathname === "/admin/login") {
      const { supabaseResponse } = await updateSession(request);
      return supabaseResponse;
    }

    // Require valid, cryptographically signed, unexpired admin session cookie
    const adminSessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    const cookieCheck = await validateAdminCookieEdge(adminSessionCookie);

    if (!cookieCheck.valid) {
      return Response.redirect(new URL("/admin/login", request.url));
    }
  }

  // 2. Admin API Routes (/api/admin/*) pass through directly to handlers
  if (pathname.startsWith("/api/admin")) {
    const { supabaseResponse } = await updateSession(request);
    return supabaseResponse;
  }

  // 3. Customer & Public Pages: Supabase session update
  const { supabaseResponse, user } = await updateSession(request);

  // 4. Protect customer-only routes (/account)
  // Possession of an admin cookie never authenticates as a customer
  if (pathname.startsWith("/account")) {
    if (!user) {
      return Response.redirect(new URL("/login?redirect=/account", request.url));
    }
  }

  return supabaseResponse;
}

export default middleware;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
