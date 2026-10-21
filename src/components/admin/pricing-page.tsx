"use client";
// Admin pricing (#/admin/pricing) — the showcase page:
// 1) exchange rates (current + form + history)  2) pricing rules (table + dialogs)
// 3) dry-run preview and apply  4) price history.

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  Banknote,
  Calculator,
  History,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { toEnDigits, formatDateTimeFa, formatToman, timeAgoFa, toFaDigits } from "@/lib/money";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  MAX_RATE_AGE_DAYS,
  SCOPE_TYPE_LABELS,
} from "@/lib/constants";
import type { ExchangeRateDTO, PricingPreviewResponse, PricingRuleDTO } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import {
  useAllAdminProducts,
  usePricingHistory,
  usePricingRates,
  usePricingRules,
  usePostRate,
  useRunPricing,
  useSaveRule,
  useTaxonomy,
  useToggleRule,
} from "@/hooks/use-admin";
import { ErrorState } from "@/components/store/empty-state";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import {
  PRICE_SOURCE_LABELS,
  SkeletonRows,
  SkeletonTable,
  ToneBadge,
  AdminPagination,
  skipReasonLabel,
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── 1) Rates ───────────────────────────────────────────────────────────────

const rateSchema = z.object({
  currency: z.enum(["USD", "EUR", "AED"], { message: "ارز نامعتبر است." }),
  rateToman: z.preprocess(
    (v) => {
      if (v == null) return null;
      const s = toEnDigits(String(v)).replace(/[,\s٬]/g, "");
      return s === "" ? null : Number(s);
    },
    z.number({ error: "مقدار واردشده عدد نیست." }).int("نرخ باید عدد صحیح باشد.").positive("نرخ ارز باید بزرگ‌تر از صفر باشد.")
  ),
  note: z.string().trim().max(200, "حداکثر ۲۰۰ کاراکتر مجاز است."),
});

type RateForm = z.infer<typeof rateSchema>;

function RatesCard({ isAdmin }: { isAdmin: boolean }) {
  const { data: rates, isLoading, isError, refetch } = usePricingRates();
  const postRate = usePostRate(isAdmin);

  const form = useForm<z.input<typeof rateSchema>, unknown, z.output<typeof rateSchema>>({
    resolver: zodResolver(rateSchema),
    defaultValues: { currency: "USD", rateToman: null, note: "" },
  });

  const activeByCurrency = useMemo(() => {
    const map = new Map<string, ExchangeRateDTO>();
    (rates ?? []).forEach((r) => {
      if (r.isActive && !map.has(r.currency)) map.set(r.currency, r);
    });
    return map;
  }, [rates]);

  const history = (rates ?? []).filter((r) => !r.isActive).slice(0, 8);

  return (
    <Card className="rounded-xl">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <Banknote className="size-4 text-highlight" aria-hidden />
          نرخ ارز
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <SkeletonRows rows={3} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {CURRENCIES.map((c) => {
              const r = activeByCurrency.get(c);
              return (
                <div key={c} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-extrabold">{CURRENCY_LABELS[c]}</p>
                    <ToneBadge tone="zinc">{c}</ToneBadge>
                  </div>
                  {r ? (
                    <>
                      <p className="mt-2 text-lg font-extrabold tabular-fa">{formatToman(r.rateToman)}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        منبع: {r.source === "MANUAL" ? "دستی" : r.source} · {formatDateTimeFa(r.recordedAt)}
                      </p>
                      {r.isStale && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-[11px] leading-5 text-amber-800">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          قدیمی‌تر از {toFaDigits(String(MAX_RATE_AGE_DAYS))} روز — موتور قیمت‌گذاری از آن استفاده نمی‌کند.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">نرخ فعالی ثبت نشده است.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Set rate form — ADMIN only */}
        <div className="mt-5 rounded-xl border bg-muted/30 p-4">
          <p className="text-[13px] font-extrabold">ثبت نرخ ارز جدید</p>
          {!isAdmin && (
            <p className="mt-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              ثبت نرخ ارز فقط برای مدیر سیستم (ADMIN) فعال است.
            </p>
          )}
          <form
            className="mt-3 grid gap-3 sm:grid-cols-4"
            onSubmit={form.handleSubmit((v) =>
              postRate.mutate(
                { currency: v.currency, rateToman: v.rateToman, note: v.note || undefined },
                {
                  onSuccess: () =>
                    form.reset({ currency: v.currency, rateToman: null, note: "" }),
                }
              )
            )}
            noValidate
          >
            <div>
              <Label htmlFor="rate-currency">ارز</Label>
              <Controller
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!isAdmin}>
                    <SelectTrigger id="rate-currency" className="mt-1.5 h-10 w-full bg-white">
                      <SelectValue />
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
              {form.formState.errors.currency && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.currency.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="rate-value">نرخ (تومان)</Label>
              <Input
                id="rate-value"
                inputMode="numeric"
                dir="ltr"
                disabled={!isAdmin}
                placeholder="مثلاً 115000"
                className="mt-1.5 h-10 bg-white text-right tabular-fa"
                {...form.register("rateToman")}
              />
              {form.formState.errors.rateToman && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.rateToman.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="rate-note">یادداشت</Label>
              <Input
                id="rate-note"
                disabled={!isAdmin}
                placeholder="اختیاری"
                className="mt-1.5 h-10 bg-white"
                {...form.register("note")}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="h-10 w-full gap-1.5 font-bold" disabled={!isAdmin || postRate.isPending}>
                {postRate.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                ثبت نرخ
              </Button>
            </div>
          </form>
        </div>

        {/* Rate history (inactive, newest 8) */}
        {history.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold text-muted-foreground">نرخ‌های قبلی (۸ مورد اخیر):</p>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto pe-1">
              {history.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-xs">
                  <span className="font-bold">{CURRENCY_LABELS[r.currency] ?? r.currency}</span>
                  <span className="tabular-fa">{formatToman(r.rateToman)}</span>
                  <span className="text-muted-foreground">{formatDateTimeFa(r.recordedAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 2) Rules ───────────────────────────────────────────────────────────────

const ruleSchema = z
  .object({
    name: z.string().trim().min(2, "نام قاعده الزامی است.").max(120, "حداکثر ۱۲۰ کاراکتر مجاز است."),
    scopeType: z.enum(["GLOBAL", "CATEGORY", "BRAND", "PRODUCT"], { message: "نوع دامنه نامعتبر است." }),
    categoryId: z.string(),
    brandId: z.string(),
    productId: z.string(),
    marginPercent: z.preprocess(
      (v) => {
        if (v == null || v === "") return null;
        const s = toEnDigits(String(v)).replace(/[,\s٬]/g, "");
        return s === "" ? null : Number(s);
      },
      z.number({ error: "مقدار واردشده عدد نیست." }).min(0, "حاشیه سود نمی‌تواند منفی باشد.").max(500, "حاشیه سود بیش از حد مجاز است.")
    ),
    extraCostToman: z.preprocess(
      (v) => {
        if (v == null || v === "") return 0;
        const s = toEnDigits(String(v)).replace(/[,\s٬]/g, "");
        return s === "" ? 0 : Number(s);
      },
      z.number({ error: "مقدار واردشده عدد نیست." }).int("باید عدد صحیح باشد.").min(0, "هزینه اضافه نمی‌تواند منفی باشد.")
    ),
    roundingStepToman: z.preprocess(
      (v) => {
        if (v == null) return null;
        const s = toEnDigits(String(v)).replace(/[,\s٬]/g, "");
        return s === "" ? null : Number(s);
      },
      z.number({ error: "مقدار واردشده عدد نیست." }).int("باید عدد صحیح باشد.").positive("گام رند کردن باید بزرگ‌تر از صفر باشد.")
    ),
    isActive: z.boolean(),
  })
  .refine((v) => v.scopeType !== "CATEGORY" || !!v.categoryId, {
    message: "برای دامنه دسته‌بندی، یک دسته انتخاب کنید.",
    path: ["categoryId"],
  })
  .refine((v) => v.scopeType !== "BRAND" || !!v.brandId, {
    message: "برای دامنه برند، یک برند انتخاب کنید.",
    path: ["brandId"],
  })
  .refine((v) => v.scopeType !== "PRODUCT" || !!v.productId, {
    message: "برای دامنه محصول خاص، یک محصول انتخاب کنید.",
    path: ["productId"],
  });

type RuleForm = z.infer<typeof ruleSchema>;

function RuleDialog({
  open,
  onOpenChange,
  rule,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule: PricingRuleDTO | null;
  onSaved?: () => void;
}) {
  const { data: taxonomy } = useTaxonomy();
  const { data: allRows } = useAllAdminProducts(open);
  const save = useSaveRule(rule?.id ?? null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");

  const form = useForm<z.input<typeof ruleSchema>, unknown, z.output<typeof ruleSchema>>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      name: "",
      scopeType: "GLOBAL",
      categoryId: "",
      brandId: "",
      productId: "",
      marginPercent: null,
      extraCostToman: 0,
      roundingStepToman: null,
      isActive: true,
    },
  });

  // (Re)populate when opened.
  useEffect(() => {
    if (!open) return;
    if (rule) {
      form.reset({
        name: rule.name,
        scopeType: rule.scopeType,
        categoryId: rule.categoryId ?? "",
        brandId: rule.brandId ?? "",
        productId: rule.productId ?? "",
        marginPercent: rule.marginPercent,
        extraCostToman: rule.extraCostToman,
        roundingStepToman: rule.roundingStepToman,
        isActive: rule.isActive,
      });
    } else {
      form.reset({
        name: "",
        scopeType: "GLOBAL",
        categoryId: "",
        brandId: "",
        productId: "",
        marginPercent: null,
        extraCostToman: 0,
        roundingStepToman: null,
        isActive: true,
      });
    }
  }, [open, rule, form]);

  const scopeType = form.watch("scopeType");
  const productId = form.watch("productId");
  const selectedProduct = (allRows ?? []).find((p) => p.id === productId);

  const pickerResults = useMemo(() => {
    const q = pickerQ.trim().toLowerCase();
    const rows = allRows ?? [];
    if (!q) return rows.slice(0, 8);
    return rows
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.name.includes(q)
      )
      .slice(0, 8);
  }, [allRows, pickerQ]);

  const err = form.formState.errors;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{rule ? "ویرایش قاعده قیمت‌گذاری" : "قاعده قیمت‌گذاری جدید"}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) =>
              save.mutate(
                {
                  name: v.name,
                  scopeType: v.scopeType,
                  ...(v.scopeType === "CATEGORY" ? { categoryId: v.categoryId } : {}),
                  ...(v.scopeType === "BRAND" ? { brandId: v.brandId } : {}),
                  ...(v.scopeType === "PRODUCT" ? { productId: v.productId } : {}),
                  marginPercent: v.marginPercent,
                  extraCostToman: v.extraCostToman,
                  roundingStepToman: v.roundingStepToman,
                  isActive: v.isActive,
                },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    onSaved?.();
                  },
                }
              )
            )}
            noValidate
          >
            <div>
              <Label htmlFor="rule-name">نام قاعده *</Label>
              <Input id="rule-name" className="mt-1.5 bg-white" placeholder="مثلاً حاشیه سود برند بوش" {...form.register("name")} />
              <FieldMsg message={err.name?.message} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>دامنه اعمال</Label>
                <Controller
                  control={form.control}
                  name="scopeType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue("categoryId", "");
                        form.setValue("brandId", "");
                        form.setValue("productId", "");
                      }}
                    >
                      <SelectTrigger className="mt-1.5 h-10 w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SCOPE_TYPE_LABELS).map(([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <Label htmlFor="rule-margin">حاشیه سود (٪) *</Label>
                <Input
                  id="rule-margin"
                  inputMode="decimal"
                  dir="ltr"
                  className="mt-1.5 h-10 bg-white text-right tabular-fa"
                  placeholder="مثلاً 12"
                  {...form.register("marginPercent")}
                />
                <FieldMsg message={err.marginPercent?.message} />
              </div>
            </div>

            {scopeType === "CATEGORY" && (
              <div>
                <Label>دسته‌بندی *</Label>
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1.5 h-10 w-full bg-white">
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
                <FieldMsg message={err.categoryId?.message} />
              </div>
            )}
            {scopeType === "BRAND" && (
              <div>
                <Label>برند *</Label>
                <Controller
                  control={form.control}
                  name="brandId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1.5 h-10 w-full bg-white">
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
                <FieldMsg message={err.brandId?.message} />
              </div>
            )}
            {scopeType === "PRODUCT" && (
              <div>
                <Label>محصول خاص *</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-1.5 h-10 w-full justify-between gap-2 bg-white font-normal"
                  onClick={() => {
                    setPickerQ("");
                    setPickerOpen(true);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Search className="size-4 text-muted-foreground" aria-hidden />
                    {selectedProduct ? selectedProduct.name : "جستجو و انتخاب محصول…"}
                  </span>
                  {selectedProduct && (
                    <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">
                      {selectedProduct.sku}
                    </span>
                  )}
                </Button>
                <FieldMsg message={err.productId?.message} />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="rule-extra">هزینه اضافه (تومان)</Label>
                <Input
                  id="rule-extra"
                  inputMode="numeric"
                  dir="ltr"
                  className="mt-1.5 h-10 bg-white text-right tabular-fa"
                  {...form.register("extraCostToman")}
                />
                <FieldMsg message={err.extraCostToman?.message} />
              </div>
              <div>
                <Label htmlFor="rule-step">گام رند کردن (تومان) *</Label>
                <Input
                  id="rule-step"
                  inputMode="numeric"
                  dir="ltr"
                  className="mt-1.5 h-10 bg-white text-right tabular-fa"
                  placeholder="مثلاً 100000"
                  {...form.register("roundingStepToman")}
                />
                <FieldMsg message={err.roundingStepToman?.message} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <Label htmlFor="rule-active" className="text-[13px] font-bold">
                قاعده فعال باشد
              </Label>
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Switch id="rule-active" checked={field.value} onCheckedChange={field.onChange} aria-label="قاعده فعال" />
                )}
              />
            </div>

            <p className="rounded-lg bg-highlight-soft/60 p-2.5 text-[11px] leading-5">
              فرمول: قیمت پیشنهادی = قیمت تمام‌شده × نرخ ارز × (۱ + حاشیه سود) + هزینه اضافه؛ سپس رند به مضرب گام.
              اولویت قواعد: محصول خاص → برند → دسته‌بندی → همه محصولات.
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" className="font-bold" onClick={() => onOpenChange(false)}>
                انصراف
              </Button>
              <Button type="submit" className="gap-1.5 font-bold" disabled={save.isPending}>
                {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {rule ? "ذخیره تغییرات" : "ایجاد قاعده"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Product picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>انتخاب محصول</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden />
            <Input
              value={pickerQ}
              onChange={(e) => setPickerQ(e.target.value)}
              placeholder="جستجو بر اساس نام یا SKU…"
              className="h-10 bg-white ps-9"
              aria-label="جستجوی محصول برای قاعده"
            />
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {pickerResults.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">محصولی یافت نشد.</p>
            ) : (
              pickerResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white p-2.5 text-start transition-colors hover:border-highlight/50 hover:bg-accent/40"
                  onClick={() => {
                    form.setValue("productId", p.id, { shouldValidate: true });
                    setPickerOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{p.name}</span>
                  <span dir="ltr" className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {p.sku}
                  </span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FieldMsg({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

function RulesCard() {
  const { data: rules, isLoading, isError, refetch } = usePricingRules();
  const toggleRule = useToggleRule();
  const { data: taxonomy } = useTaxonomy();
  const { data: allRows } = useAllAdminProducts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRuleDTO | null>(null);

  const targetName = (rule: PricingRuleDTO): string => {
    if (rule.scopeType === "CATEGORY")
      return taxonomy?.categories.find((c) => c.id === rule.categoryId)?.name ?? "—";
    if (rule.scopeType === "BRAND") return taxonomy?.brands.find((b) => b.id === rule.brandId)?.name ?? "—";
    if (rule.scopeType === "PRODUCT")
      return allRows?.find((p) => p.id === rule.productId)?.name ?? "—";
    return "همه محصولات";
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="flex-row items-center justify-between gap-2 border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <Calculator className="size-4 text-highlight" aria-hidden />
          قواعد قیمت‌گذاری
        </CardTitle>
        <Button
          size="sm"
          className="gap-1.5 font-bold"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          قاعده جدید
        </Button>
      </CardHeader>
      <CardContent className="p-4">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <SkeletonTable rows={3} cols={5} />
        ) : (rules ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            هنوز قاعده‌ای تعریف نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>دامنه</TableHead>
                  <TableHead>حاشیه سود</TableHead>
                  <TableHead>هزینه اضافه</TableHead>
                  <TableHead>گام رند</TableHead>
                  <TableHead>شامل محصولات</TableHead>
                  <TableHead>فعال</TableHead>
                  <TableHead className="text-end">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rules ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-[13px] font-bold">{r.name}</TableCell>
                    <TableCell className="text-[13px]">
                      <ToneBadge tone="teal">{SCOPE_TYPE_LABELS[r.scopeType] ?? r.scopeType}</ToneBadge>
                      {r.scopeType !== "GLOBAL" && (
                        <span className="ms-1.5 text-[12px] text-muted-foreground">{targetName(r)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] font-bold tabular-fa">
                      {toFaDigits(String(r.marginPercent))}٪
                    </TableCell>
                    <TableCell className="text-[13px] tabular-fa">{formatToman(r.extraCostToman)}</TableCell>
                    <TableCell className="text-[13px] tabular-fa">{formatToman(r.roundingStepToman)}</TableCell>
                    <TableCell className="text-[13px] tabular-fa">{toFaDigits(String(r.affectedCount))}</TableCell>
                    <TableCell>
                      <Switch
                        checked={r.isActive}
                        disabled={toggleRule.isPending}
                        aria-label={r.isActive ? `غیرفعال‌سازی قاعده ${r.name}` : `فعال‌سازی قاعده ${r.name}`}
                        onCheckedChange={(v) => toggleRule.mutate({ id: r.id, isActive: v })}
                      />
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => {
                          setEditing(r);
                          setDialogOpen(true);
                        }}
                        aria-label={`ویرایش قاعده ${r.name}`}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        ویرایش
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <RuleDialog open={dialogOpen} onOpenChange={setDialogOpen} rule={editing} />
    </Card>
  );
}

// ─── 3) Preview & apply ─────────────────────────────────────────────────────

function PreviewCard() {
  const run = useRunPricing();
  const [preview, setPreview] = useState<PricingPreviewResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runPreview = () => run.mutate(true, { onSuccess: (data) => setPreview(data) });
  const apply = () =>
    run.mutate(false, {
      onSuccess: (data) => {
        setPreview(data);
        setConfirmOpen(false);
      },
    });

  return (
    <Card className="rounded-xl">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <Play className="size-4 text-highlight" aria-hidden />
          پیش‌نمایش و اعمال قیمت‌گذاری
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-2">
          <Button className="gap-1.5 font-bold" onClick={runPreview} disabled={run.isPending}>
            {run.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Calculator className="size-4" aria-hidden />
            )}
            محاسبه پیش‌نمایش
          </Button>
          <Button
            variant="destructive"
            className="gap-1.5 font-bold"
            disabled={!preview || preview.changedCount === 0 || run.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <RefreshCw className="size-4" aria-hidden />
            اعمال تغییرات
          </Button>
          <p className="w-full text-[11px] leading-5 text-muted-foreground sm:w-auto sm:self-center">
            پیش‌نمایش هیچ قیمتی را تغییر نمی‌دهد؛ اعمال فقط پس از تأیید انجام می‌شود.
          </p>
        </div>

        {preview && (
          <>
            {/* Summary chips */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ToneBadge tone="emerald">{toFaDigits(String(preview.changedCount))} تغییر قیمت</ToneBadge>
              <ToneBadge tone="amber">{toFaDigits(String(preview.skippedCount))} رد شده</ToneBadge>
              {preview.staleCurrencies.length > 0 && (
                <span className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  نرخ ارز قدیمی: {preview.staleCurrencies.join("، ")}
                </span>
              )}
            </div>

            <div className="mt-3 overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>محصول</TableHead>
                    <TableHead>برند</TableHead>
                    <TableHead>تمام‌شده</TableHead>
                    <TableHead>قیمت فعلی</TableHead>
                    <TableHead>قیمت پیشنهادی</TableHead>
                    <TableHead>وضعیت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.productId}>
                      <TableCell>
                        <p className="max-w-56 truncate text-[13px] font-bold">{r.name}</p>
                        <p dir="ltr" className="text-right font-mono text-[11px] text-muted-foreground">
                          {r.sku}
                        </p>
                      </TableCell>
                      <TableCell className="text-[13px]">{r.brand}</TableCell>
                      <TableCell className="whitespace-nowrap text-[13px] tabular-fa">
                        {r.costPrice != null ? (
                          <>
                            {toEnDigits(String(r.costPrice))} {r.costCurrency}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-[13px] tabular-fa">{formatToman(r.currentPriceToman)}</TableCell>
                      <TableCell
                        className={
                          r.changed
                            ? "text-[13px] font-extrabold text-emerald-700 tabular-fa"
                            : "text-[13px] text-muted-foreground tabular-fa"
                        }
                      >
                        {formatToman(r.proposedPriceToman)}
                      </TableCell>
                      <TableCell>
                        {r.skipReason ? (
                          <ToneBadge tone="amber">{skipReasonLabel(r.skipReason)}</ToneBadge>
                        ) : r.changed ? (
                          <ToneBadge tone="emerald">تغییر می‌کند</ToneBadge>
                        ) : (
                          <ToneBadge tone="zinc">بدون تغییر</ToneBadge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>اعمال قیمت‌های پیشنهادی</AlertDialogTitle>
            <AlertDialogDescription>
              با اعمال، قیمت {toFaDigits(String(preview?.changedCount ?? 0))} محصول تغییر می‌کند و در
              تاریخچه قیمت ثبت می‌شود. ادامه می‌دهید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive font-bold text-white hover:bg-destructive/90"
              disabled={run.isPending}
              onClick={apply}
            >
              بله، اعمال کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── 4) History ─────────────────────────────────────────────────────────────

function HistoryCard() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = usePricingHistory(page);

  return (
    <Card className="rounded-xl">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <History className="size-4 text-highlight" aria-hidden />
          تاریخچه قیمت
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : (data?.items ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">تغییری در قیمت‌ها ثبت نشده است.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>محصول</TableHead>
                    <TableHead>قیمت قبلی</TableHead>
                    <TableHead>قیمت جدید</TableHead>
                    <TableHead>علت</TableHead>
                    <TableHead>منبع</TableHead>
                    <TableHead>زمان</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.items ?? []).map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="max-w-56 truncate text-[13px] font-bold">{h.productName}</TableCell>
                      <TableCell className="text-[13px] text-muted-foreground line-through tabular-fa">
                        {formatToman(h.oldPriceToman)}
                      </TableCell>
                      <TableCell className="text-[13px] font-bold tabular-fa">{formatToman(h.newPriceToman)}</TableCell>
                      <TableCell className="text-[13px]">{h.reason}</TableCell>
                      <TableCell>
                        <ToneBadge tone={h.source === "PRICING_ENGINE" ? "teal" : "zinc"}>
                          {PRICE_SOURCE_LABELS[h.source] ?? h.source}
                        </ToneBadge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {timeAgoFa(h.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <AdminPagination
              page={data?.page ?? page}
              pageSize={data?.pageSize ?? 20}
              total={data?.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function AdminPricingPage() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "قیمت‌گذاری | پنل مدیریت خانه‌گی";
  }, []);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="قیمت‌گذاری"
        description="نرخ ارز، قواعد حاشیه سود، پیش‌نمایش و تاریخچه قیمت محصولات ارزی."
      />
      <RatesCard isAdmin={user?.role === "ADMIN"} />
      <RulesCard />
      <PreviewCard />
      <HistoryCard />
    </div>
  );
}
