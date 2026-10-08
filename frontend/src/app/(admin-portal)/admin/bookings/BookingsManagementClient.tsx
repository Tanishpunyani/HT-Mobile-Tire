"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Receipt,
  Radio,
  MapPin,
  Send,
  Play,
  Check,
  DollarSign,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";
import CompleteQuoteModal, {
  BookingWithCustomer,
} from "@/components/admin/CompleteQuoteModal";
import AdminLiveTrackingModal from "./AdminLiveTrackingModal";
import {
  confirmBookingAction,
  startServiceAction,
  markBookingPaidAction,
  assignTechnicianAction,
  cancelBookingAction,
} from "@/app/actions/bookings";
import { createClient } from "@/lib/supabase/client";
import { formatAdminDate, formatAdminTime } from "@/lib/utils/date-format";

export type Technician = {
  id: string;
  name: string;
  role?: string | null;
  phone?: string | null;
  isActive?: boolean;
};

export type Booking = {
  id: string;
  primaryService?: string | null;
  service?: { name: string } | null;
  vehicle: string;
  location: string;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bookingDate: string;
  bookingTime: string;
  status: string;
  arrivedAt?: string | null;
  technicianId?: string | null;
  technician?: {
    id?: string;
    name: string;
    role?: string;
    phone?: string | null;
  } | null;
  paymentStatus: string;
  totalAmount?: number | string | null;
  extraServices?: Array<{ name: string; price: number }> | null;
  tireSize?: string | null;
  notes?: string | null;
  customer: {
    name: string;
    phone: string;
    email?: string | null;
  } | null;
};

interface BookingsManagementClientProps {
  initialBookings?: Booking[];
  initialTechnicians?: Technician[];
}

export default function BookingsManagementClient({
  initialBookings,
  initialTechnicians,
}: BookingsManagementClientProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings || []);
  const [technicians, setTechnicians] = useState<Technician[]>(initialTechnicians || []);
  const [loading, setLoading] = useState(initialBookings === undefined);
  const [error, setError] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<{
    id: string;
    action: "confirm" | "start" | "paid";
  } | null>(null);

  // Live GPS Telemetry Modal state
  const [trackingModalBooking, setTrackingModalBooking] = useState<Booking | null>(null);

  // Complete & Quote Modal state
  const [selectedBookingForQuote, setSelectedBookingForQuote] =
    useState<BookingWithCustomer | null>(null);

  // Cancel Booking Modal state
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Lifecycle & concurrency guards
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const pendingRefreshRef = useRef(false);

  const loadBookings = useCallback(async (silent = false) => {
    if (isFetchingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }

    try {
      isFetchingRef.current = true;
      if (!silent && bookings.length === 0) {
        setLoading(true);
      }
      if (!silent) {
        setError("");
      }

      const response = await fetch("/api/admin/bookings", {
        credentials: "include",
      });
      const data = await response.json();

      if (!isMountedRef.current) return;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load bookings.");
      }

      setBookings(data.bookings || []);
      if (data.technicians && Array.isArray(data.technicians)) {
        setTechnicians(data.technicians);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        console.error("[AdminBookings] Error loading bookings:", err);
        if (!silent) {
          setError((err as Error)?.message || "Unable to load bookings.");
        }
      }
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
        if (pendingRefreshRef.current) {
          pendingRefreshRef.current = false;
          void loadBookings(true);
        }
      }
    }
  }, [bookings.length]);

  // Initial load if not provided via Server Component props
  useEffect(() => {
    isMountedRef.current = true;
    if (!initialBookings) {
      void loadBookings(false);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [loadBookings, initialBookings]);

  // Realtime Subscription on public.bookings (INSERT, UPDATE, DELETE)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-bookings-sync")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookings",
        },
        () => {
          void loadBookings(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
        },
        () => {
          void loadBookings(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "bookings",
        },
        () => {
          void loadBookings(true);
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.debug("[AdminBookings Realtime] Subscription status:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadBookings]);

  // Window Focus Recovery: silently synchronize bookings when returning to the tab
  useEffect(() => {
    function handleFocus() {
      void loadBookings(true);
    }

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadBookings]);

  async function handleAssignTechnician(bookingId: string, technicianId: string) {
    if (!technicianId || assigningId === bookingId) return;
    try {
      setAssigningId(bookingId);
      const res = await assignTechnicianAction(bookingId, technicianId);
      if (!res.success) {
        alert(res.error || "Failed to assign technician.");
        return;
      }
      await loadBookings(true);
    } catch (err: unknown) {
      alert((err as Error)?.message || "Error assigning technician.");
    } finally {
      setAssigningId(null);
    }
  }

  async function handleConfirm(id: string) {
    if (actionPending?.id === id) return;
    try {
      setActionPending({ id, action: "confirm" });
      const res = await confirmBookingAction(id);
      if (!res.success) {
        alert(res.error || "Failed to confirm booking.");
        return;
      }
      await loadBookings(true);
    } catch (err: unknown) {
      alert((err as Error)?.message || "Error confirming booking.");
    } finally {
      setActionPending(null);
    }
  }

  async function handleStartService(id: string) {
    if (actionPending?.id === id) return;
    try {
      setActionPending({ id, action: "start" });
      const res = await startServiceAction(id);
      if (!res.success) {
        alert(res.error || "Failed to start service.");
        return;
      }
      await loadBookings(true);
    } catch (err: unknown) {
      alert((err as Error)?.message || "Error starting service.");
    } finally {
      setActionPending(null);
    }
  }

  async function handleMarkPaid(id: string) {
    if (actionPending?.id === id) return;
    if (!confirm("Confirm payment received from customer for this service?")) return;
    try {
      setActionPending({ id, action: "paid" });
      const res = await markBookingPaidAction(id);
      if (!res.success) {
        alert(res.error || "Failed to mark booking as paid.");
        return;
      }
      await loadBookings(true);
    } catch (err: unknown) {
      alert((err as Error)?.message || "Error updating payment status.");
    } finally {
      setActionPending(null);
    }
  }

  async function handleCancelBooking() {
    if (!cancellingBooking || isCancelling) return;
    try {
      setIsCancelling(true);
      const res = await cancelBookingAction(cancellingBooking.id, cancelReason);
      if (!res.success) {
        alert(res.error || "Failed to cancel booking.");
        return;
      }
      setCancellingBooking(null);
      setCancelReason("");
      await loadBookings(true);
    } catch (err: unknown) {
      alert((err as Error)?.message || "Error cancelling booking.");
    } finally {
      setIsCancelling(false);
    }
  }

  function formatDate(date: string) {
    return formatAdminDate(date);
  }

  function formatTime(time: string) {
    return formatAdminTime(time);
  }

  function renderStatusBadge(status: string, arrivedAt?: string | null) {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
            Pending Dispatch
          </span>
        );
      case "confirmed":
        return (
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
              Confirmed
            </span>
            {arrivedAt && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800 border border-emerald-300">
                Arrived On-Site
              </span>
            )}
          </div>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">
            In Progress
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
            Completed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 border border-red-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
            {status}
          </span>
        );
    }
  }

  function renderPaymentBadge(paymentStatus: string, totalAmount?: number | string | null) {
    const total = totalAmount ? Number(totalAmount) : null;

    switch (paymentStatus) {
      case "quote_sent":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-800 border border-orange-200">
            <Send size={11} />
            Quote Sent {total ? `($${total.toFixed(2)})` : ""}
          </span>
        );
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 border border-emerald-300">
            <CheckCircle2 size={12} />
            Paid {total ? `($${total.toFixed(2)})` : ""}
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            Quote Pending
          </span>
        );
    }
  }

  return (
    <div className="min-h-screen bg-background-light py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Admin Console
            </p>

            <h1 className="mt-1 text-3xl font-extrabold text-foreground sm:text-4xl">
              Booking & Quote Management
            </h1>

            <p className="mt-2 text-sm text-text-secondary">
              Review incoming service requests, dispatch technicians, and send itemized post-service quotes.
            </p>
          </div>

          <Link
            href="/admin/dashboard"
            className="inline-flex w-fit items-center rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mt-8 rounded-2xl border border-border bg-white p-12 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
            <p className="mt-3 text-sm text-text-secondary">Loading bookings and quotes...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && bookings.length === 0 && (
          <div className="mt-8 rounded-2xl border border-border bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-primary">
              <Receipt size={32} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">No bookings yet</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Customer booking requests will appear here when they are submitted.
            </p>
          </div>
        )}

        {/* Bookings List / Table */}
        {!loading && !error && bookings.length > 0 && (
          <div className="mt-8">
            {/* Mobile Cards View (< md) */}
            <div className="md:hidden space-y-4">
              {bookings.map((booking) => {
                const primaryServiceName =
                  booking.primaryService || booking.service?.name || "Mobile Tire Service";

                const mapUrl =
                  booking.latitude && booking.longitude
                    ? `https://www.google.com/maps/dir/?api=1&destination=${booking.latitude},${booking.longitude}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        booking.location
                      )}`;

                return (
                  <div
                    key={`mobile-${booking.id}`}
                    className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-4"
                  >
                    {/* Header: Customer & Badges */}
                    <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                      <div>
                        <p className="font-bold text-base text-foreground">
                          {booking.customer?.name || "N/A"}
                        </p>
                        <a
                          href={`tel:${booking.customer?.phone}`}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          {booking.customer?.phone || "No phone"}
                        </a>
                        {booking.customer?.email && (
                          <p className="text-[11px] text-slate-400 break-all">{booking.customer.email}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {renderStatusBadge(booking.status, booking.arrivedAt)}
                        {renderPaymentBadge(booking.paymentStatus, booking.totalAmount)}
                      </div>
                    </div>

                    {/* Technician Dispatch / Assignment Section (Mobile) */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs">
                      {booking.status === "confirmed" ? (
                        <div>
                          {booking.technician ? (
                            <div className="space-y-2">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                                  Assigned Technician
                                </p>
                                <p className="font-bold text-sm text-slate-900">{booking.technician.name}</p>
                                <p className="text-xs text-slate-600 font-medium">
                                  {booking.technician.role || "Tire Technician"}
                                </p>
                                {booking.technician.phone && (
                                  <p className="text-[11px] text-slate-500">{booking.technician.phone}</p>
                                )}
                              </div>
                              <div className="pt-2 border-t border-slate-200">
                                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                                  Reassign Technician:
                                </label>
                                <select
                                  value={booking.technicianId || ""}
                                  disabled={assigningId === booking.id}
                                  onChange={(e) => handleAssignTechnician(booking.id, e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-500 shadow-sm"
                                >
                                  <option value="" disabled>Select Technician ▼</option>
                                  {technicians.map((tech) => (
                                    <option key={tech.id} value={tech.id}>
                                      {tech.name} — {tech.role || "Tire Technician"}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-amber-900 block">
                                Assigned Technician:
                              </label>
                              <select
                                value=""
                                disabled={assigningId === booking.id}
                                onChange={(e) => handleAssignTechnician(booking.id, e.target.value)}
                                className="w-full rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-900 shadow-sm focus:border-blue-500 focus:bg-white"
                              >
                                <option value="" disabled>Select Technician ▼</option>
                                {technicians.map((tech) => (
                                  <option key={tech.id} value={tech.id}>
                                    {tech.name} — {tech.role || "Tire Technician"}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Technician
                          </p>
                          {booking.technician ? (
                            <div>
                              <p className="font-bold text-slate-900">{booking.technician.name}</p>
                              <p className="text-slate-600">{booking.technician.role || "Tire Technician"}</p>
                            </div>
                          ) : (
                            <p className="italic text-slate-500">None assigned</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Service & Vehicle Details */}
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Service</p>
                        <p className="font-semibold text-foreground">{primaryServiceName}</p>
                        {booking.extraServices && Array.isArray(booking.extraServices) && booking.extraServices.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {booking.extraServices.map((extra, idx) => (
                              <span
                                key={idx}
                                className="inline-flex rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700"
                              >
                                +{extra.name} (${extra.price})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Vehicle</p>
                          <p className="font-medium text-foreground">{booking.vehicle}</p>
                          {booking.tireSize && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700">
                              🛞 {booking.tireSize}
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Requested</p>
                          <p className="font-medium text-foreground">{formatDate(booking.bookingDate)}</p>
                          <p className="text-xs text-text-secondary">{formatTime(booking.bookingTime)}</p>
                        </div>
                      </div>

                      <div className="pt-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Location</p>
                        <p className="text-xs text-foreground font-medium break-words">
                          {booking.formattedAddress || booking.location}
                        </p>
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 font-bold text-primary hover:underline text-xs"
                        >
                          <MapPin size={12} />
                          <span>Route in Maps →</span>
                        </a>
                      </div>

                      {booking.notes && (
                        <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-text-secondary">
                          <span className="font-bold text-foreground">Notes: </span>
                          {booking.notes}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="border-t border-border pt-3 flex flex-col gap-2">
                      {/* 1. Pending -> Confirm */}
                      {booking.status === "pending" && (
                        <button
                          type="button"
                          disabled={actionPending?.id === booking.id}
                          onClick={() => handleConfirm(booking.id)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 shadow-sm disabled:opacity-60"
                        >
                          {actionPending?.id === booking.id && actionPending.action === "confirm" ? (
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

                      {/* 2. Confirmed -> Start Service */}
                      {booking.status === "confirmed" && (
                        <button
                          type="button"
                          disabled={actionPending?.id === booking.id}
                          onClick={() => handleStartService(booking.id)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-purple-700 shadow-sm disabled:opacity-60"
                        >
                          {actionPending?.id === booking.id && actionPending.action === "start" ? (
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

                      {/* 3. In Progress (or any active) -> Complete & Quote */}
                      {booking.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() => setSelectedBookingForQuote(booking)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 shadow-sm"
                        >
                          <Send size={14} />
                          {booking.status === "completed" ? "Edit / Re-send Quote" : "Complete & Quote"}
                        </button>
                      )}

                      {/* 4. Quote Sent -> Mark Paid */}
                      {booking.paymentStatus === "quote_sent" && (
                        <button
                          type="button"
                          disabled={actionPending?.id === booking.id}
                          onClick={() => handleMarkPaid(booking.id)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition disabled:opacity-60"
                        >
                          {actionPending?.id === booking.id && actionPending.action === "paid" ? (
                            <>
                              <Loader2 size={14} className="animate-spin text-emerald-800" />
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

                      {/* Live GPS Telemetry */}
                      <button
                        type="button"
                        onClick={() => setTrackingModalBooking(booking)}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <Radio size={14} className="text-primary" />
                        Live GPS Telemetry
                      </button>

                      {/* 5. Cancel Booking for Pending or Confirmed */}
                      {(booking.status === "pending" || booking.status === "confirmed") && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancellingBooking(booking);
                            setCancelReason("");
                          }}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50/70 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                        >
                          <XCircle size={14} />
                          Cancel Booking
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-[1200px] w-full text-left">
                  <thead className="border-b border-border bg-slate-50">
                    <tr>
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Customer</th>
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Primary Service</th>
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Vehicle</th>
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Location</th>
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Schedule</th>
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Status & Tech</th>
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Quote / Payment</th>
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {bookings.map((booking) => {
                      const primaryServiceName =
                        booking.primaryService || booking.service?.name || "Mobile Tire Service";

                      return (
                        <tr key={booking.id} className="hover:bg-slate-50/70 transition">
                          {/* Customer */}
                          <td className="px-5 py-4 text-sm">
                            <p className="font-bold text-foreground">{booking.customer?.name || "N/A"}</p>
                            <p className="text-xs text-text-secondary">{booking.customer?.phone || "No phone"}</p>
                            {booking.customer?.email && (
                              <p className="text-[11px] text-slate-400">{booking.customer.email}</p>
                            )}
                          </td>

                          {/* Primary Service */}
                          <td className="px-5 py-4 text-sm">
                            <span className="font-semibold text-foreground">{primaryServiceName}</span>
                            {booking.extraServices && Array.isArray(booking.extraServices) && booking.extraServices.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {booking.extraServices.map((extra, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700"
                                  >
                                    +{extra.name} (${extra.price})
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Vehicle & Tire Size */}
                          <td className="px-5 py-4 text-sm">
                            <p className="font-medium text-foreground">{booking.vehicle}</p>
                            {booking.tireSize && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700">
                                🛞 {booking.tireSize}
                              </span>
                            )}
                          </td>

                          {/* Location */}
                          <td className="max-w-[200px] px-5 py-4 text-xs text-text-secondary">
                            <p className="truncate font-medium text-foreground">
                              {booking.formattedAddress || booking.location}
                            </p>
                            <a
                              href={
                                booking.latitude && booking.longitude
                                  ? `https://www.google.com/maps/dir/?api=1&destination=${booking.latitude},${booking.longitude}`
                                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                      booking.location
                                    )}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 font-bold text-primary hover:underline text-[11px]"
                            >
                              <MapPin size={11} />
                              <span>Route in Maps →</span>
                            </a>
                          </td>

                          {/* Schedule */}
                          <td className="px-5 py-4 text-sm text-text-secondary">
                            <p className="font-medium text-foreground">{formatDate(booking.bookingDate)}</p>
                            <p className="text-xs">{formatTime(booking.bookingTime)}</p>
                          </td>

                          {/* Status & Technician */}
                          <td className="px-5 py-4 min-w-[220px]">
                            {renderStatusBadge(booking.status, booking.arrivedAt)}

                            {/* Technician assignment for Confirmed bookings */}
                            {booking.status === "confirmed" ? (
                              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/70 p-2 text-xs">
                                {booking.technician ? (
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                                      Assigned Technician:
                                    </p>
                                    <p className="font-bold text-slate-900">{booking.technician.name}</p>
                                    <p className="text-[11px] text-slate-600 font-medium">
                                      {booking.technician.role || "Tire Technician"}
                                    </p>
                                    {booking.technician.phone && (
                                      <p className="text-[10px] text-slate-500">{booking.technician.phone}</p>
                                    )}

                                    {/* Reassignment Control */}
                                    <div className="mt-1.5 pt-1.5 border-t border-blue-200/70">
                                      <label className="text-[10px] font-semibold text-blue-900 block mb-0.5">
                                        Reassign:
                                      </label>
                                      <select
                                        value={booking.technicianId || ""}
                                        disabled={assigningId === booking.id}
                                        onChange={(e) => handleAssignTechnician(booking.id, e.target.value)}
                                        className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] text-slate-800 focus:border-blue-500 shadow-sm"
                                      >
                                        <option value="" disabled>Select Technician ▼</option>
                                        {technicians.map((tech) => (
                                          <option key={tech.id} value={tech.id}>
                                            {tech.name} — {tech.role || "Tire Technician"}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">
                                      Assigned Technician:
                                    </label>
                                    <select
                                      value=""
                                      disabled={assigningId === booking.id}
                                      onChange={(e) => handleAssignTechnician(booking.id, e.target.value)}
                                      className="w-full rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-bold text-amber-900 shadow-sm focus:border-amber-500 focus:bg-white"
                                    >
                                      <option value="" disabled>Select Technician ▼</option>
                                      {technicians.map((tech) => (
                                        <option key={tech.id} value={tech.id}>
                                          {tech.name} — {tech.role || "Tire Technician"}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            ) : (
                              booking.technician && (
                                <div className="mt-1.5 text-xs">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Assigned Technician
                                  </p>
                                  <p className="font-semibold text-slate-800">{booking.technician.name}</p>
                                  <p className="text-[11px] text-slate-500">
                                    {booking.technician.role || "Tire Technician"}
                                  </p>
                                </div>
                              )
                            )}
                          </td>

                          {/* Payment / Quote Status */}
                          <td className="px-5 py-4">
                            {renderPaymentBadge(booking.paymentStatus, booking.totalAmount)}
                          </td>

                          {/* Action Buttons */}
                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1.5 min-w-[170px]">
                              {/* 1. Pending -> Confirm */}
                              {booking.status === "pending" && (
                                <button
                                  type="button"
                                  disabled={actionPending?.id === booking.id}
                                  onClick={() => handleConfirm(booking.id)}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 shadow-sm disabled:opacity-60"
                                >
                                  {actionPending?.id === booking.id && actionPending.action === "confirm" ? (
                                    <>
                                      <Loader2 size={13} className="animate-spin" />
                                      <span>Confirming...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check size={13} />
                                      <span>Confirm Booking</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* 2. Confirmed -> Start Service */}
                              {booking.status === "confirmed" && (
                                <button
                                  type="button"
                                  disabled={actionPending?.id === booking.id}
                                  onClick={() => handleStartService(booking.id)}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-purple-700 shadow-sm disabled:opacity-60"
                                >
                                  {actionPending?.id === booking.id && actionPending.action === "start" ? (
                                    <>
                                      <Loader2 size={13} className="animate-spin" />
                                      <span>Starting...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play size={13} />
                                      <span>Start Service</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* 3. In Progress (or any active) -> Complete & Quote */}
                              {booking.status !== "cancelled" && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedBookingForQuote(booking)}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 shadow-sm"
                                >
                                  <Send size={13} />
                                  {booking.status === "completed" ? "Edit / Re-send Quote" : "Complete & Quote"}
                                </button>
                              )}

                              {/* 4. Quote Sent -> Mark Paid */}
                              {booking.paymentStatus === "quote_sent" && (
                                <button
                                  type="button"
                                  disabled={actionPending?.id === booking.id}
                                  onClick={() => handleMarkPaid(booking.id)}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition disabled:opacity-60"
                                >
                                  {actionPending?.id === booking.id && actionPending.action === "paid" ? (
                                    <>
                                      <Loader2 size={12} className="animate-spin text-emerald-800" />
                                      <span>Updating...</span>
                                    </>
                                  ) : (
                                    <>
                                      <DollarSign size={12} />
                                      <span>Mark as Paid</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Live GPS Telemetry */}
                              <button
                                type="button"
                                onClick={() => setTrackingModalBooking(booking)}
                                className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                              >
                                <Radio size={12} className="text-primary" />
                                Live GPS
                              </button>

                              {/* 5. Cancel Booking for Pending or Confirmed */}
                              {(booking.status === "pending" || booking.status === "confirmed") && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancellingBooking(booking);
                                    setCancelReason("");
                                  }}
                                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                                >
                                  <XCircle size={12} />
                                  Cancel Booking
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Live GPS Telemetry Modal */}
        {trackingModalBooking && (
          <AdminLiveTrackingModal
            bookingId={trackingModalBooking.id}
            customerName={trackingModalBooking.customer?.name || "Customer"}
            customerAddress={trackingModalBooking.formattedAddress || trackingModalBooking.location}
            isOpen={Boolean(trackingModalBooking)}
            onClose={() => setTrackingModalBooking(null)}
          />
        )}

        {/* Complete & Quote Modal */}
        {selectedBookingForQuote && (
          <CompleteQuoteModal
            booking={selectedBookingForQuote}
            isOpen={Boolean(selectedBookingForQuote)}
            onClose={() => setSelectedBookingForQuote(null)}
            onSuccess={() => {
              setSelectedBookingForQuote(null);
              void loadBookings(true);
            }}
          />
        )}

        {/* Cancel Booking Confirmation Modal */}
        {cancellingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-border space-y-4">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Cancel Booking</h3>
                  <p className="text-xs text-text-secondary">
                    Booking #{cancellingBooking.id.slice(-6).toUpperCase()} • {cancellingBooking.customer?.name}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 space-y-1">
                <p className="font-bold">⚠️ Warning: Cancellation cannot be undone.</p>
                <p>
                  Cancelling this booking will immediately halt active dispatch operations, notify the customer, and alert the assigned technician (if any).
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Cancellation Reason (Optional):
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g., Customer requested cancellation, out of service area"
                  className="w-full rounded-xl border border-border px-3 py-2 text-xs text-foreground focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setCancellingBooking(null)}
                  className="rounded-xl border border-border bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Keep Booking
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleCancelBooking}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition disabled:opacity-50"
                >
                  {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
