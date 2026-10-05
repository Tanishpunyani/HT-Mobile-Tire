"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import {
  Car,
  Clock3,
  MapPin,
  Phone,
  Radio,
  ExternalLink,
  Navigation,
  Sparkles,
  CheckCircle2,
  XCircle,
  UserCheck,
  Wrench,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { BUSINESS_PHONE_RAW, BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";

interface LiveVanTrackerProps {
  bookingId: string;
  customerAddress: string;
  customerLat?: number | null;
  customerLng?: number | null;
  bookingStatus: string;
  onStatusChange?: (newStatus: string) => void;
}

interface TrackingData {
  success: boolean;
  bookingId: string;
  bookingStatus: string;
  isEnRoute: boolean;
  isCompleted: boolean;
  isLive: boolean;
  hasArrived?: boolean;
  arrivedAt?: string | null;
  technician: {
    name: string;
    role: string;
    phone?: string | null;
  } | null;
  technicianLocation: {
    latitude: number;
    longitude: number;
    heading?: number | null;
    speed?: number | null;
    updatedAt: string;
  } | null;
  customerLocation: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  etaMinutes: number | null;
  distanceMiles: number | null;
  signalFreshness: "waiting" | "fresh" | "stale" | "offline";
}

export default function LiveVanTracker({
  bookingId,
  customerAddress,
  customerLat,
  customerLng,
  bookingStatus,
  onStatusChange,
}: LiveVanTrackerProps) {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);
  const isMountedRef = useRef<boolean>(true);

  async function fetchLocation() {
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
        cache: "no-store",
      });
      if (!isMountedRef.current) return;

      if (!res.ok) {
        return;
      }

      const data = await res.json();
      if (!isMountedRef.current) return;

      const tracking: TrackingData | null =
        data?.tracking ||
        (data?.booking?.tracking ? { ...data.booking.tracking, success: true } : null);

      if (tracking) {
        setTrackingData(tracking);

        if (tracking.technicianLocation?.updatedAt) {
          const ageSec = Math.max(
            0,
            Math.floor((Date.now() - new Date(tracking.technicianLocation.updatedAt).getTime()) / 1000)
          );
          setSecondsAgo(ageSec);
        } else {
          setSecondsAgo(null);
        }

        const currentStatus = tracking.bookingStatus || data?.booking?.status;
        if (currentStatus && currentStatus !== bookingStatus && onStatusChange) {
          onStatusChange(currentStatus);
        }
      }
    } catch (err) {
      console.debug("[LiveVanTracker Poll Notice]:", err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    fetchLocation();

    // Stop polling if booking is completed or cancelled
    if (bookingStatus === "completed" || bookingStatus === "cancelled") {
      return () => {
        isMountedRef.current = false;
      };
    }

    const interval = setInterval(() => {
      if (isMountedRef.current) {
        fetchLocation();
      }
    }, 12000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [bookingId, bookingStatus]);

  // TERMINAL STATE: COMPLETED
  if (bookingStatus === "completed" || trackingData?.isCompleted) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-emerald-950">
              Service Completed — Thank You!
            </h4>
            <p className="text-xs text-emerald-800 mt-0.5">
              Your HT Mobile Technician has finished mounting, balancing, and calibrating your tires.{" "}
              You can download your receipt and leave a review below.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // TERMINAL STATE: CANCELLED
  if (bookingStatus === "cancelled" || trackingData?.bookingStatus === "cancelled") {
    return (
      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/70 p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm">
            <XCircle size={22} />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-red-950">Appointment Cancelled</h4>
            <p className="text-xs text-red-800 mt-0.5">
              This service appointment has been cancelled. Live tracking is no longer active.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // INITIAL LOADING SKELETON
  if (loading && !trackingData) {
    return (
      <div className="mt-5 rounded-2xl border border-border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
          <div>
            <h4 className="text-sm font-bold text-foreground">Updating your service...</h4>
            <p className="text-xs text-text-secondary">Retrieving real-time dispatch and GPS details.</p>
          </div>
        </div>
        <div className="h-44 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  const techName = trackingData?.technician?.name || "Assigned Technician";
  const techRole = trackingData?.technician?.role || "Mobile Tire Specialist";
  const businessPhone = BUSINESS_PHONE_RAW;
  const freshness = trackingData?.signalFreshness || "waiting";
  const isServiceInProgress = bookingStatus === "in_progress" || trackingData?.bookingStatus === "in_progress";
  const isArrived = !isServiceInProgress && Boolean(trackingData?.hasArrived || trackingData?.arrivedAt);

  // STATE: SERVICE IN PROGRESS (On-site work underway)
  if (isServiceInProgress) {
    return (
      <div className="mt-5 overflow-hidden rounded-[24px] border border-blue-200 bg-white shadow-md transition-all">
        {/* Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-blue-500" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold tracking-wide text-white">
                  SERVICE IN PROGRESS
                </h4>
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-300 border border-blue-500/30">
                  ON-SITE
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Your technician is currently working on your vehicle at your location.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 bg-white space-y-4">
          {/* Work Summary Box */}
          <div className="flex items-start gap-3.5 rounded-2xl bg-blue-50/80 p-4 border border-blue-100">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Wrench size={22} className="animate-pulse" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                Mobile Tire Installation & Balancing
              </h5>
              <p className="mt-0.5 text-xs text-blue-900 leading-relaxed">
                Your technician is performing professional tire mounting, laser wheel balancing, and bead pressure calibration. Settle on-site upon completion.
              </p>
            </div>
          </div>

          {/* Technician Profile & Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UserCheck size={18} className="text-primary" />
                <h4 className="text-sm font-bold text-foreground">{techName}</h4>
                <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-primary border border-blue-200">
                  {techRole}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Service location: <strong className="text-foreground">{customerAddress}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={`tel:${businessPhone}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-hover active:scale-95"
              >
                <Phone size={14} />
                Call Dispatch: {BUSINESS_PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </div>

        {/* Mobile Sticky Action Bar for In Progress */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 text-white border-t border-white/10 p-3 backdrop-blur-md shadow-2xl flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-extrabold text-blue-400 block truncate">
              🔧 Service In Progress
            </span>
            <span className="text-[10px] text-slate-300 block truncate">{techName}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`tel:${businessPhone}`}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm"
            >
              <Phone size={14} />
              Call Dispatch
            </a>
          </div>
        </div>
      </div>
    );
  }

  // STATE: ARRIVED ON-SITE
  if (isArrived) {
    return (
      <div className="mt-5 overflow-hidden rounded-[24px] border border-emerald-200 bg-white shadow-md transition-all">
        {/* Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold tracking-wide text-white">
                  TECHNICIAN HAS ARRIVED
                </h4>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                  PARKED ON-SITE
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Your technician is at your vehicle and ready to begin tire work.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 bg-white space-y-4">
          <div className="flex items-start gap-3.5 rounded-2xl bg-emerald-50/80 p-4 border border-emerald-200">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <MapPin size={22} />
            </div>
            <div>
              <h5 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Mobile Van On-Site
              </h5>
              <p className="mt-0.5 text-xs text-emerald-900 leading-relaxed">
                <strong>{techName}</strong> is parked at <strong>{customerAddress}</strong>. Please ensure the vehicle is accessible and wheel lock keys are available if applicable.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UserCheck size={18} className="text-emerald-600" />
                <h4 className="text-sm font-bold text-foreground">{techName}</h4>
                <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                  {techRole}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Technician is ready to begin mounting & balancing.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={`tel:${businessPhone}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-hover active:scale-95"
              >
                <Phone size={14} />
                Call Dispatch: {BUSINESS_PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </div>

        {/* Mobile Sticky Action Bar for Arrived */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 text-white border-t border-white/10 p-3 backdrop-blur-md shadow-2xl flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-extrabold text-emerald-400 block truncate">
              ✓ Technician Arrived
            </span>
            <span className="text-[10px] text-slate-300 block truncate">{techName}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`tel:${businessPhone}`}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm"
            >
              <Phone size={14} />
              Call Dispatch
            </a>
          </div>
        </div>
      </div>
    );
  }

  // STATE: WAITING FOR GPS OR TECH PREPARING
  if (freshness === "waiting" || !trackingData?.technicianLocation) {
    return (
      <div className="mt-5 rounded-[24px] border border-blue-200 bg-blue-50/80 p-6 text-slate-800 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
            <Radio size={24} className="animate-pulse" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-extrabold text-blue-950">Technician Assigned</h4>
              <span className="rounded-full bg-blue-200/80 px-2.5 py-0.5 text-[10px] font-bold text-blue-900">
                PREPARING SERVICE VAN
              </span>
            </div>
            <p className="text-xs text-blue-900 leading-relaxed">
              <strong>{techName}</strong> ({techRole}) has been assigned to your service. Live route tracking will activate automatically as soon as the mobile van is en route.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href={`tel:${businessPhone}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover shadow-sm"
              >
                <Phone size={13} />
                <span>Call Dispatch: {BUSINESS_PHONE_DISPLAY}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STATES: EN ROUTE WITH LIVE / STALE GPS
  const techLat = trackingData.technicianLocation.latitude;
  const techLng = trackingData.technicianLocation.longitude;
  const destLat = customerLat || 32.7767;
  const destLng = customerLng || -96.797;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const hasGoogleKey = Boolean(
    apiKey && !apiKey.includes("YOUR_") && apiKey !== "AIzaSyDummyKeyForDevelopment12345"
  );

  const staticMapUrl = hasGoogleKey
    ? `https://maps.googleapis.com/maps/api/staticmap?size=640x320&scale=2&maptype=roadmap&markers=color:blue%7Clabel:V%7C${techLat},${techLng}&markers=color:red%7Clabel:D%7C${destLat},${destLng}&path=color:0x0284c7ff|weight:5|${techLat},${techLng}|${destLat},${destLng}&key=${apiKey}`
    : null;

  const googleMapsRouteUrl = `https://www.google.com/maps/dir/?api=1&origin=${techLat},${techLng}&destination=${encodeURIComponent(
    customerAddress || `${destLat},${destLng}`
  )}&travelmode=driving`;

  const etaDisplay =
    trackingData.etaMinutes !== null && trackingData.etaMinutes > 0
      ? `~${trackingData.etaMinutes} Mins`
      : "Updating arrival time...";

  return (
    <div className="mt-5 overflow-hidden rounded-[24px] border border-blue-300 bg-white shadow-xl transition-all">
      {/* 1. TOP HEADER: Status & ETA */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-4 text-white">
        <div className="flex items-center gap-3">
          {freshness === "fresh" && (
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
            </span>
          )}
          {freshness === "stale" && (
            <span className="relative flex h-3.5 w-3.5">
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-amber-400" />
            </span>
          )}
          {freshness === "offline" && (
            <span className="relative flex h-3.5 w-3.5">
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-slate-500" />
            </span>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold tracking-wide text-white">
                TECHNICIAN ON THE WAY
              </h4>
              {freshness === "fresh" && (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                  LIVE GPS
                </span>
              )}
              {freshness === "stale" && (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-amber-500/30">
                  SIGNAL UPDATING...
                </span>
              )}
              {freshness === "offline" && (
                <span className="rounded bg-slate-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-300 border border-slate-500/30">
                  LAST KNOWN POSITION
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300">
              {freshness === "fresh" && (
                <span>Your mobile technician is travelling to your location.</span>
              )}
              {freshness === "stale" && (
                <span>Location updated recently. Reconnecting live broadcast...</span>
              )}
              {freshness === "offline" && (
                <span>Showing last reported van location. Tracking updating shortly.</span>
              )}
            </p>
          </div>
        </div>

        {/* Hero ETA Badge */}
        <div className="rounded-2xl bg-gradient-to-br from-primary to-blue-700 px-4 py-2 text-center shadow-md">
          <div className="text-[9px] font-bold uppercase tracking-wider text-white/80">
            Estimated Arrival
          </div>
          <div className="text-base font-extrabold text-white">
            {etaDisplay}
          </div>
        </div>
      </div>

      {/* 2. HERO MAP: Primary Tracking Visual */}
      <div className="relative h-72 sm:h-80 md:h-96 w-full bg-slate-950 overflow-hidden">
        {staticMapUrl ? (
          <Image
            src={staticMapUrl}
            alt="Live GPS technician van route"
            fill
            className="object-cover"
          />
        ) : (
          <div className="relative h-full w-full flex items-center justify-center bg-slate-950 p-6 overflow-hidden">
            {/* Blueprint Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:28px_28px] opacity-50" />
            
            {/* Animated Radar Pulse Rings */}
            <div className="absolute h-64 w-64 rounded-full border border-blue-500/20 animate-ping" />
            <div className="absolute h-48 w-48 rounded-full border border-blue-500/30" />
            <div className="absolute h-32 w-32 rounded-full border border-blue-500/40" />

            {/* Connecting Route Dash */}
            <div className="absolute w-1/2 h-0.5 border-t-2 border-dashed border-blue-400/60 rotate-12" />

            {/* Technician Van Pin */}
            <div className="absolute left-[25%] top-[35%] flex flex-col items-center animate-bounce">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/60 border-2 border-white">
                <Car size={22} />
              </div>
              <span className="mt-1 rounded-full bg-slate-900/90 px-2.5 py-0.5 text-[10px] font-extrabold text-white border border-primary/50 shadow-md">
                🚐 {techName.split(" ")[0]} (HT Tires)
              </span>
            </div>

            {/* Customer Location Pin */}
            <div className="absolute right-[25%] top-[55%] flex flex-col items-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-500/60 border-2 border-white">
                <MapPin size={22} />
              </div>
              <span className="mt-1 rounded-full bg-slate-900/90 px-2.5 py-0.5 text-[10px] font-extrabold text-white border border-emerald-500/50 shadow-md">
                📍 You (Service Destination)
              </span>
            </div>
          </div>
        )}

        {/* Distance Remaining Floating Pill */}
        {trackingData.distanceMiles !== null && trackingData.distanceMiles > 0 && (
          <div className="absolute bottom-4 left-4 rounded-xl bg-slate-950/90 px-3.5 py-1.5 text-xs text-white backdrop-blur-md border border-white/20 shadow-lg flex items-center gap-1.5">
            <Navigation size={13} className="text-primary" />
            <span>
              Distance remaining: <strong>{trackingData.distanceMiles} mi</strong>
            </span>
          </div>
        )}
      </div>

      {/* 3. TECHNICIAN CARD & ACTION BUTTONS */}
      <div className="p-5 sm:p-6 bg-white space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <UserCheck size={18} className="text-primary" />
              <h4 className="text-base font-extrabold text-foreground">{techName}</h4>
              <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-primary border border-blue-200">
                {techRole}
              </span>
            </div>

            <p className="text-xs text-text-secondary">
              Destination: <strong className="text-foreground">{customerAddress}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={`tel:${businessPhone}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary-hover active:scale-95"
            >
              <Phone size={14} />
              Call Dispatch: {BUSINESS_PHONE_DISPLAY}
            </a>

            <a
              href={googleMapsRouteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-text-secondary hover:bg-slate-100 hover:text-foreground transition"
            >
              <Navigation size={14} className="text-primary" />
              Live Route
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* 4. MOBILE-ONLY STICKY BOTTOM ACTION BAR */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 text-white border-t border-white/10 p-3 backdrop-blur-md shadow-2xl flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-extrabold text-blue-400 block truncate">
            🚐 {techName.split(" ")[0]} is on the way
          </span>
          <span className="text-[10px] text-slate-300 block truncate">{etaDisplay}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`tel:${businessPhone}`}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm"
          >
            <Phone size={14} />
            Call Dispatch
          </a>
        </div>
      </div>
    </div>
  );
}
