"use client";

import { useState, useRef } from "react";
import { X, Send, Sparkles, Plus, AlertCircle } from "lucide-react";
import { completeAndQuoteAction } from "@/app/actions/bookings";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import {
  SERVICE_NAMES,
  normalizeServiceName,
  ServiceName,
} from "@/lib/constants/services";

export interface BookingWithCustomer {
  id: string;
  primaryService?: string | null;
  service?: { name: string } | null;
  vehicle: string;
  location: string;
  totalAmount?: number | string | null;
  extraServices?: Array<{ name: string; price: number }> | null;
  notes?: string | null;
  customer?: {
    name: string;
    phone: string;
    email?: string | null;
  } | null;
}

interface CompleteQuoteModalProps {
  booking: BookingWithCustomer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CompleteQuoteModal({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: CompleteQuoteModalProps) {
  const rawServiceName = booking?.primaryService || booking?.service?.name || "Flat Tire Repair";
  const primaryServiceName = normalizeServiceName(rawServiceName) || rawServiceName;

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, {
    isOpen: Boolean(isOpen && booking),
    onClose,
  });

  // Derive initial values from existing quote if available (e.g. for re-editing)
  const existingExtras = Array.isArray(booking?.extraServices) ? booking.extraServices : [];
  const existingExtrasMap = new Map(
    existingExtras.map((e) => [normalizeServiceName(e.name), Number(e.price)])
  );
  const existingExtrasSum = existingExtras.reduce(
    (sum, e) => sum + (Number(e.price) || 0),
    0
  );

  const existingTotal = Number(booking?.totalAmount);
  const derivedPrimaryPrice =
    !isNaN(existingTotal) && existingTotal > 0
      ? Math.max(0, existingTotal - existingExtrasSum)
      : undefined;

  const [basePrice, setBasePrice] = useState<string>(() => {
    if (derivedPrimaryPrice !== undefined && derivedPrimaryPrice > 0) {
      return derivedPrimaryPrice.toFixed(2);
    }
    return "";
  });

  const [selectedExtras, setSelectedExtras] = useState<
    Record<string, { checked: boolean; price: string }>
  >(() => {
    const initialExtras: Record<string, { checked: boolean; price: string }> = {};
    SERVICE_NAMES.forEach((serviceName) => {
      const norm = normalizeServiceName(serviceName);
      if (norm !== normalizeServiceName(primaryServiceName)) {
        const hasExisting = existingExtrasMap.has(norm);
        const savedPrice = existingExtrasMap.get(norm);
        initialExtras[serviceName] = {
          checked: hasExisting,
          price: hasExisting && savedPrice !== undefined ? savedPrice.toFixed(2) : "",
        };
      }
    });
    return initialExtras;
  });

  const [notes, setNotes] = useState<string>(() => booking?.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen || !booking) return null;

  // Calculate live total safely
  const numericBase = parseFloat(basePrice);
  const validBasePrice = !isNaN(numericBase) && numericBase > 0 ? numericBase : 0;

  const extraServicesTotal = Object.values(selectedExtras).reduce((acc, item) => {
    if (!item.checked) return acc;
    const p = parseFloat(item.price);
    return acc + (!isNaN(p) && p > 0 ? p : 0);
  }, 0);

  const totalAmount = validBasePrice + extraServicesTotal;

  function handleToggleExtra(serviceName: string) {
    setSelectedExtras((prev) => {
      const current = prev[serviceName] || { checked: false, price: "" };
      const nextChecked = !current.checked;
      return {
        ...prev,
        [serviceName]: {
          checked: nextChecked,
          price: nextChecked ? current.price : "",
        },
      };
    });
  }

  function handleExtraPriceChange(serviceName: string, priceStr: string) {
    setSelectedExtras((prev) => {
      const current = prev[serviceName] || { checked: true, price: "" };
      return {
        ...prev,
        [serviceName]: {
          ...current,
          price: priceStr,
        },
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    const parsedBase = parseFloat(basePrice);
    if (isNaN(parsedBase) || parsedBase <= 0) {
      setErrorMessage(`Please enter a valid price greater than $0.00 for ${primaryServiceName}.`);
      return;
    }

    const activeExtras: Array<{ name: ServiceName; price: number }> = [];
    for (const [extraName, item] of Object.entries(selectedExtras)) {
      if (item.checked) {
        const p = parseFloat(item.price);
        if (isNaN(p) || p < 0) {
          setErrorMessage(`Please enter a valid price for ${extraName}.`);
          return;
        }
        if (p === 0) {
          setErrorMessage(`Please enter a price greater than $0.00 for ${extraName}, or uncheck it.`);
          return;
        }
        activeExtras.push({
          name: extraName as ServiceName,
          price: Math.round(p * 100) / 100,
        });
      }
    }

    if (totalAmount <= 0) {
      setErrorMessage("Total quote amount must be greater than $0.00.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await completeAndQuoteAction({
        bookingId: booking!.id,
        basePrice: Math.round(parsedBase * 100) / 100,
        extraServices: activeExtras,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to send quote.");
        setSubmitting(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const shortId = booking.id.slice(-6).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-quote-modal-title"
        className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close dialog"
          className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-primary">
            <Sparkles size={24} />
          </div>
          <div>
            <h2 id="complete-quote-modal-title" className="text-xl font-extrabold text-slate-900">
              Complete Service & Send Quote
            </h2>
            <p className="text-xs text-slate-500">
              Booking <strong>#{shortId}</strong> • Customer: <strong>{booking.customer?.name || "Customer"}</strong> ({booking.customer?.phone || "No phone"})
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Section 1: Booked Primary Service */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Primary Booked Service
              </label>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-extrabold text-blue-700">
                Primary
              </span>
            </div>

            <div className="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-bold text-slate-900">{primaryServiceName}</p>
                <p className="text-xs text-slate-500">Vehicle: {booking.vehicle}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Service Price ($):</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-right text-sm font-bold text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Add Extra Services */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                <Plus size={14} className="text-primary" />
                Add Extra Services (Optional)
              </label>
              <span className="text-[11px] text-slate-400">Select any performed add-ons</span>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              {Object.entries(selectedExtras).map(([extraName, extraItem]) => (
                <div
                  key={extraName}
                  className={`flex items-center justify-between rounded-lg p-2.5 transition border ${
                    extraItem.checked
                      ? "border-blue-200 bg-blue-50/50"
                      : "border-transparent bg-slate-50/50 hover:bg-slate-100/60"
                  }`}
                >
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={extraItem.checked}
                      onChange={() => handleToggleExtra(extraName)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span
                      className={`text-sm ${
                        extraItem.checked ? "font-bold text-slate-900" : "font-medium text-slate-700"
                      }`}
                    >
                      {extraName}
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      disabled={!extraItem.checked}
                      placeholder="0.00"
                      value={extraItem.price}
                      onChange={(e) => handleExtraPriceChange(extraName, e.target.value)}
                      className={`w-24 rounded-lg border px-2.5 py-1 text-right text-xs font-bold outline-none ${
                        extraItem.checked
                          ? "border-slate-300 bg-white text-slate-900 focus:border-primary"
                          : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Technician Custom Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Technician Notes for Customer (Optional)
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Replaced passenger rear valve stem, torqued lugs to manufacturer spec."
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Section 4: Total Amount Highlight */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-center">
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700">
              Total Service Quote Amount
            </span>
            <div className="mt-1 text-3xl font-black text-slate-900">
              ${totalAmount.toFixed(2)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Customer will receive this itemized breakdown via Email & Account Updates.
            </p>
          </div>

          {/* Section 5: Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Send size={14} />
              {submitting ? "Sending Quote..." : "Send Quote & Mark Complete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

