"use client";
// Mobile slide-in menu content: categories + quick links + account.

import { Package, Heart, MapPin, User, LogIn, Info, FileText } from "lucide-react";
import { href } from "@/lib/router";
import { useCategoriesMeta } from "@/hooks/use-catalog-meta";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";

export function MobileMenu() {
  const { items: CATEGORIES } = useCategoriesMeta();
  const { user } = useAuth();

  return (
    <nav aria-label="منوی موبایل" className="flex flex-col p-4 text-sm">
      <p className="mb-2 text-[11px] font-bold text-muted-foreground">دسته‌بندی‌ها</p>
      <ul className="grid grid-cols-2 gap-1.5">
        {CATEGORIES.map((c) => (
          <li key={c.slug}>
            <a
              href={href(`/category/${c.slug}`)}
              className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 font-medium transition-colors hover:bg-accent"
            >
              <c.icon className="size-4 shrink-0 text-highlight" aria-hidden />
              <span className="truncate">{c.name}</span>
            </a>
          </li>
        ))}
      </ul>

      <Separator className="my-4" />
      <p className="mb-2 text-[11px] font-bold text-muted-foreground">حساب کاربری</p>
      <ul className="space-y-1">
        {user ? (
          <>
            <MenuItem to="/account" icon={User} label="حساب کاربری" />
            <MenuItem to="/account/orders" icon={Package} label="سفارش‌های من" />
            <MenuItem to="/account/addresses" icon={MapPin} label="آدرس‌های من" />
            <MenuItem to="/wishlist" icon={Heart} label="علاقه‌مندی‌ها" />
          </>
        ) : (
          <>
            <MenuItem to="/login" icon={LogIn} label="ورود به حساب" />
            <MenuItem to="/register" icon={User} label="ثبت‌نام" />
          </>
        )}
      </ul>

      <Separator className="my-4" />
      <p className="mb-2 text-[11px] font-bold text-muted-foreground">راهنمای خرید</p>
      <ul className="space-y-1">
        <MenuItem to="/page/about" icon={Info} label="درباره خانه‌گی" />
        <MenuItem to="/page/faq" icon={FileText} label="پرسش‌های متداول" />
        <MenuItem to="/page/shipping" icon={FileText} label="شیوه‌های ارسال" />
        <MenuItem to="/page/returns" icon={FileText} label="رویه بازگشت کالا" />
        <MenuItem to="/page/contact" icon={FileText} label="تماس با ما" />
      </ul>
    </nav>
  );
}

function MenuItem({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <li>
      <a
        href={href(to)}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium transition-colors hover:bg-accent"
      >
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </a>
    </li>
  );
}
