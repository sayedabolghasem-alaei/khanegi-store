"use client";
// Admin overview (#/admin/overview) — KPI cards + low-stock, best sellers,
// recent orders and recent activity lists.

import {
  Banknote,
  ChevronLeft,
  Clock,
  History,
  PackageSearch,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect } from "react";
import { href } from "@/lib/router";
import { formatToman, timeAgoFa, toFaDigits } from "@/lib/money";
import { useAdminStats } from "@/hooks/use-admin";
import { ErrorState } from "@/components/store/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import {
  KpiSkeleton,
  OrderStatusBadge,
  StockBadge,
  auditActionLabel,
} from "@/components/admin/admin-bits";

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
  tone: "navy" | "teal" | "emerald" | "amber";
  sub?: string;
}) {
  const toneMap = {
    navy: "bg-primary text-primary-foreground",
    teal: "bg-highlight-soft text-highlight",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  } as const;
  return (
    <Card className="rounded-xl">
      <CardContent className="flex items-center gap-4 p-5">
        <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${toneMap[tone]}`}>
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted-foreground">{title}</p>
          <p className="mt-1 truncate text-xl font-extrabold tabular-fa">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ListCard({
  title,
  icon: Icon,
  moreHref,
  moreLabel,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  moreHref?: string;
  moreLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col rounded-xl">
      <CardHeader className="flex-row items-center justify-between gap-2 border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <Icon className="size-4 text-highlight" aria-hidden />
          {title}
        </CardTitle>
        {moreHref && (
          <a
            href={href(moreHref)}
            className="flex items-center gap-0.5 text-xs font-bold text-highlight hover:underline"
          >
            {moreLabel ?? "مشاهده همه"}
            <ChevronLeft className="size-3.5" aria-hidden />
          </a>
        )}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

export function AdminOverview() {
  const { data, isLoading, isError, refetch } = useAdminStats();

  useEffect(() => {
    document.title = "داشبورد مدیریت | خانه‌گی";
  }, []);

  return (
    <div>
      <AdminPageHeader
        title="داشبورد"
        description="نمای کلی فروشگاه: سفارش‌ها، درآمد، موجودی و فعالیت‌های اخیر."
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <KpiSkeleton />
      ) : (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="سفارش‌ها"
              value={toFaDigits(String(data.ordersTotal))}
              icon={ShoppingBag}
              tone="navy"
              sub="مجموع همه سفارش‌ها"
            />
            <KpiCard
              title="درآمد سفارش‌های پرداخت‌شده"
              value={formatToman(data.revenueToman)}
              icon={Banknote}
              tone="emerald"
            />
            <KpiCard
              title="سفارش‌های در انتظار"
              value={toFaDigits(String(data.pendingOrders))}
              icon={Clock}
              tone={data.pendingOrders > 0 ? "amber" : "teal"}
              sub="نیازمند بررسی و تأیید"
            />
            <KpiCard
              title="مشتریان"
              value={toFaDigits(String(data.customersCount))}
              icon={Users}
              tone="teal"
              sub="کاربران ثبت‌نام‌شده"
            />
          </div>

          {/* Lists */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Low stock */}
            <ListCard
              title="محصولات با موجودی کم"
              icon={PackageSearch}
              moreHref="/admin/inventory"
              moreLabel="مدیریت موجودی"
            >
              {data.lowStock.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  همه محصولات موجودی کافی دارند. 👌
                </p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto pe-1">
                  {data.lowStock.map((p) => (
                    <li key={p.id}>
                      <a
                        href={href(`/admin/products/${p.id}`)}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-white p-2.5 transition-colors hover:border-highlight/40 hover:bg-accent/40"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{p.name}</span>
                        <StockBadge stock={p.stock} threshold={p.lowStockThreshold} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </ListCard>

            {/* Best sellers */}
            <ListCard title="پرفروش‌ترین محصولات" icon={TrendingUp} moreHref="/admin/products">
              {data.bestSellers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">هنوز فروشی ثبت نشده است.</p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto pe-1">
                  {data.bestSellers.map((p, i) => (
                    <li key={p.id}>
                      <a
                        href={href(`/admin/products/${p.id}`)}
                        className="flex items-center gap-3 rounded-lg border bg-white p-2.5 transition-colors hover:border-highlight/40 hover:bg-accent/40"
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-highlight-soft text-xs font-extrabold text-highlight tabular-fa">
                          {toFaDigits(String(i + 1))}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{p.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-fa">
                          {toFaDigits(String(p.soldCount))} فروش
                        </span>
                        <span className="hidden shrink-0 text-xs font-bold tabular-fa sm:block">
                          {formatToman(p.priceToman)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </ListCard>

            {/* Recent orders */}
            <ListCard title="سفارش‌های اخیر" icon={ShoppingBag} moreHref="/admin/orders">
              {data.recentOrders.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">سفارشی ثبت نشده است.</p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto pe-1">
                  {data.recentOrders.map((o) => (
                    <li key={o.id}>
                      <a
                        href={href(`/admin/orders/${o.id}`)}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-2.5 transition-colors hover:border-highlight/40 hover:bg-accent/40"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span dir="ltr" className="shrink-0 font-mono text-xs font-bold text-primary">
                            {o.orderNumber}
                          </span>
                          <span className="min-w-0 truncate text-[13px]">{o.customerName}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-xs font-bold tabular-fa">{formatToman(o.totalToman)}</span>
                          <OrderStatusBadge status={o.status} />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </ListCard>

            {/* Recent activity */}
            <ListCard title="فعالیت‌های اخیر مدیران" icon={History}>
              {data.recentAudit.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">فعالیتی ثبت نشده است.</p>
              ) : (
                <ul className="max-h-72 space-y-2.5 overflow-y-auto pe-1">
                  {data.recentAudit.map((a) => (
                    <li key={a.id} className="flex items-start gap-2.5 rounded-lg border bg-white p-2.5">
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-highlight" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold">
                          {auditActionLabel(a.action)}
                          {a.actorName && (
                            <span className="font-normal text-muted-foreground"> — {a.actorName}</span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{timeAgoFa(a.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ListCard>
          </div>
        </div>
      )}
    </div>
  );
}
