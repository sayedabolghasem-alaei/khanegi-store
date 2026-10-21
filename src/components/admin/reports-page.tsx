"use client";
// Admin sales reports (#/admin/reports) — Task 7-c.
// Range presets + granularity toggle, KPI cards, hand-rolled SVG revenue bar
// chart (no chart deps), top products & low-stock tables, CSV export links.
// Chart ordering is RTL-friendly: oldest bucket at RIGHT, newest at LEFT.

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BarChart3,
  CalendarDays,
  CalendarRange,
  Download,
  Percent,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatNumberFa, formatToman, formatDateShortFa, toFaDigits } from "@/lib/money";
import {
  useAdminReports,
  type AdminReportsPayload,
  type ReportGranularity,
  type SalesSeriesPoint,
} from "@/hooks/use-admin-reports";
import { ErrorState } from "@/components/store/empty-state";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { StockBadge, SkeletonTable } from "@/components/admin/admin-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── Date helpers (UTC ISO strings — buckets are UTC per contract) ─────────

const DAY_MS = 24 * 60 * 60 * 1000;

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoShift(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

type PresetKey = "today" | "7d" | "30d" | "thisMonth" | "lastMonth" | "custom";

const PRESET_LABELS: Record<PresetKey, string> = {
  today: "امروز",
  "7d": "۷ روز",
  "30d": "۳۰ روز",
  thisMonth: "این ماه",
  lastMonth: "ماه گذشته",
  custom: "بازه دلخواه",
};

function presetRange(key: PresetKey): { from: string; to: string } | null {
  const today = isoToday();
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: isoShift(today, -6), to: today };
    case "30d":
      return { from: isoShift(today, -29), to: today };
    case "thisMonth":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "lastMonth": {
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth(); // 0-based
      const firstOfLast = new Date(Date.UTC(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1));
      const lastDay = new Date(Date.UTC(y, m, 1) - DAY_MS).toISOString().slice(0, 10);
      return { from: firstOfLast.toISOString().slice(0, 10), to: lastDay };
    }
    default:
      return null; // custom — handled by inputs
  }
}

const GRANULARITY_LABELS: Record<ReportGranularity, string> = {
  day: "روزانه",
  week: "هفتگی",
  month: "ماهانه",
};

/** Persian label for a bucket — Jalali via the shared formatter. */
const faMonthYear = new Intl.DateTimeFormat("fa-IR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
function bucketLabelFa(iso: string, g: ReportGranularity): string {
  try {
    if (g === "month") return faMonthYear.format(new Date(`${iso}T00:00:00.000Z`));
    return formatDateShortFa(`${iso}T00:00:00.000Z`);
  } catch {
    return iso;
  }
}

/** Compact Persian money for axis ticks: 92,700,000 → ۹۲٫۷ م */
function trimNumFa(x: number): string {
  const s = x >= 100 ? String(Math.round(x)) : x.toFixed(1).replace(/\.0$/, "");
  return toFaDigits(s.replace(".", "٫"));
}
function compactTomanFa(v: number): string {
  if (v >= 1e9) return `${trimNumFa(v / 1e9)} میلیارد`;
  if (v >= 1e6) return `${trimNumFa(v / 1e6)} م`;
  if (v >= 1e3) return `${trimNumFa(v / 1e3)} هـ`;
  return toFaDigits(String(v));
}

// ─── KPI card (reports-local, same visual language as overview) ────────────

function KpiCard({
  title,
  value,
  icon: Icon,
  tone,
  sub,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone: "navy" | "teal" | "emerald" | "amber" | "rose";
  sub?: string;
}) {
  const toneMap = {
    navy: "bg-primary text-primary-foreground",
    teal: "bg-highlight-soft text-highlight",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  } as const;
  return (
    <Card className="rounded-xl">
      <CardContent className="flex items-center gap-4 p-5">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${toneMap[tone]}`}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted-foreground">{title}</p>
          <p className="mt-1 truncate text-lg font-extrabold tabular-fa">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Hand-rolled SVG bar chart (newest bucket at LEFT for RTL) ──────────────

const CHART_W = 800;
const CHART_H = 264; // 220 plot + 14 top + 30 bottom
const PAD = { top: 14, bottom: 30, left: 8, right: 68 };
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const frac = v / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * base;
}

function RevenueBarChart({
  series,
  granularity,
}: {
  series: SalesSeriesPoint[];
  granularity: ReportGranularity;
}) {
  const n = series.length;
  const maxRevenue = useMemo(
    () => series.reduce((m, s) => Math.max(m, s.revenueToman), 0),
    [series]
  );
  const isEmpty = n === 0 || maxRevenue === 0;
  const yMax = niceCeil(maxRevenue);
  const plotW = CHART_W - PAD.left - PAD.right;
  const slotW = n > 0 ? plotW / n : plotW;
  const barW = Math.min(slotW * 0.62, 52);
  const labelEvery = Math.max(1, Math.ceil(n / 12));

  return (
    <div dir="ltr">
      {isEmpty ? (
        <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/20">
          <p className="text-sm text-muted-foreground">داده‌ای برای این بازه نیست</p>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label={`نمودار میله‌ای درآمد با دانه‌بندی ${GRANULARITY_LABELS[granularity]}`}
        >
          {/* horizontal grid + y ticks (right side — RTL start) */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = PAD.top + PLOT_H - f * PLOT_H;
            return (
              <g key={f}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + plotW}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth={f === 0 ? 1.5 : 1}
                  strokeDasharray={f === 0 ? undefined : "4 4"}
                />
                <text
                  x={PAD.left + plotW + 10}
                  y={y + 4}
                  fontSize={11}
                  fill="currentColor"
                  className="text-muted-foreground"
                  textAnchor="start"
                >
                  {compactTomanFa(yMax * f)}
                </text>
              </g>
            );
          })}

          {/* bars — series[0] is the OLDEST bucket → drawn at the RIGHT */}
          {series.map((s, i) => {
            const slot = n - 1 - i;
            const h = Math.max((s.revenueToman / yMax) * PLOT_H, s.revenueToman > 0 ? 2 : 0);
            const x = PAD.left + slot * slotW + (slotW - barW) / 2;
            const y = PAD.top + PLOT_H - h;
            const cx = x + barW / 2;
            return (
              <g key={s.bucketISO} className="group">
                {/* full-height hit area for easier hover */}
                <rect
                  x={PAD.left + slot * slotW}
                  y={PAD.top}
                  width={slotW}
                  height={PLOT_H}
                  fill="transparent"
                />
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={3}
                  className="fill-primary transition-colors group-hover:fill-highlight"
                >
                  <title>
                    {`${bucketLabelFa(s.bucketISO, granularity)} — ${formatToman(
                      s.revenueToman
                    )} (${toFaDigits(String(s.ordersCount))} سفارش)`}
                  </title>
                </rect>
                {(i % labelEvery === 0 || i === n - 1) && (
                  <text
                    x={cx}
                    y={CHART_H - 8}
                    fontSize={10}
                    fill="currentColor"
                    className="text-muted-foreground"
                    textAnchor="middle"
                  >
                    {bucketLabelFa(s.bucketISO, granularity)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

function ReportsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}

export function AdminReportsPage() {
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [granularity, setGranularity] = useState<ReportGranularity>("day");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const presetVals = presetRange(preset);
  const range =
    preset === "custom"
      ? customFrom && customTo && customFrom <= customTo
        ? { from: customFrom, to: customTo }
        : null
      : presetVals;

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminReports({
    from: range?.from,
    to: range?.to,
    granularity,
  });

  useEffect(() => {
    document.title = "گزارش فروش | پنل مدیریت خانه‌گی";
  }, []);

  const summary = data?.summary;
  const csvParams = new URLSearchParams({ entity: "orders" });
  if (range?.from) csvParams.set("from", range.from);
  if (range?.to) csvParams.set("to", range.to);
  const csvHref = `/api/admin/export?${csvParams.toString()}`;

  return (
    <div>
      <AdminPageHeader
        title="گزارش فروش"
        description="تحلیل فروش، درآمد، پرفروش‌ترین محصولات و موجودی بحرانی در بازه زمانی دلخواه."
        actions={
          <a href={csvHref} download aria-label="خروجی CSV سفارش‌ها">
            <Button variant="outline" className="gap-1.5 font-bold">
              <Download className="size-4" aria-hidden />
              خروجی CSV
            </Button>
          </a>
        }
      />

      {isError ? (
        <ErrorState message={(error as Error | null)?.message} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <ReportsSkeleton />
      ) : (
        <div className="space-y-5">
          {/* Range presets + granularity */}
          <Card className="rounded-xl">
            <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="بازه زمانی گزارش">
                {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={preset === key ? "default" : "outline"}
                    className={cn(
                      "h-9 gap-1.5 font-bold",
                      preset === key ? "bg-primary" : "bg-white"
                    )}
                    aria-pressed={preset === key}
                    onClick={() => {
                      setPreset(key);
                      if (key === "custom" && !customFrom && !customTo) {
                        const p = presetRange("30d");
                        if (p) {
                          setCustomFrom(p.from);
                          setCustomTo(p.to);
                        }
                      }
                    }}
                  >
                    {key === "today" ? (
                      <CalendarDays className="size-3.5" aria-hidden />
                    ) : key === "custom" ? (
                      <CalendarRange className="size-3.5" aria-hidden />
                    ) : null}
                    {PRESET_LABELS[key]}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {preset === "custom" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={customFrom}
                      max={customTo || undefined}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      dir="ltr"
                      className="h-9 w-40 bg-white font-mono text-xs"
                      aria-label="از تاریخ"
                    />
                    <span className="text-xs text-muted-foreground">تا</span>
                    <Input
                      type="date"
                      value={customTo}
                      min={customFrom || undefined}
                      onChange={(e) => setCustomTo(e.target.value)}
                      dir="ltr"
                      className="h-9 w-40 bg-white font-mono text-xs"
                      aria-label="تا تاریخ"
                    />
                    {customFrom && customTo && customFrom > customTo && (
                      <p className="w-full text-xs font-bold text-rose-600">
                        تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.
                      </p>
                    )}
                  </div>
                )}
                <div
                  className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1"
                  role="group"
                  aria-label="دانه‌بندی نمودار"
                >
                  {(Object.keys(GRANULARITY_LABELS) as ReportGranularity[]).map((g) => (
                    <Button
                      key={g}
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-7 px-3 text-xs font-bold",
                        granularity === g && "bg-white text-primary shadow-sm"
                      )}
                      aria-pressed={granularity === g}
                      onClick={() => setGranularity(g)}
                    >
                      {GRANULARITY_LABELS[g]}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              title="فروش ناخالص"
              value={formatToman(summary!.grossSalesToman)}
              icon={Banknote}
              tone="navy"
              sub={`ارسال: ${formatToman(summary!.shippingToman)}`}
            />
            <KpiCard
              title="تخفیف‌ها"
              value={formatToman(summary!.discountsToman)}
              icon={Percent}
              tone="amber"
              sub="مجموع تخفیف سفارش‌ها"
            />
            <KpiCard
              title="درآمد خالص"
              value={formatToman(summary!.netRevenueToman)}
              icon={TrendingUp}
              tone="emerald"
              sub={`پرداخت‌شده: ${toFaDigits(String(summary!.paidCount))} سفارش`}
            />
            <KpiCard
              title="تعداد سفارش"
              value={toFaDigits(String(summary!.ordersCount))}
              icon={ShoppingBag}
              tone="teal"
              sub={`لغو شده: ${toFaDigits(String(summary!.cancelledCount))}`}
            />
            <KpiCard
              title="میانگین سبد خرید"
              value={formatToman(summary!.avgOrderToman)}
              icon={BarChart3}
              tone="teal"
            />
            <KpiCard
              title="مشتریان جدید"
              value={toFaDigits(String(summary!.newCustomers))}
              icon={Users}
              tone="emerald"
              sub="ثبت‌نام در این بازه"
            />
          </div>

          {/* Revenue chart */}
          <Card className="rounded-xl">
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
                <BarChart3 className="size-4 text-highlight" aria-hidden />
                نمودار درآمد (
                {GRANULARITY_LABELS[data.granularity]})
                <span className="ms-auto text-xs font-bold text-muted-foreground">
                  {range?.from && range?.to
                    ? `${formatDateShortFa(`${range.from}T00:00:00.000Z`)} تا ${formatDateShortFa(
                        `${range.to}T00:00:00.000Z`
                      )}`
                    : "۳۰ روز گذشته"}
                  {isFetching && <span className="ms-2">…</span>}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <RevenueBarChart series={data.series} granularity={data.granularity} />
            </CardContent>
          </Card>

          {/* Tables */}
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Top products */}
            <Card className="rounded-xl">
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
                  <TrendingUp className="size-4 text-highlight" aria-hidden />
                  پرفروش‌ترین محصولات
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {data.topProducts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    در این بازه فروشی ثبت نشده است.
                  </p>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>محصول</TableHead>
                          <TableHead>تعداد فروش</TableHead>
                          <TableHead className="text-end">درآمد</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topProducts.map((p, i) => (
                          <TableRow key={`${p.productId ?? "na"}-${p.productName}`}>
                            <TableCell>
                              <span className="flex size-6 items-center justify-center rounded-full bg-highlight-soft text-xs font-extrabold text-highlight tabular-fa">
                                {toFaDigits(String(i + 1))}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-56 truncate text-[13px] font-bold">
                              {p.productName}
                            </TableCell>
                            <TableCell className="text-[13px] tabular-fa">
                              {toFaDigits(String(p.quantitySold))}
                            </TableCell>
                            <TableCell className="text-end text-[13px] font-bold tabular-fa">
                              {formatToman(p.revenueToman)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Low stock */}
            <Card className="rounded-xl">
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
                  <BarChart3 className="size-4 text-highlight" aria-hidden />
                  محصولات با موجودی کم
                  <span className="text-xs font-bold text-rose-600">
                    ({toFaDigits(String(data.lowStock.length))} مورد)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {data.lowStock.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    همه محصولات موجودی کافی دارند. 👌
                  </p>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>محصول</TableHead>
                          <TableHead>موجودی</TableHead>
                          <TableHead className="text-end">وضعیت</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.lowStock.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="max-w-64 truncate text-[13px] font-bold">
                              {p.name}
                            </TableCell>
                            <TableCell className="text-[13px] tabular-fa">
                              {formatNumberFa(p.stock)} عدد
                              <span className="ms-1 text-[11px] text-muted-foreground">
                                (آستانه {toFaDigits(String(p.lowStockThreshold))})
                              </span>
                            </TableCell>
                            <TableCell className="text-end">
                              <StockBadge stock={p.stock} threshold={p.lowStockThreshold} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
