// Money & date formatting helpers (Persian locale, Toman currency).
// All amounts in this app are INTEGER TOMAN.

const faNumber = new Intl.NumberFormat("fa-IR");
const faDateLong = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });
const faDateShort = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const faDateTime = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "short",
  timeStyle: "short",
});

/** 45000000 → "۴۵٬۰۰۰٬۰۰۰" (Persian digits, Persian separators) */
export function formatNumberFa(v: number): string {
  return faNumber.format(v);
}

/** 45000000 → "۴۵٬۰۰۰٬۰۰۰ تومان" */
export function formatToman(v: number, withUnit = true): string {
  const n = faNumber.format(Math.round(v));
  return withUnit ? `${n} تومان` : n;
}

/** Convert latin digits in a string to Persian digits. */
export function toFaDigits(input: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  return input.replace(/[0-9]/g, (d) => fa[Number(d)]);
}

/** Convert Persian/Arabic digits to latin (for parsing user input). */
export function toEnDigits(input: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const i = fa.indexOf(d);
    return String(i >= 0 ? i : ar.indexOf(d));
  });
}

/** Jalali (Persian calendar) long date: ۱۵ اسفند ۱۴۰۳ */
export function formatDateFa(d: Date | string | number): string {
  try {
    return faDateLong.format(new Date(d));
  } catch {
    return "—";
  }
}

/** Jalali short date ۱۴۰۳/۱۲/۱۵ */
export function formatDateShortFa(d: Date | string | number): string {
  try {
    return faDateShort.format(new Date(d));
  } catch {
    return "—";
  }
}

/** Jalali date + time */
export function formatDateTimeFa(d: Date | string | number): string {
  try {
    return faDateTime.format(new Date(d));
  } catch {
    return "—";
  }
}

/** Discount percent from price/original, rounded; 0 when no discount. */
export function discountPercent(price: number, original: number | null | undefined): number {
  if (!original || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
}

/** Relative "time ago" in Persian for feeds/audit logs. */
export function timeAgoFa(d: Date | string | number): string {
  const then = new Date(d).getTime();
  if (Number.isNaN(then)) return "—";
  const s = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "چند لحظه پیش";
  const m = Math.floor(s / 60);
  if (m < 60) return `${toFaDigits(String(m))} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${toFaDigits(String(h))} ساعت پیش`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${toFaDigits(String(days))} روز پیش`;
  return formatDateShortFa(d);
}
