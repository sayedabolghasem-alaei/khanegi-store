// Admin shipping method [id] — PATCH partial update, DELETE with a
// referenced-by-orders guard (409 + Persian message + order count → suggest
// deactivation instead, so historical checkout data stays intact).

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, audit, ApiError } from "@/lib/server/api-helpers";
import { shippingMethodInputSchema } from "@/lib/server/shipping-admin";

export const dynamic = "force-dynamic";

export const PATCH = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireRole(req, ["STAFF", "ADMIN"]);
    const { id } = await params;

    const existing = await db.shippingMethod.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "SHIPPING_NOT_FOUND", "روش ارسال مورد نظر یافت نشد.");
    }

    const body = shippingMethodInputSchema.partial().parse(await req.json());

    const method = await db.shippingMethod.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.costToman !== undefined ? { costToman: body.costToman } : {}),
        ...(body.freeThresholdToman !== undefined
          ? { freeThresholdToman: body.freeThresholdToman ?? null }
          : {}),
        ...(body.estimatedDays !== undefined ? { estimatedDays: body.estimatedDays || null } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });

    await audit({ id: admin.id, name: admin.name }, "SHIPPING_UPDATE", "ShippingMethod", id, {
      name: method.name,
      changes: body,
    });

    return ok({ method });
  }
);

export const DELETE = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireRole(req, ["STAFF", "ADMIN"]);
    const { id } = await params;

    const existing = await db.shippingMethod.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "SHIPPING_NOT_FOUND", "روش ارسال مورد نظر یافت نشد.");
    }

    const ordersCount = await db.order.count({ where: { shippingMethodId: id } });
    if (ordersCount > 0) {
      throw new ApiError(
        409,
        "SHIPPING_IN_USE",
        `این روش ارسال در ${ordersCount.toLocaleString("fa-IR")} سفارش استفاده شده است و قابل حذف نیست؛ می‌توانید آن را غیرفعال کنید.`
      );
    }

    await db.shippingMethod.delete({ where: { id } });

    await audit({ id: admin.id, name: admin.name }, "SHIPPING_DELETE", "ShippingMethod", id, {
      name: existing.name,
    });

    return ok({ ok: true });
  }
);
