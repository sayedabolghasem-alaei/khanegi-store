"use client";
// Site footer — sticks to the bottom of the viewport on short pages via the
// min-h-screen flex wrapper in page.tsx (mt-auto pushes it down on long pages).

import { CreditCard, Headphones, ShieldCheck, Truck } from "lucide-react";
import { href } from "@/lib/router";
import { SITE_CONTACT, SITE_NAME, SITE_TAGLINE } from "@/lib/constants";
import { useCategoriesMeta } from "@/hooks/use-catalog-meta";

const TRUST = [
  { icon: ShieldCheck, title: "ضمانت اصالت کالا", sub: "گارانتی رسمی برند" },
  { icon: Truck, title: "ارسال سریع", sub: "به سراسر ایران" },
  { icon: CreditCard, title: "پرداخت امن", sub: "درگاه بانکی معتبر" },
  { icon: Headphones, title: "پشتیبانی ۷ روز هفته", sub: "پاسخ‌گویی زیر ۱۵ دقیقه" },
];

export function Footer() {
  const { items: CATEGORIES } = useCategoriesMeta();
  return (
    <footer className="mt-auto border-t bg-muted/40">
      {/* Trust badges */}
      <div className="border-b bg-white">
        <div className="container-store grid grid-cols-2 gap-4 py-5 md:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-highlight-soft text-highlight">
                <t.icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-[13px] font-bold">{t.title}</span>
                <span className="block text-xs text-muted-foreground">{t.sub}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="container-store py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* About */}
          <div>
            <p className="mb-3 text-base font-extrabold text-primary">{SITE_NAME}</p>
            <p className="text-[13px] leading-7 text-muted-foreground">
              {SITE_TAGLINE} — خرید آنلاین لوازم خانگی اصل با گارانتی رسمی، قیمت شفاف و ارسال سریع
              به سراسر ایران. تجربه‌ای مطمئن از انتخاب تا نصب.
            </p>
          </div>

          {/* Quick links */}
          <nav aria-label="لینک‌های سریع">
            <p className="mb-3 text-sm font-bold">دسترسی سریع</p>
            <ul className="space-y-2 text-[13px] text-muted-foreground">
              <li><a className="transition-colors hover:text-highlight" href={href("/page/about")}>درباره ما</a></li>
              <li><a className="transition-colors hover:text-highlight" href={href("/page/contact")}>تماس با ما</a></li>
              <li><a className="transition-colors hover:text-highlight" href={href("/page/faq")}>پرسش‌های متداول</a></li>
              <li><a className="transition-colors hover:text-highlight" href={href("/page/shipping")}>شیوه‌های ارسال</a></li>
              <li><a className="transition-colors hover:text-highlight" href={href("/page/returns")}>رویه بازگشت کالا</a></li>
              <li><a className="transition-colors hover:text-highlight" href={href("/page/warranty")}>گارانتی محصولات</a></li>
            </ul>
          </nav>

          {/* Categories */}
          <nav aria-label="دسته‌بندی‌ها">
            <p className="mb-3 text-sm font-bold">دسته‌بندی‌ها</p>
            <ul className="space-y-2 text-[13px] text-muted-foreground">
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <a className="transition-colors hover:text-highlight" href={href(`/category/${c.slug}`)}>
                    {c.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <p className="mb-3 text-sm font-bold">تماس با ما</p>
            <ul className="space-y-2 text-[13px] leading-6 text-muted-foreground">
              <li>تلفن: {SITE_CONTACT.phone} [نشان‌گذاری آزمایشی]</li>
              <li>ایمیل: {SITE_CONTACT.email} [نشان‌گذاری آزمایشی]</li>
              <li>نشانی: {SITE_CONTACT.address}</li>
              <li>ساعات کاری: {SITE_CONTACT.workHours}</li>
            </ul>
            <a
              href={href("/admin/overview")}
              className="mt-4 inline-flex items-center gap-1 rounded-md border bg-white px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-ring hover:text-highlight"
            >
              پنل مدیریت
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t bg-white">
        <div className="container-store flex flex-col items-center justify-between gap-2 py-4 text-center text-xs text-muted-foreground sm:flex-row sm:text-start">
          <p>
            © {SITE_NAME} — تمام داده‌های این نسخه نمایشی است. [نشان‌گذاری آزمایشی]
          </p>
          <p className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-highlight" aria-hidden />
            پرداخت از طریق درگاه امن بانکی — اطلاعات کارت ذخیره نمی‌شود
          </p>
        </div>
      </div>
    </footer>
  );
}
