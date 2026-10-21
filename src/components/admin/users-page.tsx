"use client";
// Admin users page (#/admin/users) — search, status filter, paginated table,
// block/unblock switch, role-change dialog, user detail with recent orders.

import { useEffect, useState } from "react";
import { Loader2, Search, UserCog, UserRoundSearch } from "lucide-react";
import {
  formatDateFa,
  formatDateTimeFa,
  formatToman,
  toFaDigits,
} from "@/lib/money";
import { useAdminUsers, useAdminUserDetail, useChangeUserRole, useToggleUserActive } from "@/hooks/use-admin-users";
import type { AdminUserRowDTO, Role } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { ErrorState } from "@/components/store/empty-state";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import {
  AdminPagination,
  OrderStatusBadge,
  PaymentStatusBadge,
  SkeletonTable,
  ToneBadge,
  type Tone,
} from "@/components/admin/admin-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLE_TONES: Record<Role, Tone> = {
  ADMIN: "amber",
  STAFF: "teal",
  CUSTOMER: "zinc",
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "مدیر",
  STAFF: "کارمند",
  CUSTOMER: "مشتری",
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "دسترسی کامل به همه بخش‌های پنل مدیریت",
  STAFF: "دسترسی به سفارش‌ها، موجودی و بررسی دیدگاه‌ها؛ بدون مدیریت کاربران و قیمت‌گذاری",
  CUSTOMER: "دسترسی عادی فروشگاه",
};

// ─── Role change dialog ─────────────────────────────────────────────────────

function RoleDialog({
  target,
  onClose,
}: {
  target: AdminUserRowDTO | null;
  onClose: () => void;
}) {
  const changeRole = useChangeUserRole();
  // Initialized from the target; the parent remounts this dialog per user (key),
  // so no state-sync effect is needed.
  const [role, setRole] = useState<Role>(target?.role ?? "CUSTOMER");

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-5 text-highlight" aria-hidden />
            تغییر نقش کاربر
          </DialogTitle>
        </DialogHeader>
        {target && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="font-bold">{target.name}</p>
              <p dir="ltr" className="mt-0.5 text-xs text-muted-foreground">
                {target.phone}
                {target.email ? ` · ${target.email}` : ""}
              </p>
            </div>
            <RadioGroup
              value={role}
              onValueChange={(v) => setRole(v as Role)}
              className="gap-2"
              aria-label="انتخاب نقش جدید"
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <Label
                  key={r}
                  htmlFor={`role-${r}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 has-[button[data-state=checked]]:border-highlight"
                >
                  <RadioGroupItem id={`role-${r}`} value={r} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-bold">{ROLE_LABELS[r]}</span>
                    <span className="block text-xs font-normal leading-5 text-muted-foreground">
                      {ROLE_DESCRIPTIONS[r]}
                    </span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">
              توجه: تغییر نقش بلافاصله اعمال می‌شود و دسترسی‌های کاربر را تغییر می‌دهد.
              حداقل یک مدیر فعال باید همیشه در سیستم باقی بماند و نمی‌توانید نقش حساب
              خودتان را تغییر دهید.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" className="font-bold" onClick={onClose}>
            انصراف
          </Button>
          <Button
            type="button"
            className="gap-1.5 font-bold"
            disabled={!target || changeRole.isPending || role === target.role}
            onClick={() =>
              target &&
              changeRole.mutate(
                { id: target.id, role },
                { onSuccess: onClose }
              )
            }
          >
            {changeRole.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            ذخیره نقش
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── User detail dialog (profile + recent orders) ───────────────────────────

function UserDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading, isError, refetch } = useAdminUserDetail(id);
  const user = data?.user;

  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundSearch className="size-5 text-highlight" aria-hidden />
            جزئیات کاربر
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2" aria-hidden>
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : isError || !user ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">نام: </span>
                <span className="font-bold">{user.name}</span>
              </p>
              <p>
                <span className="text-muted-foreground">شماره موبایل: </span>
                <span dir="ltr" className="font-bold">
                  {user.phone}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">ایمیل: </span>
                {user.email ? (
                  <span dir="ltr" className="font-bold">
                    {user.email}
                  </span>
                ) : (
                  "—"
                )}
              </p>
              <p className="flex items-center gap-2">
                <span className="text-muted-foreground">نقش: </span>
                <ToneBadge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</ToneBadge>
                {!user.isActive && <ToneBadge tone="rose">مسدود</ToneBadge>}
              </p>
              <p>
                <span className="text-muted-foreground">تعداد سفارش: </span>
                <span className="font-bold tabular-fa">{toFaDigits(String(user.ordersCount))}</span>
              </p>
              <p>
                <span className="text-muted-foreground">مجموع خرید: </span>
                <span className="font-bold tabular-fa">{formatToman(user.totalSpentToman)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">تاریخ عضویت: </span>
                <span className="tabular-fa">{formatDateFa(user.createdAt)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">آخرین سفارش: </span>
                <span className="tabular-fa">
                  {user.lastOrderAt ? formatDateFa(user.lastOrderAt) : "—"}
                </span>
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="mb-2 text-sm font-extrabold">۱۰ سفارش اخیر</h3>
              {user.recentOrders.length === 0 ? (
                <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                  این کاربر هنوز سفارشی ثبت نکرده است.
                </p>
              ) : (
                <ul className="space-y-2">
                  {user.recentOrders.map((o) => (
                    <li
                      key={o.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span dir="ltr" className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-bold">
                          {o.orderNumber}
                        </span>
                        <OrderStatusBadge status={o.status} />
                        <PaymentStatusBadge status={o.paymentStatus} />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold tabular-fa">{formatToman(o.totalToman)}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTimeFa(o.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [page, setPage] = useState(1);
  const [roleTarget, setRoleTarget] = useState<AdminUserRowDTO | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useAdminUsers({ q, status, page });
  const toggle = useToggleUserActive();

  useEffect(() => {
    document.title = "کاربران | پنل مدیریت خانه‌گی";
  }, []);

  // Debounced search → resets to first page.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const rows = data?.items ?? [];

  return (
    <div>
      <AdminPageHeader
        title="کاربران"
        description="مدیریت کاربران فروشگاه؛ مسدودسازی حساب و تغییر نقش دسترسی."
      />

      <Card className="mb-4 rounded-xl">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="جستجوی نام، شماره موبایل یا ایمیل…"
              aria-label="جستجوی کاربران"
              className="h-10 bg-white ps-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as typeof status);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-full bg-white sm:w-44" aria-label="فیلتر وضعیت حساب">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه کاربران</SelectItem>
              <SelectItem value="active">فعال</SelectItem>
              <SelectItem value="blocked">مسدود</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardContent className="p-4">
          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <SkeletonTable rows={5} cols={6} />
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              کاربری با این مشخصات یافت نشد.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>کاربر</TableHead>
                      <TableHead>نقش</TableHead>
                      <TableHead>سفارش‌ها</TableHead>
                      <TableHead>مجموع خرید</TableHead>
                      <TableHead>تاریخ عضویت</TableHead>
                      <TableHead>فعال</TableHead>
                      <TableHead>عملیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((u) => {
                      const isSelf = u.id === me?.id;
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <p className="text-sm font-bold">{u.name}</p>
                            <p dir="ltr" className="mt-0.5 text-xs text-muted-foreground">
                              {u.phone}
                              {u.email ? ` · ${u.email}` : ""}
                            </p>
                          </TableCell>
                          <TableCell>
                            <ToneBadge tone={ROLE_TONES[u.role]}>{ROLE_LABELS[u.role]}</ToneBadge>
                            {!u.isActive && (
                              <ToneBadge tone="rose" className="ms-1">
                                مسدود
                              </ToneBadge>
                            )}
                          </TableCell>
                          <TableCell className="text-[13px] tabular-fa">
                            {toFaDigits(String(u.ordersCount))}
                            {u.lastOrderAt && (
                              <span className="block text-[11px] text-muted-foreground">
                                آخرین: {formatDateFa(u.lastOrderAt)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-[13px] font-bold tabular-fa">
                            {formatToman(u.totalSpentToman)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-[13px]">
                            {formatDateFa(u.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={u.isActive}
                              disabled={isSelf || toggle.isPending}
                              aria-label={
                                u.isActive ? `مسدودسازی حساب ${u.name}` : `فعال‌سازی حساب ${u.name}`
                              }
                              onCheckedChange={(v) => toggle.mutate({ id: u.id, isActive: v })}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 text-xs font-bold"
                                disabled={isSelf}
                                onClick={() => setRoleTarget(u)}
                              >
                                <UserCog className="size-3.5" aria-hidden />
                                تغییر نقش
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1 text-xs font-bold text-highlight"
                                onClick={() => setDetailId(u.id)}
                              >
                                جزئیات
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <AdminPagination
                page={page}
                pageSize={20}
                total={data?.total ?? 0}
                onPage={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <RoleDialog
        key={roleTarget?.id ?? "none"}
        target={roleTarget}
        onClose={() => setRoleTarget(null)}
      />
      <UserDetailDialog id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
