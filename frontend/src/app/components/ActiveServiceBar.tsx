"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  Wrench,
  ArrowRight,
} from "lucide-react";
import Container from "./Container";
import { useAuth } from "@/lib/auth/auth-context";
import { createClient } from "@/lib/supabase/client";

interface ActiveBooking {
  id: string;
  status: string; // "confirmed" | "in_progress"
  primaryService?: string | null;
  service?: { name: string } | null;
  vehicle: string;
  location: string;
}

const IGNORED_PREFIXES = [
  "/admin",
  "/technician",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/account/bookings",
];

export default function ActiveServiceBar() {
  const pathname = usePathname();
  const { isCustomerUser, user } = useAuth();
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Check if current route should suppress the Active Service bar (suppressed on homepage, auth, admin, technician routes)
  const isHiddenRoute =
    pathname === "/" ||
    IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const fetchActiveBooking = useCallback(async () => {
    if (!isMountedRef.current || isHiddenRoute || !isCustomerUser) return;

    try {
      const res = await fetch("/api/bookings", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) {
        if (isMountedRef.current) setActiveBooking(null);
        return;
      }

      const data = await res.json();
      if (!isMountedRef.current) return;

      if (data.success && Array.isArray(data.bookings)) {
        if (data.bookings.length > 0 && data.bookings[0].customerId) {
          setCustomerId(data.bookings[0].customerId);
        } else if (!customerId) {
          try {
            const profRes = await fetch("/api/customer/profile", {
              cache: "no-store",
              credentials: "same-origin",
            });
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

        // Find the first active booking (in_progress or confirmed)
        const active = data.bookings.find(
          (b: { status?: string }) => b.status === "in_progress" || b.status === "confirmed"
        );

        if (!active) {
          setActiveBooking(null);
          return;
        }

        const summary: ActiveBooking = {
          id: active.id,
          status: active.status,
          primaryService: active.primaryService,
          service: active.service,
          vehicle: active.vehicle,
          location: active.location,
        };

        if (isMountedRef.current) {
          setActiveBooking(summary);
        }
      } else {
        if (isMountedRef.current) setActiveBooking(null);
      }
    } catch (err) {
      console.debug("[ActiveServiceBar] Fetch error:", err);
      if (isMountedRef.current) setActiveBooking(null);
    }
  }, [customerId, isCustomerUser, isHiddenRoute]);

  useEffect(() => {
    isMountedRef.current = true;
    if (isCustomerUser && !isHiddenRoute) {
      void fetchActiveBooking();
    } else {
      setActiveBooking(null);
      setCustomerId(null);
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [isCustomerUser, isHiddenRoute, fetchActiveBooking]);

  // Realtime Booking Status Synchronization: subscribe to UPDATE events on bookings table
  useEffect(() => {
    if (!isCustomerUser || !customerId || isHiddenRoute) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`active-service-bar-${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          // Silently refresh authoritative active booking status
          void fetchActiveBooking();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.debug("[ActiveServiceBar Realtime] Channel status:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isCustomerUser, customerId, isHiddenRoute, fetchActiveBooking]);

  // Refresh active booking state when navigating across customer pages
  useEffect(() => {
    if (isCustomerUser && !isHiddenRoute) {
      const timer = setTimeout(() => {
        void fetchActiveBooking();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [pathname, isCustomerUser, isHiddenRoute, fetchActiveBooking]);

  // Window Focus Resynchronization: refresh active service when customer returns to tab
  useEffect(() => {
    function handleWindowFocus() {
      if (isCustomerUser && !isHiddenRoute) {
        fetchActiveBooking();
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isCustomerUser, isHiddenRoute, fetchActiveBooking]);

  // Render guard: Suppress on ignored routes, unauthenticated users, or when no active booking
  if (isHiddenRoute || !isCustomerUser || !activeBooking) {
    return null;
  }

  // Determine specific display mode based on active booking state
  const isServiceInProgress = activeBooking.status === "in_progress";

  let iconNode = <CheckCircle2 size={16} className="text-blue-400 shrink-0" />;
  let headline = "Booking Confirmed";
  let subtext = "Your mobile tire service is scheduled";
  let badgeText = "Booking Confirmed";
  let badgeColor = "bg-blue-900/60 text-blue-300 border-blue-700/50";
  const ctaText = "View Booking";

  if (isServiceInProgress) {
    iconNode = <Wrench size={16} className="text-purple-400 shrink-0 animate-pulse" />;
    headline = "Service in Progress";
    subtext = "Our technician is currently working on your vehicle";
    badgeText = "Service in Progress";
    badgeColor = "bg-purple-900/60 text-purple-300 border-purple-700/50";
  }

  return (
    <aside
      aria-label="Active Tire Service Status"
      className="relative z-40 border-b border-blue-500/20 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white shadow-md"
    >
      <Container>
        <div className="flex flex-col gap-2.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:py-2">
          {/* Status Left */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 shadow-inner">
              {iconNode}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold tracking-tight text-white sm:text-sm">
                  {headline}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}
                >
                  {badgeText}
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-300 sm:text-xs">
                {subtext}
                {activeBooking.vehicle && (
                  <span className="hidden md:inline text-slate-400">
                    {" "}
                    • {activeBooking.vehicle}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action Right */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            <Link
              href={`/account/bookings/${activeBooking.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-primary/30 transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <span>{ctaText}</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </Container>
    </aside>
  );
}
