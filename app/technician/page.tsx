"use client";

import { useEffect, useState, Suspense, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Navigation,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Car,
  Clock,
  Calendar,
  Phone,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  User,
  Wrench,
  FileText,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";

import {
  getTechnicianPortalDataAction,
  markTechnicianArrivedAction,
} from "@/app/actions/bookings";
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_RAW } from "@/lib/constants/phone";

interface TechnicianData {
  id: string;
  name: string;
  role: string;
  phone?: string | null;
  isActive: boolean;
}

interface AssignedBooking {
  id: string;
  status: string;
  primaryService?: string | null;
  service?: { name: string } | null;
  vehicle: string;
  tireSize?: string | null;
  location: string;
  formattedAddress?: string | null;
  bookingDate: string | Date;
  bookingTime: string | Date;
  notes?: string | null;
  arrivedAt?: string | Date | null;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
}

interface StatsData {
  activeCount: number;
  completedCount: number;
  cancelledCount: number;
  totalCount: number;
}

function TechnicianPortalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [technician, setTechnician] = useState<TechnicianData | null>(null);
  const [activeJobs, setActiveJobs] = useState<AssignedBooking[]>([]);
  const [completedJobs, setCompletedJobs] = useState<AssignedBooking[]>([]);
  const [cancelledJobs, setCancelledJobs] = useState<AssignedBooking[]>([]);
  const [stats, setStats] = useState<StatsData>({
    activeCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    totalCount: 0,
  });

  const [activeTab, setActiveTab] = useState<"active" | "completed" | "cancelled">("active");
  const [arrivingId, setArrivingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadPortalData() {
    if (!token) {
      setLoading(false);
      setErrorMsg("Missing dispatch authentication token. Please use the personalized dispatch link provided by dispatch.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await getTechnicianPortalDataAction(token);
      if (res.success && res.technician) {
        setTechnician(res.technician);
        setActiveJobs(res.activeJobs || []);
        setCompletedJobs(res.completedJobs || []);
        setCancelledJobs(res.cancelledJobs || []);
        if (res.stats) {
          setStats(res.stats);
        }
      } else {
        setErrorMsg(res.error || "Unable to authenticate technician dispatch session.");
      }
    } catch (err: any) {
      console.error("[Technician Portal Load Error]:", err);
      setErrorMsg("Failed to connect to dispatch server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPortalData();
  }, [token]);

  async function handleMarkArrived(bookingId: string) {
    setArrivingId(bookingId);
    setActionSuccessMsg(null);
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await markTechnicianArrivedAction(bookingId, token);
        if (res.success) {
          setActionSuccessMsg("Arrival recorded successfully! Admin has been notified.");
          // Update local state to show arrived
          setActiveJobs((prev) =>
            prev.map((job) =>
              job.id === bookingId
                ? { ...job, arrivedAt: res.arrivedAt || new Date().toISOString() }
                : job
            )
          );
        } else {
          setErrorMsg(res.error || "Failed to record arrival.");
        }
      } catch (err: any) {
        setErrorMsg("Network error recording arrival.");
      } finally {
        setArrivingId(null);
      }
    });
  }

  // 1. Unauthenticated or Invalid Session Screen
  if (!loading && (!token || errorMsg && !technician)) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-md w-full rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/10">
            <ShieldAlert size={32} />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Technician Portal Access
            </h1>
            <p className="text-sm text-slate-400">
              {errorMsg || "A valid, secure dispatch link is required to access your technician console."}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-950/80 p-4 border border-slate-800 text-left text-xs text-slate-300 space-y-2.5">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-primary" />
              How to access your assignments:
            </p>
            <p className="text-slate-400 leading-relaxed">
              1. When dispatch assigns you to a job, you will receive your personalized one-click dispatch link.
            </p>
            <p className="text-slate-400 leading-relaxed">
              2. Open the dispatch link directly on your mobile device to access your route, GPS telemetry, and customer info.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={`tel:${BUSINESS_PHONE_RAW}`}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 py-3.5 text-sm font-bold text-white hover:bg-slate-700 transition"
            >
              <Phone size={16} />
              Call Dispatch Hotline ({BUSINESS_PHONE_DISPLAY})
            </a>

            <Link
              href="/admin/login"
              className="inline-block text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              Admin Staff Portal →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-10 w-10 border-3 border-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-primary/20" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">Verifying Dispatch Session</p>
            <p className="text-xs text-slate-400">Retrieving assigned mobile service orders...</p>
          </div>
        </div>
      </div>
    );
  }

  const currentList =
    activeTab === "active"
      ? activeJobs
      : activeTab === "completed"
      ? completedJobs
      : cancelledJobs;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      {/* Top Mobile App Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 py-3.5">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/30">
              <Car size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-extrabold text-white tracking-tight">HT Mobile Tires</h1>
                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-primary border border-primary/30">
                  FIELD
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[180px] sm:max-w-xs">
                {technician?.name || "Technician"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadPortalData}
              disabled={loading}
              title="Refresh assigned jobs"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-primary" : ""} />
            </button>

            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-800/40 bg-emerald-950/50 px-2.5 py-1.5 text-xs text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold">ONLINE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-2xl px-4 sm:px-6 pt-5 space-y-5">
        {/* Action / Error Alerts */}
        {actionSuccessMsg && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-950/90 border border-emerald-700/60 p-3.5 text-xs text-emerald-200 shadow-lg animate-in fade-in">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span className="font-medium">{actionSuccessMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-red-950/90 border border-red-700/60 p-3.5 text-xs text-red-200 shadow-lg">
            <AlertCircle size={18} className="text-red-400 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Technician Profile Card */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-primary border border-slate-700">
                <User size={24} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">{technician?.name}</h2>
                <p className="text-xs text-slate-400 font-medium">{technician?.role || "Mobile Tire Technician"}</p>
              </div>
            </div>

            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
              Active Field Unit
            </span>
          </div>

          {/* Quick Stats Grid */}
          <div className="mt-4 grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-800/80">
            <div
              onClick={() => setActiveTab("active")}
              className={`cursor-pointer rounded-2xl p-3 text-center transition ${
                activeTab === "active"
                  ? "bg-primary/20 border border-primary/40 text-white"
                  : "bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider">Active</p>
              <p className="text-lg font-extrabold text-white mt-0.5">{stats.activeCount}</p>
            </div>

            <div
              onClick={() => setActiveTab("completed")}
              className={`cursor-pointer rounded-2xl p-3 text-center transition ${
                activeTab === "completed"
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-white"
                  : "bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider">Completed</p>
              <p className="text-lg font-extrabold text-emerald-400 mt-0.5">{stats.completedCount}</p>
            </div>

            <div
              onClick={() => setActiveTab("cancelled")}
              className={`cursor-pointer rounded-2xl p-3 text-center transition ${
                activeTab === "cancelled"
                  ? "bg-red-500/20 border border-red-500/40 text-white"
                  : "bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider">Cancelled</p>
              <p className="text-lg font-extrabold text-slate-300 mt-0.5">{stats.cancelledCount}</p>
            </div>
          </div>
        </section>

        {/* Tab Switcher */}
        <div className="flex rounded-2xl bg-slate-900/80 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`flex-1 rounded-xl py-2.5 text-xs font-extrabold transition ${
              activeTab === "active"
                ? "bg-primary text-white shadow-md shadow-primary/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Active Jobs ({stats.activeCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`flex-1 rounded-xl py-2.5 text-xs font-extrabold transition ${
              activeTab === "completed"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            History ({stats.completedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cancelled")}
            className={`flex-1 rounded-xl py-2.5 text-xs font-extrabold transition ${
              activeTab === "cancelled"
                ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Cancelled ({stats.cancelledCount})
          </button>
        </div>

        {/* Job List */}
        <section className="space-y-4">
          {currentList.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-400">
                {activeTab === "active" ? <CheckCircle size={24} /> : <FileText size={24} />}
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {activeTab === "active"
                    ? "No Active Service Bookings"
                    : activeTab === "completed"
                    ? "No Completed History Yet"
                    : "No Cancelled Assignments"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {activeTab === "active"
                    ? "You are all caught up! New dispatch assignments will appear here."
                    : "Assigned service orders will be archived here upon completion."}
                </p>
              </div>
            </div>
          ) : (
            currentList.map((job) => {
              const serviceName = job.primaryService || job.service?.name || "Mobile Tire Service";
              const shortId = job.id.slice(-6).toUpperCase();
              const formattedDate = new Date(job.bookingDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const formattedTime = new Date(job.bookingTime).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const destinationAddress = job.formattedAddress || job.location;
              const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                destinationAddress
              )}`;
              const trackingConsoleUrl = `/technician/tracking/${job.id}?token=${encodeURIComponent(
                token
              )}`;
              const isArrived = Boolean(job.arrivedAt);

              return (
                <article
                  key={job.id}
                  className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-4 transition hover:border-slate-700"
                >
                  {/* Job Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-mono font-extrabold text-slate-300">
                          #{shortId}
                        </span>
                        <h3 className="text-sm font-extrabold text-white">{serviceName}</h3>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-primary" />
                          {formattedDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={13} className="text-primary" />
                          {formattedTime}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide border ${
                          job.status === "in_progress"
                            ? "bg-blue-950 text-blue-300 border-blue-700"
                            : job.status === "confirmed"
                            ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                            : job.status === "completed"
                            ? "bg-slate-800 text-slate-300 border-slate-700"
                            : "bg-red-950 text-red-300 border-red-700"
                        }`}
                      >
                        {job.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  {/* Customer & Vehicle Details Box */}
                  <div className="rounded-2xl bg-slate-950/80 p-3.5 border border-slate-800/80 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Customer:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          {job.customer?.name || "Valued Customer"}
                        </span>
                        {job.customer?.phone && (
                          <a
                            href={`tel:${job.customer.phone}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary/20 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary hover:text-white transition"
                          >
                            <Phone size={12} />
                            Call
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Vehicle:</span>
                      <span className="font-semibold text-white">{job.vehicle}</span>
                    </div>

                    {job.tireSize && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Tire Size:</span>
                        <span className="font-mono font-bold text-primary">{job.tireSize}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-800/60 flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Destination</span>
                        <p className="font-medium text-slate-200 leading-snug">{destinationAddress}</p>
                      </div>

                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-slate-800 p-2 text-primary hover:bg-primary hover:text-white transition"
                        title="Launch Google Maps Turn-by-Turn Navigation"
                      >
                        <Navigation size={16} />
                      </a>
                    </div>

                    {job.notes && (
                      <div className="pt-2 border-t border-slate-800/60">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Service Notes:</span>
                        <p className="text-slate-300 text-[11px] italic mt-0.5">{job.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Arrived On-Site Indicator */}
                  {isArrived && (
                    <div className="rounded-xl bg-emerald-950/60 p-2.5 border border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-300">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span>
                        Arrived on-site at{" "}
                        {new Date(job.arrivedAt!).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons for Active Jobs */}
                  {(job.status === "confirmed" || job.status === "in_progress") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {/* Open Live GPS Console */}
                      <Link
                        href={trackingConsoleUrl}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 px-4 text-xs font-extrabold text-white shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-98 transition"
                      >
                        <MapPin size={15} />
                        Open GPS Console →
                      </Link>

                      {/* On-Site Arrival Button (if confirmed and not yet marked arrived) */}
                      {!isArrived && job.status === "confirmed" ? (
                        <button
                          type="button"
                          onClick={() => handleMarkArrived(job.id)}
                          disabled={arrivingId === job.id || isPending}
                          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 px-4 text-xs font-extrabold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-98 transition disabled:opacity-50"
                        >
                          <CheckCircle2 size={15} />
                          {arrivingId === job.id ? "Recording..." : "Mark Arrived On-Site"}
                        </button>
                      ) : (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 rounded-2xl bg-slate-800 py-3 px-4 text-xs font-extrabold text-slate-200 hover:bg-slate-700 transition"
                        >
                          <Navigation size={15} />
                          Navigate in Maps
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>

        {/* Footer Support Info */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-center text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-400">HT Mobile Tires Field Operations Console</p>
          <p>Questions about route or assignment? Call Dispatch at {BUSINESS_PHONE_DISPLAY}</p>
        </div>
      </main>
    </div>
  );
}

export default function TechnicianPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading technician dispatch console...</span>
          </div>
        </div>
      }
    >
      <TechnicianPortalContent />
    </Suspense>
  );
}
