"use client";

import { useState, useRef } from "react";
import { Star, X, CheckCircle2, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { submitReviewAction } from "@/app/actions/reviews";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

interface ReviewModalProps {
  bookingId: string;
  serviceName: string;
  vehicle: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const RATING_LABELS = [
  "",
  "1 - Poor Service",
  "2 - Below Expectations",
  "3 - Average / Satisfactory",
  "4 - Very Good Experience",
  "5 - Outstanding & Highly Recommended!",
];

export default function ReviewModal({
  bookingId,
  serviceName,
  vehicle,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, {
    isOpen: true,
    onClose,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (comment.trim().length < 10) {
      setErrorMsg("Please write at least 10 characters describing your service experience.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await submitReviewAction({
        bookingId,
        rating,
        comment: comment.trim(),
      });

      if (!result.success) {
        setErrorMsg(result.error || "Failed to submit review. Please try again.");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("An unexpected error occurred while submitting your review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
        className="relative w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl sm:p-8"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-5 top-5 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-foreground"
        >
          <X size={20} />
        </button>

        {submitted ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600 shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <h3 id="review-modal-title" className="mt-4 text-2xl font-bold text-foreground">
              Thank You for Your Feedback!
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-text-secondary">
              Your review has been submitted and will appear on our website once approved. Thank you!
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary-hover"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 id="review-modal-title" className="text-xl font-bold text-foreground">Leave a Verified Review</h3>
                <p className="text-xs text-text-secondary">
                  {serviceName} • {vehicle}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {/* Star Selector */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <label className="block text-xs font-bold text-foreground mb-2">
                  Rate Your Experience
                </label>

                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = (hoverRating || rating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="group p-1 transition-transform duration-150 hover:scale-125 focus:outline-none"
                      >
                        <Star
                          size={32}
                          className={`transition-colors ${
                            isFilled
                              ? "fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)]"
                              : "text-slate-300 group-hover:text-amber-200"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <p className="mt-2 text-xs font-bold text-amber-700">
                  {RATING_LABELS[hoverRating || rating]}
                </p>
              </div>

              {/* Comment Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="comment"
                    className="flex items-center gap-1.5 text-xs font-bold text-foreground"
                  >
                    <MessageSquare size={14} className="text-primary" />
                    Your Review & Experience
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      comment.length > 500
                        ? "text-red-600 font-bold"
                        : "text-slate-400"
                    }`}
                  >
                    {comment.length}/500
                  </span>
                </div>

                <textarea
                  id="comment"
                  rows={4}
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How was our mobile technician? Was the arrival on-time, rim care touchless, and service smooth? (Minimum 10 characters)"
                  className="w-full resize-none rounded-xl border border-border bg-white p-3.5 text-xs text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              {/* Submit Button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-primary py-3 px-4 text-xs font-bold text-white shadow-md shadow-primary/25 transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={15} className="animate-spin" />
                      Submitting Review...
                    </span>
                  ) : (
                    "Submit Review →"
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border py-3 px-4 text-xs font-semibold text-text-secondary hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
