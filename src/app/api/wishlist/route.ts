import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, ApiError, requireUser } from "@/lib/server/api-helpers";
import { toProductCard } from "@/lib/server/catalog";
import type { WishlistPayload } from "@/lib/types";

const wishlistInclude = {
  items: {
    orderBy: { createdAt: "desc" as const },
    include: {
      product: {
        include: {
          brand: { select: { slug: true, name: true, nameEn: true } },
          category: { select: { slug: true, name: true } },
          images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true } },
        },
      },
    },
  },
};

async function getOrCreateWishlist(userId: string) {
  const existing = await db.wishlist.findUnique({ where: { userId }, include: wishlistInclude });
  if (existing) return existing;
  await db.wishlist.create({ data: { userId } });
  const created = await db.wishlist.findUnique({ where: { userId }, include: wishlistInclude });
  return created!;
}

async function payloadFor(userId: string): Promise<WishlistPayload> {
  const wishlist = await getOrCreateWishlist(userId);
  return {
    items: wishlist.items
      .filter((i) => i.product && i.product.isActive)
      .map((i) => toProductCard(i.product)),
  };
}

export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  return ok(await payloadFor(user.id));
});

/** Toggle: adds the product if absent, removes it if present. */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const body = (await req.json()) as { productId?: string };
  if (!body?.productId) {
    throw new ApiError(400, "VALIDATION_ERROR", "شناسه محصول الزامی است.");
  }

  const product = await db.product.findUnique({ where: { id: body.productId } });
  if (!product || !product.isActive) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "محصول مورد نظر یافت نشد یا فعال نیست.");
  }

  const wishlist = await getOrCreateWishlist(user.id);
  const existing = await db.wishlistItem.findUnique({
    where: { wishlistId_productId: { wishlistId: wishlist.id, productId: product.id } },
  });

  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
  } else {
    await db.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId: product.id },
    });
  }

  return ok(await payloadFor(user.id));
});
