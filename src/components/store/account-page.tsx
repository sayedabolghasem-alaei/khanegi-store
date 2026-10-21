"use client";
// Account area (#/account, #/account/orders, #/account/profile,
// #/account/addresses) — guarded by auth.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Heart,
  KeyRound,
  LogOut,
  MapPin,
  Package,
  Plus,
  Star,
  Trash2,
  User,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/client-api";
import { navigate, href } from "@/lib/router";
import { formatToman, toFaDigits, formatDateFa } from "@/lib/money";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";
import type { AddressDTO, OrderDTO } from "@/lib/types";
import { useAuth, logoutRequest } from "@/hooks/use-auth";
import { AddressForm } from "@/components/store/address-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState, ErrorState } from "@/components/store/empty-state";
import { ListRowSkeleton } from "@/components/store/skeletons";
import { LineThumb } from "@/components/store/line-thumb";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-sky-50 text-sky-700 border-sky-200",
  PROCESSING: "bg-violet-50 text-violet-700 border-violet-200",
  SHIPPED: "bg-cyan-50 text-cyan-700 border-cyan-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

const MENU = [
  { to: "/account", label: "نمای کلی", icon: User },
  { to: "/account/orders", label: "سفارش‌های من", icon: Package },
  { to: "/account/addresses", label: "آدرس‌های من", icon: MapPin },
  { to: "/account/profile", label: "پروفایل و امنیت", icon: KeyRound },
] as const;

/* ─────────────────────────────── Layout ───────────────────────────────── */

function AccountLayout({ active, children }: { active: string; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isLoading && !user) navigate("/login?redirect=/account", { replace: true });
  }, [isLoading, user]);

  const logout = useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      qc.setQueryData(["me"], { user: null });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("از حساب خود خارج شدید.");
      navigate("/");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !user) {
    return (
      <div className="container-store py-10">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-store py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-highlight-soft text-highlight">
          <UserCircle2 className="size-7" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-extrabold sm:text-xl">{user.name} عزیز، خوش آمدید 👋</h1>
          <p className="text-xs text-muted-foreground tabular-fa" dir="ltr">
            {toFaDigits(user.phone)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Side menu */}
        <nav aria-label="منوی حساب کاربری" className="h-fit rounded-xl border bg-white p-3 lg:sticky lg:top-32">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {MENU.map((m) => (
              <li key={m.to} className="shrink-0">
                <a
                  href={href(m.to)}
                  aria-current={active === m.to ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-bold transition-colors",
                    active === m.to
                      ? "bg-highlight-soft text-highlight"
                      : "text-foreground/75 hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <m.icon className="size-4" aria-hidden />
                  {m.label}
                </a>
              </li>
            ))}
            <li className="shrink-0">
              <a
                href={href("/wishlist")}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-bold text-foreground/75 transition-colors hover:bg-accent"
              >
                <Heart className="size-4" aria-hidden />
                علاقه‌مندی‌ها
              </a>
            </li>
            <li className="shrink-0 lg:border-t lg:pt-2 lg:mt-2">
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-bold text-destructive transition-colors hover:bg-destructive/5"
              >
                <LogOut className="size-4" aria-hidden />
                خروج از حساب
              </button>
            </li>
          </ul>
        </nav>

        {/* Content */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Overview tab ───────────────────────────── */

function AccountOverview() {
  const { user } = useAuth();
  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: () => apiGet<OrderDTO[]>("/api/orders"),
  });

  const tiles = [
    { to: "/account/orders", icon: Package, label: "سفارش‌های من", value: orders ? `${toFaDigits(String(orders.length))} سفارش` : "…" },
    { to: "/account/addresses", icon: MapPin, label: "آدرس‌های من", value: "مدیریت آدرس‌ها" },
    { to: "/wishlist", icon: Heart, label: "علاقه‌مندی‌ها", value: "لیست خرید بعدی" },
    { to: "/account/profile", icon: KeyRound, label: "امنیت حساب", value: "تغییر رمز عبور" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <a
            key={t.to}
            href={href(t.to)}
            className="card-lift rounded-xl border bg-white p-4"
          >
            <t.icon className="size-5 text-highlight" aria-hidden />
            <p className="mt-2 text-sm font-bold">{t.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.value}</p>
          </a>
        ))}
      </div>

      <section className="rounded-xl border bg-white p-5" aria-label="آخرین سفارش‌ها">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">آخرین سفارش‌ها</h2>
          <a href={href("/account/orders")} className="flex items-center gap-0.5 text-[13px] font-bold text-highlight hover:underline">
            همه سفارش‌ها
            <ChevronLeft className="size-4" aria-hidden />
          </a>
        </div>
        {!orders ? (
          <ListRowSkeleton rows={2} />
        ) : orders.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            هنوز سفارشی ثبت نکرده‌اید. اولین خریدتان را انجام دهید!
          </p>
        ) : (
          <ul className="space-y-3">
            {orders.slice(0, 3).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-bold tabular-fa" dir="ltr">{toFaDigits(o.orderNumber)}</p>
                  <p className="text-xs text-muted-foreground">{formatDateFa(o.createdAt)}</p>
                </div>
                <Badge variant="outline" className={cn("border text-xs", STATUS_STYLES[o.status])}>
                  {ORDER_STATUS_LABELS[o.status]}
                </Badge>
                <span className="text-sm font-extrabold tabular-fa">{formatToman(o.totalToman)}</span>
                <Button size="sm" variant="outline" onClick={() => navigate(`/order/${o.orderNumber}`)}>
                  جزئیات
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ───────────────────────────── Orders tab ─────────────────────────────── */

function OrdersTab() {
  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: () => apiGet<OrderDTO[]>("/api/orders"),
  });

  useEffect(() => {
    document.title = "سفارش‌های من";
  }, []);

  if (isLoading) return <ListRowSkeleton rows={4} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!orders || orders.length === 0) {
    return (
      <EmptyState
        title="هنوز سفارشی ثبت نکرده‌اید"
        description="با اولین خرید، سفارش شما اینجا نمایش داده می‌شود."
        action={
          <Button onClick={() => navigate("/")}>شروع خرید</Button>
        }
      />
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((o) => (
        <li key={o.id} className="rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-extrabold">
                <Package className="size-4 text-highlight" aria-hidden />
                <span dir="ltr" className="tabular-fa">{toFaDigits(o.orderNumber)}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDateFa(o.createdAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("border text-xs", STATUS_STYLES[o.status])}>
                {ORDER_STATUS_LABELS[o.status]}
              </Badge>
              <Badge variant="outline" className="border-transparent bg-muted text-xs">
                {PAYMENT_STATUS_LABELS[o.paymentStatus]}
              </Badge>
            </div>
          </div>

          <Separator className="my-3" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex -space-x-3">
              {o.items.slice(0, 4).map((it) => (
                <span key={it.id} className="rounded-lg border bg-white shadow-sm" title={it.productName}>
                  <LineThumb src={it.image} alt={it.productName} />
                </span>
              ))}
              {o.items.length > 4 && (
                <span className="flex size-20 items-center justify-center rounded-lg border bg-muted/60 text-xs font-bold">
                  +{toFaDigits(String(o.items.length - 4))}
                </span>
              )}
            </div>
            <div className="text-end">
              <p className="text-xs text-muted-foreground tabular-fa">
                {toFaDigits(String(o.items.length))} قلم کالا
              </p>
              <p className="text-base font-extrabold tabular-fa">{formatToman(o.totalToman)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate(`/order/${o.orderNumber}`)}>
              جزئیات سفارش
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────────── Profile tab ────────────────────────────── */

function ProfileTab() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const changePassword = useMutation({
    mutationFn: () =>
      apiPost("/api/auth/change-password", { currentPassword: current, newPassword: next }),
    onSuccess: () => {
      toast.success("رمز عبور با موفقیت تغییر کرد.");
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-5" aria-label="اطلاعات حساب">
        <h2 className="mb-4 font-bold">اطلاعات حساب</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between rounded-lg bg-muted/40 px-3 py-2.5 sm:flex-col sm:bg-transparent sm:p-0">
            <dt className="text-muted-foreground">نام</dt>
            <dd className="font-bold">{user?.name}</dd>
          </div>
          <div className="flex justify-between rounded-lg bg-muted/40 px-3 py-2.5 sm:flex-col sm:bg-transparent sm:p-0">
            <dt className="text-muted-foreground">شماره موبایل</dt>
            <dd className="font-bold tabular-fa" dir="ltr">{user && toFaDigits(user.phone)}</dd>
          </div>
          <div className="flex justify-between rounded-lg bg-muted/40 px-3 py-2.5 sm:flex-col sm:bg-transparent sm:p-0">
            <dt className="text-muted-foreground">ایمیل</dt>
            <dd className="font-bold" dir="ltr">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between rounded-lg bg-muted/40 px-3 py-2.5 sm:flex-col sm:bg-transparent sm:p-0">
            <dt className="text-muted-foreground">سطح دسترسی</dt>
            <dd className="font-bold">{user?.role === "CUSTOMER" ? "مشتری" : user?.role === "STAFF" ? "کارمند" : "مدیر"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          ویرایش اطلاعات پروفایل در این نسخه نمایشی در دسترس نیست. [نشان‌گذاری آزمایشی]
        </p>
      </section>

      <section className="rounded-xl border bg-white p-5" aria-label="تغییر رمز عبور">
        <h2 className="mb-4 font-bold">تغییر رمز عبور</h2>
        <form
          className="max-w-md space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (next.length < 8) {
              toast.warning("رمز عبور جدید باید حداقل ۸ کاراکتر باشد.");
              return;
            }
            if (next !== confirm) {
              toast.warning("تکرار رمز عبور مطابقت ندارد.");
              return;
            }
            changePassword.mutate();
          }}
        >
          <div>
            <Label htmlFor="pw-current">رمز عبور فعلی</Label>
            <Input
              id="pw-current"
              type="password"
              dir="ltr"
              className="mt-1.5 bg-white text-right"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="pw-next">رمز عبور جدید</Label>
            <Input
              id="pw-next"
              type="password"
              dir="ltr"
              className="mt-1.5 bg-white text-right"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="pw-confirm">تکرار رمز عبور جدید</Label>
            <Input
              id="pw-confirm"
              type="password"
              dir="ltr"
              className="mt-1.5 bg-white text-right"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="font-bold" disabled={changePassword.isPending}>
            {changePassword.isPending ? "در حال ذخیره…" : "تغییر رمز عبور"}
          </Button>
        </form>
      </section>
    </div>
  );
}

/* ──────────────────────────── Addresses tab ───────────────────────────── */

function AddressesTab() {
  const qc = useQueryClient();
  const { data: addresses, isLoading, isError, refetch } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => apiGet<AddressDTO[]>("/api/addresses"),
  });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/addresses/${id}`),
    onSuccess: () => {
      toast.info("آدرس حذف شد.");
      qc.invalidateQueries({ queryKey: ["addresses"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setDefault = useMutation({
    mutationFn: (a: AddressDTO) => apiPatch<AddressDTO>(`/api/addresses/${a.id}`, { isDefault: true }),
    onSuccess: () => {
      toast.success("آدرس پیش‌فرض به‌روزرسانی شد.");
      qc.invalidateQueries({ queryKey: ["addresses"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    document.title = "آدرس‌های من";
  }, []);

  if (isLoading) return <ListRowSkeleton rows={3} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const editing = addresses?.find((a) => a.id === editingId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">آدرس‌های من</h2>
        {!adding && !editingId && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            آدرس جدید
          </Button>
        )}
      </div>

      {adding && (
        <AddressForm
          onSaved={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      )}
      {editing && (
        <AddressForm existing={editing} onSaved={() => setEditingId(null)} onCancel={() => setEditingId(null)} />
      )}

      {addresses && addresses.length === 0 && !adding && (
        <EmptyState
          title="هنوز آدرسی ثبت نکرده‌اید"
          description="برای تسریع فرایند خرید، آدرس تحویل خود را اضافه کنید."
          action={<Button onClick={() => setAdding(true)}>افزودن آدرس</Button>}
        />
      )}

      <ul className="space-y-3">
        {addresses?.map((a) => (
          <li key={a.id} className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  <MapPin className="size-4 text-highlight" aria-hidden />
                  {a.title || "آدرس"}
                  {a.isDefault && (
                    <span className="flex items-center gap-1 rounded-full bg-highlight-soft px-2 py-0.5 text-[10px] font-bold text-highlight">
                      <Star className="size-3" aria-hidden />
                      پیش‌فرض
                    </span>
                  )}
                </p>
                <p className="mt-1 leading-6 text-muted-foreground">
                  {a.province}، {a.city}، {a.line}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-fa">
                  گیرنده: {a.receiverName} — {toFaDigits(a.phone)} — کدپستی {toFaDigits(a.postalCode)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {!a.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setDefault.mutate(a)}
                    disabled={setDefault.isPending}
                  >
                    <Star className="size-3.5" />
                    پیش‌فرض
                  </Button>
                )}
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditingId(a.id)}>
                  ویرایش
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label={`حذف آدرس ${a.title || ""}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>حذف این آدرس؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        آدرس «{a.title || a.city}» از حساب شما حذف می‌شود.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>انصراف</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => remove.mutate(a.id)}
                      >
                        حذف
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────── Exports ──────────────────────────────── */

export function AccountPage({ tab = "overview" }: { tab?: "overview" | "orders" | "profile" | "addresses" }) {
  useEffect(() => {
    if (tab === "overview") document.title = "حساب کاربری";
  }, [tab]);

  return (
    <AccountLayout active={tab === "overview" ? "/account" : `/account/${tab}`}>
      {tab === "overview" && <AccountOverview />}
      {tab === "orders" && <OrdersTab />}
      {tab === "profile" && <ProfileTab />}
      {tab === "addresses" && <AddressesTab />}
    </AccountLayout>
  );
}
