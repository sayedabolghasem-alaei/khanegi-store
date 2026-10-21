import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  ok,
  handle,
  ApiError,
  getSessionUser,
  ensureCart,
  setCartCookie,
} from "@/lib/server/api-helpers";
import { MAX_QTY_PER_LINE } from "@/lib/constants";
import { buildCartPayload, unitPriceOf } from "@/lib/server/catalog";
import { cartAddSchema, cartUpdateSchema } from "@/lib/validators";
import type { ProductVariant } from "@prisma/client";

/** Resolves the acting cart: user cart when logged in, cookie-token guest cart otherwise. */
async function resolveCart(req: NextRequest) {
  const user = await getSessionUser(req);
  if (user) {
    const { cart } = await ensureCart(req, user.id);
    return { cart, userId: user.id as string | undefined };
  }
  const { cart, newToken } = await ensureCart(req);
  return { cart, userId: undefined, newToken };
}

function withCookie(res: ReturnType<typeof ok>, newToken?: string | null) {
  if (newToken) setCartCookie(res, newToken);
  return res;
}

export const GET = handle(async (req: NextRequest) => {
  const { cart, newToken } = await resolveCart(req);
  const payload = await buildCartPayload(cart.id);
  return withCookie(ok(payload), newToken);
});

export const POST = handle(async (req: NextRequest) => {
  const body = cartAddSchema.parse(await req.json());
  const { cart, newToken } = await resolveCart(req);

  const product = await db.product.findUnique({
    where: { id: body.productId },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  if (!product || !product.isActive) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "محصول مورد نظر یافت نشد یا فعال نیست.");
  }

  let variant: ProductVariant | null = null;
  if (body.variantId) {
    variant = await db.productVariant.findUnique({ where: { id: body.variantId } });
    if (!variant || variant.productId !== product.id || !variant.isActive) {
      throw new ApiError(404, "VARIANT_NOT_FOUND", "تنوع انتخابی برای این محصول معتبر نیست.");
    }
  }

  const maxQuantity = Math.min(product.stock, MAX_QTY_PER_LINE);
  if (product.stock <= 0 || maxQuantity <= 0) {
    throw new ApiError(409, "OUT_OF_STOCK", `موجودی «${product.name}» به پایان رسیده است.`);
  }

  const requested = body.quantity ?? 1;
  const existing = await db.cartItem.findFirst({
    where: { cartId: cart.id, productId: product.id, variantId: variant?.id ?? null },
  });
  const currentQty = existing?.quantity ?? 0;
  const target = currentQty + requested;

  if (target > maxQuantity) {
    throw new ApiError(
      409,
      "MAX_QUANTITY",
      `حداکثر تعداد قابل سفارش برای «${product.name}» ${Math.min(maxQuantity, MAX_QTY_PER_LINE)} عدد است.`
    );
  }

  if (existing) {
    await db.cartItem.update({ where: { id: existing.id }, data: { quantity: target } });
  } else {
    await db.cartItem.create({
      data: { cartId: cart.id, productId: product.id, variantId: variant?.id ?? null, quantity: target },
    });
  }

  const payload = await buildCartPayload(cart.id);
  return withCookie(ok(payload), newToken);
});

export const PATCH = handle(async (req: NextRequest) => {
  const body = cartUpdateSchema.parse(await req.json());
  const { cart, newToken } = await resolveCart(req);

  const item = await db.cartItem.findUnique({
    where: { id: body.itemId },
    include: { product: true, variant: true },
  });
  if (!item || item.cartId !== cart.id) {
    throw new ApiError(404, "ITEM_NOT_FOUND", "این قلم در سبد خرید شما یافت نشد.");
  }

  if (body.quantity === 0) {
    await db.cartItem.delete({ where: { id: item.id } });
  } else {
    const p = item.product;
    if (!p || !p.isActive || p.stock <= 0) {
      // silently drop dead lines
      await db.cartItem.delete({ where: { id: item.id } });
    } else {
      const maxQuantity = Math.min(p.stock, MAX_QTY_PER_LINE);
      if (body.quantity > maxQuantity) {
        throw new ApiError(
          409,
          "MAX_QUANTITY",
          `حداکثر تعداد قابل سفارش برای «${p.name}» ${maxQuantity} عدد است.`
        );
      }
      await db.cartItem.update({ where: { id: item.id }, data: { quantity: body.quantity } });
    }
  }

  const payload = await buildCartPayload(cart.id);
  return withCookie(ok(payload), newToken);
});

export const DELETE = handle(async (req: NextRequest) => {
  const { cart, newToken } = await resolveCart(req);
  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  const payload = await buildCartPayload(cart.id);
  return withCookie(ok(payload), newToken);
});
