"use client";

import { useEffect, useState } from "react";
import { Star, ShieldCheck, Sparkles, Quote } from "lucide-react";
import Container from "./Container";
import SectionHeading from "./SectionHeading";
import { getPublicReviewsAction } from "@/app/actions/reviews";

interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  customerName: string;
  serviceName: string;
  vehicle: string;
  createdAt: string;
  isVerified: boolean;
}

export default function Testimonials() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [stats, setStats] = useState<{ averageRating: number; totalCount: number }>({
    averageRating: 0,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReviews() {
      try {
        const res = await getPublicReviewsAction(6);
        if (res.success && res.reviews) {
          setReviews(res.reviews);
          if (res.stats) {
            setStats(res.stats);
          }
        }
      } catch (err) {
        console.error("Failed to load public reviews:", err);
      } finally {
        setLoading(false);
      }
    }

    loadReviews();
  }, []);

  if (!loading && reviews.length === 0) {
    return null;
  }

  return (
    <section className="bg-background-light py-20 sm:py-24 border-t border-border">
      <Container>
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary border border-primary/20">
            <Sparkles size={14} />
            Verified Customer Stories
          </div>

          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            What Our Customers Say
          </h2>

          {/* Rating Summary Bar */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 shadow-sm border border-border">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={15} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-xs font-extrabold text-foreground">
              {stats.averageRating.toFixed(1)} / 5.0
            </span>
            <span className="text-xs text-text-secondary">
              ({stats.totalCount}+ Verified Reviews)
            </span>
          </div>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
            Real experiences from drivers, commuters, and fleet owners who saved time with our on-demand mobile tire service.
          </p>
        </div>

        {/* Dynamic Reviews Grid */}
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((testimonial) => {
            const commentSnippet =
              testimonial.comment.length > 150
                ? `${testimonial.comment.slice(0, 150)}...`
                : testimonial.comment;

            return (
              <article
                key={testimonial.id}
                className="group relative flex flex-col justify-between rounded-[20px] border border-border bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex gap-1" aria-label={`Rated ${testimonial.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          size={16}
                          aria-hidden="true"
                          className={
                            index < testimonial.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-200"
                          }
                        />
                      ))}
                    </div>

                    <div className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700 border border-green-200">
                      <ShieldCheck size={12} className="text-green-600" />
                      Verified Booking
                    </div>
                  </div>

                  <p className="mt-5 text-xs leading-relaxed text-slate-700 sm:text-sm">
                    "{commentSnippet}"
                  </p>
                </div>

                <div className="mt-6 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground text-sm">
                        {testimonial.customerName}
                      </p>

                      <p className="text-[11px] text-text-secondary">
                        {testimonial.vehicle}
                      </p>
                    </div>

                    <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary max-w-[130px] truncate text-right">
                      {testimonial.serviceName}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}