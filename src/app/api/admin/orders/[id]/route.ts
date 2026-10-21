import { NextRequest } from "next/server";
import { ok, handle, requireRole, ApiError, audit } from "@/lib/server/api-helpers";
import { z } from "zod";
import { db } from "@/lib/db";
import { findOrderByIdOrNumber, toOrderDTO } from "@/lib/server/orders";
import { adminOrderPatchSchema } from "@/lib/validators";

// trackingCode: absent → unchanged · null/"" → cleared · string → trimmed, ≤ 60 chars.
const trackingCodeSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(60, "کد رهگیری حداکثر ۶۰ کاراکتر است.").nullable().optional()
);

export const GET = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireRole(req, ["STAFF", "ADMIN"]);
    const { id } = await params;
    const order = await findOrderByIdOrNumber(id);
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "سفارش مورد نظر یافت نشد.");
    return ok({ order: toOrderDTO(order) });
  }
);

export const PATCH = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireRole(req, ["STAFF", "ADMIN"]);
    const { id } = await params;
    const order = await findOrderByIdOrNumber(id);
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "سفارش مورد نظر یافت نشد.");

    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const body = adminOrderPatchSchema.parse(raw);
    const trackingCode = trackingCodeSchema.parse(raw.trackingCode);

    // Partial PATCH semantics: only apply the fields actually sent.
    const data: { adminNote?: string | null; trackingCode?: string | null } = {};
    if ("adminNote" in raw) data.adminNote = body.adminNote ?? null;
    if (trackingCode !== undefined) data.trackingCode = trackingCode;
    if (Object.keys(data).length === 0) {
      throw new ApiError(400, "NOTHING_TO_UPDATE", "فیلدی برای به‌روزرسانی ارسال نشده است.");
    }

    await db.order.update({ where: { id: order.id }, data });

    if (data.trackingCode !== undefined && data.trackingCode !== (order.trackingCode ?? null)) {
      await audit({ id: admin.id, name: admin.name }, "TRACKING_SET", "Order", order.id, {
        orderNumber: order.orderNumber,
        trackingCode: data.trackingCode,
      });
    }

    const updated = await findOrderByIdOrNumber(order.id);
    return ok({ order: toOrderDTO(updated!) });
  }
);
