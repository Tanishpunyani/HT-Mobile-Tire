import Link from "next/link";
import { Check, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import Container from "./Container";
import SectionHeading from "./SectionHeading";

const TIERS = [
  {
    name: "Flat Tire Repair",
    tag: "Most Popular Roadside",
    price: "Custom Quote",
    unit: "on-site assessment",
    description: "Fast on-site patch & puncture repair to get you safely moving again.",
    features: [
      "Mobile service directly to your location",
      "Radial safety patch & plug vulcanization",
      "Digital PSI balance & inflation check",
      "Full rim seal & bead inspection",
      "Wheel torque to manufacturer spec",
    ],
    popular: false,
    cta: "Request Flat Repair Quote",
    href: "/booking?service=flat-tire-repair",
  },
  {
    name: "Mount & High-Speed Balance",
    tag: "Best Value",
    price: "Custom Quote",
    unit: "based on service needs",
    description: "Full tire swap on or off your rims with dynamic laser wheel balancing.",
    features: [
      "Touchless rim clamping (scratch-free)",
      "Dynamic laser high-speed balancing",
      "New rubber valve stems replacement",
      "TPMS sensor reset & calibration",
      "Eco-friendly old tire recycling",
      "Torqued with calibrated torque wrench",
    ],
    popular: true,
    cta: "Request Mount & Balance Quote",
    href: "/booking?service=swap-rim-tire",
  },
  {
    name: "Commercial & Fleet Care",
    tag: "For Businesses",
    price: "Custom Quote",
    unit: "tailored fleet quote",
    description: "Complete turnkey mobile tire fleet maintenance for vans, trucks, and company fleets.",
    features: [
      "Scheduled after-hours or weekend visits",
      "Fleet tread depth & PSI audit reports",
      "Bulk tire supply (New & Certified Used)",
      "Priority same-day emergency service",
      "Centralized corporate invoicing",
      "Dedicated account manager",
    ],
    popular: false,
    cta: "Request Fleet Quote",
    href: "/contact?service=fleet-tire-service",
  },
];

export default function PricingTable() {
  return (
    <section className="bg-background-light py-20 sm:py-24 border-b border-border">
      <Container>
        <SectionHeading
          eyebrow="Transparent Quotes"
          title="Custom Pricing, Zero Shop Markups"
          description="Every service is performed on-site at your home, workplace, or roadside with professional-grade mobile shop equipment."
          centered
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col justify-between rounded-[20px] bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                tier.popular
                  ? "border-2 border-primary ring-4 ring-primary/10"
                  : "border border-border"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-extrabold uppercase tracking-wide text-white shadow-sm flex items-center gap-1">
                  <Sparkles size={12} />
                  {tier.tag}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground">{tier.name}</h3>
                </div>

                <p className="mt-2 text-xs leading-5 text-text-secondary">{tier.description}</p>

                <div className="mt-6 flex items-baseline gap-1.5 border-b border-border pb-6">
                  <span className="text-2xl font-extrabold text-foreground">{tier.price}</span>
                  <span className="text-xs font-semibold text-text-secondary">({tier.unit})</span>
                </div>

                <ul className="mt-6 space-y-3.5">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-xs text-text-secondary">
                      <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4">
                <Link
                  href={tier.href}
                  className={`flex w-full items-center justify-center gap-2 rounded-[12px] px-6 py-3.5 text-sm font-bold transition ${
                    tier.popular
                      ? "bg-primary text-white hover:bg-primary-hover shadow-md shadow-primary/20"
                      : "border border-border bg-white text-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {tier.cta} <ArrowRight size={16} />
                </Link>

                <p className="mt-3 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1">
                  <ShieldCheck size={13} className="text-green-600" />
                  Includes touchless rim guarantee
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
