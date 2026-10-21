import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, ApiError, requireUser, audit } from "@/lib/server/api-helpers";
import {
  findOrderByIdOrNumber,
  requireOrderAccess,
  toOrderDTO,
  canCustomerCancel,
  restoreOrderStock,
  roleIsStaff,
} from "@/lib/server/orders";

/** Customer cancels own order — only while PENDING/CONFIRMED. Restores stock. */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser(req);
    const { id } = await params;
    const order = await findOrderByIdOrNumber(id);
    await requireOrderAccess(order, user);
    const o = order!;

    if (!roleIsStaff(user.role) && !canCustomerCancel(o.status)) {
      throw new ApiError(409, "NOT_CANCELLABLE", "این سفارش در مرحله‌ای است که امکان لغو آن توسط شما وجود ندارد. با پشتیبانی تماس بگیرید.");
    }
    if (o.status === "CANCELLED") {
      throw new ApiError(409, "ALREADY_CANCELLED", "این سفارش قبلاً لغو شده است.");
    }

    await db.$transaction(async (tx) => {
      await restoreOrderStock(tx, o.id, "لغو سفارش توسط مشتری", o.orderNumber, user.id);
      await tx.orderStatusHistory.create({
        data: {
          orderId: o.id,
          fromStatus: o.status,
          toStatus: "CANCELLED",
          note: "لغو سفارش توسط مشتری",
          changedBy: user.name,
        },
      });
      await tx.order.update({
        where: { id: o.id },
        data: {
          status: "CANCELLED",
          ...(o.paymentStatus === "PAID" ? { paymentStatus: "REFUNDED" } : {}),
        },
      });
    });

    await audit({ id: user.id, name: user.name }, "ORDER_CANCEL", "Order", o.id, {
      orderNumber: o.orderNumber,
    });

    return ok({ order: toOrderDTO((await findOrderByIdOrNumber(o.id))!) });
  }
);
