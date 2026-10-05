import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import Container from "../../components/Container";
import TireSizeServiceSection from "./TireSizeServiceSection";

const features = [

  "Quality new and used tire options",
  "Professional tire installation",
  "Convenient mobile service",
  "Tire options for different vehicle needs",
  "Service performed at your location",
];

export const metadata: Metadata = {
  title: "New and Used Tires | HT Mobile Tire",
  description: "Quality new and used tires delivered and installed at your location. Mobile tire service that comes to you.",
};

export default function NewUsedTiresPage() {
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
                <CircleDot size={28} />
              </div>

              <p className="text-sm font-bold uppercase tracking-wider text-primary">
                Tire Service
              </p>

              <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                New and Used Tires
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                Find the right tires for your vehicle and get convenient
                professional tire service brought directly to your location.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/booking?service=new-used-tires"
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg"
                >
                  Book This Service
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
    src="/images/mobile-van-service.webp"
    alt="New and used tires"
    fill
    priority
    sizes="(max-width: 1024px) 100vw, 50vw"
    className="object-cover"
  />

  <div className="absolute inset-0 bg-gradient-to-t from-secondary/70 via-transparent to-transparent" />

  <div className="absolute bottom-5 left-5 right-5">
    <p className="text-sm font-semibold text-white">
      New & Used Tire Service
    </p>

    <p className="mt-1 text-xs text-slate-300">
      Quality tire options with convenient mobile service.
    </p>
  </div>
</div>
          </div>
        </Container>
      </section>

      {/* Interactive Tire Size Visual Finder */}
      <TireSizeServiceSection />

      {/* Service Details */}

      <section className="bg-white py-20 sm:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-primary">
                What We Offer
              </p>

              <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
                Convenient Tire Service at Your Location
              </h2>

              <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary">
                Whether you need replacement tires or are looking for a
                quality used option, our mobile tire service makes the process
                more convenient by bringing the service directly to you.
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

            {/* CTA Card */}
            <div className="h-fit rounded-[16px] border border-border bg-background-light p-7 shadow-sm">
              <h3 className="text-xl font-bold text-foreground">
                Need New or Used Tires?
              </h3>

              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Tell us what you need and we'll help you arrange convenient
                mobile tire service.
              </p>

              <Link
                href="/booking?service=new-used-tires"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-5 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:bg-primary-hover"
              >
                Book a Service
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}