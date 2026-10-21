"use client";
// Admin coupons (#/admin/coupons) — table with activate switch + create dialog.

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, TicketPercent } from "lucide-react";
import { formatDateFa, formatToman, toFaDigits, toEnDigits } from "@/lib/money";
import { useAdminCoupons, useCreateCoupon, useToggleCoupon } from "@/hooks/use-admin";
import { ErrorState } from "@/components/store/empty-state";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { SkeletonTable, ToneBadge } from "@/components/admin/admin-bits";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "کد تخفیف باید حداقل ۲ کاراکتر باشد.")
      .max(40, "حداکثر ۴۰ کاراکتر مجاز است.")
      .transform((v) => v.toUpperCase()),
    type: z.enum(["PERCENT", "AMOUNT"], { message: "نوع تخفیف نامعتبر است." }),
    value: z.preprocess(
      (v) => {
        if (v == null) return null;
        const s = toEnDigits(String(v)).replace(/[,\s٬]/g, "");
        return s === "" ? null : Number(s);
      },
      z.number({ error: "مقدار واردشده عدد نیست." }).int("مقدار باید عدد صحیح باشد.").positive("مقدار تخفیف باید بزرگ‌تر از صفر باشد.")
    ),
    minOrderToman: z.preprocess(
      (v) => {
        if (v == null) return null;
        const s = toEnDigits(String(v)).replace(/[,\s٬]/g, "");
        return s === "" ? null : Number(s);
      },
      z.number({ error: "مقدار واردشده عدد نیست." }).int("باید عدد صحیح باشد.").min(0, "حداقل سفارش نمی‌تواند منفی باشد.").nullable()
    ),
    maxDiscountToman: z.preprocess(
      (v) => {
        if (v == null) return null;
        const s = toEnDigits(String(v)).replace(/[,\s٬]/g, "");
        return s === "" ? null : Number(s);
      },
      z.number({ error: "مقدار واردشده عدد نیست." }).int("باید عدد صحیح باشد.").positive("سقف تخفیف باید بزرگ‌تر از صفر باشد.").nullable()
    ),
    usageLimit: z.preprocess(
      (v) => {
        if (v == null) return null;
        const s = toEnDigits(String(v)).replace(/[,\s٬]/g, "");
        return s === "" ? null : Number(s);
      },
      z.number({ error: "مقدار واردشده عدد نیست." }).int("باید عدد صحیح باشد.").positive("سقف استفاده باید بزرگ‌تر از صفر باشد.").nullable()
    ),
    validUntil: z.string(),
    isActive: z.boolean(),
  })
  .refine((v) => v.type !== "PERCENT" || (v.value >= 1 && v.value <= 90), {
    message: "درصد تخفیف باید بین ۱ تا ۹۰ باشد.",
    path: ["value"],
  });

type CouponForm = z.infer<typeof couponSchema>;

function CreateCouponDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateCoupon();
  const form = useForm<z.input<typeof couponSchema>, unknown, z.output<typeof couponSchema>>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: "",
      type: "PERCENT",
      value: null,
      minOrderToman: null,
      maxDiscountToman: null,
      usageLimit: null,
      validUntil: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        code: "",
        type: "PERCENT",
        value: null,
        minOrderToman: null,
        maxDiscountToman: null,
        usageLimit: null,
        validUntil: "",
        isActive: true,
      });
    }
  }, [open, form]);

  const type = form.watch("type");
  const err = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>کد تخفیف جدید</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) =>
            create.mutate(
              {
                code: v.code,
                type: v.type,
                value: v.value,
                minOrderToman: v.minOrderToman,
                maxDiscountToman: v.type === "PERCENT" ? v.maxDiscountToman : null,
                usageLimit: v.usageLimit,
                validUntil: v.validUntil || undefined,
                isActive: v.isActive,
              },
              { onSuccess: () => onOpenChange(false) }
            )
          )}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-code">کد تخفیف *</Label>
              <Input
                id="c-code"
                dir="ltr"
                placeholder="مثلاً YALDA1404"
                className="mt-1.5 h-10 bg-white text-left font-mono"
                {...form.register("code")}
              />
              {err.code && <p className="mt-1 text-xs text-destructive">{err.code.message}</p>}
            </div>
            <div>
              <Label>نوع تخفیف</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1.5 h-10 w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">درصدی</SelectItem>
                      <SelectItem value="AMOUNT">مبلغی (تومان)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-value">{type === "PERCENT" ? "درصد تخفیف (۱ تا ۹۰) *" : "مبلغ تخفیف (تومان) *"}</Label>
              <Input
                id="c-value"
                inputMode="numeric"
                dir="ltr"
                className="mt-1.5 h-10 bg-white text-right tabular-fa"
                {...form.register("value")}
              />
              {err.value && <p className="mt-1 text-xs text-destructive">{err.value.message}</p>}
            </div>
            <div>
              <Label htmlFor="c-min">حداقل مبلغ سفارش (تومان)</Label>
              <Input
                id="c-min"
                inputMode="numeric"
                dir="ltr"
                placeholder="بدون محدودیت"
                className="mt-1.5 h-10 bg-white text-right tabular-fa"
                {...form.register("minOrderToman")}
              />
              {err.minOrderToman && <p className="mt-1 text-xs text-destructive">{err.minOrderToman.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="c-max">سقف تخفیف (تومان)</Label>
              <Input
                id="c-max"
                inputMode="numeric"
                dir="ltr"
                placeholder="فقط درصدی"
                disabled={type !== "PERCENT"}
                className="mt-1.5 h-10 bg-white text-right tabular-fa"
                {...form.register("maxDiscountToman")}
              />
              {err.maxDiscountToman && <p className="mt-1 text-xs text-destructive">{err.maxDiscountToman.message}</p>}
            </div>
            <div>
              <Label htmlFor="c-limit">سقف تعداد استفاده</Label>
              <Input
                id="c-limit"
                inputMode="numeric"
                dir="ltr"
                placeholder="بدون محدودیت"
                className="mt-1.5 h-10 bg-white text-right tabular-fa"
                {...form.register("usageLimit")}
              />
              {err.usageLimit && <p className="mt-1 text-xs text-destructive">{err.usageLimit.message}</p>}
            </div>
            <div>
              <Label htmlFor="c-until">تاریخ انقضا</Label>
              <Input
                id="c-until"
                type="date"
                dir="ltr"
                className="mt-1.5 h-10 bg-white text-right"
                {...form.register("validUntil")}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <Label htmlFor="c-active" className="text-[13px] font-bold">
              فعال باشد
            </Label>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch id="c-active" checked={field.value} onCheckedChange={field.onChange} aria-label="فعال باشد" />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="font-bold" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" className="gap-1.5 font-bold" disabled={create.isPending}>
              {create.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              ایجاد کد تخفیف
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminCouponsPage() {
  const { data, isLoading, isError, refetch } = useAdminCoupons();
  const toggle = useToggleCoupon();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    document.title = "کدهای تخفیف | پنل مدیریت خانه‌گی";
  }, []);

  return (
    <div>
      <AdminPageHeader
        title="کدهای تخفیف"
        description="مدیریت کدهای تخفیف فروشگاه."
        actions={
          <Button className="gap-1.5 font-bold" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" aria-hidden />
            کد تخفیف جدید
          </Button>
        }
      />

      <Card className="rounded-xl">
        <CardContent className="p-4">
          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <SkeletonTable rows={4} cols={6} />
          ) : (data ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">هنوز کد تخفیفی ساخته نشده است.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>کد</TableHead>
                    <TableHead>نوع</TableHead>
                    <TableHead>مقدار</TableHead>
                    <TableHead>حداقل سفارش</TableHead>
                    <TableHead>سقف / مصرف</TableHead>
                    <TableHead>انقضا</TableHead>
                    <TableHead>فعال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span dir="ltr" className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-bold">
                          {c.code}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={c.type === "PERCENT" ? "teal" : "orange"}>
                          {c.type === "PERCENT" ? "درصدی" : "مبلغی"}
                        </ToneBadge>
                      </TableCell>
                      <TableCell className="text-[13px] font-bold tabular-fa">
                        {c.type === "PERCENT" ? `${toFaDigits(String(c.value))}٪` : formatToman(c.value)}
                        {c.type === "PERCENT" && c.maxDiscountToman != null && (
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            سقف: {formatToman(c.maxDiscountToman)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-[13px] tabular-fa">
                        {c.minOrderToman != null ? formatToman(c.minOrderToman) : "—"}
                      </TableCell>
                      <TableCell className="text-[13px] tabular-fa">
                        {c.usageLimit != null
                          ? `${toFaDigits(String(c.timesUsed))} از ${toFaDigits(String(c.usageLimit))}`
                          : `${toFaDigits(String(c.timesUsed))} بار`}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[13px]">
                        {c.validUntil ? formatDateFa(c.validUntil) : "—"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.isActive}
                          disabled={toggle.isPending}
                          aria-label={c.isActive ? `غیرفعال‌سازی کد ${c.code}` : `فعال‌سازی کد ${c.code}`}
                          onCheckedChange={(v) => toggle.mutate({ id: c.id, isActive: v })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateCouponDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
