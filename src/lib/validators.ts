// Zod v4 validation schemas with Persian (fa-IR) error messages.
// Shared by API route handlers. Numbers arrive as JSON — coercion used carefully
// (note: z.coerce.boolean() is avoided because Boolean("false") === true).

import { z } from "zod";

// ─── helpers ────────────────────────────────────────────────────────────────

/** "" / null → undefined, otherwise trimmed string (optional). */
const optText = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined || (typeof v === "string" && v.trim() === "") ? undefined : v),
    z.string().trim().max(max, `حداکثر ${max} کاراکتر مجاز است.`).optional()
  );

const intPositive = (msg = "باید عددی بزرگ‌تر از صفر باشد.") =>
  z.coerce.number().int("باید عدد صحیح باشد.").positive(msg);

const intNonNegative = (msg = "باید عددی بزرگ‌تر یا مساوی صفر باشد.") =>
  z.coerce.number().int("باید عدد صحیح باشد.").nonnegative(msg);

const nullableIntPositive = intPositive().nullable().optional();
const nullableIntNonNegative = intNonNegative().nullable().optional();

const irMobile = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => /^09\d{9}$/.test(v), "شماره موبایل باید با ۰۹ شروع شده و ۱۱ رقم باشد.");

// ─── auth ───────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z.string().trim().min(2, "نام باید حداقل ۲ کاراکتر باشد.").max(80, "نام حداکثر ۸۰ کاراکتر است."),
  phone: irMobile,
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().toLowerCase().email("ایمیل نامعتبر است.").max(160).optional()
  ),
  password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.").max(72, "رمز عبور حداکثر ۷۲ کاراکتر است."),
});

export const loginSchema = z.object({
  phone: z.string().trim().min(1, "شماره موبایل الزامی است."),
  password: z.string().min(1, "رمز عبور الزامی است."),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "رمز عبور فعلی الزامی است."),
  newPassword: z.string().min(8, "رمز عبور جدید باید حداقل ۸ کاراکتر باشد.").max(72),
});

// ─── cart ───────────────────────────────────────────────────────────────────

export const cartAddSchema = z.object({
  productId: z.string().min(1, "شناسه محصول الزامی است."),
  variantId: optText(64),
  quantity: z.coerce.number().int().min(1, "تعداد باید حداقل ۱ باشد.").max(5, "حداکثر ۵ عدد از هر کالا.").optional(),
});

export const cartUpdateSchema = z.object({
  itemId: z.string().min(1, "شناسه قلم سبد الزامی است."),
  quantity: z.coerce.number().int("تعداد باید عدد صحیح باشد.").min(0, "تعداد نمی‌تواند منفی باشد."),
});

// ─── reviews ────────────────────────────────────────────────────────────────

export const reviewCreateSchema = z.object({
  productId: z.string().min(1, "شناسه محصول الزامی است."),
  rating: z.coerce.number().int().min(1, "امتیاز باید بین ۱ تا ۵ باشد.").max(5, "امتیاز باید بین ۱ تا ۵ باشد."),
  title: optText(120),
  comment: z.string().trim().min(3, "متن نظر باید حداقل ۳ کاراکتر باشد.").max(2000, "متن نظر حداکثر ۲۰۰۰ کاراکتر است."),
});

// ─── coupons (public validate) ──────────────────────────────────────────────

export const couponValidateSchema = z.object({
  code: z.string().trim().min(1, "کد تخفیف را وارد کنید."),
  subtotalToman: z.coerce.number().int().nonnegative("مبلغ سبد نامعتبر است."),
});

// ─── addresses ──────────────────────────────────────────────────────────────

const phoneFa = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => /^0\d{9,10}$/.test(v), "شماره تماس نامعتبر است (مثال: ۰۹۱۲۱۲۳۴۵۶۷).");

export const addressCreateSchema = z.object({
  title: z.string().trim().min(2, "عنوان آدرس الزامی است.").max(60),
  receiverName: z.string().trim().min(2, "نام گیرنده الزامی است.").max(80),
  phone: phoneFa,
  province: z.string().trim().min(2, "استان الزامی است.").max(60),
  city: z.string().trim().min(2, "شهر الزامی است.").max(60),
  postalCode: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => /^\d{10}$/.test(v), "کد پستی باید ۱۰ رقم باشد."),
  line: z.string().trim().min(5, "نشانی کامل را وارد کنید.").max(300),
  isDefault: z.boolean().optional(),
});

export const addressPatchSchema = addressCreateSchema.partial();

// ─── orders ─────────────────────────────────────────────────────────────────

const inlineAddressSchema = z.object({
  title: optText(60),
  receiverName: z.string().trim().min(2, "نام گیرنده الزامی است.").max(80),
  phone: phoneFa,
  province: z.string().trim().min(2, "استان الزامی است.").max(60),
  city: z.string().trim().min(2, "شهر الزامی است.").max(60),
  postalCode: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => /^\d{10}$/.test(v), "کد پستی باید ۱۰ رقم باشد."),
  line: z.string().trim().min(5, "نشانی کامل را وارد کنید.").max(300),
});

export const orderCreateSchema = z
  .object({
    addressId: optText(64),
    address: inlineAddressSchema.optional(),
    shippingMethodId: z.string().min(1, "روش ارسال را انتخاب کنید."),
    couponCode: optText(40),
    note: optText(500),
  })
  .refine((v) => !!v.addressId || !!v.address, {
    message: "آدرس تحویل سفارش را مشخص کنید.",
    path: ["addressId"],
  });

// ─── admin: products ────────────────────────────────────────────────────────

const colorOptionSchema = z.object({
  name: z.string().trim().min(1, "نام رنگ الزامی است.").max(40),
  hex: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "کد رنگ باید به شکل #RRGGBB باشد."),
});

const attributeSchema = z.object({
  group: optText(80),
  key: z.string().trim().min(1, "عنوان ویژگی الزامی است.").max(80),
  value: z.string().trim().min(1, "مقدار ویژگی الزامی است.").max(160),
});

const variantInputSchema = z.object({
  name: z.string().trim().min(1, "نام تنوع الزامی است.").max(40),
  value: z.string().trim().min(1, "مقدار تنوع الزامی است.").max(80),
  extraPriceToman: intNonNegative("قیمت اضافه تنوع نامعتبر است.").optional(),
  stock: intNonNegative("موجودی تنوع نامعتبر است.").optional(),
});

/** Product image entry: legacy plain URL string or {url, alt?} (Task 7-d). */
const productImageInputSchema = z.union([
  z.string().trim().min(1, "آدرس تصویر نامعتبر است.").max(600, "آدرس تصویر حداکثر ۶۰۰ کاراکتر است."),
  z.object({
    url: z.string().trim().min(1, "آدرس تصویر نامعتبر است.").max(600, "آدرس تصویر حداکثر ۶۰۰ کاراکتر است."),
    alt: optText(160),
  }),
]);

export const adminProductCreateSchema = z.object({
  name: z.string().trim().min(3, "نام محصول باید حداقل ۳ کاراکتر باشد.").max(180),
  nameEn: optText(180),
  slug: optText(180),
  sku: optText(60),
  model: optText(80),
  categoryId: z.string().min(1, "دسته‌بندی الزامی است."),
  brandId: z.string().min(1, "برند الزامی است."),
  shortDescription: optText(400),
  description: z.string().trim().min(10, "توضیحات محصول باید حداقل ۱۰ کاراکتر باشد.").max(6000),
  priceToman: intPositive("قیمت فروش باید بزرگ‌تر از صفر باشد."),
  originalPriceToman: nullableIntPositive,
  isPriceManual: z.boolean().optional(),
  costPrice: z.coerce.number().positive("قیمت تمام‌شده باید بزرگ‌تر از صفر باشد.").nullable().optional(),
  costCurrency: z.enum(["USD", "EUR", "AED"]).nullable().optional(),
  stock: intNonNegative("موجودی نامعتبر است."),
  lowStockThreshold: intNonNegative("آستانه هشدار موجودی نامعتبر است.").optional(),
  warrantyMonths: z.coerce.number().int().min(1, "مدت گارانتی نامعتبر است.").max(120).nullable().optional(),
  colorOptions: z.array(colorOptionSchema).max(12).optional(),
  attributes: z.array(attributeSchema).max(30).optional(),
  images: z.array(productImageInputSchema).max(10, "حداکثر ۱۰ تصویر مجاز است.").optional(),
  variants: z.array(variantInputSchema).max(20).optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const adminProductPatchSchema = adminProductCreateSchema.partial();

export const stockMovementSchema = z.object({
  type: z.enum(["IN", "OUT", "ADJUSTMENT"], { message: "نوع حرکت انبار نامعتبر است." }),
  quantity: intPositive("تعداد باید عددی بزرگ‌تر از صفر باشد."),
  reason: z.string().trim().min(2, "دلیل تغییر موجودی الزامی است.").max(200),
});

// ─── admin: orders ──────────────────────────────────────────────────────────

export const orderStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"], {
    message: "وضعیت سفارش نامعتبر است.",
  }),
  note: optText(300),
});

export const adminOrderPatchSchema = z.object({
  adminNote: optText(1000),
});

// ─── admin: pricing ─────────────────────────────────────────────────────────

export const rateSetSchema = z.object({
  currency: z.enum(["USD", "EUR", "AED"], { message: "ارز نامعتبر است." }),
  rateToman: intPositive("نرخ ارز باید بزرگ‌تر از صفر باشد."),
  note: optText(200),
});

const pricingRuleBaseSchema = z.object({
  name: z.string().trim().min(2, "نام قاعده الزامی است.").max(120),
  scopeType: z.enum(["GLOBAL", "CATEGORY", "BRAND", "PRODUCT"], { message: "نوع دامنه نامعتبر است." }),
  categoryId: optText(64),
  brandId: optText(64),
  productId: optText(64),
  marginPercent: z.coerce.number().min(0, "حاشیه سود نمی‌تواند منفی باشد.").max(500, "حاشیه سود بیش از حد مجاز است."),
  extraCostToman: intNonNegative("هزینه اضافه نامعتبر است.").optional(),
  roundingStepToman: intPositive("گام رند کردن باید بزرگ‌تر از صفر باشد."),
  isActive: z.boolean().optional(),
});

export const pricingRuleCreateSchema = pricingRuleBaseSchema.refine(
  (v) =>
    (v.scopeType === "CATEGORY" && !!v.categoryId) ||
    (v.scopeType === "BRAND" && !!v.brandId) ||
    (v.scopeType === "PRODUCT" && !!v.productId) ||
    v.scopeType === "GLOBAL",
  { message: "برای این دامنه، شناسه مرتبط الزامی است.", path: ["scopeType"] }
);

export const pricingRulePatchSchema = pricingRuleBaseSchema.partial();

export const pricingRunSchema = z.object({
  dryRun: z.boolean({ message: "مقدار dryRun باید بولی باشد." }).default(true),
});

// ─── admin: coupons ─────────────────────────────────────────────────────────

export const couponCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "کد تخفیف باید حداقل ۲ کاراکتر باشد.")
      .max(40)
      .transform((v) => v.toUpperCase()),
    type: z.enum(["PERCENT", "AMOUNT"], { message: "نوع تخفیف نامعتبر است." }),
    value: intPositive("مقدار تخفیف باید بزرگ‌تر از صفر باشد."),
    minOrderToman: nullableIntNonNegative,
    maxDiscountToman: nullableIntPositive,
    usageLimit: nullableIntPositive,
    validFrom: optText(40),
    validUntil: optText(40),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.type !== "PERCENT" || (v.value >= 1 && v.value <= 90), {
    message: "درصد تخفیف باید بین ۱ تا ۹۰ باشد.",
    path: ["value"],
  });

export const couponPatchSchema = z.object({
  isActive: z.boolean().optional(),
});
