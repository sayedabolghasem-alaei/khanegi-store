// Catalog service: DTO mappers, product listing/filtering/sorting, cart payload,
// coupon computation. Server is the single source of truth for prices.

import { db } from "@/lib/db";
import { ApiError } from "@/lib/server/api-helpers";
import { MAX_QTY_PER_LINE, PAGE_SIZE } from "@/lib/constants";
import { discountPercent } from "@/lib/money";
import type {
  CartLine,
  CartPayload,
  CouponValidation,
  ProductCard,
  ProductDetail,
  ProductVariantOption,
} from "@/lib/types";

// ─── JSON parsing (SQLite stores JSON as String) ────────────────────────────

export function parseJsonArray<T>(s: string | null | undefined): T[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

// ─── Product mapping ────────────────────────────────────────────────────────

type ProductWithCardRelations = {
  id: string;
  slug: string;
  name: string;
  priceToman: number;
  originalPriceToman: number | null;
  ratingAvg: number;
  ratingCount: number;
  stock: number;
  isFeatured: boolean;
  isNew: boolean;
  soldCount: number;
  isActive: boolean;
  brand: { slug: string; name: string; nameEn: string };
  category: { slug: string; name: string };
  images: { url: string }[];
};

export function toProductCard(p: ProductWithCardRelations): ProductCard {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: { slug: p.brand.slug, name: p.brand.name, nameEn: p.brand.nameEn },
    category: { slug: p.category.slug, name: p.category.name },
    image: p.images[0]?.url ?? null,
    priceToman: p.priceToman,
    originalPriceToman: p.originalPriceToman,
    discountPercent: discountPercent(p.priceToman, p.originalPriceToman),
    ratingAvg: Math.round(p.ratingAvg * 10) / 10,
    ratingCount: p.ratingCount,
    stock: p.stock,
    isFeatured: p.isFeatured,
    isNew: p.isNew,
    soldCount: p.soldCount,
    isActive: p.isActive,
  };
}

const cardInclude = {
  brand: { select: { slug: true, name: true, nameEn: true } },
  category: { select: { slug: true, name: true } },
  images: { select: { url: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
};

// ─── Product listing ────────────────────────────────────────────────────────

export type ProductSort = "newest" | "price_asc" | "price_desc" | "popular" | "discount" | "rating";

export interface ProductQuery {
  category?: string;
  brands?: string[];
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  isNew?: boolean;
  discounted?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

/** Fetch + filter + sort + paginate. Small dataset → JS filtering keeps Persian search correct. */
export async function queryProducts(query: ProductQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, query.pageSize ?? PAGE_SIZE));

  const products = await db.product.findMany({
    where: {
      isActive: true,
      deletedAt: null, // soft-deleted products never appear in the storefront
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.brands && query.brands.length ? { brand: { slug: { in: query.brands } } } : {}),
      ...(query.minPrice != null || query.maxPrice != null
        ? {
            priceToman: {
              ...(query.minPrice != null ? { gte: query.minPrice } : {}),
              ...(query.maxPrice != null ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
    },
    include: cardInclude,
    orderBy: { createdAt: "desc" },
  });

  let items = products;

  if (query.q) {
    const q = query.q.trim().toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameEn ?? "").toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.model ?? "").toLowerCase().includes(q) ||
        p.brand.name.toLowerCase().includes(q) ||
        p.brand.nameEn.toLowerCase().includes(q) ||
        p.category.name.toLowerCase().includes(q)
    );
  }
  if (query.inStock) items = items.filter((p) => p.stock > 0);
  if (query.featured) items = items.filter((p) => p.isFeatured);
  if (query.isNew) items = items.filter((p) => p.isNew);
  if (query.discounted) items = items.filter((p) => discountPercent(p.priceToman, p.originalPriceToman) > 0);

  switch (query.sort) {
    case "price_asc":
      items.sort((a, b) => a.priceToman - b.priceToman);
      break;
    case "price_desc":
      items.sort((a, b) => b.priceToman - a.priceToman);
      break;
    case "popular":
      items.sort((a, b) => b.soldCount - a.soldCount);
      break;
    case "discount":
      items.sort(
        (a, b) =>
          discountPercent(b.priceToman, b.originalPriceToman) -
          discountPercent(a.priceToman, a.originalPriceToman)
      );
      break;
    case "rating":
      items.sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount);
      break;
    case "newest":
    default:
      items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      break;
  }

  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize).map(toProductCard),
    total,
    page,
    pageSize,
  };
}

// ─── Product detail ─────────────────────────────────────────────────────────

export async function getProductDetail(slug: string): Promise<ProductDetail> {
  const p = await db.product.findUnique({
    where: { slug },
    include: {
      brand: { select: { slug: true, name: true, nameEn: true } },
      category: { select: { slug: true, name: true } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { isActive: true }, orderBy: [{ name: "asc" }, { extraPriceToman: "asc" }] },
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!p || !p.isActive || p.deletedAt) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "محصول مورد نظر یافت نشد.");
  }

  // fire-and-forget view counter
  db.product
    .update({ where: { id: p.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);

  const related = await db.product.findMany({
    where: { categoryId: p.categoryId, isActive: true, deletedAt: null, id: { not: p.id } },
    include: cardInclude,
    orderBy: { soldCount: "desc" },
    take: 8,
  });

  const cards = toProductCard(p);
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: p.reviews.filter((r) => r.rating === star).length,
  }));

  return {
    ...cards,
    nameEn: p.nameEn,
    sku: p.sku,
    model: p.model,
    shortDescription: p.shortDescription,
    description: p.description,
    warrantyMonths: p.warrantyMonths,
    attributes: parseJsonArray(p.attributes),
    colorOptions: parseJsonArray(p.colorOptions),
    variants: p.variants.map(
      (v): ProductVariantOption => ({
        id: v.id,
        name: v.name,
        value: v.value,
        extraPriceToman: v.extraPriceToman,
        stock: v.stock,
      })
    ),
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? p.name })),
    viewCount: p.viewCount,
    related: related.map(toProductCard),
    reviews: p.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      userName: r.user.name,
      adminReply: r.adminReply,
      isVerifiedPurchase: r.isVerifiedPurchase,
      createdAt: r.createdAt.toISOString(),
    })),
    ratingBreakdown: breakdown,
  };
}

// ─── Cart ───────────────────────────────────────────────────────────────────

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      product: { include: { images: { orderBy: { sortOrder: "asc" as const }, take: 1 } } },
      variant: true,
    },
  },
};

export function unitPriceOf(product: { priceToman: number }, variant: { extraPriceToman: number } | null): number {
  return product.priceToman + (variant?.extraPriceToman ?? 0);
}

/** Builds the cart payload; silently excludes inactive / out-of-stock lines. */
export async function buildCartPayload(cartId: string): Promise<CartPayload> {
  const cart = await db.cart.findUnique({ where: { id: cartId }, include: cartInclude });
  const lines: CartLine[] = [];
  let subtotalToman = 0;
  let savingsToman = 0;
  let itemCount = 0;

  for (const item of cart?.items ?? []) {
    const p = item.product;
    // silently excluded per contract: inactive / deleted / out-of-stock lines
    if (!p || !p.isActive || p.deletedAt || p.stock <= 0) continue;
    const unit = unitPriceOf(p, item.variant);
    const maxQuantity = Math.min(p.stock, MAX_QTY_PER_LINE);
    const quantity = Math.max(1, Math.min(item.quantity, maxQuantity));
    const lineTotal = unit * quantity;
    const original = p.originalPriceToman;
    if (original != null && original > unit) savingsToman += (original - unit) * quantity;

    lines.push({
      id: item.id,
      productId: p.id,
      variantId: item.variantId,
      variantText: item.variant ? `${item.variant.name}: ${item.variant.value}` : null,
      slug: p.slug,
      name: p.name,
      image: p.images[0]?.url ?? null,
      unitPriceToman: unit,
      originalPriceToman: original ?? null,
      quantity,
      lineTotalToman: lineTotal,
      stock: p.stock,
      maxQuantity,
    });
    subtotalToman += lineTotal;
    itemCount += quantity;
  }

  return { lines, itemCount, subtotalToman, savingsToman };
}

// ─── Coupons (server-side truth) ────────────────────────────────────────────

export interface CouponCheck {
  ok: true;
  coupon: { id: string; code: string; discountToman: number };
}
export interface CouponReject {
  ok: false;
  message: string;
}

export async function checkCoupon(code: string, subtotalToman: number): Promise<CouponCheck | CouponReject> {
  const normalized = code.trim().toUpperCase();
  const coupon = await db.coupon.findUnique({ where: { code: normalized } });
  const invalid: CouponReject = { ok: false, message: "کد تخفیف نامعتبر است." };
  if (!coupon || !coupon.isActive) return invalid;

  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now)
    return { ok: false, message: "این کد تخفیف هنوز فعال نشده است." };
  if (coupon.validUntil && coupon.validUntil < now)
    return { ok: false, message: "مهلت استفاده از این کد تخفیف به پایان رسیده است." };
  if (coupon.usageLimit != null && coupon.timesUsed >= coupon.usageLimit)
    return { ok: false, message: "ظرفیت استفاده از این کد تخفیف تکمیل شده است." };
  if (coupon.minOrderToman != null && subtotalToman < coupon.minOrderToman)
    return {
      ok: false,
      message: `این کد تخفیف برای سبد خرید بالای ${coupon.minOrderToman.toLocaleString("fa-IR")} تومان است.`,
    };

  let discount =
    coupon.type === "PERCENT" ? Math.floor((subtotalToman * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscountToman != null) discount = Math.min(discount, coupon.maxDiscountToman);
  discount = Math.min(discount, subtotalToman);
  if (discount <= 0) return { ok: false, message: "این کد تخفیف برای سبد خرید فعلی قابل استفاده نیست." };

  return { ok: true, coupon: { id: coupon.id, code: coupon.code, discountToman: discount } };
}

/** Public validate response (never throws for business-invalid codes). */
export async function validateCouponPayload(code: string, subtotalToman: number): Promise<CouponValidation> {
  const result = await checkCoupon(code, subtotalToman);
  if (result.ok) {
    return {
      valid: true,
      message: `کد تخفیف «${result.coupon.code}» با ${result.coupon.discountToman.toLocaleString("fa-IR")} تومان تخفیف اعمال شد.`,
      code: result.coupon.code,
      discountToman: result.coupon.discountToman,
    };
  }
  return { valid: false, message: result.message, discountToman: 0 };
}

export { MAX_QTY_PER_LINE };
