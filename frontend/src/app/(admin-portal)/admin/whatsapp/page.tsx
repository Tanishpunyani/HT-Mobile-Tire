"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Bot,
  User,
  ShieldCheck,
  Send,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Calendar,
  ExternalLink,
  Phone,
  CheckCircle2,
  Car,
  AlertTriangle,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Mic,
  FileText,
  Video as VideoIcon,
  Smile,
  MapPin,
  MousePointerClick,
  List,
} from "lucide-react";
import Container from "@/app/components/Container";
import {
  getWhatsAppConversationsAction,
  getWhatsAppConversationMessagesAction,
  sendAdminWhatsAppReplyAction,
  setConversationStatusAction,
  setConversationActiveBookingAction,
  type AdminConversationSummary,
  type AdminMessageItem,
  type AdminConversationStatus,
  type AdminAvailableBookingSummary,
} from "@/app/actions/whatsapp";

function renderMessageBody(msg: AdminMessageItem) {
  const isImage = msg.type === "image" || msg.body === "[Photo Attached]";
  const isAudio = msg.type === "audio" || msg.type === "voice" || msg.body === "[Voice Note Attached]";
  const isDocument = msg.type === "document" || (msg.body?.startsWith("[Document") ?? false);
  const isVideo = msg.type === "video" || msg.body === "[Video Attached]";
  const isSticker = msg.type === "sticker" || msg.body === "[Sticker Attached]";
  const isLocation = msg.type === "location" || msg.body === "[Location Shared]";

  if (isImage) {
    const isStandardLabel = msg.body === "[Photo Attached]" || !msg.body;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-medium">
          <ImageIcon className="w-4 h-4 shrink-0 opacity-80" />
          <span>Photo Attached</span>
        </div>
        {!isStandardLabel && <div className="text-xs mt-1 whitespace-pre-wrap">{msg.body}</div>}
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="flex items-center gap-1.5 font-medium">
        <Mic className="w-4 h-4 shrink-0 opacity-80" />
        <span>Voice Note Attached</span>
      </div>
    );
  }

  if (isDocument) {
    const docMatch = msg.body?.match(/\[Document:\s*([^\]]+)\]/i);
    const filename = docMatch ? docMatch[1].trim() : null;
    const isAttachedOnly = msg.body === "[Document Attached]" || !msg.body;

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-medium">
          <FileText className="w-4 h-4 shrink-0 opacity-80" />
          {filename ? (
            <span className="underline underline-offset-2">{filename}</span>
          ) : (
            <span>Document Attached</span>
          )}
        </div>
        {!filename && !isAttachedOnly && (
          <div className="text-xs mt-1 whitespace-pre-wrap">{msg.body}</div>
        )}
      </div>
    );
  }

  if (isVideo) {
    const isStandardLabel = msg.body === "[Video Attached]" || !msg.body;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-medium">
          <VideoIcon className="w-4 h-4 shrink-0 opacity-80" />
          <span>Video Attached</span>
        </div>
        {!isStandardLabel && <div className="text-xs mt-1 whitespace-pre-wrap">{msg.body}</div>}
      </div>
    );
  }

  if (isSticker) {
    return (
      <div className="flex items-center gap-1.5 font-medium">
        <Smile className="w-4 h-4 shrink-0 opacity-80" />
        <span>Sticker Attached</span>
      </div>
    );
  }

  if (isLocation) {
    return (
      <div className="flex items-center gap-1.5 font-medium">
        <MapPin className="w-4 h-4 shrink-0 opacity-80" />
        <span>Location Shared</span>
      </div>
    );
  }

  if (msg.type === "interactive") {
    const isList =
      msg.interactiveType === "list_reply" ||
      (typeof msg.body === "string" &&
        (msg.body.startsWith("booking_select:") || msg.body.startsWith("service_select:")));
    const displayTitle = msg.body || "Selection Made";

    if (isList) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold opacity-75 uppercase tracking-wider">
            <List className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>List Selection</span>
          </div>
          <div className="font-medium text-sm break-words">{displayTitle}</div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold opacity-75 uppercase tracking-wider">
          <MousePointerClick className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Button Selected</span>
        </div>
        <div className="font-medium text-sm break-words">{displayTitle}</div>
      </div>
    );
  }

  return msg.body || <span className="italic opacity-60">Empty message</span>;
}

export default function AdminWhatsAppPortalPage() {
  const [conversations, setConversations] = useState<AdminConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminMessageItem[]>([]);
  const [availableBookings, setAvailableBookings] = useState<AdminAvailableBookingSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminConversationStatus>("all");
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isLinkingBooking, setIsLinkingBooking] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  const loadConversations = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoadingConversations(true);
      try {
        const result = await getWhatsAppConversationsAction({
          search: searchQuery,
          status: statusFilter,
        });

        if (result.success && result.conversations) {
          setConversations(result.conversations);

          // If no conversation currently selected and we have items, select the first
          if (!selectedConversationId && result.conversations.length > 0) {
            setSelectedConversationId(result.conversations[0].id);
          }
        } else if (result.error && !isSilent) {
          setErrorNotice(result.error);
        }
      } catch (err: unknown) {
        if (!isSilent) {
          setErrorNotice((err as Error)?.message || "Failed to load conversations.");
        }
      } finally {
        if (!isSilent) setLoadingConversations(false);
      }
    },
    [searchQuery, statusFilter, selectedConversationId]
  );

  const loadMessages = useCallback(async (conversationId: string, isSilent = false) => {
    if (!isSilent) setLoadingMessages(true);
    try {
      const result = await getWhatsAppConversationMessagesAction(conversationId);
      if (result.success && result.messages) {
        if (result.availableBookings) {
          setAvailableBookings(result.availableBookings);
        }
        setMessages((prev) => {
          if (
            isSilent &&
            prev.length === result.messages!.length &&
            prev[prev.length - 1]?.id === result.messages![result.messages!.length - 1]?.id &&
            prev[prev.length - 1]?.deliveryStatus === result.messages![result.messages!.length - 1]?.deliveryStatus
          ) {
            return prev;
          }
          return result.messages!;
        });
      } else if (result.error && !isSilent) {
        setErrorNotice(result.error);
      }
    } catch (err: unknown) {
      if (!isSilent) {
        setErrorNotice((err as Error)?.message || "Failed to load messages.");
      }
    } finally {
      if (!isSilent) setLoadingMessages(false);
    }
  }, []);

  const handleLinkBooking = async (bookingId: string) => {
    if (!selectedConversationId) return;
    setIsLinkingBooking(true);
    try {
      const res = await setConversationActiveBookingAction({
        conversationId: selectedConversationId,
        bookingId,
      });
      if (res.success) {
        setSuccessNotice("Booking successfully associated with conversation.");
        await loadConversations(true);
        await loadMessages(selectedConversationId, true);
      } else {
        setErrorNotice(res.error || "Failed to associate booking.");
      }
    } catch (err: unknown) {
      setErrorNotice((err as Error)?.message || "Failed to associate booking.");
    } finally {
      setIsLinkingBooking(false);
    }
  };

  // Initial load and filter change
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when conversation selection changes
  useEffect(() => {
    if (selectedConversationId) {
      loadMessages(selectedConversationId);
    } else {
      setMessages([]);
      setAvailableBookings([]);
    }
  }, [selectedConversationId, loadMessages]);

  // Step 7: 10-Second Background Polling with Document Visibility Handling
  useEffect(() => {
    const POLLING_INTERVAL_MS = 10000;

    const interval = setInterval(() => {
      // Pause polling if tab is not visible
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      loadConversations(true);
      if (selectedConversationId && !isSending) {
        loadMessages(selectedConversationId, true);
      }
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadConversations, loadMessages, selectedConversationId, isSending]);

  // Immediately refresh when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadConversations(true);
        if (selectedConversationId && !isSending) {
          loadMessages(selectedConversationId, true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadConversations, loadMessages, selectedConversationId, isSending]);

  // Scroll to bottom when messages update (maintains scroll position if reading history)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      if (isNearBottom || !loadingMessages) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loadingMessages]);

  // Clear toast notifications after 4 seconds
  useEffect(() => {
    if (successNotice || errorNotice) {
      const timer = setTimeout(() => {
        setSuccessNotice(null);
        setErrorNotice(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successNotice, errorNotice]);

  const activeConversation = conversations.find((c) => c.id === selectedConversationId);

  // Check 24-hour service window
  const isOutside24HourWindow = Boolean(
    activeConversation &&
      Date.now() - new Date(activeConversation.lastMessageAt).getTime() > 24 * 60 * 60 * 1000
  );

  // Send admin reply handler
  async function handleSendReply(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedConversationId || !replyText.trim() || isSending) return;

    const textToSend = replyText.trim();
    setIsSending(true);
    setErrorNotice(null);

    try {
      const res = await sendAdminWhatsAppReplyAction(selectedConversationId, textToSend);

      if (res.success && res.message) {
        setReplyText("");
        setMessages((prev) => [...prev, res.message!]);

        // Update local conversation status & last message
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversationId
              ? {
                  ...c,
                  status: "human_handoff",
                  lastMessageAt: res.message!.createdAt,
                  lastMessage: {
                    body: res.message!.body,
                    direction: "outbound",
                    type: "text",
                    createdAt: res.message!.createdAt,
                  },
                }
              : c
          )
        );

        setSuccessNotice("Message sent via WhatsApp.");
        replyInputRef.current?.focus();
      } else {
        setErrorNotice(res.error || "Failed to send message.");
      }
    } catch (err: unknown) {
      setErrorNotice((err as Error)?.message || "Failed to dispatch message.");
    } finally {
      setIsSending(false);
    }
  }

  // Handle status toggle (Take Over / Return to Bot / Close)
  async function handleStatusChange(newStatus: AdminConversationStatus) {
    if (!selectedConversationId || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    setErrorNotice(null);

    try {
      const res = await setConversationStatusAction(selectedConversationId, newStatus);
      if (res.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversationId
              ? { ...c, status: newStatus, updatedAt: new Date().toISOString() }
              : c
          )
        );
        const labels: Record<AdminConversationStatus, string> = {
          human_handoff: "Conversation handed off to human agent. Bot paused.",
          bot_active: "Conversation returned to bot assistant.",
          closed: "Conversation marked as closed.",
        };
        setSuccessNotice(labels[newStatus]);
      } else {
        setErrorNotice(res.error || "Failed to update status.");
      }
    } catch (err: unknown) {
      setErrorNotice((err as Error)?.message || "Failed to update conversation status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  // Handle Ctrl+Enter or Cmd+Enter to send
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendReply();
    }
  }

  return (
    <div className="py-6">
      <Container>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">WhatsApp Live Chat</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Coexistence inbox: automated bot responses, customer inquiries, and staff takeover.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadConversations(false)}
              disabled={loadingConversations}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingConversations ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Notices */}
        {errorNotice && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorNotice}</span>
          </div>
        )}
        {successNotice && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Main Split-Pane Workspace */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:flex-row h-[720px]">
          {/* Left: Conversation Inbox Sidebar */}
          <div className="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col bg-slate-50">
            {/* Search and Filters */}
            <div className="p-3.5 border-b border-slate-200 bg-white space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search phone, name, #booking..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "human_handoff", label: "Needs Help" },
                    { id: "bot_active", label: "Bot" },
                    { id: "closed", label: "Closed" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition ${
                      statusFilter === tab.id
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loadingConversations ? (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-xs">Loading conversations...</p>
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium text-slate-600">No conversations found</p>
                  <p className="text-xs mt-1">Incoming WhatsApp messages will appear here.</p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isSelected = conv.id === selectedConversationId;
                  const isHandoff = conv.status === "human_handoff";
                  const isBot = conv.status === "bot_active";

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={`w-full text-left p-3.5 transition flex flex-col gap-1.5 ${
                        isSelected
                          ? "bg-emerald-50/70 border-l-4 border-l-emerald-600"
                          : "hover:bg-slate-100/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-slate-900 truncate">
                          {conv.customer?.name || conv.customerPhone}
                        </span>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(conv.lastMessageAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{conv.customerPhone}</span>
                      </div>

                      {conv.activeBooking && (
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-mono w-fit">
                          <span>#{conv.activeBooking.reference}</span>
                          <span className="text-slate-400">•</span>
                          <span className="truncate max-w-[120px]">
                            {conv.activeBooking.vehicle}
                          </span>
                        </div>
                      )}

                      {conv.lastMessage && (
                        <p className="text-xs text-slate-500 line-clamp-1 italic">
                          {conv.lastMessage.direction === "outbound" ? "You: " : ""}
                          {conv.lastMessage.body}
                        </p>
                      )}

                      {/* Status Badge & Unread Indicator */}
                      <div className="pt-1 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {isHandoff ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                              Needs Attention
                            </span>
                          ) : isBot ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
                              <Bot className="w-3 h-3 text-sky-600" />
                              Bot Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              <CheckCircle2 className="w-3 h-3 text-slate-400" />
                              Closed
                            </span>
                          )}
                        </div>

                        {/* Step 6: Unread Indicator */}
                        {conv.hasUnreadMessages && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                            New
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Selected Conversation View & Reply */}
          <div className="flex-1 flex flex-col bg-white">
            {activeConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">
                        {activeConversation.customer?.name || "Customer"}
                      </h2>
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {activeConversation.customerPhone}
                      </span>
                    </div>
                    {activeConversation.customer?.email && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {activeConversation.customer.email}
                      </p>
                    )}
                  </div>

                  {/* Actions / Status Controls */}
                  <div className="flex items-center gap-2">
                    {activeConversation.status !== "human_handoff" && (
                      <button
                        onClick={() => handleStatusChange("human_handoff")}
                        disabled={isUpdatingStatus}
                        className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-50 inline-flex items-center gap-1"
                        title="Take over conversation and pause bot replies"
                      >
                        <User className="w-3.5 h-3.5" />
                        Take Over
                      </button>
                    )}

                    {activeConversation.status !== "bot_active" && (
                      <button
                        onClick={() => handleStatusChange("bot_active")}
                        disabled={isUpdatingStatus}
                        className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-50 inline-flex items-center gap-1"
                        title="Return conversation to automated bot"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        Return to Bot
                      </button>
                    )}

                    {activeConversation.status !== "closed" && (
                      <button
                        onClick={() => handleStatusChange("closed")}
                        disabled={isUpdatingStatus}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition disabled:opacity-50 inline-flex items-center gap-1"
                        title="Close conversation until customer replies again"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Close
                      </button>
                    )}
                  </div>
                </div>

                {/* Active Booking Banner & Manual Association */}
                {activeConversation.activeBooking ? (
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <Car className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Active Booking:{" "}
                        <strong className="font-mono">
                          {activeConversation.activeBooking.reference}
                        </strong>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>{activeConversation.activeBooking.vehicle}</span>
                      <span className="text-slate-300">•</span>
                      <span className="capitalize font-medium">
                        {activeConversation.activeBooking.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {availableBookings.length > 1 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 text-[11px]">Switch:</span>
                          <select
                            value={activeConversation.activeBookingId || ""}
                            onChange={(e) => handleLinkBooking(e.target.value)}
                            disabled={isLinkingBooking}
                            className="text-xs bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 disabled:opacity-50"
                          >
                            {availableBookings.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.reference} — {b.vehicle} ({b.status})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <Link
                        href={
                          activeConversation.activeBookingId
                            ? `/admin/bookings/${activeConversation.activeBookingId}`
                            : "/admin/bookings"
                        }
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium"
                      >
                        View Booking
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ) : availableBookings.length > 0 ? (
                  <div className="bg-sky-50/70 border-b border-sky-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-900">
                    <div className="flex items-center gap-2">
                      <Car className="w-3.5 h-3.5 text-sky-600" />
                      <span className="font-medium">Associate Active Booking:</span>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) handleLinkBooking(e.target.value);
                        }}
                        disabled={isLinkingBooking}
                        className="text-xs bg-white border border-sky-300 rounded px-2 py-0.5 text-slate-800 disabled:opacity-50"
                      >
                        <option value="" disabled>
                          Select customer booking to associate...
                        </option>
                        {availableBookings.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.reference} — {b.vehicle} ({b.bookingDate} {b.bookingTime}) [{b.status}]
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="text-[11px] text-sky-700">
                      {availableBookings.length} customer booking{availableBookings.length > 1 ? "s" : ""} available
                    </span>
                  </div>
                ) : null}

                {/* 24-Hour Policy Window Notice */}
                {isOutside24HourWindow && (
                  <div className="bg-amber-50/80 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      Notice: It has been over 24 hours since the customer last messaged. Plain-text
                      replies may fail if the Meta 24-hour service window has elapsed.
                    </span>
                  </div>
                )}

                {/* Message Transcript */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50"
                >
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <MessageSquare className="w-8 h-8 opacity-40 mb-2" />
                      <p className="text-xs">No message history available.</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isCustomer = msg.senderRole === "customer";
                      const isBot = msg.senderRole === "bot";
                      const isAdmin = msg.senderRole === "admin";

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}
                        >
                          {/* Sender Identity Label */}
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1 px-1">
                            {isCustomer && (
                              <>
                                <User className="w-3 h-3" />
                                <span>{activeConversation.customer?.name || "Customer"}</span>
                              </>
                            )}
                            {isBot && (
                              <>
                                <Bot className="w-3 h-3 text-sky-600" />
                                <span className="text-sky-700 font-medium">Bot Assistant</span>
                              </>
                            )}
                            {isAdmin && (
                              <>
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700 font-medium">
                                  {msg.adminEmail ? `Staff (${msg.adminEmail})` : "Staff"}
                                </span>
                              </>
                            )}
                            <span>•</span>
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>

                            {/* Step 9: Delivery Status Indicator for Outbound messages */}
                            {!isCustomer && msg.deliveryStatus && (
                              <>
                                <span>•</span>
                                {msg.deliveryStatus === "READ" ? (
                                  <span
                                    className="inline-flex items-center gap-0.5 text-sky-600 font-medium"
                                    title="Read by recipient"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    Read
                                  </span>
                                ) : msg.deliveryStatus === "DELIVERED" ? (
                                  <span
                                    className="inline-flex items-center gap-0.5 text-emerald-600 font-medium"
                                    title="Delivered to handset"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    Delivered
                                  </span>
                                ) : msg.deliveryStatus === "SENT" ? (
                                  <span
                                    className="inline-flex items-center gap-0.5 text-slate-500 font-medium"
                                    title="Sent from server"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    Sent
                                  </span>
                                ) : msg.deliveryStatus === "FAILED" ? (
                                  <span
                                    className="inline-flex items-center gap-0.5 text-rose-600 font-medium"
                                    title="Delivery failed"
                                  >
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Failed
                                  </span>
                                ) : null}
                              </>
                            )}
                          </div>

                          {/* Message Bubble */}
                          <div
                            className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm whitespace-pre-wrap leading-relaxed ${
                              isCustomer
                                ? "bg-white text-slate-800 border border-slate-200 rounded-tl-sm"
                                : isBot
                                ? "bg-sky-600 text-white rounded-tr-sm"
                                : "bg-emerald-600 text-white rounded-tr-sm"
                            }`}
                          >
                            {renderMessageBody(msg)}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Outbound Reply Box */}
                <form
                  onSubmit={handleSendReply}
                  className="p-3 border-t border-slate-200 bg-white flex flex-col gap-2"
                >
                  <div className="relative">
                    <textarea
                      ref={replyInputRef}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a WhatsApp reply to customer... (Ctrl+Enter to send)"
                      rows={2}
                      maxLength={4096}
                      disabled={isSending}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none disabled:opacity-60"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {replyText.length} / 4096 • Press{" "}
                      <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
                        Ctrl+Enter
                      </kbd>{" "}
                      to send
                    </span>

                    <button
                      type="submit"
                      disabled={!replyText.trim() || isSending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Send via WhatsApp
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
                <div className="p-4 bg-slate-50 rounded-full mb-3 text-slate-300">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-slate-700">No conversation selected</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Choose a conversation from the inbox on the left to view customer message history,
                  bot interactions, and dispatch human replies.
                </p>
              </div>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
