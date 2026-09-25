import Link from "next/link";
import { ArrowRight, Phone, TriangleAlert } from "lucide-react";
import Container from "./Container";
import { BUSINESS_PHONE_RAW } from "@/lib/constants/phone";

export default function EmergencyCTA() {
  return (
    <section className="bg-secondary py-16 sm:py-20">
      <Container>
        <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-secondary-light px-6 py-10 sm:px-10 lg:px-14">
          {/* Background accent */}
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-red-500/20 blur-3xl" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            {/* Content */}
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400">
                <TriangleAlert size={17} />
                Emergency Tire Service
              </div>

              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Got a Flat Tire or Tire Emergency?
              </h2>

              <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
                Don't let a tire problem leave you stranded. Request mobile
                tire service and we'll come to your location.
              </p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/emergency"
                className="group inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg"
              >
                Book Emergency Service
                <ArrowRight
                  size={18}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>

              <a
                href={`tel:${BUSINESS_PHONE_RAW}`}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/20 px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10"
              >
                <Phone size={18} />
                Call Now
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}