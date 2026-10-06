import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  Clock3,
  ArrowRight,
  ShieldCheck,
  Zap,
  Phone,
  Siren,
  Sparkles,
} from "lucide-react";
import Container from "@/app/components/Container";
import { getAllCities } from "@/lib/cities";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_TEL } from "@/lib/constants/phone";

export const metadata: Metadata = {
  title: "Service Areas | HT Mobile Tire",
  description: "Explore our mobile tire service coverage areas across Brampton, Toronto, Mississauga, Etobicoke, North York, Vaughan, Woodbridge, Milton, and Georgetown.",
  alternates: {
    canonical: "https://mobiletire.clinic/service-areas",
  },
};

export default function ServiceAreasPage() {
  const cities = getAllCities();

  return (
    <div className="bg-background-light">
      {/* Header */}
      <section className="bg-secondary py-20 sm:py-24 border-b border-white/10 text-white">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3.5 py-1 text-xs font-bold text-primary border border-primary/30">
              <Sparkles size={14} />
              Ontario Service Coverage
            </div>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Our Mobile Tire Service Areas
            </h1>

            <p className="mt-6 text-base leading-8 text-slate-300 sm:text-lg">
              We bring professional tire repair, mounting, and balancing directly to your vehicle across our confirmed service locations.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={BUSINESS_PHONE_TEL}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg"
              >
                <Phone size={18} />
                <span>Call Now: {BUSINESS_PHONE_DISPLAY}</span>
              </a>
            </div>
          </div>
        </Container>
      </section>

      {/* City Directory Grid */}
      <section className="py-20 sm:py-24">
        <Container>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <div
                key={city.slug}
                className="group flex flex-col justify-between rounded-[24px] border border-border bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary hover:shadow-xl"
              >
                <div>
                  {/* City Title & Pill */}
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h2 className="text-2xl font-extrabold text-foreground group-hover:text-primary transition">
                        {city.name}, {city.state}
                      </h2>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        Dedicated Mobile Service
                      </p>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <MapPin size={20} />
                    </div>
                  </div>

                  {/* Highlights */}
                  <div className="mt-5 space-y-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock3 size={15} className="text-primary shrink-0" />
                      <span>Service: <strong>{city.averageResponseTime}</strong></span>
                    </div>

                    <div className="flex items-start gap-2">
                      <ShieldCheck size={15} className="text-green-600 shrink-0 mt-0.5" />
                      <span>Direct On-Site Van Service</span>
                    </div>
                  </div>

                  {/* Highlights list */}
                  <div className="mt-5 space-y-1.5 text-xs text-slate-500">
                    {city.serviceHighlights.slice(0, 2).map((highlight, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="text-primary">•</span>
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* City Link Button */}
                <div className="mt-8 pt-4 border-t border-border">
                  <Link
                    href={`/service-area/${city.slug}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-xs font-bold text-white transition-all group-hover:bg-primary"
                  >
                    <span>View {city.name} City Page</span>
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Emergency Bottom Banner */}
          <div className="mt-16 rounded-[24px] border border-primary/20 bg-secondary p-8 text-white sm:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-red-600/30 px-3 py-1 text-xs font-bold text-red-400 border border-red-500/40">
                  <Siren size={13} />
                  Roadside Assistance
                </div>
                <h3 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
                  Need Mobile Tire Assistance Right Now?
                </h3>
                <p className="mt-2 text-sm text-slate-300 max-w-xl">
                  Our mobile tire vans bring jacks, replacement tires, and computerized balancing tools directly to your vehicle.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/emergency"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-red-700"
                >
                  <Siren size={16} />
                  Request Emergency Help
                </Link>
                <a
                  href={`tel:${BUSINESS_PHONE_RAW}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-3.5 text-sm font-bold text-white hover:bg-white/10"
                >
                  <Phone size={16} />
                  Call {BUSINESS_PHONE_DISPLAY}
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
