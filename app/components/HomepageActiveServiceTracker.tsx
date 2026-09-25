"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Clock3,
  CheckCircle2,
  Wrench,
  Car,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { createClient } from "@/lib/supabase/client";

interface ActiveBookingSummary {
  id: string;
  status: string; // "pending" | "confirmed" | "in_progress"
  primaryService?: string | null;
  service?: { name: string } | null;
  vehicle: string;
  location: string;
  bookingDate?: string | Date;
  bookingTime?: string | Date;
  technicianId?: string | null;
  technician?: { id: string; name: string } | null;
  createdAt?: string | Date;
  bookedAt?: string;
  etaMinutes?: number | null;
  estimatedArrivalAt?: string | null;
  arrivalStatus?: string;
  arrivedAt?: string | null;
}

export default function HomepageActiveServiceTracker() {
  const { isCustomerUser } = useAuth();
  const [activeBooking, setActiveBooking] = useState<ActiveBookingSummary | null>(null);
  const [extraActiveCount, setExtraActiveCount] = useState<number>(0);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchActiveBooking = useCallback(async () => {
    if (!isMountedRef.current || !isCustomerUser) return;

    try {
      const res = await fetch("/api/bookings", { cache: "no-store" });
      if (!res.ok) {
        if (isMountedRef.current) {
          setActiveBooking(null);
          setExtraActiveCount(0);
        }
        return;
      }

      const data = await res.json();
      if (!isMountedRef.current) return;

      if (data.success && Array.isArray(data.bookings)) {
        // Resolve customerId for Realtime channel binding
        if (data.bookings.length > 0 && data.bookings[0].customerId) {
          setCustomerId(data.bookings[0].customerId);
        } else if (!customerId) {
          try {
            const profRes = await fetch("/api/customer/profile", { cache: "no-store" });
            if (profRes.ok) {
              const profData = await profRes.json();
              if (profData.success && profData.customer?.id && isMountedRef.current) {
                setCustomerId(profData.customer.id);
              }
            }
          } catch {
            // Non-fatal
          }
        }

        // Find all active bookings (in_progress, confirmed, or pending)
        const activeList = data.bookings.filter(
          (b: { status?: string }) =>
            b.status === "in_progress" || b.status === "confirmed" || b.status === "pending"
        );

        if (activeList.length === 0) {
          setActiveBooking(null);
          setExtraActiveCount(0);
          return;
        }

        // Prioritize in_progress first, then confirmed, then pending
        const sortedActive = [...activeList].sort((a: any, b: any) => {
          const priority: Record<string, number> = { in_progress: 3, confirmed: 2, pending: 1 };
          return (priority[b.status] || 0) - (priority[a.status] || 0);
        });

        const primary = sortedActive[0];

        if (isMountedRef.current) {
          setActiveBooking({
            id: primary.id,
            status: primary.status,
            primaryService: primary.primaryService,
            service: primary.service,
            vehicle: primary.vehicle,
            location: primary.formattedAddress || primary.location,
            bookingDate: primary.bookingDate,
            bookingTime: primary.bookingTime,
            technicianId: primary.technicianId,
            technician: primary.technician,
            createdAt: primary.createdAt,
            bookedAt: primary.bookedAt,
            etaMinutes: primary.etaMinutes,
            estimatedArrivalAt: primary.estimatedArrivalAt,
            arrivalStatus: primary.arrivalStatus,
            arrivedAt: primary.arrivedAt,
          });
          setExtraActiveCount(Math.max(0, activeList.length - 1));
        }
      } else {
        if (isMountedRef.current) {
          setActiveBooking(null);
          setExtraActiveCount(0);
        }
      }
    } catch (err) {
      console.debug("[HomepageActiveServiceTracker] Fetch error:", err);
      if (isMountedRef.current) {
        setActiveBooking(null);
        setExtraActiveCount(0);
      }
    }
  }, [customerId, isCustomerUser]);

  // Initial authentication & data load
  useEffect(() => {
    isMountedRef.current = true;
    if (isCustomerUser) {
      void fetchActiveBooking();
    } else {
      setActiveBooking(null);
      setExtraActiveCount(0);
      setCustomerId(null);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [isCustomerUser, fetchActiveBooking]);

  // Realtime Booking Status Synchronization: subscribe to UPDATE events on bookings table
  useEffect(() => {
    if (!isCustomerUser || !customerId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`homepage-active-tracker-${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          // Silently refresh authoritative active booking without full-page reloads
          void fetchActiveBooking();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.debug("[HomepageActiveServiceTracker Realtime] Channel status:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isCustomerUser, customerId, fetchActiveBooking]);

  // Window Focus Recovery: refresh status when customer returns to tab
  useEffect(() => {
    function handleWindowFocus() {
      if (isCustomerUser) {
        fetchActiveBooking();
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isCustomerUser, fetchActiveBooking]);

  // Guard: Hide if unauthenticated, not customer, or no active booking
  if (!isCustomerUser || !activeBooking) {
    return null;
  }

  // Determine status visual attributes based on booking state
  const serviceName =
    activeBooking.primaryService || activeBooking.service?.name || "Mobile Tire Service";

  let statusHeadline = "Booking Request Received";
  let statusSubtext = "Our dispatch team is reviewing your service request.";
  let badgeLabel = "Request Received";
  let badgeStyle = "bg-amber-900/60 text-amber-300 border-amber-700/50";
  let iconNode = <Clock3 size={18} className="text-amber-400 shrink-0" />;

  if (activeBooking.status === "in_progress") {
    statusHeadline = "Service In Progress";
    statusSubtext = "Our technician is currently working on your vehicle.";
    badgeLabel = "In Progress";
    badgeStyle = "bg-purple-900/60 text-purple-300 border-purple-700/50";
    iconNode = <Wrench size={18} className="text-purple-400 shrink-0 animate-pulse" />;
  } else if (activeBooking.status === "confirmed") {
    const isArrived = Boolean(
      activeBooking.arrivedAt || activeBooking.arrivalStatus === "arrived"
    );
    const hasDynamicEta =
      activeBooking.arrivalStatus === "estimated" && Boolean(activeBooking.estimatedArrivalAt);
    const hasTechnician = Boolean(activeBooking.technicianId || activeBooking.technician);

    if (isArrived) {
      statusHeadline = "Technician Has Arrived";
      statusSubtext = activeBooking.technician?.name
        ? `${activeBooking.technician.name} is on-site with your mobile unit.`
        : "Our technician has arrived on-site.";
      badgeLabel = "Arrived";
      badgeStyle = "bg-emerald-900/60 text-emerald-300 border-emerald-700/50";
      iconNode = <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />;
    } else if (hasDynamicEta && activeBooking.estimatedArrivalAt) {
      const formattedEta = new Date(activeBooking.estimatedArrivalAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      statusHeadline = `Expected ~${formattedEta} (${activeBooking.etaMinutes}m)`;
      statusSubtext = activeBooking.technician?.name
        ? `${activeBooking.technician.name} is en route to your location.`
        : "Mobile service unit is en route to your location.";
      badgeLabel = "En Route";
      badgeStyle = "bg-blue-900/60 text-blue-300 border-blue-700/50";
      iconNode = <Car size={18} className="text-blue-400 shrink-0" />;
    } else if (hasTechnician) {
      statusHeadline = "Technician Assigned";
      statusSubtext = activeBooking.technician?.name
        ? `${activeBooking.technician.name} is preparing your equipment.`
        : "Your service request has been scheduled and assigned.";
      badgeLabel = "Assigned";
      badgeStyle = "bg-emerald-900/60 text-emerald-300 border-emerald-700/50";
      iconNode = <Car size={18} className="text-emerald-400 shrink-0" />;
    } else {
      statusHeadline = "Appointment Confirmed";
      statusSubtext = "We're processing your service request.";
      badgeLabel = "Confirmed";
      badgeStyle = "bg-blue-900/60 text-blue-300 border-blue-700/50";
      iconNode = <CheckCircle2 size={18} className="text-blue-400 shrink-0" />;
    }
  }

  return (
    <aside
      aria-label="Active Service Status"
      className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:right-6 sm:left-auto z-40 w-auto sm:max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="rounded-2xl border border-blue-500/30 bg-slate-950/95 p-3.5 sm:p-4 text-white shadow-2xl backdrop-blur-md transition-all hover:border-blue-500/50">
        <div className="flex items-center justify-between gap-3">
          {/* Status Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 shadow-inner">
            {iconNode}
          </div>

          {/* Service & Status Text */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="text-xs font-extrabold tracking-tight text-white truncate max-w-[170px] sm:max-w-[220px]"
                title={statusHeadline}
              >
                {serviceName}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${badgeStyle}`}
                title={statusHeadline}
              >
                {badgeLabel}
              </span>
            </div>

            <p
              aria-live="polite"
              className="mt-0.5 truncate text-[11px] text-slate-300 font-medium"
            >
              {statusSubtext}
            </p>

            {activeBooking.vehicle && (
              <p className="truncate text-[10px] text-slate-400">
                {activeBooking.vehicle}
                {extraActiveCount > 0 && (
                  <span className="ml-1.5 text-primary font-bold">
                    (+{extraActiveCount} more)
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Quick CTA Action */}
          <div className="shrink-0">
            <Link
              href={`/account/bookings/${activeBooking.id}`}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-primary/30 transition hover:bg-primary-hover active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label="View Booking Details & Live Status"
            >
              <span className="hidden xs:inline sm:inline">View</span>
              <span>Booking</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
