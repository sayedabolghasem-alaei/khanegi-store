// Admin product service: slug generation, uniqueness guards, DTO mapping,
// soft delete (deletedAt — products never leave the DB; they just disappear
// from every admin/public list because all queries filter deletedAt: null).

import { db } from "@/lib/db";
import { ApiError } from "@/lib/server/api-helpers";
import { parseJsonArray } from "@/lib/server/catalog";
import type { AdminProductDetail, AdminProductRow, ProductAttributeValue, ProductCard } from "@/lib/types";
import type { Prisma } from "@prisma/client";

// ─── Slug / SKU ─────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  const latin = input
    .toLowerCase()
    .replace(/['"«»،]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return latin;
}

const randSuffix = () => Math.random().toString(36).slice(2, 6);

/** Latin slug from nameEn → name → random; guaranteed unique (random suffix on conflict).
 * NOTE: uniqueness is checked over ALL rows — soft-deleted products still hold
 * their unique slug/SKU in SQLite, so a candidate that ignores them would only
 * fail later at the DB-constraint level. */
export async function generateUniqueSlug(
  preferred: string | null | undefined,
  nameEn: string | null | undefined,
  name: string,
  exceptId?: string
): Promise<string> {
  const base = slugify(preferred ?? "") || slugify(nameEn ?? "") || slugify(name) || "";
  let candidate = base || `product-${randSuffix()}`;
  for (let i = 0; i < 8; i++) {
    const exists = await db.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists || exists.id === exceptId) return candidate;
    candidate = `${base || "product"}-${randSuffix()}`;
  }
  return `product-${Date.now().toString(36)}`;
}

export async function assertSkuAvailable(sku: string, exceptId?: string): Promise<string> {
  const normalized = sku.trim().toUpperCase();
  const existing = await db.product.findUnique({ where: { sku: normalized }, select: { id: true } });
  if (existing && existing.id !== exceptId) {
    throw new ApiError(409, "SKU_EXISTS", "این کد SKU قبلاً برای محصول دیگری ثبت شده است.");
  }
  return normalized;
}

export function generateSku(): string {
  return `SKU-${Date.now().toString(36).toUpperCase()}${randSuffix().toUpperCase()}`;
}

// ─── DTO mapping ────────────────────────────────────────────────────────────

type ProductFull = Prisma.ProductGetPayload<{
  include: {
    brand: { select: { slug: true; name: true; nameEn: true } };
    category: { select: { slug: true; name: true } };
    images: { orderBy: { sortOrder: "asc" } };
    variants: { orderBy: [{ name: "asc" }, { extraPriceToman: "asc" }] };
  };
}>;

export function toProductCardFull(p: ProductFull): ProductCard {
  const discount =
    p.originalPriceToman && p.originalPriceToman > p.priceToman
      ? Math.round(((p.originalPriceToman - p.priceToman) / p.originalPriceToman) * 100)
      : 0;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: { slug: p.brand.slug, name: p.brand.name, nameEn: p.brand.nameEn },
    category: { slug: p.category.slug, name: p.category.name },
    image: p.images[0]?.url ?? null,
    priceToman: p.priceToman,
    originalPriceToman: p.originalPriceToman,
    discountPercent: discount,
    ratingAvg: Math.round(p.ratingAvg * 10) / 10,
    ratingCount: p.ratingCount,
    stock: p.stock,
    isFeatured: p.isFeatured,
    isNew: p.isNew,
    soldCount: p.soldCount,
    isActive: p.isActive,
  };
}

export function toAdminProductRow(p: ProductFull): AdminProductRow {
  return {
    ...toProductCardFull(p),
    sku: p.sku,
    model: p.model,
    categoryName: p.category.name,
    costPrice: p.costPrice,
    costCurrency: p.costCurrency,
    isPriceManual: p.isPriceManual,
    viewCount: p.viewCount,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toAdminProductDetail(p: ProductFull): AdminProductDetail {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    nameEn: p.nameEn,
    sku: p.sku,
    model: p.model,
    categoryId: p.categoryId,
    brandId: p.brandId,
    shortDescription: p.shortDescription,
    description: p.description,
    priceToman: p.priceToman,
    originalPriceToman: p.originalPriceToman,
    isPriceManual: p.isPriceManual,
    costPrice: p.costPrice,
    costCurrency: p.costCurrency,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    warrantyMonths: p.warrantyMonths,
    colorOptions: parseJsonArray(p.colorOptions),
    attributes: parseJsonArray<ProductAttributeValue>(p.attributes),
    isFeatured: p.isFeatured,
    isNew: p.isNew,
    isActive: p.isActive,
    images: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt ?? p.name })),
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      value: v.value,
      extraPriceToman: v.extraPriceToman,
      stock: v.stock,
    })),
  };
}

const adminProductInclude = {
  brand: { select: { slug: true, name: true, nameEn: true } },
  category: { select: { slug: true, name: true } },
  images: { orderBy: { sortOrder: "asc" as const } },
  variants: { orderBy: [{ name: "asc" as const }, { extraPriceToman: "asc" as const }] },
};

export async function getFullProduct(id: string): Promise<ProductFull | null> {
  const p = await db.product.findUnique({ where: { id }, include: adminProductInclude });
  // Soft-deleted products disappear from the admin panel too (no trash view).
  if (!p || p.deletedAt) return null;
  return p;
}

export { adminProductInclude };

// ─── Soft delete ───────────────────────────────────────────────────────────

/**
 * Soft delete: the Product row is NEVER hard-deleted (OrderItem snapshots stay
 * consistent, history is preserved). Sets deletedAt + isActive=false so every
 * admin/public query (which filters deletedAt: null and/or isActive) hides it.
 */
export async function softDeleteProduct(id: string): Promise<{ id: string; name: string; slug: string; sku: string }> {
  const existing = await db.product.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, sku: true, deletedAt: true },
  });
  if (!existing) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "محصول مورد نظر یافت نشد.");
  }
  if (existing.deletedAt) {
    throw new ApiError(409, "PRODUCT_ALREADY_DELETED", "این محصول قبلاً حذف شده است.");
  }
  await db.product.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  return { id: existing.id, name: existing.name, slug: existing.slug, sku: existing.sku };
}

// ─── Image payload normalization (url strings or {url, alt} objects) ─────

export type ProductImageInput = string | { url: string; alt?: string | null };

export interface NormalizedProductImage {
  url: string;
  alt: string | null;
  sortOrder: number;
}

/**
 * Accepts the wire format of `images` (string[] legacy or {url, alt?}[]),
 * trims, drops empties, caps at 10 and assigns sortOrder. Falls back to the
 * product name as alt when none was provided (existing behavior).
 */
export function normalizeProductImages(
  input: ProductImageInput[] | undefined,
  fallbackAlt: string | null
): NormalizedProductImage[] {
  if (!input) return [];
  return input
    .map((item) => (typeof item === "string" ? { url: item, alt: undefined } : item))
    .map((item) => ({ url: (item.url ?? "").trim(), alt: (item.alt ?? "").trim() }))
    .filter((item) => item.url.length > 0)
    .slice(0, 10)
    .map((item, idx) => ({
      url: item.url,
      alt: item.alt || fallbackAlt || null,
      sortOrder: idx,
    }));
}
