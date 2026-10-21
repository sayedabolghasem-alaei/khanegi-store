# راهنمای اتصال Supabase 🗄️

از Task 6، پروژه از **دو حالت** پشتیبانی می‌کند:

| حالت | دیتابیس | احراز هویت | وضعیت |
|---|---|---|---|
| **محلی (پیش‌فرض)** | SQLite (`db/custom.db`) | scrypt + کوکی نشست | بدون هیچ تنظیمی کار می‌کند |
| **Supabase (تولید)** | PostgreSQL (Supabase) | Supabase Auth (ایمیل/رمز) | با تنظیم متغیرهای محیطی فعال می‌شود |

سوییچ بین دو حالت **فقط با متغیرهای محیطی** انجام می‌شود — هیچ تغییری در کد لازم نیست. وقتی متغیرهای Supabase تنظیم نشده باشند، اپ دقیقاً مثل قبل با auth محلی کار می‌کند (fallback امن).

---

## گام ۱ — ساخت پروژه Supabase

1. در [supabase.com](https://supabase.com) یک پروژه جدید بسازید (نزدیک‌ترین ریجن به ایران: امارات/اروپا).
2. از **Project Settings → Database → Connection string → Pooler** رشته اتصال Pooler (پورت `6543`) را کپی کنید — برای runtime با PgBouncer.
3. از **Connection string → Direct** (پورت `5432`) رشته اتصال مستقیم را هم کپی کنید — برای DDL/مهاجرت.
4. از **Project Settings → API** سه مقدار را بردارید: `Project URL`، `anon key`، `service_role key`.

> 🔴 `service_role key` فقط سمت سرور می‌ماند؛ هرگز آن را در `NEXT_PUBLIC_*` یا کد کلاینت قرار ندهید.

## گام ۲ — تنظیم `.env`

فایل `.env` را ویرایش کنید (نمونه در `.env.example`):

```env
# دیتابیس — رشته Pooler برای runtime
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5"
# اتصال مستقیم برای DDL/مهاجرت
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"

# Supabase Auth (هر سه لازم است تا auth ابری فعال شود)
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_ANON_KEY="<anon key>"
SUPABASE_SERVICE_ROLE_KEY="<service_role key>"
```

## گام ۳ — ایجاد جداول در Supabase

دو راه دارید:

**الف) SQL Editor (سریع‌ترین):**
1. در داشبورد Supabase → **SQL Editor** → New query.
2. محتوای `supabase/migration.sql` را کامل paste و اجرا کنید (۲۶ جدول + ایندکس‌ها).
3. سپس محتوای `supabase/rls-policies.sql` را اجرا کنید (فعال‌سازی RLS روی همه جداول + سیاست‌های دفاع‌درعمق).

> ⚠️ `migration.sql` برای پروژه **خالی** است (non-idempotent). اگر قبلاً جداولی ساخته‌اید، از `bun run db:diff:pg` برای تولید SQL تفاوت استفاده کنید.

**ب) Prisma (معادل):**

```bash
bun run db:push:pg     # db push با اسکیمای postgres + regenerate کلاینت
bun run seed           # داده نمایشی (۸ دسته، ۱۰ برند، ۳۶ محصول) — همان seed روی Postgres کار می‌کند
```

## گام ۴ — اجرا و صححه‌گذاری

```bash
bun run dev
```

- ثبت‌نام/ورود با **ایمیل + رمز** حالا از Supabase Auth عبور می‌کند (`Authentication → Users` در داشبورد را چک کنید).
- سبد خرید، سفارش، علاقه‌مندی‌ها و پنل مدیریت بدون تغییر روی دیتابیس ابری کار می‌کنند.
- برای بازگشت به حالت محلی: متغیرهای `SUPABASE_*` را کامنت کنید (auth به scrypt محلی برمی‌گردد).

---

## نحوه کار احراز هویت (معماری)

الگوی استفاده‌شده **«Supabase به‌عنوان تأمین‌کننده هویت + پروفایل محلی»** است:

```
Register  →  supabase.auth.admin.createUser (تأیید ایمیل خودکار)
          →  ایجاد ردیف User محلی (پروفایل/نقش اپ)
          →  نشست httpOnly محلی (بدون افشای توکن‌ها به مرورگر)

Login     →  supabase.auth.signInWithPassword (anon key)
          →  در صورت نبود ردیف محلی (مثلاً کاربر invite شده) → ساخت خودکار با نقش CUSTOMER
          →  نشست httpOnly محلی
          →  شکست Supabase → fallback به scrypt محلی (حساب‌های قدیمی همچنان کار می‌کنند)

Change password → تغییر هم‌زمان در Supabase (admin API) و هش محلی
```

- **توکن‌های Supabase هرگز به مرورگر برنمی‌گردند** — نشست اپ همان کوکی `httpOnly` قبلی است؛ کلاینت هیچ مستقیم‌الدخولی به Supabase ندارد.
- نقش‌ها (`CUSTOMER/STAFF/ADMIN`) در جدول `User` محلی می‌مانند و در لایه API اعمال می‌شوند (RBAC سمت سرور، مستقل از Supabase).
- کد مرتبط: `src/lib/server/supabase.ts` (فکتوری کلاینت‌ها + نگاشت خطاها به پیام فارسی) و مسیرهای `src/app/api/auth/*`.

## RLS — دفاع در عمق

معماری اصلی اجازه اتصال مستقیم کلاینت به دیتابیس را نمی‌دهد (همه‌چیز از API Route سمت سرور با کلید service می‌گذرد که از RLS عبور می‌کند). با این حال `supabase/rls-policies.sql` سیاست‌های RLS را هم فعال می‌کند تا اگر روزی کلید anon مستقیماً در معرض دسترسی PostgREST قرار گرفت:

- خواندن عمومی فقط برای کاتالوگ فعال (دسته/برند/محصول فعال/تصاویر/نظرات تأییدشده/روش ارسال فعال)
- نوشتن فقط برای رکوردهای خود کاربر (`auth.uid() = "userId"`) روی سبد/علاقه‌مندی/آدرس/سفارش
- جداول حساس (User، Session، Coupon، قیمت‌گذاری، AuditLog) **بدون هیچ سیاستی** → فقط service role

> هرگز `FORCE ROW LEVEL SECURITY` روی این جداول اضافه نکنید — اتصال Prisma به RLS گره می‌خورد و اپ از کار می‌افتد.

## نکته‌ها و محدودیت‌ها

- **محدودیت INTEGER:** پول در هر دو اسکیما `Int` (تومان) است؛ سقف هر ردیف ≈ ۲٫۱ میلیارد تومان — برای لوازم خانگی کافی است.
- **حساب‌های فقط-شماره‌موبایل:** Supabase Auth با ایمیل/رمز کار می‌کند (تأمین SMS نیازمند سرویس خارجی مثل Twilio است). ثبت‌نام فقط با موبایل مسیر محلی را طی می‌کند.
- **کلاینت Prisma یک provider فعال دارد:** بعد از `db:push:pg`، اگر خواستید به SQLite برگردید `bun run db:generate:sqlite` را اجرا کنید.
- `DIRECT_URL` فعلاً اطلاع‌رسانی است؛ با فعال‌سازی `prisma migrate` روی Postgres استفاده می‌شود.
