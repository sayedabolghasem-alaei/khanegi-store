import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, ApiError, audit } from "@/lib/server/api-helpers";
import {
  toAdminProductDetail,
  getFullProduct,
  generateUniqueSlug,
  assertSkuAvailable,
  softDeleteProduct,
  normalizeProductImages,
} from "@/lib/server/admin-products";
import { adminProductPatchSchema } from "@/lib/validators";

export const GET = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireRole(req, ["STAFF", "ADMIN"]);
    const { id } = await params;
    const full = await getFullProduct(id);
    if (!full) throw new ApiError(404, "PRODUCT_NOT_FOUND", "محصول مورد نظر یافت نشد.");
    return ok({ product: toAdminProductDetail(full) });
  }
);

export const PATCH = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireRole(req, ["STAFF", "ADMIN"]);
    const { id } = await params;

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new ApiError(404, "PRODUCT_NOT_FOUND", "محصول مورد نظر یافت نشد.");
    }

    const body = adminProductPatchSchema.parse(await req.json());

    // Uniqueness checks
    let slug: string | undefined;
    if (body.slug !== undefined) {
      slug = await generateUniqueSlug(body.slug, body.nameEn ?? existing.nameEn, body.name ?? existing.name, id);
    }
    let sku: string | undefined;
    if (body.sku !== undefined) {
      sku = await assertSkuAvailable(body.sku, id);
    }
    if (body.categoryId) {
      const cat = await db.category.findUnique({ where: { id: body.categoryId }, select: { id: true } });
      if (!cat) throw new ApiError(400, "CATEGORY_INVALID", "دسته‌بندی انتخابی معتبر نیست.");
    }
    if (body.brandId) {
      const br = await db.brand.findUnique({ where: { id: body.brandId }, select: { id: true } });
      if (!br) throw new ApiError(400, "BRAND_INVALID", "برند انتخابی معتبر نیست.");
    }

    const priceChanged = body.priceToman !== undefined && body.priceToman !== existing.priceToman;

    const updated = await db.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.nameEn !== undefined ? { nameEn: body.nameEn } : {}),
          ...(slug !== undefined ? { slug } : {}),
          ...(sku !== undefined ? { sku } : {}),
          ...(body.model !== undefined ? { model: body.model } : {}),
          ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
          ...(body.brandId !== undefined ? { brandId: body.brandId } : {}),
          ...(body.shortDescription !== undefined ? { shortDescription: body.shortDescription } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.priceToman !== undefined ? { priceToman: body.priceToman } : {}),
          ...(body.originalPriceToman !== undefined
            ? { originalPriceToman: body.originalPriceToman }
            : {}),
          ...(body.isPriceManual !== undefined ? { isPriceManual: body.isPriceManual } : {}),
          ...(body.costPrice !== undefined ? { costPrice: body.costPrice } : {}),
          ...(body.costCurrency !== undefined ? { costCurrency: body.costCurrency } : {}),
          ...(body.stock !== undefined ? { stock: body.stock } : {}),
          ...(body.lowStockThreshold !== undefined
            ? { lowStockThreshold: body.lowStockThreshold }
            : {}),
          ...(body.warrantyMonths !== undefined ? { warrantyMonths: body.warrantyMonths } : {}),
          ...(body.colorOptions !== undefined
            ? { colorOptions: JSON.stringify(body.colorOptions) }
            : {}),
          ...(body.attributes !== undefined ? { attributes: JSON.stringify(body.attributes) } : {}),
          ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
          ...(body.isNew !== undefined ? { isNew: body.isNew } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });

      if (priceChanged) {
        await tx.priceHistory.create({
          data: {
            productId: id,
            oldPriceToman: existing.priceToman,
            newPriceToman: body.priceToman!,
            reason: "ویرایش دستی قیمت توسط مدیر",
            source: "MANUAL",
            adminId: admin.id,
          },
        });
      }

      // Replace images if provided (wire format: string urls or {url, alt})
      if (body.images !== undefined) {
        const imgs = normalizeProductImages(body.images, body.name ?? existing.name);
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (imgs.length > 0) {
          await tx.productImage.createMany({
            data: imgs.map((img) => ({
              productId: id,
              url: img.url,
              alt: img.alt,
              sortOrder: img.sortOrder,
            })),
          });
        }
      }

      // Replace variants if provided
      if (body.variants !== undefined) {
        await tx.productVariant.deleteMany({ where: { productId: id } });
        if (body.variants.length > 0) {
          await tx.productVariant.createMany({
            data: body.variants.map((v) => ({
              productId: id,
              name: v.name,
              value: v.value,
              extraPriceToman: v.extraPriceToman ?? 0,
              stock: v.stock ?? 0,
              isActive: true,
            })),
          });
        }
      }

      return product;
    });

    await audit({ id: admin.id, name: admin.name }, "PRODUCT_UPDATE", "Product", id, {
      name: updated.name,
      ...(priceChanged
        ? { oldPriceToman: existing.priceToman, newPriceToman: body.priceToman }
        : {}),
    });

    const full = await getFullProduct(id);
    return ok({ product: toAdminProductDetail(full!) });
  }
);

// DELETE = soft delete (never hard delete): deletedAt + isActive=false.
// The row stays in the DB (OrderItem snapshots / price history remain intact);
// every admin & public query filters deletedAt: null, so the product simply
// disappears from all lists (documented in docs/contracts.md → Task 7-d).
export const DELETE = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireRole(req, ["STAFF", "ADMIN"]);
    const { id } = await params;

    const deleted = await softDeleteProduct(id);

    await audit({ id: admin.id, name: admin.name }, "PRODUCT_DELETE", "Product", id, {
      name: deleted.name,
      sku: deleted.sku,
      softDelete: true,
    });

    return ok({ ok: true, product: deleted });
  }
);
