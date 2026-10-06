"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  MapPin,
  Phone,
  Send,
  User,
  Clock3,
} from "lucide-react";
import Container from "../components/Container";
import AddressAutocomplete, { type StructuredAddress } from "../components/AddressAutocomplete";
import GpsLocationButton from "../components/GpsLocationButton";
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_TEL } from "@/lib/constants/phone";

const problems = [
  "Flat Tire",
  "Tire Damage",
  "Tire Blowout",
  "Need a Spare Tire",
  "Valve Stem / Bead Leak",
  "Other Tire Problem",
];

export default function EmergencyPage() {
  const [submitted, setSubmitted] = useState(false);
  const [locationAddress, setLocationAddress] = useState("");
  const [structuredAddress, setStructuredAddress] = useState<StructuredAddress | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg("");

    const trimmedLocation = locationAddress.trim();
    if (!trimmedLocation) {
      setErrorMsg("Please specify your breakdown location or click 'Auto-Detect GPS Location'.");
      return;
    }

    setSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const data = {
      name: (formData.get("name") as string)?.trim() || "",
      phone: (formData.get("phone") as string)?.trim() || "",
      email: (formData.get("email") as string)?.trim() || null,
      currentLocation: trimmedLocation,
      formattedAddress: structuredAddress?.formattedAddress || trimmedLocation || null,
      latitude: typeof structuredAddress?.lat === "number" ? structuredAddress.lat : null,
      longitude: typeof structuredAddress?.lng === "number" ? structuredAddress.lng : null,
      city: structuredAddress?.city || null,
      state: structuredAddress?.state || null,
      zipCode: structuredAddress?.zipCode || null,
      problem: (formData.get("problem") as string) || "",
      problemDetails: (formData.get("details") as string)?.trim() || null,
      vehicle: (formData.get("vehicle") as string)?.trim() || "",
    };

    try {
      const response = await fetch("/api/emergency-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        let displayError = result.error || "Unable to submit emergency request. Please try again or call our hotline.";
        if (result.details && typeof result.details === "object") {
          const errorEntries = Object.entries(result.details);
          if (errorEntries.length > 0) {
            const [, msgs] = errorEntries[0];
            if (Array.isArray(msgs) && msgs.length > 0 && typeof msgs[0] === "string") {
              displayError = msgs[0];
            }
          }
        }
        setErrorMsg(displayError);
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      form.reset();
      setLocationAddress("");
      setStructuredAddress(null);
    } catch (error) {
      console.error("EMERGENCY SUBMISSION ERROR:", error);
      setErrorMsg(`Unable to submit emergency request. Please call our 24/7 hotline at ${BUSINESS_PHONE_DISPLAY}.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Emergency Header */}
      <section className="bg-secondary py-16 sm:py-20 border-b border-white/10">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg animate-pulse">
              <AlertTriangle size={32} />
            </div>

            <p className="mt-6 text-sm font-bold uppercase tracking-wider text-primary">
              24/7 Roadside Tire Emergency
            </p>

            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Need Roadside Tire Help Right Now?
            </h1>

            <p className="mt-5 text-base leading-7 text-slate-300 sm:text-lg">
              Auto-detect your roadside GPS location or enter your address. An available mobile technician will respond immediately.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white border border-white/20 backdrop-blur-sm">
              <Clock3 size={14} className="text-primary" />
              Average Roadside Response: 30–45 Minutes
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={BUSINESS_PHONE_TEL}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-red-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-red-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-700 active:scale-95"
              >
                <Phone size={18} />
                <span>Call Now: {BUSINESS_PHONE_DISPLAY}</span>
              </a>
            </div>
          </div>
        </Container>
      </section>

      {/* Emergency Form */}
      <section className="bg-background-light py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-3xl">
            {submitted ? (
              <div className="rounded-[20px] border border-border bg-white p-8 text-center shadow-lg sm:p-12">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <CheckCircle2 size={44} />
                </div>

                <h2 className="mt-6 text-2xl font-extrabold text-foreground sm:text-3xl">
                  Emergency Request Received!
                </h2>

                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary">
                  Your roadside emergency request has been prioritized in our system. An on-duty mobile technician has received your coordinates. Please stay in a safe spot away from traffic.
                </p>

                <div className="mx-auto mt-6 max-w-sm rounded-xl bg-slate-50 p-4 text-xs text-text-secondary border border-border">
                  <p><strong>Hotline:</strong> {BUSINESS_PHONE_DISPLAY}</p>
                  <p className="mt-1 text-slate-400">Estimated Arrival Time: 30–45 mins</p>
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/account?tab=emergency"
                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-hover"
                  >
                    View In My Account →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    Submit Another Request
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-[20px] border border-primary/20 bg-white p-6 shadow-sm sm:p-8 lg:p-10"
              >
                {/* Form Header */}
                <div className="mb-8 rounded-[14px] border border-primary/20 bg-red-50 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      size={24}
                      className="mt-0.5 shrink-0 text-primary animate-bounce"
                    />

                    <div>
                      <h2 className="font-extrabold text-foreground text-lg">
                        Priority Roadside Assistance
                      </h2>

                      <p className="mt-1 text-xs leading-5 text-text-secondary">
                        Please provide your current location so our technician can reach your vehicle without delay.
                      </p>
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <div className="mb-6 rounded-xl bg-red-50 p-3.5 text-xs font-semibold text-red-700 border border-red-200">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-7">
                  {/* Current Location & GPS Button */}
                  <div>
                    <label
                      htmlFor="location"
                      className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground"
                    >
                      <span className="flex items-center gap-2">
                        <MapPin size={17} className="text-primary" />
                        Current Location
                      </span>
                    </label>

                    {/* GPS Button */}
                    <div className="mb-3">
                      <GpsLocationButton
                        variant="emergency"
                        onLocationFound={(addr) => {
                          setLocationAddress(addr.formattedAddress);
                          setStructuredAddress(addr);
                        }}
                      />
                    </div>

                    <AddressAutocomplete
                      id="location"
                      name="location"
                      value={locationAddress}
                      onChange={setLocationAddress}
                      onPlaceSelect={setStructuredAddress}
                      required
                      placeholder="Or enter street address, landmark, or highway exit"
                    />

                    <p className="mt-2 text-xs text-text-secondary">
                      Example: Highway 75 Exit 22 Shoulder, Walmart parking lot, or driveway address.
                    </p>
                  </div>

                  {/* Problem */}
                  <div>
                    <label
                      htmlFor="problem"
                      className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"
                    >
                      <AlertTriangle size={17} className="text-primary" />
                      What Happened?
                    </label>

                    <select
                      id="problem"
                      name="problem"
                      required
                      defaultValue=""
                      className="w-full rounded-[10px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
                    >
                      <option value="" disabled>
                        Select your tire problem
                      </option>

                      {problems.map((problem) => (
                        <option key={problem} value={problem}>
                          {problem}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Additional Problem Details */}
                  <div>
                    <label
                      htmlFor="details"
                      className="mb-2 block text-sm font-semibold text-foreground"
                    >
                      Additional Details (Optional)
                    </label>

                    <textarea
                      id="details"
                      name="details"
                      rows={3}
                      placeholder="Describe what happened (e.g. rear right blowout, spare tire is in trunk, wheel lock key location)..."
                      className="w-full resize-none rounded-[10px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  {/* Vehicle */}
                  <div>
                    <label
                      htmlFor="vehicle"
                      className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"
                    >
                      <Car size={17} className="text-primary" />
                      Vehicle Details
                    </label>

                    <input
                      id="vehicle"
                      name="vehicle"
                      type="text"
                      required
                      placeholder="Year, make and model (e.g. 2021 Ford F-150)"
                      className="w-full rounded-[10px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  {/* Contact Information */}
                  <div>
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-foreground">
                        Your Contact Information
                      </h3>

                      <p className="mt-1 text-xs text-text-secondary">
                        Your technician will call this number with updated arrival times.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="name"
                          className="mb-1.5 flex items-center gap-2 text-xs font-bold text-foreground"
                        >
                          <User size={15} className="text-primary" />
                          Full Name
                        </label>

                        <input
                          id="name"
                          name="name"
                          type="text"
                          required
                          placeholder="Your full name"
                          className="w-full rounded-[10px] border border-border bg-white px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="phone"
                          className="mb-1.5 flex items-center gap-2 text-xs font-bold text-foreground"
                        >
                          <Phone size={15} className="text-primary" />
                          Phone Number *
                        </label>

                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          required
                          placeholder="Your direct cell phone number"
                          className="w-full rounded-[10px] border border-border bg-white px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="email"
                          className="mb-1.5 block text-xs font-bold text-foreground"
                        >
                          Email Address (Optional)
                        </label>

                        <input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="you@example.com"
                          className="w-full rounded-[10px] border border-border bg-white px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-6 py-4 text-base font-bold text-white shadow-lg shadow-primary/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover disabled:opacity-50"
                  >
                    <Send size={18} />
                    {submitting ? "Submitting Request..." : "Request Emergency Roadside Help →"}
                  </button>

                  <p className="text-center text-xs leading-5 text-text-secondary">
                    🚨 By submitting, your request is marked as urgent for immediate technician response.
                  </p>
                </div>
              </form>
            )}
          </div>
        </Container>
      </section>
    </div>
  );
}