"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  Search,
  Eye,
  X,
  Loader2,
  Send,
} from "lucide-react";
import { triggerNotificationRetryAction } from "@/app/actions/notifications";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { formatAdminDateTime, formatAdminTime } from "@/lib/utils/date-format";

export type NotificationLog = {
  id: string;
  bookingId?: string | null;
  emergencyRequestId?: string | null;
  channel?: string | null;
  type: string;
  recipient: string;
  content?: string | null;
  body?: string | null;
  subject?: string | null;
  status: string;
  deliveryStatus?: string | null;
  deliveredAt?: string | null;
  messageId?: string | null;
  errorMessage?: string | null;
  retryCount: number;
  createdAt: string;
};

interface NotificationsManagementClientProps {
  initialLogs?: NotificationLog[];
}

export default function NotificationsManagementClient({
  initialLogs,
}: NotificationsManagementClientProps) {
  const [logs, setLogs] = useState<NotificationLog[]>(initialLogs || []);
  const [loading, setLoading] = useState(initialLogs === undefined);
  const [filterChannel, setFilterChannel] = useState<"all" | "email" | "whatsapp" | "sms">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "delivered" | "sent" | "failed" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [retrying, setRetrying] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, {
    isOpen: Boolean(selectedLog),
    onClose: () => setSelectedLog(null),
  });

  async function loadLogs() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/notifications");
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialLogs) {
      loadLogs();
    }
  }, [initialLogs]);

  async function handleRetryBatch() {
    setRetrying(true);
    try {
      const res = await triggerNotificationRetryAction(20);
      if (res.success) {
        const count = (res.result as any)?.count ?? (res.result as any)?.total ?? 0;
        alert(`Retry complete: ${count} messages processed.`);
        loadLogs();
      } else {
        alert(res.error || "Retry failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Error triggering retry.");
    } finally {
      setRetrying(false);
    }
  }

  const filteredLogs = logs.filter((log) => {
    const channelMatch =
      filterChannel === "all" ||
      (log.channel && log.channel.toLowerCase() === filterChannel) ||
      (log.type && log.type.toLowerCase().includes(filterChannel));

    const isDelivered = log.deliveryStatus?.toUpperCase() === "DELIVERED";
    const isSent = !isDelivered && log.status?.toUpperCase() === "SENT";
    const isFailed = log.status?.toUpperCase() === "FAILED" || log.deliveryStatus?.toUpperCase() === "FAILED";
    const isPending = log.status?.toUpperCase() === "PENDING" || log.status?.toUpperCase() === "PROCESSING";

    let statusMatch = true;
    if (filterStatus === "delivered") statusMatch = isDelivered;
    else if (filterStatus === "sent") statusMatch = isSent;
    else if (filterStatus === "failed") statusMatch = isFailed;
    else if (filterStatus === "pending") statusMatch = isPending;

    const query = searchQuery.toLowerCase().trim();
    const searchMatch =
      !query ||
      log.recipient.toLowerCase().includes(query) ||
      (log.bookingId && log.bookingId.toLowerCase().includes(query)) ||
      (log.subject && log.subject.toLowerCase().includes(query));

    return channelMatch && statusMatch && searchMatch;
  });

  // Phase 6H (G-06): Accurate operational separation of handset delivery vs gateway dispatch
  const totalDelivered = logs.filter((l) => l.deliveryStatus?.toUpperCase() === "DELIVERED").length;
  const totalSent = logs.filter((l) => l.status?.toUpperCase() === "SENT" && l.deliveryStatus?.toUpperCase() !== "DELIVERED").length;
  const totalFailed = logs.filter((l) => l.status?.toUpperCase() === "FAILED" || l.deliveryStatus?.toUpperCase() === "FAILED").length;
  const totalPending = logs.filter((l) => l.status?.toUpperCase() === "PENDING" || l.status?.toUpperCase() === "PROCESSING").length;

  return (
    <div className="min-h-screen bg-background-light py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Bell size={14} />
              Notification & Email Delivery Console
            </div>

            <h1 className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">
              Notification Logs
            </h1>

            <p className="mt-2 text-sm text-text-secondary">
              Real-time audit log of all customer emails, messaging notifications, and roadside emergency broadcasts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={retrying}
              onClick={handleRetryBatch}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50"
            >
              <RotateCw size={14} className={retrying ? "animate-spin" : ""} />
              Retry Failed Queue
            </button>

            <Link
              href="/admin/dashboard"
              className="inline-flex items-center rounded-xl border border-border bg-white px-4 py-2.5 text-xs font-semibold text-foreground transition hover:bg-gray-50"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Stats Grid: Distinguish Handset Delivered from Gateway Dispatched */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Handset Delivered */}
          <div className="rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-text-secondary block">Handset Delivered</span>
                <span className="text-[10px] text-green-700 font-medium">Carrier receipt confirmed</span>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 text-green-700">
                <CheckCircle2 size={16} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-extrabold text-green-700">{totalDelivered}</p>
          </div>

          {/* 2. Dispatched / Sent */}
          <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-text-secondary block">Dispatched (Sent)</span>
                <span className="text-[10px] text-blue-700 font-medium">Accepted by Gateway / In-transit</span>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Send size={16} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-extrabold text-blue-700">{totalSent}</p>
          </div>

          {/* 3. Failures */}
          <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-text-secondary block">Delivery Failures</span>
                <span className="text-[10px] text-red-700 font-medium">Gateway / carrier rejected</span>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-700">
                <XCircle size={16} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-extrabold text-red-700">{totalFailed}</p>
          </div>

          {/* 4. Pending */}
          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-text-secondary block">Pending Dispatch</span>
                <span className="text-[10px] text-amber-700 font-medium">Queued for transmission</span>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Clock size={16} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-extrabold text-amber-700">{totalPending}</p>
          </div>
        </div>

        {/* Controls & Search */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Channel Filters */}
            <div className="flex rounded-xl border border-border bg-white p-1">
              {(["all", "email", "whatsapp", "sms"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setFilterChannel(ch)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition ${
                    filterChannel === ch
                      ? "bg-foreground text-white shadow-sm"
                      : "text-text-secondary hover:text-foreground"
                  }`}
                >
                  {ch === "sms" ? "LEGACY SMS" : ch}
                </button>
              ))}
            </div>

            {/* Status Filters */}
            <div className="flex rounded-xl border border-border bg-white p-1">
              {(["all", "delivered", "sent", "failed", "pending"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${
                    filterStatus === st
                      ? "bg-primary text-white shadow-sm"
                      : "text-text-secondary hover:text-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search recipient or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-white py-2 pl-9 pr-3 text-xs text-foreground outline-none focus:border-primary"
            />
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          </div>
        </div>

        {/* Table / List */}
        {loading ? (
          <div className="mt-8 rounded-2xl border border-border bg-white p-12 text-center shadow-sm">
            <Loader2 size={32} className="mx-auto animate-spin text-primary" />
            <p className="mt-3 text-xs font-semibold text-text-secondary">Loading delivery logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-white p-12 text-center shadow-sm">
            <Bell size={32} className="mx-auto text-slate-400" />
            <h3 className="mt-3 text-base font-bold text-foreground">No notification logs found</h3>
            <p className="mt-1 text-xs text-text-secondary">
              Logs will appear automatically whenever notifications or emails are dispatched.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-[20px] border border-border bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-slate-50 font-bold text-text-secondary uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Channel</th>
                  <th className="px-5 py-3.5">Recipient</th>
                  <th className="px-5 py-3.5">Type & Reference</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => {
                  const isWhatsApp = log.channel === "whatsapp" || log.type.toLowerCase().includes("whatsapp");
                  const isSms = !isWhatsApp && (log.channel === "sms" || log.type.includes("sms"));
                  const isDelivered = log.deliveryStatus?.toUpperCase() === "DELIVERED";
                  const isSent = !isDelivered && log.status?.toUpperCase() === "SENT";
                  const isFailed = log.status?.toUpperCase() === "FAILED" || log.deliveryStatus?.toUpperCase() === "FAILED";

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      {/* Date / Time */}
                      <td className="px-5 py-4 font-mono text-slate-600 whitespace-nowrap">
                        {formatAdminDateTime(log.createdAt)}
                      </td>

                      {/* Channel */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold ${
                            isWhatsApp
                              ? "bg-emerald-100 text-emerald-800"
                              : isSms
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {isWhatsApp ? <Send size={12} /> : isSms ? <Phone size={12} /> : <Mail size={12} />}
                          {isWhatsApp ? "WHATSAPP" : isSms ? "LEGACY SMS" : "EMAIL"}
                        </span>
                      </td>

                      {/* Recipient */}
                      <td className="px-5 py-4 font-semibold text-foreground max-w-[200px] truncate">
                        {log.recipient}
                      </td>

                      {/* Type & Entity */}
                      <td className="px-5 py-4 text-text-secondary">
                        <p className="font-bold text-foreground capitalize">
                          {log.type.replace(/_/g, " ")}
                        </p>
                        {log.bookingId && (
                          <span className="font-mono text-[10px] text-primary">
                            Booking #{log.bookingId.slice(0, 8)}
                          </span>
                        )}
                        {log.emergencyRequestId && (
                          <span className="font-mono text-[10px] text-red-600">
                            Emergency #{log.emergencyRequestId.slice(0, 8)}
                          </span>
                        )}
                      </td>

                      {/* Status: Phase 6H (G-06) Operational Truth */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {isDelivered ? (
                            <div>
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold bg-green-100 text-green-800 border border-green-200">
                                <CheckCircle2 size={11} /> Handset Delivered
                              </span>
                              {log.deliveredAt && (
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {formatAdminTime(log.deliveredAt)}
                                </p>
                              )}
                            </div>
                          ) : isSent ? (
                            <div>
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                <Send size={11} /> Dispatched (SMSC Sent)
                              </span>
                              <p className="text-[10px] text-slate-400">Awaiting carrier receipt</p>
                            </div>
                          ) : isFailed ? (
                            <div>
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                                <XCircle size={11} /> Failed
                              </span>
                              {log.errorMessage && (
                                <p className="text-[10px] text-red-600 max-w-[180px] truncate" title={log.errorMessage}>
                                  {log.errorMessage}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock size={11} /> Pending Dispatch
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Eye size={13} />
                          View Body
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Content Preview Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="notification-details-modal-title"
              className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[85vh] flex flex-col"
            >
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label="Close dialog"
                className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-foreground"
              >
                <X size={20} />
              </button>

              <div className="border-b border-border pb-4">
                <h3 id="notification-details-modal-title" className="text-lg font-bold text-foreground">
                  {selectedLog.subject || selectedLog.type.replace(/_/g, " ").toUpperCase()}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Recipient: <span className="font-mono font-bold text-foreground">{selectedLog.recipient}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    App Status: <strong className="font-bold uppercase text-slate-900">{selectedLog.status}</strong>
                  </span>
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                    selectedLog.deliveryStatus?.toUpperCase() === "DELIVERED"
                      ? "bg-green-100 text-green-800 font-bold"
                      : "bg-slate-100 text-slate-700"
                  }`}>
                    Carrier Delivery: <strong>{selectedLog.deliveryStatus?.toUpperCase() || "Awaiting Webhook"}</strong>
                  </span>
                  {selectedLog.deliveredAt && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                      Delivered: {formatAdminTime(selectedLog.deliveredAt)}
                    </span>
                  )}
                  {selectedLog.messageId && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-500">
                      MsgID: {selectedLog.messageId.slice(0, 12)}...
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto rounded-xl bg-slate-50 p-4 font-mono text-xs text-slate-800 border border-border whitespace-pre-wrap">
                {selectedLog.content || selectedLog.body || "No raw content recorded."}
              </div>

              <div className="mt-4 pt-3 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-primary"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
