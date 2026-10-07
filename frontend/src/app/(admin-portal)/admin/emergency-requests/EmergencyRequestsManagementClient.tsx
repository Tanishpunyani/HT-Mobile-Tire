"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Phone,
  Navigation,
  MapPin,
  Car,
  X,
  ExternalLink,
} from "lucide-react";
import StaticMapPreview from "@/app/components/StaticMapPreview";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

export type EmergencyRequest = {
  id: string;
  currentLocation: string;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  problem: string;
  problemDetails: string | null;
  vehicle: string;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  } | null;
  service: {
    name: string;
  } | null;
};

interface EmergencyRequestsManagementClientProps {
  initialRequests?: EmergencyRequest[];
}

export default function EmergencyRequestsManagementClient({
  initialRequests,
}: EmergencyRequestsManagementClientProps) {
  const [requests, setRequests] = useState<EmergencyRequest[]>(initialRequests || []);
  const [loading, setLoading] = useState(initialRequests === undefined);
  const [error, setError] = useState("");
  const [selectedMapRequest, setSelectedMapRequest] = useState<EmergencyRequest | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, {
    isOpen: Boolean(selectedMapRequest),
    onClose: () => setSelectedMapRequest(null),
  });

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/emergency-requests", {
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load emergency requests.");
      }

      setRequests(data.emergencyRequests || []);
    } catch (error) {
      console.error(error);
      setError("Unable to load emergency requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialRequests) {
      loadRequests();
    }
  }, [initialRequests, loadRequests]);

  function formatDateTime(date: string) {
    return new Date(date).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen bg-background-light py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
              Live Roadside Feed
            </div>

            <h1 className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">
              🚨 Emergency Dispatch Requests
            </h1>

            <p className="mt-2 text-sm text-text-secondary">
              Real-time roadside emergencies with GPS coordinates and live turn-by-turn navigation.
            </p>
          </div>

          <Link
            href="/admin/dashboard"
            className="inline-flex w-fit items-center rounded-[10px] border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-gray-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-8 rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-8 rounded-[16px] border border-border bg-white p-10 text-center shadow-sm">
            <p className="text-text-secondary">Loading emergency requests...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && requests.length === 0 && (
          <div className="mt-8 rounded-[16px] border border-border bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
              <MapPin size={28} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">No active emergency requests</h2>
            <p className="mt-2 text-text-secondary">
              All roadside requests are cleared. New urgent requests will appear here immediately.
            </p>
          </div>
        )}

        {/* Emergency requests list / table */}
        {!loading && !error && requests.length > 0 && (
          <div className="mt-8">
            {/* Mobile Cards View (< md) */}
            <div className="md:hidden space-y-4">
              {requests.map((request) => {
                const navUrl =
                  request.latitude && request.longitude
                    ? `https://www.google.com/maps/dir/?api=1&destination=${request.latitude},${request.longitude}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        request.currentLocation
                      )}`;

                return (
                  <div
                    key={`mobile-${request.id}`}
                    className="rounded-2xl border-2 border-red-200 bg-white p-5 shadow-sm space-y-4"
                  >
                    {/* Header: Problem & Received Time */}
                    <div className="flex items-start justify-between gap-2 border-b border-red-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-block rounded-md bg-red-600 px-2.5 py-1 text-xs font-extrabold text-white shadow-sm">
                          🚨 {request.problem}
                        </span>
                      </div>
                      <span className="text-xs text-text-secondary font-medium">
                        {formatDateTime(request.createdAt)}
                      </span>
                    </div>

                    {/* Customer & Vehicle */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Customer</p>
                        <p className="font-bold text-foreground">{request.customer?.name || "Customer"}</p>
                        <a
                          href={`tel:${request.customer?.phone}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline mt-0.5"
                        >
                          <Phone size={12} />
                          {request.customer?.phone || "N/A"}
                        </a>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Vehicle</p>
                        <p className="font-semibold text-foreground">{request.vehicle}</p>
                      </div>
                    </div>

                    {/* Situation Details */}
                    {request.problemDetails && (
                      <div className="rounded-xl bg-red-50/60 border border-red-100 p-3 text-xs text-slate-700">
                        <span className="font-bold text-red-800">Situation: </span>
                        "{request.problemDetails}"
                      </div>
                    )}

                    {/* Location & GPS */}
                    <div className="text-sm">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Breakdown Location</p>
                      <p className="font-medium text-foreground text-xs mt-0.5 break-words">
                        {request.currentLocation}
                      </p>
                      {request.latitude && request.longitude ? (
                        <p className="mt-1 text-[11px] font-mono text-green-700 font-bold">
                          📍 GPS: {request.latitude.toFixed(4)}, {request.longitude.toFixed(4)}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-slate-400">Manual Address Entry</p>
                      )}
                    </div>

                    {/* Dispatch Actions */}
                    <div className="border-t border-red-100 pt-3 flex flex-col gap-2">
                      <a
                        href={navUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700"
                      >
                        <Navigation size={14} />
                        Dispatch Route →
                      </a>

                      <button
                        type="button"
                        onClick={() => setSelectedMapRequest(request)}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-border bg-white px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-slate-50 transition"
                      >
                        <MapPin size={14} className="text-primary" />
                        View Map Pin
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-hidden rounded-[16px] border border-red-200 bg-white shadow-md">
              <div className="overflow-x-auto">
                <table className="min-w-[1200px] w-full text-left">
                  <thead className="border-b border-red-200 bg-red-50/60">
                    <tr>
                      <th className="px-5 py-4 text-sm font-bold text-foreground">Customer</th>
                      <th className="px-5 py-4 text-sm font-bold text-foreground">Problem Issue</th>
                      <th className="px-5 py-4 text-sm font-bold text-foreground">Vehicle</th>
                      <th className="px-5 py-4 text-sm font-bold text-foreground">Breakdown Location & GPS</th>
                      <th className="px-5 py-4 text-sm font-bold text-foreground">Received</th>
                      <th className="px-5 py-4 text-sm font-bold text-foreground">Dispatch Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {requests.map((request) => {
                      const navUrl = request.latitude && request.longitude
                        ? `https://www.google.com/maps/dir/?api=1&destination=${request.latitude},${request.longitude}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.currentLocation)}`;

                      return (
                        <tr key={request.id} className="border-b border-border last:border-b-0 hover:bg-red-50/20">
                          {/* Customer */}
                          <td className="px-5 py-5 text-sm">
                            <p className="font-bold text-foreground">{request.customer?.name || "Customer"}</p>
                            <a
                              href={`tel:${request.customer?.phone}`}
                              className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline mt-0.5"
                            >
                              <Phone size={12} />
                              {request.customer?.phone || "N/A"}
                            </a>
                          </td>

                          {/* Problem */}
                          <td className="max-w-[220px] px-5 py-5 text-sm">
                            <span className="inline-block rounded-md bg-red-600 px-2 py-0.5 text-xs font-extrabold text-white">
                              {request.problem}
                            </span>
                            {request.problemDetails && (
                              <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                                "{request.problemDetails}"
                              </p>
                            )}
                          </td>

                          {/* Vehicle */}
                          <td className="px-5 py-5 text-sm font-semibold text-foreground">
                            {request.vehicle}
                          </td>

                          {/* Location & GPS */}
                          <td className="max-w-[280px] px-5 py-5 text-sm">
                            <p className="font-medium text-foreground">{request.currentLocation}</p>
                            {request.latitude && request.longitude ? (
                              <p className="mt-1 text-[11px] font-mono text-green-700 font-bold">
                                📍 GPS: {request.latitude.toFixed(4)}, {request.longitude.toFixed(4)}
                              </p>
                            ) : (
                              <p className="mt-1 text-[11px] text-slate-400">Manual Address Entry</p>
                            )}
                          </td>

                          {/* Received Time */}
                          <td className="whitespace-nowrap px-5 py-5 text-xs text-text-secondary font-medium">
                            {formatDateTime(request.createdAt)}
                          </td>

                          {/* Dispatch Actions */}
                          <td className="px-5 py-5">
                            <div className="flex flex-col gap-1.5">
                              <a
                                href={navUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700"
                              >
                                <Navigation size={13} />
                                Dispatch Route →
                              </a>

                              <button
                                type="button"
                                onClick={() => setSelectedMapRequest(request)}
                                className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-semibold text-text-secondary hover:bg-slate-50"
                              >
                                <MapPin size={12} className="text-primary" />
                                View Map Pin
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Map Modal */}
        {selectedMapRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="emergency-map-modal-title"
              className="relative w-full max-w-2xl rounded-[20px] bg-white p-6 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setSelectedMapRequest(null)}
                aria-label="Close dialog"
                className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-foreground z-10"
              >
                <X size={20} />
              </button>

              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                    {selectedMapRequest.problem}
                  </span>
                  <h3 id="emergency-map-modal-title" className="text-lg font-bold text-foreground">
                    {selectedMapRequest.vehicle} — {selectedMapRequest.customer?.name}
                  </h3>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  {selectedMapRequest.currentLocation}
                </p>
              </div>

              <StaticMapPreview
                latitude={selectedMapRequest.latitude}
                longitude={selectedMapRequest.longitude}
                address={selectedMapRequest.currentLocation}
                isEmergency={true}
                zoom={16}
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMapRequest(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
