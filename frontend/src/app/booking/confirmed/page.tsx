"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  MapPin,
  Car,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  FileText,
  User,
  PhoneCall,
  AlertCircle,
} from "lucide-react";
import Container from "@/app/components/Container";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";
import { formatTime, formatDate } from "@/lib/utils/date-format";
import { useAuth } from "@/lib/auth/auth-context";

function BookingConfirmedInner() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");
  const { isCustomerUser } = useAuth();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadBooking() {
      try {
        setLoading(true);
        setUnauthorized(false);

        if (isCustomerUser) {
          // Authenticated customer flow: reuse /api/bookings
          const response = await fetch("/api/bookings", { cache: "no-store" });
          const data = await response.json();

          if (isMounted) {
            if (response.ok && data.success && data.bookings?.length > 0) {
              if (bookingId) {
                const found = data.bookings.find((b: any) => b.id === bookingId);
                setBooking(found || data.bookings[0]);
              } else {
                setBooking(data.bookings[0]);
              }
            } else {
              setBooking(null);
            }
          }
        } else {
          // Unauthenticated guest flow: query secure guest API with HttpOnly cookie authorization
          const endpoint = bookingId
            ? `/api/guest/bookings/${encodeURIComponent(bookingId)}`
            : "/api/guest/bookings";

          const response = await fetch(endpoint, { cache: "no-store" });

          if (!isMounted) return;

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              if (bookingId && data.booking) {
                setBooking(data.booking);
              } else if (Array.isArray(data.bookings) && data.bookings.length > 0) {
                setBooking(data.bookings[0]);
              } else {
                setBooking(null);
                setUnauthorized(true);
              }
            } else {
              setBooking(null);
              setUnauthorized(true);
            }
          } else {
            // Unauthorized or not found for this guest token: do not leak whether another booking exists
            setBooking(null);
            setUnauthorized(true);
          }
        }
      } catch (err) {
        console.error("Unable to load confirmed booking:", err);
        if (isMounted) {
          setBooking(null);
          setUnauthorized(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadBooking();

    return () => {
      isMounted = false;
    };
  }, [bookingId, isCustomerUser]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  // Handle unauthorized or missing guest access without leaking existence of another booking
  if (!isCustomerUser && (unauthorized || !booking)) {
    return (
      <div className="min-h-screen bg-background-light py-16 sm:py-24">
        <Container>
          <div className="mx-auto max-w-xl">
            <div className="rounded-3xl border border-border bg-white p-8 text-center shadow-xl sm:p-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <AlertCircle size={36} />
              </div>
              <h1 className="mt-5 text-2xl font-extrabold text-foreground sm:text-3xl">
                Booking Details Unavailable
              </h1>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                We couldn&apos;t verify authorization for this booking. If you recently placed a booking as a guest, please ensure cookies are enabled in your browser, or visit the homepage to check your active booking tracker.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700"
                >
                  Go to Home
                </Link>
                <Link
                  href="/booking"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
                >
                  Book a Service
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  const isGuest = !isCustomerUser;
  const technician = booking?.technician;
  const hasTechnician = Boolean(technician && technician.name);
  const callNowData = booking?.callNow;
  const canCallTechnician = Boolean(callNowData?.isValid && callNowData?.telUri);

  return (
    <div className="min-h-screen bg-background-light py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-border bg-white p-8 text-center shadow-xl sm:p-12">
            {/* Success Icon */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-primary shadow-inner">
              <CheckCircle2 size={44} />
            </div>

            <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1.5 text-xs font-bold text-blue-700">
              <Sparkles size={14} />
              <span>
                {booking?.bookedAt || booking?.createdAt
                  ? `Booked at ${formatTime(booking.bookedAt || booking.createdAt)} • No Upfront Fee`
                  : "Service Request Received • No Upfront Fee"}
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {isGuest
                ? "Your Booking Request Has Been Submitted!"
                : "Booking Request Received!"}
            </h1>

            {/* Explanation Copy */}
            {isGuest ? (
              <div className="mx-auto mt-4 max-w-xl space-y-2 text-sm leading-6 text-text-secondary sm:text-base">
                <p>
                  Thank you for choosing HT Mobile Tire. Your service request has been submitted successfully, and our team has received your booking details.
                </p>
                <p className="text-xs text-slate-500 sm:text-sm">
                  You can track your booking status and see your assigned technician and timing information here without creating an account.
                </p>
                <p className="text-xs font-semibold text-amber-700">
                  Please note that your booking is not necessarily confirmed until the admin updates its status.
                </p>
              </div>
            ) : (
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary sm:text-base">
                Our service team has received your service request and will assign an available mobile technician. You will receive an email notification and service updates with your service details.
              </p>
            )}

            {/* Summary Details Card */}
            <div className="mt-8 rounded-2xl border border-border bg-background-light p-6 text-left">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    Requested Service
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-foreground">
                    {booking?.primaryService || booking?.service?.name || "Mobile Tire Service"}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-amber-100 border border-amber-200 px-3 py-1 text-xs font-extrabold text-amber-800">
                    Quote Provided On-Site
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
                <div className="flex items-start gap-2.5">
                  <Car size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-text-secondary">Vehicle</p>
                    <p className="font-bold text-foreground">{booking?.vehicle || "Vehicle on File"}</p>
                    {booking?.tireSize && (
                      <p className="text-[11px] font-mono text-slate-500">
                        Size: {booking.tireSize}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-text-secondary">Location</p>
                    <p className="font-bold text-foreground">{booking?.formattedAddress || booking?.location || "Your Specified Address"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock3 size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-text-secondary">Request Placed</p>
                    <p className="font-bold text-foreground">
                      {booking?.bookedAt || booking?.createdAt
                        ? `${formatDate(booking.bookedAt || booking.createdAt)} • ${formatTime(booking.bookedAt || booking.createdAt)}`
                        : "Just Now"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-text-secondary">Current Status</p>
                    <p className="font-bold text-foreground capitalize">
                      {booking?.status ? booking.status.replace("_", " ") : "Pending Review"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Technician Assignment & Call Now Section (Phases 3 & 7) */}
              <div className="mt-6 border-t border-border pt-5">
                {hasTechnician ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3 text-left">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                            Assigned Technician
                          </p>
                          <p className="text-sm font-extrabold text-foreground">
                            {technician.name}
                          </p>
                          {!canCallTechnician && (
                            <p className="mt-0.5 text-xs text-text-secondary">
                              Contact number is not yet available.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Prominent Call Now button strictly when real technician phone is valid */}
                      {canCallTechnician && (
                        <div className="shrink-0">
                          <a
                            href={callNowData.telUri}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-95"
                          >
                            <PhoneCall size={14} />
                            <span>Call Now ({callNowData.displayPhone})</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-left">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                        <Clock3 size={18} />
                      </div>
                      <p className="text-xs leading-5 text-amber-900">
                        Your request has been received. A technician has not been assigned yet. Your technician details and contact option will appear here when they become available.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Booking Lifecycle & Billing Info */}
              <div className="mt-6 space-y-2.5">
                <div className="flex items-start gap-2.5 rounded-xl bg-white p-3.5 text-xs text-text-secondary border border-border">
                  <ShieldCheck size={18} className="shrink-0 text-primary mt-0.5" />
                  <span>
                    <strong>What Happens Next:</strong> Our service team will confirm your technician assignment. You do not need to create an account to receive service — all appointment and arrival updates will be sent directly to your phone.
                  </span>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl bg-white p-3.5 text-xs text-text-secondary border border-border">
                  <FileText size={18} className="shrink-0 text-primary mt-0.5" />
                  <span>
                    <strong>Post-Service Billing:</strong> After the technician finishes all tire work, you will receive an instant digital invoice. Settle on-site with card, cash, or mobile pay.
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {isCustomerUser ? (
                <>
                  <Link
                    href={
                      booking?.id || bookingId
                        ? `/account/bookings/${booking?.id || bookingId}`
                        : "/account?tab=bookings"
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition hover:bg-blue-700 active:scale-95"
                  >
                    <span>View Booking</span>
                    <ArrowRight size={15} />
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
                  >
                    Go to Home
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/#active-booking"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition hover:bg-blue-700 active:scale-95"
                  >
                    <span>Track Booking</span>
                    <ArrowRight size={15} />
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
                  >
                    Go to Home
                  </Link>
                </>
              )}
            </div>

            {/* Help Note */}
            <p className="mt-6 text-xs text-slate-400">
              Need urgent updates or changes? Call us at{" "}
              <a href={`tel:${BUSINESS_PHONE_RAW}`} className="font-bold text-primary hover:underline">
                {BUSINESS_PHONE_DISPLAY}
              </a>
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}

export default function BookingConfirmedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background-light">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      }
    >
      <BookingConfirmedInner />
    </Suspense>
  );
}
