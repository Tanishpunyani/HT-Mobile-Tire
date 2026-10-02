"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Car,
  MapPin,
  CalendarDays,
  Clock3,
  User,
  CheckCircle2,
  Wrench,
  Siren,
  Download,
  Star,
  XCircle,
  AlertCircle,
  Phone,
  Mail,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Container from "@/app/components/Container";
import BookingLifecycleProgress from "@/app/components/BookingLifecycleProgress";
import LiveVanTracker from "@/app/components/LiveVanTracker";
import ReviewModal from "@/app/components/ReviewModal";
import { cancelCustomerBookingAction } from "@/app/actions/bookings";
import { createClient } from "@/lib/supabase/client";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";

type BookingDetail = {
  id: string;
  customerId: string | null;
  serviceId: string | null;
  technicianId?: string | null;
  technician?: {
    id: string;
    name: string;
    role: string;
    phone?: string | null;
  } | null;
  primaryService?: string | null;
  extraServices?: Array<{ name: string; price: number }> | null;
  totalAmount?: number | string | null;
  notes?: string | null;
  vehicle: string;
  location: string;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  tireSize?: string | null;
  bookingDate: string;
  bookingTime: string;
  message?: string | null;
  status: string;
  paymentStatus?: string;
  arrivedAt?: string | null;
  serviceConfirmedAt?: string | null;
  createdAt?: string;
  bookedAt?: string;
  etaMinutes?: number | null;
  estimatedArrivalAt?: string | null;
  arrivalStatus?: "unavailable" | "updating" | "estimated" | "arrived" | "in_progress";
  distanceMiles?: number | null;
  etaUpdatedAt?: string | null;
  service?: {
    name: string;
  } | null;
  reviews?: Array<{
    id: string;
    rating: number;
    isApproved: boolean;
  }>;
};

export default function BookingTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = (params?.bookingId as string) || "";

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<{
    type: "not_found" | "unauthorized" | "server_error";
    message: string;
  } | null>(null);

  const [reviewModalBooking, setReviewModalBooking] = useState<BookingDetail | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const loadBookingData = useCallback(
    async (isRetry = false) => {
      if (!bookingId) return;

      if (isRetry) {
        setRetrying(true);
      }
      setErrorState(null);

      try {
        const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
          cache: "no-store",
        });

        if (!isMountedRef.current) return;

        if (res.status === 401) {
          setErrorState({
            type: "unauthorized",
            message: "Please sign in to view this service booking.",
          });
          router.push(
            `/login?redirect=${encodeURIComponent(`/account/bookings/${bookingId}`)}`
          );
          return;
        }

        if (res.status === 404) {
          setErrorState({
            type: "not_found",
            message: "We couldn't locate this service booking in your account.",
          });
          return;
        }

        if (!res.ok) {
          setErrorState({
            type: "server_error",
            message: "Unable to retrieve service tracking data. Please retry.",
          });
          return;
        }

        const data = await res.json();
        if (!isMountedRef.current) return;

        if (data.success && data.booking) {
          setBooking(data.booking);
          setErrorState(null);
        } else {
          setErrorState({
            type: "not_found",
            message: data.error || "Booking not found.",
          });
        }
      } catch (err: unknown) {
        console.debug("[BookingTrackingPage] Fetch error:", err);
        if (isMountedRef.current) {
          setErrorState({
            type: "server_error",
            message:
              err instanceof Error
                ? err.message
                : "Connection error. Please check your network.",
          });
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRetrying(false);
        }
      }
    },
    [bookingId, router]
  );

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => {
      void loadBookingData();
    }, 0);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
    };
  }, [loadBookingData]);

  // Realtime subscription: Listen to UPDATE events on this specific booking
  useEffect(() => {
    if (!bookingId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`booking-tracking-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `id=eq.${bookingId}`,
        },
        () => {
          // Silently refresh authoritative booking state without full-page spinner
          void loadBookingData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "technician_locations",
          filter: `booking_id=eq.${bookingId}`,
        },
        () => {
          // Silently refresh dynamic ETA when technician location updates
          void loadBookingData();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.debug("[BookingTrackingPage Realtime] Channel status:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, loadBookingData]);

  // Window Focus Recovery: refresh status when customer returns to tab
  useEffect(() => {
    function handleWindowFocus() {
      loadBookingData();
    }

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [loadBookingData]);

  async function handleCustomerCancel() {
    if (!booking) return;
    if (
      !window.confirm(
        "Are you sure you want to cancel this pending booking request?"
      )
    ) {
      return;
    }

    try {
      setIsCancelling(true);
      const res = await cancelCustomerBookingAction(booking.id);
      if (!res.success) {
        alert(res.error || "Failed to cancel booking request.");
        return;
      }
      await loadBookingData();
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : "Error cancelling booking request."
      );
    } finally {
      if (isMountedRef.current) {
        setIsCancelling(false);
      }
    }
  }

  // 1. Loading Skeleton State
  if (loading) {
    return (
      <div className="min-h-screen bg-background-light py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="h-6 w-40 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-44 animate-pulse rounded-3xl bg-white border border-border p-8" />
            <div className="h-64 animate-pulse rounded-3xl bg-white border border-border p-8" />
          </div>
        </Container>
      </div>
    );
  }

  // 2. Error / Not Found State
  if (errorState || !booking) {
    return (
      <div className="min-h-screen bg-background-light py-20">
        <Container>
          <div className="mx-auto max-w-md rounded-3xl border border-border bg-white p-8 text-center shadow-xl sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
              <AlertCircle size={28} />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-foreground">
              Booking Not Found
            </h1>
            <p className="mt-2 text-xs leading-5 text-text-secondary">
              {errorState?.message ||
                "We couldn't locate this service booking in your account."}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => loadBookingData(true)}
                disabled={retrying}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-white shadow-md transition hover:bg-primary-hover disabled:opacity-60"
              >
                <RefreshCw size={14} className={retrying ? "animate-spin" : ""} />
                <span>{retrying ? "Retrying..." : "Retry Connection"}</span>
              </button>
              <Link
                href="/account?tab=bookings"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-5 py-3 text-xs font-semibold text-text-secondary transition hover:bg-slate-50 hover:text-foreground"
              >
                <ArrowLeft size={14} />
                <span>My Bookings</span>
              </Link>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // Render variables
  const isCompleted = booking.status === "completed";
  const primaryServiceName =
    booking.primaryService || booking.service?.name || "Mobile Tire Service";
  const shortId = booking.id.slice(-6).toUpperCase();
  const totalAmountNum = Number(booking.totalAmount) || 0;
  const extraServices = Array.isArray(booking.extraServices)
    ? booking.extraServices
    : [];
  const extraServicesSum = extraServices.reduce(
    (sum, item) => sum + (Number(item.price) || 0),
    0
  );
  const primaryServiceAmount = Math.max(0, totalAmountNum - extraServicesSum);

  const rawBookedTimestamp = booking.bookedAt || booking.createdAt;
  const formattedBookedAt = rawBookedTimestamp
    ? new Date(rawBookedTimestamp).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-background-light pb-20">
      {/* Top Banner Header */}
      <section className="border-b border-border bg-secondary py-8 sm:py-10 text-white">
        <Container>
          <div className="mx-auto max-w-4xl">
            {/* Deterministic Back Navigation */}
            <Link
              href="/account?tab=bookings"
              aria-label="Back to My Bookings"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 transition hover:text-white mb-4 group"
            >
              <ArrowLeft size={15} className="transition group-hover:-translate-x-1" />
              <span>Back to My Bookings</span>
            </Link>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary/20 px-2.5 py-0.5 text-xs font-mono font-bold text-primary border border-primary/30">
                    #{shortId}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Service Tracking
                  </span>
                </div>

                <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl tracking-tight">
                  {primaryServiceName}
                </h1>

                <p className="mt-1 text-xs sm:text-sm text-slate-300">
                  {booking.vehicle} • On-Demand 24/7 Service
                </p>

                {formattedBookedAt && (
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Booked on {formattedBookedAt}
                  </p>
                )}
              </div>

              {/* Status Badge */}
              <div className="self-start sm:self-center" aria-live="polite">
                <span
                  className={`inline-flex items-center rounded-full px-3.5 py-1 text-xs font-extrabold capitalize border ${
                    booking.status === "completed"
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                      : booking.status === "confirmed"
                      ? "bg-blue-950/80 text-blue-300 border-blue-700"
                      : booking.status === "in_progress"
                      ? "bg-purple-950/80 text-purple-300 border-purple-700 animate-pulse"
                      : booking.status === "cancelled"
                      ? "bg-red-950/80 text-red-300 border-red-700"
                      : "bg-amber-950/80 text-amber-300 border-amber-700"
                  }`}
                >
                  {booking.status.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Main Content Area */}
      <main aria-label="Service Tracking" className="pt-8 sm:pt-10">
        <Container>
          <div className="mx-auto max-w-4xl grid gap-6 lg:grid-cols-3">
            {/* Primary Column (2 Cols) */}
            <div className="space-y-6 lg:col-span-2">
              {/* 1. Reusable 4-Step Milestone Roadmap */}
              <section aria-label="Service Roadmap">
                <BookingLifecycleProgress booking={booking} />
              </section>

              {/* 2. Live Technician Van Tracker for Active Bookings */}
              {(booking.status === "confirmed" || booking.status === "in_progress") && (
                <section aria-label="Live Technician Van Tracking">
                  <LiveVanTracker
                    bookingId={booking.id}
                    customerAddress={booking.formattedAddress || booking.location}
                    customerLat={booking.latitude}
                    customerLng={booking.longitude}
                    bookingStatus={booking.status}
                    onStatusChange={(newStatus) => {
                      setBooking((prev) => (prev ? { ...prev, status: newStatus } : null));
                    }}
                  />
                </section>
              )}

              {booking.status === "pending" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
                      <Clock3 size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-amber-950">
                        Booking Request Received
                      </h3>
                      <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                        Our dispatch team is currently reviewing your schedule and allocating a mobile tire service van. You will receive an update as soon as your booking is confirmed.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Service Appointment Details Card */}
              <div className="rounded-2xl border border-border bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider border-b border-border/60 pb-3">
                  Service & Location Details
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Car size={16} className="mt-0.5 shrink-0 text-primary" />
                    <div>
                      <span className="font-semibold text-text-secondary block">
                        Vehicle
                      </span>
                      <span className="font-bold text-foreground text-sm">
                        {booking.vehicle}
                      </span>
                      {booking.tireSize && (
                        <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700">
                          Tire Size: {booking.tireSize}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                    <div>
                      <span className="font-semibold text-text-secondary block">
                        Service Location
                      </span>
                      <span className="font-bold text-foreground leading-snug">
                        {booking.formattedAddress || booking.location}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Clock3 size={16} className="mt-0.5 shrink-0 text-primary" />
                    <div>
                      <span className="font-semibold text-text-secondary block">
                        Request Placed
                      </span>
                      <span className="font-bold text-foreground">
                        {formattedBookedAt || "Recorded upon submission"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Sparkles size={16} className="mt-0.5 shrink-0 text-primary" />
                    <div>
                      <span className="font-semibold text-text-secondary block">
                        Dispatch Model
                      </span>
                      <span className="font-bold text-foreground">
                        On-Demand 24/7 Dispatch
                      </span>
                    </div>
                  </div>
                </div>

                {/* Assigned Technician Banner */}
                {booking.technician && (
                  <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 rounded-xl bg-blue-50/70 p-3 text-xs text-blue-900 border border-blue-200">
                    <User size={16} className="text-primary shrink-0" />
                    <div>
                      <span>
                        Assigned Technician: <strong>{booking.technician.name}</strong> ({booking.technician.role})
                      </span>
                    </div>
                  </div>
                )}

                {/* Customer Service Message / Notes */}
                {booking.message && (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Your Service Notes:
                    </span>
                    <p className="mt-1 rounded-xl bg-slate-50 p-3 text-xs italic text-text-secondary border border-border">
                      &ldquo;{booking.message}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              {/* 4. Completed Service Financial Breakdown */}
              {isCompleted && totalAmountNum > 0 && (() => {
                const isPaid = booking.paymentStatus === "paid";
                const isQuoteSent = booking.paymentStatus === "quote_sent";
                const paymentBadgeText = isPaid
                  ? "Paid"
                  : isQuoteSent
                  ? "Payment Due"
                  : "Official Completed Quote";
                const paymentBadgeClass = isPaid
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : isQuoteSent
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-slate-100 text-slate-700 border-slate-200";

                const paymentTotalLabel = isPaid
                  ? "Total Amount Paid:"
                  : isQuoteSent
                  ? "Total Amount Due:"
                  : "Total Amount Due / Paid:";

                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Service Invoice Summary
                      </span>
                      <span className={`rounded-full px-3 py-0.5 text-xs font-extrabold border ${paymentBadgeClass}`}>
                        {paymentBadgeText}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {primaryServiceName} (Primary Service)
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          ${primaryServiceAmount.toFixed(2)}
                        </span>
                      </div>

                      {extraServices.map((extra, idx) => (
                        <div key={idx} className="flex items-center justify-between text-blue-700">
                          <span>+ {extra.name} (Additional Service)</span>
                          <span className="font-mono font-bold">
                            ${Number(extra.price).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-extrabold text-slate-900">
                      <span>{paymentTotalLabel}</span>
                      <span className="text-lg text-primary font-mono">
                        ${totalAmountNum.toFixed(2)}
                      </span>
                    </div>

                    {booking.notes && (
                      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-slate-700">
                        <span className="font-bold text-blue-900">
                          Technician Work Notes:{" "}
                        </span>
                        <span>{booking.notes}</span>
                      </div>
                    )}

                    {/* PDF Receipt Button */}
                    <div className="pt-2">
                      <a
                        href={`/api/bookings/${booking.id}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
                      >
                        <Download size={14} className="text-primary" />
                        <span>Download Digital PDF Receipt</span>
                      </a>
                    </div>
                  </div>
                );
              })()}

              {/* 5. Review Action for Completed Bookings */}
              {isCompleted && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
                  {(!booking.reviews || booking.reviews.length === 0) ? (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                          <Star size={20} className="fill-white" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                            Rate Your Experience
                          </h4>
                          <p className="text-xs text-amber-900">
                            Help us maintain high quality mobile tire care in your area.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReviewModalBooking(booking)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-amber-600 active:scale-95 shrink-0"
                      >
                        <Star size={14} className="fill-white text-white" />
                        <span>Leave a Review</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      <span>
                        {booking.reviews[0].isApproved
                          ? "Thank you! Your verified review is published."
                          : "Review submitted — pending approval."}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 6. Customer Self-Service Cancellation for Pending Bookings */}
              {booking.status === "pending" && (
                <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-red-950">
                        Need to Cancel Request?
                      </h4>
                      <p className="mt-0.5 text-red-800">
                        You can cancel your pending request online prior to dispatch confirmation.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCustomerCancel}
                      disabled={isCancelling}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-50 active:scale-95 shrink-0 disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      <span>{isCancelling ? "Cancelling..." : "Cancel Booking Request"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Column (1 Col) */}
            <div className="space-y-6">
              {/* Quick Dispatch Support */}
              <div className="rounded-2xl border border-border bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider">
                  Dispatch Support
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Questions about your appointment, address update, or tire specifications? Call our central dispatch line directly.
                </p>

                <div className="space-y-2 pt-1">
                  <a
                    href={`tel:${BUSINESS_PHONE_RAW}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-white shadow-md transition hover:bg-primary-hover active:scale-95"
                  >
                    <Phone size={14} />
                    <span>Call Dispatch: {BUSINESS_PHONE_DISPLAY}</span>
                  </a>

                  <Link
                    href="/contact"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-semibold text-text-secondary transition hover:bg-slate-50 hover:text-foreground"
                  >
                    <Mail size={14} />
                    <span>Send Message</span>
                  </Link>
                </div>
              </div>

              {/* Emergency Roadside Box */}
              <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 shadow-sm">
                <div className="flex items-center gap-2 text-red-700 mb-2">
                  <Siren size={18} />
                  <h4 className="text-xs font-extrabold uppercase tracking-wider">
                    Emergency Roadside?
                  </h4>
                </div>
                <p className="text-xs text-red-900 leading-relaxed">
                  Stuck on a roadside or highway with a dangerous blowout? Request instant emergency roadside dispatch.
                </p>
                <Link
                  href="/emergency"
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700"
                >
                  <span>Request Emergency Aid</span>
                </Link>
              </div>

              {/* Back to All Bookings */}
              <div className="rounded-2xl border border-border bg-white p-4 text-center">
                <Link
                  href="/account?tab=bookings"
                  className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft size={13} />
                  <span>Return to All Bookings Overview</span>
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </main>

      {/* Review Modal for Verified Reviews */}
      {reviewModalBooking && (
        <ReviewModal
          bookingId={reviewModalBooking.id}
          serviceName={
            reviewModalBooking.primaryService ||
            reviewModalBooking.service?.name ||
            "Mobile Tire Service"
          }
          vehicle={reviewModalBooking.vehicle}
          onClose={() => setReviewModalBooking(null)}
          onSuccess={() => {
            setReviewModalBooking(null);
            void loadBookingData();
          }}
        />
      )}
    </div>
  );
}
