"use client";

import { useState, useEffect, Suspense, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  Phone,
  Send,
  TriangleAlert,
  Sparkles,
} from "lucide-react";
import Container from "../components/Container";
import SectionHeading from "../components/SectionHeading";
import { SERVICE_NAMES, normalizeServiceName } from "@/lib/constants/services";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";

function ContactFormInner() {
  const searchParams = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [selectedService, setSelectedService] = useState("");

  // Pre-select service from URL query parameter
  useEffect(() => {
    const serviceQuery = searchParams.get("service");
    if (serviceQuery) {
      const matched = normalizeServiceName(serviceQuery);
      if (matched) {
        setSelectedService(matched);
      }
    }
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const data = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      service: selectedService || formData.get("service"),
      location: formData.get("location"),
      emergency: formData.get("emergency") === "on",
      message: formData.get("message"),
    };

    try {
      const response = await fetch("/api/contact-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Unable to send your request.");
        return;
      }

      setSubmitted(true);
      form.reset();
    } catch (error) {
      console.error("CONTACT SUBMISSION ERROR:", error);
      alert("Unable to send your request. Please try again.");
    }
  }

  return (
    <div>
      {/* Page Header */}
      <section className="bg-secondary py-20 sm:py-24 border-b border-white/10">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-wider text-primary">
              Contact Us
            </p>

            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Get in Touch with HT Mobile Tires
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-300">
              Have questions or need mobile service? Reach out by phone,
              email, or using our inquiry form.
            </p>
          </div>
        </Container>
      </section>

      {/* Contact Content */}
      <section className="bg-background-light py-20 sm:py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
            {/* Contact Information */}
            <div>
              <SectionHeading
                eyebrow="Get in Touch"
                title="Contact HT Mobile Tires"
                description="Choose the easiest way to reach us or send a service request using the form."
              />

              <div className="mt-8 space-y-4">
                <a
                  href={`tel:${BUSINESS_PHONE_RAW}`}
                  className="group flex items-start gap-4 rounded-[16px] border border-border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-red-50 text-primary">
                    <Phone size={21} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Call Direct Dispatch
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {BUSINESS_PHONE_DISPLAY}
                    </p>
                  </div>
                </a>

                <a
                  href="mailto:dispatch@mobiletire.clinic"
                  className="group flex items-start gap-4 rounded-[16px] border border-border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-red-50 text-primary">
                    <Mail size={21} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Email Inquiries
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      dispatch@mobiletire.clinic
                    </p>
                  </div>
                </a>

                <div className="flex items-start gap-4 rounded-[16px] border border-border bg-white p-5 shadow-sm">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-red-50 text-primary">
                    <Clock3 size={21} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Hours of Operation
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      24/7 Roadside Emergencies
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Scheduled Visits: Mon–Sat 7:00 AM – 8:00 PM
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-[16px] border border-border bg-white p-5 shadow-sm">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-red-50 text-primary">
                    <MapPin size={21} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Service Locations
                    </p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                      We dispatch mobile vans to driveways, workplaces, and roadside areas.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="rounded-[20px] border border-border bg-white p-6 shadow-sm sm:p-8">
              {submitted ? (
                <div className="p-8 text-center sm:p-10">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle2 size={36} />
                  </div>

                  <h3 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
                    REQUEST SENT SUCCESSFULLY!
                  </h3>

                  <div className="mx-auto mt-4 max-w-lg space-y-3 text-sm leading-relaxed text-text-secondary">
                    <p className="font-medium text-foreground">
                      Your service inquiry has been received by our 24/7 central dispatch team.
                    </p>
                    <p>
                      For immediate assistance or priority dispatch, you can call our direct hotline at{" "}
                      <a
                        href={`tel:${BUSINESS_PHONE_RAW}`}
                        className="font-bold text-primary underline underline-offset-4 hover:text-primary-dark"
                      >
                        {BUSINESS_PHONE_DISPLAY}
                      </a>
                      .
                    </p>
                    <p className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs leading-normal text-slate-700">
                      If an equipped mobile technician van becomes available in your area, our dispatchers will allocate a technician to your service request. Our team will contact you shortly.
                    </p>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <a
                      href={`tel:${BUSINESS_PHONE_RAW}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-dark"
                    >
                      <Phone size={16} />
                      Call Direct Dispatch
                    </a>
                    <Link
                      href="/account?tab=inquiries"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      View In My Account →
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSubmitted(false)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-foreground"
                    >
                      Send Another Inquiry
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">
                        Send a Message
                      </h3>

                      <p className="mt-1 text-sm text-text-secondary">
                        Fill out the form below and we'll get back to you promptly.
                      </p>
                    </div>

                    {selectedService && (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary border border-primary/20">
                        <Sparkles size={14} />
                        Service: {selectedService}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block text-sm font-semibold text-foreground"
                    >
                      Your Name
                    </label>

                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      placeholder="Enter your full name"
                      className="w-full rounded-[10px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  {/* Phone + Email */}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="phone"
                        className="mb-2 block text-sm font-semibold text-foreground"
                      >
                        Phone Number
                      </label>

                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        required
                        placeholder="Enter your phone number"
                        className="w-full rounded-[10px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="mb-2 block text-sm font-semibold text-foreground"
                      >
                        Email
                      </label>

                      <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        className="w-full rounded-[10px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                  </div>

                  {/* Service */}
                  <div>
                    <label
                      htmlFor="service"
                      className="mb-2 block text-sm font-semibold text-foreground"
                    >
                      Service Needed
                    </label>

                    <select
                      id="service"
                      name="service"
                      required
                      value={selectedService}
                      onChange={(e) => setSelectedService(e.target.value)}
                      className="w-full rounded-[10px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
                    >
                      <option value="" disabled>
                        Select a service
                      </option>

                      {SERVICE_NAMES.map((service) => (
                        <option key={service} value={service}>
                          {service}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Location */}
                  <div>
                    <label
                      htmlFor="location"
                      className="mb-2 block text-sm font-semibold text-foreground"
                    >
                      Location (Optional)
                    </label>

                    <input
                      id="location"
                      name="location"
                      type="text"
                      placeholder="Your city, postal code, or area"
                      className="w-full rounded-[10px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  {/* Emergency Checkbox */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-red-200 bg-red-50/50 p-4">
                    <input
                      type="checkbox"
                      name="emergency"
                      className="mt-1 h-4 w-4 rounded border-border accent-primary"
                    />

                    <div>
                      <div className="flex items-center gap-1 text-sm font-bold text-red-600">
                        <TriangleAlert size={16} />
                        Urgent / Roadside Request
                      </div>

                      <p className="mt-1 text-xs text-text-secondary">
                        Check this box if your vehicle is currently disabled on the road.
                      </p>
                    </div>
                  </label>

                  {/* Message */}
                  <div>
                    <label
                      htmlFor="message"
                      className="mb-2 block text-sm font-semibold text-foreground"
                    >
                      Message
                    </label>

                    <textarea
                      id="message"
                      name="message"
                      rows={5}
                      required
                      placeholder="Tell us how we can help..."
                      className="w-full rounded-[10px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-8 py-4 text-base font-bold text-white shadow-md shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg"
                  >
                    <Send size={18} />
                    Send Request
                  </button>
                </form>
              )}
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background-light">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      }
    >
      <ContactFormInner />
    </Suspense>
  );
}