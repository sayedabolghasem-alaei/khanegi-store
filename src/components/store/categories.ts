// Static category fallback + slug→icon map. Since Task 6 the live source of
// truth is GET /api/categories (database) consumed via hooks/use-catalog-meta
// (useCategoriesMeta) — these lists are only used for offline/instant fallback
// and for resolving lucide icons (client-side components, not serializable).
import type { LucideIcon } from "lucide-react";
import {
  Refrigerator,
  WashingMachine,
  UtensilsCrossed,
  Tv,
  Sparkles,
  CookingPot,
  AirVent,
  Zap,
} from "lucide-react";

export interface CategoryItem {
  slug: string;
  name: string;
  icon: LucideIcon;
}

export const CATEGORIES: CategoryItem[] = [
  { slug: "refrigerator", name: "یخچال و فریزر", icon: Refrigerator },
  { slug: "washing-machine", name: "ماشین لباسشویی", icon: WashingMachine },
  { slug: "dishwasher", name: "ماشین ظرفشویی", icon: UtensilsCrossed },
  { slug: "tv", name: "تلویزیون", icon: Tv },
  { slug: "vacuum", name: "جاروبرقی", icon: Sparkles },
  { slug: "cooking", name: "اجاق گاز و فر", icon: CookingPot },
  { slug: "air-conditioner", name: "کولر گازی", icon: AirVent },
  { slug: "small-appliance", name: "لوازم کوچک آشپزخانه", icon: Zap },
];

export function categoryBySlug(slug: string): CategoryItem | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
