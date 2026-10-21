"use client";
// Admin product form (#/admin/products/new and #/admin/products/:id).
// react-hook-form + zod (Persian messages), dynamic rows for attributes,
// color options and variants; images as {url, alt} rows with direct file
// upload (Task 7-d) + per-image alt text.

import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { navigate } from "@/lib/router";
import { toEnDigits } from "@/lib/money";
import { CURRENCIES, CURRENCY_LABELS } from "@/lib/constants";
import { useAdminProduct, useSaveProduct, useTaxonomy } from "@/hooks/use-admin";
import { uploadProductImage } from "@/hooks/use-admin-settings";
import { ErrorState } from "@/components/store/empty-state";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Schema ─────────────────────────────────────────────────────────────────

/** "" → null، ارقام فارسی → لاتین، ورودی غیرعددی → NaN (با پیام فارسی). */
function numPreprocess(v: unknown): number | null | typeof NaN {
  if (v === null || v === undefined) return null;
  const s = toEnDigits(String(v)).replace(/[,\s٬]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isNaN(n) ? NaN : n;
}

const NUM_TYPE_MSG = { error: "مقدار واردشده عدد نیست." } as const;

const productFormSchema = z.object({
  name: z.string().trim().min(3, "نام محصول باید حداقل ۳ کاراکتر باشد.").max(180, "نام حداکثر ۱۸۰ کاراکتر است."),
  nameEn: z.string().trim().max(180, "حداکثر ۱۸۰ کاراکتر مجاز است."),
  slug: z.string().trim().max(180, "حداکثر ۱۸۰ کاراکتر مجاز است."),
  sku: z.string().trim().max(60, "حداکثر ۶۰ کاراکتر مجاز است."),
  model: z.string().trim().max(80, "حداکثر ۸۰ کاراکتر مجاز است."),
  categoryId: z.string().min(1, "دسته‌بندی الزامی است."),
  brandId: z.string().min(1, "برند الزامی است."),
  shortDescription: z.string().trim().max(400, "حداکثر ۴۰۰ کاراکتر مجاز است."),
  description: z.string().trim().min(10, "توضیحات محصول باید حداقل ۱۰ کاراکتر باشد.").max(6000, "حداکثر ۶۰۰۰ کاراکتر مجاز است."),
  priceToman: z.preprocess(numPreprocess, z.number(NUM_TYPE_MSG).int("قیمت باید عدد صحیح باشد.").positive("قیمت فروش باید بزرگ‌تر از صفر باشد.")),
  originalPriceToman: z.preprocess(numPreprocess, z.number(NUM_TYPE_MSG).int("قیمت باید عدد صحیح باشد.").positive("قیمت قبل از تخفیف باید بزرگ‌تر از صفر باشد.").nullable()),
  isPriceManual: z.boolean(),
  costPrice: z.preprocess(numPreprocess, z.number(NUM_TYPE_MSG).positive("قیمت تمام‌شده باید بزرگ‌تر از صفر باشد.").nullable()),
  costCurrency: z.string(),
  stock: z.preprocess(numPreprocess, z.number(NUM_TYPE_MSG).int("موجودی باید عدد صحیح باشد.").min(0, "موجودی نمی‌تواند منفی باشد.")),
  lowStockThreshold: z.preprocess(numPreprocess, z.number(NUM_TYPE_MSG).int("آستانه باید عدد صحیح باشد.").min(0, "آستانه نمی‌تواند منفی باشد.")),
  warrantyMonths: z.preprocess(numPreprocess, z.number(NUM_TYPE_MSG).int("گارانتی باید عدد صحیح باشد.").min(1, "مدت گارانتی باید بین ۱ تا ۱۲۰ ماه باشد.").max(120, "مدت گارانتی باید بین ۱ تا ۱۲۰ ماه باشد.").nullable()),
  images: z.array(
    z.object({
      url: z.string().trim().min(1, "آدرس تصویر الزامی است.").max(600, "آدرس تصویر حداکثر ۶۰۰ کاراکتر است."),
      alt: z.string().trim().max(160, "متن جایگزین حداکثر ۱۶۰ کاراکتر است."),
    })
  ),
  attributes: z.array(
    z.object({
      group: z.string().trim().max(80, "حداکثر ۸۰ کاراکتر مجاز است."),
      key: z.string().trim().min(1, "عنوان ویژگی الزامی است.").max(80, "حداکثر ۸۰ کاراکتر مجاز است."),
      value: z.string().trim().min(1, "مقدار ویژگی الزامی است.").max(160, "حداکثر ۱۶۰ کاراکتر مجاز است."),
    })
  ),
  colorOptions: z.array(
    z.object({
      name: z.string().trim().min(1, "نام رنگ الزامی است.").max(40, "حداکثر ۴۰ کاراکتر مجاز است."),
      hex: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "کد رنگ باید به شکل #RRGGBB باشد."),
    })
  ),
  variants: z.array(
    z.object({
      name: z.string().trim().min(1, "نام تنوع الزامی است.").max(40, "حداکثر ۴۰ کاراکتر مجاز است."),
      value: z.string().trim().min(1, "مقدار تنوع الزامی است.").max(80, "حداکثر ۸۰ کاراکتر مجاز است."),
      extraPriceToman: z.preprocess(numPreprocess, z.number(NUM_TYPE_MSG).int("قیمت باید عدد صحیح باشد.").min(0, "قیمت اضافه نمی‌تواند منفی باشد.")),
      stock: z.preprocess(numPreprocess, z.number(NUM_TYPE_MSG).int("موجودی باید عدد صحیح باشد.").min(0, "موجودی نمی‌تواند منفی باشد.")),
    })
  ),
  isFeatured: z.boolean(),
  isNew: z.boolean(),
  isActive: z.boolean(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const EMPTY_VALUES: z.input<typeof productFormSchema> = {
  name: "",
  nameEn: "",
  slug: "",
  sku: "",
  model: "",
  categoryId: "",
  brandId: "",
  shortDescription: "",
  description: "",
  priceToman: null,
  originalPriceToman: null,
  isPriceManual: true,
  costPrice: null,
  costCurrency: "",
  stock: 0,
  lowStockThreshold: 3,
  warrantyMonths: null,
  images: [],
  attributes: [],
  colorOptions: [],
  variants: [],
  isFeatured: false,
  isNew: false,
  isActive: true,
};

// ─── Small helpers ──────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

function ImagePreview({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex w-24 shrink-0 flex-col items-center gap-1">
      <img
        src={failed || !url ? "/images/placeholder.svg" : url}
        alt="پیش‌نمایش تصویر محصول"
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-24 rounded-lg border bg-muted/40 object-contain p-1"
      />
      <span className="w-full truncate text-center text-[10px] text-muted-foreground" dir="ltr">
        {url.split("/").pop()}
      </span>
    </div>
  );
}

function SectionCard({
  title,
  children,
  description,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm font-extrabold">{title}</CardTitle>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AdminProductForm({ id }: { id: string | null }) {
  const isEdit = !!id;
  const { data: productData, isLoading: productLoading, isError, refetch } = useAdminProduct(id);
  const { data: taxonomy, isLoading: taxonomyLoading } = useTaxonomy();
  const save = useSaveProduct(id);
  const [loaded, setLoaded] = useState(false);

  const form = useForm<z.input<typeof productFormSchema>, unknown, z.output<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: EMPTY_VALUES,
    mode: "onSubmit",
  });
  const attrArray = useFieldArray({ control: form.control, name: "attributes" });
  const colorArray = useFieldArray({ control: form.control, name: "colorOptions" });
  const variantArray = useFieldArray({ control: form.control, name: "variants" });
  const imageArray = useFieldArray({ control: form.control, name: "images" });

  // Image upload state (Task 7-d)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onPickUpload = () => fileInputRef.current?.click();

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم تصویر باید حداکثر ۲ مگابایت باشد.");
      return;
    }
    if (form.getValues("images").length >= 10) {
      toast.error("حداکثر ۱۰ تصویر برای هر محصول مجاز است.");
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadProductImage(file);
      imageArray.append({ url, alt: "" });
      toast.success("تصویر بارگذاری شد.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "بارگذاری تصویر ناموفق بود.");
    } finally {
      setUploading(false);
    }
  };

  // Populate once the product detail arrives (edit mode).
  useEffect(() => {
    if (isEdit && productData?.product && !loaded) {
      const p = productData.product;
      form.reset({
        name: p.name,
        nameEn: p.nameEn ?? "",
        slug: p.slug,
        sku: p.sku,
        model: p.model ?? "",
        categoryId: p.categoryId,
        brandId: p.brandId,
        shortDescription: p.shortDescription ?? "",
        description: p.description,
        priceToman: p.priceToman,
        originalPriceToman: p.originalPriceToman,
        isPriceManual: p.isPriceManual,
        costPrice: p.costPrice,
        costCurrency: p.costCurrency ?? "",
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        warrantyMonths: p.warrantyMonths,
        images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
        attributes: p.attributes.map((a) => ({ group: a.group ?? "", key: a.key, value: a.value })),
        colorOptions: p.colorOptions.map((c) => ({ name: c.name, hex: c.hex })),
        variants: p.variants.map((v) => ({
          name: v.name,
          value: v.value,
          extraPriceToman: v.extraPriceToman,
          stock: v.stock,
        })),
        isFeatured: p.isFeatured,
        isNew: p.isNew,
        isActive: p.isActive,
      });
      setLoaded(true);
    }
  }, [isEdit, productData, loaded, form]);

  useEffect(() => {
    document.title = isEdit ? "ویرایش محصول | پنل مدیریت خانه‌گی" : "محصول جدید | پنل مدیریت خانه‌گی";
  }, [isEdit]);

  const isPriceManual = form.watch("isPriceManual");

  const onSubmit = (v: ProductFormValues) => {
    save.mutate(
      {
        name: v.name,
        nameEn: v.nameEn || undefined,
        slug: v.slug || undefined,
        sku: v.sku || undefined,
        model: v.model || undefined,
        categoryId: v.categoryId,
        brandId: v.brandId,
        shortDescription: v.shortDescription || undefined,
        description: v.description,
        priceToman: v.priceToman,
        originalPriceToman: v.originalPriceToman,
        isPriceManual: v.isPriceManual,
        costPrice: v.costPrice,
        costCurrency: v.costPrice != null && v.costCurrency ? v.costCurrency : null,
        stock: v.stock,
        lowStockThreshold: v.lowStockThreshold,
        warrantyMonths: v.warrantyMonths,
        colorOptions: v.colorOptions,
        attributes: v.attributes.map((a) => (a.group ? a : { key: a.key, value: a.value })),
        images: v.images.map((img) => ({
          url: img.url.trim(),
          ...(img.alt.trim() ? { alt: img.alt.trim() } : {}),
        })),
        variants: v.variants.map((x) => ({
          name: x.name,
          value: x.value,
          extraPriceToman: x.extraPriceToman ?? 0,
          stock: x.stock ?? 0,
        })),
        isFeatured: v.isFeatured,
        isNew: v.isNew,
        isActive: v.isActive,
      },
      {
        onSuccess: () => {
          toast.success("محصول ذخیره شد.");
          navigate("/admin/products");
        },
      }
    );
  };

  if (isError) {
    return (
      <div>
        <AdminPageHeader title={isEdit ? "ویرایش محصول" : "محصول جدید"} />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (isEdit && (productLoading || !productData?.product)) {
    return (
      <div className="space-y-4" aria-hidden>
        <Skeleton className="h-9 w-52" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-52 rounded-xl" />
      </div>
    );
  }

  const err = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <AdminPageHeader
        title={isEdit ? `ویرایش محصول` : "محصول جدید"}
        description={
          isEdit && productData?.product
            ? productData.product.name
            : "اطلاعات محصول را کامل کنید؛ فیلدهای نام‌دار با ستاره الزامی هستند."
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="font-bold"
              onClick={() => navigate("/admin/products")}
            >
              انصراف
            </Button>
            <Button type="submit" className="gap-1.5 font-bold" disabled={save.isPending || taxonomyLoading}>
              {save.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              {isEdit ? "ذخیره تغییرات" : "ایجاد محصول"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* اطلاعات پایه */}
        <SectionCard title="اطلاعات پایه">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="p-name">نام محصول *</Label>
              <Input id="p-name" className="mt-1.5 bg-white" {...form.register("name")} />
              <FieldError message={err.name?.message} />
            </div>
            <div>
              <Label htmlFor="p-name-en">نام لاتین</Label>
              <Input id="p-name-en" dir="ltr" className="mt-1.5 bg-white text-right" {...form.register("nameEn")} />
              <FieldError message={err.nameEn?.message} />
            </div>
            <div>
              <Label htmlFor="p-model">شماره مدل</Label>
              <Input id="p-model" dir="ltr" className="mt-1.5 bg-white text-right" {...form.register("model")} />
              <FieldError message={err.model?.message} />
            </div>
            <div>
              <Label htmlFor="p-sku">کد کالا (SKU)</Label>
              <Input id="p-sku" dir="ltr" className="mt-1.5 bg-white text-right" placeholder="خالی = تولید خودکار" {...form.register("sku")} />
              <FieldError message={err.sku?.message} />
            </div>
            <div>
              <Label htmlFor="p-slug">نامک (slug)</Label>
              <Input id="p-slug" dir="ltr" className="mt-1.5 bg-white text-right" placeholder="خالی = تولید خودکار" {...form.register("slug")} />
              <FieldError message={err.slug?.message} />
            </div>
          </div>
        </SectionCard>

        {/* دسته‌بندی و برند */}
        <SectionCard title="دسته‌بندی و برند">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-category">دسته‌بندی *</Label>
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="p-category" className="mt-1.5 h-10 w-full bg-white">
                      <SelectValue placeholder="انتخاب دسته‌بندی" />
                    </SelectTrigger>
                    <SelectContent>
                      {(taxonomy?.categories ?? []).map((c) => (
                        <SelectItem key={c.slug} value={c.id} disabled={!c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={err.categoryId?.message} />
            </div>
            <div>
              <Label htmlFor="p-brand">برند *</Label>
              <Controller
                control={form.control}
                name="brandId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="p-brand" className="mt-1.5 h-10 w-full bg-white">
                      <SelectValue placeholder="انتخاب برند" />
                    </SelectTrigger>
                    <SelectContent>
                      {(taxonomy?.brands ?? []).map((b) => (
                        <SelectItem key={b.slug} value={b.id} disabled={!b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={err.brandId?.message} />
            </div>
            <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
              فهرست دسته‌بندی و برند از داده‌های فروشگاه خوانده می‌شود.
            </p>
          </div>

          {/* flags */}
          <div className="mt-4 space-y-3 border-t pt-4">
            {(
              [
                { name: "isActive", label: "فعال (نمایش در فروشگاه)" },
                { name: "isFeatured", label: "محصول ویژه" },
                { name: "isNew", label: "محصول جدید" },
              ] as const
            ).map((f) => (
              <div key={f.name} className="flex items-center justify-between gap-3">
                <Label htmlFor={`p-${f.name}`} className="text-[13px] font-bold">
                  {f.label}
                </Label>
                <Controller
                  control={form.control}
                  name={f.name}
                  render={({ field }) => (
                    <Switch
                      id={`p-${f.name}`}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label={f.label}
                    />
                  )}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* قیمت‌گذاری */}
        <SectionCard title="قیمت‌گذاری">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-price">قیمت فروش (تومان) *</Label>
              <Input
                id="p-price"
                inputMode="numeric"
                dir="ltr"
                className="mt-1.5 bg-white text-right tabular-fa"
                {...form.register("priceToman")}
              />
              <FieldError message={err.priceToman?.message} />
            </div>
            <div>
              <Label htmlFor="p-original">قیمت قبل از تخفیف (تومان)</Label>
              <Input
                id="p-original"
                inputMode="numeric"
                dir="ltr"
                className="mt-1.5 bg-white text-right tabular-fa"
                placeholder="خالی = بدون تخفیف"
                {...form.register("originalPriceToman")}
              />
              <FieldError message={err.originalPriceToman?.message} />
            </div>
          </div>

          <div className="mt-4 flex items-start justify-between gap-3 rounded-lg bg-highlight-soft/60 p-3">
            <div>
              <Label htmlFor="p-manual" className="text-[13px] font-bold">
                قیمت دستی
              </Label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                محصولات ارزی با غیرفعال‌کردن این گزینه از موتور قیمت‌گذاری پیروی می‌کنند.
              </p>
            </div>
            <Controller
              control={form.control}
              name="isPriceManual"
              render={({ field }) => (
                <Switch id="p-manual" checked={field.value} onCheckedChange={field.onChange} aria-label="قیمت دستی" />
              )}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-cost">قیمت تمام‌شده (ارزی)</Label>
              <Input
                id="p-cost"
                inputMode="decimal"
                dir="ltr"
                className="mt-1.5 bg-white text-right tabular-fa"
                placeholder="مثلاً 480"
                disabled={isPriceManual}
                {...form.register("costPrice")}
              />
              <FieldError message={err.costPrice?.message} />
            </div>
            <div>
              <Label htmlFor="p-currency">ارز قیمت تمام‌شده</Label>
              <Controller
                control={form.control}
                name="costCurrency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isPriceManual}>
                    <SelectTrigger id="p-currency" className="mt-1.5 h-10 w-full bg-white">
                      <SelectValue placeholder="— انتخاب کنید —" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CURRENCY_LABELS[c]} ({c})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={err.costCurrency?.message} />
            </div>
          </div>
        </SectionCard>

        {/* موجودی و گارانتی */}
        <SectionCard title="موجودی و گارانتی">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="p-stock">موجودی انبار *</Label>
              <Input
                id="p-stock"
                inputMode="numeric"
                dir="ltr"
                className="mt-1.5 bg-white text-right tabular-fa"
                {...form.register("stock")}
              />
              <FieldError message={err.stock?.message} />
            </div>
            <div>
              <Label htmlFor="p-threshold">آستانه هشدار موجودی</Label>
              <Input
                id="p-threshold"
                inputMode="numeric"
                dir="ltr"
                className="mt-1.5 bg-white text-right tabular-fa"
                {...form.register("lowStockThreshold")}
              />
              <FieldError message={err.lowStockThreshold?.message} />
            </div>
            <div>
              <Label htmlFor="p-warranty">گارانتی (ماه)</Label>
              <Input
                id="p-warranty"
                inputMode="numeric"
                dir="ltr"
                className="mt-1.5 bg-white text-right tabular-fa"
                placeholder="خالی = بدون گارانتی"
                {...form.register("warrantyMonths")}
              />
              <FieldError message={err.warrantyMonths?.message} />
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="p-short-desc">توضیح کوتاه</Label>
              <Textarea
                id="p-short-desc"
                rows={2}
                className="mt-1.5 resize-y bg-white"
                {...form.register("shortDescription")}
              />
              <FieldError message={err.shortDescription?.message} />
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="p-desc">توضیحات کامل *</Label>
              <Textarea
                id="p-desc"
                rows={6}
                className="mt-1.5 resize-y bg-white"
                {...form.register("description")}
              />
              <FieldError message={err.description?.message} />
            </div>
          </div>
        </SectionCard>

        {/* تصاویر */}
        <SectionCard
          title="تصاویر"
          description="تصویر اول، تصویر اصلی محصول است (حداکثر ۱۰ تصویر). متن جایگزین برای دسترس‌پذیری و سئو نمایش داده می‌شود."
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={onFileSelected}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 font-bold"
              onClick={onPickUpload}
              disabled={uploading || imageArray.fields.length >= 10}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-4" aria-hidden />
              )}
              بارگذاری تصویر
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 font-bold"
              onClick={() => imageArray.append({ url: "", alt: "" })}
              disabled={imageArray.fields.length >= 10}
            >
              <Plus className="size-4" aria-hidden />
              افزودن با آدرس
            </Button>
            <span className="text-[11px] text-muted-foreground">JPG، PNG یا WebP — حداکثر ۲ مگابایت</span>
          </div>

          <div className="mt-3 space-y-3">
            {imageArray.fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2 rounded-lg border bg-muted/20 p-2">
                <ImagePreview url={form.watch(`images.${i}.url` as const)} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <Input
                      dir="ltr"
                      aria-label={`آدرس تصویر ${i + 1}`}
                      placeholder="https://…/image.jpg یا /uploads/p-….jpg"
                      className="bg-white text-left text-xs"
                      {...form.register(`images.${i}.url` as const)}
                    />
                    <FieldError message={err.images?.[i]?.url?.message} />
                  </div>
                  <div>
                    <Input
                      aria-label={`متن جایگزین (alt) تصویر ${i + 1}`}
                      placeholder="متن جایگزین (alt)"
                      className="bg-white text-xs"
                      {...form.register(`images.${i}.alt` as const)}
                    />
                    <FieldError message={err.images?.[i]?.alt?.message} />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 text-destructive"
                  aria-label={`حذف تصویر ${i + 1}`}
                  onClick={() => imageArray.remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {imageArray.fields.length === 0 && (
              <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                هنوز تصویری اضافه نشده است؛ با «بارگذاری تصویر» یا «افزودن با آدرس» شروع کنید.
              </p>
            )}
          </div>
        </SectionCard>

        {/* رنگ‌ها */}
        <SectionCard title="رنگ‌های موجود">
          <div className="space-y-2">
            {colorArray.fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    aria-label={`نام رنگ ${i + 1}`}
                    placeholder="نام رنگ (مثلاً نقره‌ای)"
                    className="bg-white"
                    {...form.register(`colorOptions.${i}.name` as const)}
                  />
                  <FieldError message={err.colorOptions?.[i]?.name?.message} />
                </div>
                <div className="flex w-44 items-start gap-2">
                  <Input
                    dir="ltr"
                    aria-label={`کد رنگ ${i + 1}`}
                    placeholder="#RRGGBB"
                    className="bg-white text-right"
                    {...form.register(`colorOptions.${i}.hex` as const)}
                  />
                  <HexSwatch hex={form.watch(`colorOptions.${i}.hex` as const)} />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0 text-destructive"
                  aria-label={`حذف رنگ ${i + 1}`}
                  onClick={() => colorArray.remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() => colorArray.append({ name: "", hex: "#888888" })}
          >
            <Plus className="size-4" aria-hidden />
            افزودن رنگ
          </Button>
        </SectionCard>

        {/* مشخصات */}
        <SectionCard title="مشخصات فنی" description="جفت‌های عنوان/مقدار در جدول مشخصات صفحه محصول نمایش داده می‌شوند.">
          <div className="space-y-2">
            {attrArray.fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <div className="w-28 shrink-0">
                  <Input
                    aria-label={`گروه ویژگی ${i + 1}`}
                    placeholder="گروه (اختیاری)"
                    className="bg-white"
                    {...form.register(`attributes.${i}.group` as const)}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    aria-label={`عنوان ویژگی ${i + 1}`}
                    placeholder="عنوان (مثلاً توان)"
                    className="bg-white"
                    {...form.register(`attributes.${i}.key` as const)}
                  />
                  <FieldError message={err.attributes?.[i]?.key?.message} />
                </div>
                <div className="flex-1">
                  <Input
                    aria-label={`مقدار ویژگی ${i + 1}`}
                    placeholder="مقدار (مثلاً ۲۴۰۰ وات)"
                    className="bg-white"
                    {...form.register(`attributes.${i}.value` as const)}
                  />
                  <FieldError message={err.attributes?.[i]?.value?.message} />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0 text-destructive"
                  aria-label={`حذف ویژگی ${i + 1}`}
                  onClick={() => attrArray.remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() => attrArray.append({ group: "", key: "", value: "" })}
          >
            <Plus className="size-4" aria-hidden />
            افزودن ویژگی
          </Button>
        </SectionCard>

        {/* تنوع‌ها */}
        <SectionCard title="تنوع‌ها" description="مثلاً رنگ/ظرفیت/قدرت با قیمت اضافه و موجودی مجزا.">
          <div className="space-y-2">
            {variantArray.fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <div className="w-28 shrink-0">
                  <Input
                    aria-label={`نام تنوع ${i + 1}`}
                    placeholder="نام (مثلاً رنگ)"
                    className="bg-white"
                    {...form.register(`variants.${i}.name` as const)}
                  />
                  <FieldError message={err.variants?.[i]?.name?.message} />
                </div>
                <div className="flex-1">
                  <Input
                    aria-label={`مقدار تنوع ${i + 1}`}
                    placeholder="مقدار (مثلاً سفید)"
                    className="bg-white"
                    {...form.register(`variants.${i}.value` as const)}
                  />
                  <FieldError message={err.variants?.[i]?.value?.message} />
                </div>
                <div className="w-36 shrink-0">
                  <Input
                    dir="ltr"
                    inputMode="numeric"
                    aria-label={`قیمت اضافه تنوع ${i + 1}`}
                    placeholder="قیمت اضافه"
                    className="bg-white text-right"
                    {...form.register(`variants.${i}.extraPriceToman` as const)}
                  />
                  <FieldError message={err.variants?.[i]?.extraPriceToman?.message} />
                </div>
                <div className="w-28 shrink-0">
                  <Input
                    dir="ltr"
                    inputMode="numeric"
                    aria-label={`موجودی تنوع ${i + 1}`}
                    placeholder="موجودی"
                    className="bg-white text-right"
                    {...form.register(`variants.${i}.stock` as const)}
                  />
                  <FieldError message={err.variants?.[i]?.stock?.message} />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0 text-destructive"
                  aria-label={`حذف تنوع ${i + 1}`}
                  onClick={() => variantArray.remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() => variantArray.append({ name: "", value: "", extraPriceToman: 0, stock: 0 })}
          >
            <Plus className="size-4" aria-hidden />
            افزودن تنوع
          </Button>
        </SectionCard>
      </div>

      {/* Sticky submit (mobile-friendly) */}
      <div className="sticky bottom-4 mt-5 flex justify-end">
        <Button type="submit" size="lg" className="gap-1.5 font-bold shadow-lg" disabled={save.isPending || taxonomyLoading}>
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {isEdit ? "ذخیره تغییرات" : "ایجاد محصول"}
        </Button>
      </div>
    </form>
  );
}

function HexSwatch({ hex }: { hex?: string }) {
  const valid = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex ?? "");
  return (
    <span
      aria-hidden
      className="mt-1 block size-10 shrink-0 rounded-lg border bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%),linear-gradient(45deg,#eee_25%,white_25%,white_75%,#eee_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px]"
    >
      <span className="block size-full rounded-md" style={{ backgroundColor: valid ? hex : "transparent" }} />
    </span>
  );
}
