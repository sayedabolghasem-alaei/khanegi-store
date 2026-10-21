// Public catalog endpoint: active categories with a count of active products.
// No auth required; straight from the DB (no sample data).
import { db } from "@/lib/db";
import { ok, handle } from "@/lib/server/api-helpers";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });

  return ok({
    items: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      nameEn: c.nameEn,
      productCount: c._count.products,
    })),
  });
});
