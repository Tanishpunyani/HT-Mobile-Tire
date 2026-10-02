"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

interface CancelBookingModalProps {
  isOpen: boolean;
  isCancelling: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export default function CancelBookingModal({
  isOpen,
  isCancelling,
  onConfirm,
  onClose,
}: CancelBookingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle size={24} />
        </div>
        <h3 className="mt-4 text-lg font-bold text-foreground">Cancel Booking Request</h3>
        <p className="mt-2 text-sm text-text-secondary">
          Are you sure you want to cancel this booking? This will release your scheduled technician slot.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-text-secondary transition hover:bg-background-light"
          >
            Keep Booking
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isCancelling}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isCancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirm Cancellation
          </button>
        </div>
      </div>
    </div>
  );
}
