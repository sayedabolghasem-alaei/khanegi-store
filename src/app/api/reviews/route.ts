import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, ApiError, requireUser, audit } from "@/lib/server/api-helpers";
import { reviewCreateSchema } from "@/lib/validators";

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const body = reviewCreateSchema.parse(await req.json());

  const product = await db.product.findUnique({ where: { id: body.productId } });
  if (!product || !product.isActive) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "محصول مورد نظر یافت نشد یا فعال نیست.");
  }

  // Duplicate prevention: one review per user per product while it is PENDING
  // or APPROVED (a REJECTED review may be re-submitted).
  const duplicate = await db.productReview.findFirst({
    where: {
      productId: product.id,
      userId: user.id,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ApiError(
      409,
      "REVIEW_DUPLICATE",
      "شما قبلاً برای این محصول نظر ثبت کرده‌اید."
    );
  }

  // Verified purchase: the user has a non-cancelled order containing this product.
  const purchase = await db.order.findFirst({
    where: {
      userId: user.id,
      status: { not: "CANCELLED" },
      items: { some: { productId: product.id } },
    },
    select: { id: true },
  });

  // New reviews enter the moderation queue (PENDING) — an admin/staff member
  // approves or rejects them via PATCH /api/admin/reviews/[id].
  await db.productReview.create({
    data: {
      productId: product.id,
      userId: user.id,
      rating: body.rating,
      title: body.title ?? null,
      comment: body.comment,
      status: "PENDING",
      isVerifiedPurchase: Boolean(purchase),
    },
  });

  // Recompute aggregate rating — APPROVED reviews only (PENDING reviews never
  // affect product aggregates).
  const agg = await db.productReview.aggregate({
    where: { productId: product.id, status: "APPROVED" },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await db.product.update({
    where: { id: product.id },
    data: {
      ratingAvg: Math.round((agg._avg.rating ?? 0) * 100) / 100,
      ratingCount: agg._count.rating,
    },
  });

  await audit({ id: user.id, name: user.name }, "REVIEW_CREATE", "Product", product.id, {
    rating: body.rating,
    isVerifiedPurchase: Boolean(purchase),
  });

  return ok({ ok: true }, 201);
});
