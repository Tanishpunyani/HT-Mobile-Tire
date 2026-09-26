"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Mail,
  Phone,
  MessageSquare,
  X,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Flame,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

export type ContactMessage = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  service?: string | null;
  location?: string | null;
  emergency?: boolean;
  message: string | null;
  status: string;
  createdAt: string;
};

const DEFAULT_DISPATCH_TEMPLATE =
  "Our technician will be free soon, so we can assign a technician to you for your service. We will contact you shortly.";

export default function AdminContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Send Message Modal State
  const [activeMessage, setActiveMessage] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendEmailOption, setSendEmailOption] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, {
    isOpen: Boolean(activeMessage),
    onClose: () => {
      if (!isSending) {
        setActiveMessage(null);
      }
    },
  });

  const loadMessages = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) {
        setLoading(true);
      }
      setError("");

      const response = await fetch("/api/admin/contact-messages", {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load contact messages.");
      }

      setMessages(data.contactMessages || []);
    } catch (err: any) {
      console.error(err);
      if (!isSilent) {
        setError("Unable to load contact messages.");
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription for instant new contact inquiries
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-contact-messages-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_messages",
        },
        () => {
          loadMessages(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMessages]);

  function handleOpenReply(message: ContactMessage) {
    setActiveMessage(message);
    setReplyText(DEFAULT_DISPATCH_TEMPLATE);
    setSendEmailOption(Boolean(message.email));
    setModalError(null);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeMessage) return;

    const trimmed = replyText.trim();
    if (!trimmed) {
      setModalError("Please enter a message before sending.");
      return;
    }

    setIsSending(true);
    setModalError(null);

    try {
      const res = await fetch("/api/admin/contact-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: activeMessage.id,
          customerMessage: trimmed,
          sendEmailNotification: sendEmailOption,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send message.");
      }

      // Update local state without full reload
      setMessages((prev) =>
        prev.map((m) =>
          m.id === activeMessage.id ? { ...m, status: "contacted" } : m
        )
      );

      setActiveMessage(null);
      setToastMessage(`Message sent to ${activeMessage.name}!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setModalError(err?.message || "Unable to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatStatus(status: string) {
    return status.replace(/_/g, " ");
  }

  function getStatusStyle(status: string) {
    switch (status.toLowerCase()) {
      case "new":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "contacted":
        return "bg-green-100 text-green-800 border-green-200";
      case "waiting_for_technician":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "resolved":
      case "closed":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }

  return (
    <div className="min-h-screen bg-background-light py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-xs font-bold text-white shadow-lg animate-fade-in">
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
              <MessageSquare size={13} />
              Inquiry Dispatch Inbox
            </div>

            <h1 className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">
              Customer Contact Messages
            </h1>

            <p className="mt-2 text-sm text-text-secondary">
              Review customer service inquiries, view requested services, click-to-call, and dispatch updates.
            </p>
          </div>

          <Link
            href="/admin/dashboard"
            className="inline-flex w-fit items-center rounded-[10px] border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-gray-50 shadow-sm"
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
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
            <p className="mt-3 text-sm text-text-secondary">
              Loading contact inquiries...
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && messages.length === 0 && (
          <div className="mt-8 rounded-[16px] border border-border bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-primary">
              <Mail size={28} />
            </div>

            <h2 className="mt-4 text-xl font-bold text-foreground">
              No contact messages
            </h2>

            <p className="mt-2 text-sm text-text-secondary">
              Customer inquiries submitted through the contact form will appear here in real-time.
            </p>
          </div>
        )}

        {/* Messages List / Table */}
        {!loading && !error && messages.length > 0 && (
          <div className="mt-8">
            {/* Mobile Cards View (< md) */}
            <div className="md:hidden space-y-4">
              {messages.map((message) => (
                <div
                  key={`mobile-${message.id}`}
                  className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground text-base">
                          {message.name}
                        </span>
                        {message.emergency && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                            <Flame size={10} /> URGENT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(message.createdAt)}</p>
                    </div>

                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${getStatusStyle(
                        message.status
                      )}`}
                    >
                      {formatStatus(message.status)}
                    </span>
                  </div>

                  {/* Service Needed Badge */}
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-primary border border-red-200">
                      <Wrench size={13} />
                      {message.service || "General Inquiry"}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="flex flex-col gap-1 text-xs text-text-secondary">
                    {message.phone && (
                      <a
                        href={`tel:${message.phone}`}
                        aria-label={`Call ${message.name}`}
                        className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline"
                      >
                        <Phone size={13} />
                        {message.phone}
                      </a>
                    )}
                    {message.email && (
                      <a
                        href={`mailto:${message.email}`}
                        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-foreground"
                      >
                        <Mail size={13} />
                        {message.email}
                      </a>
                    )}
                  </div>

                  {/* Message Body */}
                  {message.message && (
                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200">
                      <p className="whitespace-pre-line leading-relaxed">{message.message}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    {message.phone && (
                      <a
                        href={`tel:${message.phone}`}
                        aria-label={`Call ${message.name}`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-slate-50 py-2 text-xs font-bold text-foreground hover:bg-slate-100 transition"
                      >
                        <Phone size={13} className="text-primary" />
                        Call
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenReply(message)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-hover transition"
                    >
                      <MessageSquare size={13} />
                      Send Message
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-hidden rounded-[16px] border border-border bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full text-left">
                  <thead className="border-b border-border bg-slate-50">
                    <tr>
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Customer
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Service Needed
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Contact Info
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Inquiry Message
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Received
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Status
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {messages.map((message) => (
                      <tr
                        key={message.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Customer */}
                        <td className="px-5 py-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground">
                              {message.name}
                            </span>
                            {message.emergency && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                                <Flame size={10} /> URGENT
                              </span>
                            )}
                          </div>
                          {message.location && (
                            <p className="text-xs text-text-secondary mt-0.5 truncate max-w-[180px]">
                              📍 {message.location}
                            </p>
                          )}
                        </td>

                        {/* Service Needed */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-primary border border-red-200">
                            <Wrench size={13} className="shrink-0" />
                            {message.service || "General Inquiry"}
                          </span>
                        </td>

                        {/* Contact Info (Click to Call) */}
                        <td className="px-5 py-4 text-xs">
                          {message.phone ? (
                            <a
                              href={`tel:${message.phone}`}
                              aria-label={`Call ${message.name}`}
                              className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline"
                            >
                              <Phone size={13} />
                              {message.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400">No Phone</span>
                          )}
                          {message.email && (
                            <p className="text-slate-500 mt-0.5 truncate max-w-[180px]">
                              {message.email}
                            </p>
                          )}
                        </td>

                        {/* Message */}
                        <td className="max-w-[280px] px-5 py-4 text-xs text-slate-700">
                          <p className="line-clamp-2">{message.message || "—"}</p>
                        </td>

                        {/* Date */}
                        <td className="whitespace-nowrap px-5 py-4 text-xs text-text-secondary">
                          {formatDate(message.createdAt)}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold capitalize ${getStatusStyle(
                              message.status
                            )}`}
                          >
                            {formatStatus(message.status)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            {message.phone && (
                              <a
                                href={`tel:${message.phone}`}
                                aria-label={`Call ${message.name}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-slate-50 hover:border-primary transition"
                              >
                                <Phone size={13} className="text-primary" />
                                Call
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenReply(message)}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-primary-hover transition"
                            >
                              <MessageSquare size={13} />
                              Message
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Send Message Dialog / Modal */}
        {activeMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="send-message-title"
              className="relative w-full max-w-lg rounded-[20px] bg-white p-6 shadow-2xl space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                    <MessageSquare size={12} />
                    Dispatch Customer Communication
                  </div>
                  <h3 id="send-message-title" className="mt-1 text-lg font-extrabold text-foreground">
                    Message {activeMessage.name}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveMessage(null)}
                  disabled={isSending}
                  aria-label="Close message dialog"
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-foreground transition disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Context Information */}
              <div className="rounded-xl bg-slate-50 p-3.5 text-xs border border-border space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Customer:</span>
                  <span className="font-bold text-foreground">{activeMessage.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Service Needed:</span>
                  <span className="font-bold text-primary">{activeMessage.service || "General Inquiry"}</span>
                </div>
                {activeMessage.phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Phone:</span>
                    <span className="font-semibold text-foreground">{activeMessage.phone}</span>
                  </div>
                )}
                {activeMessage.email && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Email:</span>
                    <span className="text-slate-600 truncate max-w-[240px]">{activeMessage.email}</span>
                  </div>
                )}
              </div>

              {/* Form */}
              <form onSubmit={handleSendMessage} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="customer-reply-message" className="text-xs font-bold text-foreground">
                      Customer-Facing Message
                    </label>
                    <button
                      type="button"
                      onClick={() => setReplyText(DEFAULT_DISPATCH_TEMPLATE)}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      Use Default Template
                    </button>
                  </div>

                  <textarea
                    id="customer-reply-message"
                    rows={4}
                    required
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type dispatch update to customer..."
                    className="w-full rounded-xl border border-border p-3 text-xs text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-slate-400"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 text-right">
                    {replyText.length} characters • Appears in Customer Account & Dispatch Log
                  </p>
                </div>

                {/* Delivery Options */}
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-bold text-foreground">Delivery Channels:</p>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled={true}
                        className="rounded text-primary accent-primary"
                      />
                      <span>Customer Account Portal (Instant)</span>
                    </label>

                    {activeMessage.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <input
                          type="checkbox"
                          checked={false}
                          disabled={true}
                          className="rounded text-muted-foreground accent-muted cursor-not-allowed"
                        />
                        <span>Direct Messaging ({activeMessage.phone}) — <span className="italic text-xs">Messaging integration coming next</span></span>
                      </div>
                    )}

                    {activeMessage.email && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendEmailOption}
                          onChange={(e) => setSendEmailOption(e.target.checked)}
                          className="rounded text-primary accent-primary"
                        />
                        <span>Send Email ({activeMessage.email})</span>
                      </label>
                    )}
                  </div>
                </div>

                {modalError && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveMessage(null)}
                    disabled={isSending}
                    className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-text-secondary hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSending || !replyText.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary-hover disabled:opacity-50"
                  >
                    {isSending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Sending Update...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Send Customer Message</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}