"use client";
// Order detail page (#/order/:orderNumber): status, test-gateway payment,
// items, timeline and cancellation.

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  CreditCard,
  MapPin,
  Package,
  Receipt,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/client-api";
import { navigate } from "@/lib/router";
import { formatToman, toFaDigits, formatDateTimeFa } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import type { OrderDTO } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ErrorState } from "@/components/store/empty-state";
import { ListRowSkeleton } from "@/components/store/skeletons";
import { LineThumb } from "@/components/store/line-thumb";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-sky-50 text-sky-700 border-sky-200",
  PROCESSING: "bg-violet-50 text-violet-700 border-violet-200",
  SHIPPED: "bg-cyan-50 text-cyan-700 border-cyan-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

const PAYMENT_STYLES: Record<string, string> = {
  UNPAID: "bg-muted text-muted-foreground",
  PENDING: "bg-amber-50 text-amber-700",
  PAID: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
  REFUNDED: "bg-violet-50 text-violet-700",
};

export function OrderPage({ orderNumber }: { orderNumber: string }) {
  const { user, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();

  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: () => apiGet<OrderDTO>(`/api/orders/${encodeURIComponent(orderNumber)}`),
    retry: 1,
    enabled: !!user || !authLoading,
  });

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/login?redirect=/order/${orderNumber}`, { replace: true });
    }
  }, [authLoading, user, orderNumber]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["order", orderNumber] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const payTest = useMutation({
    mutationFn: () => apiPost<{ order: OrderDTO }>(`/api/orders/${order!.orderNumber}/pay-test`),
    onSuccess: () => {
      toast.success("پرداخت آزمایشی با موفقیت انجام شد. سفارش شما تأیید گردید.");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancel = useMutation({
    mutationFn: () => apiPost<{ order: OrderDTO }>(`/api/orders/${order!.orderNumber}/cancel`),
    onSuccess: () => {
      toast.info("سفارش شما لغو شد.");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (order) document.title = `سفارش ${order.orderNumber}`;
  }, [order]);

  if (authLoading || isLoading) {
    return (
      <div className="container-store py-10">
        <Skeleton className="mb-4 h-8 w-56" />
        <ListRowSkeleton rows={3} />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="container-store py-10">
        <ErrorState
          message={(error as Error | null)?.message ?? "سفارش یافت نشد."}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const cancellable = order.status === "PENDING" || order.status === "CONFIRMED";
  const paidPayment = order.payments.find((p) => p.status === "PAID");

  return (
    <div className="container-store max-w-4xl py-8">
      {/* Success header */}
      <div className="mb-6 flex flex-col items-center gap-2 rounded-2xl border bg-highlight-soft/50 p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-highlight text-highlight-foreground">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <h1 className="text-lg font-extrabold sm:text-xl">
          {order.status === "CANCELLED" ? "سفارش لغو شده" : "سفارش شما ثبت شد"}
        </h1>
        <p className="text-sm text-muted-foreground">
          شماره سفارش:{" "}
          <span className="font-black tabular-fa text-foreground" dir="ltr">
            {toFaDigits(order.orderNumber)}
          </span>
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="outline" className={cn("border text-xs", STATUS_STYLES[order.status])}>
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </Badge>
          <Badge variant="outline" className={cn("border-transparent text-xs", PAYMENT_STYLES[order.paymentStatus])}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
          </Badge>
        </div>
      </div>

      {/* Payment box (test gateway) */}
      {order.paymentStatus === "UNPAID" && order.status !== "CANCELLED" ? (
        <div className="mb-6 rounded-xl border-2 border-dashed border-highlight/60 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-highlight-soft text-highlight">
                <CreditCard className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-extrabold">درگاه پرداخت آزمایشی</p>
                <p className="mt-0.5 text-xs leading-6 text-muted-foreground">
                  حالت تست — هیچ پول واقعی جابه‌جا نمی‌شود. [نشان‌گذاری آزمایشی]
                </p>
              </div>
            </div>
            <Button
              className="h-11 px-6 font-bold"
              disabled={payTest.isPending}
              onClick={() => payTest.mutate()}
            >
              {payTest.isPending ? "در حال اتصال به درگاه…" : "پرداخت آزمایشی"}
            </Button>
          </div>
        </div>
      ) : order.paymentStatus === "PAID" ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-emerald-600" aria-hidden />
            <div>
              <p className="text-sm font-extrabold text-emerald-800">پرداخت با موفقیت انجام شد</p>
              {paidPayment?.refId && (
                <p className="mt-0.5 text-xs text-emerald-700 tabular-fa" dir="ltr">
                  کد رهگیری: {toFaDigits(paidPayment.refId)}
                </p>
              )}
            </div>
          </div>
          <span className="text-xs text-emerald-700">
            {paidPayment && formatDateTimeFa(paidPayment.createdAt)}
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Items + timeline */}
        <div className="space-y-6">
          <section aria-label="اقلام سفارش" className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold">
              <Package className="size-5 text-highlight" aria-hidden />
              اقلام سفارش
            </h2>
            <ul className="space-y-4">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <LineThumb src={item.image} alt={item.productName} />
                  <div className="min-w-0 flex-1">
                    {item.productSlug ? (
                      <a
                        href={`#/product/${item.productSlug}`}
                        className="line-clamp-2 text-sm font-bold hover:text-highlight"
                      >
                        {item.productName}
                      </a>
                    ) : (
                      <p className="text-sm font-bold">{item.productName}</p>
                    )}
                    {item.variantText && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.variantText}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground tabular-fa">
                      {toFaDigits(String(item.quantity))} × {formatToman(item.unitPriceToman)}
                      {item.originalPriceToman && item.originalPriceToman > item.unitPriceToman && (
                        <span className="ms-2 line-through">{formatToman(item.originalPriceToman, false)}</span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold tabular-fa">
                    {formatToman(item.lineTotalToman)}
                  </span>
                </li>
              ))}
            </ul>
            <Separator className="my-4" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">جمع کالاها</span>
                <span className="font-bold tabular-fa">{formatToman(order.subtotalToman)}</span>
              </div>
              {order.discountToman > 0 && (
                <div className="flex justify-between text-highlight">
                  <span className="font-bold">
                    تخفیف{order.couponCode ? ` (${order.couponCode})` : ""}
                  </span>
                  <span className="font-bold tabular-fa">−{formatToman(order.discountToman)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Truck className="size-4" aria-hidden />
                  ارسال{order.shippingMethod ? ` (${order.shippingMethod.name})` : ""}
                </span>
                <span className="font-bold tabular-fa">
                  {order.shippingCostToman === 0 ? "رایگان" : formatToman(order.shippingCostToman)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base">
                <span className="font-bold">مبلغ کل</span>
                <span className="font-black text-highlight tabular-fa">{formatToman(order.totalToman)}</span>
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section aria-label="تاریخچه سفارش" className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold">
              <Receipt className="size-5 text-highlight" aria-hidden />
              وضعیت سفارش
            </h2>
            <ol className="relative space-y-5 pe-4 before:absolute before:inset-y-1 before:start-[5px] before:w-0.5 before:bg-border">
              {[...order.statusHistory].reverse().map((h) => (
                <li key={h.id} className="relative flex items-start gap-3 before:hidden">
                  <span className="absolute -start-[13px] top-1.5 size-3 rounded-full border-2 border-highlight bg-white" aria-hidden />
                  <div>
                    <p className="text-sm font-bold">
                      {ORDER_STATUS_LABELS[h.toStatus] ?? h.toStatus}
                    </p>
                    {h.note && <p className="mt-0.5 text-xs text-muted-foreground">{h.note}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-fa">
                      {formatDateTimeFa(h.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Sidebar: address + actions */}
        <aside className="space-y-6">
          <section aria-label="آدرس تحویل" className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <MapPin className="size-5 text-highlight" aria-hidden />
              آدرس تحویل
            </h2>
            <div className="text-sm leading-7 text-muted-foreground">
              <p className="font-bold text-foreground">{order.shippingAddress.receiverName}</p>
              <p>
                {order.shippingAddress.province}، {order.shippingAddress.city}،{" "}
                {order.shippingAddress.line}
              </p>
              <p className="tabular-fa">کدپستی: {toFaDigits(order.shippingAddress.postalCode)}</p>
              <p className="tabular-fa" dir="ltr">
                {toFaDigits(order.shippingAddress.phone)}
              </p>
            </div>
          </section>

          {/* Shipping tracking code (set by the store staff) */}
          {order.trackingCode && (
            <section aria-label="کد رهگیری ارسال" className="rounded-xl border bg-white p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold">
                <Truck className="size-5 text-highlight" aria-hidden />
                کد رهگیری ارسال
              </h2>
              <p dir="ltr" className="text-start font-mono text-sm font-extrabold tracking-wide text-primary">
                {order.trackingCode}
              </p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                با این کد می‌توانید وضعیت مرسوله را در سایت شرکت پست پیگیری کنید.
              </p>
            </section>
          )}

          <section aria-label="اقدامات" className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-bold">اقدامات</h2>
            <div className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => navigate("/account/orders")}>
                <Package className="size-4" />
                سفارش‌های من
              </Button>
              {cancellable && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full text-destructive hover:bg-destructive/5 hover:text-destructive"
                      disabled={cancel.isPending}
                    >
                      <Ban className="size-4" />
                      لغو سفارش
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>لغو سفارش {order.orderNumber}؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        موجودی کالاها بازگردانده می‌شود و در صورت پرداخت، مبلغ حداکثر تا ۷۲ ساعت
                        کاری عودت داده خواهد شد.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>انصراف</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => cancel.mutate()}
                      >
                        بله، سفارش را لغو کن
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
