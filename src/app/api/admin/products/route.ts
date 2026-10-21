import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, audit, parseIntParam, ApiError } from "@/lib/server/api-helpers";
import {
  generateUniqueSlug,
  assertSkuAvailable,
  generateSku,
  toAdminProductDetail,
  toAdminProductRow,
  getFullProduct,
  normalizeProductImages,
} from "@/lib/server/admin-products";
import { adminProductCreateSchema } from "@/lib/validators";

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["STAFF", "ADMIN"]);
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "all"; // active | inactive | all
  const categoryId = sp.get("categoryId") ?? undefined;
  const brandId = sp.get("brandId") ?? undefined;
  const page = parseIntParam(sp.get("page"), 1);
  const pageSize = Math.min(50, parseIntParam(sp.get("pageSize"), 20));
  const q = (sp.get("q") ?? "").trim().toLowerCase();

  const products = await db.product.findMany({
    where: {
      deletedAt: null, // soft-deleted products disappear from the admin list
      ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(brandId ? { brandId } : {}),
    },
    include: {
      brand: { select: { slug: true, name: true, nameEn: true } },
      category: { select: { slug: true, name: true } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = q
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nameEn ?? "").toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.model ?? "").toLowerCase().includes(q)
      )
    : products;

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  return ok({
    items: filtered.slice(start, start + pageSize).map(toAdminProductRow),
    total,
    page,
    pageSize,
  });
});

export const POST = handle(async (req: NextRequest) => {
  const admin = await requireRole(req, ["STAFF", "ADMIN"]);
  const body = adminProductCreateSchema.parse(await req.json());

  const category = await db.category.findUnique({ where: { id: body.categoryId } });
  if (!category) throw new ApiError(400, "CATEGORY_INVALID", "دسته‌بندی انتخابی معتبر نیست.");
  const brand = await db.brand.findUnique({ where: { id: body.brandId } });
  if (!brand) throw new ApiError(400, "BRAND_INVALID", "برند انتخابی معتبر نیست.");

  const slug = await generateUniqueSlug(body.slug, body.nameEn, body.name);
  const sku = body.sku ? await assertSkuAvailable(body.sku) : generateSku();

  const product = await db.product.create({
    data: {
      slug,
      name: body.name,
      nameEn: body.nameEn ?? null,
      sku,
      model: body.model ?? null,
      categoryId: body.categoryId,
      brandId: body.brandId,
      shortDescription: body.shortDescription ?? null,
      description: body.description,
      priceToman: body.priceToman,
      originalPriceToman: body.originalPriceToman ?? null,
      isPriceManual: body.isPriceManual ?? true,
      costPrice: body.costPrice ?? null,
      costCurrency: body.costCurrency ?? null,
      stock: body.stock,
      lowStockThreshold: body.lowStockThreshold ?? 3,
      warrantyMonths: body.warrantyMonths ?? null,
      colorOptions: body.colorOptions ? JSON.stringify(body.colorOptions) : null,
      attributes: body.attributes ? JSON.stringify(body.attributes) : null,
      isFeatured: body.isFeatured ?? false,
      isNew: body.isNew ?? false,
      isActive: body.isActive ?? true,
      images: body.images
        ? {
            create: normalizeProductImages(body.images, body.name).map((img) => ({
              url: img.url,
              alt: img.alt,
              sortOrder: img.sortOrder,
            })),
          }
        : undefined,
      variants: body.variants
        ? {
            create: body.variants.map((v) => ({
              name: v.name,
              value: v.value,
              extraPriceToman: v.extraPriceToman ?? 0,
              stock: v.stock ?? 0,
              isActive: true,
            })),
          }
        : undefined,
    },
  });

  await audit({ id: admin.id, name: admin.name }, "PRODUCT_CREATE", "Product", product.id, {
    name: product.name,
    sku: product.sku,
  });

  const full = await getFullProduct(product.id);
  return ok({ product: toAdminProductDetail(full!) }, 201);
});
