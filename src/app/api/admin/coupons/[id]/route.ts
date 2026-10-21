import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, ApiError, audit } from "@/lib/server/api-helpers";
import { toCouponDTO } from "@/lib/server/coupons-admin";
import { couponPatchSchema } from "@/lib/validators";
import type { CouponDTO } from "@/lib/types";

export const PATCH = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireRole(req, ["STAFF", "ADMIN"]);
    const { id } = await params;

    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "COUPON_NOT_FOUND", "کد تخفیف یافت نشد.");

    const body = couponPatchSchema.parse(await req.json());
    const coupon = await db.coupon.update({
      where: { id },
      data: { ...(body.isActive !== undefined ? { isActive: body.isActive } : {}) },
    });

    await audit({ id: admin.id, name: admin.name }, "COUPON_UPDATE", "Coupon", coupon.id, {
      code: coupon.code,
      isActive: coupon.isActive,
    });

    const dto: CouponDTO = toCouponDTO(coupon);
    return ok(dto);
  }
);
