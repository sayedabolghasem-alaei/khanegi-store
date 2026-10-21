"use client";
// Shared building blocks for admin views — badges, pagination, skeletons,
// Persian label maps for audit actions / skip reasons / sources.

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toFaDigits } from "@/lib/money";
import type { OrderStatus, PaymentStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";

// ─── Tone badges (palette: amber / teal / emerald / orange / rose / zinc) ──

export type Tone = "amber" | "teal" | "emerald" | "orange" | "rose" | "zinc";

const toneClasses: Record<Tone, string> = {
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  teal: "bg-teal-100 text-teal-800 border-teal-200",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-200",
  orange: "bg-orange-100 text-orange-800 border-orange-200",
  rose: "bg-rose-100 text-rose-800 border-rose-200",
  zinc: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

export function ToneBadge({
  tone,
  className,
  children,
}: {
  tone: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-bold",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const ORDER_STATUS_TONES: Record<OrderStatus, Tone> = {
  PENDING: "amber",
  CONFIRMED: "teal",
  PROCESSING: "orange",
  SHIPPED: "zinc",
  DELIVERED: "emerald",
  CANCELLED: "rose",
};

const PAYMENT_STATUS_TONES: Record<PaymentStatus, Tone> = {
  UNPAID: "zinc",
  PENDING: "amber",
  PAID: "emerald",
  FAILED: "rose",
  REFUNDED: "orange",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <ToneBadge tone={ORDER_STATUS_TONES[status] ?? "zinc"}>{ORDER_STATUS_LABELS[status] ?? status}</ToneBadge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <ToneBadge tone={PAYMENT_STATUS_TONES[status] ?? "zinc"}>{PAYMENT_STATUS_LABELS[status] ?? status}</ToneBadge>;
}

/** Stock badge: red at 0, amber within threshold, zinc otherwise. */
export function StockBadge({
  stock,
  threshold,
}: {
  stock: number;
  threshold?: number;
}) {
  if (stock <= 0) return <ToneBadge tone="rose">ناموجود</ToneBadge>;
  if (threshold !== undefined && stock <= threshold)
    return <ToneBadge tone="amber">{toFaDigits(String(stock))} عدد — کم</ToneBadge>;
  return <ToneBadge tone="zinc">{toFaDigits(String(stock))} عدد</ToneBadge>;
}

// ─── Persian label maps ─────────────────────────────────────────────────────

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  ORDER_STATUS_CHANGE: "تغییر وضعیت سفارش",
  ORDER_CREATE: "ثبت سفارش",
  PAYMENT_TEST: "پرداخت آزمایشی",
  PRODUCT_CREATE: "ایجاد محصول",
  PRODUCT_UPDATE: "ویرایش محصول",
  PRODUCT_DELETE: "حذف نرم محصول",
  PRODUCTS_BULK: "عملیات گروهی محصولات",
  STOCK_ADJUST: "اصلاح موجودی",
  RATE_SET: "ثبت نرخ ارز",
  PRICE_APPLY: "اعمال قیمت‌گذاری",
  RULE_CREATE: "ایجاد قاعده قیمت‌گذاری",
  COUPON_CREATE: "ایجاد کد تخفیف",
  USER_BLOCK: "مسدودسازی کاربر",
  USER_UNBLOCK: "رفع مسدودی کاربر",
  USER_ROLE_CHANGE: "تغییر نقش کاربر",
  REVIEW_MODERATE: "بررسی نظر",
  TRACKING_SET: "ثبت کد رهگیری",
  SETTINGS_UPDATE: "تغییر تنظیمات",
  SHIPPING_CREATE: "افزودن روش ارسال",
  SHIPPING_UPDATE: "ویرایش روش ارسال",
  SHIPPING_DELETE: "حذف روش ارسال",
  UPLOAD_IMAGE: "بارگذاری تصویر",
  DELETE_IMAGE: "حذف تصویر",
  EXPORT_CSV: "خروجی CSV",
  IMPORT_CSV: "ورود CSV",
  LOGIN: "ورود",
  SEED: "داده اولیه",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export const SKIP_REASON_LABELS: Record<string, string> = {
  MANUAL_PRICE: "قیمت دستی",
  NO_COST: "بدون قیمت تمام‌شده",
  NO_CURRENCY: "ارز نامعتبر",
  MISSING_RATE: "نرخ ارز ثبت نشده",
  STALE_RATE: "نرخ ارز قدیمی",
  NO_RULE: "بدون قاعده فعال",
  INACTIVE: "غیرفعال",
};

export function skipReasonLabel(reason: string): string {
  return SKIP_REASON_LABELS[reason] ?? reason;
}

export const PRICE_SOURCE_LABELS: Record<string, string> = {
  MANUAL: "دستی",
  PRICING_ENGINE: "موتور قیمت‌گذاری",
  SEED: "اولیه",
};

export const RATE_SOURCE_LABELS: Record<string, string> = {
  MANUAL: "دستی",
};

// ─── Product image thumb with placeholder fallback ─────────────────────────

export function AdminThumb({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed || !src ? "/images/placeholder.svg" : src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("size-12 shrink-0 rounded-lg border bg-muted/40 object-contain p-0.5", className)}
    />
  );
}

// ─── Pagination (Persian, compact) ──────────────────────────────────────────

export function AdminPagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-xs text-muted-foreground tabular-fa">
        مجموع {toFaDigits(String(total))} مورد — صفحه {toFaDigits(String(page))} از{" "}
        {toFaDigits(String(pageCount))}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="صفحه قبل"
        >
          <ChevronRight className="size-4" />
          قبلی
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          aria-label="صفحه بعد"
        >
          بعدی
          <ChevronLeft className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Skeletons ──────────────────────────────────────────────────────────────

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto" aria-hidden>
      <div className="min-w-[640px] space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex gap-2">
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={c} className="h-9 flex-1 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}
