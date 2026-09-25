"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess("Your password has been updated successfully.");

      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background-light py-16 sm:py-20">
      <div className="mx-auto w-full max-w-md px-6">
        <div className="rounded-[20px] border border-border bg-white p-7 shadow-md sm:p-9">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-primary">
              Customer Account
            </p>

            <h1 className="mt-2 text-3xl font-extrabold text-foreground">
              Create New Password
            </h1>

            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Choose a new password for your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-foreground"
              >
                New Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
                className="w-full rounded-[10px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-semibold text-foreground"
              >
                Confirm New Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Confirm new password"
                autoComplete="new-password"
                className="w-full rounded-[10px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {error && (
              <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-[10px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[10px] bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-text-secondary">
            Remember your password?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:text-primary-hover"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}