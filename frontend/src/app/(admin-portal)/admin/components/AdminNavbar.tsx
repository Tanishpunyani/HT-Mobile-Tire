"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  Siren,
  Users,
  Mail,
  ExternalLink,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Star,
  Bell,
} from "lucide-react";
import Container from "@/app/components/Container";

const adminNavLinks = [
  {
    name: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Bookings",
    href: "/admin/bookings",
    icon: CalendarCheck,
  },
  {
    name: "Emergency",
    href: "/admin/emergency-requests",
    icon: Siren,
  },
  {
    name: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
  },
  {
    name: "Reviews",
    href: "/admin/reviews",
    icon: Star,
  },
  {
    name: "Customers",
    href: "/admin/customers",
    icon: Users,
  },
  {
    name: "Messages",
    href: "/admin/contact-messages",
    icon: Mail,
  },
];

export default function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Do not render admin navbar on the admin login page
  if (pathname === "/admin/login") {
    return null;
  }

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
      });
      router.push("/admin/login");
      router.refresh();
    } catch (err) {
      console.error("Admin logout error:", err);
      router.push("/admin/login");
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#080d1a] shadow-lg">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
            {/* Brand Logo & Test Client Site Shortcut */}
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/admin/dashboard"
              prefetch={false}
              className="flex items-center gap-2.5 group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-extrabold shadow-md shadow-primary/30">
                HT
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-bold leading-tight text-white">
                  HT Mobile Tire
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
                  Admin Console
                </div>
              </div>
            </Link>

            {/* Direct shortcut to test public client website */}
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-primary hover:bg-primary/10 hover:text-white"
              title="Open the client-facing website in a new tab for testing"
            >
              <ExternalLink size={13} className="text-primary" />
              <span>Test Client Site</span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {adminNavLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-primary text-white shadow-sm shadow-primary/25"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  <Icon size={15} />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Action: Admin Badge & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 rounded-full bg-green-950/60 border border-green-800/60 px-2.5 py-1 text-[11px] font-semibold text-green-400">
              <ShieldCheck size={13} />
              <span>Admin Verified</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/70 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-400"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 lg:hidden"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-800 py-3 lg:hidden">
            <div className="grid grid-cols-2 gap-2">
              {adminNavLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={false}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon size={15} />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </Container>
    </header>
  );
}
