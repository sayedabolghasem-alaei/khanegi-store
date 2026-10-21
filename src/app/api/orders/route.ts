import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireUser, audit } from "@/lib/server/api-helpers";
import { createOrderFromCheckout, toOrderDTO } from "@/lib/server/orders";
import { orderCreateSchema } from "@/lib/validators";

export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      shippingMethod: true,
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  return ok(orders.map(toOrderDTO));
});

/**
 * Checkout. Server recomputes ALL money figures (unit prices, coupon, shipping,
 * totals) from the DB — client-submitted values are never trusted.
 */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const body = orderCreateSchema.parse(await req.json());

  const order = await createOrderFromCheckout(user, {
    addressId: body.addressId,
    address: body.address,
    shippingMethodId: body.shippingMethodId,
    couponCode: body.couponCode,
    note: body.note,
  });

  await audit({ id: user.id, name: user.name }, "ORDER_CREATE", "Order", order.id, {
    orderNumber: order.orderNumber,
    totalToman: order.totalToman,
  });

  return ok({ order }, 201);
});
