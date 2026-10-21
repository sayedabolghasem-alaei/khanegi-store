"use client";
// Admin settings data layer (Task 7-d) — store settings, shipping methods,
// bulk product ops and image upload. Kept separate from use-admin.ts so the
// existing admin hooks stay untouched.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/client-api";
import { toast } from "sonner";

// ─── Types (mirror of server shapes in src/lib/server/site-settings.ts) ────

export interface StoreContactSettings {
  phone: string;
  email: string;
  address: string;
  instagram: string;
  telegram: string;
  whatsapp: string;
}

export interface StoreCommerceSettings {
  minOrderToman: number;
  freeShippingThresholdToman: number;
  showPricesWithTaxNote: boolean;
}

export interface SeoSettings {
  defaultTitle: string;
  defaultDescription: string;
  keywords: string;
}

export interface StoreSettingsMap {
  store_contact: StoreContactSettings;
  store_commerce: StoreCommerceSettings;
  seo: SeoSettings;
}

export type SettingsPatch = Partial<{
  store_contact: StoreContactSettings;
  store_commerce: StoreCommerceSettings;
  seo: SeoSettings;
}>;

// ─── Shipping method (admin view — includes isActive/sortOrder) ─────────────

export interface ShippingMethodAdminRow {
  id: string;
  name: string;
  description: string | null;
  costToman: number;
  freeThresholdToman: number | null;
  estimatedDays: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ShippingMethodInput {
  name: string;
  description?: string;
  costToman: number;
  freeThresholdToman?: number | null;
  estimatedDays?: string;
  isActive?: boolean;
  sortOrder?: number;
}

// ─── Store settings ──────────────────────────────────────────────────────────

export function useStoreSettings() {
  return useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiGet<{ settings: StoreSettingsMap }>("/api/admin/settings"),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) =>
      apiPut<{ settings: StoreSettingsMap; updatedKeys: string[] }>("/api/admin/settings", patch),
    onSuccess: (data) => {
      toast.success("تنظیمات با موفقیت ذخیره شد.");
      qc.setQueryData(["admin-settings"], { settings: data.settings });
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** PUT helper (client-api only ships apiGet/apiPost/apiPatch/apiDelete). */
function apiPut<T>(path: string, body: unknown): Promise<T> {
  return fetch(path, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const data = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string } })?.error;
      throw new ApiClientError(res.status, err?.code ?? "UNKNOWN", err?.message ?? "خطایی در ارتباط با سرور رخ داد.");
    }
    return data as T;
  });
}

// ─── Shipping methods CRUD ───────────────────────────────────────────────────

export function useAdminShippingMethods() {
  return useQuery({
    queryKey: ["admin-shipping"],
    queryFn: () => apiGet<{ items: ShippingMethodAdminRow[] }>("/api/admin/shipping"),
  });
}

export function useCreateShippingMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ShippingMethodInput) =>
      apiPost<{ method: ShippingMethodAdminRow }>("/api/admin/shipping", input),
    onSuccess: ({ method }) => {
      toast.success(`روش ارسال «${method.name}» ایجاد شد.`);
      qc.invalidateQueries({ queryKey: ["admin-shipping"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateShippingMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<ShippingMethodInput>) =>
      apiPatch<{ method: ShippingMethodAdminRow }>(`/api/admin/shipping/${id}`, input),
    onSuccess: ({ method }) => {
      toast.success(`روش ارسال «${method.name}» به‌روزرسانی شد.`);
      qc.invalidateQueries({ queryKey: ["admin-shipping"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteShippingMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/api/admin/shipping/${id}`),
    onSuccess: () => {
      toast.success("روش ارسال حذف شد.");
      qc.invalidateQueries({ queryKey: ["admin-shipping"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Bulk product operations ────────────────────────────────────────────────

export function useBulkProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; action: "activate" | "deactivate" }) =>
      apiPost<{ updated: number }>("/api/admin/products/bulk", input),
    onSuccess: ({ updated }, { action }) => {
      toast.success(
        `${updated.toLocaleString("fa-IR")} محصول ${action === "activate" ? "فعال" : "غیرفعال"} شد.`
      );
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Image upload (multipart — Task 7-d) ────────────────────────────────────

export async function uploadProductImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = (await res.json().catch(() => null)) as { url?: string; error?: { message?: string } } | null;
  if (!res.ok || !data?.url) {
    throw new Error(data?.error?.message ?? "بارگذاری تصویر ناموفق بود.");
  }
  return { url: data.url };
}
