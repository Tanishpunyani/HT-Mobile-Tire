"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import TireSizeSelector from "@/app/components/TireSizeSelector";

export default function TireSizeServiceSection() {
  const [selectedSize, setSelectedSize] = useState("225/50R17");

  return (
    <section className="bg-slate-900 py-16 text-white sm:py-20 border-y border-slate-800">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3.5 py-1 text-xs font-bold text-primary border border-primary/30">
            <Sparkles size={14} />
            Visual Size Finder
          </div>

          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Find Your Exact Tire Size in 3 Simple Steps
          </h2>

          <p className="mt-3 text-sm text-slate-300 max-w-2xl mx-auto">
            Not sure which tires fit your vehicle? Use our interactive sidewall guide below. When ready, lock in your mobile technician appointment.
          </p>
        </div>

        <TireSizeSelector
          value={selectedSize}
          onChange={setSelectedSize}
          className="border-slate-800 bg-slate-950 text-foreground"
        />

        <div className="mt-8 text-center">
          <Link
            href={`/booking?service=new-used-tires&tireSize=${encodeURIComponent(selectedSize)}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl"
          >
            <span>Proceed to Book Mobile Service for <strong>{selectedSize}</strong></span>
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
