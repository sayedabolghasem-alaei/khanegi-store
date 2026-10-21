"use client";
// Admin inventory (#/admin/inventory) — low-stock list with adjust dialog +
// movements history table.

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Boxes, Loader2, PackageMinus, SlidersHorizontal } from "lucide-react";
import { formatToman, timeAgoFa, toFaDigits, toEnDigits } from "@/lib/money";
import { href } from "@/lib/router";
import { useAdjustStock, useAdminStats, useInventoryMovements } from "@/hooks/use-admin";
import { ErrorState } from "@/components/store/empty-state";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import {
  AdminPagination,
  SkeletonRows,
  SkeletonTable,
  StockBadge,
  ToneBadge,
} from "@/components/admin/admin-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  IN: "ورود کالا",
  OUT: "خروج کالا",
  ADJUSTMENT: "اصلاح شمارش",
};

const MOVEMENT_TYPE_TONES: Record<string, "emerald" | "rose" | "amber"> = {
  IN: "emerald",
  OUT: "rose",
  ADJUSTMENT: "amber",
};

const adjustSchema = z.object({
  type: z.enum(["IN", "OUT", "ADJUSTMENT"], { message: "نوع حرکت نامعتبر است." }),
  quantity: z.preprocess(
    (v) => {
      if (v == null) return null;
      const s = toEnDigits(String(v)).replace(/[,\s٬]/g, "");
      return s === "" ? null : Number(s);
    },
    z.number({ error: "مقدار واردشده عدد نیست." }).int("تعداد باید عدد صحیح باشد.").positive("تعداد باید بزرگ‌تر از صفر باشد.")
  ),
  reason: z.string().trim().min(2, "دلیل تغییر موجودی الزامی است.").max(200, "حداکثر ۲۰۰ کاراکتر مجاز است."),
});

type AdjustForm = z.infer<typeof adjustSchema>;

function AdjustDialog({
  productId,
  productName,
  currentStock,
  onClose,
}: {
  productId: string;
  productName: string;
  currentStock: number;
  onClose: () => void;
}) {
  const adjust = useAdjustStock();
  const form = useForm<z.input<typeof adjustSchema>, unknown, z.output<typeof adjustSchema>>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { type: "IN", quantity: null, reason: "" },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>اصلاح موجودی</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg bg-muted/40 p-3 text-[13px]">
          <p className="font-bold">{productName}</p>
          <p className="mt-1 text-muted-foreground tabular-fa">
            موجودی فعلی: {toFaDigits(String(currentStock))} عدد
          </p>
        </div>
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) =>
            adjust.mutate(
              { productId, type: v.type, quantity: v.quantity, reason: v.reason },
              { onSuccess: onClose }
            )
          )}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>نوع حرکت</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1.5 h-10 w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IN">ورود کالا</SelectItem>
                      <SelectItem value="OUT">خروج کالا</SelectItem>
                      <SelectItem value="ADJUSTMENT">اصلاح شمارش</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label htmlFor="adj-qty">تعداد *</Label>
              <Input
                id="adj-qty"
                inputMode="numeric"
                dir="ltr"
                className="mt-1.5 h-10 bg-white text-right tabular-fa"
                {...form.register("quantity")}
              />
              {form.formState.errors.quantity && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.quantity.message}</p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="adj-reason">دلیل *</Label>
            <Input
              id="adj-reason"
              className="mt-1.5 h-10 bg-white"
              placeholder="مثلاً شمارش انبار، خرید جدید، خسارت حمل…"
              {...form.register("reason")}
            />
            {form.formState.errors.reason && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.reason.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="font-bold" onClick={onClose}>
              انصراف
            </Button>
            <Button type="submit" className="gap-1.5 font-bold" disabled={adjust.isPending}>
              {adjust.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              ثبت حرکت انبار
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminInventoryPage() {
  const stats = useAdminStats();
  const [page, setPage] = useState(1);
  const movements = useInventoryMovements(page);
  const [adjusting, setAdjusting] = useState<{ id: string; name: string; stock: number } | null>(null);

  useEffect(() => {
    document.title = "مدیریت موجودی | پنل مدیریت خانه‌گی";
  }, []);

  const lowStock = stats.data?.lowStock ?? [];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="موجودی انبار"
        description="محصولات با موجودی کم و تاریخچه ورود/خروج کالا."
      />

      {/* Low stock */}
      <Card className="rounded-xl">
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <PackageMinus className="size-4 text-highlight" aria-hidden />
            محصولات با موجودی کم
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {stats.isError ? (
            <ErrorState onRetry={() => stats.refetch()} />
          ) : stats.isLoading ? (
            <SkeletonRows rows={4} />
          ) : lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              همه محصولات موجودی کافی دارند. 👌
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>محصول</TableHead>
                    <TableHead>موجودی</TableHead>
                    <TableHead>قیمت</TableHead>
                    <TableHead className="text-end">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <a
                          href={href(`/admin/products/${p.id}`)}
                          className="block max-w-72 truncate text-[13px] font-bold transition-colors hover:text-highlight"
                        >
                          {p.name}
                        </a>
                      </TableCell>
                      <TableCell>
                        <StockBadge stock={p.stock} threshold={p.lowStockThreshold} />
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setAdjusting({ id: p.id, name: p.name, stock: p.stock })}
                          aria-label={`اصلاح موجودی ${p.name}`}
                        >
                          <SlidersHorizontal className="size-3.5" aria-hidden />
                          اصلاح موجودی
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movements */}
      <Card className="rounded-xl">
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <Boxes className="size-4 text-highlight" aria-hidden />
            تاریخچه حرکات انبار
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {movements.isError ? (
            <ErrorState onRetry={() => movements.refetch()} />
          ) : movements.isLoading ? (
            <SkeletonTable rows={6} cols={5} />
          ) : (movements.data?.items ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">حرکتی ثبت نشده است.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[680px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>محصول</TableHead>
                      <TableHead>نوع</TableHead>
                      <TableHead>تعداد</TableHead>
                      <TableHead>دلیل</TableHead>
                      <TableHead>سفارش مرتبط</TableHead>
                      <TableHead>زمان</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(movements.data?.items ?? []).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="max-w-64 truncate text-[13px] font-bold">
                          {m.productSlug ? (
                            <a
                              href={href(`/product/${m.productSlug}`)}
                              className="transition-colors hover:text-highlight"
                            >
                              {m.productName}
                            </a>
                          ) : (
                            m.productName
                          )}
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone={MOVEMENT_TYPE_TONES[m.type] ?? "zinc"}>
                            {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                          </ToneBadge>
                        </TableCell>
                        <TableCell className="text-[13px] font-bold tabular-fa">
                          {m.type === "OUT" ? "−" : m.type === "IN" ? "+" : "±"}
                          {toFaDigits(String(m.quantity))}
                        </TableCell>
                        <TableCell className="text-[13px]">{m.reason}</TableCell>
                        <TableCell dir="ltr" className="text-right font-mono text-xs text-muted-foreground">
                          {m.refOrderNumber ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {timeAgoFa(m.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <AdminPagination
                page={movements.data?.page ?? page}
                pageSize={movements.data?.pageSize ?? 20}
                total={movements.data?.total ?? 0}
                onPage={setPage}
              />
            </>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            نکته: خروج خودکار به‌ازای هر سفارش ثبت‌شده نیز در همین فهرست ثبت می‌شود.
            {stats.data && (
              <> درآمد نمایش‌داده‌شده در داشبورد بر اساس سفارش‌های پرداخت‌شده است ({formatToman(stats.data.revenueToman)}).</>
            )}
          </p>
        </CardContent>
      </Card>

      {adjusting && (
        <AdjustDialog
          productId={adjusting.id}
          productName={adjusting.name}
          currentStock={adjusting.stock}
          onClose={() => setAdjusting(null)}
        />
      )}
    </div>
  );
}
