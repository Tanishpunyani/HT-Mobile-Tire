"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { MapPin, CheckCircle2, Clock3, ArrowRight, Sparkles } from "lucide-react";
import Container from "./Container";

export default function CoverageChecker() {
  const [zipOrCity, setZipOrCity] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "available">("idle");
  const [matchedLocation, setMatchedLocation] = useState("");

  function handleCheck(e: FormEvent) {
    e.preventDefault();
    if (!zipOrCity.trim()) return;

    setStatus("checking");
    setTimeout(() => {
      setStatus("available");
      setMatchedLocation(zipOrCity.trim());
    }, 450);
  }

  return (
    <section className="bg-white py-16 sm:py-20 border-b border-border">
      <Container>
        <div className="mx-auto max-w-4xl rounded-[24px] border border-primary/20 bg-gradient-to-br from-secondary via-secondary to-[#0b1329] p-8 text-white shadow-xl sm:p-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/20 px-3.5 py-1.5 text-xs font-bold text-primary">
              <Sparkles size={14} />
              Instant Service Availability Estimator
            </div>

            <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
              Check HT Mobile Tire Availability Near You
            </h2>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Enter your postal code, city, or street to confirm service coverage and see today&apos;s estimated arrival times.
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
                    if (status === "available") setStatus("idle");
                  }}
                  className="w-full rounded-[12px] border border-white/20 bg-white/10 py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-primary focus:bg-white/15 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button
                type="submit"
                disabled={status === "checking"}
                className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-primary-hover disabled:opacity-50"
              >
                {status === "checking" ? "Checking Availability..." : "Check Availability"}
              </button>
            </div>
          </form>

          {status === "available" && (
            <div className="mx-auto mt-6 max-w-xl rounded-xl border border-green-500/30 bg-green-950/40 p-4 text-left backdrop-blur-md">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">
                    ✅ Mobile Service is Active in <span className="text-primary font-extrabold">{matchedLocation}</span>!
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
                    <Clock3 size={13} className="text-green-400" />
                    Technician Arrival: <strong className="text-white">Estimated 30–45 min arrival</strong>
                  </p>
                  <div className="mt-3 flex gap-3">
                    <Link
                      href="/booking"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-primary-hover"
                    >
                      Book Mobile Service <ArrowRight size={13} />
                    </Link>
                    <Link
                      href="/emergency"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-600/30 px-3.5 py-1.5 text-xs font-bold text-red-200 transition hover:bg-red-600/50"
                    >
                      Emergency Roadside Help
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
