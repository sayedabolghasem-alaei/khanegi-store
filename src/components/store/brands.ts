// Static brand fallback. Since Task 6 the live source of truth is
// GET /api/brands (database) consumed via hooks/use-catalog-meta
// (useBrandsMeta) — this list is only the offline/instant fallback.

export interface BrandItem {
  slug: string;
  name: string; // Persian display name
  nameEn: string;
}

export const BRANDS: BrandItem[] = [
  { slug: "snowa", name: "اسنوا", nameEn: "Snowa" },
  { slug: "diamond", name: "دوو", nameEn: "Diamond" },
  { slug: "pakshoma", name: "پاکشوما", nameEn: "Pakshoma" },
  { slug: "samsung", name: "سامسونگ", nameEn: "Samsung" },
  { slug: "lg", name: "ال‌جی", nameEn: "LG" },
  { slug: "bosch", name: "بوش", nameEn: "Bosch" },
  { slug: "hisense", name: "هیسنس", nameEn: "Hisense" },
  { slug: "philips", name: "فیلیپس", nameEn: "Philips" },
  { slug: "delonghi", name: "دلونگی", nameEn: "DeLonghi" },
  { slug: "gplus", name: "جی‌پلاس", nameEn: "GPlus" },
];

export function brandBySlug(slug: string): BrandItem | undefined {
  return BRANDS.find((b) => b.slug === slug);
}
