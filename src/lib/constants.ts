// Global constants — shared by frontend and backend.

export const SITE_NAME = "خانه‌گی";
export const SITE_NAME_EN = "Khanegi";
export const SITE_TAGLINE = "فروشگاه تخصصی لوازم خانگی";
export const SITE_DESCRIPTION =
  "خرید آنلاین لوازم خانگی اصل و با گارانتی رسمی؛ یخچال، ماشین لباسشویی، ماشین ظرفشویی، تلویزیون، جاروبرقی، اجاق گاز، کولر گازی و لوازم کوچک آشپزخانه با ارسال سریع به سراسر ایران.";

// ⚠️ PLACEHOLDER business details — replace with real company info before launch.
export const SITE_CONTACT = {
  phone: "۰۲۱-۹۱۰۰۰۰۰۰",
  phoneRaw: "02191000000",
  mobile: "۰۹۱۲-۰۰۰-۰۰۰۰",
  email: "info@ariakhaneh.example",
  address: "تهران، خیابان ولیعصر، بالاتر از میدان ونک، پلاک [نشان‌گذاری آزمایشی]، واحد ۱۰",
  workHours: "شنبه تا پنجشنبه، ۹ تا ۱۸",
};

export const ANNOUNCEMENT =
  "ارسال رایگان برای خریدهای بالای ۵۰ میلیون تومان — ۷ روز ضمانت بازگشت بی‌قید و شرط";

export const PAGE_SIZE = 12;

// ─── Roles (string enums — SQLite has no native enums) ─────────────────────
export const ROLES = ["CUSTOMER", "STAFF", "ADMIN"] as const;

// ─── Order status machine (server-enforced transitions) ────────────────────
export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export const ORDER_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

// Statuses allowed to be set by the customer (own order)
export const CUSTOMER_CANCELLABLE_STATUSES: readonly string[] = ["PENDING", "CONFIRMED"];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار تأیید",
  CONFIRMED: "تأیید شده",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل شده",
  CANCELLED: "لغو شده",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "پرداخت نشده",
  PENDING: "در انتظار پرداخت",
  PAID: "پرداخت شده",
  FAILED: "پرداخت ناموفق",
  REFUNDED: "بازپرداخت شده",
};

export const PAYMENT_PROVIDERS = ["TEST"] as const;

// ─── Pricing engine ─────────────────────────────────────────────────────────
export const CURRENCIES = ["USD", "EUR", "AED"] as const;
export const CURRENCY_LABELS: Record<string, string> = {
  USD: "دلار آمریکا",
  EUR: "یورو",
  AED: "درهم امارات",
};
/** A rate older than this is treated as stale and never auto-applied. */
export const MAX_RATE_AGE_DAYS = 7;

export const SCOPE_TYPES = ["GLOBAL", "CATEGORY", "BRAND", "PRODUCT"] as const;
export const SCOPE_TYPE_LABELS: Record<string, string> = {
  GLOBAL: "همه محصولات",
  CATEGORY: "دسته‌بندی",
  BRAND: "برند",
  PRODUCT: "محصول خاص",
};

// ─── Demo accounts (seeded, clearly labeled as demonstration data) ─────────
export const DEMO_ADMIN = { phone: "09120000000", password: "Admin@1234" };
export const DEMO_CUSTOMER = { phone: "09121111111", password: "Customer@1234" };

// ─── Misc limits ────────────────────────────────────────────────────────────
export const MAX_QTY_PER_LINE = 5;
export const COMPARE_LIMIT = 4;
export const RECENTLY_VIEWED_LIMIT = 12;
