import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, ApiError, audit } from "@/lib/server/api-helpers";
import { toRuleDTO, ruleAffectedCount } from "@/lib/server/pricing";
import { pricingRuleCreateSchema } from "@/lib/validators";
import type { PricingRuleDTO } from "@/lib/types";

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["STAFF", "ADMIN"]);
  const rules = await db.pricingRule.findMany({ orderBy: { createdAt: "asc" } });
  const payload: PricingRuleDTO[] = await Promise.all(
    rules.map(async (r) => toRuleDTO(r, await ruleAffectedCount(r)))
  );
  return ok(payload);
});

export const POST = handle(async (req: NextRequest) => {
  const admin = await requireRole(req, ["ADMIN"]);
  const body = pricingRuleCreateSchema.parse(await req.json());

  if (body.scopeType === "CATEGORY" && body.categoryId) {
    const c = await db.category.findUnique({ where: { id: body.categoryId }, select: { id: true } });
    if (!c) throw new ApiError(400, "CATEGORY_INVALID", "دسته‌بندی انتخابی معتبر نیست.");
  }
  if (body.scopeType === "BRAND" && body.brandId) {
    const b = await db.brand.findUnique({ where: { id: body.brandId }, select: { id: true } });
    if (!b) throw new ApiError(400, "BRAND_INVALID", "برند انتخابی معتبر نیست.");
  }
  if (body.scopeType === "PRODUCT" && body.productId) {
    const p = await db.product.findUnique({ where: { id: body.productId }, select: { id: true } });
    if (!p) throw new ApiError(400, "PRODUCT_INVALID", "محصول انتخابی معتبر نیست.");
  }

  const rule = await db.pricingRule.create({
    data: {
      name: body.name,
      scopeType: body.scopeType,
      categoryId: body.scopeType === "CATEGORY" ? body.categoryId! : null,
      brandId: body.scopeType === "BRAND" ? body.brandId! : null,
      productId: body.scopeType === "PRODUCT" ? body.productId! : null,
      marginPercent: body.marginPercent,
      extraCostToman: body.extraCostToman ?? 0,
      roundingStepToman: body.roundingStepToman,
      isActive: body.isActive ?? true,
    },
  });

  await audit({ id: admin.id, name: admin.name }, "RULE_CREATE", "PricingRule", rule.id, {
    name: rule.name,
    scopeType: rule.scopeType,
    marginPercent: rule.marginPercent,
  });

  return ok(toRuleDTO(rule, await ruleAffectedCount(rule)), 201);
});
