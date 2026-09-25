"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background-light px-6">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <span className="text-2xl">!</span>
        </div>

        <h1 className="mt-6 text-2xl font-extrabold text-foreground">
          Something Went Wrong
        </h1>

        <p className="mt-3 text-sm leading-6 text-text-secondary">
          An unexpected error occurred. Please try again or return to the
          homepage.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-[10px] bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-hover"
          >
            Try Again
          </button>

          <Link
            href="/"
            className="rounded-[10px] border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
          >
            Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
