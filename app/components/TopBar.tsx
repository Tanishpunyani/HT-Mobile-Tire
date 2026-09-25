"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, Siren, ShieldCheck } from "lucide-react";
import Container from "./Container";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";

export default function TopBar() {
  const pathname = usePathname();

  // Do not render client TopBar on admin dashboard, admin pages, or technician portal
  if (pathname.startsWith("/admin") || pathname.startsWith("/technician")) {
    return null;
  }

  return (
    <div className="border-b border-white/10 bg-[#0a0f1d] py-2 text-xs text-slate-300">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Emergency Alert Tag */}
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="font-semibold text-white">24/7 Mobile Tire Van Dispatch:</span>
            <span className="hidden sm:inline text-slate-400">Average response 30–45 mins</span>
          </div>

          {/* Quick Contact & Action */}
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-1.5 md:flex text-slate-300">
              <ShieldCheck size={14} className="text-primary" />
              <span>Licensed, Insured & ASE Certified</span>
            </div>

            <a
              href={`tel:${BUSINESS_PHONE_RAW}`}
              className="flex items-center gap-1.5 font-bold text-white transition hover:text-primary"
            >
              <Phone size={13} className="text-primary" />
              <span>{BUSINESS_PHONE_DISPLAY}</span>
            </a>

            <Link
              href="/emergency"
              className="inline-flex items-center gap-1 rounded-md bg-red-600/90 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white transition hover:bg-red-600"
            >
              <Siren size={12} />
              Roadside Help
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
