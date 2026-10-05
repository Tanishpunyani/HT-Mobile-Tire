"use client";

import Link from "next/link";
import { Mail, CheckCircle2, ArrowRight } from "lucide-react";
import { ContactInquiry } from "../types";

interface ContactInquiriesSectionProps {
  contactInquiries: ContactInquiry[];
}

export default function ContactInquiriesSection({
  contactInquiries,
}: ContactInquiriesSectionProps) {
  return (
    <div className="rounded-[20px] border border-border bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Inquiries & Dispatch Communications</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Review your service inquiries and direct status updates from our 24/7 central dispatch team.
          </p>
        </div>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover self-start sm:self-auto"
        >
          <Mail size={14} />
          New Inquiry
        </Link>
      </div>

      {contactInquiries.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-background-light p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail size={26} />
          </div>
          <h3 className="mt-4 text-base font-bold text-foreground">No inquiries found</h3>
          <p className="mt-1 text-sm text-text-secondary">
            You have not submitted any general service inquiries through our contact desk.
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-hover"
          >
            Send Service Inquiry <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {contactInquiries.map((inquiry) => {
            const statusFormatted =
              inquiry.status === "contacted"
                ? "Contacted"
                : inquiry.status === "waiting_for_technician"
                  ? "Waiting for Technician"
                  : inquiry.status === "resolved"
                    ? "Resolved"
                    : inquiry.status === "closed"
                      ? "Closed"
                      : "New";

            const statusClass =
              inquiry.status === "contacted"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : inquiry.status === "waiting_for_technician"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : inquiry.status === "resolved"
                    ? "bg-slate-100 text-slate-700 border-slate-200"
                    : "bg-blue-50 text-blue-700 border-blue-200";

            return (
              <div
                key={inquiry.id}
                className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm transition hover:border-slate-300"
              >
                {/* Header: Service Badge + Status */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-lg bg-primary/10 px-3 py-1 text-xs font-bold text-primary border border-primary/20">
                      Service: {inquiry.service || "General Inquiry"}
                    </span>
                    {inquiry.emergency && (
                      <span className="inline-flex items-center rounded-lg bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 border border-red-200">
                        Urgent
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>
                      {statusFormatted}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(inquiry.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Customer Message Body */}
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Your Inquiry:
                  </p>
                  <div className="mt-1.5 rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/70">
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                      {inquiry.message}
                    </p>
                    {inquiry.location && (
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        📍 Location: {inquiry.location}
                      </p>
                    )}
                  </div>
                </div>

                {/* Dispatcher Communications / Admin Responses */}
                <div className="mt-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Dispatch Communications:
                  </p>

                  {inquiry.dispatcherResponses && inquiry.dispatcherResponses.length > 0 ? (
                    <div className="mt-2 space-y-3">
                      {inquiry.dispatcherResponses.map((resp) => (
                        <div
                          key={resp.id}
                          className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                                <CheckCircle2 size={13} />
                              </span>
                              <span className="text-xs font-bold text-emerald-950">
                                HT Mobile Tire Central Dispatch Update
                              </span>
                            </div>
                            <span className="text-[11px] text-emerald-700">
                              {new Date(resp.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="mt-3">
                            <p className="text-sm font-medium leading-relaxed text-slate-900 whitespace-pre-wrap break-words">
                              {resp.body}
                            </p>
                            <div className="mt-2.5 flex items-center gap-2 text-xs text-emerald-800/80">
                              <span>Service: <strong>{inquiry.service || "General Inquiry"}</strong></span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3.5 text-xs text-slate-600">
                      <p>
                        ⏳ Your inquiry has been received by our 24/7 central dispatch team. When a dispatcher sends a communication or technician update, it will appear here.
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
