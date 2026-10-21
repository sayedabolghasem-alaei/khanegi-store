import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, ApiError, audit } from "@/lib/server/api-helpers";
import { toRuleDTO, ruleAffectedCount } from "@/lib/server/pricing";
import { pricingRulePatchSchema } from "@/lib/validators";
import type { PricingRuleDTO } from "@/lib/types";

export const PATCH = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireRole(req, ["ADMIN"]);
    const { id } = await params;

    const existing = await db.pricingRule.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "RULE_NOT_FOUND", "قاعده قیمت‌گذاری یافت نشد.");

    const body = pricingRulePatchSchema.parse(await req.json());

    const scopeType = body.scopeType ?? existing.scopeType;
    const categoryId =
      body.categoryId !== undefined
        ? body.categoryId
        : scopeType === "CATEGORY"
          ? existing.categoryId
          : null;
    const brandId =
      body.brandId !== undefined
        ? body.brandId
        : scopeType === "BRAND"
          ? existing.brandId
          : null;
    const productId =
      body.productId !== undefined
        ? body.productId
        : scopeType === "PRODUCT"
          ? existing.productId
          : null;

    const rule = await db.pricingRule.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.scopeType !== undefined ? { scopeType: body.scopeType } : {}),
        ...(scopeType === "CATEGORY" ? { categoryId } : { categoryId: null }),
        ...(scopeType === "BRAND" ? { brandId } : { brandId: null }),
        ...(scopeType === "PRODUCT" ? { productId } : { productId: null }),
        ...(body.marginPercent !== undefined ? { marginPercent: body.marginPercent } : {}),
        ...(body.extraCostToman !== undefined ? { extraCostToman: body.extraCostToman } : {}),
        ...(body.roundingStepToman !== undefined
          ? { roundingStepToman: body.roundingStepToman }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    await audit({ id: admin.id, name: admin.name }, "RULE_UPDATE", "PricingRule", rule.id, {
      name: rule.name,
    });

    const dto: PricingRuleDTO = toRuleDTO(rule, await ruleAffectedCount(rule));
    return ok(dto);
  }
);
