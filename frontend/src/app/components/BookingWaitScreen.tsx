"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  Phone,
  RefreshCw,
  Mail,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Container from "@/app/components/Container";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";

export interface BookingWaitScreenProps {
  availability?: {
    available: boolean;
    estimatedCompletionAt?: string;
    remainingMinutes?: number;
  };
  onAvailable?: () => void;
}

export default function BookingWaitScreen({
  availability,
  onAvailable,
}: BookingWaitScreenProps) {
  const router = useRouter();

  const [targetTimeMs, setTargetTimeMs] = useState<number>(() => {
    if (availability?.estimatedCompletionAt) {
      const parsed = new Date(availability.estimatedCompletionAt).getTime();
      return isNaN(parsed) ? Date.now() + 45 * 60 * 1000 : parsed;
    }
    const mins = availability?.remainingMinutes || 45;
    return Date.now() + mins * 60 * 1000;
  });

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    const diff = Math.max(0, Math.floor((targetTimeMs - Date.now()) / 1000));
    return diff;
  });

  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Synchronize targetTimeMs when prop updates
  useEffect(() => {
    if (availability?.estimatedCompletionAt) {
      const parsed = new Date(availability.estimatedCompletionAt).getTime();
      if (!isNaN(parsed)) {
        setTargetTimeMs(parsed);
      }
    }
  }, [availability?.estimatedCompletionAt]);

  const checkAvailability = useCallback(
    async (isAuto = false) => {
      setIsChecking(true);
      setFeedbackMsg(null);

      try {
        const res = await fetch("/api/bookings/availability", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        const data = await res.json();

        if (data.available) {
          if (onAvailable) {
            onAvailable();
          } else {
            router.refresh();
            window.location.reload();
          }
          return;
        }

        if (data.estimatedCompletionAt) {
          const parsed = new Date(data.estimatedCompletionAt).getTime();
          if (!isNaN(parsed)) {
            setTargetTimeMs(parsed);
          }
        }

        if (!isAuto) {
          const mins =
            data.remainingMinutes ||
            Math.max(1, Math.ceil((targetTimeMs - Date.now()) / 60000));
          setFeedbackMsg(
            `Service currently in progress. Estimated remaining time: ~${mins} mins.`
          );
          setTimeout(() => setFeedbackMsg(null), 5000);
        }
      } catch (err) {
        console.error("Failed to check availability:", err);
        if (!isAuto) {
          setFeedbackMsg(
            "Unable to refresh availability right now. Please try again or call us."
          );
        }
      } finally {
        setIsChecking(false);
      }
    },
    [onAvailable, router, targetTimeMs]
  );

  // Real-time second countdown driven by server target timestamp
  useEffect(() => {
    function updateCountdown() {
      const diff = Math.max(0, Math.floor((targetTimeMs - Date.now()) / 1000));
      setRemainingSeconds(diff);

      if (diff === 0) {
        checkAvailability(true);
      }
    }

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [targetTimeMs, checkAvailability]);

  const displayMinutes = Math.floor(remainingSeconds / 60);
  const displaySeconds = remainingSeconds % 60;
  const formattedCountdown = `${String(displayMinutes).padStart(2, "0")}:${String(
    displaySeconds
  ).padStart(2, "0")}`;
  const totalDisplayMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));

  return (
    <div className="min-h-screen bg-background-light py-12 sm:py-20">
      <Container>
        <div className="mx-auto max-w-3xl">
          {/* Main Card */}
          <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-xl">
            {/* Header Status Bar */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-4 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Active Mobile Job in Progress
                  </span>
                </div>

                <span className="rounded-full bg-slate-800/90 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-700 shadow-inner">
                  🚐 All Mobile Vans Currently on Active Calls
                </span>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 text-center sm:p-10">
              {/* Icon */}
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-amber-600 shadow-inner border border-amber-200">
                <Clock size={40} className="animate-pulse" />
              </div>

              {/* Title & Headline */}
              <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Sorry — Our Technicians Are Currently on Active Calls
              </h1>

              <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-text-secondary leading-relaxed">
                We&apos;re currently serving another customer. Standard appointment requests will reopen as soon as our mobile van finishes the active service.
              </p>

              {/* Real-time Dynamic Estimate Card */}
              <div className="mx-auto mt-8 max-w-md rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Estimated Availability
                </p>

                <div className="mt-2 text-3xl font-extrabold tracking-tight text-amber-950 sm:text-4xl font-mono">
                  ~{totalDisplayMinutes} min
                </div>

                <p className="mt-1.5 text-xs text-amber-800">
                  Live window:{" "}
                  <span className="font-mono font-bold text-amber-950">
                    {formattedCountdown}
                  </span>{" "}
                  remaining until completion.
                </p>

                {/* Progress bar indication */}
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-amber-200/80">
                  <div
                    className="h-full bg-amber-500 transition-all duration-1000 ease-linear rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(5, (1 - remainingSeconds / (45 * 60)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Feedback Notice if checked */}
              {feedbackMsg && (
                <div
                  aria-live="polite"
                  className="mx-auto mt-4 max-w-md rounded-xl bg-blue-50 p-3 text-xs font-medium text-blue-800 border border-blue-200"
                >
                  {feedbackMsg}
                </div>
              )}

              {/* Primary Action: Check Availability Again */}
              <div className="mt-8 flex flex-col items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => checkAvailability(false)}
                  disabled={isChecking}
                  className="w-full sm:w-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-md shadow-primary/25 transition hover:bg-primary-hover active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={isChecking ? "animate-spin" : ""}
                  />
                  <span>
                    {isChecking
                      ? "Checking Availability..."
                      : "Check Availability Again"}
                  </span>
                </button>

                {/* Secondary Actions: Call Dispatch & Send Message */}
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 w-full sm:w-auto">
                  <a
                    href={`tel:${BUSINESS_PHONE_RAW}`}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                  >
                    <Phone size={14} />
                    <span>Call Us: {BUSINESS_PHONE_DISPLAY}</span>
                  </a>

                  <Link
                    href="/contact"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-slate-50 px-5 py-2.5 text-xs font-bold text-foreground transition hover:bg-slate-100"
                  >
                    <Mail size={14} className="text-primary" />
                    <span>Send Message</span>
                  </Link>
                </div>
              </div>

              {/* Dedicated Emergency Roadside Assistance Section */}
              <div className="mt-10 rounded-2xl border border-red-200 bg-red-50/60 p-6 text-left">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm">
                    <AlertTriangle size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-extrabold text-red-950">
                        Urgent Roadside Tire Problem?
                      </h3>
                      <span className="rounded-full bg-red-200/80 px-2.5 py-0.5 text-[10px] font-bold text-red-900">
                        24/7 ROADSIDE
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-red-900 leading-relaxed">
                      Stranded on a highway or roadway with a flat tire or blowout? Emergency roadside assistance operates independently from standard bookings.
                    </p>

                    <div className="mt-4">
                      <Link
                        href="/emergency"
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-95"
                      >
                        <span>Request Emergency Roadside Service</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
