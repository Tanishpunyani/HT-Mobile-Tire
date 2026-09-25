import Link from "next/link";
import Container from "./components/Container";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background-light px-6">
      <Container>
        <div className="mx-auto max-w-lg text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-primary">
            404
          </p>

          <h1 className="mt-3 text-4xl font-extrabold text-foreground sm:text-5xl">
            Page Not Found
          </h1>

          <p className="mt-4 text-base leading-7 text-text-secondary">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="rounded-[10px] bg-primary px-6 py-3.5 text-sm font-bold text-white transition hover:bg-primary-hover"
            >
              Back Home
            </Link>

            <Link
              href="/services"
              className="rounded-[10px] border border-border px-6 py-3.5 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              View Services
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
