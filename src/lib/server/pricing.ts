// Pricing engine — pure core (computePrice, resolveRule) + service (runPricing).
// Formula: proposed = round(costPrice × activeRate × (1 + marginPercent/100) + extraCostToman, step)
// round(x, step) = Math.round(x / step) × step   (half-up)
// Rule precedence: PRODUCT > BRAND > CATEGORY > GLOBAL (active rules only).
// Never silently price with missing/stale rates or manual-priced products.

import { db } from "@/lib/db";
import { MAX_RATE_AGE_DAYS } from "@/lib/constants";
import { audit } from "@/lib/server/api-helpers";
import type { PricingPreviewResponse, PricingPreviewRow, PricingRuleDTO } from "@/lib/types";
import type { PricingRule } from "@prisma/client";

// ─── Pure core ──────────────────────────────────────────────────────────────

export interface ComputePriceInput {
  costPrice: number;
  rate: number;
  marginPercent: number;
  extraCostToman: number;
  roundingStepToman: number;
}

/** cost 520, rate 115000, margin 12, extra 0, step 100000 → 67,000,000 */
export function computePrice(input: ComputePriceInput): number {
  const raw =
    input.costPrice * input.rate * (1 + input.marginPercent / 100) + input.extraCostToman;
  const step = input.roundingStepToman > 0 ? input.roundingStepToman : 1;
  return Math.round(raw / step) * step; // Math.round is half-up for positive values
}

export interface RuleTarget {
  id: string;
  categoryId: string;
  brandId: string;
}

/** PRODUCT > BRAND > CATEGORY > GLOBAL — first active match wins. */
export function resolveRule<T extends Pick<PricingRule, "scopeType" | "categoryId" | "brandId" | "productId" | "isActive">>(
  product: RuleTarget,
  rules: T[]
): T | null {
  const active = rules.filter((r) => r.isActive);
  return (
    active.find((r) => r.scopeType === "PRODUCT" && r.productId === product.id) ??
    active.find((r) => r.scopeType === "BRAND" && r.brandId === product.brandId) ??
    active.find((r) => r.scopeType === "CATEGORY" && r.categoryId === product.categoryId) ??
    active.find((r) => r.scopeType === "GLOBAL") ??
    null
  );
}

export function isRateStale(recordedAt: Date | string, now = new Date()): boolean {
  const t = new Date(recordedAt).getTime();
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > MAX_RATE_AGE_DAYS * 24 * 60 * 60 * 1000;
}

// ─── Service ────────────────────────────────────────────────────────────────

interface EngineProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  priceToman: number;
  originalPriceToman: number | null;
  isActive: boolean;
  isPriceManual: boolean;
  costPrice: number | null;
  costCurrency: string | null;
  categoryId: string;
  brandId: string;
  brandName: string;
}

const SKIP_LABELS: Record<string, string> = {
  MANUAL_PRICE: "قیمت‌گذاری دستی",
  NO_COST: "قیمت تمام‌شده ثبت نشده",
  NO_CURRENCY: "ارز قیمت تمام‌شده نامعتبر",
  MISSING_RATE: "نرخ ارز فعال وجود ندارد",
  STALE_RATE: "نرخ ارز قدیمی است (بیش از ۷ روز)",
  NO_RULE: "قاعده قیمت‌گذاری فعالی یافت نشد",
  INACTIVE: "محصول غیرفعال است",
};

/**
 * Runs the pricing engine. dryRun=true only previews; dryRun=false applies
 * price changes + writes PriceHistory (source PRICING_ENGINE) + audit rows.
 */
export async function runPricing(opts: {
  dryRun: boolean;
  adminId?: string | null;
  adminName?: string | null;
}): Promise<PricingPreviewResponse> {
  const { dryRun } = opts;

  // Active rate per currency (latest recorded wins if multiple are active).
  const rates = await db.exchangeRate.findMany({
    where: { isActive: true },
    orderBy: { recordedAt: "desc" },
  });
  const rateByCurrency = new Map<string, { rateToman: number; recordedAt: Date }>();
  const staleCurrencies: string[] = [];
  for (const r of rates) {
    if (!rateByCurrency.has(r.currency)) {
      rateByCurrency.set(r.currency, { rateToman: r.rateToman, recordedAt: r.recordedAt });
      if (isRateStale(r.recordedAt)) staleCurrencies.push(r.currency);
    }
  }

  const rules = await db.pricingRule.findMany({ where: { isActive: true } });

  const rawProducts = await db.product.findMany({
    where: { isActive: true, deletedAt: null },
    include: { brand: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const products: EngineProduct[] = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    priceToman: p.priceToman,
    originalPriceToman: p.originalPriceToman,
    isActive: p.isActive,
    isPriceManual: p.isPriceManual,
    costPrice: p.costPrice,
    costCurrency: p.costCurrency,
    categoryId: p.categoryId,
    brandId: p.brandId,
    brandName: p.brand.name,
  }));

  const rows: PricingPreviewRow[] = [];
  const appliedRuleIds = new Set<string>();
  const applied: { productId: string; name: string; slug: string; oldPrice: number; newPrice: number; ruleId: string }[] = [];

  for (const p of products) {
    const base = {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      brand: p.brandName,
      costPrice: p.costPrice,
      costCurrency: p.costCurrency,
      currentPriceToman: p.priceToman,
    };

    if (p.isPriceManual) {
      rows.push({ ...base, proposedPriceToman: p.priceToman, changed: false, skipReason: "MANUAL_PRICE" });
      continue;
    }
    if (p.costPrice == null || p.costPrice <= 0) {
      rows.push({ ...base, proposedPriceToman: p.priceToman, changed: false, skipReason: "NO_COST" });
      continue;
    }
    if (!p.costCurrency) {
      rows.push({ ...base, proposedPriceToman: p.priceToman, changed: false, skipReason: "NO_CURRENCY" });
      continue;
    }
    const rate = rateByCurrency.get(p.costCurrency);
    if (!rate) {
      rows.push({ ...base, proposedPriceToman: p.priceToman, changed: false, skipReason: "MISSING_RATE" });
      continue;
    }
    if (isRateStale(rate.recordedAt)) {
      rows.push({ ...base, proposedPriceToman: p.priceToman, changed: false, skipReason: "STALE_RATE" });
      continue;
    }
    const rule = resolveRule(p, rules);
    if (!rule) {
      rows.push({ ...base, proposedPriceToman: p.priceToman, changed: false, skipReason: "NO_RULE" });
      continue;
    }

    const proposed = computePrice({
      costPrice: p.costPrice,
      rate: rate.rateToman,
      marginPercent: rule.marginPercent,
      extraCostToman: rule.extraCostToman,
      roundingStepToman: rule.roundingStepToman,
    });
    const changed = proposed !== p.priceToman;
    rows.push({ ...base, proposedPriceToman: proposed, changed, skipReason: null });
    if (changed) {
      appliedRuleIds.add(rule.id);
      applied.push({
        productId: p.id,
        name: p.name,
        slug: p.slug,
        oldPrice: p.priceToman,
        newPrice: proposed,
        ruleId: rule.id,
      });
    }
  }

  // Deterministic order: actionable rows first, then by name.
  rows.sort((a, b) => {
    if (a.skipReason === null && b.skipReason !== null) return -1;
    if (a.skipReason !== null && b.skipReason === null) return 1;
    if (a.changed !== b.changed) return a.changed ? -1 : 1;
    return a.name.localeCompare(b.name, "fa");
  });

  if (!dryRun && applied.length > 0) {
    for (const a of applied) {
      // Keep originalPrice meaningful: drop it when it no longer exceeds the new price.
      const product = await db.product.findUnique({
        where: { id: a.productId },
        select: { originalPriceToman: true },
      });
      const clearOriginal =
        product?.originalPriceToman != null && product.originalPriceToman <= a.newPrice;

      await db.product.update({
        where: { id: a.productId },
        data: {
          priceToman: a.newPrice,
          ...(clearOriginal ? { originalPriceToman: null } : {}),
        },
      });
      await db.priceHistory.create({
        data: {
          productId: a.productId,
          oldPriceToman: a.oldPrice,
          newPriceToman: a.newPrice,
          reason: "اعمال موتور قیمت‌گذاری بر اساس نرخ ارز و قواعد حاشیه سود",
          source: "PRICING_ENGINE",
          adminId: opts.adminId ?? null,
        },
      });
      await audit(
        { id: opts.adminId ?? null, name: opts.adminName ?? null },
        "PRICE_APPLY",
        "Product",
        a.productId,
        { name: a.name, oldPriceToman: a.oldPrice, newPriceToman: a.newPrice, source: "PRICING_ENGINE" }
      );
    }
  }

  return {
    rows,
    changedCount: dryRun ? applied.length : applied.length,
    skippedCount: rows.filter((r) => r.skipReason !== null).length,
    appliedRuleIds: Array.from(appliedRuleIds),
    staleCurrencies,
  };
}

export { SKIP_LABELS };

// ─── Rule DTO helper (shared by admin rules routes) ─────────────────────────

export function toRuleDTO(
  r: {
    id: string;
    name: string;
    scopeType: string;
    categoryId: string | null;
    brandId: string | null;
    productId: string | null;
    marginPercent: number;
    extraCostToman: number;
    roundingStepToman: number;
    isActive: boolean;
  },
  count: number
): PricingRuleDTO {
  return {
    id: r.id,
    name: r.name,
    scopeType: r.scopeType as PricingRuleDTO["scopeType"],
    categoryId: r.categoryId,
    brandId: r.brandId,
    productId: r.productId,
    marginPercent: r.marginPercent,
    extraCostToman: r.extraCostToman,
    roundingStepToman: r.roundingStepToman,
    isActive: r.isActive,
    affectedCount: count,
  };
}

export async function ruleAffectedCount(rule: {
  scopeType: string;
  categoryId: string | null;
  brandId: string | null;
  productId: string | null;
}): Promise<number> {
  const scopeWhere: Record<string, string> =
    rule.scopeType === "CATEGORY"
      ? { categoryId: rule.categoryId! }
      : rule.scopeType === "BRAND"
        ? { brandId: rule.brandId! }
        : rule.scopeType === "PRODUCT"
          ? { id: rule.productId! }
          : {};
  return db.product.count({ where: { ...scopeWhere, deletedAt: null } });
}
