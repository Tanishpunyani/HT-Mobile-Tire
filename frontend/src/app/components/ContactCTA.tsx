import Link from "next/link";
import { ArrowRight, Mail, Phone } from "lucide-react";
import Container from "./Container";
import { BUSINESS_PHONE_RAW } from "@/lib/constants/phone";

export default function ContactCTA() {
  return (
    <section className="bg-background-light py-20 sm:py-24">
      <Container>
        <div className="overflow-hidden rounded-[20px] bg-gradient-to-r from-secondary to-secondary-light px-6 py-12 sm:px-10 lg:px-14">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            {/* Content */}
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-wider text-white/80">
                Need Tire Service?
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Let's Get You Back on the Road.
              </h2>

              <p className="mt-4 text-base leading-7 text-white/85 sm:text-lg">
                Contact HT Mobile Tire today and get professional tire
                service brought directly to your location.
              </p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/booking"
                className="group inline-flex items-center justify-center gap-2 rounded-[10px] bg-white px-6 py-3.5 text-sm font-bold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-lg"
              >
                Book a Service
                <ArrowRight
                  size={18}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>

              <a
                href={`tel:${BUSINESS_PHONE_RAW}`}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/30 px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10"
              >
                <Phone size={18} />
                Call Us
              </a>

              <a
                href="mailto:dispatch@mobiletire.clinic"
                className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/30 px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10"
              >
                <Mail size={18} />
                Email Us
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}