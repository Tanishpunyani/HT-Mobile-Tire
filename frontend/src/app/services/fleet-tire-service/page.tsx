import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Truck,
  Building2,
} from "lucide-react";
import Container from "../../components/Container";

const features = [
  "Mobile tire service for fleet vehicles",
  "Convenient service at your location",
  "Tire replacement and maintenance support",
  "Helps minimize vehicle downtime",
  "Service for commercial and business fleets",
];

export const metadata: Metadata = {
  title: "Fleet Tire Service | HT Mobile Tire",
  description: "Reliable mobile tire service for businesses. Keep your fleet vehicles moving with convenient on-site tire care.",
};

export default function FleetTireServicePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-secondary py-20 sm:py-24">
        <Container>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white"
          >
            <ArrowLeft size={17} />
            Back to Services
          </Link>

          <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[10px] bg-primary text-white">
                <Truck size={28} />
              </div>

              <p className="text-sm font-bold uppercase tracking-wider text-primary">
                Commercial Tire Service
              </p>

              <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                Fleet Tire Service
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                Keep your business vehicles moving with convenient mobile tire
                service designed for commercial and fleet customers.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/booking?service=fleet-tire-service"
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg"
                >
                  Request Fleet Service
                  <ArrowRight size={18} />
                </Link>

                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-[10px] border border-white/20 px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:bg-white/10"
                >
                  Contact Us
                </Link>
              </div>
            </div>

            {/* Visual */}
            <div className="relative h-[320px] overflow-hidden rounded-[20px] border border-white/10 bg-secondary-light sm:h-[400px]">
                          <Image
                            src="/images/fleet_tire_services.webp"
                            alt="Swap Rim Tire On/Off"
                            fill
                            priority
                            sizes="(max-width: 1024px) 100vw, 50vw"
                            className="object-cover"
                          />
                        
                          <div className="absolute inset-0 bg-gradient-to-t from-secondary/70 via-transparent to-transparent" />
                        
                          <div className="absolute bottom-5 left-5 right-5">
                            <p className="text-sm font-semibold text-white">
                              Fleet Tire Service
                            </p>
                        
                            <p className="mt-1 text-xs text-slate-300">
                              Request Fleet Service
                            </p>
                          </div>
                          </div>
          </div>
        </Container>
      </section>

      {/* Service Details */}
      <section className="bg-white py-20 sm:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-primary">
                Fleet Solutions
              </p>

              <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
                Keep Your Fleet Moving
              </h2>

              <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary">
                Vehicle downtime can affect your business. Our mobile fleet
                tire service brings tire support directly to your workplace,
                commercial location, or other agreed service location.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-start gap-3 rounded-[10px] border border-border bg-background-light p-4"
                  >
                    <CheckCircle2
                      size={20}
                      className="mt-0.5 shrink-0 text-primary"
                    />

                    <span className="text-sm font-medium text-foreground">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fleet CTA */}
            <div className="h-fit rounded-[16px] border border-border bg-background-light p-7 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-primary text-white">
                <Building2 size={22} />
              </div>

              <h3 className="mt-5 text-xl font-bold text-foreground">
                Need Fleet Tire Service?
              </h3>

              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Tell us about your fleet and your tire service needs. We'll
                help arrange convenient mobile service.
              </p>

              <Link
                href="/booking?service=fleet-tire-service"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-5 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:bg-primary-hover"
              >
                Request Fleet Service
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}