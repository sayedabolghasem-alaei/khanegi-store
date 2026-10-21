import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle } from "@/lib/server/api-helpers";
import { buildFeedItems, buildFeedResponse, feedToCsv } from "@/lib/server/torob";

/**
 * GET /api/torob/feed?format=json|csv
 * JSON → TorobFeedResponse; CSV → text/csv with header row (BOM included).
 */
export const GET = handle(async (req: NextRequest) => {
  const format = (req.nextUrl.searchParams.get("format") ?? "json").toLowerCase();

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

  if (format === "csv") {
    return new Response(feedToCsv(items), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'inline; filename="ariakhaneh-torob-feed.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  return ok(buildFeedResponse(items));
});
