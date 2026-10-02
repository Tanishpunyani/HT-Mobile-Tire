export default function Loading() {
  return (
    <div
      className="flex min-h-[200px] items-center justify-center"
      aria-label="Loading"
      role="status"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}