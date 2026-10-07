import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-background-light px-4 py-16">
      <div className="mx-auto max-w-sm w-full rounded-2xl border border-border bg-white p-8 text-center shadow-sm space-y-3">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-text-secondary">
          Loading admin console...
        </p>
      </div>
    </div>
  );
}
