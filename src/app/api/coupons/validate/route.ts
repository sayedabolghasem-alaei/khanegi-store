import { NextRequest } from "next/server";
import { ok, handle, rateLimit, clientIp } from "@/lib/server/api-helpers";
import { validateCouponPayload } from "@/lib/server/catalog";
import { couponValidateSchema } from "@/lib/validators";

export const POST = handle(async (req: NextRequest) => {
  rateLimit(clientIp(req) + ":auth", 20, 60000);
  const body = couponValidateSchema.parse(await req.json());
  return ok(await validateCouponPayload(body.code, body.subtotalToman));
});
