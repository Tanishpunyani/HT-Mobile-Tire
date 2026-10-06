import type { Metadata } from "next";
import Container from "../components/Container";
import ServiceCard from "../components/ServiceCard";
import BrandMarquee from "../components/BrandMarquee";
import PricingTable from "../components/PricingTable";
import FAQ from "../components/FAQ";
import ContactCTA from "../components/ContactCTA";

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
          <div className="max-w-3xl">
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