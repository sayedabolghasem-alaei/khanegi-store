"use client";
// Printable sales invoice for a single order (admin, Task 7-c).
// Rendered inside a Dialog in the admin order detail; `window.print()` prints
// ONLY the `.invoice-print` subtree (visibility trick + dialog de-chroming).

import { Printer } from "lucide-react";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SITE_CONTACT,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/constants";
import { formatDateFa, formatToman, toFaDigits } from "@/lib/money";
import type { OrderDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Prints only the invoice subtree, even though the Dialog renders in a portal.
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .invoice-print, .invoice-print * { visibility: visible !important; }
  .invoice-print { position: absolute !important; inset: 0 !important; width: 100% !important; padding: 0 !important; background: #fff !important; }
  [data-slot="dialog-content"] { position: static !important; max-height: none !important; overflow: visible !important; transform: none !important; width: auto !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
  [data-slot="dialog-overlay"], .no-print { display: none !important; }
  @page { size: A4; margin: 12mm; }
}
`;

function InvoiceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6 py-1.5">
      <span className="text-[12px] text-neutral-600">{label}</span>
      <span className={`text-[13px] tabular-fa ${strong ? "font-extrabold" : "font-bold"}`}>{value}</span>
    </div>
  );
}

export function OrderInvoiceDialog({
  order,
  open,
  onOpenChange,
}: {
  order: OrderDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isTestProvider = order.paymentProvider === "TEST";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <style>{PRINT_CSS}</style>
        <DialogHeader className="no-print">
          <DialogTitle>فاکتور فروش سفارش</DialogTitle>
          <DialogDescription>
            پیش‌نمایش فاکتور — با دکمه «چاپ فاکتور» فقط همین فاکتور چاپ می‌شود.
          </DialogDescription>
        </DialogHeader>

        {/* ── Printable area ─────────────────────────────────────────────── */}
        <div className="invoice-print rounded-xl border border-neutral-200 bg-white p-6 text-neutral-900">
          {/* Store header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
            <div>
              <p className="text-xl font-black">{SITE_NAME}</p>
              <p className="mt-1 text-xs text-neutral-600">{SITE_TAGLINE}</p>
              <p className="mt-0.5 text-xs text-neutral-600 tabular-fa">
                پشتیبانی: {SITE_CONTACT.phone}
              </p>
            </div>
            <div className="text-end">
              <p className="text-sm font-extrabold">فاکتور فروش</p>
              <p dir="ltr" className="mt-1 font-mono text-xs font-bold">
                {order.orderNumber}
              </p>
              <p className="mt-0.5 text-xs text-neutral-600 tabular-fa">
                تاریخ: {formatDateFa(order.createdAt)}
              </p>
            </div>
          </div>

          {/* Seller / customer */}
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-3">
              <p className="mb-1.5 text-xs font-extrabold text-neutral-500">فروشنده</p>
              <p className="text-[13px] font-bold">{SITE_NAME}</p>
              <p className="text-[12px] leading-6 text-neutral-600">
                {SITE_TAGLINE}
                <br />
                <span className="tabular-fa">{SITE_CONTACT.phone}</span>
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-3">
              <p className="mb-1.5 text-xs font-extrabold text-neutral-500">خریدار / تحویل‌گیرنده</p>
              <p className="text-[13px] font-bold">{order.shippingAddress.receiverName}</p>
              <p className="text-[12px] leading-6 text-neutral-600">
                {order.shippingAddress.province}، {order.shippingAddress.city}، {order.shippingAddress.line}
                <br />
                <span className="tabular-fa">
                  کدپستی: {toFaDigits(order.shippingAddress.postalCode)} · تماس:{" "}
                  {toFaDigits(order.shippingAddress.phone)}
                </span>
              </p>
            </div>
          </div>

          {/* Items */}
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-neutral-100 text-neutral-700">
                <th className="border border-neutral-300 p-2 text-start font-bold">#</th>
                <th className="border border-neutral-300 p-2 text-start font-bold">محصول</th>
                <th className="border border-neutral-300 p-2 text-start font-bold">تنوع</th>
                <th className="border border-neutral-300 p-2 text-center font-bold">تعداد</th>
                <th className="border border-neutral-300 p-2 text-center font-bold">قیمت واحد</th>
                <th className="border border-neutral-300 p-2 text-center font-bold">جمع</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, i) => (
                <tr key={it.id}>
                  <td className="border border-neutral-300 p-2 tabular-fa">{toFaDigits(String(i + 1))}</td>
                  <td className="border border-neutral-300 p-2 font-bold">
                    {it.productName}
                    {it.productSku && (
                      <span dir="ltr" className="ms-1 font-mono text-[10px] font-normal text-neutral-500">
                        {it.productSku}
                      </span>
                    )}
                  </td>
                  <td className="border border-neutral-300 p-2 text-neutral-600">{it.variantText ?? "—"}</td>
                  <td className="border border-neutral-300 p-2 text-center tabular-fa">
                    {toFaDigits(String(it.quantity))}
                  </td>
                  <td className="border border-neutral-300 p-2 text-center tabular-fa">
                    {formatToman(it.unitPriceToman, false)}
                  </td>
                  <td className="border border-neutral-300 p-2 text-center font-bold tabular-fa">
                    {formatToman(it.lineTotalToman, false)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals + payment */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <InvoiceRow label="جمع اقلام" value={formatToman(order.subtotalToman)} />
              {order.discountToman > 0 && (
                <InvoiceRow
                  label={`تخفیف${order.couponCode ? ` (${order.couponCode})` : ""}`}
                  value={`−${formatToman(order.discountToman)}`}
                />
              )}
              <InvoiceRow
                label={`هزینه ارسال${order.shippingMethod ? ` (${order.shippingMethod.name})` : ""}`}
                value={order.shippingCostToman === 0 ? "رایگان" : formatToman(order.shippingCostToman)}
              />
              <div className="mt-1 flex items-center justify-between gap-6 border-t border-neutral-900 pt-2">
                <span className="text-[13px] font-extrabold">مبلغ نهایی</span>
                <span className="text-[14px] font-extrabold tabular-fa">{formatToman(order.totalToman)}</span>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-neutral-200 p-3 text-[12px]">
              <p className="flex items-center justify-between">
                <span className="text-neutral-600">وضعیت پرداخت</span>
                <span className="font-bold">{PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-neutral-600">درگاه پرداخت</span>
                <span className="font-bold">{isTestProvider ? "درگاه آزمایشی" : order.paymentProvider}</span>
              </p>
              {order.payments.find((p) => p.status === "PAID")?.refId && (
                <p className="flex items-center justify-between">
                  <span className="text-neutral-600">شناسه پرداخت</span>
                  <span dir="ltr" className="font-mono font-bold">
                    {order.payments.find((p) => p.status === "PAID")?.refId}
                  </span>
                </p>
              )}
              {isTestProvider && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] font-bold leading-5 text-amber-800">
                  حالت آزمایشی — فاکتور معتبر مالیاتی نیست
                </p>
              )}
              {order.trackingCode && (
                <p className="flex items-center justify-between">
                  <span className="text-neutral-600">کد رهگیری ارسال</span>
                  <span dir="ltr" className="font-mono font-extrabold">
                    {order.trackingCode}
                  </span>
                </p>
              )}
              <p className="flex items-center justify-between">
                <span className="text-neutral-600">وضعیت سفارش</span>
                <span className="font-bold">{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
              </p>
            </div>
          </div>

          <p className="mt-4 border-t border-neutral-200 pt-3 text-center text-[10px] leading-5 text-neutral-500">
            این فاکتور به‌صورت سیستمی از فروشگاه {SITE_NAME} صادر شده است. [نشان‌گذاری آزمایشی]
          </p>
        </div>

        {/* ── Actions (not printed) ──────────────────────────────────────── */}
        <DialogFooter className="no-print">
          <Button variant="outline" className="font-bold" onClick={() => onOpenChange(false)}>
            بستن
          </Button>
          <Button className="gap-1.5 bg-primary font-bold" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            چاپ فاکتور
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
