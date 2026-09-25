import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Wrench,
  TriangleAlert,
} from "lucide-react";
import Container from "../../components/Container";

const features = [
  "Fast mobile flat tire repair",
  "Service at your current location",
  "Professional repair assessment",
  "Convenient roadside assistance",
  "Help getting you safely back on the road",
];

export const metadata: Metadata = {
  title: "Flat Tire Repair | HT Mobile Tires",
  description: "Fast and convenient mobile flat tire repair service. We come to your location to get you safely back on the road.",
};

export default function FlatTireRepairPage() {
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
                <Wrench size={28} />
              </div>

              <p className="text-sm font-bold uppercase tracking-wider text-primary">
                Emergency Tire Service
              </p>

              <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                Flat Tire Repair
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                Got a flat tire? Don't stay stranded. Request mobile flat tire
                service and we'll come directly to your location.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/emergency"
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg"
                >
                  <TriangleAlert size={18} />
                  Get Emergency Service
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
                           src="/images/flat_tire_repair.webp"
                           alt="Flat Tire Repair"
                           fill
                           priority
                           sizes="(max-width: 1024px) 100vw, 50vw"
                           className="object-cover"
                         />
                       
                         <div className="absolute inset-0 bg-gradient-to-t from-secondary/70 via-transparent to-transparent" />
                       
                         <div className="absolute bottom-5 left-5 right-5">
                           <p className="text-sm font-semibold text-white">
                             Flat Tire Repair
                           </p>
                       
                           <p className="mt-1 text-xs text-slate-300">
                             Mobile Flat Tire Assistance
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
                What We Offer
              </p>

              <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
                Help When You Need It Most
              </h2>

              <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary">
                A flat tire can happen at home, at work, or on the roadside.
                Instead of figuring out how to get your vehicle to a shop,
                request mobile tire service and we'll come to your location.
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

            {/* Emergency CTA */}
            <div className="h-fit rounded-[16px] border border-primary/20 bg-red-50 p-7 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-primary text-white">
                <TriangleAlert size={22} />
              </div>

              <h3 className="mt-5 text-xl font-bold text-foreground">
                Stranded With a Flat?
              </h3>

              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Request emergency flat tire service and tell us where you
                need us.
              </p>

              <Link
                href="/emergency"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-5 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:bg-primary-hover"
              >
                Request Emergency Service
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}