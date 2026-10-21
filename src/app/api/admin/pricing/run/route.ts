import { NextRequest } from "next/server";
import { ok, handle, requireRole, ApiError, audit } from "@/lib/server/api-helpers";
import { runPricing } from "@/lib/server/pricing";
import { pricingRunSchema } from "@/lib/validators";
import type { PricingPreviewResponse } from "@/lib/types";

/**
 * dryRun=true  → preview only (STAFF/ADMIN).
 * dryRun=false → applies prices (ADMIN only), writes PriceHistory + PRICE_APPLY audits.
 */
export const POST = handle(async (req: NextRequest) => {
  const admin = await requireRole(req, ["STAFF", "ADMIN"]);
  const body = pricingRunSchema.parse(await req.json().catch(() => ({})));

  if (!body.dryRun && admin.role !== "ADMIN") {
    throw new ApiError(403, "FORBIDDEN", "اعمال قیمت‌گذاری فقط توسط مدیر سیستم مجاز است.");
  }

  const result: PricingPreviewResponse = await runPricing({
    dryRun: body.dryRun,
    adminId: admin.id,
    adminName: admin.name,
  });

  if (!body.dryRun) {
    await audit({ id: admin.id, name: admin.name }, "PRICE_APPLY", "PricingEngine", null, {
      changedCount: result.changedCount,
      skippedCount: result.skippedCount,
      staleCurrencies: result.staleCurrencies,
    });
  }

  return ok(result);
});
