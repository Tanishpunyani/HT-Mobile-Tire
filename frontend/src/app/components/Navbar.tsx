"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Phone, Siren, User } from "lucide-react";
import Container from "./Container";
import Button from "./Button";
import UserMenu from "./UserMenu";
import { useAuth } from "@/lib/auth/auth-context";
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_TEL } from "@/lib/constants/phone";

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Services", href: "/services" },
  { name: "Service Areas", href: "/service-areas" },
  { name: "About", href: "/about" },
  { name: "Emergency", href: "/emergency" },
  { name: "Contact", href: "/contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isCustomerUser, loading: authLoading } = useAuth();

  // Hide client navbar on admin and technician routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/technician")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-secondary/95 backdrop-blur">
      <Container>
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-3"
            onClick={() => setMenuOpen(false)}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-primary text-white shadow-sm shadow-primary/30">
              <span className="text-lg font-extrabold tracking-wider">HT</span>
            </div>

            <div>
              <div className="text-lg font-extrabold leading-tight text-white tracking-tight">
                HT Mobile
              </div>

              <div className="text-xs font-bold uppercase tracking-widest text-primary">
                Tire
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`text-sm font-medium transition-colors hover:text-white ${
                    isActive ? "text-white font-semibold underline underline-offset-4" : ""
                  } ${
                    link.name === "Emergency"
                      ? "flex items-center gap-1.5 font-bold text-red-400 hover:text-red-300"
                      : "text-slate-300"
                  }`}
                >
                  {link.name === "Emergency" && <Siren size={14} />}
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-4 md:flex min-h-[40px]">
            <a
              href={BUSINESS_PHONE_TEL}
              className="flex items-center gap-2 text-sm font-semibold text-slate-200 transition-colors hover:text-primary mr-2"
            >
              <Phone size={16} className="text-primary" />
              {BUSINESS_PHONE_DISPLAY}
            </a>

            {/* Auth section renders only when auth state is confirmed (no flash) */}
            {!authLoading && (
              <>
                {isCustomerUser ? (
                  <UserMenu />
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="text-sm font-semibold text-slate-300 transition-colors hover:text-white"
                    >
                      Sign In
                    </Link>

                    <Button href="/booking">
                      Book a Service
                    </Button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Mobile Actions: Call Now + Profile + Hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            {/* Mobile Call Now CTA */}
            <a
              href={BUSINESS_PHONE_TEL}
              className="flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Call HT Mobile Tire"
            >
              <Phone size={14} className="shrink-0" />
              <span>Call</span>
            </a>

            {authLoading ? (
              <div
                className="h-9 w-9 rounded-full bg-white/10 animate-pulse"
                aria-hidden="true"
              />
            ) : isCustomerUser ? (
              <UserMenu />
            ) : (
              <Link
                href="/login"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="Sign In"
              >
                <User size={18} />
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-[10px] text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div className="border-t border-white/10 py-5 md:hidden">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-2 rounded-[10px] px-4 py-3 text-sm font-medium transition ${
                      isActive ? "bg-white/10 text-white font-bold" : ""
                    } ${
                      link.name === "Emergency"
                        ? "text-red-400 font-bold bg-red-950/30"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {link.name === "Emergency" && <Siren size={16} />}
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 border-t border-white/10 pt-4">
              <a
                href={BUSINESS_PHONE_TEL}
                className="mb-3 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white"
              >
                <Phone size={17} className="text-primary" />
                {BUSINESS_PHONE_DISPLAY}
              </a>

              {!authLoading && (
                <div className="flex flex-col gap-3 px-4">
                  {isCustomerUser ? (
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        My Account
                      </span>
                      <UserMenu onItemClick={() => setMenuOpen(false)} />
                    </div>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        onClick={() => setMenuOpen(false)}
                        className="rounded-[10px] border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10"
                      >
                        Sign In
                      </Link>

                      <Button href="/booking">
                        Book a Service
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Container>
    </header>
  );
}