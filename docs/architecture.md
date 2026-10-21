# معماری — فروشگاه آریا خانه

## نمای کلی

```
Browser (SPA, fa-IR, RTL)
  │  fetch (same-origin, credentials)
  ▼
Next.js API Routes (/api/**)  ← تنها نقطه دسترسی به داده
  │  Zod validation → RBAC (requireUser/requireRole) → Business rules
  ▼
Prisma Client ──► SQLite (db/custom.db)
                    money = INTEGER TOMAN, JSON-in-String, no enums (SQLite limit)
```

- **تک‌مسیری (Single-route) SPA:** محیط پیش‌نمایش فقط `/` را سرو می‌کند؛ تمام ویوها با hash-router (`src/lib/router.ts`, useSyncExternalStore با snapshot کش‌شده) زیر `#/...` رندر می‌شوند. مزیت: ناوبری قابل اشتراک؛ محدودیت: خزنده‌ها فقط HTML پوسته را می‌بینند ( راه‌حل در بخش SEO).
- **قرارداد تایپ‌محور:** `src/lib/types.ts` تنها منبع حقیقت شکل داده FE/BE است؛ `docs/contracts.md` نقشه اندپوینت‌ها.

## مدل داده (prisma/schema.prisma)

| دامنه | مدل‌ها |
|---|---|
| هویت | User (role: CUSTOMER/STAFF/ADMIN), Session |
| کاتالوگ | Category (خودارجاع), Brand, Product, ProductImage, ProductVariant, ProductReview |
| قیمت | ExchangeRate, PricingRule, PriceHistory |
| خرید | Cart/CartItem (مهمان با کوکی + کاربر), Wishlist/WishlistItem, Address |
| سفارش | Order, OrderItem (snapshot بدون FK), OrderStatusHistory, Payment |
| عملیات | Coupon/CouponRedemption, ShippingMethod, InventoryMovement, AuditLog, SiteSettings |

قواعد طلایی:
1. **پول عدد صحیح تومان**؛ `costPrice` تنها Float است (ارز خارجی) و هرگز مستقیم نمایش داده نمی‌شود.
2. `OrderItem` snapshot است (نام/قیمت/SKU) — تغییر قیمت کاتالوگ، سفارش‌های تاریخی را تغییر نمی‌دهد.
3. SQLite enum ندارد → وضعیت‌ها String و در `src/lib/constants.ts` + Zod اعتبارسنجی می‌شوند.

## جریان‌های حساس

### ثبت سفارش (POST /api/orders)
```
requireUser → خواندن Cart از DB → حذف اقلام ناموجود/غیرفعال
→ محاسبه unitPrice = product.priceToman + variant.extraPriceToman (سرور)
→ کد تخفیف: checkCoupon (بازه، سقف، حداقل سبد) → ارسال: ShippingMethod + آستانه رایگان
→ $transaction: برای هر قلم updateMany(stock >= qty, decrement) — شکست → 409 و rollback کامل
→ Order + OrderItems(snapshot) + StatusHistory + Payment(UNPAID) + InventoryMovement(OUT) + soldCount
```

### موتور قیمت‌گذاری (src/lib/server/pricing.ts)
```
computePrice = roundHalfUp(cost × rate × (1 + margin%) + extra, step)   ← تابع خالص
resolveRule: PRODUCT > BRAND > CATEGORY > GLOBAL (فقط فعال)
runPricing(dryRun):
  skip اگر: isPriceManual | بدون cost | بدون نرخ فعال | نرخ قدیمی‌تر از ۷ روز (MAX_RATE_AGE_DAYS)
  apply: update price → PriceHistory(source=PRICING_ENGINE) → AuditLog(PRICE_APPLY)
```
نرخ قدیمی/ناموجود هرگز بی‌صدا اعمال نمی‌شود — دلیل رد شدن در پاسخ پیش‌نمایش برمی‌گردد.

### احراز هویت
- scrypt(salt تصادفی) برای رمز؛ نشست در DB با توکن ۳۲بایتی؛ کوکی httpOnly ۳۰روزه.
- ورود → ادغام سبد مهمان (کوکی) در سبد کاربر.
- همه اندپوینت‌های admin از `requireRole` می‌گذرند؛ تغییر نرخ/اعمال قیمت‌گذاری ADMIN-only.

### SEO (وضعیت شفاف)
- در layout: متادیتای کامل fa_IR، OG، robots، title template؛ robots.txt و robots meta در APIهای مدیریتی.
- صفحه محصول: JSON-LD Product + breadcrumb + document.title پویا.
- **محدودیت:** چون کل فروشگاه داخل `/#/...` است، ایندکس‌پذیری عمیق محصول/دسته نیازمند انتقال ویوها به Routeهای واقعی Next (SSR/ISR) است — DTOها و لایه API طوری طراحی شده‌اند که این انتقال بدون تغییر بک‌اند ممکن باشد.

## ساختار پوشه‌ها
```
src/app/page.tsx          SPA shell + hash switch
src/app/api/**            route handlers (pattern: export const GET = handle(async ...))
src/components/store/**   ویوها + شل (Header/Footer/CartDrawer)
src/components/admin/**   پنل مدیریت (AdminShell + صفحات)
src/hooks/                use-auth, use-cart, use-admin, ...
src/lib/                  types, money (fa-IR), constants (وضعیت‌ها/برچسب‌ها), client-api, router, store
src/lib/server/           api-helpers, catalog, orders, pricing, torob, admin-products, coupons-admin
```
