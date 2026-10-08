"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { Lock, Mail, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { login } from "@/app/actions/auth";

function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const message = searchParams.get("message");
  const urlError = searchParams.get("error");
  const redirectTarget = searchParams.get("redirect") || "/account";

  async function handleLoginAction(formData: FormData) {
    setError(null);
    setLoading(true);
    try {
      const result = await login(formData);
      if (result && !result.success) {
        setError(result.error || "Invalid email or password. Please try again.");
        setLoading(false);
      } else if (result?.success && result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
    } catch (err: any) {
      if (err?.digest?.startsWith?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
        window.location.href = redirectTarget;
        return;
      }
      const rawMsg = err?.message || "";
      if (rawMsg.includes("Minified React error") || rawMsg.includes("Server Components render")) {
        setError("Invalid email or password. Please try again.");
      } else {
        setError(rawMsg || "Invalid email or password. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-border bg-white p-8 shadow-xl sm:p-10">
      {/* Heading */}
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          Customer Portal
        </p>

        <h1 className="mt-2 text-3xl font-extrabold text-foreground">
          Welcome Back
        </h1>

        <p className="mt-2 text-xs text-text-secondary">
          Sign in to manage your appointments, view booking status, and access receipts.
        </p>
      </div>

      {/* URL Messages & Alerts */}
      {searchParams.get("expired") === "true" && !message && (
        <div className="mt-6 flex items-center gap-2.5 rounded-xl bg-amber-50 p-3.5 text-xs font-semibold text-amber-800 border border-amber-200">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span>Your session has expired. Please sign in again to continue.</span>
        </div>
      )}

      {message && (
        <div className="mt-6 flex items-center gap-2.5 rounded-xl bg-green-50 p-3.5 text-xs font-semibold text-green-800 border border-green-200">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {(error || urlError) && (
        <div className="mt-6 flex items-center gap-2.5 rounded-xl bg-red-50 p-3.5 text-xs font-semibold text-red-700 border border-red-200">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <span>{error || urlError}</span>
        </div>
      )}

      {/* Server Action Form */}
      <form action={handleLoginAction} className="mt-8 space-y-5">
        <input type="hidden" name="redirect" value={redirectTarget} />

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
            <Mail size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-bold text-foreground"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="w-full rounded-xl border border-border bg-slate-50/50 p-3 text-xs text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
            />
            <Lock size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-xs font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-60"
        >
          {loading ? (
            <span>Signing in...</span>
          ) : (
            <>
              <span>Sign In to Account</span>
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-8 border-t border-border pt-6 text-center text-xs text-text-secondary">
        Don&apos;t have an account yet?{" "}
        <Link href="/signup" className="font-bold text-primary hover:underline">
          Create an account →
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background-light py-16 sm:py-24">
      <div className="mx-auto w-full max-w-md px-4">
        <Suspense fallback={<div className="h-96 rounded-2xl bg-white animate-pulse" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}