"use client";
// Display metadata for products added to the compare tray (ids are stored by
// useCompareStore; this map lets the compare page resolve each id → slug).

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CompareMeta {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  priceToman: number;
  brandName: string;
}

interface CompareMetaState {
  meta: Record<string, CompareMeta>;
  remember: (item: CompareMeta) => void;
  forget: (id: string) => void;
}

export const useCompareMetaStore = create<CompareMetaState>()(
  persist(
    (set, get) => ({
      meta: {},
      remember: (item) => set({ meta: { ...get().meta, [item.id]: item } }),
      forget: (id) => {
        const next = { ...get().meta };
        delete next[id];
        set({ meta: next });
      },
    }),
    { name: "aria-compare-meta" }
  )
);
