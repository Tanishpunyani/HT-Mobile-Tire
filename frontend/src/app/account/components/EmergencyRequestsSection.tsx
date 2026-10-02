"use client";

import Link from "next/link";
import { Siren, ShieldCheck } from "lucide-react";
import { EmergencyRequest } from "../types";

interface EmergencyRequestsSectionProps {
  emergencyRequests: EmergencyRequest[];
}

export default function EmergencyRequestsSection({
  emergencyRequests,
}: EmergencyRequestsSectionProps) {
  return (
    <div className="rounded-[20px] border border-border bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Emergency Assistance History</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Review your urgent roadside dispatch requests.
          </p>
        </div>
        <Link
          href="/emergency"
          className="inline-flex items-center gap-2 rounded-[10px] bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
        >
          <Siren size={14} />
          New Request
        </Link>
      </div>

      {emergencyRequests.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-background-light p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <ShieldCheck size={28} />
          </div>
          <h3 className="mt-4 text-base font-bold text-foreground">No emergency requests</h3>
          <p className="mt-1 text-sm text-text-secondary">
            You have not submitted any emergency tire requests.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {emergencyRequests.map((req) => {
            const statusPresentation =
              req.status === "pending"
                ? "Pending Dispatch"
                : req.status === "contacted"
                  ? "Contacted"
                  : req.status === "assigned"
                    ? "Technician Assigned"
                    : req.status === "in_progress"
                      ? "Service In Progress"
                      : req.status === "completed"
                        ? "Completed"
                        : req.status === "cancelled"
                          ? "Cancelled"
                          : req.status.replace(/_/g, " ");

            const statusBadgeClass =
              req.status === "completed"
                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                : req.status === "in_progress" || req.status === "assigned"
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : req.status === "contacted"
                    ? "bg-purple-100 text-purple-800 border-purple-200"
                    : req.status === "cancelled"
                      ? "bg-slate-100 text-slate-700 border-slate-200"
                      : "bg-amber-100 text-amber-800 border-amber-200";

            return (
              <div
                key={req.id}
                className="rounded-[18px] border border-red-100 bg-red-50/30 p-5 sm:p-6 transition hover:border-red-200 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-red-100 pb-3.5">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                        🚨 {req.problem}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusBadgeClass}`}>
                        {statusPresentation}
                      </span>
                      {req.service?.name && (
                        <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 border border-border">
                          {req.service.name}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 text-base font-bold text-foreground">
                      🚗 {req.vehicle}
                    </h3>
                  </div>

                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {new Date(req.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Location and Situation */}
                <div className="mt-3.5 space-y-1.5 text-sm">
                  <p className="text-text-secondary">
                    <span className="font-semibold text-foreground">📍 Breakdown Location:</span>{" "}
                    {req.formattedAddress || req.currentLocation}
                  </p>

                  {req.problemDetails && (
                    <p className="text-xs text-text-secondary">
                      <span className="font-semibold text-foreground">Details:</span> {req.problemDetails}
                    </p>
                  )}
                </div>

                {/* Roadside Dispatch Communications */}
                <div className="mt-4 border-t border-red-100/80 pt-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Roadside Dispatch Communications:
                  </p>

                  {req.dispatcherUpdates && req.dispatcherUpdates.length > 0 ? (
                    <div className="mt-2 space-y-2.5">
                      {req.dispatcherUpdates.map((update) => (
                        <div
                          key={update.id}
                          className="rounded-xl border border-red-200 bg-white/95 p-3.5 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-50 pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white">
                                <Siren size={11} />
                              </span>
                              <span className="text-xs font-bold text-red-950">
                                Central Roadside Dispatch
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {new Date(update.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                            {update.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-xl border border-dashed border-red-200/80 bg-white/60 p-3 text-xs text-slate-600">
                      <p>
                        🚨 Central dispatch has prioritized your roadside request. When a mobile unit is allocated or status changes, live communications will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
