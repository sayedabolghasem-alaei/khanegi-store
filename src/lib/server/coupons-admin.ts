// Shared coupon DTO mapper for admin routes (route files must only export handlers).

import type { CouponDTO } from "@/lib/types";

export function toCouponDTO(c: {
  id: string;
  code: string;
  type: string;
  value: number;
  minOrderToman: number | null;
  maxDiscountToman: number | null;
  usageLimit: number | null;
  timesUsed: number;
  validFrom: Date | null;
  validUntil: Date | null;
  isActive: boolean;
}): CouponDTO {
  return {
    id: c.id,
    code: c.code,
    type: c.type as CouponDTO["type"],
    value: c.value,
    minOrderToman: c.minOrderToman,
    maxDiscountToman: c.maxDiscountToman,
    usageLimit: c.usageLimit,
    timesUsed: c.timesUsed,
    validFrom: c.validFrom ? c.validFrom.toISOString() : null,
    validUntil: c.validUntil ? c.validUntil.toISOString() : null,
    isActive: c.isActive,
  };
}
