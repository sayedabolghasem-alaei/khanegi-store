// Order service: DTO mapping, order-number generation, checkout recomputation,
// atomic stock decrement in a single $transaction, status transitions, cancellations.

import { db } from "@/lib/db";
import { ApiError } from "@/lib/server/api-helpers";
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  MAX_QTY_PER_LINE,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
} from "@/lib/constants";
import { checkCoupon } from "@/lib/server/catalog";
import type {
  Order,
  OrderItem,
  OrderStatusHistory,
  Payment,
  ShippingMethod,
} from "@prisma/client";
import type { OrderDTO, OrderStatus, PaymentStatus, Role } from "@/lib/types";

// ─── Order number (Jalali date + random suffix) ─────────────────────────────

function jalaliParts(d: Date): { y: number; m: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), day: get("day") };
}

export function generateOrderNumber(): string {
  const { y, m, day } = jalaliParts(new Date());
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ARI-${y}${String(m).padStart(2, "0")}${String(day).padStart(2, "0")}-${rand}`;
}

// ─── DTO mapping ────────────────────────────────────────────────────────────

type OrderWithRelations = Order & {
  shippingMethod: ShippingMethod | null;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
  payments: Payment[];
};

export function toOrderDTO(order: OrderWithRelations): OrderDTO {
  let address: Record<string, string> = {};
  try {
    address = JSON.parse(order.shippingAddress) as Record<string, string>;
  } catch {
    address = {};
  }
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as OrderStatus,
    paymentStatus: order.paymentStatus as PaymentStatus,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    shippingAddress: {
      receiverName: address.receiverName ?? order.customerName,
      phone: address.phone ?? order.customerPhone,
      province: address.province ?? "",
      city: address.city ?? "",
      postalCode: address.postalCode ?? "",
      line: address.line ?? "",
    },
    shippingMethod: order.shippingMethod
      ? {
          id: order.shippingMethod.id,
          name: order.shippingMethod.name,
          costToman: order.shippingMethod.costToman,
        }
      : null,
    shippingCostToman: order.shippingCostToman,
    subtotalToman: order.subtotalToman,
    discountToman: order.discountToman,
    totalToman: order.totalToman,
    couponCode: order.couponCode,
    paymentProvider: order.paymentProvider,
    note: order.note,
    adminNote: order.adminNote,
    trackingCode: order.trackingCode,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      productSlug: i.productSlug,
      productSku: i.productSku,
      variantText: i.variantText,
      image: i.image,
      unitPriceToman: i.unitPriceToman,
      originalPriceToman: i.originalPriceToman,
      quantity: i.quantity,
      lineTotalToman: i.lineTotalToman,
    })),
    statusHistory: order.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: (h.fromStatus ?? null) as OrderStatus | null,
      toStatus: h.toStatus as OrderStatus,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
    payments: order.payments.map((p) => ({
      id: p.id,
      amountToman: p.amountToman,
      status: p.status as PaymentStatus,
      provider: p.provider,
      refId: p.refId,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

const orderInclude = {
  shippingMethod: true,
  items: true, // OrderItem has no createdAt — insertion order preserved
  statusHistory: { orderBy: { createdAt: "asc" as const } },
  payments: { orderBy: { createdAt: "asc" as const } },
};

export async function findOrderByIdOrNumber(idOrNumber: string): Promise<OrderWithRelations | null> {
  return db.order.findFirst({
    where: { OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
    include: orderInclude,
  });
}

/** Owner or STAFF/ADMIN — throws 403/404. */
export async function requireOrderAccess(
  order: OrderWithRelations | null,
  user: { id: string; role: string }
): Promise<OrderWithRelations> {
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "سفارش مورد نظر یافت نشد.");
  const isStaff = user.role === "STAFF" || user.role === "ADMIN";
  if (order.userId !== user.id && !isStaff) {
    throw new ApiError(403, "FORBIDDEN", "شما به این سفارش دسترسی ندارید.");
  }
  return order;
}

// ─── Checkout: everything recomputed from DB, never trusted from client ─────

export interface CheckoutInput {
  addressId?: string;
  address?: {
    title?: string;
    receiverName: string;
    phone: string;
    province: string;
    city: string;
    postalCode: string;
    line: string;
  };
  shippingMethodId: string;
  couponCode?: string;
  note?: string;
}

export async function createOrderFromCheckout(
  user: { id: string; name: string },
  input: CheckoutInput
): Promise<OrderDTO> {
  const cart = await db.cart.findUnique({
    where: { userId: user.id },
    include: {
      items: {
        include: { product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } }, variant: true },
      },
    },
  });
  const lines = (cart?.items ?? []).filter((i) => i.product && i.product.isActive);
  if (lines.length === 0) {
    throw new ApiError(400, "EMPTY_CART", "سبد خرید شما خالی است.");
  }

  // Address snapshot (from saved address or inline) — always re-read server-side.
  let snapshot: {
    title?: string;
    receiverName: string;
    phone: string;
    province: string;
    city: string;
    postalCode: string;
    line: string;
  };
  if (input.addressId) {
    const a = await db.address.findFirst({ where: { id: input.addressId, userId: user.id } });
    if (!a) throw new ApiError(404, "ADDRESS_NOT_FOUND", "آدرس انتخابی یافت نشد.");
    snapshot = a;
  } else if (input.address) {
    snapshot = input.address;
  } else {
    throw new ApiError(400, "ADDRESS_REQUIRED", "آدرس تحویل سفارش را مشخص کنید.");
  }

  const shippingMethod = await db.shippingMethod.findFirst({
    where: { id: input.shippingMethodId, isActive: true },
  });
  if (!shippingMethod) {
    throw new ApiError(400, "SHIPPING_INVALID", "روش ارسال انتخابی معتبر نیست.");
  }

  // Server-computed prices (product.priceToman + variant extra).
  const priced = lines.map((l) => {
    const unit = l.product.priceToman + (l.variant?.extraPriceToman ?? 0);
    const qty = Math.min(l.quantity, MAX_QTY_PER_LINE); // defensive cap; stock checked atomically
    return { line: l, unit, qty, total: unit * qty };
  });
  const subtotalToman = priced.reduce((s, p) => s + p.total, 0);

  // Coupon — recomputed server-side.
  let discountToman = 0;
  let couponRow: { id: string; code: string } | null = null;
  if (input.couponCode) {
    const result = await checkCoupon(input.couponCode, subtotalToman);
    if (!result.ok) throw new ApiError(400, "COUPON_INVALID", result.message);
    discountToman = result.coupon.discountToman;
    couponRow = { id: result.coupon.id, code: result.coupon.code };
  }

  const shippingCostToman =
    shippingMethod.freeThresholdToman != null && subtotalToman >= shippingMethod.freeThresholdToman
      ? 0
      : shippingMethod.costToman;
  const totalToman = Math.max(0, subtotalToman - discountToman + shippingCostToman);

  // Retrying loop guards against the rare order-number collision.
  let created: OrderWithRelations | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    const orderNumber = generateOrderNumber();
    try {
      created = await db.$transaction(async (tx) => {
        for (const p of priced) {
          const upd = await tx.product.updateMany({
            where: { id: p.line.productId, stock: { gte: p.qty } },
            data: { stock: { decrement: p.qty } },
          });
          if (upd.count === 0) {
            throw new ApiError(
              409,
              "OUT_OF_STOCK",
              `متأسفانه موجودی «${p.line.product.name}» کافی نیست. لطفاً سبد خرید را به‌روزرسانی کنید.`
            );
          }
          await tx.product.update({
            where: { id: p.line.productId },
            data: { soldCount: { increment: p.qty } },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: p.line.productId,
              type: "OUT",
              quantity: p.qty,
              reason: "ثبت سفارش",
              refOrderNumber: orderNumber,
            },
          });
        }

        const order = await tx.order.create({
          data: {            orderNumber,
            userId: user.id,
            status: "PENDING",
            paymentStatus: "UNPAID",
            customerName: snapshot.receiverName,
            customerPhone: snapshot.phone,
            shippingAddress: JSON.stringify(snapshot),
            shippingMethodId: shippingMethod.id,
            shippingCostToman,
            subtotalToman,
            discountToman,
            totalToman,
            couponCode: couponRow?.code ?? null,
            paymentProvider: "TEST",
            note: input.note ?? null,
            items: {
              create: priced.map((p) => ({
                productId: p.line.productId,
                productName: p.line.product.name,
                productSlug: p.line.product.slug,
                productSku: p.line.product.sku,
                variantText: p.line.variant ? `${p.line.variant.name}: ${p.line.variant.value}` : null,
                image: p.line.product.images[0]?.url ?? null,
                unitPriceToman: p.unit,
                originalPriceToman: p.line.product.originalPriceToman ?? null,
                quantity: p.qty,
                lineTotalToman: p.total,
              })),
            },
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: "PENDING",
                note: "ثبت سفارش",
                changedBy: user.name,
              },
            },
            ...(couponRow
              ? {
                  redemptions: {
                    create: {
                      couponId: couponRow.id,
                      userId: user.id,
                      amountToman: discountToman,
                    },
                  },
                }
              : {}),
          },
        });

        if (couponRow) {
          await tx.coupon.update({ where: { id: couponRow.id }, data: { timesUsed: { increment: 1 } } });
        }
        // Re-fetch with full relations (create+include does not support nested orderBy).
        return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
      });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "P2002" && attempt < 2) continue; // orderNumber collision → retry
      throw err;
    }
  }

  if (!created) throw new ApiError(500, "INTERNAL", "خطا در ثبت سفارش. لطفاً دوباره تلاش کنید.");

  // Empty the cart after successful checkout.
  if (cart) await db.cartItem.deleteMany({ where: { cartId: cart.id } });

  return toOrderDTO(created);
}

// ─── Status transitions ─────────────────────────────────────────────────────

export function assertTransition(from: string, to: string): void {
  const allowed = ORDER_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ApiError(
      409,
      "INVALID_TRANSITION",
      `تغییر وضعیت سفارش از «${ORDER_STATUS_LABELS[from] ?? from}» به «${ORDER_STATUS_LABELS[to] ?? to}» مجاز نیست.`
    );
  }
}

/** Restores stock for a cancelled order (IN movements) inside the given transaction client. */
export async function restoreOrderStock(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  orderId: string,
  reason: string,
  orderNumber: string,
  adminId?: string | null
) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (!item.productId) continue;
    await tx.product
      .update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } })
      .catch(() => undefined); // product may have been deleted — snapshot survives
    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        type: "IN",
        quantity: item.quantity,
        reason,
        refOrderNumber: orderNumber,
        adminId: adminId ?? null,
      },
    });
  }
}

export function canCustomerCancel(status: string): boolean {
  return CUSTOMER_CANCELLABLE_STATUSES.includes(status);
}

export function roleIsStaff(role: string): boolean {
  return role === "STAFF" || role === "ADMIN";
}

export type { Role };
