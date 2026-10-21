import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, ApiError, audit } from "@/lib/server/api-helpers";
import { toCouponDTO } from "@/lib/server/coupons-admin";
import { couponCreateSchema } from "@/lib/validators";
import type { CouponDTO } from "@/lib/types";

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["STAFF", "ADMIN"]);
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return ok(coupons.map(toCouponDTO));
});

export const POST = handle(async (req: NextRequest) => {
  const admin = await requireRole(req, ["STAFF", "ADMIN"]);
  const body = couponCreateSchema.parse(await req.json());

  const existing = await db.coupon.findUnique({ where: { code: body.code } });
  if (existing) throw new ApiError(409, "COUPON_EXISTS", "این کد تخفیف قبلاً ثبت شده است.");

  const parseDate = (v?: string) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null);

  const coupon = await db.coupon.create({
    data: {
      code: body.code,
      type: body.type,
      value: body.value,
      minOrderToman: body.minOrderToman ?? null,
      maxDiscountToman: body.maxDiscountToman ?? null,
      usageLimit: body.usageLimit ?? null,
      validFrom: parseDate(body.validFrom),
      validUntil: parseDate(body.validUntil),
      isActive: body.isActive ?? true,
    },
  });

  await audit({ id: admin.id, name: admin.name }, "COUPON_CREATE", "Coupon", coupon.id, {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
  });

  return ok(toCouponDTO(coupon), 201);
});
