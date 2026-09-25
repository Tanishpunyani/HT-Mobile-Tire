"use client";

import { useState, useEffect } from "react";
import { HelpCircle, CheckCircle2, Sparkles, AlertCircle, Wrench } from "lucide-react";

const WIDTH_OPTIONS = Array.from({ length: 21 }, (_, i) => 155 + i * 10); // 155 to 355
const ASPECT_OPTIONS = Array.from({ length: 13 }, (_, i) => 25 + i * 5);  // 25 to 85
const RIM_OPTIONS = Array.from({ length: 12 }, (_, i) => `R${13 + i}`);    // R13 to R24

interface TireSizeSelectorProps {
  value?: string;
  onChange: (size: string) => void;
  className?: string;
}

export default function TireSizeSelector({
  value,
  onChange,
  className = "",
}: TireSizeSelectorProps) {
  const [width, setWidth] = useState<number>(225);
  const [aspect, setAspect] = useState<number>(50);
  const [rim, setRim] = useState<string>("R17");
  const [isUnknown, setIsUnknown] = useState<boolean>(false);

  // Pre-populate if initial value exists
  useEffect(() => {
    if (!value) return;

    if (value.startsWith("TBD") || value === "Unknown") {
      setIsUnknown(true);
      return;
    }

    // Match format: 225/50R17
    const match = value.match(/^(\d{3})\/(\d{2})(R\d{2})$/);
    if (match) {
      setWidth(parseInt(match[1], 10));
      setAspect(parseInt(match[2], 10));
      setRim(match[3]);
      setIsUnknown(false);
    }
  }, [value]);

  // Sync formatted size with parent component
  useEffect(() => {
    if (isUnknown) {
      onChange("TBD - Measure On Arrival");
    } else {
      onChange(`${width}/${aspect}${rim}`);
    }
  }, [width, aspect, rim, isUnknown, onChange]);

  const currentSizeString = isUnknown ? "TBD - Measure On Arrival" : `${width}/${aspect}${rim}`;

  return (
    <div
      className={`rounded-[20px] border border-border bg-white p-5 shadow-sm sm:p-7 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              1
            </span>
            <h3 className="text-base font-bold text-foreground sm:text-lg">
              Select Your Tire Size
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-text-secondary">
            Find the three numbers on your tire sidewall (e.g., <strong>225/50R17</strong>)
          </p>
        </div>

        {/* Live Size Badge */}
        <div className="rounded-xl border border-primary/20 bg-slate-900 px-4 py-2 text-center text-white shadow-inner">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Selected Tire Size
          </p>
          <p className="font-mono text-base font-extrabold tracking-wide text-primary">
            {currentSizeString}
          </p>
        </div>
      </div>

      {/* Mode Selector / "I Don't Know My Size" Toggle */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setIsUnknown(false);
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            !isUnknown
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "border border-border bg-slate-50 text-text-secondary hover:bg-slate-100"
          }`}
        >
          <Sparkles size={14} />
          Choose Size from Sidewall
        </button>

        <button
          type="button"
          onClick={() => {
            setIsUnknown(true);
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            isUnknown
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
              : "border border-border bg-slate-50 text-text-secondary hover:bg-slate-100"
          }`}
        >
          <HelpCircle size={14} />
          I Don't Know My Size (TBD)
        </button>
      </div>

      {/* Fallback View: I Don't Know */}
      {isUnknown ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Wrench size={20} />
            </div>
            <div>
              <h4 className="font-bold text-amber-950">No Problem! We'll Measure On Arrival</h4>
              <p className="mt-1 text-xs leading-relaxed text-amber-900">
                Our fully equipped mobile service van carries professional tread and rim measurement gauges. Your technician will inspect your vehicle on arrival and equip the correct tire size specifications for your make and model.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-xs font-bold text-amber-900 border border-amber-200">
                <CheckCircle2 size={13} className="text-amber-600" />
                Marked as: <strong>TBD (To Be Determined on-site)</strong>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Active 3-Step Dropdown Selectors */
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* 1. Width (mm) */}
            <div className="rounded-xl border border-border bg-slate-50/80 p-3.5">
              <label
                htmlFor="tire-width"
                className="mb-1 block text-xs font-bold text-foreground"
              >
                1. Width (mm)
              </label>
              <select
                id="tire-width"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                {WIDTH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} mm
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-text-secondary">
                Tire cross-section width
              </p>
            </div>

            {/* 2. Aspect Ratio */}
            <div className="rounded-xl border border-border bg-slate-50/80 p-3.5">
              <label
                htmlFor="tire-aspect"
                className="mb-1 block text-xs font-bold text-foreground"
              >
                2. Aspect Ratio (%)
              </label>
              <select
                id="tire-aspect"
                value={aspect}
                onChange={(e) => setAspect(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                {ASPECT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    /{opt}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-text-secondary">
                Sidewall height % of width
              </p>
            </div>

            {/* 3. Rim Diameter */}
            <div className="rounded-xl border border-border bg-slate-50/80 p-3.5">
              <label
                htmlFor="tire-rim"
                className="mb-1 block text-xs font-bold text-foreground"
              >
                3. Rim Diameter
              </label>
              <select
                id="tire-rim"
                value={rim}
                onChange={(e) => setRim(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                {RIM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} ({opt.replace("R", "")} Inch)
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-text-secondary">
                Wheel rim size in inches
              </p>
            </div>
          </div>

          {/* Interactive Tire Sidewall SVG Diagram with Callouts */}
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Interactive Sidewall Guide
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">
                Look for numbers molded on your tire
              </span>
            </div>

            {/* Tire Sidewall Illustration */}
            <div className="relative mx-auto mt-6 max-w-lg">
              <svg
                viewBox="0 0 500 240"
                className="w-full h-auto drop-shadow-2xl"
                fill="none"
                role="img"
                aria-label="Tire sidewall diagram showing width, aspect ratio, and rim diameter"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Outer Tire Tread Arc */}
                <path
                  d="M 50,220 A 200,200 0 0,1 450,220"
                  stroke="#334155"
                  strokeWidth="28"
                  strokeLinecap="round"
                />

                {/* Inner Sidewall Arc */}
                <path
                  d="M 90,220 A 160,160 0 0,1 410,220"
                  stroke="#1e293b"
                  strokeWidth="38"
                  strokeLinecap="round"
                />

                {/* Rim Lip Arc */}
                <path
                  d="M 130,220 A 120,120 0 0,1 370,220"
                  stroke="#475569"
                  strokeWidth="8"
                  strokeLinecap="round"
                />

                {/* Wheel Center Hub */}
                <circle cx="250" cy="220" r="70" fill="#0f172a" stroke="#64748b" strokeWidth="4" />
                <circle cx="250" cy="220" r="28" fill="#1e293b" stroke="#dc2626" strokeWidth="2" />

                {/* Tire Brand Text Arc */}
                <text
                  x="250"
                  y="62"
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="12"
                  fontWeight="bold"
                  letterSpacing="3"
                >
                  PREMIUM TOURING TIRE
                </text>

                {/* Dynamic Tire Size Text on Sidewall */}
                <g transform="translate(250, 105)">
                  {/* Width Text */}
                  <text
                    x="-42"
                    y="0"
                    textAnchor="middle"
                    fill="#ef4444"
                    fontSize="22"
                    fontWeight="900"
                    fontFamily="monospace"
                  >
                    {width}
                  </text>

                  {/* Slash */}
                  <text
                    x="-18"
                    y="0"
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="22"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    /
                  </text>

                  {/* Aspect Text */}
                  <text
                    x="2"
                    y="0"
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="22"
                    fontWeight="900"
                    fontFamily="monospace"
                  >
                    {aspect}
                  </text>

                  {/* Rim Text */}
                  <text
                    x="38"
                    y="0"
                    textAnchor="middle"
                    fill="#4ade80"
                    fontSize="22"
                    fontWeight="900"
                    fontFamily="monospace"
                  >
                    {rim}
                  </text>
                </g>

                {/* Callout Pointer Lines */}
                {/* 1. Width Pointer */}
                <path d="M 205,80 L 140,35" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
                <circle cx="140" cy="35" r="4" fill="#ef4444" />

                {/* 2. Aspect Ratio Pointer */}
                <path d="M 252,80 L 250,25" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
                <circle cx="250" cy="25" r="4" fill="#38bdf8" />

                {/* 3. Rim Pointer */}
                <path d="M 290,80 L 360,35" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="3 3" />
                <circle cx="360" cy="35" r="4" fill="#4ade80" />
              </svg>
            </div>

            {/* Callout Legend Labels */}
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3 text-xs">
              <div className="flex items-center gap-2 rounded-xl bg-slate-800/80 p-2.5 border border-red-500/30">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white">
                  1
                </span>
                <div>
                  <p className="font-bold text-red-400">Width ({width}mm)</p>
                  <p className="text-[10px] text-slate-400">Tire width in millimeters</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-slate-800/80 p-2.5 border border-sky-500/30">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[10px] font-extrabold text-white">
                  2
                </span>
                <div>
                  <p className="font-bold text-sky-400">Ratio ({aspect}%)</p>
                  <p className="text-[10px] text-slate-400">Sidewall height percentage</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-slate-800/80 p-2.5 border border-emerald-500/30">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-extrabold text-white">
                  3
                </span>
                <div>
                  <p className="font-bold text-emerald-400">Rim ({rim})</p>
                  <p className="text-[10px] text-slate-400">Wheel diameter in inches</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
