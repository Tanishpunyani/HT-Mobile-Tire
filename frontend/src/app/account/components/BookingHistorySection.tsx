"use client";

import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  Wrench,
  Siren,
  Phone,
  Mail,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";
import { formatDate, formatTime } from "@/lib/utils/date-format";
import { Booking } from "../types";

const statusLabelMap: Record<string, string> = {
  pending: "Waiting for Confirmation",
  confirmed: "Booking Confirmed",
  in_progress: "Service in Progress",
  completed: "Service Completed",
  cancelled: "Cancelled",
};

interface BookingHistorySectionProps {
  bookings: Booking[];
  bookingsLoading: boolean;
}

export default function BookingHistorySection({
  bookings,
  bookingsLoading,
}: BookingHistorySectionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="rounded-[20px] border border-border bg-white p-5 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-foreground">Service Bookings</h2>
              <p className="mt-1 text-sm text-text-secondary">
                View and manage your scheduled mobile tire service visits.
              </p>
            </div>
            <Link
              href="/booking"
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover shrink-0 self-start sm:self-auto"
            >
              <Wrench size={14} />
              Book New
            </Link>
          </div>

          {bookingsLoading ? (
            <div className="mt-8 rounded-xl border border-border bg-background-light p-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
              <p className="mt-3 text-sm text-text-secondary">Loading your bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-border bg-background-light p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarDays size={26} />
              </div>
              <h3 className="mt-4 text-base font-bold text-foreground">No bookings found</h3>
              <p className="mt-1 text-sm text-text-secondary">
                You haven't scheduled any tire services yet.
              </p>
              <Link
                href="/booking"
                className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-hover"
              >
                Book Your First Service <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-3.5">
              {bookings.map((booking) => {
                const isCompleted = booking.status === "completed";
                const primaryServiceName =
                  booking.primaryService || booking.service?.name || "Mobile Tire Service";

                return (
                  <Link
                    key={booking.id}
                    href={`/account/bookings/${booking.id}`}
                    className="group block rounded-2xl border border-border bg-white p-5 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:translate-y-[-1px]"
                  >
                    <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-2 flex-1 min-w-0">
                        {/* Top row: Service Name & Status Badge */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                              {primaryServiceName}
                            </h3>
                            {booking.vehicle && (
                              <span className="hidden md:inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                🚗 {booking.vehicle}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                booking.status === "completed"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : booking.status === "confirmed"
                                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                                    : booking.status === "in_progress"
                                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                                      : booking.status === "cancelled"
                                        ? "bg-red-100 text-red-700 border border-red-200"
                                        : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {statusLabelMap[booking.status] || booking.status.replace("_", " ")}
                            </span>

                            {booking.status === "confirmed" && booking.etaMinutes && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                                <Clock3 size={11} className="text-blue-600" />
                                ETA ~{booking.etaMinutes}m
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle row: Booked Timestamp & Booking ID */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <Clock3 size={14} className="text-primary shrink-0" />
                            Booked{" "}
                            {formatDate(booking.bookedAt || booking.bookingDate)}{" "}
                            at{" "}
                            {formatTime(booking.bookedAt || booking.bookingTime)}
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            #{booking.id.slice(0, 8).toUpperCase()}
                          </span>
                        </div>

                        {/* Bottom row: Vehicle (mobile) & Location */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                          {booking.vehicle && (
                            <span className="inline-flex md:hidden font-semibold text-slate-800">
                              🚗 {booking.vehicle}
                            </span>
                          )}
                          {(booking.formattedAddress || booking.location) && (
                            <span className="truncate max-w-lg text-slate-600">
                              📍 {booking.formattedAddress || booking.location}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right side: Arrow CTA */}
                      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60 justify-between sm:justify-end shrink-0">
                        <span className="text-xs font-bold text-primary group-hover:underline">
                          {isCompleted ? "View Receipt & Details" : "Track Service"}
                        </span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Info & Quick Help */}
      <div className="space-y-6">
        <div className="rounded-[20px] border border-border bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-foreground">Need Urgent Help?</h3>
          <p className="mt-2 text-xs leading-5 text-text-secondary">
            Stuck with a blowout, puncture, or flat tire? Our mobile technician van can come directly to your roadside location.
          </p>
          <Link
            href="/emergency"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700"
          >
            <Siren size={16} />
            Request Emergency Help
          </Link>
        </div>

        <div className="rounded-[20px] border border-border bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-foreground">Customer Support</h3>
          <div className="mt-4 space-y-3 text-sm text-text-secondary">
            <p className="flex items-center gap-2">
              <Phone size={16} className="text-primary" />
              {BUSINESS_PHONE_DISPLAY}
            </p>
            <p className="flex items-center gap-2">
              <Mail size={16} className="text-primary" />
              dispatch@mobiletire.clinic
            </p>
          </div>
          <Link
            href="/contact"
            className="mt-5 block text-center text-xs font-bold text-primary hover:underline"
          >
            Contact Support Page →
          </Link>
        </div>
      </div>
    </div>
  );
}
