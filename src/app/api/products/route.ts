import { NextRequest } from "next/server";
import { ok, handle, parseIntParam, normalizeDigits } from "@/lib/server/api-helpers";
import { queryProducts, type ProductSort } from "@/lib/server/catalog";

const SORTS: ProductSort[] = ["newest", "price_asc", "price_desc", "popular", "discount", "rating"];

export const GET = handle(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const sortParam = sp.get("sort");
  const sort = SORTS.includes(sortParam as ProductSort) ? (sortParam as ProductSort) : "newest";

  const minPriceRaw = normalizeDigits(sp.get("minPrice") ?? "");
  const maxPriceRaw = normalizeDigits(sp.get("maxPrice") ?? "");
  const minPrice = minPriceRaw ? Number(minPriceRaw) : undefined;
  const maxPrice = maxPriceRaw ? Number(maxPriceRaw) : undefined;

  const result = await queryProducts({
    category: sp.get("category") ?? undefined,
    brands: sp.get("brand") ? sp.get("brand")!.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    q: sp.get("q") ?? undefined,
    minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    inStock: sp.get("inStock") === "1",
    featured: sp.get("featured") === "1",
    isNew: sp.get("isNew") === "1",
    discounted: sp.get("discounted") === "1",
    sort,
    page: parseIntParam(sp.get("page"), 1),
    pageSize: parseIntParam(sp.get("pageSize"), 12),
  });

  return ok(result);
});
