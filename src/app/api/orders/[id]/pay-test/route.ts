import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, ApiError, requireUser, audit, randomToken } from "@/lib/server/api-helpers";
import {
  findOrderByIdOrNumber,
  requireOrderAccess,
  toOrderDTO,
  assertTransition,
} from "@/lib/server/orders";

/**
 * TEST payment gateway (clearly labeled): creates a PENDING payment, simulates
 * the provider callback, then marks the payment PAID and confirms the order.
 */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser(req);
    const { id } = await params;
    const order = await findOrderByIdOrNumber(id);
    await requireOrderAccess(order, user);
    const o = order!;

    if (o.status === "CANCELLED") {
      throw new ApiError(409, "ORDER_CANCELLED", "سفارش لغو شده امکان پرداخت ندارد.");
    }
    if (o.paymentStatus === "PAID") {
      throw new ApiError(409, "ALREADY_PAID", "این سفارش قبلاً پرداخت شده است.");
    }

    await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: o.id,
          amountToman: o.totalToman,
          status: "PENDING",
          provider: "TEST",
          authority: `TEST-${randomToken().slice(0, 12)}`,
        },
      });
      // Simulated provider callback → success
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", refId: `TESTPAY-${randomToken().slice(0, 10).toUpperCase()}` },
      });

      const nextStatus = o.status === "PENDING" ? "CONFIRMED" : o.status;
      if (nextStatus !== o.status) {
        assertTransition(o.status, nextStatus);
        await tx.orderStatusHistory.create({
          data: {
            orderId: o.id,
            fromStatus: o.status,
            toStatus: nextStatus,
            note: "پرداخت آزمایشی با موفقیت انجام شد (درگاه تست).",
            changedBy: "سیستم",
          },
        });
      }

      await tx.order.update({
        where: { id: o.id },
        data: { paymentStatus: "PAID", status: nextStatus },
      });
    });

    await audit({ id: user.id, name: user.name }, "PAYMENT_TEST", "Order", o.id, {
      orderNumber: o.orderNumber,
      amountToman: o.totalToman,
      provider: "TEST",
    });

    return ok({ order: toOrderDTO((await findOrderByIdOrNumber(o.id))!) });
  }
);
