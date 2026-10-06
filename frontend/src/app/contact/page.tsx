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
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_TEL } from "@/lib/constants/phone";

function ContactFormInner() {
  const searchParams = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [selectedService, setSelectedService] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

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
              Get in Touch with HT Mobile Tire
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-300">
              Have questions or need mobile service? Reach out by phone,
              email, or using our inquiry form.
            </p>
          </div>
        </Container>
      </section>

      {/* Contact Content */}
      <section className="bg-background-light py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-5xl space-y-10">
            {/* Contact Choice Cards */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* OPTION 1 — CALL US */}
              <div className="flex flex-col justify-between rounded-[20px] border border-border bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md sm:p-8">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-primary">
                    <Phone size={24} />
                  </div>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wider text-primary">
                    Option 1 • Direct Assistance
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-foreground">
                    Contact Us for Tire Services
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    Call our service team directly for immediate assistance, 24/7 roadside emergency response, or questions.
                  </p>
                  <p className="mt-5 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                    {BUSINESS_PHONE_DISPLAY}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                  <a
                    href={BUSINESS_PHONE_TEL}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3.5 text-base font-bold text-white shadow-md shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover active:scale-95"
                  >
                    <Phone size={18} />
                    <span>Call Now</span>
                  </a>
                </div>
              </div>

              {/* OPTION 2 — SEND A MESSAGE */}
              <div className="flex flex-col justify-between rounded-[20px] border border-border bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md sm:p-8">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-foreground">
                    <Mail size={24} />
                  </div>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Option 2 • Online Inquiry
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-foreground">
                    Need to Send Us a Message?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    Prefer to send an inquiry or message online? Open our service form to send your vehicle and request details.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen((prev) => !prev)}
                    aria-expanded={isFormOpen}
                    aria-controls="contact-form-section"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-primary bg-primary/5 px-6 py-3.5 text-base font-bold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary hover:text-white active:scale-95"
                  >
                    <Mail size={18} />
                    <span>{isFormOpen ? "Hide Message Form" : "Send Message"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* EXPANDABLE CONTACT FORM (Initially Hidden) */}
            {isFormOpen && (
              <div
                id="contact-form-section"
                className="rounded-[20px] border border-border bg-white p-6 shadow-md transition-all duration-300 sm:p-8"
              >
                <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-foreground sm:text-2xl">
                      Send a Message
                    </h3>
                    <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                      Fill out the form below and our team will get back to you promptly.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    aria-label="Hide message form"
                    className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-slate-100 hover:text-foreground"
                  >
                    Hide Message Form
                  </button>
                </div>

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
                        Your service inquiry has been received by our team.
                      </p>
                      <p>
                        For immediate assistance, you can call us at{" "}
                        <a
                          href={BUSINESS_PHONE_TEL}
                          className="font-bold text-primary underline underline-offset-4 hover:text-primary-dark"
                        >
                          {BUSINESS_PHONE_DISPLAY}
                        </a>
                        .
                      </p>
                      <p className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs leading-normal text-slate-700">
                        A member of our service team will review your request and contact you shortly.
                      </p>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                      <a
                        href={BUSINESS_PHONE_TEL}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-dark"
                      >
                        <Phone size={16} />
                        Call Us
                      </a>
                      <Link
                        href="/account?tab=inquiries"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        View In My Account →
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitted(false);
                          setIsFormOpen(true);
                        }}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-foreground"
                      >
                        Send Another Inquiry
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {selectedService && (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary border border-primary/20">
                        <Sparkles size={14} />
                        Service: {selectedService}
                      </div>
                    )}

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
                      Send Message
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Additional Contact Information Cards */}
            <div className="grid gap-6 sm:grid-cols-3 pt-6 border-t border-border">
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
                  <p className="mt-1 text-xs text-text-secondary sm:text-sm">
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
                  <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                    24/7 Roadside Emergencies
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">
                    Mon–Sat 7:00 AM – 8:00 PM
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
                  <p className="mt-1 text-xs leading-5 text-text-secondary sm:text-sm">
                    Mobile service comes directly to your location across Ontario.
                  </p>
                </div>
              </div>
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