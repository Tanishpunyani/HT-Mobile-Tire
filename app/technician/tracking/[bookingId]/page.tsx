"use client";

import { use, useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Navigation,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Car,
  PauseCircle,
  PlayCircle,
  ArrowLeft,
  UserCheck,
} from "lucide-react";

import { markTechnicianArrivedAction, startTechnicianTripAction } from "@/app/actions/bookings";

interface TechnicianTrackingPageProps {
  params: Promise<{
    bookingId: string;
  }>;
}

// Calculate Great-Circle distance in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function TechnicianTrackingContent({ bookingId }: { bookingId: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy?: number; speed?: number | null } | null>(null);
  const [pingCount, setPingCount] = useState<number>(0);
  const [lastSentTime, setLastSentTime] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{ code: number; isRecoverable: boolean } | null>(null);
  const [customerAddress, setCustomerAddress] = useState<string>("Customer Destination");
  const [technicianName, setTechnicianName] = useState<string | null>(null);
  const [technicianRole, setTechnicianRole] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [hasArrived, setHasArrived] = useState<boolean>(false);
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  const [arriving, setArriving] = useState<boolean>(false);
  const [canBroadcast, setCanBroadcast] = useState<boolean>(true);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [tripStarted, setTripStarted] = useState<boolean>(false);
  const [startingTrip, setStartingTrip] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const lastBroadcastTimeRef = useRef<number>(0);
  const lastBroadcastCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastBroadcastHeadingRef = useRef<number | null>(null);

  // Fetch initial booking details
  useEffect(() => {
    async function loadBooking() {
      try {
        setLoadingInitial(true);
        const url = `/api/technician/location?bookingId=${encodeURIComponent(bookingId)}${
          token ? `&token=${encodeURIComponent(token)}` : ""
        }`;
        const res = await fetch(url, {
          headers: token ? { "x-dispatch-token": token } : {},
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.customerLocation?.address) setCustomerAddress(data.customerLocation.address);
          if (data.bookingStatus) setBookingStatus(data.bookingStatus);
          if (data.hasArrived) {
            setHasArrived(true);
            setArrivedAt(data.arrivedAt || null);
          }
          if (data.technician) {
            setTechnicianName(data.technician.name);
            setTechnicianRole(data.technician.role);
          } else {
            setErrorMsg("Please assign a technician to this booking before starting GPS tracking.");
            setCanBroadcast(false);
          }

          if (data.bookingStatus === "completed" || data.bookingStatus === "cancelled") {
            setErrorMsg(
              data.bookingStatus === "cancelled"
                ? "This service booking has been CANCELLED by dispatch. GPS tracking is disabled."
                : `This service is ${data.bookingStatus}. GPS tracking is no longer active.`
            );
            setCanBroadcast(false);
            stopSharing();
          }
        } else {
          setErrorMsg(data.error || "Unable to load booking details.");
          setCanBroadcast(false);
        }
      } catch (err: unknown) {
        console.error("[Tracking Initial Load Error]:", err);
        setErrorMsg("Failed to connect to dispatch server.");
        setCanBroadcast(false);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadBooking();
  }, [bookingId, token]);

  // Send coordinates to server with client-side throttling
  async function broadcastLocation(lat: number, lng: number, heading?: number | null, speed?: number | null, force = false) {
    const now = Date.now();
    const timeSinceLast = now - lastBroadcastTimeRef.current;

    // Apply 6-second minimum throttle unless forced
    if (!force && timeSinceLast < 6000) {
      return;
    }

    // Check distance/heading change filter (send if moved >10m, heading changed >15 deg, or heartbeat >15s)
    if (!force && lastBroadcastCoordsRef.current) {
      const distMeters = calculateDistanceMeters(
        lastBroadcastCoordsRef.current.latitude,
        lastBroadcastCoordsRef.current.longitude,
        lat,
        lng
      );
      const prevHeading = lastBroadcastHeadingRef.current ?? 0;
      const curHeading = heading ?? 0;
      const headingDiff = Math.abs(curHeading - prevHeading);

      if (distMeters < 10 && headingDiff < 15 && timeSinceLast < 15000) {
        return; // Skip duplicate / stationary jitter within 15-second heartbeat window
      }
    }

    try {
      lastBroadcastTimeRef.current = now;
      lastBroadcastCoordsRef.current = { latitude: lat, longitude: lng };
      lastBroadcastHeadingRef.current = heading ?? null;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["x-dispatch-token"] = token;
      }

      const res = await fetch("/api/technician/location", {
        method: "POST",
        headers,
        body: JSON.stringify({
          bookingId,
          latitude: lat,
          longitude: lng,
          heading: heading ?? null,
          speed: speed ?? null,
          token: token || undefined,
          dispatchToken: token || undefined,
        }),
      });

      if (res.ok) {
        setPingCount((prev) => prev + 1);
        setLastSentTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        setErrorMsg(null);
        setErrorState(null);
      } else {
        const data = await res.json().catch(() => null);
        if (data?.error) {
          setErrorMsg(data.error);
        }
        if (res.status === 400 || res.status === 404 || data?.error?.toLowerCase().includes("cancel")) {
          stopSharing();
          setCanBroadcast(false);
          setBookingStatus("cancelled");
        }
      }
    } catch (err) {
      console.error("[Broadcast Error]:", err);
      setErrorMsg("Network error sending GPS beacon. Retrying...");
    }
  }

  function startSharing() {
    if (!canBroadcast) return;
    setErrorMsg(null);
    setErrorState(null);

    // 1. Support check
    if (typeof window === "undefined" || !navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your mobile browser.");
      setErrorState({ code: 0, isRecoverable: false });
      return;
    }

    // 2. Secure context check (allow localhost for development)
    if (
      window.isSecureContext === false &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setErrorMsg(
        "Location tracking requires a secure connection. Please open the technician portal using the HTTPS website."
      );
      setErrorState({ code: 0, isRecoverable: false });
      return;
    }

    // 3. Clear existing watch and retry timers before starting new watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (retryTimeoutRef.current !== null) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setIsSharing(true);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (!isMountedRef.current) return;

        // Clear any pending retry timer on successful position receipt
        if (retryTimeoutRef.current !== null) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }

        setErrorMsg(null);
        setErrorState(null);

        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        setCoords({ latitude, longitude, accuracy, speed });
        broadcastLocation(latitude, longitude, heading, speed);
      },
      (err) => {
        if (!isMountedRef.current) return;

        const code = typeof err?.code === "number" ? err.code : 0;
        const rawMessage = typeof err?.message === "string" ? err.message : "";

        let userMessage = "Unable to update your location right now. Please try again.";
        let isRecoverable = false;

        if (code === 1 /* PERMISSION_DENIED */) {
          console.warn("[GPS] Location permission denied by technician/browser");
          userMessage =
            "Location access is blocked. Allow location permission for HT Mobile Tires in your browser/device settings, then try again.";
          setIsSharing(false);
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
        } else if (code === 2 /* POSITION_UNAVAILABLE */) {
          console.warn("[GPS] Position unavailable:", rawMessage || "Signal weak or GPS disabled");
          userMessage =
            "Your device could not determine your location. Check that device Location Services are enabled and try again.";
          isRecoverable = true;
        } else if (code === 3 /* TIMEOUT */) {
          console.warn("[GPS] Location request timed out - retrying");
          userMessage = "Location is taking too long to respond. We're retrying...";
          isRecoverable = true;
        } else {
          console.warn("[GPS] Location error:", { code, message: rawMessage || "Unknown" });
          userMessage = "Unable to update your location right now. Please try again.";
          isRecoverable = true;
        }

        setErrorMsg(userMessage);
        setErrorState({ code, isRecoverable });

        // For recoverable errors (timeout, position unavailable), attempt a safe gentle retry after 6 seconds if active
        if (isRecoverable) {
          if (retryTimeoutRef.current !== null) {
            clearTimeout(retryTimeoutRef.current);
          }
          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && canBroadcast && !hasArrived) {
              console.debug("[GPS] Executing safe auto-retry for recoverable GPS condition");
              startSharing();
            }
          }, 6000);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 4000,
      }
    );

    watchIdRef.current = id;
  }

  function handleRetryGps() {
    setErrorMsg(null);
    setErrorState(null);
    startSharing();
  }

  async function handleStartRoute() {
    if (!canBroadcast || loadingInitial || startingTrip) return;
    setErrorMsg(null);
    setErrorState(null);

    // If trip not yet marked started, invoke startTechnicianTripAction
    if (!tripStarted) {
      setStartingTrip(true);
      try {
        const tripRes = await startTechnicianTripAction(bookingId, token || "");
        if (!tripRes.success) {
          setErrorMsg(tripRes.error || "Failed to start trip.");
          setStartingTrip(false);
          return;
        }
        setTripStarted(true);
      } catch (err: unknown) {
        console.error("[Start Trip Error]:", err);
        setErrorMsg("Failed to dispatch route notification. Please try again.");
        setStartingTrip(false);
        return;
      } finally {
        setStartingTrip(false);
      }
    }

    startSharing();
  }

  async function handleArrived() {
    setArriving(true);
    setErrorMsg(null);
    setErrorState(null);
    try {
      const res = await markTechnicianArrivedAction(bookingId, token || "");
      if (res.success) {
        setHasArrived(true);
        setArrivedAt(res.arrivedAt || new Date().toISOString());
        stopSharing(); // Stop GPS watch after arrival confirmed
      } else {
        setErrorMsg(res.error || "Unable to confirm arrival. Please try again.");
      }
    } catch (err: unknown) {
      console.error("[Arrival Error]:", err);
      setErrorMsg("Failed to connect to server. Please try again.");
    } finally {
      setArriving(false);
    }
  }

  function stopSharing() {
    if (retryTimeoutRef.current !== null) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharing(false);
  }

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const backLinkHref = token ? `/technician?token=${encodeURIComponent(token)}` : "/admin/bookings";
  const backLinkLabel = token ? "Back to Dispatch Portal" : "Back to Admin Bookings";

  return (
    <div className="min-h-screen bg-slate-950 text-white py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <Link
            href={backLinkHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
          >
            <ArrowLeft size={14} />
            {backLinkLabel}
          </Link>

          <span className="rounded-full bg-primary/20 px-3 py-1 text-[11px] font-mono font-bold text-primary border border-primary/30">
            DISPATCH CONSOLE
          </span>
        </div>

        {/* Technician Card */}
        <div className="rounded-[24px] border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
                <Car size={24} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Technician Mobile Console</h1>
                <p className="text-xs text-slate-400">Booking #{bookingId.slice(0, 8)}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-full ${hasArrived ? "bg-emerald-500" : isSharing ? "bg-green-500 animate-ping" : "bg-slate-600"}`} />
              <span className="text-xs font-mono font-bold text-slate-300">
                {hasArrived ? "ARRIVED" : isSharing ? "BROADCASTING" : "IDLE"}
              </span>
            </div>
          </div>

          {/* Assigned Technician Profile Box */}
          <div className="mt-4 rounded-xl bg-slate-950/80 p-3 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <UserCheck size={18} className="text-primary" />
              <div>
                <p className="text-xs font-bold text-white">
                  {technicianName || "Checking technician assignment..."}
                </p>
                <p className="text-[11px] text-slate-400">
                  {technicianRole || "Assigned Technician"}
                </p>
              </div>
            </div>
            {bookingStatus && (
              <span className="rounded-md bg-blue-900/50 px-2 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-700/50">
                {bookingStatus.toUpperCase()}
              </span>
            )}
          </div>

          {/* Persistent Arrival Status Banner */}
          {hasArrived && (
            <div className="mt-4 rounded-xl bg-emerald-950/80 p-4 border border-emerald-800 flex items-center gap-3">
              <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Technician Arrived On-Site</p>
                <p className="text-[11px] text-emerald-300">
                  Arrival confirmed at {new Date(arrivedAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Stand by for admin to start service.
                </p>
              </div>
            </div>
          )}

          {/* Cancellation Status Banner */}
          {bookingStatus === "cancelled" && (
            <div className="mt-4 rounded-xl bg-red-950/90 p-4 border border-red-800 flex items-center gap-3">
              <AlertCircle size={22} className="text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Service Booking Cancelled</p>
                <p className="text-[11px] text-red-300">
                  This booking has been cancelled by dispatch. GPS broadcasting is disabled. Do not proceed to customer location.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 rounded-xl bg-red-950/80 p-4 text-xs text-red-200 border border-red-800 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-bold text-white text-xs">Location Notice</p>
                  <p className="text-red-300 leading-relaxed">{errorMsg}</p>
                </div>
              </div>

              {(!isSharing || errorState?.code === 1 || errorState?.isRecoverable) && !hasArrived && canBroadcast && (
                <button
                  type="button"
                  onClick={handleRetryGps}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-900/70 hover:bg-red-800 border border-red-700/70 px-3 py-1.5 text-xs font-bold text-white transition active:scale-98 shadow-sm"
                >
                  <Navigation size={13} className="text-red-300" />
                  <span>Try Location Again</span>
                </button>
              )}
            </div>
          )}

          {/* Customer Destination Box */}
          <div className="mt-6 rounded-2xl bg-slate-950 p-4 border border-slate-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Customer Destination
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{customerAddress}</p>
              </div>

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customerAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-xl bg-primary/20 p-2 text-xs font-bold text-primary hover:bg-primary hover:text-white transition"
                title="Launch Google Maps Turn-by-Turn GPS Navigation"
              >
                <Navigation size={16} />
              </a>
            </div>
          </div>

          {/* GPS Telemetry Readout */}
          <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
              <span className="text-slate-400">Latitude:</span>
              <p className="font-mono font-bold text-white text-sm">
                {coords ? coords.latitude.toFixed(6) : "—"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
              <span className="text-slate-400">Longitude:</span>
              <p className="font-mono font-bold text-white text-sm">
                {coords ? coords.longitude.toFixed(6) : "—"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
              <span className="text-slate-400">Pings Sent:</span>
              <p className="font-mono font-bold text-primary text-sm">{pingCount} broadcasts</p>
            </div>

            <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
              <span className="text-slate-400">Last Beacon:</span>
              <p className="font-mono font-bold text-emerald-400 text-sm">
                {lastSentTime || "Not started"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 space-y-3">
            {/* Arrival Button (Only before arrival and while confirmed) */}
            {!hasArrived && bookingStatus === "confirmed" && (
              <button
                type="button"
                onClick={handleArrived}
                disabled={arriving || !canBroadcast || loadingInitial}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-sm font-extrabold text-white shadow-xl shadow-emerald-600/30 transition hover:bg-emerald-700 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MapPin size={18} />
                {arriving ? "Recording Arrival..." : "I Have Arrived On-Site"}
              </button>
            )}

            {/* GPS Broadcast Controls (Only before arrival) */}
            {!hasArrived && (
              <>
                {!isSharing ? (
                  <button
                    type="button"
                    onClick={handleStartRoute}
                    disabled={!canBroadcast || loadingInitial || startingTrip}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-white shadow-xl shadow-primary/30 transition hover:bg-primary-hover active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlayCircle size={18} />
                    {startingTrip
                      ? "Starting Route..."
                      : !tripStarted
                      ? "Start Route / On My Way →"
                      : "Resume Location Sharing"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopSharing}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-amber-600/30 transition hover:bg-amber-700 active:scale-98"
                  >
                    <PauseCircle size={18} />
                    Pause Location Sharing
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-xs text-slate-400 space-y-2">
          <p className="font-bold text-white">Technician Protocol:</p>
          <p>• Keep this browser tab active while en route so the customer receives live GPS updates.</p>
          <p>• When you reach the customer destination, tap <strong>&quot;I Have Arrived On-Site&quot;</strong>.</p>
          <p>• When tire service is complete, the admin will complete the service and generate the final quote.</p>
        </div>
      </div>
    </div>
  );
}

export default function TechnicianTrackingPage({ params }: TechnicianTrackingPageProps) {
  const resolvedParams = use(params);
  const bookingId = resolvedParams.bookingId;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading technician tracking console...</span>
          </div>
        </div>
      }
    >
      <TechnicianTrackingContent bookingId={bookingId} />
    </Suspense>
  );
}

