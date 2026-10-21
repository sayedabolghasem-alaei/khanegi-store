"use client";
// Shared catalog view for #/category/:slug and #/search?q= — sidebar filters,
// sort, pagination, URL-synced state.

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RotateCcw, SlidersHorizontal, SearchX } from "lucide-react";
import { apiGet } from "@/lib/client-api";
import { navigate, href, useHashLocation } from "@/lib/router";
import { toEnDigits, toFaDigits, formatToman } from "@/lib/money";
import type { ListResponse, ProductCard as ProductCardDTO } from "@/lib/types";
import { useCategoriesMeta, useBrandsMeta } from "@/hooks/use-catalog-meta";
import { ProductCard } from "@/components/store/product-card";
import { ProductGridSkeleton } from "@/components/store/skeletons";
import { EmptyState, ErrorState } from "@/components/store/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const SORT_OPTIONS = [
  { value: "newest", label: "جدیدترین" },
  { value: "price_asc", label: "ارزان‌ترین" },
  { value: "price_desc", label: "گران‌ترین" },
  { value: "popular", label: "پرفروش‌ترین" },
  { value: "discount", label: "بیشترین تخفیف" },
  { value: "rating", label: "محبوب‌ترین" },
] as const;

/* Search refine box — separate component so its local state re-seeds from the
   URL via the `key` prop without a setState-in-effect. */
function SearchRefineBox({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      role="search"
      className="mb-5 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const term = value.trim();
        navigate(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="جستجوی مجدد…"
        className="h-11 bg-white"
        aria-label="عبارت جستجو"
      />
      <Button type="submit" className="h-11 px-5 font-bold">
        جستجو
      </Button>
    </form>
  );
}

function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="مسیر صفحه" className="mb-4 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronLeft className="size-3.5" aria-hidden />}
          {item.to ? (
            <a href={href(item.to)} className="transition-colors hover:text-highlight">
              {item.label}
            </a>
          ) : (
            <span className="font-bold text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

interface CatalogQuery {
  category?: string;
  q?: string;
  sort: string;
  page: number;
  brand: string[];
  min?: number;
  max?: number;
  stock: boolean;
  discounted: boolean;
  featured?: boolean;
  isNew?: boolean;
}

function useCatalogFromUrl(): CatalogQuery {
  const { query } = useHashLocation();
  return useMemo(() => {
    const brand = (query.get("brand") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const minRaw = query.get("min");
    const maxRaw = query.get("max");
    return {
      category: query.get("category") ?? undefined,
      q: query.get("q") ?? undefined,
      sort: query.get("sort") ?? "newest",
      page: Math.max(1, Number(toEnDigits(query.get("page") ?? "1")) || 1),
      brand,
      min: minRaw ? Number(toEnDigits(minRaw)) || undefined : undefined,
      max: maxRaw ? Number(toEnDigits(maxRaw)) || undefined : undefined,
      stock: query.get("stock") === "1",
      discounted: query.get("discounted") === "1",
      featured: query.get("featured") === "1",
      isNew: query.get("isNew") === "1",
    };
  }, [query]);
}

function buildCatalogUrl(base: string, cq: CatalogQuery, patch: Partial<CatalogQuery>): string {
  const merged: CatalogQuery = { ...cq, ...patch, page: patch.page ?? (patchHasFilters(patch) ? 1 : cq.page) };
  const qs = new URLSearchParams();
  if (merged.q) qs.set("q", merged.q);
  if (merged.sort && merged.sort !== "newest") qs.set("sort", merged.sort);
  if (merged.page > 1) qs.set("page", String(merged.page));
  if (merged.brand.length) qs.set("brand", merged.brand.join(","));
  if (merged.min) qs.set("min", String(merged.min));
  if (merged.max) qs.set("max", String(merged.max));
  if (merged.stock) qs.set("stock", "1");
  if (merged.discounted) qs.set("discounted", "1");
  if (merged.featured) qs.set("featured", "1");
  if (merged.isNew) qs.set("isNew", "1");
  const queryStr = qs.toString();
  return queryStr ? `${base}?${queryStr}` : base;
}

function patchHasFilters(patch: Partial<CatalogQuery>): boolean {
  return ["brand", "min", "max", "stock", "discounted", "q"].some((k) => k in patch);
}

function hasActiveFilters(cq: CatalogQuery): boolean {
  return (
    cq.brand.length > 0 ||
    cq.min !== undefined ||
    cq.max !== undefined ||
    Boolean(cq.stock) ||
    Boolean(cq.discounted) ||
    Boolean(cq.featured) ||
    Boolean(cq.isNew)
  );
}

/* ──────────────────────────── Filters sidebar ─────────────────────────── */

function FiltersPanel({
  cq,
  base,
  onApply,
}: {
  cq: CatalogQuery;
  base: string;
  onApply?: () => void;
}) {
  const { items: BRANDS } = useBrandsMeta();
  // Local price inputs are seeded from the URL; the parent remounts this
  // panel via `key` when URL-derived values change.
  const [minInput, setMinInput] = useState(cq.min ? toFaDigits(String(cq.min)) : "");
  const [maxInput, setMaxInput] = useState(cq.max ? toFaDigits(String(cq.max)) : "");

  const applyPrice = () => {
    const min = Number(toEnDigits(minInput).replace(/[^\d]/g, "")) || undefined;
    const max = Number(toEnDigits(maxInput).replace(/[^\d]/g, "")) || undefined;
    navigate(buildCatalogUrl(base, cq, { min, max }), { replace: true, keepScroll: true });
    onApply?.();
  };

  const toggleBrand = (slug: string) => {
    const next = cq.brand.includes(slug)
      ? cq.brand.filter((b) => b !== slug)
      : [...cq.brand, slug];
    navigate(buildCatalogUrl(base, cq, { brand: next }), { replace: true, keepScroll: true });
  };

  return (
    <div className="space-y-6 text-sm">
      {/* Brands */}
      <section aria-label="فیلتر برند">
        <h3 className="mb-3 font-bold">برند</h3>
        <ul className="max-h-64 space-y-2.5 overflow-y-auto pe-1">
          {BRANDS.map((b) => (
            <li key={b.slug}>
              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  checked={cq.brand.includes(b.slug)}
                  onCheckedChange={() => toggleBrand(b.slug)}
                  aria-label={`برند ${b.name}`}
                />
                <span className="font-medium">{b.name}</span>
                <span className="text-[10px] text-muted-foreground" dir="ltr">{b.nameEn}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {/* Price range */}
      <section aria-label="فیلتر قیمت">
        <h3 className="mb-3 font-bold">محدوده قیمت (تومان)</h3>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label htmlFor="price-min" className="mb-1 text-xs text-muted-foreground">از</Label>
            <Input
              id="price-min"
              inputMode="numeric"
              value={minInput}
              onChange={(e) => setMinInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyPrice()}
              placeholder="۰"
              className="h-9 bg-white tabular-fa"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="price-max" className="mb-1 text-xs text-muted-foreground">تا</Label>
            <Input
              id="price-max"
              inputMode="numeric"
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyPrice()}
              placeholder="بی‌نهایت"
              className="h-9 bg-white tabular-fa"
            />
          </div>
        </div>
        <Button size="sm" className="mt-2.5 h-9 w-full" onClick={applyPrice}>
          اعمال قیمت
        </Button>
      </section>

      {/* Availability */}
      <section aria-label="فیلتر موجودی" className="space-y-3.5">
        <h3 className="font-bold">وضعیت کالا</h3>
        <div className="flex items-center justify-between">
          <Label htmlFor="in-stock" className="cursor-pointer font-medium">فقط کالاهای موجود</Label>
          <Switch
            id="in-stock"
            checked={cq.stock}
            onCheckedChange={(v) =>
              navigate(buildCatalogUrl(base, cq, { stock: v }), { replace: true, keepScroll: true })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="only-discount" className="cursor-pointer font-medium">فقط تخفیف‌دارها</Label>
          <Switch
            id="only-discount"
            checked={cq.discounted}
            onCheckedChange={(v) =>
              navigate(buildCatalogUrl(base, cq, { discounted: v }), { replace: true, keepScroll: true })
            }
          />
        </div>
      </section>

      {hasActiveFilters(cq) && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            navigate(buildCatalogUrl(base, cq, { brand: [], min: undefined, max: undefined, stock: false, discounted: false, featured: false, isNew: false }), { replace: true, keepScroll: true });
            onApply?.();
          }}
        >
          <RotateCcw className="size-3.5" />
          حذف همه فیلترها
        </Button>
      )}
    </div>
  );
}

/* ─────────────────────────── Active filter chips ──────────────────────── */

function ActiveChips({ cq, base }: { cq: CatalogQuery; base: string }) {
  const { items: BRANDS } = useBrandsMeta();
  const chips: { label: string; clear: Partial<CatalogQuery> }[] = [];
  for (const slug of cq.brand) {
    const b = BRANDS.find((x) => x.slug === slug);
    chips.push({ label: `برند: ${b?.name ?? slug}`, clear: { brand: cq.brand.filter((x) => x !== slug) } });
  }
  if (cq.min) chips.push({ label: `از ${formatToman(cq.min)}`, clear: { min: undefined } });
  if (cq.max) chips.push({ label: `تا ${formatToman(cq.max)}`, clear: { max: undefined } });
  if (cq.stock) chips.push({ label: "فقط موجود", clear: { stock: false } });
  if (cq.discounted) chips.push({ label: "فقط تخفیف‌دار", clear: { discounted: false } });
  if (cq.featured) chips.push({ label: "پیشنهاد ویژه", clear: { featured: false } });
  if (cq.isNew) chips.push({ label: "جدیدترین‌ها", clear: { isNew: false } });

  if (chips.length === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((chip, i) => (
        <button
          key={i}
          type="button"
          onClick={() => navigate(buildCatalogUrl(base, cq, chip.clear), { replace: true, keepScroll: true })}
          className="group flex items-center gap-1 rounded-full border bg-highlight-soft px-3 py-1 text-xs font-bold text-accent-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          {chip.label}
          <span aria-hidden className="text-[10px]">✕</span>
          <span className="sr-only">حذف فیلتر</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          navigate(buildCatalogUrl(base, cq, { brand: [], min: undefined, max: undefined, stock: false, discounted: false, featured: false, isNew: false }), { replace: true, keepScroll: true })
        }
        className="rounded-full px-2 py-1 text-xs font-bold text-destructive underline-offset-4 hover:underline"
      >
        حذف فیلترها
      </button>
    </div>
  );
}

/* ─────────────────────────────── Pagination ───────────────────────────── */

function Pagination({ page, total, pageSize, cq, base }: { page: number; total: number; pageSize: number; cq: CatalogQuery; base: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const window = 2;
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= window) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }

  const go = (p: number) => navigate(buildCatalogUrl(base, cq, { page: p }));

  return (
    <nav aria-label="صفحه‌بندی" className="mt-8 flex items-center justify-center gap-1.5">
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
        aria-label="صفحه قبل"
      >
        <ChevronRight className="size-4" />
      </Button>
      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
        ) : (
          <Button
            key={n}
            variant={n === page ? "default" : "outline"}
            size="icon"
            className={cn("size-9 tabular-fa", n === page && "pointer-events-none")}
            aria-current={n === page ? "page" : undefined}
            onClick={() => go(n)}
          >
            {toFaDigits(String(n))}
          </Button>
        )
      )}
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        disabled={page >= pages}
        onClick={() => go(page + 1)}
        aria-label="صفحه بعد"
      >
        <ChevronLeft className="size-4" />
      </Button>
    </nav>
  );
}

/* ────────────────────────────── Main catalog ──────────────────────────── */

export function CatalogPage({ mode, categorySlug }: { mode: "category" | "search"; categorySlug?: string }) {
  const cq = useCatalogFromUrl();
  const base = mode === "category" ? `/category/${categorySlug}` : "/search";
  const { items: CATEGORIES } = useCategoriesMeta();
  const category =
    mode === "category" ? CATEGORIES.find((c) => c.slug === categorySlug) : undefined;
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    document.title = mode === "category" ? `${category?.name ?? "دسته‌بندی محصولات"}` : `جستجو: ${cq.q ?? "همه محصولات"}`;
  }, [mode, category?.name, cq.q]);

  const apiParams: Record<string, string | number | boolean | undefined | null> = {
    sort: cq.sort,
    page: cq.page,
    pageSize: 12,
  };
  if (mode === "category") apiParams.category = categorySlug;
  if (cq.q) apiParams.q = cq.q;
  if (cq.brand.length) apiParams.brand = cq.brand.join(",");
  if (cq.min) apiParams.minPrice = cq.min;
  if (cq.max) apiParams.maxPrice = cq.max;
  if (cq.stock) apiParams.inStock = 1;
  if (cq.discounted) apiParams.discounted = 1;
  if (cq.featured) apiParams.featured = 1;
  if (cq.isNew) apiParams.isNew = 1;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products", apiParams],
    queryFn: () => apiGet<ListResponse<ProductCardDTO>>("/api/products", apiParams),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const title =
    mode === "category"
      ? category?.name ?? "دسته‌بندی محصولات"
      : cq.q
        ? `نتایج جستجو برای «${cq.q}»`
        : "همه محصولات";

  return (
    <div className="container-store py-6">
      <Breadcrumbs
        items={[
          { label: "خانه", to: "/" },
          ...(mode === "category"
            ? [{ label: "دسته‌بندی‌ها", to: "/" }, { label: category?.name ?? "—" }]
            : [{ label: "جستجو" }]),
        ]}
      />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">{title}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground tabular-fa">
            {isLoading ? "در حال بارگذاری…" : `${toFaDigits(String(total))} کالا`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile filters */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 lg:hidden">
                <SlidersHorizontal className="size-4" />
                فیلترها
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto">
              <SheetHeader className="border-b p-4 text-start">
                <SheetTitle className="text-base">فیلترها</SheetTitle>
              </SheetHeader>
              <div className="p-4">
                <FiltersPanel key={`m-${cq.min ?? ""}-${cq.max ?? ""}-${cq.brand.join(",")}`} cq={cq} base={base} onApply={() => setSheetOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <Label htmlFor="sort-select" className="hidden text-[13px] text-muted-foreground sm:inline">
              مرتب‌سازی:
            </Label>
            <Select
              value={cq.sort}
              onValueChange={(v) => navigate(buildCatalogUrl(base, cq, { sort: v }), { replace: true, keepScroll: true })}
            >
              <SelectTrigger id="sort-select" className="h-10 w-40 bg-white text-[13px] font-bold" aria-label="ترتیب نمایش محصولات">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Search refine box (search mode) */}
      {mode === "search" && <SearchRefineBox key={cq.q ?? ""} initial={cq.q ?? ""} />}

      <div className="flex gap-6">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-64 shrink-0 lg:block" aria-label="فیلترهای جستجو">
          <div className="sticky top-32 rounded-xl border bg-white p-5">
            <p className="mb-4 flex items-center gap-2 font-bold">
              <SlidersHorizontal className="size-4 text-highlight" aria-hidden />
              فیلترها
            </p>
            <FiltersPanel key={`d-${cq.min ?? ""}-${cq.max ?? ""}-${cq.brand.join(",")}`} cq={cq} base={base} />
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
          <ActiveChips cq={cq} base={base} />

          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <ProductGridSkeleton count={9} />
          ) : items.length === 0 ? (
            <EmptyState
              title="محصولی یافت نشد"
              description={
                cq.q
                  ? `نتیجه‌ای برای «${cq.q}» با این فیلترها پیدا نشد. عبارت دیگری امتحان کنید یا فیلترها را حذف کنید.`
                  : "با این فیلترها محصولی پیدا نشد؛ فیلترها را تغییر دهید."
              }
              action={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(
                        mode === "category" ? `/category/${categorySlug}` : cq.q ? `/search?q=${encodeURIComponent(cq.q)}` : "/search",
                        { replace: true }
                      )
                    }
                  >
                    <RotateCcw className="size-4" />
                    حذف فیلترها
                  </Button>
                  <Button variant="ghost" onClick={() => navigate("/")}>
                    <SearchX className="size-4" />
                    رفتن به صفحه اصلی
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              <Pagination
                page={cq.page}
                total={total}
                pageSize={data?.pageSize ?? 12}
                cq={cq}
                base={base}
              />
            </>
          )}
        </div>
      </div>

      {/* Category quick links (bottom of search page) */}
      {mode === "search" && (
        <section className="mt-12" aria-label="دسته‌بندی‌های پرطرفدار">
          <h2 className="mb-4 text-base font-bold">جستجو در دسته‌بندی‌ها</h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <a
                key={c.slug}
                href={href(`/category/${c.slug}${cq.q ? `?q=${encodeURIComponent(cq.q)}` : ""}`)}
                className="flex items-center gap-1.5 rounded-lg border bg-white px-3.5 py-2 text-[13px] font-medium transition-colors hover:border-highlight hover:text-highlight"
              >
                <c.icon className="size-4 text-highlight" aria-hidden />
                {c.name}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
