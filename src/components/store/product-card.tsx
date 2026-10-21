"use client";
// Product card used in all grids (home, catalog, wishlist, related…).

import { memo, useState } from "react";
import { GitCompareArrows, Heart, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import type { ProductCard as ProductCardDTO } from "@/lib/types";
import { href, navigate } from "@/lib/router";
import { toFaDigits } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useUIStore, useCompareStore } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useWishlistToggle } from "@/hooks/use-wishlist";
import { useCompareMetaStore } from "@/hooks/use-compare-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/store/rating-stars";
import { PriceTag } from "@/components/store/price-tag";

function ProductImage({ product, className }: { product: ProductCardDTO; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed || !product.image ? "/images/placeholder.svg" : product.image}
      alt={product.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("h-full w-full object-contain", className)}
    />
  );
}

export const ProductCard = memo(function ProductCard({ product }: { product: ProductCardDTO }) {
  const { user } = useAuth();
  const { addItem } = useCart();
  const wishlistToggle = useWishlistToggle();
  const compareToggle = useCompareStore((s) => s.toggle);
  const rememberCompare = useCompareMetaStore((s) => s.remember);
  const setCartOpen = useUIStore((s) => s.setCartOpen);
  const oos = product.stock <= 0;
  const lowStock = !oos && product.stock <= 3;

  const onWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.info("برای افزودن به علاقه‌مندی‌ها ابتدا وارد حساب شوید.");
      navigate("/login?redirect=/wishlist");
      return;
    }
    wishlistToggle.mutate(product.id, {
      onSuccess: (res) => {
        const exists = res.items.some((i) => i.id === product.id);
        toast.success(exists ? "به علاقه‌مندی‌ها اضافه شد." : "از علاقه‌مندی‌ها حذف شد.");
      },
    });
  };

  const onCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = compareToggle(product.id);
    if (result === "full") {
      toast.warning("حداکثر ۴ محصول می‌توانند در مقایسه باشند.");
      return;
    }
    if (result === "added") {
      rememberCompare({
        id: product.id,
        slug: product.slug,
        name: product.name,
        image: product.image,
        priceToman: product.priceToman,
        brandName: product.brand.name,
      });
      toast.success("به لیست مقایسه اضافه شد.");
    } else {
      toast.info("از لیست مقایسه حذف شد.");
    }
  };

  const onQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (oos) return;
    addItem.mutate(
      { productId: product.id, quantity: 1 },
      { onSuccess: () => toast.success(`«${product.name}» به سبد خرید اضافه شد.`) }
    );
  };

  return (
    <article className="card-lift group relative flex flex-col overflow-hidden rounded-xl border bg-white">
      {/* Badges */}
      <div className="absolute start-2 top-2 z-10 flex flex-col items-start gap-1">
        {product.discountPercent > 0 && (
          <Badge className="bg-highlight text-highlight-foreground tabular-fa">
            {toFaDigits(String(product.discountPercent))}٪ تخفیف
          </Badge>
        )}
        {product.isNew && (
          <Badge variant="secondary" className="bg-white/90 text-[10px] text-primary">
            جدید
          </Badge>
        )}
        {lowStock && (
          <Badge variant="outline" className="bg-white/90 text-[10px] tabular-fa text-destructive">
            فقط {toFaDigits(String(product.stock))} عدد
          </Badge>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute end-2 top-2 z-10 flex flex-col gap-1.5 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-lg bg-white/95"
          aria-label="افزودن به علاقه‌مندی‌ها"
          onClick={onWishlist}
        >
          <Heart className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-lg bg-white/95"
          aria-label="افزودن به مقایسه"
          onClick={onCompare}
        >
          <GitCompareArrows className="size-4" />
        </Button>
      </div>

      {/* Image + link */}
      <a
        href={href(`/product/${product.slug}`)}
        className="relative block aspect-square overflow-hidden bg-muted/40 p-4"
        aria-label={product.name}
      >
        <ProductImage
          product={product}
          className="transition-transform duration-300 group-hover:scale-105"
        />
        {oos && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-full bg-foreground/80 px-4 py-1.5 text-sm font-bold text-white">
              ناموجود
            </span>
          </span>
        )}
      </a>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <a
          href={href(`/product/${product.slug}`)}
          className="line-clamp-2 min-h-10 text-[13px] font-bold leading-5 transition-colors hover:text-highlight"
        >
          {product.name}
        </a>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">{product.brand.name}</span>
          <RatingStars value={product.ratingAvg} count={product.ratingCount} />
        </div>

        <div className="mt-auto pt-1.5">
          <PriceTag
            price={product.priceToman}
            original={product.originalPriceToman}
            size="sm"
          />
          <Button
            size="sm"
            className="mt-2.5 h-9 w-full rounded-lg text-xs font-bold"
            disabled={oos || addItem.isPending}
            onClick={onQuickAdd}
            aria-label={`افزودن ${product.name} به سبد خرید`}
          >
            <ShoppingCart className="size-4" />
            {oos ? "ناموجود" : "افزودن به سبد"}
          </Button>
        </div>
      </div>
    </article>
  );
});
