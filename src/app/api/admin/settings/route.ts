// Admin store settings — GET parses all keys (Persian defaults when missing),
// PUT upserts zod-validated sections and writes an AuditLog entry.
// ADMIN-only: store-wide settings affect checkout/pricing/SEO and are not a
// STAFF-level concern (contract: docs/contracts.md → "Added in Task 7-d").

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handle, requireRole, audit } from "@/lib/server/api-helpers";
import { SETTING_KEYS, getStoreSettings, type SettingKey } from "@/lib/server/site-settings";

export const dynamic = "force-dynamic";

// ─── Zod (inline — shared with no other route) ──────────────────────────────

const intTomanNonNegative = z.coerce
  .number({ message: "مقدار باید عدد باشد." })
  .int("مبلغ باید عدد صحیح باشد.")
  .min(0, "مبلغ نمی‌تواند منفی باشد.");

const storeContactSchema = z.object({
  phone: z.string().trim().max(40, "حداکثر ۴۰ کاراکتر مجاز است."),
  email: z
    .string()
    .trim()
    .max(160, "حداکثر ۱۶۰ کاراکتر مجاز است.")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "ایمیل نامعتبر است."),
  address: z.string().trim().max(400, "حداکثر ۴۰۰ کاراکتر مجاز است."),
  instagram: z.string().trim().max(120, "حداکثر ۱۲۰ کاراکتر مجاز است."),
  telegram: z.string().trim().max(120, "حداکثر ۱۲۰ کاراکتر مجاز است."),
  whatsapp: z.string().trim().max(120, "حداکثر ۱۲۰ کاراکتر مجاز است."),
});

const storeCommerceSchema = z.object({
  minOrderToman: intTomanNonNegative,
  freeShippingThresholdToman: intTomanNonNegative,
  showPricesWithTaxNote: z.boolean({ message: "مقدار باید بولی باشد." }),
});

const seoSchema = z.object({
  defaultTitle: z.string().trim().min(1, "عنوان پیش‌فرض الزامی است.").max(120, "حداکثر ۱۲۰ کاراکتر مجاز است."),
  defaultDescription: z.string().trim().max(400, "حداکثر ۴۰۰ کاراکتر مجاز است."),
  keywords: z.string().trim().max(400, "حداکثر ۴۰۰ کاراکتر مجاز است."),
});

const settingsPutSchema = z
  .object({
    store_contact: storeContactSchema.optional(),
    store_commerce: storeCommerceSchema.optional(),
    seo: seoSchema.optional(),
  })
  .refine((v) => Object.values(v).some((s) => s !== undefined), {
    message: "حداقل یک بخش از تنظیمات را ارسال کنید.",
    path: ["store_contact"],
  });

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["ADMIN"]);
  const settings = await getStoreSettings();
  return ok({ settings });
});

export const PUT = handle(async (req: NextRequest) => {
  const admin = await requireRole(req, ["ADMIN"]);
  const body = settingsPutSchema.parse(await req.json());

  const updatedKeys: SettingKey[] = [];
  for (const key of SETTING_KEYS) {
    const section = body[key];
    if (!section) continue;
    const value = JSON.stringify(section);
    await db.siteSettings.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    updatedKeys.push(key);
  }

  await audit({ id: admin.id, name: admin.name }, "SETTINGS_UPDATE", "SiteSettings", null, {
    keys: updatedKeys,
  });

  const settings = await getStoreSettings();
  return ok({ settings, updatedKeys });
});
