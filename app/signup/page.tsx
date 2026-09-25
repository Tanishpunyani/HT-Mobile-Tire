"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { User, Mail, Phone, Lock, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { signup } from "@/app/actions/auth";

function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  async function handleSignupAction(formData: FormData) {
    setError(null);
    setLoading(true);

    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify your password.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    try {
      await signup(formData);
    } catch (err: any) {
      setError(err?.message || "Failed to create account. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-border bg-white p-8 shadow-xl sm:p-10">
      {/* Heading */}
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          Fast & Easy Onboarding
        </p>

        <h1 className="mt-2 text-3xl font-extrabold text-foreground">
          Create Account
        </h1>

        <p className="mt-2 text-xs text-text-secondary">
          Manage your appointments, view digital PDF receipts, and book services faster.
        </p>
      </div>

      {error && (
        <div className="mt-6 flex items-center gap-2.5 rounded-xl bg-red-50 p-3.5 text-xs font-semibold text-red-700 border border-red-200">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Server Action Form */}
      <form action={handleSignupAction} className="mt-8 space-y-4">
        {/* First & Last Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="firstName"
              className="mb-1.5 block text-xs font-bold text-foreground"
            >
              First Name
            </label>
            <div className="relative">
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                placeholder="John"
                className="w-full rounded-xl border border-border bg-slate-50/50 p-3 text-xs text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
              />
              <User size={15} className="absolute right-3 top-3 text-slate-400" />
            </div>
          </div>

          <div>
            <label
              htmlFor="lastName"
              className="mb-1.5 block text-xs font-bold text-foreground"
            >
              Last Name
            </label>
            <div className="relative">
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                placeholder="Doe"
                className="w-full rounded-xl border border-border bg-slate-50/50 p-3 text-xs text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
              />
              <User size={15} className="absolute right-3 top-3 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-bold text-foreground"
          >
            Email Address
          </label>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-xl border border-border bg-slate-50/50 p-3 text-xs text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
            />
            <Mail size={15} className="absolute right-3.5 top-3.5 text-slate-400" />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="phone"
            className="mb-1.5 block text-xs font-bold text-foreground"
          >
            Mobile Phone (for service updates)
          </label>
          <div className="relative">
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              placeholder="(555) 000-0000"
              className="w-full rounded-xl border border-border bg-slate-50/50 p-3 text-xs text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
            />
            <Phone size={15} className="absolute right-3.5 top-3.5 text-slate-400" />
          </div>
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-bold text-foreground"
          >
            Password (min. 6 characters)
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="w-full rounded-xl border border-border bg-slate-50/50 p-3 text-xs text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
            />
            <Lock size={15} className="absolute right-3.5 top-3.5 text-slate-400" />
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-xs font-bold text-foreground"
          >
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              placeholder="••••••••"
              className="w-full rounded-xl border border-border bg-slate-50/50 p-3 text-xs text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
            />
            <Lock size={15} className="absolute right-3.5 top-3.5 text-slate-400" />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-xs font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-60"
          >
            {loading ? (
              <span>Creating your account...</span>
            ) : (
              <>
                <span>Create Customer Account</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Trust reassurance */}
      <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
        <ShieldCheck size={14} className="text-green-600" />
        <span>Secure 256-bit encrypted authentication</span>
      </div>

      {/* Footer */}
      <div className="mt-6 border-t border-border pt-5 text-center text-xs text-text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-primary hover:underline">
          Sign in →
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background-light py-16 sm:py-24">
      <div className="mx-auto w-full max-w-md px-4">
        <Suspense fallback={<div className="h-96 rounded-2xl bg-white animate-pulse" />}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}