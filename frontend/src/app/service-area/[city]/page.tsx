import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  Clock3,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Phone,
  Siren,
  ChevronRight,
  Disc,
  HelpCircle,
} from "lucide-react";
import Container from "@/app/components/Container";
import Testimonials from "@/app/components/Testimonials";
import { getAllCities, getCityBySlug, getAllCitySlugs } from "@/lib/cities";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";

interface CityPageProps {
  params: Promise<{
    city: string;
  }>;
}

export async function generateStaticParams() {
  const slugs = getAllCitySlugs();
  return slugs.map((city) => ({ city }));
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const city = getCityBySlug(resolvedParams.city);

  if (!city) {
    return {
      title: "Service Area Not Found | HT Mobile Tire",
      description: "Mobile tire repair and installation at your location.",
    };
  }

  const title = `${city.headline} | HT Mobile Tire`;
  const description = city.metaDescription;
  const canonicalUrl = `https://mobiletire.clinic/service-area/${city.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "HT Mobile Tire",
      locale: "en_CA",
      type: "website",
      images: [
        {
          url: "/images/hero-mobile-tire-clinic.webp",
          width: 1200,
          height: 630,
          alt: `HT Mobile Tire servicing ${city.name}, ON`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/hero-mobile-tire-clinic.webp"],
    },
  };
}

export default async function CityLandingPage({ params }: CityPageProps) {
  const resolvedParams = await params;
  const city = getCityBySlug(resolvedParams.city);

  if (!city) {
    notFound();
  }

  const allCities = getAllCities();
  const otherCities = allCities.filter((c) => c.slug !== city.slug);

  const localServices = [
    {
      name: "Flat Tire Repair & Puncture Patch",
      price: "Custom Quote",
      description: `Full radial patch and bead leak repair at your ${city.name} location.`,
      slug: "flat-tire-repair",
    },
    {
      name: "Swap Rim Tire & Wheel Balancing",
      price: "Custom Quote",
      description: `Seasonal tire and rim mounting with computerized wheel balancing on-site.`,
      slug: "swap-rim-tire",
    },
    {
      name: "New and Quality Used Tires",
      price: "Custom Quote",
      description: `Top brand new and inspected pre-owned tires delivered & installed.`,
      slug: "new-used-tires",
    },
    {
      name: "Computerized Wheel Balancing",
      price: "Custom Quote",
      description: `Eliminate highway steering wheel vibration with mobile computerized balancing in ${city.name}.`,
      slug: "wheel-balancing",
    },
    {
      name: "Emergency Roadside Tire Service",
      price: "On-Site Assessment",
      description: `Fast roadside help for punctures, damaged rims, and spare tire installations.`,
      slug: "emergency",
      isEmergency: true,
    },
  ];

  // LocalBusiness / AutoRepair JSON-LD Structured Schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    name: `HT Mobile Tire - ${city.name}`,
    image: "https://mobiletire.clinic/images/hero-mobile-tire-clinic.webp",
    "@id": `https://mobiletire.clinic/service-area/${city.slug}`,
    url: `https://mobiletire.clinic/service-area/${city.slug}`,
    telephone: BUSINESS_PHONE_RAW,
    priceRange: "$$",
    description: city.metaDescription,
    address: {
      "@type": "PostalAddress",
      addressLocality: city.name,
      addressRegion: city.state,
      addressCountry: "CA",
    },
    areaServed: {
      "@type": "City",
      name: `${city.name}, ${city.state}`,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "00:00",
        closes: "23:59",
      },
    ],
  };

  return (
    <div className="bg-background-light">
      {/* Schema Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb & Hero */}
      <section className="relative overflow-hidden bg-secondary py-16 sm:py-24 border-b border-white/10 text-white">
        <Container>
          {/* Breadcrumbs */}
          <nav className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Link href="/" className="hover:text-white transition">
              Home
            </Link>
            <ChevronRight size={13} className="text-slate-500" />
            <Link href="/service-areas" className="hover:text-white transition">
              Service Areas
            </Link>
            <ChevronRight size={13} className="text-slate-500" />
            <span className="text-primary font-bold">{city.name}, {city.state}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8">
              {/* Response Time Pill */}
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-4 py-1.5 text-xs font-bold text-primary backdrop-blur-md">
                <Clock3 size={14} />
                <span>⚡ {city.name} Mobile Service: <strong>{city.averageResponseTime}</strong></span>
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.1]">
                {city.headline}
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                {city.subheadline} No waiting at tire shops — our fully equipped mobile service vans come directly to you in <strong>{city.name}</strong>.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
                <Link
                  href={`/booking?location=${encodeURIComponent(`${city.name}, ${city.state}`)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-4 text-sm font-bold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5 hover:bg-primary-hover"
                >
                  <span>Book in {city.name}</span>
                  <ArrowRight size={17} />
                </Link>

                <Link
                  href={`/emergency?location=${encodeURIComponent(`${city.name}, ${city.state}`)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-950/40 px-6 py-4 text-sm font-bold text-red-400 backdrop-blur-sm transition hover:bg-red-900/60 hover:text-white"
                >
                  <Siren size={17} className="text-red-400" />
                  <span>Roadside Emergency</span>
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-white/10 pt-6 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck size={16} className="text-primary" />
                  Touchless Rim Care
                </span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Zap size={16} className="text-primary" />
                  On-Site Driveway Service
                </span>
              </div>
            </div>

            {/* Quick Dispatch Card */}
            <div className="lg:col-span-4">
              <div className="rounded-[24px] border border-white/15 bg-slate-900/90 p-7 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      Local Service Unit
                    </p>
                    <h3 className="text-lg font-bold text-white">
                      {city.name} Mobile Van
                    </h3>
                  </div>
                  <span className="flex h-3 w-3 rounded-full bg-green-500 animate-ping" />
                </div>

                <div className="mt-5 space-y-3 text-xs text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                    <span>Serving <strong>{city.name}</strong> & surrounding areas</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Clock3 size={16} className="mt-0.5 shrink-0 text-primary" />
                    <span>Arrival: <strong>{city.averageResponseTime}</strong></span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Disc size={16} className="mt-0.5 shrink-0 text-primary" />
                    <span>On-board computerized wheel balancing</span>
                  </div>
                </div>

                <a
                  href={`tel:${BUSINESS_PHONE_RAW}`}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-xs font-bold text-white border border-white/20 transition hover:bg-primary hover:border-primary"
                >
                  <Phone size={15} />
                  Call {BUSINESS_PHONE_DISPLAY}
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Neighborhoods & Zip Codes Served - only if data exists */}
      {(city.neighborhoods.length > 0 || city.zipCodes.length > 0) && (
        <section className="bg-white py-16 sm:py-20 border-b border-border">
          <Container>
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Local Service Coverage
              </p>
              <h2 className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">
                We Serve {city.name} and Surrounding Areas
              </h2>
              <p className="mt-3 text-sm text-text-secondary">
                Our mobile tire service vans operate across {city.name} for scheduled and on-demand service.
              </p>

              {city.neighborhoods.length > 0 && (
                <div className="mt-8 flex flex-wrap justify-center gap-2.5">
                  {city.neighborhoods.map((neighborhood) => (
                    <span
                      key={neighborhood}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-foreground border border-border"
                    >
                      <MapPin size={13} className="text-primary" />
                      {neighborhood}
                    </span>
                  ))}
                </div>
              )}

              {city.zipCodes.length > 0 && (
                <div className="mt-6 rounded-2xl bg-background-light p-5 border border-border">
                  <p className="text-xs font-bold text-foreground mb-3">
                    Postal Codes Covered:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 text-xs font-mono font-semibold text-text-secondary">
                    {city.zipCodes.map((zip) => (
                      <span key={zip} className="rounded bg-white px-2.5 py-1 border border-border">
                        {zip}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Container>
        </section>
      )}

      {/* Localized Services Grid */}
      <section className="bg-background-light py-20 sm:py-24">
        <Container>
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Full Mobile Capabilities
            </p>
            <h2 className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">
              Mobile Tire Services Available in {city.name}
            </h2>
            <p className="mt-3 text-sm text-text-secondary">
              Professional tire services delivered directly to your vehicle's location.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {localServices.map((srv) => (
              <div
                key={srv.name}
                className="flex flex-col justify-between rounded-[20px] border border-border bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <span className="text-xs font-extrabold uppercase text-primary">
                      {srv.isEmergency ? "Emergency Service" : "Mobile Service"}
                    </span>
                    <span className="font-mono text-base font-extrabold text-foreground">
                      {srv.price}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-foreground">
                    {srv.name}
                  </h3>

                  <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                    {srv.description}
                  </p>
                </div>

                <div className="mt-6 border-t border-border pt-4">
                  <Link
                    href={
                      srv.isEmergency
                        ? `/emergency?location=${encodeURIComponent(`${city.name}, ${city.state}`)}`
                        : `/booking?service=${srv.slug}&location=${encodeURIComponent(`${city.name}, ${city.state}`)}`
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white transition hover:bg-primary"
                  >
                    <span>Book in {city.name}</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* City Service Highlights & Map */}
      <section className="bg-white py-20 sm:py-24 border-y border-border">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Why Drivers Choose Us
              </p>
              <h2 className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">
                Serving {city.name} Daily
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-text-secondary">
                Whether you are parked at home, at work, or on the road, our mobile tire units provide prompt on-site service.
              </p>

              <div className="mt-8 space-y-3.5">
                {city.serviceHighlights.map((highlight, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                      {highlight}
                    </span>
                  </div>
                ))}
              </div>

              {/* Local Landmarks if any */}
              {city.localLandmarks.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <p className="text-xs font-bold text-foreground mb-3">
                    Key {city.name} Destinations:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {city.localLandmarks.map((landmark) => (
                      <span
                        key={landmark}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        📍 {landmark}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Google Map Embed */}
            <div className="overflow-hidden rounded-[24px] border border-border shadow-lg h-[400px]">
              <iframe
                title={`Google Map of ${city.name}, ON`}
                src={city.mapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* City-Specific FAQs */}
      <section className="bg-background-light py-20 sm:py-24">
        <Container>
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
                <HelpCircle size={14} />
                Local Information
              </div>
              <h2 className="mt-3 text-3xl font-extrabold text-foreground sm:text-4xl">
                Frequently Asked Questions about {city.name} Mobile Tire Service
              </h2>
            </div>

            <div className="mt-12 space-y-4">
              {city.faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-white p-6 shadow-sm"
                >
                  <h3 className="text-base font-bold text-foreground">
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-text-secondary">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Customer Testimonials */}
      <Testimonials />

      {/* Nearby Service Areas Internal Linking Grid */}
      <section className="bg-white py-16 sm:py-20 border-t border-border">
        <Container>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h3 className="text-2xl font-bold text-foreground">
              Also Servicing Nearby Communities
            </h3>
            <p className="mt-2 text-xs text-text-secondary">
              Need mobile tire service outside {city.name}? Explore our other dedicated service areas.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {otherCities.map((other) => (
              <Link
                key={other.slug}
                href={`/service-area/${other.slug}`}
                className="group flex flex-col justify-between rounded-xl border border-border bg-slate-50/70 p-4 text-center transition hover:-translate-y-0.5 hover:border-primary hover:bg-white hover:shadow-sm"
              >
                <p className="text-sm font-bold text-foreground group-hover:text-primary transition">
                  {other.name}, {other.state}
                </p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  ⚡ {other.averageResponseTime}
                </p>
              </Link>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}
