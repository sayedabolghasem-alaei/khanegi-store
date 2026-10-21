"use client";
// Product detail page (#/product/:slug): gallery, variants, cart, reviews,
// specs, related products and JSON-LD.

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  GitCompareArrows,
  Heart,
  MapPin,
  Minus,
  Plus,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Waypoints,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/client-api";
import { href, navigate } from "@/lib/router";
import { formatToman, toFaDigits, formatDateTimeFa } from "@/lib/money";
import { MAX_QTY_PER_LINE } from "@/lib/constants";
import { useUIStore } from "@/lib/store";
import type { ProductDetail } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useWishlist, useWishlistToggle } from "@/hooks/use-wishlist";
import { useCompareStore } from "@/lib/store";
import { useCompareMetaStore } from "@/hooks/use-compare-meta";
import { useRecentItemsStore } from "@/hooks/use-recent-items";
import { ProductCard } from "@/components/store/product-card";
import { RatingStars } from "@/components/store/rating-stars";
import { PriceTag } from "@/components/store/price-tag";
import { SectionHeader } from "@/components/store/section-header";
import { ErrorState } from "@/components/store/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PRODUCT_FAQS = [
  {
    q: "این کالا گارانتی رسمی دارد؟",
    a: "بله، تمام کالاهای خانه‌گی دارای گارانتی رسمی برند هستند؛ مدت گارانتی در همین صفحه درج شده و کد آن همراه فاکتور تحویل می‌شود.",
  },
  {
    q: "چه زمانی ارسال می‌شود؟",
    a: "سفارش‌های ثبت‌شده تا ساعت ۱۴ همان روز پردازش می‌شوند. زمان تحویل بسته به روش ارسال انتخابی شما در مرحله پرداخت اعلام می‌گردد.",
  },
  {
    q: "امکان بازگشت کالا وجود دارد؟",
    a: "تا ۷ روز پس از تحویل و در صورت سالم‌بودن بسته‌بندی، بازگشت کالا بدون قید و شرط پذیرفته می‌شود.",
  },
  {
    q: "نصب دستگاه هم انجام می‌شود؟",
    a: "برای کولر گازی و برخی لوازم بزرگ، نصب از طریق نمایندگی رسمی برند با هزینه جداگانه هماهنگ می‌شود. [نشان‌گذاری آزمایشی]",
  },
];

/* ─────────────────────────────── Gallery ──────────────────────────────── */

function Gallery({ product }: { product: ProductDetail }) {
  const images = product.images.length > 0 ? product.images : [{ url: "/images/placeholder.svg", alt: product.name }];
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const imgRef = useRef<HTMLDivElement>(null);

  const current = images[Math.min(index, images.length - 1)];

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={imgRef}
        className="relative aspect-square overflow-hidden rounded-xl border bg-muted/40"
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={onMouseMove}
      >
        <img
          src={failed[index] ? "/images/placeholder.svg" : current.url}
          alt={current.alt || product.name}
          className="h-full w-full object-contain transition-transform duration-200"
          style={{
            transform: zoom ? "scale(1.8)" : "scale(1)",
            transformOrigin: origin,
          }}
          onError={() => setFailed((f) => ({ ...f, [index]: true }))}
        />
        {product.discountPercent > 0 && (
          <Badge className="absolute start-3 top-3 bg-highlight tabular-fa text-highlight-foreground">
            {toFaDigits(String(product.discountPercent))}٪ تخفیف
          </Badge>
        )}
        {product.stock <= 0 && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-full bg-foreground/80 px-5 py-2 text-base font-bold text-white">
              ناموجود
            </span>
          </span>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label="تصاویر محصول">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              role="option"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-lg border-2 bg-muted/40 p-1 transition-colors",
                i === index ? "border-highlight" : "border-transparent hover:border-border"
              )}
            >
              <img
                src={failed[i] ? "/images/placeholder.svg" : img.url}
                alt={img.alt || `${product.name} — تصویر ${toFaDigits(String(i + 1))}`}
                loading="lazy"
                className="h-full w-full object-contain"
                onError={() => setFailed((f) => ({ ...f, [i]: true }))}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────── Reviews tab ─────────────────────────────── */

function ReviewsSection({ product }: { product: ProductDetail }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      apiPost("/api/reviews", {
        productId: product.id,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
      }),
    onSuccess: () => {
      toast.success("دیدگاه شما ثبت شد و پس از تأیید مدیر نمایش داده می‌شود. سپاس از همراهی‌تان!");
      setRating(0);
      setTitle("");
      setComment("");
      qc.invalidateQueries({ queryKey: ["product", product.slug] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const totalReviews = product.ratingBreakdown.reduce((s, b) => s + b.count, 0);
  const byStar = new Map(product.ratingBreakdown.map((b) => [b.star, b.count]));

  return (
    <div className="space-y-6">
      {/* Summary + bars */}
      <div className="grid gap-6 rounded-xl border bg-muted/30 p-5 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center gap-1 sm:min-w-36">
          <span className="text-4xl font-black tabular-fa">{toFaDigits(product.ratingAvg.toFixed(1))}</span>
          <RatingStars value={product.ratingAvg} showValue={false} size="md" />
          <span className="text-xs text-muted-foreground tabular-fa">
            از {toFaDigits(String(product.ratingCount))} دیدگاه
          </span>
        </div>
        <div className="space-y-2 self-center">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = byStar.get(star) ?? 0;
            const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-8 shrink-0 tabular-fa text-muted-foreground">
                  {toFaDigits(String(star))} ★
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 shrink-0 text-left tabular-fa text-muted-foreground">
                  {toFaDigits(String(count))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review list */}
      {product.reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          هنوز دیدگاهی ثبت نشده؛ اولین نفر باشید!
        </p>
      ) : (
        <ul className="space-y-4">
          {product.reviews.map((r) => (
            <li key={r.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <RatingStars value={r.rating} showValue={false} />
                  {r.title && <span className="text-sm font-bold">{r.title}</span>}
                  {r.isVerifiedPurchase && (
                    <span className="inline-flex w-fit items-center gap-1 rounded-md border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                      خرید تأییدشده
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{formatDateTimeFa(r.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-foreground/90">{r.comment}</p>
              {r.adminReply && (
                <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
                  <p className="text-xs font-extrabold text-teal-800">پاسخ فروشگاه</p>
                  <p className="mt-1 text-sm leading-6 text-teal-900/90">{r.adminReply}</p>
                </div>
              )}
              <p className="mt-2 text-xs font-bold text-muted-foreground">{r.userName}</p>
            </li>
          ))}
        </ul>
      )}

      <Separator />

      {/* Review form */}
      {user ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (rating < 1) {
              toast.warning("لطفاً امتیاز خود را انتخاب کنید.");
              return;
            }
            if (comment.trim().length < 3) {
              toast.warning("متن دیدگاه نمی‌تواند خالی باشد.");
              return;
            }
            submit.mutate();
          }}
        >
          <h3 className="font-bold">ثبت دیدگاه شما</h3>
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="امتیاز شما">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={rating === s}
                aria-label={`${s} ستاره`}
                className="rounded p-1 transition-transform hover:scale-110"
                onClick={() => setRating(s)}
              >
                <StarIcon filled={s <= rating} />
              </button>
            ))}
          </div>
          <div>
            <Label htmlFor="review-title">عنوان (اختیاری)</Label>
            <Input
              id="review-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="mt-1.5 bg-white"
              placeholder="مثلاً: کیفیت ساخت فوق‌العاده"
            />
          </div>
          <div>
            <Label htmlFor="review-comment">متن دیدگاه</Label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={2000}
              className="mt-1.5 bg-white"
              placeholder="تجربه خود از این محصول را بنویسید…"
            />
          </div>
          <Button type="submit" disabled={submit.isPending} className="font-bold">
            {submit.isPending ? "در حال ارسال…" : "ارسال دیدگاه"}
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">برای ثبت دیدگاه ابتدا وارد حساب کاربری شوید.</p>
          <Button size="sm" onClick={() => navigate(`/login?redirect=/product/${product.slug}`)}>
            ورود به حساب
          </Button>
        </div>
      )}
    </div>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-6", filled ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/40")}
      aria-hidden
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/* ──────────────────────────── Specs helpers ───────────────────────────── */

function SpecsTable({ product }: { product: ProductDetail }) {
  const groups = new Map<string, { key: string; value: string }[]>();
  for (const attr of product.attributes) {
    const g = attr.group ?? "مشخصات کلی";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push({ key: attr.key, value: attr.value });
  }
  if (groups.size === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        مشخصات فنی این محصول به‌زودی تکمیل می‌شود.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([group, rows]) => (
        <div key={group}>
          <h3 className="mb-2 border-b pb-2 font-bold">{group}</h3>
          <dl className="overflow-hidden rounded-xl border">
            {rows.map((row, i) => (
              <div
                key={i}
                className={cn("grid grid-cols-[140px_1fr] text-sm sm:grid-cols-[200px_1fr]", i % 2 === 0 ? "bg-muted/40" : "bg-white")}
              >
                <dt className="border-l p-3 font-bold text-muted-foreground">{row.key}</dt>
                <dd className="p-3">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <div>
        <h3 className="mb-2 border-b pb-2 font-bold">اطلاعات کلی</h3>
        <dl className="overflow-hidden rounded-xl border">
          <div className="grid grid-cols-[140px_1fr] bg-muted/40 text-sm sm:grid-cols-[200px_1fr]">
            <dt className="border-l p-3 font-bold text-muted-foreground">کد کالا (SKU)</dt>
            <dd className="p-3" dir="ltr">{product.sku}</dd>
          </div>
          {product.model && (
            <div className="grid grid-cols-[140px_1fr] bg-white text-sm sm:grid-cols-[200px_1fr]">
              <dt className="border-l p-3 font-bold text-muted-foreground">مدل</dt>
              <dd className="p-3" dir="ltr">{product.model}</dd>
            </div>
          )}
          {product.warrantyMonths && (
            <div className="grid grid-cols-[140px_1fr] bg-muted/40 text-sm sm:grid-cols-[200px_1fr]">
              <dt className="border-l p-3 font-bold text-muted-foreground">گارانتی</dt>
              <dd className="p-3 tabular-fa">{toFaDigits(String(product.warrantyMonths))} ماه گارانتی رسمی</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

/* ──────────────────────────── Product page ────────────────────────────── */

export function ProductPage({ slug }: { slug: string }) {
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { addItem } = useCart();
  const wishlistToggle = useWishlistToggle();
  const { data: wishlist } = useWishlist(!!user);
  const compareToggle = useCompareStore((s) => s.toggle);
  const rememberCompare = useCompareMetaStore((s) => s.remember);
  const pushRecent = useRecentItemsStore((s) => s.push);
  const setCartOpen = useUIStore((s) => s.setCartOpen);
  const [qty, setQty] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  const { data: product, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => apiGet<ProductDetail>(`/api/products/${encodeURIComponent(slug)}`),
    retry: 1,
  });

  // Push to recently viewed + set document title + JSON-LD
  useEffect(() => {
    if (!product) return;
    document.title = product.name;
    pushRecent({
      slug: product.slug,
      name: product.name,
      image: product.image,
      priceToman: product.priceToman,
      originalPriceToman: product.originalPriceToman,
      discountPercent: product.discountPercent,
      brandName: product.brand.name,
      categoryName: product.category.name,
    });

    const ld = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      sku: product.sku,
      image: product.images.map((i) => i.url),
      brand: { "@type": "Brand", name: product.brand.nameEn || product.brand.name },
      offers: {
        "@type": "Offer",
        priceCurrency: "IRT",
        price: product.priceToman,
        availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
      ...(product.ratingCount > 0
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: product.ratingAvg,
              reviewCount: product.ratingCount,
            },
          }
        : {}),
    };
    const script = document.createElement("script");
    script.id = "product-jsonld";
    script.type = "application/ld+json";
    script.text = JSON.stringify(ld);
    document.head.appendChild(script);
    return () => {
      document.getElementById("product-jsonld")?.remove();
    };
  }, [product, pushRecent]);

  const variantGroups = useMemo(() => {
    const map = new Map<string, ProductDetail["variants"]>();
    for (const v of product?.variants ?? []) {
      if (!map.has(v.name)) map.set(v.name, []);
      map.get(v.name)!.push(v);
    }
    return [...map.entries()];
  }, [product]);

  if (isLoading) {
    return (
      <div className="container-store py-6">
        <Skeleton className="mb-4 h-5 w-64" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container-store py-10">
        <ErrorState
          message={(error as Error | null)?.message ?? "محصول یافت نشد یا خطایی رخ داد."}
          onRetry={() => refetch()}
        />
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate("/")}>
            بازگشت به صفحه اصلی
          </Button>
        </div>
      </div>
    );
  }

  const selectedVariant = variantGroups.length
    ? product.variants.find((v) => v.name === variantGroups[0][0] && selectedVariants[v.name] === v.id) ?? null
    : null;

  const extraPrice = variantGroups.reduce((sum, [name]) => {
    const selected = product.variants.find((v) => v.name === name && selectedVariants[name] === v.id);
    return sum + (selected?.extraPriceToman ?? 0);
  }, 0);

  const displayPrice = product.priceToman + extraPrice;
  const displayOriginal = product.originalPriceToman ? product.originalPriceToman + extraPrice : null;
  const effectiveStock = selectedVariant ? Math.min(selectedVariant.stock, product.stock) : product.stock;
  const oos = effectiveStock <= 0;
  const maxQty = Math.max(1, Math.min(effectiveStock, MAX_QTY_PER_LINE));
  const inWishlist = !!user && (wishlist?.items ?? []).some((i) => i.id === product.id);

  const onAddToCart = () => {
    if (oos) return;
    addItem.mutate(
      {
        productId: product.id,
        variantId: selectedVariant?.id ?? null,
        quantity: qty,
      },
      {
        onSuccess: () => {
          toast.success(`«${product.name}» به سبد خرید اضافه شد.`);
          setCartOpen(true);
        },
      }
    );
  };

  const onWishlist = () => {
    if (!user) {
      toast.info("برای افزودن به علاقه‌مندی‌ها ابتدا وارد حساب شوید.");
      navigate(`/login?redirect=/product/${product.slug}`);
      return;
    }
    wishlistToggle.mutate(product.id, {
      onSuccess: (res) => {
        const exists = res.items.some((i) => i.id === product.id);
        toast.success(exists ? "به علاقه‌مندی‌ها اضافه شد." : "از علاقه‌مندی‌ها حذف شد.");
      },
    });
  };

  const onCompare = () => {
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

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("لینک محصول کپی شد.");
    } catch {
      toast.error("کپی لینک ممکن نشد.");
    }
  };

  return (
    <div className="container-store py-6">
      {/* Breadcrumbs */}
      <nav aria-label="مسیر صفحه" className="mb-4 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
        <a href={href("/")} className="transition-colors hover:text-highlight">خانه</a>
        <ChevronLeft className="size-3.5" aria-hidden />
        <a href={href(`/category/${product.category.slug}`)} className="transition-colors hover:text-highlight">
          {product.category.name}
        </a>
        <ChevronLeft className="size-3.5" aria-hidden />
        <span className="line-clamp-2-fa font-bold text-foreground">{product.name}</span>
      </nav>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid gap-8 lg:grid-cols-2"
      >
        <Gallery key={product.id} product={product} />

        {/* Info column */}
        <div className="flex flex-col gap-4">
          <div>
            <a
              href={href(`/category/${product.category.slug}`)}
              className="text-[13px] font-bold text-highlight hover:underline"
            >
              {product.brand.name}
            </a>
            <h1 className="mt-1 text-xl font-extrabold leading-8 sm:text-2xl">{product.name}</h1>
            {product.nameEn && (
              <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">{product.nameEn}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <RatingStars value={product.ratingAvg} count={product.ratingCount} size="md" />
            <span className="text-xs text-muted-foreground tabular-fa">
              {toFaDigits(String(product.viewCount))} بازدید
            </span>
          </div>

          {/* Price + stock */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PriceTag price={displayPrice} original={displayOriginal} size="lg" />
              {oos ? (
                <Badge variant="outline" className="border-destructive/40 text-destructive">ناموجود</Badge>
              ) : effectiveStock <= 3 ? (
                <Badge variant="outline" className="border-amber-500/50 bg-amber-50 text-amber-700 tabular-fa">
                  فقط {toFaDigits(String(effectiveStock))} عدد باقی مانده
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-600/40 bg-emerald-50 text-emerald-700">
                  موجود در انبار
                </Badge>
              )}
            </div>
            {extraPrice > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                قیمت نمایش‌شده شامل مشخصات انتخابی شماست.
              </p>
            )}
          </div>

          {/* Color options */}
          {product.colorOptions.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-bold">رنگ:</p>
              <div className="flex flex-wrap gap-2">
                {product.colorOptions.map((c) => (
                  <span
                    key={c.name}
                    className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium"
                    title={c.name}
                  >
                    <span className="size-4 rounded-full border" style={{ backgroundColor: c.hex }} aria-hidden />
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Variant selects */}
          {variantGroups.map(([name, options]) => {
            const selectedId = selectedVariants[name];
            const hasStockOptions = options.some((o) => o.stock > 0);
            return (
              <div key={name}>
                <Label className="mb-1.5 text-[13px] font-bold">{name}:</Label>
                <Select
                  value={selectedId ?? ""}
                  onValueChange={(v) => setSelectedVariants((s) => ({ ...s, [name]: v }))}
                >
                  <SelectTrigger className="h-10 w-full bg-white sm:w-64" aria-label={`انتخاب ${name}`}>
                    <SelectValue placeholder={hasStockOptions ? `انتخاب ${name}` : `${name} (ناموجود)`} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={o.id} disabled={o.stock <= 0}>
                        <span className="flex items-center gap-2">
                          {o.value}
                          {o.extraPriceToman > 0 && (
                            <span className="text-xs text-highlight tabular-fa">
                              (+{formatToman(o.extraPriceToman)})
                            </span>
                          )}
                          {o.stock <= 0 && <span className="text-xs text-destructive">(ناموجود)</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}

          {/* Warranty & delivery */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5 rounded-xl border bg-white p-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-highlight" aria-hidden />
              <div className="text-xs leading-5">
                <p className="font-bold">گارانتی اصالت</p>
                <p className="text-muted-foreground">
                  {product.warrantyMonths
                    ? `${toFaDigits(String(product.warrantyMonths))} ماه گارانتی رسمی برند`
                    : "گارانتی رسمی برند"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border bg-white p-3">
              <Truck className="mt-0.5 size-5 shrink-0 text-highlight" aria-hidden />
              <div className="text-xs leading-5">
                <p className="font-bold">ارسال سریع</p>
                <p className="text-muted-foreground">به سراسر ایران، بسته‌بندی ایمن</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border bg-white p-3">
              <Waypoints className="mt-0.5 size-5 shrink-0 text-highlight" aria-hidden />
              <div className="text-xs leading-5">
                <p className="font-bold">۷ روز بازگشت</p>
                <p className="text-muted-foreground">ضمانت بازگشت بی‌قید و شرط</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border bg-white p-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-highlight" aria-hidden />
              <div className="text-xs leading-5">
                <p className="font-bold">پرداخت در محل</p>
                <p className="text-muted-foreground">به‌زودی در تهران [نشان‌گذاری آزمایشی]</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Quantity */}
              <div className="flex items-center rounded-lg border" aria-label="تعداد">
                <button
                  type="button"
                  className="flex size-10 items-center justify-center rounded-r-lg transition-colors hover:bg-accent disabled:opacity-40"
                  aria-label="افزایش تعداد"
                  disabled={oos || qty >= maxQty}
                  onClick={() => setQty((q) => Math.min(q + 1, maxQty))}
                >
                  <Plus className="size-4" />
                </button>
                <span className="w-10 text-center text-sm font-bold tabular-fa">{toFaDigits(String(qty))}</span>
                <button
                  type="button"
                  className="flex size-10 items-center justify-center rounded-l-lg transition-colors hover:bg-accent disabled:opacity-40"
                  aria-label="کاهش تعداد"
                  disabled={qty <= 1}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Minus className="size-4" />
                </button>
              </div>

              <Button
                className="h-11 flex-1 min-w-40 font-bold"
                disabled={oos || addItem.isPending}
                onClick={onAddToCart}
              >
                <ShoppingCart className="size-5" />
                {oos ? "ناموجود" : "افزودن به سبد خرید"}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={cn("size-11", inWishlist && "border-destructive/40 text-destructive")}
                aria-label={inWishlist ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
                onClick={onWishlist}
              >
                <Heart className={cn("size-5", inWishlist && "fill-destructive")} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="افزودن به مقایسه"
                onClick={onCompare}
              >
                <GitCompareArrows className="size-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="اشتراک‌گذاری لینک محصول"
                onClick={onShare}
              >
                <Share2 className="size-5" />
              </Button>
            </div>
            {!oos && effectiveStock > 0 && (
              <p className="mt-2.5 text-xs text-muted-foreground tabular-fa">
                حداکثر {toFaDigits(String(maxQty))} عدد در هر سفارش
              </p>
            )}
          </div>

          {product.shortDescription && (
            <p className="rounded-xl bg-highlight-soft p-4 text-[13px] leading-7 text-accent-foreground">
              {product.shortDescription}
            </p>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="description" className="mt-10">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted p-1">
          <TabsTrigger value="description" className="rounded-lg px-4 py-2 text-[13px]">توضیحات</TabsTrigger>
          <TabsTrigger value="specs" className="rounded-lg px-4 py-2 text-[13px]">مشخصات</TabsTrigger>
          <TabsTrigger value="reviews" className="rounded-lg px-4 py-2 text-[13px]">
            دیدگاه‌ها ({toFaDigits(String(product.ratingCount))})
          </TabsTrigger>
          <TabsTrigger value="faq" className="rounded-lg px-4 py-2 text-[13px]">پرسش‌های متداول</TabsTrigger>
        </TabsList>

        <TabsContent value="description" className="mt-5">
          <div className="prose-fa max-w-none rounded-xl border bg-white p-5 sm:p-6">
            <h2 className="!mt-0">درباره {product.name}</h2>
            {product.description.split("\n").filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="specs" className="mt-5">
          <SpecsTable product={product} />
        </TabsContent>

        <TabsContent value="reviews" className="mt-5">
          <ReviewsSection product={product} />
        </TabsContent>

        <TabsContent value="faq" className="mt-5">
          <Accordion type="single" collapsible className="rounded-xl border bg-white px-4">
            {PRODUCT_FAQS.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="last:border-b-0">
                <AccordionTrigger className="text-start text-sm font-bold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-7 text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <a
            href={href("/page/faq")}
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-highlight hover:underline"
          >
            مشاهده همه پرسش‌های متداول
            <ChevronLeft className="size-4" aria-hidden />
          </a>
        </TabsContent>
      </Tabs>

      {/* Related products */}
      {product.related.length > 0 && (
        <section className="mt-12" aria-label="محصولات مشابه">
          <SectionHeader
            title="محصولات مشابه"
            subtitle={`سایر کالاهای دسته «${product.category.name}»`}
            moreHref={`/category/${product.category.slug}`}
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {product.related.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


