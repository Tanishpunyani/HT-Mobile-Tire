"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AlertCircle, LockKeyhole, LogIn, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Container from "@/app/components/Container";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(result?.error || "Invalid credentials");
        return;
      }

      window.location.href = "/admin/dashboard";
      return;
    } catch (err) {
      console.error("Admin login error:", err);
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background-light py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-md">
          <div className="rounded-[20px] border border-border bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-white shadow-md">
                <LockKeyhole size={25} />
              </div>

              <h1 className="mt-5 text-2xl font-bold text-foreground">
                Admin Portal
              </h1>

              <p className="mt-2 text-sm text-text-secondary">
                Sign in with server-authorized admin credentials.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-foreground"
                >
                  Admin Email
                </label>

                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@mobiletire.clinic"
                  className="w-full rounded-[10px] border border-border px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-foreground"
                  >
                    Password
                  </label>
                </div>

                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-[10px] border border-border px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-[10px] bg-red-50 p-3.5 text-xs font-semibold text-red-700 border border-red-200">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogIn size={18} />
                {loading ? "Verifying..." : "Sign In as Admin"}
              </button>
            </form>

            <div className="mt-6 border-t border-border pt-4 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-foreground"
              >
                <ArrowLeft size={13} />
                Go to Customer Login
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}