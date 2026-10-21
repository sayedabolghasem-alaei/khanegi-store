import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, ApiError, audit } from "@/lib/server/api-helpers";
import {
  findOrderByIdOrNumber,
  toOrderDTO,
  assertTransition,
  restoreOrderStock,
} from "@/lib/server/orders";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { orderStatusSchema } from "@/lib/validators";

export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireRole(req, ["STAFF", "ADMIN"]);
    const { id } = await params;
    const order = await findOrderByIdOrNumber(id);
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "سفارش مورد نظر یافت نشد.");
    const o = order;

    const body = orderStatusSchema.parse(await req.json());
    if (body.status === o.status) {
      throw new ApiError(409, "SAME_STATUS", "وضعیت سفارش از قبل همین است.");
    }
    assertTransition(o.status, body.status);

    await db.$transaction(async (tx) => {
      if (body.status === "CANCELLED") {
        await restoreOrderStock(tx, o.id, "لغو سفارش توسط مدیر", o.orderNumber, admin.id);
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: o.id,
          fromStatus: o.status,
          toStatus: body.status,
          note: body.note ?? `تغییر وضعیت به «${ORDER_STATUS_LABELS[body.status] ?? body.status}»`,
          changedBy: admin.name,
        },
      });
      await tx.order.update({
        where: { id: o.id },
        data: {
          status: body.status,
          ...(body.status === "CANCELLED" && o.paymentStatus === "PAID"
            ? { paymentStatus: "REFUNDED" }
            : {}),
        },
      });
    });

    await audit({ id: admin.id, name: admin.name }, "ORDER_STATUS_CHANGE", "Order", o.id, {
      orderNumber: o.orderNumber,
      from: o.status,
      to: body.status,
      note: body.note ?? null,
    });

    return ok({ order: toOrderDTO((await findOrderByIdOrNumber(o.id))!) });
  }
);
