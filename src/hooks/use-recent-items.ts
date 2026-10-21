"use client";
// Recently-viewed products with display data captured at visit time, so the
// home page can render them purely client-side (no per-slug fetching).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { RECENTLY_VIEWED_LIMIT } from "@/lib/constants";

export interface RecentItem {
  slug: string;
  name: string;
  image: string | null;
  priceToman: number;
  originalPriceToman: number | null;
  discountPercent: number;
  brandName: string;
  categoryName: string;
}

interface RecentItemsState {
  items: RecentItem[];
  push: (item: RecentItem) => void;
  remove: (slug: string) => void;
  clear: () => void;
}

export const useRecentItemsStore = create<RecentItemsState>()(
  persist(
    (set, get) => ({
      items: [],
      push: (item) => {
        const next = [
          item,
          ...get().items.filter((i) => i.slug !== item.slug),
        ].slice(0, RECENTLY_VIEWED_LIMIT);
        set({ items: next });
      },
      remove: (slug) => set({ items: get().items.filter((i) => i.slug !== slug) }),
      clear: () => set({ items: [] }),
    }),
    { name: "aria-recent-items" }
  )
);
