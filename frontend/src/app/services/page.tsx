import type { Metadata } from "next";
import { Phone } from "lucide-react";
import Container from "../components/Container";
import ServiceCard from "../components/ServiceCard";
import BrandMarquee from "../components/BrandMarquee";
import PricingTable from "../components/PricingTable";
import FAQ from "../components/FAQ";
import ContactCTA from "../components/ContactCTA";
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_TEL } from "@/lib/constants/phone";

const services = [
  {
    title: "New and Used Tires",
    description:
      "Choose quality new and certified used tires with convenient mobile delivery, mounting, and balancing right in your driveway.",
    icon: "tires" as const,
    href: "/services/new-used-tires",
  },
  {
    title: "Swap Rim Tire On/Off",
    description:
      "Professional seasonal tire removal and installation for changing winter/summer tires on or off your rims.",
    icon: "swap" as const,
    href: "/services/swap-rim-tire",
  },
  {
    title: "Wheel Balancing",
    description:
      "Eliminate highway vibration and extend tire lifespan with computerized dynamic laser wheel balancing.",
    icon: "balancing" as const,
    href: "/services/wheel-balancing",
  },
  {
    title: "Flat Tire Repair",
    description:
      "Rapid roadside and on-site radial puncture repair & vulcanization to get you safely back on the road.",
    icon: "repair" as const,
    href: "/services/flat-tire-repair",
  },
  {
    title: "Fleet Tire Service",
    description:
      "Turnkey mobile tire management and scheduled maintenance for commercial delivery vans, trucks, and business fleets.",
    icon: "fleet" as const,
    href: "/services/fleet-tire-service",
  },
];

export const metadata: Metadata = {
  title: "Professional Mobile Tire Services",
  description:
    "Explore our complete range of mobile tire services: new & used tire installation, seasonal rim swap, laser wheel balancing, emergency puncture repair, and commercial fleet maintenance.",
};

export default function ServicesPage() {
  return (
    <div>
      {/* Page Header */}
      <section className="bg-secondary py-20 sm:py-24 border-b border-white/10">
        <Container>
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Full-Service Mobile Shop
              </p>

              <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Professional Tire Services That Come to You.
              </h1>

              <p className="mt-6 text-base leading-8 text-slate-300 sm:text-lg">
                From new tire replacement and seasonal wheel swaps to emergency flat repairs, our fully equipped mobile service vans handle everything at your home, office, or roadside.
              </p>
            </div>

            {/* Call Now Hero CTA */}
            <div className="shrink-0 lg:max-w-xs w-full">
              <div className="rounded-[20px] border border-white/15 bg-white/5 p-6 backdrop-blur-sm sm:p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30">
                  <Phone size={20} />
                </div>
                <h3 className="mt-4 text-base font-bold text-white">
                  Need Help or Have Questions?
                </h3>
                <p className="mt-1 text-2xl font-extrabold text-white tracking-tight">
                  {BUSINESS_PHONE_DISPLAY}
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  Call our service team directly for immediate assistance or questions.
                </p>
                <a
                  href={BUSINESS_PHONE_TEL}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-5 py-3 text-sm font-bold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover active:scale-95"
                >
                  <Phone size={16} />
                  <span>Call Now</span>
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <BrandMarquee />

      {/* Services Grid */}
      <section className="bg-white py-20 sm:py-24">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <ServiceCard
                key={service.title}
                title={service.title}
                description={service.description}
                icon={service.icon}
                href={service.href}
              />
            ))}
          </div>
        </Container>
      </section>

      <PricingTable />
      <FAQ />
      <ContactCTA />
    </div>
  );
}