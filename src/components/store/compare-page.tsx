"use client";
// Compare page (#/compare) — side-by-side spec comparison, max 4 products.

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitCompareArrows, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/client-api";
import { href, navigate } from "@/lib/router";
import { formatToman, toFaDigits } from "@/lib/money";
import { COMPARE_LIMIT } from "@/lib/constants";
import type { ProductDetail } from "@/lib/types";
import { useCompareStore } from "@/lib/store";
import { useCompareMetaStore } from "@/hooks/use-compare-meta";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/store/empty-state";
import { ProductGridSkeleton } from "@/components/store/skeletons";
import { RatingStars } from "@/components/store/rating-stars";
import { cn } from "@/lib/utils";

export function ComparePage() {
  const ids = useCompareStore((s) => s.ids);
  const toggle = useCompareStore((s) => s.toggle);
  const clear = useCompareStore((s) => s.clear);
  const meta = useCompareMetaStore((s) => s.meta);
  const forget = useCompareMetaStore((s) => s.forget);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "مقایسه محصولات";
  }, []);

  // Resolve id → slug via the remembered meta map
  const slugs = useMemo(
    () =>
      ids
        .map((id) => meta[id]?.slug)
        .filter((s): s is string => !!s),
    [ids, meta]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["compare", slugs],
    queryFn: async () => {
      const results = await Promise.allSettled(
        slugs.map((slug) => apiGet<ProductDetail>(`/api/products/${encodeURIComponent(slug)}`))
      );
      return results
        .filter((r): r is PromiseFulfilledResult<ProductDetail> => r.status === "fulfilled")
        .map((r) => r.value);
    },
    enabled: slugs.length > 0,
    staleTime: 30_000,
  });

  // Union of all attribute keys (with groups)
  const attrRows = useMemo(() => {
    const map = new Map<string, { group: string; key: string }>();
    for (const p of data ?? []) {
      for (const a of p.attributes) {
        const k = `${a.group ?? ""}::${a.key}`;
        if (!map.has(k)) map.set(k, { group: a.group ?? "مشخصات کلی", key: a.key });
      }
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v }));
  }, [data]);

  const onRemove = (id: string) => {
    toggle(id); // removes (it exists)
    forget(id);
  };

  if (ids.length === 0) {
    return (
      <div className="container-store py-10">
        <EmptyState
          title="لیست مقایسه خالی است"
          description="تا ۴ محصول را با هم مقایسه کنید: روی آیکون مقایسه در کارت محصولات بزنید."
          action={<Button onClick={() => navigate("/")}>مشاهده محصولات</Button>}
        />
      </div>
    );
  }

  return (
    <div className="container-store py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
            <GitCompareArrows className="size-6 text-highlight" aria-hidden />
            مقایسه محصولات
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground tabular-fa">
            {toFaDigits(String(ids.length))} از {toFaDigits(String(COMPARE_LIMIT))} محصول
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            افزودن محصول دیگر
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { clear(); toast.info("لیست مقایسه پاک شد."); }}>
            <Trash2 className="size-4" />
            پاک کردن همه
          </Button>
        </div>
      </div>

      {isLoading ? (
        <ProductGridSkeleton count={3} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="محصولات قابل مقایسه یافت نشد"
          description="ممکن است محصولات حذف شده باشند. لیست مقایسه را پاک کنید و دوباره تلاش کنید."
          action={
            <Button onClick={() => { ids.forEach((id) => forget(id)); clear(); }}>
              پاک کردن لیست
            </Button>
          }
        />
      ) : (
        <div ref={tableRef} className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">جدول مقایسه محصولات</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky right-0 z-10 w-32 min-w-32 border-b bg-muted/60 p-3 text-start text-xs text-muted-foreground backdrop-blur">
                  ویژگی / محصول
                </th>
                {data.map((p) => (
                  <th key={p.id} scope="col" className="min-w-48 border-b border-s p-3 text-center align-top">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => onRemove(p.id)}
                        aria-label={`حذف ${p.name} از مقایسه`}
                        className="absolute -top-1 end-0 z-10 flex size-7 items-center justify-center rounded-full bg-white text-muted-foreground shadow-sm transition-colors hover:bg-destructive hover:text-white"
                      >
                        <X className="size-4" />
                      </button>
                      <a href={href(`/product/${p.slug}`)} className="block">
                        <span className="mx-auto block w-24 overflow-hidden rounded-lg bg-muted/40 p-2">
                          <img
                            src={p.image ?? "/images/placeholder.svg"}
                            alt={p.name}
                            loading="lazy"
                            className="aspect-square w-full object-contain"
                          />
                        </span>
                        <span className="mt-2 line-clamp-2 block text-xs font-bold leading-5 hover:text-highlight">
                          {p.name}
                        </span>
                      </a>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareRow label="قیمت" cells={data.map((p) => (
                <span key={p.id} className="font-extrabold tabular-fa text-highlight">{formatToman(p.priceToman)}</span>
              ))} />
              <CompareRow label="برند" cells={data.map((p) => p.brand.name)} />
              <CompareRow label="امتیاز" cells={data.map((p) =>
                <span key={p.id}>{p.ratingCount > 0 ? <RatingStars value={p.ratingAvg} count={p.ratingCount} /> : "—"}</span>
              )} />
              <CompareRow label="موجودی" cells={data.map((p) =>
                p.stock > 0 ? (
                  <span key={p.id} className="font-bold text-emerald-700 tabular-fa">{toFaDigits(String(p.stock))} عدد</span>
                ) : (
                  <span key={p.id} className="font-bold text-destructive">ناموجود</span>
                )
              )} />
              <CompareRow label="گارانتی" cells={data.map((p) =>
                p.warrantyMonths ? `${toFaDigits(String(p.warrantyMonths))} ماه` : "—"
              )} />
              <CompareRow label="دسته‌بندی" cells={data.map((p) => p.category.name)} />
              {attrRows.map((row) => (
                <CompareRow
                  key={row.id}
                  label={row.key}
                  groupLabel={row.group}
                  cells={data.map((p) => {
                    const attr = p.attributes.find(
                      (a) => a.key === row.key && (a.group ?? "مشخصات کلی") === row.group
                    );
                    return attr ? attr.value : "—";
                  })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompareRow({
  label,
  cells,
  groupLabel,
}: {
  label: string;
  cells: React.ReactNode[];
  groupLabel?: string;
}) {
  return (
    <tr className={cn("border-b last:border-b-0", groupLabel && "bg-muted/30")}>
      <th
        scope="row"
        className={cn(
          "sticky right-0 z-10 border-l bg-white p-3 text-start align-middle text-xs font-bold text-muted-foreground backdrop-blur",
          groupLabel && "bg-muted/60"
        )}
      >
        {label}
        {groupLabel && <span className="mt-0.5 block text-[10px] font-normal opacity-70">{groupLabel}</span>}
      </th>
      {cells.map((cell, i) => (
        <td key={i} className="border-s border-b p-3 text-center align-middle leading-6 last:border-b-0">
          {cell}
        </td>
      ))}
    </tr>
  );
}
