"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error locally in client console without leaking sensitive details
    console.error("[AdminPortal Error Boundary Caught]:", error?.message || error);
  }, [error]);

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-background-light px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md w-full rounded-2xl border border-border bg-white p-6 sm:p-8 text-center shadow-sm space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <AlertTriangle size={28} />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            Admin Console Notice
          </h1>
          <p className="text-sm leading-6 text-text-secondary">
            An unexpected error occurred while loading this administrative view.
            Your session remains active and secure.
          </p>
          {error?.digest && (
            <p className="text-[11px] font-mono text-slate-400">
              Reference: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center pt-2">
          <button
            type="button"
            onClick={handleReload}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-hover shadow-sm"
          >
            <RefreshCw size={15} />
            <span>Reload View</span>
          </button>

          <Link
            href="/admin/dashboard"
            prefetch={false}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-slate-50"
          >
            <LayoutDashboard size={15} />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
