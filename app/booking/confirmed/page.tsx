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
} from "lucide-react";
import Container from "@/app/components/Container";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";
import { useAuth } from "@/lib/auth/auth-context";

function BookingConfirmedInner() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");
  const { isCustomerUser } = useAuth();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBooking() {
      try {
        const response = await fetch("/api/bookings");
        const data = await response.json();

        if (response.ok && data.success && data.bookings?.length > 0) {
          if (bookingId) {
            const found = data.bookings.find((b: any) => b.id === bookingId);
            setBooking(found || data.bookings[0]);
          } else {
            setBooking(data.bookings[0]);
          }
        }
      } catch (err) {
        console.error("Unable to load confirmed booking:", err);
      } finally {
        setLoading(false);
      }
    }

    loadBooking();
  }, [bookingId]);

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
                  ? `Booked at ${new Date(booking.bookedAt || booking.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })} • No Upfront Fee`
                  : "Service Request Received • No Upfront Fee"}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Booking Request Received!
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary sm:text-base">
              Our dispatch team has received your service request and will assign an available mobile technician van. You will receive an email notification and service updates with your service details.
            </p>

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
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-text-secondary">Location</p>
                    <p className="font-bold text-foreground">{booking?.location || "Your Specified Address"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock3 size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-text-secondary">Request Placed</p>
                    <p className="font-bold text-foreground">
                      {booking?.bookedAt || booking?.createdAt
                        ? new Date(booking.bookedAt || booking.createdAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "Just Now"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-text-secondary">Service Dispatch</p>
                    <p className="font-bold text-foreground">
                      On-Demand 24/7 Dispatch
                    </p>
                  </div>
                </div>
              </div>

              {/* Booking Lifecycle & Billing Info */}
              <div className="mt-6 space-y-2.5">
                <div className="flex items-start gap-2.5 rounded-xl bg-white p-3.5 text-xs text-text-secondary border border-border">
                  <ShieldCheck size={18} className="shrink-0 text-primary mt-0.5" />
                  <span>
                    <strong>What Happens Next:</strong> Our dispatch team will confirm technician assignment. You do not need to create an account to receive service — all dispatch updates and arrival notifications will be sent directly to your phone.
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
                    href="/"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition hover:bg-blue-700"
                  >
                    Go to Home
                  </Link>
                  <Link
                    href={
                      booking?.id || bookingId
                        ? `/login?redirect=/account/bookings/${booking?.id || bookingId}`
                        : "/login?redirect=/account?tab=bookings"
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
                  >
                    <span>Track Booking (Sign In)</span>
                    <ArrowRight size={15} />
                  </Link>
                </>
              )}
            </div>

            {/* Help Note */}
            <p className="mt-6 text-xs text-slate-400">
              Need urgent updates or changes? Call our dispatch team at{" "}
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
