"use client";
// Bulk product import dialog (#/admin/exports) — file/paste source → server
// validation preview (per-row Persian errors) → confirmed commit (upsert by slug).

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileDown,
  FileUp,
  Loader2,
  ClipboardPaste,
} from "lucide-react";
import { formatToman, toFaDigits } from "@/lib/money";
import { toast } from "sonner";
import {
  useCommitProductImport,
  useDownloadImportTemplate,
  useValidateProductImport,
  type ProductImportPreview,
} from "@/hooks/use-admin-exports";
import { ToneBadge } from "@/components/admin/admin-bits";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function ResetKeyHint() {
  return (
    <p className="text-xs text-muted-foreground">
      ستون‌های الزامی: <span dir="ltr" className="font-mono">slug, name, categorySlug, brandSlug, priceToman</span> —
      محصولات موجود بر اساس <span dir="ltr" className="font-mono">slug</span> به‌روزرسانی می‌شوند و تصاویر/توضیحات دست‌نخورده می‌مانند.
    </p>
  );
}

function SummaryChips({ preview }: { preview: ProductImportPreview }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToneBadge tone="zinc">
        مجموع سطرها: {toFaDigits(String(preview.totalRows))}
      </ToneBadge>
      <ToneBadge tone="emerald">
        <CheckCircle2 className="size-3.5" aria-hidden />
        معتبر: {toFaDigits(String(preview.validCount))}
      </ToneBadge>
      <ToneBadge tone={preview.errorCount > 0 ? "rose" : "zinc"}>
        <AlertTriangle className="size-3.5" aria-hidden />
        نامعتبر: {toFaDigits(String(preview.errorCount))}
      </ToneBadge>
    </div>
  );
}

// NOTE: the parent conditionally mounts this dialog (key-remount pattern), so
// state is always fresh on open — no reset-in-effect needed (react-hooks rule).
export function ProductImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const validate = useValidateProductImport();
  const commit = useCommitProductImport();
  const template = useDownloadImportTemplate();

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    file
      .text()
      .then((text) => {
        setCsvText(text);
        setPreview(null);
      })
      .catch(() => handleFileError());
  };

  const canValidate = csvText.trim().length > 0 && !validate.isPending;
  const canApply = !!preview && preview.validCount > 0 && preview.errorCount === 0 && !commit.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>ورود گروهی محصولات از CSV</DialogTitle>
          <DialogDescription>
            ابتدا داده‌ها را اعتبارسنجی و پیش‌نمایش می‌کنیم؛ سپس با تأیید شما محصولات ایجاد یا به‌روزرسانی می‌شوند.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-3">
            <ResetKeyHint />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 bg-white font-bold"
              disabled={template.isPending}
              onClick={() => template.mutate()}
              aria-label="دانلود قالب نمونه CSV ورود گروهی"
            >
              {template.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <FileDown className="size-4" aria-hidden />
              )}
              دانلود قالب نمونه
            </Button>
          </div>

          <Tabs
            defaultValue="file"
            onValueChange={() => {
              setPreview(null);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file" className="gap-1.5">
                <FileUp className="size-4" aria-hidden />
                آپلود فایل CSV
              </TabsTrigger>
              <TabsTrigger value="paste" className="gap-1.5">
                <ClipboardPaste className="size-4" aria-hidden />
                چسباندن متن
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-3">
              <Label htmlFor="import-csv-file" className="sr-only">
                انتخاب فایل CSV
              </Label>
              <Input
                id="import-csv-file"
                type="file"
                accept=".csv,text/csv"
                className="h-11 cursor-pointer bg-white"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                فایل باید با کدگذاری UTF-8 ذخیره شده باشد و سطر اول آن عنوان ستون‌ها باشد.
              </p>
            </TabsContent>

            <TabsContent value="paste" className="mt-3">
              <Label htmlFor="import-csv-text" className="sr-only">
                متن CSV
              </Label>
              <Textarea
                id="import-csv-text"
                dir="ltr"
                rows={8}
                placeholder="slug,name,categorySlug,brandSlug,priceToman,stock,isActive"
                className="resize-y bg-white font-mono text-xs"
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setPreview(null);
                }}
              />
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="gap-1.5 font-bold"
              disabled={!canValidate}
              onClick={() =>
                validate.mutate(csvText, {
                  onSuccess: (data) => setPreview(data),
                })
              }
              aria-label="بررسی و پیش‌نمایش CSV"
            >
              {validate.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden />
              )}
              بررسی و پیش‌نمایش
            </Button>
            {preview && <SummaryChips preview={preview} />}
          </div>

          {validate.isError && (
            <div className="rounded-lg border border-destructive/30 bg-rose-50 p-3 text-sm text-destructive">
              {validate.error.message}
            </div>
          )}

          {preview && (
            <div className="grid gap-4">
              {preview.errors.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-bold text-destructive">خطاهای اعتبارسنجی</p>
                  <div className="max-h-96 overflow-y-auto rounded-lg border border-destructive/30">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-rose-50">
                          <TableHead className="w-16 text-right">سطر</TableHead>
                          <TableHead className="text-right">پیام خطا</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.errors.map((e, i) => (
                          <TableRow key={`${e.row}-${i}`} className="bg-rose-50/50">
                            <TableCell className="font-bold tabular-fa text-destructive">
                              {toFaDigits(String(e.row))}
                            </TableCell>
                            <TableCell className="text-[13px] text-destructive">{e.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {preview.preview.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-bold">
                    نمونه سطرهای معتبر (حداکثر {toFaDigits("5")} سطر)
                  </p>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">سطر</TableHead>
                          <TableHead className="text-right">شناسه</TableHead>
                          <TableHead className="text-right">نام</TableHead>
                          <TableHead className="text-right">قیمت (تومان)</TableHead>
                          <TableHead className="text-right">موجودی</TableHead>
                          <TableHead className="text-right">عملیات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.preview.map((r) => (
                          <TableRow key={r.row}>
                            <TableCell className="tabular-fa">{toFaDigits(String(r.row))}</TableCell>
                            <TableCell dir="ltr" className="text-left font-mono text-xs">
                              {r.slug}
                            </TableCell>
                            <TableCell className="max-w-52 truncate text-[13px]">{r.name}</TableCell>
                            <TableCell className="text-[13px] tabular-fa">{formatToman(r.priceToman, false)}</TableCell>
                            <TableCell className="text-[13px] tabular-fa">{toFaDigits(String(r.stock))}</TableCell>
                            <TableCell>
                              <ToneBadge tone={r.existsInDb ? "zinc" : "teal"}>
                                {r.existsInDb ? "به‌روزرسانی" : "ایجاد جدید"}
                              </ToneBadge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="font-bold" onClick={() => onOpenChange(false)}>
            بستن
          </Button>
          <Button
            type="button"
            className="gap-1.5 font-bold"
            disabled={!canApply}
            onClick={() => setApplyOpen(true)}
            aria-label="اعمال تغییرات ورود گروهی"
          >
            {commit.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            اعمال تغییرات
          </Button>
        </DialogFooter>

        <AlertDialog open={applyOpen} onOpenChange={setApplyOpen}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>اعمال تغییرات ورود گروهی؟</AlertDialogTitle>
              <AlertDialogDescription>
                {preview && (
                  <>
                    {toFaDigits(String(preview.validCount))} سطر معتبر آماده ذخیره است؛ محصولات جدید ایجاد و
                    محصولات موجود (بر اساس slug) به‌روزرسانی می‌شوند. تصاویر و توضیحات محصولات موجود حفظ
                    می‌شود. این عملیات پس از تأیید اعمال خواهد شد.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-bold">انصراف</AlertDialogCancel>
              <AlertDialogAction
                className="font-bold"
                onClick={(e) => {
                  e.preventDefault();
                  commit.mutate(csvText, {
                    onSuccess: () => {
                      setApplyOpen(false);
                      onOpenChange(false);
                    },
                    onError: () => setApplyOpen(false),
                  });
                }}
              >
                تأیید و اعمال
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function handleFileError() {
  toast.error("خواندن فایل ناموفق بود. لطفاً فایل معتبر CSV انتخاب کنید.");
}
