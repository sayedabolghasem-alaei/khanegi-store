// Torob merchant-feed adapter (see docs/contracts.md → "Torob feed").
//
// ⚠️ SPEC STATUS: The exact Torob merchant feed specification (field names,
// auth, endpoints) must be verified against their official merchant
// documentation before going live. This adapter implements the agreed internal
// shape (TorobFeedItem in src/lib/types.ts) and is intentionally isolated here
// so only this file needs to change when the spec is confirmed.

import type { Prisma } from "@prisma/client";
import type { TorobFeedItem, TorobFeedResponse } from "@/lib/types";

const GENERATOR = "ariakhaneh-torob-adapter/1.0";
const FEED_NOTE =
  "فید آزمایشی ترب — ساختار فیلدها پیش از فعال‌سازی باید با مستندات رسمی ترب تطبیق داده شود.";

export const TOROB_FIELDS: (keyof TorobFeedItem)[] = [
  "product_id",
  "product_name",
  "brand",
  "category",
  "price_toman",
  "availability",
  "page_url",
  "image_url",
  "sku",
  "warranty_months",
];

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    brand: { select: { name: true; nameEn: true } };
    category: { select: { name: true } };
    images: { select: { url: true } };
  };
}>;

function siteBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/** Builds canonical product page URL; relative when NEXT_PUBLIC_SITE_URL is unset. */
export function buildProductPageUrl(slug: string): string {
  const base = siteBaseUrl();
  return base ? `${base}/#/product/${slug}` : `/#/product/${slug}`;
}

export function buildFeedItem(p: ProductWithRelations): TorobFeedItem {
  const image = p.images[0]?.url ?? "";
  return {
    product_id: p.id,
    product_name: p.name,
    brand: p.brand.name,
    category: p.category.name,
    price_toman: p.priceToman,
    availability: p.stock > 0 ? "in_stock" : "out_of_stock",
    page_url: buildProductPageUrl(p.slug),
    image_url: image,
    sku: p.sku,
    warranty_months: p.warrantyMonths ?? null,
  };
}

export function buildFeedItems(products: ProductWithRelations[]): TorobFeedItem[] {
  return products.map(buildFeedItem);
}

export interface TorobValidationReport {
  ok: boolean;
  missingFields: string[];
  warnings: string[];
  count: number;
}

/** Static validation of feed completeness — no undocumented Torob endpoints involved. */
export function validateFeed(items: TorobFeedItem[]): TorobValidationReport {
  const missingFields = new Set<string>();
  const warnings: string[] = [];

  for (const it of items) {
    if (!it.product_id) missingFields.add("product_id");
    if (!it.product_name) missingFields.add("product_name");
    if (!it.brand) missingFields.add("brand");
    if (!it.category) missingFields.add("category");
    if (!Number.isFinite(it.price_toman) || it.price_toman <= 0) missingFields.add("price_toman");
    if (!it.page_url) missingFields.add("page_url");
    if (!it.sku) missingFields.add("sku");
    if (!it.image_url) {
      missingFields.add("image_url");
      warnings.push(`محصول «${it.product_name || it.sku}» تصویری ندارد.`);
    }
    if (it.availability === "out_of_stock") {
      warnings.push(`محصول «${it.product_name}» ناموجود است.`);
    }
    if (it.warranty_months == null) {
      warnings.push(`محصول «${it.product_name}» گارانتی (ماه) ندارد.`);
    }
  }

  warnings.push("تطبیق ساختار فیلدها با مستندات رسمی ترب هنوز انجام نشده است (SPEC-PENDING).");

  return {
    ok: missingFields.size === 0,
    missingFields: Array.from(missingFields).sort(),
    warnings,
    count: items.length,
  };
}

// ─── CSV ────────────────────────────────────────────────────────────────────

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function feedToCsv(items: TorobFeedItem[]): string {
  const header = TOROB_FIELDS.join(",");
  const lines = items.map((it) => TOROB_FIELDS.map((f) => csvEscape(it[f])).join(","));
  // BOM so Excel renders Persian correctly.
  return "\uFEFF" + [header, ...lines].join("\r\n") + "\r\n";
}

export function buildFeedResponse(items: TorobFeedItem[]): TorobFeedResponse {
  return {
    generator: GENERATOR,
    generated_at: new Date().toISOString(),
    count: items.length,
    note: FEED_NOTE,
    items,
  };
}
