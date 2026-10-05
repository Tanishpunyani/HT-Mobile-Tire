"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

interface SubmitReviewInput {
  bookingId: string;
  rating: number;
  comment: string;
}

export async function submitReviewAction(input: SubmitReviewInput) {
  try {
    const { bookingId, rating, comment } = input;

    if (!bookingId) {
      return { success: false, error: "Booking ID is required." };
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return { success: false, error: "Please select a rating between 1 and 5 stars." };
    }

    const trimmedComment = (comment || "").trim();
    if (trimmedComment.length < 10) {
      return { success: false, error: "Review must be at least 10 characters long." };
    }
    if (trimmedComment.length > 500) {
      return { success: false, error: "Review cannot exceed 500 characters." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: "You must be signed in to submit a review.",
      };
    }

    // Check if the booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        reviews: true,
      },
    });

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    // Verify ownership: customer must match the authenticated user
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { userId: user.id },
          ...(user.email ? [{ email: user.email }] : []),
        ],
      },
    });

    if (!customer || !booking.customerId || booking.customerId !== customer.id) {
      return {
        success: false,
        error: "You are not authorized to submit a review for this booking.",
      };
    }

    if (booking.status !== "completed") {
      return {
        success: false,
        error: "Reviews can only be submitted for completed services.",
      };
    }

    if (booking.reviews && booking.reviews.length > 0) {
      return {
        success: false,
        error: "A review has already been submitted for this service.",
      };
    }

    // Create the review with isApproved = false (pending moderation)
    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        customerId: booking.customerId,
        rating,
        review: trimmedComment,
        comment: trimmedComment,
        isApproved: false,
      },
    });

    revalidatePath("/account");
    revalidatePath("/admin/reviews");

    return {
      success: true,
      reviewId: review.id,
      message: "Thank you! Your review has been submitted and is pending moderation.",
    };
  } catch (error: any) {
    logger.error("review_action.submit_failed", { error });
    return {
      success: false,
      error: error?.message || "Failed to submit review. Please try again.",
    };
  }
}

export async function approveReviewAction(reviewId: string) {
  try {
    await requireAdminSession();

    await prisma.review.update({
      where: { id: reviewId },
      data: {
        isApproved: true,
        rejectedAt: null,
      },
    });

    revalidatePath("/admin/reviews");
    revalidatePath("/");
    revalidatePath("/services");

    return { success: true };
  } catch (error: any) {
    logger.error("review_action.approve_failed", { error });
    return { success: false, error: "Failed to approve review." };
  }
}

export async function rejectReviewAction(reviewId: string, adminNotes?: string) {
  try {
    await requireAdminSession();

    await prisma.review.update({
      where: { id: reviewId },
      data: {
        isApproved: false,
        rejectedAt: new Date(),
        adminNotes: adminNotes || "Rejected by moderator",
      },
    });

    revalidatePath("/admin/reviews");
    revalidatePath("/");

    return { success: true };
  } catch (error: any) {
    logger.error("review_action.reject_failed", { error });
    return { success: false, error: "Failed to reject review." };
  }
}

export async function deleteReviewAction(reviewId: string) {
  try {
    await requireAdminSession();

    await prisma.review.delete({
      where: { id: reviewId },
    });

    revalidatePath("/admin/reviews");
    revalidatePath("/");

    return { success: true };
  } catch (error: any) {
    logger.error("review_action.delete_failed", { error });
    return { success: false, error: "Failed to delete review." };
  }
}

export async function getPublicReviewsAction(limit = 6) {
  try {
    const approvedReviews = await prisma.review.findMany({
      where: { isApproved: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        customer: true,
        booking: {
          include: {
            service: true,
          },
        },
      },
    });

    // Aggregate statistics
    const aggregate = await prisma.review.aggregate({
      where: { isApproved: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    const averageRating = aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : 0;
    const totalCount = aggregate._count.id;

    return {
      success: true,
      reviews: approvedReviews.map((r) => {
        const rawName = r.customer?.name || "Verified Customer";
        const parts = rawName.trim().split(" ");
        const maskedName =
          parts.length > 1
            ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`
            : parts[0];

        return {
          id: r.id,
          rating: r.rating,
          comment: r.comment || r.review,
          customerName: maskedName,
          serviceName: r.booking?.service?.name || "Mobile Tire Service",
          vehicle: r.booking?.vehicle || "Vehicle",
          createdAt: r.createdAt.toISOString(),
          isVerified: true,
        };
      }),
      stats: {
        averageRating,
        totalCount,
      },
    };
  } catch (error) {
    logger.error("review_action.get_public_failed", { error });
    return {
      success: true,
      reviews: [],
      stats: {
        averageRating: 0,
        totalCount: 0,
      },
    };
  }
}
