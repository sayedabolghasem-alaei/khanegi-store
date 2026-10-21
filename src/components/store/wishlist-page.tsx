"use client";
// Wishlist page (#/wishlist) — auth required.

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useWishlist, useWishlistToggle } from "@/hooks/use-wishlist";
import { navigate } from "@/lib/router";
import { ProductCard } from "@/components/store/product-card";
import { EmptyState, ErrorState } from "@/components/store/empty-state";
import { ProductGridSkeleton } from "@/components/store/skeletons";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/store/section-header";
import { Heart } from "lucide-react";
import { toFaDigits } from "@/lib/money";

export function WishlistPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { data, isLoading, isError, refetch } = useWishlist(!!user);
  const toggle = useWishlistToggle();

  useEffect(() => {
    document.title = "علاقه‌مندی‌ها";
    if (!authLoading && !user) navigate("/login?redirect=/wishlist", { replace: true });
  }, [authLoading, user]);

  if (authLoading || !user) {
    return (
      <div className="container-store py-10">
        <ProductGridSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="container-store py-8">
      <SectionHeader
        title="علاقه‌مندی‌های من"
        subtitle={data ? `${toFaDigits(String(data.items.length))} کالا در لیست شما` : undefined}
        icon={Heart}
      />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ProductGridSkeleton count={4} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="لیست علاقه‌مندی‌های شما خالی است"
          description="روی آیکون قلب هر محصول بزنید تا برای خرید بعدی ذخیره شود."
          action={<Button onClick={() => navigate("/")}>مشاهده محصولات</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {data!.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
