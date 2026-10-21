"use client";
// Client UI state (Zustand): cart drawer, compare list, recently viewed.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { COMPARE_LIMIT, RECENTLY_VIEWED_LIMIT } from "@/lib/constants";

interface UIState {
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  cartOpen: false,
  setCartOpen: (open) => set({ cartOpen: open }),
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
}));

interface CompareState {
  ids: string[];
  toggle: (id: string) => "added" | "removed" | "full";
  clear: () => void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const { ids } = get();
        if (ids.includes(id)) {
          set({ ids: ids.filter((x) => x !== id) });
          return "removed";
        }
        if (ids.length >= COMPARE_LIMIT) return "full";
        set({ ids: [...ids, id] });
        return "added";
      },
      clear: () => set({ ids: [] }),
    }),
    { name: "aria-compare" }
  )
);

interface RecentState {
  slugs: string[];
  push: (slug: string) => void;
}

export const useRecentStore = create<RecentState>()(
  persist(
    (set, get) => ({
      slugs: [],
      push: (slug) => {
        const next = [slug, ...get().slugs.filter((s) => s !== slug)].slice(0, RECENTLY_VIEWED_LIMIT);
        set({ slugs: next });
      },
    }),
    { name: "aria-recent" }
  )
);
