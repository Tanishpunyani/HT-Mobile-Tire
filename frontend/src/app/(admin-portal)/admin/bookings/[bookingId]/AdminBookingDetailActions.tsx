"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  XCircle,
  UserCheck,
  Loader2,
  AlertTriangle,
  Play,
  Send,
  DollarSign,
  Radio,
} from "lucide-react";
import {
  confirmBookingAction,
  cancelBookingAction,
  assignTechnicianAction,
  startServiceAction,
  markBookingPaidAction,
} from "@/app/actions/bookings";
import CompleteQuoteModal, {
  BookingWithCustomer,
} from "@/components/admin/CompleteQuoteModal";
import AdminLiveTrackingModal from "../AdminLiveTrackingModal";

export type BookingForDetailActions = {
  id: string;
  status: string;
  technicianId?: string | null;
  paymentStatus: string;
  totalAmount?: number | string | null;
  extraServices?: Array<{ name: string; price: number }> | null;
  primaryService?: string | null;
  service?: { name: string } | null;
  vehicle: string;
  location: string;
  formattedAddress?: string | null;
  customer?: {
    name: string;
    phone: string;
    email?: string | null;
  } | null;
};

interface Technician {
  id: string;
  name: string;
  role?: string | null;
  phone?: string | null;
}

interface AdminBookingDetailActionsProps {
  booking: BookingForDetailActions;
  technicians: Technician[];
}

export default function AdminBookingDetailActions({
  booking,
  technicians,
}: AdminBookingDetailActionsProps) {
  const router = useRouter();
  const bookingId = booking.id;
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Complete & Quote Modal state
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  // Live GPS Telemetry Modal state
  const [showGpsModal, setShowGpsModal] = useState(false);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  async function handleConfirm() {
    if (loadingAction) return;
    setLoadingAction("confirm");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await confirmBookingAction(bookingId);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to confirm booking.");
        return;
      }
      setSuccessMessage("Booking successfully confirmed and customer notified.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleStartService() {
    if (loadingAction) return;
    setLoadingAction("start");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await startServiceAction(bookingId);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to start service.");
        return;
      }
      setSuccessMessage("Service marked as in-progress.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleMarkPaid() {
    if (loadingAction) return;
    if (!confirm("Confirm payment received from customer for this service?")) return;
    setLoadingAction("paid");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await markBookingPaidAction(bookingId);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to mark booking as paid.");
        return;
      }
      setSuccessMessage("Payment marked as settled (paid).");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleCancel() {
    if (loadingAction) return;
    setLoadingAction("cancel");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await cancelBookingAction(bookingId, cancelReason);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to cancel booking.");
        return;
      }
      setShowCancelModal(false);
      setSuccessMessage("Booking successfully cancelled.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleAssignTechnician(technicianId: string) {
    if (!technicianId || loadingAction) return;
    setLoadingAction("assign");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await assignTechnicianAction(bookingId, technicianId);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to assign technician.");
        return;
      }
      setSuccessMessage("Technician successfully assigned.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          {successMessage}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {/* 1. Confirm Action (Pending) */}
        {booking.status === "pending" && (
          <button
            type="button"
            disabled={!!loadingAction}
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loadingAction === "confirm" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Confirming...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Confirm Booking</span>
              </>
            )}
          </button>
        )}

        {/* 2. Start Service Action (Confirmed) */}
        {booking.status === "confirmed" && (
          <button
            type="button"
            disabled={!!loadingAction}
            onClick={handleStartService}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-60"
          >
            {loadingAction === "start" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>Start Service</span>
              </>
            )}
          </button>
        )}

        {/* 3. Complete & Quote Action (Not Cancelled) */}
        {booking.status !== "cancelled" && (
          <button
            type="button"
            onClick={() => setShowQuoteModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Send size={14} />
            <span>{booking.status === "completed" ? "Edit / Re-send Quote" : "Complete & Quote"}</span>
          </button>
        )}

        {/* 4. Mark Paid Action (Quote Sent) */}
        {booking.paymentStatus === "quote_sent" && (
          <button
            type="button"
            disabled={!!loadingAction}
            onClick={handleMarkPaid}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition disabled:opacity-60 shadow-sm"
          >
            {loadingAction === "paid" ? (
              <>
                <Loader2 size={13} className="animate-spin text-emerald-800" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <DollarSign size={14} />
                <span>Mark as Paid</span>
              </>
            )}
          </button>
        )}

        {/* 5. Live GPS Telemetry Modal Launcher */}
        <button
          type="button"
          onClick={() => setShowGpsModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
        >
          <Radio size={14} className="text-primary" />
          <span>Live GPS Telemetry</span>
        </button>

        {/* 6. Technician Assignment Dropdown */}
        {booking.status !== "cancelled" && (
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-slate-500" />
            <select
              value={booking.technicianId || ""}
              disabled={!!loadingAction}
              onChange={(e) => handleAssignTechnician(e.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm outline-none transition focus:border-primary"
            >
              <option value="" disabled>
                {booking.technicianId ? "Reassign Technician" : "Assign Technician ▼"}
              </option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.role ? `(${t.role})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 7. Cancel Action (Pending or Confirmed) */}
        {(booking.status === "pending" || booking.status === "confirmed") && (
          <button
            type="button"
            disabled={!!loadingAction}
            onClick={() => {
              setCancelReason("");
              setShowCancelModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/70 px-4 py-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
          >
            <XCircle size={14} />
            <span>Cancel Booking</span>
          </button>
        )}
      </div>

      {/* Complete & Quote Modal */}
      {showQuoteModal && (
        <CompleteQuoteModal
          booking={booking as BookingWithCustomer}
          isOpen={showQuoteModal}
          onClose={() => setShowQuoteModal(false)}
          onSuccess={() => {
            setShowQuoteModal(false);
            setSuccessMessage("Quote successfully saved and sent to customer.");
            router.refresh();
          }}
        />
      )}

      {/* Live GPS Telemetry Modal */}
      {showGpsModal && (
        <AdminLiveTrackingModal
          bookingId={booking.id}
          customerName={booking.customer?.name || "Customer"}
          customerAddress={booking.formattedAddress || booking.location}
          isOpen={showGpsModal}
          onClose={() => setShowGpsModal(false)}
        />
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-2 text-red-600 font-bold text-base mb-2">
              <AlertTriangle size={20} />
              <span>Cancel Booking</span>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Are you sure you want to cancel this booking? The customer and central dispatch will be notified.
            </p>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Cancellation Reason (Optional):
            </label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Customer requested rescheduling or duplicate booking."
              className="w-full rounded-xl border border-border p-3 text-xs outline-none focus:border-red-400 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={loadingAction === "cancel"}
                onClick={() => setShowCancelModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={loadingAction === "cancel"}
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {loadingAction === "cancel" && <Loader2 size={13} className="animate-spin" />}
                <span>Confirm Cancellation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
