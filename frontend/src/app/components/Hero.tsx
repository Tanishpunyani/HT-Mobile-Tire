import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3, Phone, ShieldCheck, Zap } from "lucide-react";
import Container from "./Container";
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_TEL } from "@/lib/constants/phone";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-secondary">
      <Container>
        <div className="grid min-h-[650px] items-center gap-12 py-16 lg:grid-cols-2 lg:py-20">
          {/* Hero Content */}
          <div className="relative z-10 max-w-2xl">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary">
                <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                MOBILE TIRE SERVICE
              </div>
            </div>


            <h1 className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-5xl font-extrabold leading-[1.05] tracking-tight text-transparent sm:text-6xl lg:text-7xl">
              WE COME
              <span className="block text-primary">TO YOU.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
              Professional tire service wherever you need us. Fast,
              reliable, and convenient service brought directly to your
              location.
            </p>

            {/* CTA Hierarchy: Primary (Book Now) -> Secondary (Emergency) -> Lower (Call Now) */}
            <div className="mt-8 flex flex-col gap-3.5">
              <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center">
                <Link
                  href="/booking"
                  className="group inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl sm:text-base"
                >
                  Book a Service
                  <ArrowRight
                    size={18}
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  />
                </Link>

                <Link
                  href="/emergency"
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  <Zap size={18} className="text-primary" />
                  Emergency Service
                </Link>
              </div>

              <div>
                <a
                  href={BUSINESS_PHONE_TEL}
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10 hover:text-white"
                >
                  <Phone size={16} className="text-primary" />
                  <span>Call Now: {BUSINESS_PHONE_DISPLAY}</span>
                </a>
              </div>
            </div>

            {/* Trust Points */}
            <div className="mt-10 grid gap-4 border-t border-white/10 pt-7 sm:grid-cols-3">
              <div className="flex items-center gap-3">
                <Clock3 size={20} className="shrink-0 text-primary" />
                <span className="text-sm font-medium text-slate-300">
                  Fast Response
                </span>
              </div>

              <div className="flex items-center gap-3">
                <ShieldCheck size={20} className="shrink-0 text-primary" />
                <span className="text-sm font-medium text-slate-300">
                  Professional
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Zap size={20} className="shrink-0 text-primary" />
                <span className="text-sm font-medium text-slate-300">
                  Mobile Service
                </span>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative flex min-h-[350px] items-center justify-center lg:min-h-[500px]">
            <div className="absolute h-72 w-72 rounded-full bg-primary/20 blur-3xl sm:h-96 sm:w-96" />

            <div className="relative h-[350px] w-full overflow-hidden rounded-[20px] border border-white/10 bg-secondary-light shadow-lg sm:h-[450px]">
              <Image

                src="/images/hero-mobile-tire-clinic.webp"
                alt="HT Mobile Tire technician providing professional tire service"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-secondary/70 via-transparent to-transparent" />

              <div className="absolute bottom-5 left-5 right-5 rounded-[10px] border border-white/10 bg-secondary/80 p-4 backdrop-blur-md">
                <p className="text-sm font-semibold text-white">
                  Tire service at your location
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Convenient mobile service when you need it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}