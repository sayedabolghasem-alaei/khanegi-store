"use client";
// Admin products list (#/admin/products) — toolbar (search/category/brand/
// status + «محصول جدید»), RTL table with inline activate switch, pagination,
// bulk select + bulk activate/deactivate (Task 7-d).
// Note: the list API filters by categoryId/brandId only; since no endpoint
// exposes those IDs, category/brand filters apply client-side by slug.

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Power, PowerOff, Search, X } from "lucide-react";
import { href, navigate } from "@/lib/router";
import { formatToman, toFaDigits } from "@/lib/money";
import { useCategoriesMeta, useBrandsMeta } from "@/hooks/use-catalog-meta";
import {
  useAdminProducts,
  useAllAdminProducts,
  useToggleProductActive,
} from "@/hooks/use-admin";
import { useBulkProducts } from "@/hooks/use-admin-settings";
import { ErrorState } from "@/components/store/empty-state";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import {
  AdminPagination,
  AdminThumb,
  SkeletonTable,
  StockBadge,
  ToneBadge,
} from "@/components/admin/admin-bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

function useDebounced(value: string, delay = 350): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const PAGE_SIZE = 20;

export function AdminProductsList() {
  const { items: CATEGORIES } = useCategoriesMeta();
  const { items: BRANDS } = useBrandsMeta();
  const [qInput, setQInput] = useState("");
  const q = useDebounced(qInput);
  const [categorySlug, setCategorySlug] = useState("all");
  const [brandSlug, setBrandSlug] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);

  const toggleActive = useToggleProductActive();
  const bulk = useBulkProducts();
  const { data: allRows } = useAllAdminProducts();

  const query = useAdminProducts({ q, categorySlug, brandSlug, status, page });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  // ── Bulk selection (Task 7-d) ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"activate" | "deactivate" | null>(null);
  const pageIds = items.map((p) => p.id);
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
  const allOnPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const confirmBulk = () => {
    if (!bulkAction) return;
    bulk.mutate(
      { ids: [...selectedIds].slice(0, 200), action: bulkAction },
      { onSuccess: clearSelection }
    );
    setBulkAction(null);
  };

  // Client-side slug filtering narrows the page; recompute pagination clamp.
  const filteredTotal = useMemo(() => {
    const hasCat = categorySlug !== "all";
    const hasBrand = brandSlug !== "all";
    if (!hasCat && !hasBrand) return total;
    if (!allRows) return total;
    return allRows.filter(
      (p) =>
        (!hasCat || p.category.slug === categorySlug) &&
        (!hasBrand || p.brand.slug === brandSlug)
    ).length;
  }, [allRows, categorySlug, brandSlug, total]);

  const pages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const safePage = Math.min(page, pages);

  useEffect(() => {
    document.title = "مدیریت محصولات | خانه‌گی";
  }, []);

  const hasFilter = !!(categorySlug !== "all" || brandSlug !== "all");

  return (
    <div>
      <AdminPageHeader
        title="محصولات"
        description="مدیریت کاتالوگ محصولات: جستجو، ویرایش، فعال/غیرفعال‌سازی."
        actions={
          <Button className="gap-1.5 font-bold" onClick={() => navigate("/admin/products/new")}>
            <Plus className="size-4" aria-hidden />
            محصول جدید
          </Button>
        }
      />

      {/* Toolbar */}
      <Card className="mb-4 rounded-xl">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden />
            <Input
              value={qInput}
              onChange={(e) => {
                setQInput(e.target.value);
                setPage(1);
              }}
              placeholder="جستجو بر اساس نام، شماره مدل یا SKU…"
              className="h-10 bg-white ps-9"
              aria-label="جستجوی محصول"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:w-auto">
            <Select
              value={categorySlug}
              onValueChange={(v) => {
                setCategorySlug(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full bg-white md:w-44" aria-label="فیلتر دسته‌بندی">
                <SelectValue placeholder="همه دسته‌بندی‌ها" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه دسته‌بندی‌ها</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={brandSlug}
              onValueChange={(v) => {
                setBrandSlug(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full bg-white md:w-40" aria-label="فیلتر برند">
                <SelectValue placeholder="همه برندها" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه برندها</SelectItem>
                {BRANDS.map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as "all" | "active" | "inactive");
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full bg-white md:w-32" aria-label="فیلتر وضعیت">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                <SelectItem value="active">فعال</SelectItem>
                <SelectItem value="inactive">غیرفعال</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk toolbar (Task 7-d) */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-highlight-soft/40 p-3">
          <span className="text-[13px] font-bold">
            {toFaDigits(String(selectedIds.size))} محصول انتخاب شده
          </span>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={clearSelection}>
            <X className="size-3.5" aria-hidden />
            انصراف از انتخاب
          </Button>
          <div className="ms-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5 font-bold"
              onClick={() => setBulkAction("activate")}
              disabled={bulk.isPending}
            >
              <Power className="size-4" aria-hidden />
              فعال‌سازی
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 font-bold text-destructive"
              onClick={() => setBulkAction("deactivate")}
              disabled={bulk.isPending}
            >
              <PowerOff className="size-4" aria-hidden />
              غیرفعال‌سازی
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="rounded-xl">
        <CardContent className="p-4">
          {query.isError ? (
            <ErrorState message={(query.error as Error)?.message} onRetry={() => query.refetch()} />
          ) : query.isLoading ? (
            <SkeletonTable rows={7} cols={6} />
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              محصولی با این فیلترها یافت نشد.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allOnPageSelected ? true : selectedOnPage > 0 ? "indeterminate" : false}
                        onCheckedChange={(v) => toggleAllOnPage(v === true)}
                        aria-label="انتخاب همه محصولات این صفحه"
                      />
                    </TableHead>
                    <TableHead className="w-16">تصویر</TableHead>
                    <TableHead>نام محصول</TableHead>
                    <TableHead>برند</TableHead>
                    <TableHead>دسته‌بندی</TableHead>
                    <TableHead>قیمت</TableHead>
                    <TableHead>موجودی</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead className="text-end">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id} className="group">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={(v) => toggleRow(p.id, v === true)}
                          aria-label={`انتخاب ${p.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <AdminThumb src={p.image} alt={p.name} />
                      </TableCell>
                      <TableCell>
                        <a
                          href={href(`/admin/products/${p.id}`)}
                          className="block max-w-64 truncate text-[13px] font-bold transition-colors hover:text-highlight"
                        >
                          {p.name}
                        </a>
                        <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">
                          {p.sku}
                        </span>
                      </TableCell>
                      <TableCell className="text-[13px]">{p.brand.name}</TableCell>
                      <TableCell className="text-[13px]">{p.category.name}</TableCell>
                      <TableCell className="text-[13px] font-bold tabular-fa">
                        {formatToman(p.priceToman)}
                      </TableCell>
                      <TableCell>
                        <StockBadge stock={p.stock} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {p.isFeatured && <ToneBadge tone="teal">ویژه</ToneBadge>}
                          {p.isNew && <ToneBadge tone="emerald">جدید</ToneBadge>}
                          {!p.isActive && <ToneBadge tone="zinc">غیرفعال</ToneBadge>}
                          <span className="inline-flex items-center gap-1.5">
                            <Switch
                              checked={p.isActive}
                              disabled={toggleActive.isPending}
                              aria-label={p.isActive ? `غیرفعال‌سازی ${p.name}` : `فعال‌سازی ${p.name}`}
                              onCheckedChange={(v) => toggleActive.mutate({ id: p.id, isActive: v })}
                            />
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 opacity-70 transition-opacity group-hover:opacity-100"
                        >
                          <a href={href(`/admin/products/${p.id}`)} aria-label={`ویرایش ${p.name}`}>
                            <Pencil className="size-3.5" aria-hidden />
                            ویرایش
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {hasFilter && query.data && (
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              تعداد صفحات بر اساس فیلتر دسته‌بندی/برند (اعمال‌شده در سمت نمایش) محاسبه می‌شود.
            </p>
          )}
          {!query.isLoading && !query.isError && (
            <AdminPagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filteredTotal}
              onPage={setPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Bulk confirm dialog */}
      <AlertDialog open={!!bulkAction} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "activate" ? "فعال‌سازی گروهی محصولات" : "غیرفعال‌سازی گروهی محصولات"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "activate"
                ? `${toFaDigits(String(selectedIds.size))} محصول انتخاب شده است. با فعال‌سازی، این محصولات در فروشگاه نمایش داده می‌شوند.`
                : `${toFaDigits(String(selectedIds.size))} محصول انتخاب شده است. با غیرفعال‌سازی، این محصولات از فروشگاه پنهان می‌شوند اما حذف نمی‌شوند.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">انصراف</AlertDialogCancel>
            <AlertDialogAction
              className={
                bulkAction === "deactivate"
                  ? "bg-destructive font-bold text-white hover:bg-destructive/90"
                  : "font-bold"
              }
              onClick={confirmBulk}
            >
              تأیید
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
