"use client";
// Shared address create/edit form (checkout + account addresses).

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { apiPatch, apiPost } from "@/lib/client-api";
import type { AddressDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const addressSchema = z.object({
  title: z.string().max(60).optional(),
  receiverName: z.string().min(3, "نام گیرنده باید حداقل ۳ حرف باشد."),
  phone: z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود."),
  province: z.string().min(2, "نام استان را وارد کنید."),
  city: z.string().min(2, "نام شهر را وارد کنید."),
  postalCode: z.string().regex(/^\d{10}$/, "کدپستی باید ۱۰ رقم باشد."),
  line: z.string().min(10, "نشانی کامل پستی را وارد کنید (حداقل ۱۰ حرف)."),
  isDefault: z.boolean().optional(),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

export function AddressForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: AddressDTO;
  onSaved: (a: AddressDTO) => void;
  onCancel?: () => void;
}) {
  const qc = useQueryClient();
  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: existing
      ? {
          title: existing.title,
          receiverName: existing.receiverName,
          phone: existing.phone,
          province: existing.province,
          city: existing.city,
          postalCode: existing.postalCode,
          line: existing.line,
          isDefault: existing.isDefault,
        }
      : { title: "", receiverName: "", phone: "", province: "", city: "", postalCode: "", line: "", isDefault: false },
  });

  const save = useMutation({
    mutationFn: (values: AddressFormValues) =>
      existing
        ? apiPatch<AddressDTO>(`/api/addresses/${existing.id}`, values)
        : apiPost<AddressDTO>("/api/addresses", values),
    onSuccess: (addr) => {
      toast.success(existing ? "آدرس ویرایش شد." : "آدرس جدید ذخیره شد.");
      qc.invalidateQueries({ queryKey: ["addresses"] });
      onSaved(addr);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const err = (k: keyof AddressFormValues) => form.formState.errors[k]?.message as string | undefined;

  return (
    <form
      className="space-y-4 rounded-xl border bg-white p-5"
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
      noValidate
    >
      <p className="flex items-center gap-2 font-bold">
        {existing ? <Save className="size-4 text-highlight" aria-hidden /> : <Plus className="size-4 text-highlight" aria-hidden />}
        {existing ? "ویرایش آدرس" : "ثبت آدرس جدید"}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="af-title">عنوان آدرس (اختیاری)</Label>
          <Input id="af-title" placeholder="مثلاً منزل، محل کار" className="mt-1.5 bg-white" {...form.register("title")} />
        </div>
        <div>
          <Label htmlFor="af-receiver">نام و نام خانوادگی گیرنده *</Label>
          <Input id="af-receiver" className="mt-1.5 bg-white" {...form.register("receiverName")} />
          {err("receiverName") && <p className="mt-1 text-xs text-destructive">{err("receiverName")}</p>}
        </div>
        <div>
          <Label htmlFor="af-phone">شماره موبایل گیرنده *</Label>
          <Input
            id="af-phone"
            inputMode="numeric"
            placeholder="09xxxxxxxxx"
            dir="ltr"
            className="mt-1.5 bg-white text-right"
            {...form.register("phone")}
          />
          {err("phone") && <p className="mt-1 text-xs text-destructive">{err("phone")}</p>}
        </div>
        <div>
          <Label htmlFor="af-province">استان *</Label>
          <Input id="af-province" className="mt-1.5 bg-white" {...form.register("province")} />
          {err("province") && <p className="mt-1 text-xs text-destructive">{err("province")}</p>}
        </div>
        <div>
          <Label htmlFor="af-city">شهر *</Label>
          <Input id="af-city" className="mt-1.5 bg-white" {...form.register("city")} />
          {err("city") && <p className="mt-1 text-xs text-destructive">{err("city")}</p>}
        </div>
        <div>
          <Label htmlFor="af-postal">کد پستی *</Label>
          <Input
            id="af-postal"
            inputMode="numeric"
            dir="ltr"
            className="mt-1.5 bg-white text-right"
            {...form.register("postalCode")}
          />
          {err("postalCode") && <p className="mt-1 text-xs text-destructive">{err("postalCode")}</p>}
        </div>
      </div>
      <div>
        <Label htmlFor="af-line">نشانی کامل پستی *</Label>
        <Textarea id="af-line" rows={3} className="mt-1.5 bg-white" {...form.register("line")} />
        {err("line") && <p className="mt-1 text-xs text-destructive">{err("line")}</p>}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={form.watch("isDefault")}
          onCheckedChange={(v) => form.setValue("isDefault", v === true)}
          aria-label="تنظیم به عنوان آدرس پیش‌فرض"
        />
        تنظیم به عنوان آدرس پیش‌فرض
      </label>
      <div className="flex gap-2">
        <Button type="submit" className="font-bold" disabled={save.isPending}>
          {save.isPending ? "در حال ذخیره…" : existing ? "ذخیره تغییرات" : "ذخیره آدرس"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            انصراف
          </Button>
        )}
      </div>
    </form>
  );
}
