"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, MapPin, Clock, ShieldCheck, Mail, Siren } from "lucide-react";
import Container from "./Container";
import { SERVICE_NAMES } from "@/lib/constants/services";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";

export default function Footer() {
  const pathname = usePathname();

  // Do not render client Footer on admin dashboard, admin pages, or technician portal
  if (pathname.startsWith("/admin") || pathname.startsWith("/technician")) {
    return null;
  }

  return (
    <footer className="bg-[#0b101f] text-white border-t border-white/10">
      <Container>
        <div className="grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand & Mission */}
          <div>
            <Link href="/" className="inline-block">
              <div className="text-xl font-extrabold tracking-tight">
                HT Mobile <span className="text-primary">Tire</span>
              </div>
            </Link>

            <p className="mt-4 text-xs leading-6 text-slate-300 sm:text-sm">
              Professional mobile tire installation, puncture repair, and roadside assistance dispatched directly to your home, office, or roadside location.
            </p>

            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-slate-300">
              <ShieldCheck size={16} className="text-primary" />
              <span>Licensed & Insured Mobile Technicians</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary">
              Navigation
            </h3>

            <nav className="mt-4 flex flex-col gap-2.5">
              <Link href="/" className="text-sm text-slate-300 hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/services" className="text-sm text-slate-300 hover:text-white transition-colors">
                All Services
              </Link>
              <Link href="/booking" className="text-sm text-slate-300 hover:text-white transition-colors">
                Book an Appointment
              </Link>
              <Link href="/emergency" className="flex items-center gap-1.5 text-sm font-semibold text-red-400 hover:text-red-300 transition-colors">
                <Siren size={14} />
                Emergency Roadside
              </Link>
              <Link href="/about" className="text-sm text-slate-300 hover:text-white transition-colors">
                About Our Clinic
              </Link>
              <Link href="/contact" className="text-sm text-slate-300 hover:text-white transition-colors">
                Contact & Support
              </Link>
              <Link href="/account" className="text-sm text-slate-300 hover:text-white transition-colors">
                Customer Portal
              </Link>
            </nav>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary">
              Tire Services
            </h3>

            <div className="mt-4 flex flex-col gap-2.5">
              {SERVICE_NAMES.map((service) => {
                const serviceSlugMap: Record<string, string> = {
                  "New and Used Tires": "/services/new-used-tires",
                  "Swap Rim Tire On/Off": "/services/swap-rim-tire",
                  "Wheel Balancing": "/services/wheel-balancing",
                  "Flat Tire Repair": "/services/flat-tire-repair",
                  "Fleet Tire Service": "/services/fleet-tire-service",
                };
                const href = serviceSlugMap[service] || "/services";

                return (
                  <Link
                    key={service}
                    href={href}
                    className="text-sm text-slate-300 hover:text-white transition-colors"
                  >
                    {service}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Contact & Hours */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary">
              Contact & Dispatch
            </h3>

            <div className="mt-4 flex flex-col gap-3.5 text-xs sm:text-sm">
              <a
                href={`tel:${BUSINESS_PHONE_RAW}`}
                className="flex items-center gap-2.5 font-bold text-white transition hover:text-primary"
              >
                <Phone size={16} className="text-primary shrink-0" />
                <span>{BUSINESS_PHONE_DISPLAY}</span>
              </a>

              <a
                href="mailto:dispatch@mobiletire.clinic"
                className="flex items-center gap-2.5 text-slate-300 transition hover:text-white"
              >
                <Mail size={16} className="text-primary shrink-0" />
                <span>dispatch@mobiletire.clinic</span>
              </a>

              <div className="flex items-start gap-2.5 text-slate-300">
                <MapPin size={16} className="mt-0.5 text-primary shrink-0" />
                <span>Mobile Vans Dispatched Directly To Your Address</span>
              </div>

              <div className="flex items-start gap-2.5 text-slate-300">
                <Clock size={16} className="mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-white">Hours:</p>
                  <p className="text-xs text-slate-400">24/7 Roadside Emergencies</p>
                  <p className="text-xs text-slate-400">Scheduled: Mon–Sat 7AM–8PM</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Service Areas Local SEO Links Bar */}

        <div className="border-t border-white/10 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Primary Service Cities:
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-300">
              <Link href="/service-area/brampton" className="hover:text-primary transition">Brampton, ON</Link>
              <span className="text-slate-600">•</span>
              <Link href="/service-area/toronto" className="hover:text-primary transition">Toronto, ON</Link>
              <span className="text-slate-600">•</span>
              <Link href="/service-area/mississauga" className="hover:text-primary transition">Mississauga, ON</Link>
              <span className="text-slate-600">•</span>
              <Link href="/service-area/etobicoke" className="hover:text-primary transition">Etobicoke, ON</Link>
              <span className="text-slate-600">•</span>
              <Link href="/service-area/north-york" className="hover:text-primary transition">North York, ON</Link>
              <span className="text-slate-600">•</span>
              <Link href="/service-area/vaughan" className="hover:text-primary transition">Vaughan, ON</Link>
              <span className="text-slate-600">•</span>
              <Link href="/service-area/woodbridge" className="hover:text-primary transition">Woodbridge, ON</Link>
              <span className="text-slate-600">•</span>
              <Link href="/service-area/milton" className="hover:text-primary transition">Milton, ON</Link>
              <span className="text-slate-600">•</span>
              <Link href="/service-area/georgetown" className="hover:text-primary transition">Georgetown, ON</Link>
              <span className="text-slate-600">•</span>
              <Link href="/service-areas" className="font-bold text-primary hover:underline">View All Service Areas →</Link>
            </div>
          </div>
        </div>

        {/* Bottom Legal & Copyright */}
        <div className="flex flex-col gap-4 border-t border-white/10 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} HT Mobile Tire. All rights reserved.</p>

          <div className="flex flex-wrap items-center gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              Support
            </Link>
            <span>Touchless Rim Guarantee</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}