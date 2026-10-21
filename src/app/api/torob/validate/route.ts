import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle } from "@/lib/server/api-helpers";
import { buildFeedItems, validateFeed } from "@/lib/server/torob";

/** GET /api/torob/validate → feed completeness report. */
export const GET = handle(async (_req: NextRequest) => {
  const products = await db.product.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      brand: { select: { name: true, nameEn: true } },
      category: { select: { name: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
    },
  });
  const items = buildFeedItems(products);
  return ok(validateFeed(items));
});
