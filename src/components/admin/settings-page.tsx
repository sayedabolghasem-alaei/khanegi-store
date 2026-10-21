"use client";
// Admin settings page (#/admin/settings — Task 7-d).
// Cards: تماس و شبکه‌های اجتماعی / تجارت و نمایش قیمت / سئو / روش‌های ارسال.
// Each settings card saves its own section (PUT /api/admin/settings) with
// Persian inline validation + toasts; shipping card is a full CRUD editor.

import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, Package, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { formatToman, toEnDigits, toFaDigits } from "@/lib/money";
import {
  useAdminShippingMethods,
  useCreateShippingMethod,
  useDeleteShippingMethod,
  useStoreSettings,
  useUpdateSettings,
  useUpdateShippingMethod,
  type ShippingMethodAdminRow,
  type StoreCommerceSettings,
  type StoreContactSettings,
  type SeoSettings,
} from "@/hooks/use-admin-settings";
import { ErrorState } from "@/components/store/empty-state";
import { AdminPageHeader } from "@/components/admin/admin-shell";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Small bits ─────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

/** "" / Persian digits → number | null (null = field left empty). */
function parseTomanInput(v: string): number | null | typeof NaN {
  const s = toEnDigits(v).replace(/[,\s٬]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isNaN(n) ? NaN : n;
}

const TOMAN_TYPE_MSG = "مقدار واردشده عدد نیست.";

const tomanField = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z
      .number({ message: TOMAN_TYPE_MSG })
      .int(`${label} باید عدد صحیح باشد.`)
      .min(0, `${label} نمی‌تواند منفی باشد.`)
  );

// ─── Contact card ───────────────────────────────────────────────────────────

const contactSchema = z.object({
  phone: z.string().trim().max(40, "حداکثر ۴۰ کاراکتر مجاز است."),
  email: z
    .string()
    .trim()
    .max(160, "حداکثر ۱۶۰ کاراکتر مجاز است.")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "ایمیل نامعتبر است."),
  address: z.string().trim().max(400, "حداکثر ۴۰۰ کاراکتر مجاز است."),
  instagram: z.string().trim().max(120, "حداکثر ۱۲۰ کاراکتر مجاز است."),
  telegram: z.string().trim().max(120, "حداکثر ۱۲۰ کاراکتر مجاز است."),
  whatsapp: z.string().trim().max(120, "حداکثر ۱۲۰ کاراکتر مجاز است."),
});

function ContactCard({ initial }: { initial: StoreContactSettings }) {
  const save = useUpdateSettings();
  const [form, setForm] = useState<StoreContactSettings>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof StoreContactSettings, string>>>({});

  const set = (k: keyof StoreContactSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = () => {
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof StoreContactSettings | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate({ store_contact: parsed.data });
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm font-extrabold">تماس و شبکه‌های اجتماعی</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          این اطلاعات در فوتر، صفحه تماس و صفحات ثابت فروشگاه نمایش داده می‌شود.
        </p>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="s-phone">شماره تماس</Label>
            <Input id="s-phone" dir="ltr" className="mt-1.5 bg-white text-right" value={form.phone} onChange={set("phone")} />
            <FieldError message={errors.phone} />
          </div>
          <div>
            <Label htmlFor="s-email">ایمیل</Label>
            <Input id="s-email" dir="ltr" className="mt-1.5 bg-white text-right" value={form.email} onChange={set("email")} />
            <FieldError message={errors.email} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="s-address">نشانی فروشگاه</Label>
            <Textarea id="s-address" rows={2} className="mt-1.5 resize-y bg-white" value={form.address} onChange={set("address")} />
            <FieldError message={errors.address} />
          </div>
          <div>
            <Label htmlFor="s-instagram">اینستاگرام (آدرس یا آیدی)</Label>
            <Input id="s-instagram" dir="ltr" className="mt-1.5 bg-white text-right" placeholder="https://instagram.com/…" value={form.instagram} onChange={set("instagram")} />
            <FieldError message={errors.instagram} />
          </div>
          <div>
            <Label htmlFor="s-telegram">تلگرام (آدرس یا آیدی)</Label>
            <Input id="s-telegram" dir="ltr" className="mt-1.5 bg-white text-right" placeholder="https://t.me/…" value={form.telegram} onChange={set("telegram")} />
            <FieldError message={errors.telegram} />
          </div>
          <div>
            <Label htmlFor="s-whatsapp">واتساپ (شماره یا آدرس)</Label>
            <Input id="s-whatsapp" dir="ltr" className="mt-1.5 bg-white text-right" value={form.whatsapp} onChange={set("whatsapp")} />
            <FieldError message={errors.whatsapp} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button className="gap-1.5 font-bold" onClick={onSubmit} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            ذخیره
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Commerce card ──────────────────────────────────────────────────────────

const commerceSchema = z.object({
  minOrderToman: tomanField("حداقل مبلغ سفارش"),
  freeShippingThresholdToman: tomanField("آستانه ارسال رایگان"),
  showPricesWithTaxNote: z.boolean(),
});

function CommerceCard({ initial }: { initial: StoreCommerceSettings }) {
  const save = useUpdateSettings();
  const [form, setForm] = useState({
    minOrderToman: initial.minOrderToman > 0 ? String(initial.minOrderToman) : "",
    freeShippingThresholdToman:
      initial.freeShippingThresholdToman > 0 ? String(initial.freeShippingThresholdToman) : "",
    showPricesWithTaxNote: initial.showPricesWithTaxNote,
  });
  const [errors, setErrors] = useState<{ minOrderToman?: string; freeShippingThresholdToman?: string }>({});

  const onSubmit = () => {
    const minOrder = parseTomanInput(form.minOrderToman);
    const freeThreshold = parseTomanInput(form.freeShippingThresholdToman);
    const candidate = {
      minOrderToman: minOrder === null ? 0 : minOrder,
      freeShippingThresholdToman: freeThreshold === null ? 0 : freeThreshold,
      showPricesWithTaxNote: form.showPricesWithTaxNote,
    };
    const next: typeof errors = {};
    if (Number.isNaN(candidate.minOrderToman)) next.minOrderToman = TOMAN_TYPE_MSG;
    if (Number.isNaN(candidate.freeShippingThresholdToman))
      next.freeShippingThresholdToman = TOMAN_TYPE_MSG;
    const parsed = commerceSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "minOrderToman" | "freeShippingThresholdToman" | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate({ store_commerce: candidate });
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm font-extrabold">تجارت و نمایش قیمت</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          قواعد سفارش و ارسال؛ صفر بودن هر مقدار یعنی بدون محدودیت.
        </p>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="s-min-order">حداقل مبلغ سفارش (تومان)</Label>
            <Input
              id="s-min-order"
              inputMode="numeric"
              dir="ltr"
              placeholder="۰ = بدون حد"
              className="mt-1.5 bg-white text-right tabular-fa"
              value={form.minOrderToman}
              onChange={(e) => setForm((f) => ({ ...f, minOrderToman: e.target.value }))}
            />
            <FieldError message={errors.minOrderToman} />
          </div>
          <div>
            <Label htmlFor="s-free-ship">آستانه ارسال رایگان (تومان)</Label>
            <Input
              id="s-free-ship"
              inputMode="numeric"
              dir="ltr"
              placeholder="۰ = غیرفعال"
              className="mt-1.5 bg-white text-right tabular-fa"
              value={form.freeShippingThresholdToman}
              onChange={(e) => setForm((f) => ({ ...f, freeShippingThresholdToman: e.target.value }))}
            />
            <FieldError message={errors.freeShippingThresholdToman} />
          </div>
          <div className="flex items-start justify-between gap-3 rounded-lg bg-highlight-soft/60 p-3 sm:col-span-2">
            <div>
              <Label htmlFor="s-tax-note" className="text-[13px] font-bold">
                یادداشت مالیات
              </Label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                نمایش عبارت «قیمت‌ها شامل مالیات بر ارزش افزوده است» در صفحه محصول و سبد خرید.
              </p>
            </div>
            <Switch
              id="s-tax-note"
              checked={form.showPricesWithTaxNote}
              onCheckedChange={(v) => setForm((f) => ({ ...f, showPricesWithTaxNote: v }))}
              aria-label="نمایش یادداشت مالیات"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button className="gap-1.5 font-bold" onClick={onSubmit} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            ذخیره
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── SEO card ───────────────────────────────────────────────────────────────

const seoSchema = z.object({
  defaultTitle: z.string().trim().min(1, "عنوان پیش‌فرض الزامی است.").max(120, "حداکثر ۱۲۰ کاراکتر مجاز است."),
  defaultDescription: z.string().trim().max(400, "حداکثر ۴۰۰ کاراکتر مجاز است."),
  keywords: z.string().trim().max(400, "حداکثر ۴۰۰ کاراکتر مجاز است."),
});

function SeoCard({ initial }: { initial: SeoSettings }) {
  const save = useUpdateSettings();
  const [form, setForm] = useState<SeoSettings>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof SeoSettings, string>>>({});

  const set = (k: keyof SeoSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = () => {
    const parsed = seoSchema.safeParse(form);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SeoSettings | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate({ seo: parsed.data });
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm font-extrabold">سئو</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          عنوان و توضیحات پیش‌فرض صفحات فروشگاه برای موتورهای جستجو.
        </p>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid gap-4">
          <div>
            <Label htmlFor="s-seo-title">عنوان پیش‌فرض *</Label>
            <Input id="s-seo-title" className="mt-1.5 bg-white" value={form.defaultTitle} onChange={set("defaultTitle")} />
            <FieldError message={errors.defaultTitle} />
          </div>
          <div>
            <Label htmlFor="s-seo-desc">توضیحات پیش‌فرض (meta description)</Label>
            <Textarea id="s-seo-desc" rows={3} className="mt-1.5 resize-y bg-white" value={form.defaultDescription} onChange={set("defaultDescription")} />
            <FieldError message={errors.defaultDescription} />
          </div>
          <div>
            <Label htmlFor="s-seo-keywords">کلمات کلیدی (با ویرگول جدا شود)</Label>
            <Input id="s-seo-keywords" className="mt-1.5 bg-white" value={form.keywords} onChange={set("keywords")} />
            <FieldError message={errors.keywords} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button className="gap-1.5 font-bold" onClick={onSubmit} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            ذخیره
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Shipping methods card ──────────────────────────────────────────────────

const shippingFormSchema = z.object({
  name: z.string().trim().min(2, "نام روش ارسال الزامی است.").max(80, "حداکثر ۸۰ کاراکتر مجاز است."),
  description: z.string().trim().max(300, "حداکثر ۳۰۰ کاراکتر مجاز است."),
  costToman: z
    .number({ message: TOMAN_TYPE_MSG })
    .int("هزینه ارسال باید عدد صحیح باشد.")
    .min(0, "هزینه ارسال نمی‌تواند منفی باشد."),
  freeThresholdToman: z
    .number({ message: TOMAN_TYPE_MSG })
    .int("آستانه باید عدد صحیح باشد.")
    .min(0, "آستانه نمی‌تواند منفی باشد.")
    .nullable(),
  estimatedDays: z.string().trim().max(60, "حداکثر ۶۰ کاراکتر مجاز است."),
  sortOrder: z
    .number({ message: TOMAN_TYPE_MSG })
    .int("ترتیب نمایش باید عدد صحیح باشد.")
    .min(0, "ترتیب نمایش نمی‌تواند منفی باشد."),
});

type ShippingFormState = {
  name: string;
  description: string;
  costToman: string;
  freeThresholdToman: string;
  estimatedDays: string;
  sortOrder: string;
};

function stateFromMethod(m: ShippingMethodAdminRow | null): ShippingFormState {
  return {
    name: m?.name ?? "",
    description: m?.description ?? "",
    costToman: m ? String(m.costToman) : "",
    freeThresholdToman: m?.freeThresholdToman != null ? String(m.freeThresholdToman) : "",
    estimatedDays: m?.estimatedDays ?? "",
    sortOrder: m ? String(m.sortOrder) : "0",
  };
}

function ShippingMethodForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: ShippingMethodAdminRow | null;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: {
    name: string;
    description?: string;
    costToman: number;
    freeThresholdToman?: number | null;
    estimatedDays?: string;
    isActive?: boolean;
    sortOrder?: number;
  }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ShippingFormState>(stateFromMethod(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const set = (k: keyof ShippingFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = () => {
    const cost = parseTomanInput(form.costToman);
    const freeThreshold = parseTomanInput(form.freeThresholdToman);
    const sortOrder = parseTomanInput(form.sortOrder);

    if (cost === null) {
      setErrors({ costToman: "هزینه ارسال الزامی است." });
      return;
    }
    if (sortOrder === null) {
      setErrors({ sortOrder: "ترتیب نمایش الزامی است." });
      return;
    }

    const candidate = {
      name: form.name,
      description: form.description,
      costToman: cost,
      freeThresholdToman: freeThreshold,
      estimatedDays: form.estimatedDays,
      sortOrder,
    };
    const parsed = shippingFormSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit({
      name: parsed.data.name,
      description: parsed.data.description || undefined,
      costToman: parsed.data.costToman,
      freeThresholdToman: parsed.data.freeThresholdToman,
      estimatedDays: parsed.data.estimatedDays || undefined,
      isActive,
      sortOrder: parsed.data.sortOrder,
    });
  };

  return (
    <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
      <div>
        <Label htmlFor="sm-name">نام روش *</Label>
        <Input id="sm-name" className="mt-1.5 bg-white" placeholder="مثلاً پست پیشتاز" value={form.name} onChange={set("name")} />
        <FieldError message={errors.name} />
      </div>
      <div>
        <Label htmlFor="sm-cost">هزینه ارسال (تومان) *</Label>
        <Input id="sm-cost" inputMode="numeric" dir="ltr" className="mt-1.5 bg-white text-right tabular-fa" value={form.costToman} onChange={set("costToman")} />
        <FieldError message={errors.costToman} />
      </div>
      <div>
        <Label htmlFor="sm-free">آستانه ارسال رایگان (تومان)</Label>
        <Input id="sm-free" inputMode="numeric" dir="ltr" placeholder="خالی = بدون ارسال رایگان" className="mt-1.5 bg-white text-right tabular-fa" value={form.freeThresholdToman} onChange={set("freeThresholdToman")} />
        <FieldError message={errors.freeThresholdToman} />
      </div>
      <div>
        <Label htmlFor="sm-days">زمان تقریبی ارسال</Label>
        <Input id="sm-days" className="mt-1.5 bg-white" placeholder="مثلاً ۲ تا ۴ روز کاری" value={form.estimatedDays} onChange={set("estimatedDays")} />
        <FieldError message={errors.estimatedDays} />
      </div>
      <div>
        <Label htmlFor="sm-order">ترتیب نمایش</Label>
        <Input id="sm-order" inputMode="numeric" dir="ltr" className="mt-1.5 bg-white text-right tabular-fa" value={form.sortOrder} onChange={set("sortOrder")} />
        <FieldError message={errors.sortOrder} />
      </div>
      <div>
        <Label htmlFor="sm-desc">توضیحات</Label>
        <Textarea id="sm-desc" rows={1} className="mt-1.5 resize-y bg-white" value={form.description} onChange={set("description")} />
        <FieldError message={errors.description} />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 sm:col-span-2">
        <Label htmlFor="sm-active" className="text-[13px] font-bold">
          فعال (قابل انتخاب در تسویه حساب)
        </Label>
        <Switch id="sm-active" checked={isActive} onCheckedChange={setIsActive} aria-label="فعال بودن روش ارسال" />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" className="font-bold" onClick={onCancel}>
          انصراف
        </Button>
        <Button type="button" className="gap-1.5 font-bold" onClick={handleSubmit} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function ShippingCard() {
  const { data, isLoading, isError, error, refetch } = useAdminShippingMethods();
  const create = useCreateShippingMethod();
  const update = useUpdateShippingMethod();
  const remove = useDeleteShippingMethod();
  const [mode, setMode] = useState<"closed" | "new" | { editId: string }>("closed");
  const [deleteTarget, setDeleteTarget] = useState<ShippingMethodAdminRow | null>(null);

  const methods = data?.items ?? [];
  const anyPending = create.isPending || update.isPending;

  return (
    <Card className="rounded-xl xl:col-span-2">
      <CardHeader className="border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
              <Package className="size-4 text-highlight" aria-hidden />
              روش‌های ارسال
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              این روش‌ها در مرحله ارسال تسویه حساب به مشتری نمایش داده می‌شوند.
            </p>
          </div>
          {mode === "closed" && (
            <Button size="sm" className="gap-1.5 font-bold" onClick={() => setMode("new")}>
              <Plus className="size-4" aria-hidden />
              افزودن روش ارسال
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {mode === "new" && (
              <div className="mb-4">
                <ShippingMethodForm
                  key="new"
                  initial={null}
                  submitLabel="ایجاد روش ارسال"
                  pending={create.isPending}
                  onCancel={() => setMode("closed")}
                  onSubmit={(input) =>
                    create.mutate(input, {
                      onSuccess: () => setMode("closed"),
                    })
                  }
                />
              </div>
            )}

            {methods.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                هنوز روش ارسالی ثبت نشده است.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>نام</TableHead>
                      <TableHead>هزینه</TableHead>
                      <TableHead>ارسال رایگان از</TableHead>
                      <TableHead>زمان تقریبی</TableHead>
                      <TableHead>ترتیب</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead className="text-end">عملیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {methods.map((m) =>
                      mode !== "closed" && typeof mode !== "string" && mode.editId === m.id ? (
                        <TableRow key={m.id}>
                          <TableCell colSpan={7}>
                            <ShippingMethodForm
                              key={m.id}
                              initial={m}
                              submitLabel="ذخیره تغییرات"
                              pending={anyPending}
                              onCancel={() => setMode("closed")}
                              onSubmit={(input) =>
                                update.mutate(
                                  { id: m.id, ...input },
                                  {
                                    onSuccess: () => setMode("closed"),
                                  }
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow key={m.id}>
                          <TableCell>
                            <span className="block text-[13px] font-bold">{m.name}</span>
                            {m.description && (
                              <span className="mt-0.5 block max-w-64 truncate text-[11px] text-muted-foreground">
                                {m.description}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-[13px] font-bold tabular-fa">
                            {formatToman(m.costToman)}
                          </TableCell>
                          <TableCell className="text-[13px] tabular-fa">
                            {m.freeThresholdToman != null ? formatToman(m.freeThresholdToman) : "—"}
                          </TableCell>
                          <TableCell className="text-[13px]">{m.estimatedDays ?? "—"}</TableCell>
                          <TableCell className="text-[13px] tabular-fa">{toFaDigits(String(m.sortOrder))}</TableCell>
                          <TableCell>
                            <Switch
                              checked={m.isActive}
                              disabled={update.isPending}
                              aria-label={m.isActive ? `غیرفعال‌سازی ${m.name}` : `فعال‌سازی ${m.name}`}
                              onCheckedChange={(v) => update.mutate({ id: m.id, isActive: v })}
                            />
                            {!m.isActive && (
                              <Badge variant="outline" className="ms-2 border-border text-muted-foreground">
                                غیرفعال
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="icon"
                                className="size-8"
                                aria-label={`ویرایش ${m.name}`}
                                onClick={() => setMode({ editId: m.id })}
                              >
                                <Pencil className="size-3.5" aria-hidden />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="size-8 text-destructive"
                                aria-label={`حذف ${m.name}`}
                                onClick={() => setDeleteTarget(m)}
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف روش ارسال</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف «{deleteTarget?.name}» مطمئن هستید؟ اگر این روش در سفارش‌های گذشته استفاده شده باشد،
              حذف انجام نمی‌شود و باید آن را غیرفعال کنید.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive font-bold text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) remove.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function AdminSettingsPage() {
  const { data, isLoading, isError, refetch } = useStoreSettings();

  useEffect(() => {
    document.title = "تنظیمات فروشگاه | پنل مدیریت خانه‌گی";
  }, []);

  return (
    <div>
      <AdminPageHeader
        title="تنظیمات فروشگاه"
        description="اطلاعات تماس، قواعد تجاری، سئو و روش‌های ارسال فروشگاه."
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="space-y-4" aria-hidden>
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <ContactCard initial={data.settings.store_contact} />
          <CommerceCard initial={data.settings.store_commerce} />
          <SeoCard initial={data.settings.seo} />
          <ShippingCard />
        </div>
      )}
    </div>
  );
}
