"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { MapPin, Phone, ArrowRight, Sparkles } from "lucide-react";
import Container from "./Container";
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_TEL } from "@/lib/constants/phone";

export default function CoverageChecker() {
  const [zipOrCity, setZipOrCity] = useState("");
  const [status, setStatus] = useState<"idle" | "submitted">("idle");
  const [enteredLocation, setEnteredLocation] = useState("");

  function handleCheck(e: FormEvent) {
    e.preventDefault();
    const trimmed = zipOrCity.trim();
    if (!trimmed) return;

    setEnteredLocation(trimmed);
    setStatus("submitted");
  }

  return (
    <section className="bg-white py-16 sm:py-20 border-b border-border">
      <Container>
        <div className="mx-auto max-w-4xl rounded-[24px] border border-primary/20 bg-gradient-to-br from-secondary via-secondary to-[#0b1329] p-8 text-white shadow-xl sm:p-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/20 px-3.5 py-1.5 text-xs font-bold text-primary">
              <Sparkles size={14} />
              Service Availability &amp; Inquiries
            </div>

            <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
              Check HT Mobile Tire Availability Near You
            </h2>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Enter your postal code, city, or address to connect with our dispatch team and verify service availability for your vehicle location.
            </p>
          </div>

          <form onSubmit={handleCheck} className="mx-auto mt-8 max-w-xl">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
                <input
                  type="text"
                  required
                  placeholder="Enter Postal Code, City, or Address"
                  value={zipOrCity}
                  onChange={(e) => {
                    setZipOrCity(e.target.value);
                    if (status === "submitted") setStatus("idle");
                  }}
                  className="w-full rounded-[12px] border border-white/20 bg-white/10 py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-primary focus:bg-white/15 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-primary-hover"
              >
                Check Availability
              </button>
            </div>
          </form>

          {status === "submitted" && (
            <div className="mx-auto mt-6 max-w-xl rounded-xl border border-blue-500/30 bg-blue-950/40 p-5 text-left backdrop-blur-md">
              <div className="flex items-start gap-3">
                <MapPin size={20} className="mt-0.5 shrink-0 text-blue-400" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">
                    Location Entered: <span className="text-primary font-extrabold">{enteredLocation}</span>
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-300 sm:text-sm">
                    Service availability cannot be automatically confirmed here. Please contact HT Mobile Tire with your postal code and vehicle location so we can assess service availability.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <a
                      href={BUSINESS_PHONE_TEL}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover"
                    >
                      <Phone size={13} />
                      Call {BUSINESS_PHONE_DISPLAY}
                    </a>
                    <Link
                      href="/booking"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                    >
                      Book by Appointment <ArrowRight size={13} />
                    </Link>
                    <Link
                      href="/service-areas"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 underline underline-offset-4 hover:text-white"
                    >
                      View Service Areas
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
