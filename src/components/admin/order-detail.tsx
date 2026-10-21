"use client";
// Admin order detail (#/admin/orders/:id) — customer snapshot, items, totals,
// payments, status timeline, admin note and status transition actions.

import { useEffect, useState } from "react";
import {
  ArrowRight,
  ClipboardEdit,
  CreditCard,
  History,
  MapPin,
  Printer,
  Truck,
  User,
} from "lucide-react";
import { href, navigate } from "@/lib/router";
import { formatDateTimeFa, formatToman, toFaDigits } from "@/lib/money";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";
import { useAdminOrder, useSaveOrderNote, useSetOrderStatus } from "@/hooks/use-admin";
import { useSetTrackingCode } from "@/hooks/use-admin-reports";
import { OrderInvoiceDialog } from "@/components/admin/order-invoice";
import { ErrorState } from "@/components/store/empty-state";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import {
  AdminThumb,
  OrderStatusBadge,
  PaymentStatusBadge,
  SkeletonRows,
  ToneBadge,
} from "@/components/admin/admin-bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TRANSITION_LABELS: Record<string, string> = {
  CONFIRMED: "تأیید سفارش",
  PROCESSING: "شروع پردازش",
  SHIPPED: "ارسال سفارش",
  DELIVERED: "ثبت تحویل",
  CANCELLED: "لغو سفارش",
};

/** Admin internal note — isolated component so it re-initializes per order (key-remount pattern). */
function AdminNoteCard({ orderId, initialNote }: { orderId: string; initialNote: string }) {
  const [note, setNote] = useState(initialNote);
  const saveNote = useSaveOrderNote(orderId);
  return (
    <Card className="rounded-xl">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <ClipboardEdit className="size-4 text-highlight" aria-hidden />
          یادداشت داخلی (نمایش فقط برای مدیران)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Textarea
          rows={5}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="یادداشت درباره پیگیری ارسال، تماس با مشتری و…"
          aria-label="یادداشت داخلی سفارش"
          className="resize-y bg-white"
        />
        <Button
          size="sm"
          className="mt-3 gap-1.5 font-bold"
          disabled={saveNote.isPending}
          onClick={() => saveNote.mutate(note)}
        >
          ذخیره یادداشت
        </Button>
      </CardContent>
    </Card>
  );
}

/** Shipping tracking code — isolated so it re-initializes per order (key-remount pattern). */
function TrackingCard({ orderId, initialCode }: { orderId: string; initialCode: string | null }) {
  const [code, setCode] = useState(initialCode ?? "");
  const save = useSetTrackingCode(orderId);
  const trimmed = code.trim();
  const unchanged = trimmed === (initialCode ?? "");
  return (
    <Card className="rounded-xl">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <Truck className="size-4 text-highlight" aria-hidden />
          کد رهگیری ارسال
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {initialCode && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <span className="text-xs font-bold text-emerald-800">کد ثبت‌شده (نمایش به مشتری):</span>
            <span dir="ltr" className="font-mono text-sm font-extrabold text-emerald-900">
              {initialCode}
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            dir="ltr"
            maxLength={60}
            placeholder="مثلاً 12345678901234567"
            aria-label="کد رهگیری ارسال"
            className="h-10 bg-white text-start font-mono"
          />
          <Button
            size="sm"
            className="h-10 shrink-0 font-bold"
            disabled={save.isPending || unchanged}
            onClick={() => save.mutate(trimmed === "" ? null : trimmed)}
          >
            ذخیره
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          پس از تحویل بسته به شرکت پست، کد رهگیری را وارد کنید تا در صفحه سفارش مشتری نمایش داده شود.
          برای حذف کد، فیلد را خالی بگذارید و ذخیره بزنید.
        </p>
      </CardContent>
    </Card>
  );
}

export function AdminOrderDetail({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useAdminOrder(id);
  const setStatus = useSetOrderStatus(id);
  const [transitionTarget, setTransitionTarget] = useState<OrderStatus | null>(null);
  const [transitionNote, setTransitionNote] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const order = data?.order;

  useEffect(() => {
    document.title = "جزئیات سفارش | پنل مدیریت خانه‌گی";
  }, []);

  if (isError) {
    return (
      <div>
        <AdminPageHeader title="جزئیات سفارش" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !order) {
    return (
      <div className="space-y-4" aria-hidden>
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-48 rounded-xl lg:col-span-2" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <SkeletonRows rows={4} />
      </div>
    );
  }

  const transitions = ORDER_STATUS_TRANSITIONS[order.status] ?? [];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>سفارش</span>
            <span dir="ltr" className="font-mono text-lg text-primary">
              {order.orderNumber}
            </span>
            <OrderStatusBadge status={order.status} />
          </span>
        }
        description={`ثبت‌شده در ${formatDateTimeFa(order.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="gap-1.5 font-bold"
              onClick={() => setInvoiceOpen(true)}
            >
              <Printer className="size-4" aria-hidden />
              چاپ فاکتور
            </Button>
            <Button variant="outline" className="gap-1.5 font-bold" onClick={() => navigate("/admin/orders")}>
              <ArrowRight className="size-4" aria-hidden />
              بازگشت به فهرست
            </Button>
          </div>
        }
      />

      {/* Tracking code — prominent strip under the header when set */}
      {order.trackingCode && (
        <Card className="rounded-xl border-emerald-200 bg-emerald-50/60">
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <Truck className="size-4 text-emerald-700" aria-hidden />
            <span className="text-xs font-bold text-emerald-800">کد رهگیری ارسال:</span>
            <span dir="ltr" className="font-mono text-sm font-extrabold text-emerald-900">
              {order.trackingCode}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Status transitions */}
      {transitions.length > 0 && (
        <Card className="rounded-xl border-highlight/30 bg-highlight-soft/40">
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <span className="text-xs font-bold text-muted-foreground">تغییر وضعیت:</span>
            {transitions.map((next) => {
              const isCancel = next === "CANCELLED";
              return (
                <Button
                  key={next}
                  size="sm"
                  variant="outline"
                  className={
                    isCancel
                      ? "gap-1 border-rose-200 bg-white font-bold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      : "gap-1 border-teal-200 bg-white font-bold text-teal-800 hover:bg-teal-50"
                  }
                  disabled={setStatus.isPending}
                  onClick={() => {
                    setTransitionNote("");
                    setTransitionTarget(next as OrderStatus);
                  }}
                >
                  {TRANSITION_LABELS[next] ?? ORDER_STATUS_LABELS[next] ?? next}
                </Button>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Items */}
        <Card className="rounded-xl lg:col-span-2">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-extrabold">اقلام سفارش</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">تصویر</TableHead>
                    <TableHead>محصول</TableHead>
                    <TableHead>قیمت واحد</TableHead>
                    <TableHead>تعداد</TableHead>
                    <TableHead className="text-end">جمع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>
                        <AdminThumb src={it.image} alt={it.productName} />
                      </TableCell>
                      <TableCell>
                        <p className="max-w-56 truncate text-[13px] font-bold">
                          {it.productSlug ? (
                            <a href={href(`/product/${it.productSlug}`)} className="transition-colors hover:text-highlight">
                              {it.productName}
                            </a>
                          ) : (
                            it.productName
                          )}
                        </p>
                        {it.variantText && (
                          <p className="text-[11px] text-muted-foreground">تنوع: {it.variantText}</p>
                        )}
                        {it.productSku && (
                          <p dir="ltr" className="text-right font-mono text-[11px] text-muted-foreground">
                            {it.productSku}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-[13px] tabular-fa">{formatToman(it.unitPriceToman)}</TableCell>
                      <TableCell className="text-[13px] tabular-fa">{toFaDigits(String(it.quantity))}</TableCell>
                      <TableCell className="text-end text-[13px] font-bold tabular-fa">
                        {formatToman(it.lineTotalToman)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator className="my-4" />

            {/* Totals (server-computed) */}
            <dl className="ms-auto max-w-xs space-y-2 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">جمع اقلام</dt>
                <dd className="font-bold tabular-fa">{formatToman(order.subtotalToman)}</dd>
              </div>
              {order.discountToman > 0 && (
                <div className="flex justify-between gap-6">
                  <dt className="text-muted-foreground">
                    تخفیف {order.couponCode && <span dir="ltr" className="font-mono text-xs">({order.couponCode})</span>}
                  </dt>
                  <dd className="font-bold text-emerald-700 tabular-fa">−{formatToman(order.discountToman)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">
                  ارسال{order.shippingMethod ? ` (${order.shippingMethod.name})` : ""}
                </dt>
                <dd className="font-bold tabular-fa">{formatToman(order.shippingCostToman)}</dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-6 text-base">
                <dt className="font-extrabold">مبلغ نهایی</dt>
                <dd className="font-extrabold text-primary tabular-fa">{formatToman(order.totalToman)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Customer + payment */}
        <div className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
                <User className="size-4 text-highlight" aria-hidden />
                اطلاعات مشتری
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 p-4 text-[13px]">
              <p>
                <span className="text-muted-foreground">نام: </span>
                <span className="font-bold">{order.customerName}</span>
              </p>
              <p dir="ltr" className="text-right">
                <span className="text-muted-foreground">تماس: </span>
                <span className="font-bold tabular-fa">{toFaDigits(order.customerPhone)}</span>
              </p>
              <Separator />
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
                <div className="text-[13px] leading-6">
                  <p className="font-bold">{order.shippingAddress.receiverName}</p>
                  <p className="text-muted-foreground">
                    {order.shippingAddress.province}، {order.shippingAddress.city}
                  </p>
                  <p>{order.shippingAddress.line}</p>
                  <p className="text-muted-foreground tabular-fa">
                    کد پستی: {toFaDigits(order.shippingAddress.postalCode)}
                  </p>
                </div>
              </div>
              {order.note && (
                <>
                  <Separator />
                  <p className="rounded-lg bg-amber-50 p-2.5 text-xs leading-6 text-amber-900">
                    یادداشت مشتری: {order.note}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
                <CreditCard className="size-4 text-highlight" aria-hidden />
                پرداخت‌ها
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {order.payments.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">پرداختی ثبت نشده است.</p>
              ) : (
                <ul className="space-y-2">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-[13px]">
                      <span className="flex flex-col gap-1">
                        <span className="font-bold tabular-fa">{formatToman(p.amountToman)}</span>
                        <span className="text-[11px] text-muted-foreground">{formatDateTimeFa(p.createdAt)}</span>
                        {p.refId && (
                          <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">
                            ref: {p.refId}
                          </span>
                        )}
                      </span>
                      <PaymentStatusBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
              <Separator className="my-3" />
              <p className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">وضعیت پرداخت سفارش</span>
                <PaymentStatusBadge status={order.paymentStatus} />
              </p>
              <p className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">درگاه</span>
                <ToneBadge tone="zinc">{order.paymentProvider === "TEST" ? "درگاه آزمایشی" : order.paymentProvider}</ToneBadge>
              </p>
            </CardContent>
          </Card>

          {/* Shipping tracking code */}
          <TrackingCard key={order.id} orderId={order.id} initialCode={order.trackingCode} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status history timeline */}
        <Card className="rounded-xl">
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
              <History className="size-4 text-highlight" aria-hidden />
              تاریخچه وضعیت‌ها
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ol className="relative space-y-4 border-s ps-5">
              {order.statusHistory.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -start-[26px] top-1 size-2.5 rounded-full bg-highlight ring-4 ring-highlight-soft" aria-hidden />
                  <p className="text-[13px] font-bold">
                    {h.fromStatus ? (
                      <>
                        {ORDER_STATUS_LABELS[h.fromStatus] ?? h.fromStatus}
                        <span className="mx-1 text-muted-foreground">→</span>
                        {ORDER_STATUS_LABELS[h.toStatus] ?? h.toStatus}
                      </>
                    ) : (
                      <>ثبت سفارش ({ORDER_STATUS_LABELS[h.toStatus] ?? h.toStatus})</>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatDateTimeFa(h.createdAt)}</p>
                  {h.note && <p className="mt-1 text-xs leading-5 text-muted-foreground">{h.note}</p>}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Admin note — keyed by order id so local state re-initializes on refetch */}
        {order && <AdminNoteCard key={order.id} orderId={order.id} initialNote={order.adminNote ?? ""} />}
      </div>

      {/* Printable invoice (prints only the .invoice-print subtree) */}
      <OrderInvoiceDialog order={order} open={invoiceOpen} onOpenChange={setInvoiceOpen} />

      {/* Transition confirm dialog */}
      <AlertDialog
        open={transitionTarget !== null}
        onOpenChange={(open) => {
          if (!open) setTransitionTarget(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {transitionTarget && (TRANSITION_LABELS[transitionTarget] ?? ORDER_STATUS_LABELS[transitionTarget])}
              {transitionTarget && ` → «${ORDER_STATUS_LABELS[transitionTarget] ?? transitionTarget}»`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {transitionTarget === "CANCELLED"
                ? "با لغو سفارش، موجودی اقلام به انبار بازمی‌گردد و این عمل قابل بازگشت نیست."
                : "وضعیت سفارش به‌روزرسانی می‌شود و در تاریخچه سفارش ثبت می‌گردد."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={2}
            value={transitionNote}
            onChange={(e) => setTransitionNote(e.target.value)}
            placeholder="یادداشت (اختیاری)"
            aria-label="یادداشت تغییر وضعیت"
            className="resize-y bg-white"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">انصراف</AlertDialogCancel>
            <AlertDialogAction
              className={
                transitionTarget === "CANCELLED"
                  ? "bg-destructive font-bold text-white hover:bg-destructive/90"
                  : "bg-primary font-bold hover:bg-primary/90"
              }
              disabled={setStatus.isPending}
              onClick={() => {
                if (!transitionTarget) return;
                setStatus.mutate(
                  { status: transitionTarget, note: transitionNote || undefined },
                  { onSettled: () => setTransitionTarget(null) }
                );
              }}
            >
              تأیید و ثبت
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
