// Public catalog endpoint: brands with a count of their active products.
// (The Brand model has no isActive flag — all brands are listed.)
// No auth required; straight from the DB (no sample data).
import { db } from "@/lib/db";
import { ok, handle } from "@/lib/server/api-helpers";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const brands = await db.brand.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });

  return ok({
    items: brands.map((b) => ({
      slug: b.slug,
      name: b.name,
      nameEn: b.nameEn,
      productCount: b._count.products,
    })),
  });
});
