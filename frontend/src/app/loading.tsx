export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background-light">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />

        <p className="mt-4 text-sm font-medium text-text-secondary">
          Loading...
        </p>
      </div>
    </div>
  );
}
