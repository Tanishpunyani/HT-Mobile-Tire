import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import Container from "../components/Container";
import SectionHeading from "../components/SectionHeading";

const values = [
  {
    icon: ShieldCheck,
    title: "Professionalism",
    description:
      "We approach every service with care, attention to detail, and a focus on doing the job properly.",
  },
  {
    icon: Clock3,
    title: "Reliability",
    description:
      "We understand that tire problems can interrupt your day, so we focus on convenient and dependable service.",
  },
  {
    icon: Users,
    title: "Customer-Focused",
    description:
      "Our goal is to make tire service easier by working around your location and your needs.",
  },
];

const process = [
  "Tell us what tire service you need.",
  "Provide your location and preferred service details.",
  "Our mobile service comes directly to you.",
  "We complete the service and help get you back on the road.",
];

export const metadata: Metadata = {
  title: "About Us | HT Mobile Tire",
  description:
    "Learn about HT Mobile Tire — professional mobile tire services brought directly to your location for your convenience.",
};

export default function AboutPage() {
  return (
    <div>
      {/* Page Hero */}
      <section className="bg-secondary py-20 sm:py-24">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-wider text-primary">
              About HT Mobile Tire
            </p>

            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Professional Tire Service That Comes to You.
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-300">
              HT Mobile Tire is built around a simple idea: tire service
              should be convenient. Instead of making you drive to a shop,
              our mobile approach brings tire service directly to your
              location.
            </p>
          </div>
        </Container>
      </section>

      {/* Business Introduction */}
      <section className="bg-white py-20 sm:py-24">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-primary">
                Who We Are
              </p>

              <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
                Tire Service Built Around Your Convenience
              </h2>

              <p className="mt-5 text-base leading-7 text-text-secondary">
                HT Mobile Tire provides mobile tire services designed to
                make tire care easier for individuals and businesses. Whether
                you need new or used tires, wheel balancing, tire mounting,
                flat tire repair, or fleet tire service, we bring the service
                to you.
              </p>

              <p className="mt-4 text-base leading-7 text-text-secondary">
                Our customer-focused approach means less unnecessary travel,
                less waiting around at a shop, and a simpler way to take care
                of your tire needs.
              </p>
            </div>

            <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-[20px] bg-secondary p-8">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />

              <div className="relative text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                  <Wrench size={42} strokeWidth={1.5} />
                </div>

                <h3 className="mt-6 text-2xl font-bold text-white">
                  We Come to You
                </h3>

                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-300">
                  Professional mobile tire service at your home, workplace,
                  roadside location, or other service location.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Why We Exist */}
      <section className="bg-background-light py-20 sm:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="order-2 lg:order-1">
              <div className="rounded-[20px] border border-border bg-white p-8 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-red-50 text-primary">
                    <MapPin size={22} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Mobile Service
                    </p>
                    <p className="text-xs text-text-secondary">
                      Service where you need it
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-5">
                  {process.map((item, index) => (
                    <div key={item} className="flex items-start gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                        {index + 1}
                      </div>

                      <p className="pt-1 text-sm leading-6 text-text-secondary">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <p className="text-sm font-bold uppercase tracking-wider text-primary">
                Why We Exist
              </p>

              <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
                Making Tire Service Easier
              </h2>

              <p className="mt-5 text-base leading-7 text-text-secondary">
                A tire problem can happen at the worst possible time. You may
                be at home, at work, or stuck somewhere on the road. Getting
                your vehicle to a tire shop isn&apos;t always convenient.
              </p>

              <p className="mt-4 text-base leading-7 text-text-secondary">
                That&apos;s why HT Mobile Tire is built around a mobile-first
                service model. You tell us where you are and what you need,
                and we bring the tire service to you.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Our Values */}
      <section className="bg-white py-20 sm:py-24">
        <Container>
          <SectionHeading
            eyebrow="Our Approach"
            title="Professional, Reliable, Customer-Focused"
            description="Every part of our service is designed around making your tire service experience easier and more convenient."
            centered
          />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {values.map((value) => {
              const Icon = value.icon;

              return (
                <div
                  key={value.title}
                  className="rounded-[16px] border border-border bg-white p-7 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[10px] bg-red-50 text-primary">
                    <Icon size={27} strokeWidth={1.8} />
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-foreground">
                    {value.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-text-secondary">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section className="bg-secondary py-16 sm:py-20">
        <Container>
          <div className="flex flex-col gap-7 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-primary">
                Need Tire Service?
              </p>

              <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                Let Us Come to You.
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Choose the service you need and arrange convenient mobile tire
                service at your location.
              </p>
            </div>

            <Link
              href="/services"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg"
            >
              Explore Our Services
              <ArrowRight size={18} />
            </Link>
          </div>
        </Container>
      </section>
    </div>
  );
}