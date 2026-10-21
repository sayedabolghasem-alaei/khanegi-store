"use client";
// Admin exports & bulk-import page (#/admin/exports) — per-entity CSV export
// cards (with optional from/to date filters) + the bulk product import dialog.
// NOTE: nav wiring is done by the lead (not in this file's scope).

import { useEffect, useState } from "react";
import { Download, Loader2, ShieldCheck, Upload } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDownloadExport, type DownloadExportInput } from "@/hooks/use-admin-exports";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ToneBadge } from "@/components/admin/admin-bits";
import { ProductImportDialog } from "@/components/admin/product-import-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ExportEntityDef {
  entity: string;
  title: string;
  description: string;
  /** Shown to ADMIN only (server enforces 403 for STAFF as well). */
  adminOnly?: boolean;
}

const EXPORT_ENTITIES: ExportEntityDef[] = [
  {
    entity: "products",
    title: "محصولات",
    description: "همه محصولات با شناسه، قیمت، موجودی، وضعیت فعال/حذف‌شده و تاریخ ایجاد.",
  },
  {
    entity: "categories",
    title: "دسته‌بندی‌ها",
    description: "دسته‌بندی‌ها به‌همراه تعداد محصولات هر دسته.",
  },
  {
    entity: "brands",
    title: "برندها",
    description: "برندها به‌همراه تعداد محصولات هر برند.",
  },
  {
    entity: "orders",
    title: "سفارش‌ها",
    description: "سفارش‌ها با مبلغ‌ها، وضعیت پرداخت و کد رهگیری؛ فیلتر تاریخ روی تاریخ ثبت سفارش است.",
  },
  {
    entity: "order_items",
    title: "اقلام سفارش‌ها",
    description: "ریز اقلام سفارش‌ها (نام محصول، تعداد، قیمت واحد)؛ فیلتر تاریخ روی تاریخ سفارش اعمال می‌شود.",
  },
  {
    entity: "reviews",
    title: "دیدگاه‌ها",
    description: "دیدگاه‌های محصولات با وضعیت تأیید، پاسخ مدیر و نشان خرید تأییدشده.",
  },
  {
    entity: "inventory_movements",
    title: "گردش موجودی",
    description: "تاریخچه ورود/خروج/اصلاح موجودی محصولات با دلیل هر گردش.",
  },
  {
    entity: "discounts",
    title: "کدهای تخفیف",
    description: "کدهای تخفیف با سقف استفاده، سقف هر مشتری و بازه اعتبار.",
  },
  {
    entity: "users",
    title: "کاربران",
    description: "فهرست کاربران (بدون هیچ اطلاعات حساس مانند رمز عبور) — فقط برای مدیر.",
    adminOnly: true,
  },
  {
    entity: "admin_audit_logs",
    title: "گزارش فعالیت‌های مدیریتی",
    description: "گزارش رویدادهای مدیریتی (جزئیات حساس مانند رمز عبور حذف شده است) — فقط برای مدیر.",
    adminOnly: true,
  },
];

function ExportCard({
  def,
  download,
}: {
  def: ExportEntityDef;
  download: ReturnType<typeof useDownloadExport>;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const busy =
    download.isPending && (download.variables as DownloadExportInput | undefined)?.entity === def.entity;

  return (
    <Card className="rounded-xl">
      <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-extrabold">{def.title}</h3>
            {def.adminOnly && (
              <ToneBadge tone="amber">
                <ShieldCheck className="size-3.5" aria-hidden />
                ویژه مدیر
              </ToneBadge>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{def.description}</p>
        </div>

        <div className="mt-auto grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label htmlFor={`from-${def.entity}`} className="text-xs text-muted-foreground">
              از تاریخ (اختیاری)
            </Label>
            <Input
              id={`from-${def.entity}`}
              type="date"
              dir="ltr"
              className="mt-1 h-10 bg-white"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`to-${def.entity}`} className="text-xs text-muted-foreground">
              تا تاریخ (اختیاری)
            </Label>
            <Input
              id={`to-${def.entity}`}
              type="date"
              dir="ltr"
              className="mt-1 h-10 bg-white"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className="gap-1.5 font-bold"
            disabled={download.isPending}
            onClick={() => download.mutate({ entity: def.entity, from: from || undefined, to: to || undefined })}
            aria-label={`دریافت فایل CSV ${def.title}`}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            دریافت CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminExportsPage() {
  const { user } = useAuth();
  const download = useDownloadExport();
  const [importOpen, setImportOpen] = useState(false);
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    document.title = "خروجی‌ها و ورود داده | پنل مدیریت خانه‌گی";
  }, []);

  const visibleEntities = EXPORT_ENTITIES.filter((e) => !e.adminOnly || isAdmin);

  return (
    <div>
      <AdminPageHeader
        title="خروجی‌ها و ورود داده"
        description="دریافت گزارش‌های CSV از داده‌های فروشگاه (سازگار با اکسل) و ورود گروهی محصولات."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Bulk import — the second functional block of this page */}
        <Card className="rounded-xl md:col-span-2">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-extrabold">ورود گروهی محصولات</h3>
                <ToneBadge tone="amber">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  ویژه مدیر
                </ToneBadge>
              </div>
              <p className="mt-1 max-w-xl text-[13px] leading-6 text-muted-foreground">
                فایل CSV محصولات را اعتبارسنجی و پیش‌نمایش کنید؛ سپس با تأیید، محصولات جدید ایجاد یا
                محصولات موجود (بر اساس slug) به‌روزرسانی می‌شوند. تصاویر و توضیحات محصولات موجود حفظ می‌شود.
              </p>
            </div>
            <Button
              type="button"
              className="gap-1.5 font-bold"
              onClick={() => setImportOpen(true)}
              aria-label="شروع ورود گروهی محصولات از فایل CSV"
            >
              <Upload className="size-4" aria-hidden />
              شروع ورود گروهی
            </Button>
          </CardContent>
        </Card>

        {visibleEntities.map((def) => (
          <ExportCard key={def.entity} def={def} download={download} />
        ))}
      </div>

      {/* Conditional mount (key-remount): dialog state resets on every open. */}
      {importOpen && <ProductImportDialog open onOpenChange={setImportOpen} />}
    </div>
  );
}
