// Admin sales reports — pure bucketing/summaries + DB-backed queries.
// All money = integer Toman. Buckets are UTC ISO strings (day/week/month);
// Persian labels are rendered client-side via the shared Jalali formatters.
// SERVER-ONLY — imports the Prisma client; never import from client code.

import { db } from "@/lib/db";
import { ApiError } from "@/lib/server/api-helpers";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReportGranularity = "day" | "week" | "month";

export interface SalesSeriesPoint {
  bucketISO: string; // day: YYYY-MM-DD · week: Monday ISO · month: YYYY-MM-01
  ordersCount: number;
  revenueToman: number;
}

export interface SalesSummary {
  /** Non-cancelled orders in range (the ones behind the monetary sums). */
  ordersCount: number;
  /** Sum of subtotals (قبل از تخفیف و ارسال). */
  grossSalesToman: number;
  discountsToman: number;
  shippingToman: number;
  /** Sum of order totals (خالص درآمد). */
  netRevenueToman: number;
  paidCount: number;
  cancelledCount: number;
  /** Users with role CUSTOMER registered in range. */
  newCustomers: number;
  /** netRevenueToman / ordersCount, rounded; 0 when no orders. */
  avgOrderToman: number;
}

export interface TopProductRow {
  productId: string | null;
  productName: string;
  quantitySold: number;
  revenueToman: number;
}

export interface LowStockRow {
  id: string;
  name: string;
  slug: string;
  stock: number;
  lowStockThreshold: number;
}

export interface AdminReportsPayload {
  from: string; // YYYY-MM-DD (inclusive, echoed back)
  to: string; // YYYY-MM-DD (inclusive, echoed back)
  granularity: ReportGranularity;
  summary: SalesSummary;
  series: SalesSeriesPoint[];
  topProducts: TopProductRow[];
  lowStock: LowStockRow[];
}

// ─── Pure: range parsing & validation ───────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_RANGE_DAYS = 366;

export function isISODateStr(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function isoDayUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  return isoDayUTC(new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + days * DAY_MS));
}

/**
 * Parses optional from/to (YYYY-MM-DD, inclusive) into a half-open UTC window
 * [fromStart, toExclusive). Defaults to the last 30 days (incl. today).
 * Throws Persian 400 ApiError on invalid/inverted/too-long ranges.
 */
export function parseReportRange(fromStr?: string | null, toStr?: string | null): {
  from: string;
  to: string;
  fromStart: Date;
  toExclusive: Date;
} {
  const today = isoDayUTC(new Date());
  const from = fromStr ? fromStr.trim() : addDaysISO(today, -29);
  const to = toStr ? toStr.trim() : today;

  if (!isISODateStr(from) || !isISODateStr(to)) {
    throw new ApiError(
      400,
      "RANGE_INVALID",
      "تاریخ‌ها را در قالب میلادی YYYY-MM-DD و معتبر وارد کنید."
    );
  }
  if (from > to) {
    throw new ApiError(400, "RANGE_INVALID", "تاریخ شروع بازه نمی‌تواند بعد از تاریخ پایان باشد.");
  }
  const fromStart = new Date(`${from}T00:00:00.000Z`);
  const toExclusive = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + DAY_MS);
  if (toExclusive.getTime() - fromStart.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw new ApiError(
      400,
      "RANGE_TOO_LONG",
      `حداکثر بازه گزارش ۳۶۶ روز است. بازه کوتاه‌تری انتخاب کنید.`
    );
  }
  return { from, to, fromStart, toExclusive };
}

export function parseGranularity(v: string | null): ReportGranularity {
  if (v === "day" || v === "week" || v === "month") return v;
  if (v === null || v === "") return "day";
  throw new ApiError(
    400,
    "GRANULARITY_INVALID",
    "دانه‌بندی نمودار باید «day»، «week» یا «month» باشد."
  );
}

// ─── Pure: bucketing (UTC ISO) ──────────────────────────────────────────────

/** UTC bucket key for a timestamp: calendar day / Monday-start week / month. */
export function bucketKeyUTC(d: Date, g: ReportGranularity): string {
  const iso = d.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  if (g === "day") return iso.slice(0, 10);
  if (g === "month") return `${iso.slice(0, 7)}-01`;
  // week — Monday start (ISO)
  const day = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  const shift = (day.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return addDaysISO(iso.slice(0, 10), -shift);
}

function bucketStep(key: string, g: ReportGranularity): string {
  if (g === "day") return addDaysISO(key, 1);
  if (g === "week") return addDaysISO(key, 7);
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  return `${m === 12 ? y + 1 : y}-${m === 12 ? "01" : String(m + 1).padStart(2, "0")}-01`;
}

/** All bucket keys covering [fromStart, toExclusive) — zero-filled series. */
export function buildBuckets(fromStart: Date, toExclusive: Date, g: ReportGranularity): string[] {
  const buckets: string[] = [];
  let cursor = bucketKeyUTC(fromStart, g);
  const end = toExclusive.getTime();
  // Guard against runaway loops (valid ranges are ≤ 366 days anyway).
  while (buckets.length < 400) {
    const cursorStart = new Date(`${cursor}T00:00:00.000Z`).getTime();
    if (cursorStart >= end) break;
    buckets.push(cursor);
    cursor = bucketStep(cursor, g);
  }
  return buckets;
}

export function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const frac = v / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * base;
}

// ─── DB-backed reports ──────────────────────────────────────────────────────

/** Revenue/order-count time series over [from, to) buckets. Cancelled excluded. */
export async function salesSeries(input: {
  fromStart: Date;
  toExclusive: Date;
  granularity: ReportGranularity;
}): Promise<SalesSeriesPoint[]> {
  const { fromStart, toExclusive, granularity } = input;
  const orders = await db.order.findMany({
    where: { createdAt: { gte: fromStart, lt: toExclusive }, status: { not: "CANCELLED" } },
    select: { createdAt: true, totalToman: true },
  });

  const acc = new Map<string, { ordersCount: number; revenueToman: number }>();
  for (const o of orders) {
    const key = bucketKeyUTC(o.createdAt, granularity);
    const cur = acc.get(key) ?? { ordersCount: 0, revenueToman: 0 };
    cur.ordersCount += 1;
    cur.revenueToman += o.totalToman;
    acc.set(key, cur);
  }
  return buildBuckets(fromStart, toExclusive, granularity).map((bucketISO) => ({
    bucketISO,
    ordersCount: acc.get(bucketISO)?.ordersCount ?? 0,
    revenueToman: acc.get(bucketISO)?.revenueToman ?? 0,
  }));
}

export async function salesSummary(input: {
  fromStart: Date;
  toExclusive: Date;
}): Promise<SalesSummary> {
  const range = { createdAt: { gte: input.fromStart, lt: input.toExclusive } };
  const [agg, paidCount, cancelledCount, newCustomers] = await Promise.all([
    db.order.aggregate({
      where: { ...range, status: { not: "CANCELLED" } },
      _count: { _all: true },
      _sum: {
        subtotalToman: true,
        discountToman: true,
        shippingCostToman: true,
        totalToman: true,
      },
    }),
    db.order.count({ where: { ...range, paymentStatus: "PAID" } }),
    db.order.count({ where: { ...range, status: "CANCELLED" } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: range.createdAt } }),
  ]);

  const ordersCount = agg._count._all;
  const netRevenueToman = agg._sum.totalToman ?? 0;
  return {
    ordersCount,
    grossSalesToman: agg._sum.subtotalToman ?? 0,
    discountsToman: agg._sum.discountToman ?? 0,
    shippingToman: agg._sum.shippingCostToman ?? 0,
    netRevenueToman,
    paidCount,
    cancelledCount,
    newCustomers,
    avgOrderToman: ordersCount > 0 ? Math.round(netRevenueToman / ordersCount) : 0,
  };
}

/** Best-selling products in range (cancelled orders excluded), by revenue. */
export async function topProducts(input: {
  fromStart: Date;
  toExclusive: Date;
  limit?: number;
}): Promise<TopProductRow[]> {
  const limit = input.limit ?? 8;
  const items = await db.orderItem.findMany({
    where: {
      order: { createdAt: { gte: input.fromStart, lt: input.toExclusive }, status: { not: "CANCELLED" } },
    },
    select: { productId: true, productName: true, quantity: true, lineTotalToman: true },
  });

  const acc = new Map<string, TopProductRow>();
  for (const it of items) {
    const key = `${it.productId ?? "—"}::${it.productName}`;
    const cur =
      acc.get(key) ??
      { productId: it.productId, productName: it.productName, quantitySold: 0, revenueToman: 0 };
    cur.quantitySold += it.quantity;
    cur.revenueToman += it.lineTotalToman;
    acc.set(key, cur);
  }
  return [...acc.values()]
    .sort((a, b) => b.revenueToman - a.revenueToman || b.quantitySold - a.quantitySold)
    .slice(0, limit);
}

/** Active, non-deleted products at/below their low-stock threshold, stock asc. */
export async function lowStockProducts(limit = 10): Promise<LowStockRow[]> {
  // SQLite cannot compare two columns in the query — over-fetch then filter.
  const rows = await db.product.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { stock: "asc" },
    take: limit * 6,
    select: { id: true, name: true, slug: true, stock: true, lowStockThreshold: true },
  });
  return rows.filter((p) => p.stock <= p.lowStockThreshold).slice(0, limit);
}

/** Full single-payload report for GET /api/admin/reports. */
export async function buildAdminReports(input: {
  from?: string | null;
  to?: string | null;
  granularity?: string | null;
  topLimit?: number;
  lowStockLimit?: number;
}): Promise<AdminReportsPayload> {
  const granularity = parseGranularity(input.granularity ?? null);
  const { from, to, fromStart, toExclusive } = parseReportRange(input.from, input.to);

  const [summary, series, topProductsRows, lowStock] = await Promise.all([
    salesSummary({ fromStart, toExclusive }),
    salesSeries({ fromStart, toExclusive, granularity }),
    topProducts({ fromStart, toExclusive, limit: input.topLimit ?? 8 }),
    lowStockProducts(input.lowStockLimit ?? 10),
  ]);

  return { from, to, granularity, summary, series, topProducts: topProductsRows, lowStock };
}
