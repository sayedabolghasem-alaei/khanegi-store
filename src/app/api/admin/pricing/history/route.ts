import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, parseIntParam } from "@/lib/server/api-helpers";
import type { ListResponse, PriceHistoryRow } from "@/lib/types";

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["STAFF", "ADMIN"]);
  const page = parseIntParam(req.nextUrl.searchParams.get("page"), 1);
  const pageSize = Math.min(100, parseIntParam(req.nextUrl.searchParams.get("pageSize"), 20));

  const [total, history] = await Promise.all([
    db.priceHistory.count(),
    db.priceHistory.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { product: { select: { name: true, slug: true } } },
    }),
  ]);

  const items: PriceHistoryRow[] = history.map((h) => ({
    id: h.id,
    productName: h.product.name,
    productSlug: h.product.slug,
    oldPriceToman: h.oldPriceToman,
    newPriceToman: h.newPriceToman,
    reason: h.reason,
    source: h.source,
    createdAt: h.createdAt.toISOString(),
  }));

  const payload: ListResponse<PriceHistoryRow> = { items, total, page, pageSize };
  return ok(payload);
});
