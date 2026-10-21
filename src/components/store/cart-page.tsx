"use client";
// Full cart page (#/cart).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgePercent, ShoppingBasket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/client-api";
import { navigate, href } from "@/lib/router";
import { formatToman, toFaDigits } from "@/lib/money";
import type { CouponValidation } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useCheckoutStore } from "@/hooks/use-checkout-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { EmptyState, ErrorState } from "@/components/store/empty-state";
import { ListRowSkeleton } from "@/components/store/skeletons";
import { LineThumb } from "@/components/store/line-thumb";

export function CartPage() {
  const { cart, isLoading, isError, refetch, updateQty, clear } = useCart();
  const { user } = useAuth();
  const setCouponCode = useCheckoutStore((s) => s.setCouponCode);
  const storedCoupon = useCheckoutStore((s) => s.couponCode);
  const [codeInput, setCodeInput] = useState(storedCoupon ?? "");
  const [couponState, setCouponState] = useState<CouponValidation | null>(null);
  const [checking, setChecking] = useState(false);

  const validateCoupon = async () => {
    const code = codeInput.trim();
    if (!code) return;
    if (!cart || cart.subtotalToman <= 0) {
      toast.warning("ابتدا محصولی به سبد اضافه کنید.");
      return;
    }
    setChecking(true);
    try {
      const res = await apiPost<CouponValidation>("/api/coupons/validate", {
        code,
        subtotalToman: cart.subtotalToman,
      });
      setCouponState(res);
      if (res.valid) {
        setCouponCode(res.code ?? code);
        toast.success(res.message);
      } else {
        setCouponCode(null);
        toast.error(res.message);
      }
    } catch (err) {
      setCouponState(null);
      setCouponCode(null);
      toast.error((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container-store py-8">
        <h1 className="mb-6 text-xl font-extrabold">سبد خرید</h1>
        <ListRowSkeleton rows={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container-store py-8">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  const lines = cart?.lines ?? [];
  if (lines.length === 0) {
    return (
      <div className="container-store py-10">
        <EmptyState
          title="سبد خرید شما خالی است"
          description="از میان لوازم خانگی اصل با گارانتی رسمی انتخاب کنید و خریدی مطمئن داشته باشید."
          action={
            <Button onClick={() => navigate("/")} className="mt-1">
              <ShoppingBasket className="size-4" />
              رفتن به فروشگاه
            </Button>
          }
        />
      </div>
    );
  }

  const goCheckout = () => navigate(user ? "/checkout" : "/login?redirect=/checkout");

  return (
    <div className="container-store py-8">
      <h1 className="mb-6 flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
        <ShoppingBasket className="size-6 text-highlight" aria-hidden />
        سبد خرید
        <span className="text-sm font-normal text-muted-foreground tabular-fa">
          ({toFaDigits(String(cart!.itemCount))} کالا)
        </span>
      </h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Lines */}
        <div className="space-y-3">
          {lines.map((line) => (
            <article key={line.id} className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center">
              <a href={href(`/product/${line.slug}`)} className="shrink-0">
                <LineThumb src={line.image} alt={line.name} size="lg" />
              </a>
              <div className="min-w-0 flex-1">
                <a
                  href={href(`/product/${line.slug}`)}
                  className="line-clamp-2 text-sm font-bold leading-6 hover:text-highlight"
                >
                  {line.name}
                </a>
                {line.variantText && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{line.variantText}</p>
                )}
                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-extrabold tabular-fa">{formatToman(line.unitPriceToman)}</span>
                  {line.originalPriceToman && line.originalPriceToman > line.unitPriceToman && (
                    <span className="text-xs text-muted-foreground line-through tabular-fa">
                      {formatToman(line.originalPriceToman, false)}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">تعداد واحد</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                <div className="flex items-center rounded-lg border">
                  <button
                    type="button"
                    aria-label="افزایش تعداد"
                    className="flex size-9 items-center justify-center rounded-r-lg transition-colors hover:bg-accent disabled:opacity-40"
                    disabled={line.quantity >= line.maxQuantity || updateQty.isPending}
                    onClick={() => updateQty.mutate({ itemId: line.id, quantity: line.quantity + 1 })}
                  >
                    +
                  </button>
                  <span className="w-9 text-center text-sm font-bold tabular-fa">
                    {toFaDigits(String(line.quantity))}
                  </span>
                  <button
                    type="button"
                    aria-label="کاهش تعداد"
                    className="flex size-9 items-center justify-center rounded-l-lg transition-colors hover:bg-accent disabled:opacity-40"
                    disabled={updateQty.isPending}
                    onClick={() => updateQty.mutate({ itemId: line.id, quantity: line.quantity - 1 })}
                  >
                    −
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[15px] font-extrabold tabular-fa">
                    {formatToman(line.lineTotalToman)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground hover:text-destructive"
                    aria-label={`حذف ${line.name} از سبد`}
                    disabled={updateQty.isPending}
                    onClick={() => updateQty.mutate({ itemId: line.id, quantity: 0 })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}

          <div className="flex justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="size-4" />
              ادامه خرید
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="size-4" />
                  خالی کردن سبد
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>خالی کردن کل سبد خرید؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    همه کالاهای سبد حذف می‌شوند. این عمل قابل بازگشت نیست.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => clear.mutate(undefined, { onSuccess: () => toast.info("سبد خرید خالی شد.") })}
                  >
                    بله، خالی کن
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-32 lg:self-start" aria-label="خلاصه سفارش">
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 font-bold">خلاصه سفارش</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">جمع کالاها</span>
                <span className="font-bold tabular-fa">{formatToman(cart!.subtotalToman)}</span>
              </div>
              {cart!.savingsToman > 0 && (
                <div className="flex items-center justify-between text-highlight">
                  <span className="font-bold">سود شما از خرید</span>
                  <span className="font-extrabold tabular-fa">{formatToman(cart!.savingsToman)}</span>
                </div>
              )}
              <Separator />
              <p className="text-xs leading-6 text-muted-foreground">
                هزینه ارسال در مرحله پرداخت و بر اساس آدرس و روش ارسال انتخابی محاسبه می‌شود.
              </p>

              {/* Coupon */}
              <div className="rounded-lg bg-muted/50 p-3">
                <Label htmlFor="coupon-code" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
                  <BadgePercent className="size-4 text-highlight" aria-hidden />
                  کد تخفیف
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="coupon-code"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="مثلاً WELCOME10"
                    className="h-9 bg-white text-xs"
                    dir="ltr"
                  />
                  <Button size="sm" className="h-9 px-4" disabled={checking} onClick={validateCoupon}>
                    {checking ? "…" : "اعمال"}
                  </Button>
                </div>
                {couponState && (
                  <p className={`mt-2 text-xs font-bold ${couponState.valid ? "text-emerald-600" : "text-destructive"}`}>
                    {couponState.message}
                    {couponState.valid && couponState.discountToman > 0 && (
                      <span className="tabular-fa"> ({formatToman(couponState.discountToman)})</span>
                    )}
                  </p>
                )}
              </div>

              <Button className="h-12 w-full text-sm font-bold" onClick={goCheckout}>
                ادامه فرایند خرید
              </Button>
              {!user && (
                <p className="text-center text-[11px] text-muted-foreground">
                  برای ادامه لازم است وارد حساب کاربری شوید.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
