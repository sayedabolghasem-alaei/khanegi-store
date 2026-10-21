// Site settings service — SiteSettings is a key → JSON-string store.
// Owned keys (Task 7-d):
//   store_contact   {phone, email, address, instagram, telegram, whatsapp}
//   store_commerce  {minOrderToman:int≥0, freeShippingThresholdToman:int≥0, showPricesWithTaxNote:boolean}
//   seo             {defaultTitle, defaultDescription, keywords}
// Missing/malformed rows always fall back to the Persian defaults below.
// All three keys are non-sensitive (safe for the public GET /api/settings).

import { db } from "@/lib/db";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants";

export interface StoreContactSettings {
  phone: string;
  email: string;
  address: string;
  instagram: string;
  telegram: string;
  whatsapp: string;
}

export interface StoreCommerceSettings {
  minOrderToman: number;
  freeShippingThresholdToman: number;
  showPricesWithTaxNote: boolean;
}

export interface SeoSettings {
  defaultTitle: string;
  defaultDescription: string;
  keywords: string;
}

export interface StoreSettingsMap {
  store_contact: StoreContactSettings;
  store_commerce: StoreCommerceSettings;
  seo: SeoSettings;
}

export const SETTING_KEYS = ["store_contact", "store_commerce", "seo"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export const DEFAULT_SETTINGS: StoreSettingsMap = {
  store_contact: {
    phone: "",
    email: "",
    address: "",
    instagram: "",
    telegram: "",
    whatsapp: "",
  },
  store_commerce: {
    minOrderToman: 0,
    freeShippingThresholdToman: 0,
    showPricesWithTaxNote: false,
  },
  seo: {
    defaultTitle: SITE_NAME,
    defaultDescription: SITE_DESCRIPTION,
    keywords: "لوازم خانگی,یخچال,ماشین لباسشویی,تلویزیون,فروشگاه آنلاین",
  },
};

/** Coerces an unknown parsed value into a well-typed object over the defaults. */
function mergeSection<T>(defaults: T, raw: unknown): T {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  for (const [k, def] of Object.entries(defaults as Record<string, unknown>)) {
    const v = (raw as Record<string, unknown>)[k];
    if (v === undefined || v === null) continue;
    if (typeof def === "boolean") {
      if (typeof v === "boolean") out[k] = v;
    } else if (typeof def === "number") {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n) && n >= 0) out[k] = Math.floor(n);
    } else {
      if (typeof v === "string") out[k] = v;
    }
  }
  return out as T;
}

/** Parses one stored JSON string into a typed section (defaults on any failure). */
export function parseSettingSection<K extends SettingKey>(key: K, stored: string | null | undefined): StoreSettingsMap[K] {
  if (!stored) return DEFAULT_SETTINGS[key];
  try {
    return mergeSection(DEFAULT_SETTINGS[key], JSON.parse(stored));
  } catch {
    return DEFAULT_SETTINGS[key];
  }
}

/** Reads all owned keys from the DB and merges them over the defaults. */
export async function getStoreSettings(): Promise<StoreSettingsMap> {
  const rows = await db.siteSettings.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    store_contact: parseSettingSection("store_contact", byKey.get("store_contact")),
    store_commerce: parseSettingSection("store_commerce", byKey.get("store_commerce")),
    seo: parseSettingSection("seo", byKey.get("seo")),
  };
}

/**
 * Public subset — today every owned key is non-sensitive, so this equals the
 * admin payload. Kept as an explicit allow-list so a future secret key can
 * never leak through GET /api/settings by accident.
 */
export async function getPublicStoreSettings(): Promise<StoreSettingsMap> {
  return getStoreSettings();
}
