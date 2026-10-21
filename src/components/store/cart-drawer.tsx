"use client";
// Slide-in cart drawer (opens from the right in RTL layout).

import { useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { useUIStore } from "@/lib/store";
import { href, navigate } from "@/lib/router";
import { formatToman, toFaDigits } from "@/lib/money";
import { EmptyState } from "@/components/store/empty-state";
import { ListRowSkeleton } from "@/components/store/skeletons";

function LineImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed || !src ? "/images/placeholder.svg" : src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-20 shrink-0 rounded-lg border bg-muted/40 object-contain p-1"
    />
  );
}

export function CartDrawer() {
  const open = useUIStore((s) => s.cartOpen);
  const setOpen = useUIStore((s) => s.setCartOpen);
  const { cart, isLoading, updateQty } = useCart();
  const { user } = useAuth();

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const lines = cart?.lines ?? [];
  const isEmpty = !isLoading && lines.length === 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4 text-start">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="size-5 text-highlight" aria-hidden />
            سبد خرید
            {cart && cart.itemCount > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({toFaDigits(String(cart.itemCount))} کالا)
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">سبد خرید شما در خانه‌گی</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <ListRowSkeleton rows={3} />
          ) : isEmpty ? (
            <div className="pt-6">
              <EmptyState
                title="سبد خرید شما خالی است"
                description="از میان لوازم خانگی اصل با گارانتی رسمی، انتخابتان را انجام دهید."
                action={
                  <Button onClick={() => go("/")} className="mt-1">
                    رفتن به فروشگاه
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="space-y-3">
              {lines.map((line) => (
                <li key={line.id} className="rounded-xl border p-3">
                  <div className="flex gap-3">
                    <a href={href(`/product/${line.slug}`)} onClick={() => setOpen(false)}>
                      <LineImage src={line.image} alt={line.name} />
                    </a>
                    <div className="min-w-0 flex-1">
                      <a
                        href={href(`/product/${line.slug}`)}
                        onClick={() => setOpen(false)}
                        className="line-clamp-2 text-[13px] font-bold leading-5 hover:text-highlight"
                      >
                        {line.name}
                      </a>
                      {line.variantText && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{line.variantText}</p>
                      )}
                      <div className="mt-1 text-[13px] font-extrabold tabular-fa">
                        {formatToman(line.unitPriceToman)}
                        {line.originalPriceToman && line.originalPriceToman > line.unitPriceToman && (
                          <span className="ms-2 text-[11px] font-normal text-muted-foreground line-through">
                            {formatToman(line.originalPriceToman, false)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-lg border">
                      <button
                        type="button"
                        aria-label="افزایش تعداد"
                        className="flex size-8 items-center justify-center rounded-r-lg transition-colors hover:bg-accent disabled:opacity-40"
                        disabled={line.quantity >= line.maxQuantity || updateQty.isPending}
                        onClick={() =>
                          updateQty.mutate({ itemId: line.id, quantity: line.quantity + 1 })
                        }
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold tabular-fa">
                        {toFaDigits(String(line.quantity))}
                      </span>
                      <button
                        type="button"
                        aria-label="کاهش تعداد"
                        className="flex size-8 items-center justify-center rounded-l-lg transition-colors hover:bg-accent disabled:opacity-40"
                        disabled={updateQty.isPending}
                        onClick={() =>
                          updateQty.mutate({ itemId: line.id, quantity: line.quantity - 1 })
                        }
                      >
                        <Minus className="size-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-fa">
                        {formatToman(line.lineTotalToman)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label={`حذف ${line.name} از سبد`}
                        disabled={updateQty.isPending}
                        onClick={() => updateQty.mutate({ itemId: line.id, quantity: 0 })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!isEmpty && cart && (
          <div className="border-t bg-muted/30 p-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">جمع کل سبد</span>
              <span className="text-base font-extrabold tabular-fa">
                {formatToman(cart.subtotalToman)}
              </span>
            </div>
            {cart.savingsToman > 0 && (
              <p className="mb-2 text-xs font-bold text-highlight tabular-fa">
                سود شما از این خرید: {formatToman(cart.savingsToman)}
              </p>
            )}
            <Separator className="my-3" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => go("/cart")}>
                مشاهده سبد خرید
              </Button>
              <Button
                onClick={() => go(user ? "/checkout" : "/login?redirect=/checkout")}
              >
                ادامه فرایند خرید
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function CartDrawerSkeleton() {
  return <Skeleton className="h-9 w-24" />;
}
