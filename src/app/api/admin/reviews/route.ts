import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, parseIntParam } from "@/lib/server/api-helpers";
import type { AdminReviewDTO, ReviewStatus } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export interface AdminReviewsListResponse {
  items: AdminReviewDTO[];
  total: number;
  page: number;
  pageSize: number;
  /** Counts per status across ALL reviews (ignores filters) — for tab badges. */
  counts: { PENDING: number; APPROVED: number; REJECTED: number };
}

const REVIEW_STATUSES: ReviewStatus[] = ["PENDING", "APPROVED", "REJECTED"];

function parseDateParam(v: string | null, endOfDay = false): Date | null {
  if (!v) return null;
  const t = Date.parse(v);
  if (Number.isNaN(t)) return null;
  // Plain "YYYY-MM-DD" strings: from → start of day, to → end of day.
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
    return new Date(`${v.trim()}T23:59:59.999`);
  }
  return new Date(t);
}

// GET /api/admin/reviews — moderation queue (STAFF/ADMIN).
// Filters: status (PENDING|APPROVED|REJECTED|all), rating (1-5|all),
// productId, from/to (ISO date or YYYY-MM-DD), page, pageSize.
export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["STAFF", "ADMIN"]);

  const sp = req.nextUrl.searchParams;
  const statusRaw = sp.get("status") ?? "all";
  const ratingRaw = sp.get("rating");
  const productId = sp.get("productId");
  const page = parseIntParam(sp.get("page"), 1);
  const pageSize = Math.min(parseIntParam(sp.get("pageSize"), 20), 100);

  const where: Prisma.ProductReviewWhereInput = {};
  if (REVIEW_STATUSES.includes(statusRaw as ReviewStatus)) {
    where.status = statusRaw;
  }
  if (ratingRaw && ["1", "2", "3", "4", "5"].includes(ratingRaw.trim())) {
    where.rating = Number(ratingRaw.trim());
  }
  if (productId) where.productId = productId;

  const from = parseDateParam(sp.get("from"));
  const to = parseDateParam(sp.get("to"), true);
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const [reviews, total, statusGroups] = await Promise.all([
    db.productReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        product: { select: { id: true, slug: true, name: true } },
        user: { select: { id: true, name: true, phone: true } },
      },
    }),
    db.productReview.count({ where }),
    db.productReview.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts: AdminReviewsListResponse["counts"] = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const g of statusGroups) {
    if ((REVIEW_STATUSES as string[]).includes(g.status)) {
      counts[g.status as ReviewStatus] = g._count._all;
    }
  }

  const items: AdminReviewDTO[] = reviews.map((r) => ({
    id: r.id,
    product: { id: r.product.id, slug: r.product.slug, name: r.product.name },
    user: { id: r.user.id, name: r.user.name, phone: r.user.phone },
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    status: r.status as ReviewStatus,
    adminReply: r.adminReply,
    isVerifiedPurchase: r.isVerifiedPurchase,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  }));

  return ok({ items, total, page, pageSize, counts });
});
