"use client";
// Checkout wizard (#/checkout): ① address → ② shipping → ③ review & pay.
// Guard: requires an authenticated user.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgePercent, Check, MapPin, Plus, ShoppingBasket, Truck } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/client-api";
import { navigate } from "@/lib/router";
import { formatToman, toFaDigits } from "@/lib/money";
import type {
  AddressDTO,
  CartPayload,
  CouponValidation,
  OrderDTO,
  ShippingMethodDTO,
} from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useCheckoutStore } from "@/hooks/use-checkout-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/store/empty-state";
import { LineThumb } from "@/components/store/line-thumb";
import { AddressForm } from "@/components/store/address-form";
import { cn } from "@/lib/utils";

/* ─────────────────────────────── Stepper UI ───────────────────────────── */

const STEPS = ["آدرس تحویل", "شیوه ارسال", "بازبینی و پرداخت"] as const;

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2" aria-label="مراحل خرید">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular-fa transition-colors",
                done && "border-highlight bg-highlight text-highlight-foreground",
                active && "border-highlight bg-highlight-soft text-highlight",
                !done && !active && "border-border bg-white text-muted-foreground"
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="size-4" aria-hidden /> : toFaDigits(String(i + 1))}
            </span>
            <span
              className={cn(
                "hidden text-[13px] font-bold sm:inline",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className={cn("h-0.5 flex-1 rounded", done ? "bg-highlight" : "bg-border")} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ─────────────────────────────── Checkout ─────────────────────────────── */

export function CheckoutPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { cart, isLoading: cartLoading, isError: cartError, refetch: refetchCart } = useCart();
  const qc = useQueryClient();
  const couponCode = useCheckoutStore((s) => s.couponCode);
  const setCouponCode = useCheckoutStore((s) => s.setCouponCode);

  const [step, setStep] = useState(0);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [couponState, setCouponState] = useState<CouponValidation | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) navigate("/login?redirect=/checkout", { replace: true });
  }, [authLoading, user]);

  const addresses = useQuery({
    queryKey: ["addresses"],
    queryFn: () => apiGet<AddressDTO[]>("/api/addresses"),
    enabled: !!user,
  });

  const methods = useQuery({
    queryKey: ["shipping-methods"],
    queryFn: () => apiGet<ShippingMethodDTO[]>("/api/shipping/methods"),
    staleTime: 5 * 60_000,
  });

  // Default selections
  useEffect(() => {
    if (addresses.data && addresses.data.length > 0 && !selectedAddressId) {
      const def = addresses.data.find((a) => a.isDefault) ?? addresses.data[0];
      setSelectedAddressId(def.id);
    }
    if (addresses.data && addresses.data.length === 0) setShowNewAddress(true);
  }, [addresses.data, selectedAddressId]);

  const selectedMethod = useMemo(
    () => methods.data?.find((m) => m.id === selectedMethodId) ?? null,
    [methods.data, selectedMethodId]
  );

  const subtotal = cart?.subtotalToman ?? 0;

  // Auto-select cheapest shipping method once loaded
  useEffect(() => {
    if (methods.data && methods.data.length > 0 && !selectedMethodId) {
      setSelectedMethodId(methods.data[0].id);
    }
  }, [methods.data, selectedMethodId]);

  // Revalidate coupon when entering review step
  useEffect(() => {
    if (step !== 2) return;
    if (!couponCode || subtotal <= 0) {
      setCouponState(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setCheckingCoupon(true);
      try {
        const res = await apiPost<CouponValidation>("/api/coupons/validate", {
          code: couponCode,
          subtotalToman: subtotal,
        });
        if (!cancelled) {
          setCouponState(res);
          if (!res.valid) setCouponCode(null);
        }
      } catch {
        if (!cancelled) {
          setCouponState(null);
          setCouponCode(null);
        }
      } finally {
        if (!cancelled) setCheckingCoupon(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, couponCode, subtotal, setCouponCode]);

  const shippingCost = selectedMethod
    ? selectedMethod.freeThresholdToman !== null && subtotal >= selectedMethod.freeThresholdToman
      ? 0
      : selectedMethod.costToman
    : 0;
  const discount = couponState?.valid ? couponState.discountToman : 0;
  const total = Math.max(0, subtotal - discount) + shippingCost;

  const placeOrder = useMutation({
    mutationFn: () =>
      apiPost<{ order: OrderDTO }>("/api/orders", {
        addressId: selectedAddressId,
        shippingMethodId: selectedMethodId,
        couponCode: couponState?.valid ? couponState.code : undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: ({ order }) => {
      setCouponCode(null);
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("سفارش شما با موفقیت ثبت شد!");
      navigate(`/order/${order.orderNumber}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      refetchCart();
    },
  });

  if (authLoading || !user) {
    return (
      <div className="container-store py-10">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (cartLoading) {
    return (
      <div className="container-store py-10">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (cartError) {
    return (
      <div className="container-store py-10">
        <ErrorState onRetry={() => refetchCart()} />
      </div>
    );
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="container-store py-10">
        <EmptyState
          title="سبد خرید شما خالی است"
          description="برای ادامه فرایند خرید ابتدا محصولی به سبد اضافه کنید."
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

  const selectedAddress = addresses.data?.find((a) => a.id === selectedAddressId) ?? null;

  return (
    <div className="container-store py-8">
      <h1 className="mb-2 text-xl font-extrabold sm:text-2xl">تکمیل خرید</h1>
      <p className="mb-6 text-[13px] text-muted-foreground">
        در سه ساده مرحله سفارش خود را نهایی کنید. تمام پرداخت‌ها در این نسخه نمایشی‌اند.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <Stepper current={step} />

          {/* Step 1: Address */}
          {step === 0 && (
            <div className="space-y-4">
              {addresses.isLoading ? (
                <Skeleton className="h-28 w-full rounded-xl" />
              ) : addresses.isError ? (
                <ErrorState onRetry={() => addresses.refetch()} />
              ) : (addresses.data?.length ?? 0) > 0 && !showNewAddress ? (
                <RadioGroup
                  value={selectedAddressId ?? ""}
                  onValueChange={setSelectedAddressId}
                  className="gap-3"
                  aria-label="انتخاب آدرس تحویل"
                >
                  {addresses.data!.map((a) => (
                    <label
                      key={a.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition-colors",
                        selectedAddressId === a.id ? "border-highlight ring-2 ring-ring/30" : "hover:border-ring/50"
                      )}
                    >
                      <RadioGroupItem value={a.id} className="mt-1" />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="flex flex-wrap items-center gap-2 font-bold">
                          <MapPin className="size-4 text-highlight" aria-hidden />
                          {a.title || "آدرس"}
                          {a.isDefault && (
                            <span className="rounded-full bg-highlight-soft px-2 py-0.5 text-[10px] font-bold text-highlight">
                              پیش‌فرض
                            </span>
                          )}
                        </p>
                        <p className="mt-1 leading-6 text-muted-foreground">
                          {a.province}، {a.city}، {a.line}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground tabular-fa">
                          گیرنده: {a.receiverName} — {toFaDigits(a.phone)}
                        </p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              ) : null}

              {showNewAddress ? (
                <AddressForm
                  onSaved={(a) => {
                    setSelectedAddressId(a.id);
                    setShowNewAddress(false);
                  }}
                  onCancel={() => setShowNewAddress(false)}
                />
              ) : (
                <Button variant="outline" onClick={() => setShowNewAddress(true)}>
                  <Plus className="size-4" />
                  افزودن آدرس جدید
                </Button>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  size="lg"
                  className="px-8 font-bold"
                  disabled={!selectedAddressId}
                  onClick={() => setStep(1)}
                >
                  مرحله بعد: ارسال
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Shipping */}
          {step === 1 && (
            <div className="space-y-4">
              {methods.isLoading ? (
                <Skeleton className="h-28 w-full rounded-xl" />
              ) : methods.isError ? (
                <ErrorState onRetry={() => methods.refetch()} />
              ) : (
                <RadioGroup
                  value={selectedMethodId ?? ""}
                  onValueChange={setSelectedMethodId}
                  className="gap-3"
                  aria-label="انتخاب شیوه ارسال"
                >
                  {methods.data!.map((m) => {
                    const free = m.freeThresholdToman !== null && subtotal >= m.freeThresholdToman;
                    return (
                      <label
                        key={m.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition-colors",
                          selectedMethodId === m.id ? "border-highlight ring-2 ring-ring/30" : "hover:border-ring/50"
                        )}
                      >
                        <RadioGroupItem value={m.id} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                            <Truck className="size-4 text-highlight" aria-hidden />
                            {m.name}
                            {free && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                ارسال رایگان
                              </span>
                            )}
                          </p>
                          {m.description && (
                            <p className="mt-1 text-xs leading-6 text-muted-foreground">{m.description}</p>
                          )}
                          {m.estimatedDays && (
                            <p className="mt-0.5 text-xs text-muted-foreground tabular-fa">
                              زمان تحویل تقریبی: {m.estimatedDays}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-sm font-extrabold tabular-fa">
                          {free ? "رایگان" : formatToman(m.costToman)}
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              )}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(0)}>
                  مرحله قبل
                </Button>
                <Button size="lg" className="px-8 font-bold" disabled={!selectedMethodId} onClick={() => setStep(2)}>
                  مرحله بعد: بازبینی
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-white p-5">
                <h3 className="mb-3 font-bold">اطلاعات ارسال</h3>
                {selectedAddress && (
                  <div className="text-sm leading-7 text-muted-foreground">
                    <p className="font-bold text-foreground">
                      {selectedAddress.title || "آدرس"} — گیرنده: {selectedAddress.receiverName}
                    </p>
                    <p>
                      {selectedAddress.province}، {selectedAddress.city}، {selectedAddress.line}
                    </p>
                    <p className="tabular-fa">
                      کدپستی: {toFaDigits(selectedAddress.postalCode)} — تلفن: {toFaDigits(selectedAddress.phone)}
                    </p>
                  </div>
                )}
                {selectedMethod && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-bold">
                    <Truck className="size-4 text-highlight" aria-hidden />
                    {selectedMethod.name}
                    <span className="font-normal text-muted-foreground tabular-fa">
                      ({shippingCost === 0 ? "رایگان" : formatToman(shippingCost)})
                    </span>
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep(0)}>
                    تغییر آدرس
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                    تغییر ارسال
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="order-note" className="text-[13px]">
                  یادداشت سفارش (اختیاری)
                </Label>
                <Textarea
                  id="order-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder="مثلاً: لطفاً قبل از ارسال تماس بگیرید."
                  className="mt-1.5 bg-white"
                />
              </div>

              <div className="flex flex-col items-start justify-between gap-3 rounded-xl border bg-white p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-bold">مبلغ قابل پرداخت</p>
                  <p className="mt-1 text-2xl font-black text-highlight tabular-fa">{formatToman(total)}</p>
                </div>
                <Button
                  size="lg"
                  className="h-12 px-8 font-bold"
                  disabled={placeOrder.isPending || checkingCoupon}
                  onClick={() => placeOrder.mutate()}
                >
                  {placeOrder.isPending ? "در حال ثبت…" : "ثبت نهایی سفارش"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Summary sidebar */}
        <aside className="lg:sticky lg:top-32 lg:self-start" aria-label="خلاصه سفارش">
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 font-bold">خلاصه سفارش</h2>
            <ul className="max-h-56 space-y-3 overflow-y-auto pe-1">
              {cart.lines.map((l) => (
                <li key={l.id} className="flex items-center gap-3">
                  <LineThumb src={l.image} alt={l.name} />
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="line-clamp-2 font-bold leading-5">{l.name}</p>
                    <p className="mt-0.5 text-muted-foreground tabular-fa">
                      {toFaDigits(String(l.quantity))} × {formatToman(l.unitPriceToman)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <Separator className="my-4" />
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">جمع کالاها</span>
                <span className="font-bold tabular-fa">{formatToman(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-highlight">
                  <span className="flex items-center gap-1 font-bold">
                    <BadgePercent className="size-4" aria-hidden />
                    تخفیف ({couponState?.code})
                  </span>
                  <span className="font-bold tabular-fa">−{formatToman(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">هزینه ارسال</span>
                <span className="font-bold tabular-fa">
                  {shippingCost === 0 ? (selectedMethod ? "رایگان" : "—") : formatToman(shippingCost)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base">
                <span className="font-bold">مبلغ نهایی</span>
                <span className="font-black text-highlight tabular-fa">{formatToman(total)}</span>
              </div>
              {couponState && !couponState.valid && (
                <p className="text-xs text-destructive">{couponState.message}</p>
              )}
              <p className="text-[11px] leading-5 text-muted-foreground">
                با ثبت سفارش، شرایط و قوانین خانه‌گی را می‌پذیرید.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
