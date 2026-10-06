"use client";

import { FormEvent } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  LogIn,
  UserPlus,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import Container from "@/app/components/Container";
import { ErrorState } from "../types";

interface AccountErrorStateProps {
  errorState: ErrorState | null;
  onboardingName: string;
  setOnboardingName: (val: string) => void;
  onboardingPhone: string;
  setOnboardingPhone: (val: string) => void;
  onboardingError: string | null;
  onboardingSaving: boolean;
  onOnboardingSubmit: (e: FormEvent) => void;
  onRetry: () => void;
  retrying: boolean;
}

export default function AccountErrorState({
  errorState,
  onboardingName,
  setOnboardingName,
  onboardingPhone,
  setOnboardingPhone,
  onboardingError,
  onboardingSaving,
  onOnboardingSubmit,
  onRetry,
  retrying,
}: AccountErrorStateProps) {
  // 1. Admin access restriction UI
  if (errorState?.type === "admin_access") {
    return (
      <div className="min-h-screen bg-background-light py-20">
        <Container>
          <div className="mx-auto max-w-md rounded-[24px] border border-border bg-white p-8 text-center shadow-xl sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-primary border border-blue-200">
              <ShieldCheck size={26} />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-foreground">
              Customer Area Only
            </h1>
            <p className="mt-2 text-xs leading-5 text-text-secondary">
              {errorState.message ||
                "This area is for customers only. Administrators should use the Admin Portal."}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/admin/dashboard"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-xs font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary-hover"
              >
                <span>Go to Admin Portal →</span>
              </Link>
              <Link
                href="/"
                className="flex w-full items-center justify-center rounded-xl border border-border py-3 text-xs font-semibold text-text-secondary transition hover:bg-slate-50 hover:text-foreground"
              >
                Back Home
              </Link>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // 2. Session Expired / Unauthorized UI
  if (errorState?.type === "unauthorized") {
    return (
      <div className="min-h-screen bg-background-light py-20">
        <Container>
          <div className="mx-auto max-w-md rounded-[24px] border border-border bg-white p-8 text-center shadow-xl sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-200">
              <LogIn size={26} />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-foreground">
              Session Expired
            </h1>
            <p className="mt-2 text-xs leading-5 text-text-secondary">
              {errorState.message ||
                "Your session has expired. Please sign in to access your customer dashboard."}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/login?expired=true"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-xs font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary-hover"
              >
                <LogIn size={15} />
                <span>Sign In Again</span>
              </Link>
              <Link
                href="/"
                className="flex w-full items-center justify-center rounded-xl border border-border py-3 text-xs font-semibold text-text-secondary transition hover:bg-slate-50 hover:text-foreground"
              >
                Back Home
              </Link>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // 3. Profile Incomplete / Needs Onboarding UI
  if (errorState?.type === "not_found") {
    return (
      <div className="min-h-screen bg-background-light py-20">
        <Container>
          <div className="mx-auto max-w-md rounded-[24px] border border-border bg-white p-8 shadow-xl sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-primary border border-blue-200">
              <UserPlus size={26} />
            </div>
            <div className="mt-4 text-center">
              <h1 className="text-2xl font-extrabold text-foreground">
                Complete Your Profile
              </h1>
              <p className="mt-2 text-xs leading-5 text-text-secondary">
                Please provide your name and phone number so our mobile tire technicians can contact you.
              </p>
            </div>

            {onboardingError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                <AlertCircle size={15} className="shrink-0" />
                <span>{onboardingError}</span>
              </div>
            )}

            <form onSubmit={onOnboardingSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="onboardingName" className="block text-xs font-bold text-foreground mb-1.5">
                  Full Name
                </label>
                <input
                  id="onboardingName"
                  type="text"
                  required
                  placeholder="e.g. John Smith"
                  value={onboardingName}
                  onChange={(e) => setOnboardingName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-slate-50/50 p-3 text-xs text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div>
                <label htmlFor="onboardingPhone" className="block text-xs font-bold text-foreground mb-1.5">
                  Mobile Phone (for service updates)
                </label>
                <input
                  id="onboardingPhone"
                  type="tel"
                  required
                  placeholder="(555) 000-0000"
                  value={onboardingPhone}
                  onChange={(e) => setOnboardingPhone(e.target.value)}
                  className="w-full rounded-xl border border-border bg-slate-50/50 p-3 text-xs text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <button
                type="submit"
                disabled={onboardingSaving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-xs font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary-hover disabled:opacity-60"
              >
                {onboardingSaving ? (
                  <span>Saving Profile...</span>
                ) : (
                  <>
                    <span>Save Profile & Continue</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>
        </Container>
      </div>
    );
  }

  // 4. Server Error with Seamless Retry UI
  return (
    <div className="min-h-screen bg-background-light py-20">
      <Container>
        <div className="mx-auto max-w-lg rounded-[24px] border border-border bg-white p-8 text-center shadow-xl sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-200">
            <AlertCircle size={28} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-foreground">
            Unable to Load Account
          </h1>
          <p className="mt-2 text-xs leading-5 text-text-secondary">
            {errorState?.message || "Unable to get customer profile."}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary-hover disabled:opacity-60"
            >
              <RefreshCw size={14} className={retrying ? "animate-spin" : ""} />
              <span>{retrying ? "Retrying..." : "Retry Connection"}</span>
            </button>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-5 py-3 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-xs font-semibold text-text-secondary transition hover:bg-slate-50 hover:text-foreground"
            >
              Back Home
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
