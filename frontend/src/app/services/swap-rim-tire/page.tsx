import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Disc3,
  Phone,
} from "lucide-react";
import Container from "../../components/Container";
import { BUSINESS_PHONE_TEL } from "@/lib/constants/phone";

const features = [
  "Professional tire removal from rims",
  "Tire installation onto rims",
  "Convenient mobile service",
  "Proper tire mounting procedures",
  "Service performed at your location",
];

export const metadata: Metadata = {
  title: "Swap Rim Tire On/Off | HT Mobile Tire",
  description: "Professional tire removal and installation service. We swap tires on and off your rims at your location.",
};

export default function SwapRimTirePage() {
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
                <Disc3 size={28} />
              </div>

              <p className="text-sm font-bold uppercase tracking-wider text-primary">
                Tire Service
              </p>

              <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                Swap Rim Tire On/Off
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                Need a tire removed from a rim or mounted onto one? We bring
                professional tire mounting service directly to your location.
              </p>

              <div className="mt-8 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/booking?service=swap-rim-tire"
                    className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg"
                  >
                    Book This Service
                    <ArrowRight size={18} />
                  </Link>

                  <a
                    href={BUSINESS_PHONE_TEL}
                    className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/20 px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:bg-white/10"
                  >
                    <Phone size={18} className="text-primary" />
                    Call Now
                  </a>
                </div>

                <p className="text-xs font-medium text-slate-300">
                  Call Now for Direct Service
                </p>
              </div>
            </div>

            {/* Visual */}
            <div className="relative h-[320px] overflow-hidden rounded-[20px] border border-white/10 bg-secondary-light sm:h-[400px]">
              <Image
                src="/images/Swap_Tire_rim_ON_OFF.webp"
                alt="Swap Rim Tire On/Off"
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

      {/* Service Details */}
      <section className="bg-white py-20 sm:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-primary">
                What We Offer
              </p>

              <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
                Professional Tire Mounting Service
              </h2>

              <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary">
                Whether you're changing tires seasonally or need a tire
                installed on a different rim, our mobile service makes tire
                mounting and removal more convenient.
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
                Need a Tire Swapped?
              </h3>

              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Book our mobile tire mounting and removal service and let us
                come to you.
              </p>

              <Link
                href="/booking?service=swap-rim-tire"
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