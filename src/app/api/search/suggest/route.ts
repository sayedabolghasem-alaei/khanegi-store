import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle } from "@/lib/server/api-helpers";
import type { SuggestResponse } from "@/lib/types";

export const GET = handle(async (req: NextRequest) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 1) {
    const empty: SuggestResponse = { products: [], categories: [], brands: [] };
    return ok(empty);
  }

  const [products, categories, brands] = await Promise.all([
    db.product.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        brand: { select: { name: true, nameEn: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      },
      take: 200,
    }),
    db.category.findMany({ where: { isActive: true } }),
    db.brand.findMany(),
  ]);

  const matchedProducts = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameEn ?? "").toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.model ?? "").toLowerCase().includes(q) ||
        p.brand.name.toLowerCase().includes(q) ||
        p.brand.nameEn.toLowerCase().includes(q)
    )
    .slice(0, 6)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      image: p.images[0]?.url ?? null,
      priceToman: p.priceToman,
      brand: p.brand.name,
    }));

  const matchedCategories = categories
    .filter((c) => c.name.toLowerCase().includes(q) || (c.nameEn ?? "").toLowerCase().includes(q))
    .slice(0, 4)
    .map((c) => ({ slug: c.slug, name: c.name }));

  const matchedBrands = brands
    .filter((b) => b.name.toLowerCase().includes(q) || b.nameEn.toLowerCase().includes(q))
    .slice(0, 4)
    .map((b) => ({ slug: b.slug, name: b.name }));

  const payload: SuggestResponse = {
    products: matchedProducts,
    categories: matchedCategories,
    brands: matchedBrands,
  };
  return ok(payload);
});
