"use client";
// Admin shell — auth guard + sidebar layout (desktop sidebar on the visual
// right in RTL; collapsible Sheet on mobile). Header/footer-independent: the
// admin area renders its own chrome.

import { useEffect } from "react";
import {
  Banknote,
  BarChart3,
  Boxes,
  Download,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquareText,
  Package,
  Settings,
  ShieldAlert,
  ShoppingBag,
  TicketPercent,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { href, navigate, useHashLocation } from "@/lib/router";
import { SITE_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAuth, logoutRequest } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const NAV_ITEMS = [
  { to: "/admin/overview", label: "داشبورد", icon: LayoutDashboard },
  { to: "/admin/products", label: "محصولات", icon: Package },
  { to: "/admin/orders", label: "سفارش‌ها", icon: ShoppingBag },
  { to: "/admin/reports", label: "گزارش فروش", icon: BarChart3 },
  { to: "/admin/inventory", label: "موجودی", icon: Boxes },
  { to: "/admin/pricing", label: "قیمت‌گذاری", icon: Banknote },
  { to: "/admin/coupons", label: "کدهای تخفیف", icon: TicketPercent },
  { to: "/admin/reviews", label: "نظرات", icon: MessageSquareText },
  { to: "/admin/users", label: "کاربران", icon: Users },
  { to: "/admin/settings", label: "تنظیمات فروشگاه", icon: Settings },
  { to: "/admin/exports", label: "خروجی و ورود داده", icon: Download },
] as const;

function roleLabelFa(role: string): string {
  if (role === "ADMIN") return "مدیر";
  if (role === "STAFF") return "کارمند";
  return "مشتری";
}

function AdminBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", compact && "gap-2")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <LayoutDashboard className="size-4.5" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-extrabold">پنل مدیریت</p>
        <p className="text-[11px] text-muted-foreground">{SITE_NAME}</p>
      </div>
    </div>
  );
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const { path } = useHashLocation();
  const active = (to: string) => path === to || (to !== "/admin/overview" && path.startsWith(to));
  return (
    <nav aria-label="منوی مدیریت" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active(item.to);
        return (
          <a
            key={item.to}
            href={href(item.to)}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="size-4.5 shrink-0" aria-hidden />
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

function AdminSidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const handleLogout = async () => {
    try {
      await logoutRequest();
      toast.success("با موفقیت خارج شدید.");
      navigate("/", { replace: true });
    } catch {
      toast.error("خروج از حساب ناموفق بود.");
    }
  };
  return (
    <div className="space-y-3">
      <Separator />
      <a
        href={href("/")}
        onClick={onNavigate}
        className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-bold text-highlight transition-colors hover:bg-accent"
      >
        <ExternalLink className="size-4" aria-hidden />
        بازگشت به فروشگاه
      </a>
      {user && (
        <div className="rounded-xl bg-muted/60 p-3">
          <p className="truncate text-sm font-bold">{user.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {roleLabelFa(user.role)} · <span dir="ltr">{user.phone}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2.5 h-8 w-full gap-1.5 text-xs"
            onClick={handleLogout}
          >
            <LogOut className="size-3.5" aria-hidden />
            خروج از حساب
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Guard states ───────────────────────────────────────────────────────────

function GuardSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40" role="status" aria-label="در حال بارگذاری پنل مدیریت">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-highlight" aria-hidden />
        <p className="text-sm font-bold text-muted-foreground">در حال بارگذاری پنل مدیریت…</p>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
          <ShieldAlert className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-extrabold">دسترسی غیرمجاز</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          شما مجوز دسترسی به بخش مدیریت را ندارید. این بخش فقط برای مدیران و کارمندان فروشگاه در
          دسترس است.
        </p>
        <Button className="mt-5 font-bold" onClick={() => navigate("/")}>
          بازگشت به فروشگاه
        </Button>
      </div>
    </div>
  );
}

function LoginRedirect() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-highlight-soft text-highlight">
          <LogOut className="size-7 rotate-180" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-extrabold">ورود به پنل مدیریت</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          برای دسترسی به بخش مدیریت ابتدا وارد حساب کاربری خود شوید. در حال انتقال به صفحه ورود…
        </p>
      </div>
    </div>
  );
}

// ─── Shell ──────────────────────────────────────────────────────────────────

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { path } = useHashLocation();

  // Guard: unauthenticated → login with return path; customers → 403.
  useEffect(() => {
    if (!isLoading && !user) {
      navigate(`/login?redirect=${encodeURIComponent(path || "/admin/overview")}`, { replace: true });
    }
  }, [isLoading, user, path]);

  if (isLoading) return <GuardSkeleton />;
  if (!user) return <LoginRedirect />;
  if (user.role === "CUSTOMER") return <AccessDenied />;

  return (
    <div className="flex min-h-screen flex-col bg-muted/40 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-white px-4 py-3 lg:hidden">
        <AdminBrand compact />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="size-10" aria-label="باز کردن منوی مدیریت">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 overflow-y-auto p-0">
            <div className="flex h-full flex-col gap-5 p-4">
              <SheetTitle asChild>
                <div>
                  <AdminBrand />
                </div>
              </SheetTitle>
              <AdminNav />
              <div className="mt-auto">
                <AdminSidebarFooter />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop sidebar (right side in RTL as first grid column) */}
      <aside className="hidden flex-col gap-6 border-e bg-white p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto">
        <AdminBrand />
        <AdminNav />
        <div className="mt-auto">
          <AdminSidebarFooter />
        </div>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </div>
    </div>
  );
}

// Page heading helper shared by all views.
export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
