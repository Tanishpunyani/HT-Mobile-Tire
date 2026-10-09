"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Clock3,
  CheckCircle2,
  Wrench,
  Car,
  MapPin,
  Calendar,
  User,
  PhoneCall,
  RefreshCw,
  Sparkles,
  AlertCircle,
  XCircle,
} from "lucide-react";
import Container from "@/app/components/Container";
import { useAuth } from "@/lib/auth/auth-context";
import { formatTime, formatDate } from "@/lib/utils/date-format";

interface GuestBookingSummary {
  id: string;
  status: string; // "pending" | "confirmed" | "in_progress" | "completed" | "cancelled"
  primaryService?: string | null;
  service?: { name: string } | null;
  vehicle: string;
  location: string;
  formattedAddress?: string | null;
  tireSize?: string | null;
  bookingDate?: string | Date;
  bookingTime?: string | Date;
  bookedAt?: string;
  createdAt?: string | Date;
  etaMinutes?: number | null;
  estimatedArrivalAt?: string | null;
  arrivalStatus?: string;
  distanceMiles?: number | null;
  technician?: {
    id: string;
    name: string;
    role: string;
    phone?: string | null;
    hasValidPhone?: boolean;
    callUri?: string | null;
  } | null;
  callNow?: {
    isValid: boolean;
    telUri: string;
    displayPhone: string;
    technicianName: string;
  } | null;
}

export default function GuestActiveServiceTracker() {
  const { isCustomerUser } = useAuth();
  const [bookings, setBookings] = useState<GuestBookingSummary[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const fetchGuestBookings = useCallback(async (isManualRefresh = false) => {
    if (!isMountedRef.current || isCustomerUser) return;

    if (isManualRefresh) {
      setRefreshing(true);
    }

    try {
      const res = await fetch("/api/guest/bookings", {
        cache: "no-store",
      });

      if (!isMountedRef.current) return;

      if (!res.ok) {
        if (bookings.length === 0) setBookings([]);
        return;
      }

      const data = await res.json();
      if (!isMountedRef.current) return;

      if (data.success && Array.isArray(data.bookings)) {
        setBookings(data.bookings);
        // Ensure selected index is within bounds
        setSelectedIndex((prev) => Math.min(prev, Math.max(0, data.bookings.length - 1)));
      } else {
        setBookings([]);
      }
    } catch (err) {
      console.debug("[GuestActiveServiceTracker] Fetch error:", err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isCustomerUser, bookings.length]);

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    if (!isCustomerUser) {
      void fetchGuestBookings();
    } else {
      setBookings([]);
      setLoading(false);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [isCustomerUser, fetchGuestBookings]);

  // Periodic polling every 30 seconds while visible (Phase 6)
  useEffect(() => {
    if (isCustomerUser) return;

    const intervalId = setInterval(() => {
      void fetchGuestBookings();
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isCustomerUser, fetchGuestBookings]);

  // Window Focus Resynchronization: refresh when customer returns to tab
  useEffect(() => {
    function handleWindowFocus() {
      if (!isCustomerUser) {
        void fetchGuestBookings();
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isCustomerUser, fetchGuestBookings]);

  // Guard: If authenticated customer, or loading initial state, or no authorized bookings, render null
  if (isCustomerUser || loading || bookings.length === 0) {
    return null;
  }

  const currentBooking = bookings[selectedIndex] || bookings[0];
  if (!currentBooking) return null;

  const technician = currentBooking.technician;
  const hasTechnician = Boolean(technician && technician.name);
  const callNowData = currentBooking.callNow;
  const canCallTechnician = Boolean(callNowData?.isValid && callNowData?.telUri);

  // Status visual attributes
  const isPending = currentBooking.status === "pending";
  const isConfirmed = currentBooking.status === "confirmed";
  const isInProgress = currentBooking.status === "in_progress";
  const isCompleted = currentBooking.status === "completed";
  const isCancelled = currentBooking.status === "cancelled";

  let statusBadgeStyle = "bg-amber-100 text-amber-800 border-amber-200";
  let statusBadgeText = "Waiting for Confirmation";
  let statusIcon = <Clock3 size={18} className="text-amber-600 shrink-0" />;

  if (isInProgress) {
    statusBadgeStyle = "bg-purple-100 text-purple-800 border-purple-200 animate-pulse";
    statusBadgeText = "Service in Progress";
    statusIcon = <Wrench size={18} className="text-purple-600 shrink-0" />;
  } else if (isConfirmed) {
    statusBadgeStyle = "bg-blue-100 text-blue-800 border-blue-200";
    statusBadgeText = "Booking Confirmed";
    statusIcon = <CheckCircle2 size={18} className="text-blue-600 shrink-0" />;
  } else if (isCompleted) {
    statusBadgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-200";
    statusBadgeText = "Service Completed";
    statusIcon = <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />;
  } else if (isCancelled) {
    statusBadgeStyle = "bg-red-100 text-red-800 border-red-200";
    statusBadgeText = "Cancelled";
    statusIcon = <XCircle size={18} className="text-red-600 shrink-0" />;
  }

  const requestedDateStr = currentBooking.bookingDate
    ? formatDate(currentBooking.bookingDate)
    : "";
  const requestedTimeStr = currentBooking.bookingTime
    ? formatTime(currentBooking.bookingTime)
    : "";

  return (
    <section
      id="active-booking"
      aria-label="Your Active Booking Tracker"
      className="py-12 bg-gradient-to-b from-blue-50/60 to-background-light border-y border-blue-100 scroll-mt-20"
    >
      <Container>
        <div className="mx-auto max-w-4xl">
          {/* Section Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-800">
                <Sparkles size={13} />
                <span>Guest Booking Access</span>
              </div>
              <h2 className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl tracking-tight">
                Your Active Booking
              </h2>
              <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                Real-time booking and dispatch status from central dispatch.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={() => fetchGuestBookings(true)}
                disabled={refreshing}
                title="Refresh booking status"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-semibold text-text-secondary shadow-sm transition hover:bg-slate-50 hover:text-foreground disabled:opacity-60"
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>
          </div>

          {/* Multiple Bookings Switcher (Phase 4) */}
          {bookings.length > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border/80 pb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                Your Bookings ({bookings.length}):
              </span>
              {bookings.map((b, idx) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    selectedIndex === idx
                      ? "bg-primary text-white shadow-sm"
                      : "bg-white text-text-secondary border border-border hover:bg-slate-50"
                  }`}
                >
                  #{b.id.slice(-6).toUpperCase()} • {b.primaryService || "Service"}
                </button>
              ))}
            </div>
          )}

          {/* Main Booking Card */}
          <div className="rounded-3xl border border-border bg-white p-6 sm:p-8 shadow-xl">
            {/* Top Row: Service & Status */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-5">
              <div>
                <span className="text-xs font-mono font-bold text-primary">
                  Booking #{currentBooking.id.slice(-6).toUpperCase()}
                </span>
                <h3 className="mt-1 text-xl font-extrabold text-foreground sm:text-2xl">
                  {currentBooking.primaryService || currentBooking.service?.name || "Mobile Tire Service"}
                </h3>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Placed on {currentBooking.bookedAt || currentBooking.createdAt ? `${formatDate(currentBooking.bookedAt || currentBooking.createdAt)} at ${formatTime(currentBooking.bookedAt || currentBooking.createdAt)}` : "Recently"}
                </p>
              </div>

              <div className="self-start sm:self-center">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-extrabold ${statusBadgeStyle}`}>
                  {statusIcon}
                  <span>{statusBadgeText}</span>
                </span>
              </div>
            </div>

            {/* Middle Grid: Vehicle, Location, Schedule, ETA */}
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              <div className="flex items-start gap-2.5">
                <Car size={18} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <span className="block font-semibold text-text-secondary">Vehicle</span>
                  <span className="font-bold text-foreground text-sm block">
                    {currentBooking.vehicle || "Vehicle on File"}
                  </span>
                  {currentBooking.tireSize && (
                    <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                      Size: {currentBooking.tireSize}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin size={18} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <span className="block font-semibold text-text-secondary">Service Location</span>
                  <span className="font-bold text-foreground block leading-snug">
                    {currentBooking.formattedAddress || currentBooking.location || "Customer Location"}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Calendar size={18} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <span className="block font-semibold text-text-secondary">Requested Window</span>
                  <span className="font-bold text-foreground block">
                    {requestedDateStr}
                  </span>
                  {requestedTimeStr && (
                    <span className="text-text-secondary block font-medium">
                      {requestedTimeStr}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock3 size={18} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <span className="block font-semibold text-text-secondary">Technician ETA</span>
                  <span className="font-bold text-foreground block">
                    {currentBooking.estimatedArrivalAt
                      ? `~${formatTime(currentBooking.estimatedArrivalAt)} (${currentBooking.etaMinutes}m)`
                      : isConfirmed && hasTechnician
                      ? "En Route Soon"
                      : "Awaiting Schedule"}
                  </span>
                  {currentBooking.distanceMiles != null && currentBooking.distanceMiles > 0 && (
                    <span className="text-[11px] text-slate-500 block">
                      {currentBooking.distanceMiles} miles away
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Section: Technician Assignment & Call Now (Phases 4, 6 & 7) */}
            <div className="mt-6 border-t border-border pt-5">
              {hasTechnician ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                        <User size={22} />
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-700 block">
                          Assigned Technician
                        </span>
                        <span className="text-base font-extrabold text-foreground block">
                          {technician?.name || "Assigned Technician"}
                        </span>
                        {canCallTechnician && callNowData ? (
                          <span className="text-xs font-semibold text-emerald-700 block mt-0.5">
                            Direct mobile dispatch: {callNowData.displayPhone}
                          </span>
                        ) : (
                          <span className="text-xs text-text-secondary block mt-0.5">
                            Technician assigned. Direct contact number is not yet available.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Authoritative Call Now Link (Phase 7) */}
                    {canCallTechnician && callNowData && (
                      <div className="shrink-0">
                        <a
                          href={callNowData.telUri}
                          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-95"
                          aria-label={`Call technician ${callNowData.technicianName} now`}
                        >
                          <PhoneCall size={15} />
                          <span>Call Technician ({callNowData.displayPhone})</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5 text-left">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                      <Clock3 size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-amber-950">
                        Awaiting Technician Assignment
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-amber-900">
                        Your request has been received. A technician has not been assigned yet. Your technician details and contact option will appear here when they become available.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
