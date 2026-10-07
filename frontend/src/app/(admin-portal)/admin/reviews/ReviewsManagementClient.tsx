"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Star,
  CheckCircle2,
  XCircle,
  Trash2,
  Sparkles,
  MessageSquare,
  Loader2,
} from "lucide-react";
import {
  approveReviewAction,
  rejectReviewAction,
  deleteReviewAction,
} from "@/app/actions/reviews";

export type AdminReview = {
  id: string;
  rating: number;
  review: string;
  comment?: string | null;
  isApproved: boolean;
  rejectedAt?: string | null;
  adminNotes?: string | null;
  createdAt: string;
  customer?: {
    name: string;
    phone: string;
    email?: string | null;
  } | null;
  booking?: {
    vehicle: string;
    location: string;
    service?: {
      name: string;
    } | null;
  } | null;
};

interface ReviewsManagementClientProps {
  initialReviews?: AdminReview[];
}

export default function ReviewsManagementClient({
  initialReviews,
}: ReviewsManagementClientProps) {
  const [reviews, setReviews] = useState<AdminReview[]>(initialReviews || []);
  const [loading, setLoading] = useState(initialReviews === undefined);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/reviews");
      const data = await res.json();
      if (res.ok && data.success) {
        setReviews(data.reviews || []);
      }
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialReviews) {
      loadReviews();
    }
  }, [initialReviews, loadReviews]);

  async function handleApprove(id: string) {
    setActionLoadingId(id);
    try {
      const res = await approveReviewAction(id);
      if (res.success) {
        setReviews((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isApproved: true, rejectedAt: null } : r))
        );
      } else {
        alert(res.error || "Failed to approve review.");
      }
    } catch (err) {
      console.error(err);
      alert("Error approving review.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReject(id: string) {
    const notes = prompt("Enter optional moderation reason for rejection (e.g. Inappropriate language, spam):", "Does not meet review guidelines");
    if (notes === null) return; // user cancelled prompt

    setActionLoadingId(id);
    try {
      const res = await rejectReviewAction(id, notes);
      if (res.success) {
        setReviews((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isApproved: false, rejectedAt: new Date().toISOString(), adminNotes: notes } : r))
        );
      } else {
        alert(res.error || "Failed to reject review.");
      }
    } catch (err) {
      console.error(err);
      alert("Error rejecting review.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to permanently delete this review?")) return;

    setActionLoadingId(id);
    try {
      const res = await deleteReviewAction(id);
      if (res.success) {
        setReviews((prev) => prev.filter((r) => r.id !== id));
      } else {
        alert(res.error || "Failed to delete review.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting review.");
    } finally {
      setActionLoadingId(null);
    }
  }

  const filteredReviews = reviews.filter((r) => {
    if (filter === "pending") return !r.isApproved && !r.rejectedAt;
    if (filter === "approved") return r.isApproved;
    if (filter === "rejected") return !!r.rejectedAt;
    return true;
  });

  const pendingCount = reviews.filter((r) => !r.isApproved && !r.rejectedAt).length;
  const approvedCount = reviews.filter((r) => r.isApproved).length;

  return (
    <div className="min-h-screen bg-background-light py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              <Sparkles size={14} />
              Review Moderation Portal
            </div>

            <h1 className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">
              Customer Reviews & Moderation
            </h1>

            <p className="mt-2 text-sm text-text-secondary">
              Review, approve, and manage customer feedback for public display on the website.
            </p>
          </div>

          <Link
            href="/admin/dashboard"
            className="inline-flex w-fit items-center rounded-[10px] border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-gray-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                filter === "all"
                  ? "bg-foreground text-white shadow-sm"
                  : "bg-white text-text-secondary border border-border hover:bg-slate-50"
              }`}
            >
              All Reviews ({reviews.length})
            </button>

            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                filter === "pending"
                  ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20"
                  : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
              }`}
            >
              Pending Approval
              {pendingCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-900 text-[10px] text-white">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFilter("approved")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                filter === "approved"
                  ? "bg-green-600 text-white shadow-sm shadow-green-600/20"
                  : "bg-white text-green-700 border border-green-200 hover:bg-green-50"
              }`}
            >
              Approved & Live ({approvedCount})
            </button>

            <button
              type="button"
              onClick={() => setFilter("rejected")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                filter === "rejected"
                  ? "bg-red-600 text-white shadow-sm shadow-red-600/20"
                  : "bg-white text-red-700 border border-red-200 hover:bg-red-50"
              }`}
            >
              Rejected
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mt-8 rounded-[16px] border border-border bg-white p-12 text-center shadow-sm">
            <Loader2 size={32} className="mx-auto animate-spin text-primary" />
            <p className="mt-3 text-xs font-semibold text-text-secondary">Loading reviews...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredReviews.length === 0 && (
          <div className="mt-8 rounded-[16px] border border-border bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <MessageSquare size={24} />
            </div>
            <h3 className="mt-3 text-lg font-bold text-foreground">No reviews found</h3>
            <p className="mt-1 text-xs text-text-secondary">
              There are no reviews matching the current filter.
            </p>
          </div>
        )}

        {/* Reviews List */}
        {!loading && filteredReviews.length > 0 && (
          <div className="mt-6 grid gap-4">
            {filteredReviews.map((review) => {
              const isPending = !review.isApproved && !review.rejectedAt;
              const isApproved = review.isApproved;
              const isRejected = !!review.rejectedAt;

              return (
                <div
                  key={review.id}
                  className={`rounded-[20px] border p-6 shadow-sm transition ${
                    isPending
                      ? "border-amber-300 bg-amber-50/30"
                      : isApproved
                        ? "border-border bg-white"
                        : "border-red-200 bg-red-50/20"
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    {/* Customer & Rating Info */}
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={16}
                              className={
                                s <= review.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-200"
                              }
                            />
                          ))}
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                            isApproved
                              ? "bg-green-100 text-green-800 border border-green-200"
                              : isPending
                                ? "bg-amber-100 text-amber-900 border border-amber-200"
                                : "bg-red-100 text-red-800 border border-red-200"
                          }`}
                        >
                          {isApproved
                            ? "✓ Live on Website"
                            : isPending
                              ? "⏳ Pending Moderation"
                              : "✕ Rejected"}
                        </span>

                        <span className="text-xs text-text-secondary">
                          {new Date(review.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-foreground">
                        {review.customer?.name || "Customer"}
                        {review.customer?.phone && (
                          <span className="text-xs font-normal text-slate-400 ml-2">
                            ({review.customer.phone})
                          </span>
                        )}
                      </h4>

                      <p className="text-sm leading-relaxed text-foreground bg-white/80 p-3.5 rounded-xl border border-border italic">
                        "{review.comment || review.review}"
                      </p>

                      {/* Associated Booking Info */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary pt-1">
                        <span className="font-semibold text-primary">
                          Service: {review.booking?.service?.name || "Tire Service"}
                        </span>
                        <span>Vehicle: {review.booking?.vehicle || "Vehicle"}</span>
                        {review.adminNotes && (
                          <span className="text-red-600 font-semibold">
                            Note: {review.adminNotes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Moderation Actions */}
                    <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
                      {!isApproved && (
                        <button
                          type="button"
                          disabled={actionLoadingId === review.id}
                          onClick={() => handleApprove(review.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          Approve & Publish
                        </button>
                      )}

                      {!isRejected && (
                        <button
                          type="button"
                          disabled={actionLoadingId === review.id}
                          onClick={() => handleReject(review.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={actionLoadingId === review.id}
                        onClick={() => handleDelete(review.id)}
                        className="inline-flex items-center gap-1 rounded-xl p-2 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        title="Delete Review"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
