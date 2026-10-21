import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

// sitemap.xml for real deployments.
// ⚠️ NOTE: the preview sandbox exposes only "/" — this route still renders
// there (hash URLs), but its full value (crawlable product/category URLs) is
// realized on a real deploy where NEXT_PUBLIC_SITE_URL points at the domain.
// URL shape matches the canonical SPA URLs (src/lib/server/torob.ts
// buildProductPageUrl): <base>/#/product/<slug> — migrate to clean paths when
// the storefront moves to real SSR routes (docs/architecture.md → SEO).

export const dynamic = "force-dynamic";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://ariakhaneh.example").replace(
  /\/+$/,
  ""
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { slug: true, updatedAt: true },
    }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true },
    }),
  ]);

  return [
    { url: `${BASE}/`, priority: 1.0, changeFrequency: "daily" },
    { url: `${BASE}/#/search`, priority: 0.4, changeFrequency: "daily" },
    ...categories.map(
      (c): MetadataRoute.Sitemap[number] => ({
        url: `${BASE}/#/category/${c.slug}`,
        priority: 0.8,
        changeFrequency: "weekly",
      })
    ),
    ...products.map(
      (p): MetadataRoute.Sitemap[number] => ({
        url: `${BASE}/#/product/${p.slug}`,
        lastModified: p.updatedAt,
        priority: 0.7,
        changeFrequency: "weekly",
      })
    ),
  ];
}
