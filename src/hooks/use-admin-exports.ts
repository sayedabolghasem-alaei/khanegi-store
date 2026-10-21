"use client";
// Admin exports/imports data layer — CSV download + bulk product import.
// Query keys invalidated: ['admin-products'], ['admin-stats'], ['admin-taxonomy'].

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/client-api";
import { toast } from "sonner";
import { toFaDigits } from "@/lib/money";

// ─── Shared types (mirror of the API payloads — see docs/contracts.md) ─────

export interface ProductImportError {
  row: number;
  message: string;
}

export interface ProductImportPreviewRow {
  row: number;
  slug: string;
  name: string;
  nameEn: string | null;
  sku: string | null;
  model: string | null;
  categorySlug: string;
  brandSlug: string;
  priceToman: number;
  originalPriceToman: number | null;
  stock: number;
  isActive: boolean;
  existsInDb: boolean;
}

export interface ProductImportPreview {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: ProductImportError[];
  preview: ProductImportPreviewRow[];
}

export interface ProductImportCommitResult {
  created: number;
  updated: number;
}

// ─── CSV download (blob → programmatic <a download> click) ─────────────────

async function fetchCsvFile(url: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) {
    let message = "دریافت فایل ناموفق بود. لطفاً دوباره تلاش کنید.";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 403) message = "دسترسی غیرمجاز";
    throw new Error(message);
  }

  const blob = await res.blob();
  const dispo = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(dispo);
  const filename = match?.[1] ?? fallbackFilename;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

export interface DownloadExportInput {
  entity: string;
  from?: string;
  to?: string;
}

export async function downloadCsvExport(input: DownloadExportInput): Promise<void> {
  const params = new URLSearchParams({ entity: input.entity });
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  await fetchCsvFile(`/api/admin/export?${params.toString()}`, `${input.entity}.csv`);
}

export function useDownloadExport() {
  return useMutation({
    mutationFn: downloadCsvExport,
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Downloads the sample products-import template (GET ?template=1). */
export function useDownloadImportTemplate() {
  return useMutation({
    mutationFn: () => fetchCsvFile("/api/admin/products/import?template=1", "products-import-template.csv"),
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Bulk product import ────────────────────────────────────────────────────

export function useValidateProductImport() {
  return useMutation({
    mutationFn: (csv: string) =>
      apiPost<ProductImportPreview>("/api/admin/products/import", { csv, commit: false }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCommitProductImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) =>
      apiPost<ProductImportCommitResult>("/api/admin/products/import", { csv, commit: true }),
    onSuccess: (data) => {
      toast.success(
        `ورود گروهی کامل شد: ${toFaDigits(String(data.created))} محصول جدید ایجاد و ${toFaDigits(
          String(data.updated)
        )} محصول به‌روزرسانی شد.`
      );
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-taxonomy"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
