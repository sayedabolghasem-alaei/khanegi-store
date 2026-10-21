"use client";
// Storefront home page (#/): hero, categories, promos, product rows,
// brands, trust indicators and recently viewed.

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BadgePercent,
  ChevronLeft,
  Clock3,
  Flame,
  Headphones,
  Percent,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigate, href } from "@/lib/router";
import { formatToman, toFaDigits } from "@/lib/money";
import { useCategoriesMeta, useBrandsMeta } from "@/hooks/use-catalog-meta";
import { ProductRow } from "@/components/store/product-row";
import { SectionHeader } from "@/components/store/section-header";
import { useRecentItemsStore } from "@/hooks/use-recent-items";

function HeroImage() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src="/images/hero-main.jpg"
      alt="آشپزخانه مدرن با لوازم خانگی خانه‌گی"
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function Hero() {
  const reduceMotion = useReducedMotion();
  return (
    <section className="relative overflow-hidden bg-primary" aria-label="بنر اصلی">
      <div className="relative mx-auto max-w-7xl">
        <div className="relative aspect-[4/3] sm:aspect-[16/9] md:aspect-[16/7] lg:aspect-[16/6]">
          <HeroImage />
          {/* Navy overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-l from-primary/95 via-primary/60 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="container-store max-w-xl"
            >
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-highlight px-3 py-1 text-xs font-bold text-highlight-foreground">
                <Sparkles className="size-3.5" aria-hidden />
                گارانتی رسمی + ۷ روز بازگشت
              </span>
              <h1 className="text-2xl font-black leading-snug text-white sm:text-3xl lg:text-4xl">
                خانه‌ای هوشمند،
                <br />
                زندگی‌ای راحت
              </h1>
              <p className="mt-3 max-w-md text-sm leading-7 text-white/85 sm:text-base">
                لوازم خانگی اصل با گارانتی رسمی، قیمت شفاف و ارسال سریع به سراسر ایران — از یخچال
                تا کولر گازی، همه در خانه‌گی.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="h-11 bg-highlight px-6 font-bold text-highlight-foreground hover:bg-highlight/90"
                  onClick={() => navigate("/category/refrigerator")}
                >
                  شروع خرید
                  <ChevronLeft className="size-4" aria-hidden />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 border-white/40 bg-white/10 px-6 font-bold text-white backdrop-blur hover:bg-white/20 hover:text-white"
                  onClick={() => navigate("/search?discounted=1&sort=discount")}
                >
                  <Percent className="size-4" aria-hidden />
                  تخفیف‌های ویژه
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoriesGrid() {
  const { items: CATEGORIES } = useCategoriesMeta();
  return (
    <section className="container-store py-8" aria-label="دسته‌بندی‌ها">
      <SectionHeader
        title="خرید بر اساس دسته‌بندی"
        subtitle="هر آنچه خانه‌تان نیاز دارد، دسته‌بندی‌شده و اصل"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {CATEGORIES.map((c) => (
          <a
            key={c.slug}
            href={href(`/category/${c.slug}`)}
            className="card-lift flex items-center gap-3 rounded-xl border bg-white p-4"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-highlight-soft text-highlight">
              <c.icon className="size-6" aria-hidden />
            </span>
            <span className="text-[13px] font-bold leading-5 sm:text-sm">{c.name}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function PromoBannerImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
  );
}

function PromoBanners() {
  const banners = [
    {
      src: "/images/promo-1.jpg",
      alt: "پیشنهاد ویژه یخچال و فریزر",
      title: "پیشنهاد ویژه یخچال‌وفریزر",
      text: "تا ۱۵٪ تخفیف + ارسال رایگان تهران",
      cta: "مشاهده پیشنهادها",
      to: "/category/refrigerator",
    },
    {
      src: "/images/promo-2.jpg",
      alt: "پیشنهاد ویژه تلویزیون و لباسشویی",
      title: "تلویزیون و لباسشویی",
      text: "جدیدترین مدل‌ها با گارانتی رسمی",
      cta: "همین حالا ببینید",
      to: "/category/tv",
    },
  ];
  return (
    <section className="container-store grid gap-4 py-4 sm:grid-cols-2" aria-label="پیشنهادهای ویژه">
      {banners.map((b) => (
        <a
          key={b.src}
          href={href(b.to)}
          className="group relative overflow-hidden rounded-2xl bg-primary"
        >
          <div className="relative aspect-[16/9] sm:aspect-[16/8]">
            <PromoBannerImage src={b.src} alt={b.alt} />
            <div className="absolute inset-0 bg-gradient-to-l from-primary/90 via-primary/45 to-transparent" />
            <div className="absolute inset-y-0 start-0 flex max-w-xs flex-col justify-center p-5 sm:p-7">
              <h3 className="text-lg font-extrabold text-white sm:text-xl">{b.title}</h3>
              <p className="mt-1.5 text-[13px] leading-6 text-white/85">{b.text}</p>
              <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-lg bg-white px-3.5 py-2 text-[13px] font-bold text-primary transition-colors group-hover:bg-highlight group-hover:text-highlight-foreground">
                {b.cta}
                <ChevronLeft className="size-4" aria-hidden />
              </span>
            </div>
          </div>
        </a>
      ))}
    </section>
  );
}

function BrandStrip() {
  const { items: BRANDS } = useBrandsMeta();
  return (
    <section className="container-store py-6" aria-label="برندها">
      <SectionHeader title="برندهای محبوب" subtitle="معتبرترین برندهای لوازم خانگی" moreHref="/search" moreLabel="همه محصولات" />
      <div className="flex flex-wrap gap-2.5">
        {BRANDS.map((b) => (
          <a
            key={b.slug}
            href={href(`/category/refrigerator?brand=${b.slug}`)}
            className="rounded-xl border bg-white px-4 py-2.5 text-sm font-bold text-foreground/80 transition-all hover:-translate-y-0.5 hover:border-highlight hover:text-highlight"
          >
            {b.name}
            <span className="ms-1.5 text-[10px] font-normal text-muted-foreground" dir="ltr">
              {b.nameEn}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function TrustIndicators() {
  const items = [
    { icon: ShieldCheck, title: "اصالت کالا", text: "همه کالاها اصل و دارای گارانتی رسمی برند هستند." },
    { icon: Truck, title: "ارسال سریع", text: "ارسال به سراسر ایران؛ تهران ۱ روز کاری." },
    { icon: BadgePercent, title: "قیمت منصفانه", text: "قیمت‌گذاری شفاف و به‌روز بر اساس نرخ رسمی." },
    { icon: Headphones, title: "پشتیبانی واقعی", text: "۷ روز هفته پاسخ‌گوی شما هستیم." },
  ];
  return (
    <section className="border-y bg-muted/40 py-8" aria-label="مزایای خرید">
      <div className="container-store grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((t) => (
          <div key={t.title} className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-highlight-soft text-highlight">
              <t.icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-bold">{t.title}</span>
              <span className="mt-0.5 block text-xs leading-6 text-muted-foreground">{t.text}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentlyViewed() {
  const items = useRecentItemsStore((s) => s.items);
  const remove = useRecentItemsStore((s) => s.remove);
  const clear = useRecentItemsStore((s) => s.clear);
  if (items.length === 0) return null;

  return (
    <section className="container-store py-6" aria-label="بازدیدهای اخیر">
      <SectionHeader
        title="بازدیدهای اخیر"
        icon={Clock3}
        moreLabel="پاک کردن"
        moreHref={undefined}
      />
      <div className="relative">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {items.slice(0, 12).map((it) => (
            <li key={it.slug} className="group relative rounded-xl border bg-white p-2.5">
              <button
                type="button"
                onClick={() => remove(it.slug)}
                aria-label={`حذف ${it.name} از بازدیدهای اخیر`}
                className="absolute end-1.5 top-1.5 z-10 hidden size-6 items-center justify-center rounded-md bg-white/90 text-muted-foreground shadow-sm transition-colors hover:text-destructive group-hover:flex"
              >
                <X className="size-3.5" />
              </button>
              <a href={href(`/product/${it.slug}`)} className="block">
                <span className="block aspect-square overflow-hidden rounded-lg bg-muted/40 p-2">
                  <img
                    src={it.image ?? "/images/placeholder.svg"}
                    alt={it.name}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </span>
                <span className="mt-2 line-clamp-2 text-xs font-bold leading-5">{it.name}</span>
                <span className="mt-1 block text-[11px] font-extrabold tabular-fa text-highlight">
                  {formatToman(it.priceToman)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      {items.length > 0 && (
        <button
          type="button"
          onClick={clear}
          className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
        >
          پاک کردن تاریخچه بازدید
        </button>
      )}
    </section>
  );
}

export function HomePage() {
  useEffect(() => {
    document.title = "فروشگاه لوازم خانگی خانه‌گی | خرید آنلاین با گارانتی رسمی";
  }, []);

  return (
    <>
      <Hero />
      <CategoriesGrid />
      <ProductRow
        title="پیشنهاد ویژه خانه‌گی"
        subtitle="منتخب کارشناسان ما"
        icon={Star}
        params={{ featured: 1 }}
        moreHref="/search?featured=1"
      />
      <PromoBanners />
      <ProductRow
        title="پرفروش‌ترین‌ها"
        subtitle="انتخاب هزاران خانواده ایرانی"
        icon={Flame}
        params={{ sort: "popular" }}
        moreHref="/search?sort=popular"
      />
      <ProductRow
        title="جدیدترین محصولات"
        icon={Sparkles}
        params={{ isNew: 1 }}
        moreHref="/search?isNew=1"
      />
      <ProductRow
        title="تخفیف‌دارها"
        subtitle="فرصت محدود"
        icon={BadgePercent}
        params={{ sort: "discount" }}
        moreHref="/search?sort=discount"
      />
      <BrandStrip />
      <TrustIndicators />
      <RecentlyViewed />
    </>
  );
}
