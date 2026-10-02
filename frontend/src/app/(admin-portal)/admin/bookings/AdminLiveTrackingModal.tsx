"use client";

import { useEffect, useState, useRef } from "react";
import {
  X,
  Radio,
  MapPin,
  User,
  Clock,
  Gauge,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface AdminLiveTrackingModalProps {
  bookingId: string;
  customerName?: string;
  customerAddress?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface TelemetryData {
  success: boolean;
  bookingId: string;
  bookingStatus: string;
  isLive: boolean;
  hasArrived: boolean;
  arrivedAt?: string | null;
  dispatchToken?: string | null;
  dispatchUrl?: string | null;
  technician?: {
    name: string;
    role: string;
    phone: string;
  } | null;
  technicianLocation?: {
    latitude: number;
    longitude: number;
    heading: number | null;
    speed: number | null;
    updatedAt: string;
  } | null;
  customerLocation?: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  distanceMiles?: number | null;
  etaMinutes?: number | null;
  signalFreshness?: "waiting" | "fresh" | "stale" | "offline";
  error?: string;
}

export default function AdminLiveTrackingModal({
  bookingId,
  customerName = "Customer",
  customerAddress = "Customer Destination",
  isOpen,
  onClose,
}: AdminLiveTrackingModalProps) {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const isMountedRef = useRef(true);

  async function fetchTelemetry() {
    try {
      const res = await fetch(
        `/api/technician/location?bookingId=${encodeURIComponent(bookingId)}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );
      const data = await res.json();
      if (isMountedRef.current) {
        setTelemetry(data);
      }
    } catch (err) {
      console.debug("[AdminLiveTrackingModal] Fetch error:", err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    if (isOpen && bookingId) {
      setLoading(true);
      void fetchTelemetry();

      // Poll telemetry every 10 seconds while modal is open
      const interval = setInterval(() => {
        void fetchTelemetry();
      }, 10000);

      return () => {
        isMountedRef.current = false;
        clearInterval(interval);
      };
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [isOpen, bookingId]);

  if (!isOpen) return null;

  const fallbackUrl = typeof window !== "undefined"
    ? `${window.location.origin}/technician/tracking/${bookingId}`
    : `/technician/tracking/${bookingId}`;
  const dispatchUrl = telemetry?.dispatchUrl || fallbackUrl;

  function handleCopyDispatchLink() {
    navigator.clipboard.writeText(dispatchUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  const techLoc = telemetry?.technicianLocation;
  const custLoc = telemetry?.customerLocation;
  const mapsUrl = techLoc
    ? `https://www.google.com/maps/dir/?api=1&origin=${techLoc.latitude},${techLoc.longitude}&destination=${encodeURIComponent(
        custLoc?.address || customerAddress
      )}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Radio size={18} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Live GPS Telemetry
              </h3>
              <p className="text-xs text-text-secondary">
                Booking #{bookingId.slice(-6).toUpperCase()} • {customerName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {loading && !telemetry ? (
          <div className="py-12 text-center space-y-3">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
            <p className="text-xs font-semibold text-slate-500">
              Connecting to telemetry feed...
            </p>
          </div>
        ) : telemetry?.error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span>Telemetry Notice</span>
            </div>
            <p>{telemetry.error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status & Signal Banner */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/80 p-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Signal Status
                </span>
                <span className="text-xs font-bold text-foreground capitalize">
                  {telemetry?.hasArrived
                    ? "Arrived on Site"
                    : telemetry?.signalFreshness === "fresh"
                    ? "Active Broadcast (Fresh)"
                    : telemetry?.signalFreshness === "stale"
                    ? "Active Broadcast (Delayed)"
                    : "Awaiting Live Telemetry"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => fetchTelemetry()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <RefreshCw size={11} />
                Refresh
              </button>
            </div>

            {/* Technician Info */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User size={15} className="text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    {telemetry?.technician?.name || "Unassigned Technician"}
                  </span>
                </div>
                {telemetry?.technician?.role && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    {telemetry.technician.role}
                  </span>
                )}
              </div>

              {telemetry?.technician?.phone && (
                <p className="text-xs text-text-secondary pl-6">
                  Phone: {telemetry.technician.phone}
                </p>
              )}
            </div>

            {/* Telemetry Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <Gauge size={14} className="mx-auto text-primary mb-1" />
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Speed</span>
                <span className="text-xs font-bold text-foreground">
                  {typeof techLoc?.speed === "number" ? `${Math.round(techLoc.speed)} mph` : "--"}
                </span>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <MapPin size={14} className="mx-auto text-primary mb-1" />
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Distance</span>
                <span className="text-xs font-bold text-foreground">
                  {typeof telemetry?.distanceMiles === "number" ? `${telemetry.distanceMiles} mi` : "--"}
                </span>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <Clock size={14} className="mx-auto text-primary mb-1" />
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Est. ETA</span>
                <span className="text-xs font-bold text-foreground">
                  {typeof telemetry?.etaMinutes === "number" ? `~${telemetry.etaMinutes} min` : "--"}
                </span>
              </div>
            </div>

            {/* Destination */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Destination
              </span>
              <p className="text-xs text-foreground font-medium">
                {custLoc?.address || customerAddress}
              </p>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <ExternalLink size={12} />
                  <span>Open Live Route in Google Maps →</span>
                </a>
              )}
            </div>

            {/* Technician Dispatch Portal Link */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                Technician Dispatch Portal URL
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={dispatchUrl}
                  className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyDispatchLink}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  title="Copy technician dispatch portal link to clipboard"
                >
                  {copiedLink ? (
                    <>
                      <Check size={13} className="text-green-600" />
                      <span className="text-green-700 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
