export const dynamic = "force-dynamic";

import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import ReviewsManagementClient, {
  AdminReview,
} from "./ReviewsManagementClient";
import { logger } from "@/lib/logger";

export default async function AdminReviewsPage() {
  await requireAdminSession();

  let initialReviews: AdminReview[] = [];

  try {
    const rawReviews = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        booking: {
          include: {
            service: true,
          },
        },
      },
    });

    initialReviews = serializeDecimal(rawReviews) as unknown as AdminReview[];
  } catch (error: any) {
    logger.error("admin_reviews_page.fetch_failed", { error });
  }

  return <ReviewsManagementClient initialReviews={initialReviews} />;
}
