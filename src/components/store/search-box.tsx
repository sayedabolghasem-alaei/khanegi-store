"use client";
// Live search box with debounced suggestions (GET /api/search/suggest).
// Used inline in the desktop header and inside a dialog on mobile.

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Store, Tag } from "lucide-react";
import { apiGet } from "@/lib/client-api";
import { navigate } from "@/lib/router";
import { formatToman } from "@/lib/money";
import type { SuggestResponse } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER = "جستجوی محصول، برند یا دسته‌بندی…";

function ProductThumb({ image, alt }: { image: string | null; alt: string }) {
  return (
    <img
      src={image ?? "/images/placeholder.svg"}
      alt={alt}
      className="size-10 shrink-0 rounded-md border bg-white object-contain p-0.5"
      loading="lazy"
    />
  );
}

function SuggestBody({
  q,
  onSelect,
}: {
  q: string;
  onSelect: () => void;
}) {
  const debounced = useDebounced(q, 300);
  const { data, isFetching, isError } = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: () => apiGet<SuggestResponse>("/api/search/suggest", { q: debounced }),
    enabled: debounced.trim().length >= 2,
    staleTime: 60_000,
  });

  if (debounced.trim().length < 2) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        حداقل ۲ حرف برای جستجو وارد کنید
      </p>
    );
  }
  if (isFetching && !data) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        خطا در دریافت پیشنهادها — دوباره تلاش کنید
      </p>
    );
  }
  const hasAny =
    (data?.products.length ?? 0) + (data?.categories.length ?? 0) + (data?.brands.length ?? 0) > 0;
  if (!hasAny) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        نتیجه‌ای برای «{q}» یافت نشد
      </p>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      {data!.products.length > 0 && (
        <div className="p-1.5">
          <p className="px-2 py-1 text-[11px] font-bold text-muted-foreground">محصولات</p>
          {data!.products.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => {
                onSelect();
                navigate(`/product/${p.slug}`);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-right transition-colors hover:bg-accent"
            >
              <ProductThumb image={p.image} alt={p.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.brand}</span>
              </span>
              <span className="shrink-0 text-xs font-bold tabular-fa text-highlight">
                {formatToman(p.priceToman)}
              </span>
            </button>
          ))}
        </div>
      )}
      {data!.categories.length > 0 && (
        <div className="border-t p-1.5">
          <p className="px-2 py-1 text-[11px] font-bold text-muted-foreground">دسته‌بندی‌ها</p>
          {data!.categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => {
                onSelect();
                navigate(`/category/${c.slug}`);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-sm transition-colors hover:bg-accent"
            >
              <Store className="size-4 text-muted-foreground" aria-hidden />
              {c.name}
            </button>
          ))}
        </div>
      )}
      {data!.brands.length > 0 && (
        <div className="border-t p-1.5">
          <p className="px-2 py-1 text-[11px] font-bold text-muted-foreground">برندها</p>
          {data!.brands.map((b) => (
            <button
              key={b.slug}
              type="button"
              onClick={() => {
                onSelect();
                navigate(`/search?q=${encodeURIComponent(b.name)}`);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-sm transition-colors hover:bg-accent"
            >
              <Tag className="size-4 text-muted-foreground" aria-hidden />
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchBox({
  variant = "desktop",
  autoFocus = false,
  onDone,
}: {
  variant?: "desktop" | "mobile";
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const submit = () => {
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    onDone?.();
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={`search-input-${variant}`} className="sr-only">
          جستجو در خانه‌گی
        </label>
        <input
          id={`search-input-${variant}`}
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={PLACEHOLDER}
          className="h-11 w-full rounded-xl border bg-muted/60 px-4 pe-11 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-white"
          autoComplete="off"
        />
        <button
          type="submit"
          aria-label="انجام جستجو"
          className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-l-xl text-muted-foreground transition-colors hover:text-primary"
        >
          <Search className="size-4.5" aria-hidden />
        </button>
      </form>
      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover shadow-lg">
          <SuggestBody q={q} onSelect={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
