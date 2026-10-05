"use client";

import {
  CheckCircle2,
  Clock3,
  Wrench,
  Sparkles,
  XCircle,
} from "lucide-react";

export interface BookingLifecycleData {
  id: string;
  status: string; // "pending" | "confirmed" | "in_progress" | "completed" | "cancelled"
  technicianId?: string | null;
  arrivedAt?: string | null;
  hasArrived?: boolean;
}

interface StepItem {
  id: number;
  label: string;
  shortLabel: string;
  icon: any;
  isDone: boolean;
  isActive: boolean;
}

export default function BookingLifecycleProgress({
  booking,
}: {
  booking: BookingLifecycleData;
}) {
  if (booking.status === "cancelled") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-900 shadow-sm flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
          <XCircle size={18} />
        </div>
        <div>
          <span className="font-extrabold text-sm block">Appointment Cancelled</span>
          <span className="text-red-700">This service request has been cancelled.</span>
        </div>
      </div>
    );
  }

  // 4-step customer lifecycle:
  // Step 0: pending -> "Booking Request Received"
  // Step 1: confirmed -> "Appointment Confirmed"
  // Step 2: in_progress -> "Service In Progress"
  // Step 3: completed -> "Service Completed"
  let activeStepIndex = 0;
  let statusSummaryHeadline = "Booking Request Received";
  let statusSummarySubtitle = "We have received your booking and are reviewing availability.";

  const hasArrived = Boolean(booking.arrivedAt || booking.hasArrived);

  if (booking.status === "pending") {
    activeStepIndex = 0;
    statusSummaryHeadline = "Booking Request Received";
    statusSummarySubtitle = "Our dispatch team is reviewing your schedule.";
  } else if (booking.status === "confirmed") {
    activeStepIndex = 1;
    if (hasArrived) {
      statusSummaryHeadline = "Technician On-Site";
      statusSummarySubtitle = "Our technician has arrived at your location.";
    } else {
      statusSummaryHeadline = "Appointment Confirmed";
      statusSummarySubtitle = "Your appointment is confirmed. Our mobile service unit is scheduled for your address.";
    }
  } else if (booking.status === "in_progress") {
    activeStepIndex = 2;
    statusSummaryHeadline = "Service In Progress";
    statusSummarySubtitle = "Tire mounting, balancing, or calibration service is underway at your vehicle.";
  } else if (booking.status === "completed") {
    activeStepIndex = 3;
    statusSummaryHeadline = "Service Completed";
    statusSummarySubtitle = "All tire work has been completed. Thank you for choosing HT Mobile Tire!";
  }

  const isConfirmedDone =
    booking.status === "confirmed" ||
    booking.status === "in_progress" ||
    booking.status === "completed";
  const isInProgressDone =
    booking.status === "in_progress" ||
    booking.status === "completed";
  const isCompletedDone = booking.status === "completed";

  const steps: StepItem[] = [
    {
      id: 1,
      label: "Booking Request Received",
      shortLabel: "Request Received",
      icon: Clock3,
      isDone: activeStepIndex > 0,
      isActive: activeStepIndex === 0,
    },
    {
      id: 2,
      label: booking.status === "confirmed" && hasArrived ? "Technician On-Site" : "Appointment Confirmed",
      shortLabel: booking.status === "confirmed" && hasArrived ? "On-Site" : "Confirmed",
      icon: CheckCircle2,
      isDone: isConfirmedDone && activeStepIndex > 1,
      isActive: activeStepIndex === 1,
    },
    {
      id: 3,
      label: "Service In Progress",
      shortLabel: "In Progress",
      icon: Wrench,
      isDone: isInProgressDone && activeStepIndex > 2,
      isActive: activeStepIndex === 2,
    },
    {
      id: 4,
      label: "Service Completed",
      shortLabel: "Completed",
      icon: Sparkles,
      isDone: isCompletedDone,
      isActive: activeStepIndex === 3,
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header status bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Current Service Status
          </span>
          <h3 className="text-base font-extrabold text-foreground tracking-tight">
            {statusSummaryHeadline}
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            {statusSummarySubtitle}
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-blue-50 border border-blue-200/80 px-3 py-1 text-xs font-bold text-primary">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
          </span>
          <span>Step {activeStepIndex + 1} of 4</span>
        </div>
      </div>

      {/* 4-Step Responsive Tracker */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {steps.map((step) => {
          const isDone = step.isDone;
          const isActive = step.isActive;
          const Icon = step.icon;

          let cardClass = "bg-slate-50 text-slate-400 border-slate-200/60";
          let badgeClass = "bg-slate-200 text-slate-500";

          if (isDone) {
            cardClass = "bg-emerald-50/70 text-emerald-950 border-emerald-200";
            badgeClass = "bg-emerald-600 text-white shadow-sm";
          } else if (isActive) {
            cardClass = "bg-blue-50/90 text-blue-950 border-blue-400 ring-2 ring-blue-500/20 shadow-sm";
            badgeClass = "bg-primary text-white shadow-md shadow-primary/30";
          }

          return (
            <div
              key={step.id}
              className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${cardClass}`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${badgeClass}`}
              >
                {isDone ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <Icon size={16} className={isActive ? "animate-pulse" : ""} />
                )}
              </div>

              <span className="mt-2 text-xs font-bold leading-tight">
                {step.label}
              </span>

              <span className="mt-1 text-[9px] uppercase font-bold tracking-wider opacity-75">
                {isDone ? "Completed" : isActive ? "Active" : `Step ${step.id}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
