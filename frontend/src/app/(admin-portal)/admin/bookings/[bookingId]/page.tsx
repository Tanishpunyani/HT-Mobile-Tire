export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import {
  Calendar,
  Clock,
  MapPin,
  Car,
  User,
  Phone,
  Mail,
  ShieldCheck,
  ChevronLeft,
  Receipt,
  CreditCard,
  CheckCircle2,
  Send,
  Download,
} from "lucide-react";
import AdminBookingDetailActions from "./AdminBookingDetailActions";
import { formatAdminDate, formatAdminTime } from "@/lib/utils/date-format";

interface PageProps {
  params: Promise<{ bookingId: string }>;
}

function formatDate(dateVal: Date | string | null | undefined): string {
  return formatAdminDate(dateVal, "N/A", { includeWeekday: true });
}

function formatTime(timeVal: Date | string | null | undefined): string {
  return formatAdminTime(timeVal, "N/A");
}

export default async function AdminBookingDetailPage({ params }: PageProps) {
  // 1. Enforce strict server-side admin authentication session
  await requireAdminSession();

  const { bookingId } = await params;

  if (!bookingId) {
    notFound();
  }

  // 2. Fetch target booking directly
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      service: true,
      technician: true,
    },
  });

  if (!booking) {
    return (
      <div className="min-h-screen bg-background-light py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Link
            href="/admin/bookings"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline mb-6"
          >
            <ChevronLeft size={16} />
            Back to All Bookings
          </Link>
          <div className="rounded-2xl border border-border bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4">
              <Receipt size={28} />
            </div>
            <h2 className="text-xl font-bold text-foreground">Booking Not Found</h2>
            <p className="mt-2 text-xs text-text-secondary">
              The booking reference <code className="font-mono">{bookingId}</code> does not exist or has been removed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Fetch active technicians for assignment
  const technicians = await prisma.technician.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      phone: true,
    },
  });

  const mapsUrl =
    booking.latitude && booking.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${booking.latitude},${booking.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          booking.formattedAddress || booking.location || ""
        )}`;

  const shortRef = booking.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  const primaryServiceName = booking.primaryService || booking.service?.name || "Mobile Tire Service";

  // Financial & Line Items Breakdown
  const totalAmountNum = booking.totalAmount ? Number(booking.totalAmount) : 0;
  const extraServices = Array.isArray(booking.extraServices)
    ? (booking.extraServices as Array<{ name: string; price: number }>)
    : typeof booking.extraServices === "string"
    ? (() => {
        try {
          return JSON.parse(booking.extraServices) as Array<{ name: string; price: number }>;
        } catch {
          return [];
        }
      })()
    : [];

  const extraServicesSum = extraServices.reduce(
    (sum, extra) => sum + (Number(extra.price) || 0),
    0
  );
  const primaryServiceAmount = Math.max(0, totalAmountNum - extraServicesSum);

  const serializedBooking = serializeDecimal(booking);

  return (
    <div className="min-h-screen bg-background-light py-10 sm:py-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            href="/admin/bookings"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            <ChevronLeft size={16} />
            Back to All Bookings
          </Link>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            Booking #{shortRef}
          </span>
        </div>

        {/* Header Summary */}
        <div className="rounded-3xl border border-border bg-white p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide border ${
                    booking.status === "confirmed"
                      ? "bg-blue-50 text-blue-800 border-blue-200"
                      : booking.status === "in_progress"
                      ? "bg-purple-50 text-purple-800 border-purple-200"
                      : booking.status === "completed"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : booking.status === "cancelled"
                      ? "bg-red-50 text-red-800 border-red-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  {booking.status}
                </span>

                {/* Arrival Milestone Badge */}
                {booking.status === "confirmed" && booking.arrivedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                    <MapPin size={11} />
                    Arrived On-Site
                  </span>
                )}

                <span className="text-xs text-slate-400 font-mono">ID: {booking.id}</span>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl">
                {primaryServiceName}
              </h1>
              <p className="mt-1 text-xs text-text-secondary">
                Submitted on {formatDate(booking.createdAt)} at {formatTime(booking.createdAt)}
              </p>
            </div>

            {/* Quick Action Controls */}
            <AdminBookingDetailActions
              booking={serializedBooking as any}
              technicians={technicians}
            />
          </div>

          {/* Core Grid */}
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Customer Column */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User size={14} className="text-primary" />
                Customer
              </h3>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
                <p className="font-bold text-sm text-foreground">{booking.customer?.name || "N/A"}</p>
                <div className="flex items-center gap-1.5 text-xs">
                  <Phone size={13} className="text-slate-400" />
                  <a
                    href={`tel:${booking.customer?.phone}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {booking.customer?.phone || "No phone"}
                  </a>
                </div>
                {booking.customer?.email && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 break-all">
                    <Mail size={13} className="text-slate-400 shrink-0" />
                    <span>{booking.customer.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Appointment Schedule Column */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" />
                Requested Schedule
              </h3>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Calendar size={14} className="text-slate-400" />
                  <span className="font-bold text-foreground">
                    {formatDate(booking.bookingDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Clock size={14} className="text-slate-400" />
                  <span className="font-semibold text-slate-700">
                    {formatTime(booking.bookingTime)}
                  </span>
                </div>
                {booking.serviceConfirmedAt && (
                  <p className="text-[11px] text-emerald-700 font-medium pt-1 border-t border-slate-200">
                    Confirmed: {formatDate(booking.serviceConfirmedAt)} {formatTime(booking.serviceConfirmedAt)}
                  </p>
                )}
                {booking.arrivedAt && (
                  <p className="text-[11px] text-indigo-700 font-medium pt-1 border-t border-slate-200">
                    Arrived On-Site: {formatDate(booking.arrivedAt)} {formatTime(booking.arrivedAt)}
                  </p>
                )}
              </div>
            </div>

            {/* Vehicle & Specs Column */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Car size={14} className="text-primary" />
                Vehicle & Tire
              </h3>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
                <p className="font-bold text-sm text-foreground">{booking.vehicle}</p>
                {booking.tireSize ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2 py-1 text-xs font-mono font-bold text-slate-800">
                    🛞 {booking.tireSize}
                  </span>
                ) : (
                  <p className="text-xs text-slate-400 italic">No tire size specified</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Financial, Quote & Payment Summary */}
        <div className="rounded-3xl border border-border bg-white p-6 shadow-sm mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CreditCard size={14} className="text-primary" />
              Financial & Payment Status
            </h3>
            <div>
              {booking.paymentStatus === "paid" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 border border-emerald-300">
                  <CheckCircle2 size={13} />
                  Paid {totalAmountNum > 0 ? `($${totalAmountNum.toFixed(2)})` : ""}
                </span>
              ) : booking.paymentStatus === "quote_sent" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800 border border-orange-200">
                  <Send size={12} />
                  Quote Sent {totalAmountNum > 0 ? `($${totalAmountNum.toFixed(2)})` : ""}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                  Quote Pending
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    {primaryServiceName} (Base Service)
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    ${primaryServiceAmount.toFixed(2)}
                  </span>
                </div>

                {extraServices.map((extra, idx) => (
                  <div key={idx} className="flex items-center justify-between text-blue-700">
                    <span>+ {extra.name}</span>
                    <span className="font-mono font-bold">
                      ${Number(extra.price).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-extrabold text-slate-900">
                <span>Total Amount:</span>
                <span className="text-lg text-primary font-mono">
                  ${totalAmountNum.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">Official Invoice / Receipt Documentation</p>
                <p className="text-slate-500">
                  {booking.status === "completed"
                    ? "Direct PDF receipt download is available for this completed booking."
                    : "Official PDF receipt will be automatically generated upon service completion."}
                </p>
              </div>

              {booking.status === "completed" && (
                <div className="pt-3">
                  <a
                    href={`/api/bookings/${booking.id}/receipt`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    <Download size={14} className="text-primary" />
                    Download Digital PDF Receipt
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Location & Navigation */}
        <div className="grid gap-6 sm:grid-cols-2 mb-6">
          <div className="rounded-3xl border border-border bg-white p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MapPin size={14} className="text-primary" />
              Service Location
            </h3>
            <p className="text-sm font-medium text-foreground">
              {booking.formattedAddress || booking.location}
            </p>
            {booking.latitude && booking.longitude && (
              <p className="text-xs font-mono text-slate-500">
                GPS: {booking.latitude.toFixed(6)}, {booking.longitude.toFixed(6)}
              </p>
            )}
            <div className="pt-2">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition"
              >
                <MapPin size={14} />
                Open Route in Google Maps →
              </a>
            </div>
          </div>

          {/* Assigned Technician & Dispatch */}
          <div className="rounded-3xl border border-border bg-white p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-primary" />
              Technician & Van Allocation
            </h3>
            {booking.technician ? (
              <div className="space-y-2">
                <p className="text-base font-bold text-foreground">{booking.technician.name}</p>
                <p className="text-xs text-slate-600 font-medium">
                  {booking.technician.role || "Mobile Tire Technician"}
                </p>
                {booking.technician.phone && (
                  <p className="text-xs font-mono text-slate-500">
                    Direct: {booking.technician.phone}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                No technician assigned yet. Use the assignment control above.
              </p>
            )}
          </div>
        </div>

        {/* Special Instructions & Operational Notes */}
        {(booking.message || booking.notes) && (
          <div className="rounded-3xl border border-border bg-white p-6 shadow-sm space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Customer Special Instructions & Dispatch Notes
            </h3>
            {booking.message && (
              <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-700">
                <span className="font-bold text-slate-900">Customer Note: </span>
                {booking.message}
              </div>
            )}
            {booking.notes && (
              <div className="rounded-xl bg-amber-50/60 border border-amber-200 p-3.5 text-xs text-amber-900">
                <span className="font-bold text-amber-950">Internal Dispatch Notes: </span>
                {booking.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
