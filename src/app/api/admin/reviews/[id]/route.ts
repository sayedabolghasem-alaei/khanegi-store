import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handle, ApiError, requireRole, audit } from "@/lib/server/api-helpers";
import type { AdminReviewDTO, ReviewStatus } from "@/lib/types";
import type { Prisma } from "@prisma/client";

// PATCH /api/admin/reviews/[id] — moderation decision (STAFF/ADMIN).
// Body: { status?: "APPROVED"|"REJECTED", adminReply?: string|null } — at least
// one field must be present. Status change sets reviewedAt=now and triggers a
// ratingAvg/ratingCount recalculation over APPROVED reviews only (same pattern
// as the public POST /api/reviews route).
const patchSchema = z
  .object({
    status: z
      .enum(["APPROVED", "REJECTED"], { error: "وضعیت دیدگاه نامعتبر است." })
      .optional(),
    adminReply: z
      .string()
      .trim()
      .min(1, "متن پاسخ نمی‌تواند خالی باشد.")
      .max(1000, "پاسخ مدیر حداکثر ۱۰۰۰ کاراکتر است.")
      .nullable()
      .optional(),
  })
  .refine((v) => v.status !== undefined || v.adminReply !== undefined, {
    message: "هیچ تغییری برای ذخیره ارسال نشده است.",
  });

const reviewInclude = {
  product: { select: { id: true, slug: true, name: true } },
  user: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.ProductReviewInclude;

function toDTO(r: {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  status: string;
  adminReply: string | null;
  isVerifiedPurchase: boolean;
  createdAt: Date;
  reviewedAt: Date | null;
  product: { id: string; slug: string; name: string };
  user: { id: string; name: string; phone: string };
}): AdminReviewDTO {
  return {
    id: r.id,
    product: r.product,
    user: r.user,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    status: r.status as ReviewStatus,
    adminReply: r.adminReply,
    isVerifiedPurchase: r.isVerifiedPurchase,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  };
}

export const PATCH = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const staff = await requireRole(req, ["STAFF", "ADMIN"]);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const review = await db.productReview.findUnique({
      where: { id },
      include: reviewInclude,
    });
    if (!review) {
      throw new ApiError(404, "REVIEW_NOT_FOUND", "دیدگاه مورد نظر یافت نشد.");
    }

    const data: Prisma.ProductReviewUpdateInput = {};
    let statusChanged = false;
    if (body.status !== undefined) {
      data.status = body.status;
      data.reviewedAt = new Date();
      statusChanged = true;
    }
    if (body.adminReply !== undefined) {
      // string → save/replace; null → clear the reply.
      data.adminReply = body.adminReply;
    }

    const updated = await db.productReview.update({
      where: { id: review.id },
      data,
      include: reviewInclude,
    });

    // Aggregates only depend on APPROVED reviews — recalc after any status
    // change (identical recalc pattern to POST /api/reviews).
    if (statusChanged) {
      const agg = await db.productReview.aggregate({
        where: { productId: review.productId, status: "APPROVED" },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await db.product.update({
        where: { id: review.productId },
        data: {
          ratingAvg: Math.round((agg._avg.rating ?? 0) * 100) / 100,
          ratingCount: agg._count.rating,
        },
      });
    }

    await audit(
      { id: staff.id, name: staff.name },
      "REVIEW_MODERATE",
      "ProductReview",
      review.id,
      {
        productSlug: review.product.slug,
        from: review.status,
        to: updated.status,
        adminReplyUpdated: body.adminReply !== undefined,
      }
    );

    return ok({ review: toDTO(updated) });
  }
);
