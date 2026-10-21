"use client";

// Category/brand metadata for the storefront — fetched from the DATABASE via
// GET /api/categories and GET /api/brands (Task 6, Supabase integration).
//
// The static mirrors in components/store/{categories,brands}.ts remain for
// two reasons only:
//   1) slug → icon mapping (lucide components are client-side code and
//      cannot be serialized from an API response),
//   2) instant/offline fallback so navigation never renders empty while the
//      request is in flight or if it fails.
// Whatever the API returns always wins over the static lists.

import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, type LucideIcon } from "lucide-react";
import { apiGet } from "@/lib/client-api";
import { CATEGORIES } from "@/components/store/categories";
import { BRANDS } from "@/components/store/brands";

export interface CategoryMeta {
  slug: string;
  name: string;
  nameEn: string | null;
  productCount: number;
  icon: LucideIcon;
}

export interface BrandMeta {
  slug: string;
  name: string;
  nameEn: string;
  productCount: number;
}

interface MetaListResponse<T> {
  items: T[];
}

/** Static API-shaped fallback (icon resolved separately by slug). */
const STATIC_CATEGORIES_API_SHAPE = CATEGORIES.map((c) => ({
  slug: c.slug,
  name: c.name,
  nameEn: null as string | null,
  productCount: 0,
}));

const STATIC_BRANDS_API_SHAPE = BRANDS.map((b) => ({
  slug: b.slug,
  name: b.name,
  nameEn: b.nameEn,
  productCount: 0,
}));

const CATEGORY_ICONS = new Map<string, LucideIcon>(CATEGORIES.map((c) => [c.slug, c.icon]));

/** Live categories from the DB (static fallback while loading / on error). */
export function useCategoriesMeta() {
  const query = useQuery({
    queryKey: ["categories-meta"],
    queryFn: () =>
      apiGet<MetaListResponse<{ slug: string; name: string; nameEn: string | null; productCount: number }>>(
        "/api/categories"
      ),
    placeholderData: { items: STATIC_CATEGORIES_API_SHAPE },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const items: CategoryMeta[] = (query.data?.items ?? []).map((c) => ({
    ...c,
    icon: CATEGORY_ICONS.get(c.slug) ?? LayoutGrid,
  }));

  return { items, isFromApi: query.isSuccess && items.length > 0 };
}

/** Live brands from the DB (static fallback while loading / on error). */
export function useBrandsMeta() {
  const query = useQuery({
    queryKey: ["brands-meta"],
    queryFn: () => apiGet<MetaListResponse<BrandMeta>>("/api/brands"),
    placeholderData: { items: STATIC_BRANDS_API_SHAPE },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const items: BrandMeta[] = query.data?.items ?? STATIC_BRANDS_API_SHAPE;

  return { items, isFromApi: query.isSuccess && items.length > 0 };
}
