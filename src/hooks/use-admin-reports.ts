"use client";
// Admin reports data layer (Task 7-c) + order tracking-code mutation.
// Query keys: ['admin-reports', from, to, granularity] · reuses PATCH
// /api/admin/orders/[id] for trackingCode (server audits TRACKING_SET).

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/client-api";
import type { OrderDTO } from "@/lib/types";

// ─── DTOs (mirror of src/lib/server/reports.ts shapes) ─────────────────────

export type ReportGranularity = "day" | "week" | "month";

export interface SalesSeriesPoint {
  bucketISO: string;
  ordersCount: number;
  revenueToman: number;
}

export interface SalesSummary {
  ordersCount: number;
  grossSalesToman: number;
  discountsToman: number;
  shippingToman: number;
  netRevenueToman: number;
  paidCount: number;
  cancelledCount: number;
  newCustomers: number;
  avgOrderToman: number;
}

export interface TopProductRow {
  productId: string | null;
  productName: string;
  quantitySold: number;
  revenueToman: number;
}

export interface LowStockRow {
  id: string;
  name: string;
  slug: string;
  stock: number;
  lowStockThreshold: number;
}

export interface AdminReportsPayload {
  from: string;
  to: string;
  granularity: ReportGranularity;
  summary: SalesSummary;
  series: SalesSeriesPoint[];
  topProducts: TopProductRow[];
  lowStock: LowStockRow[];
}

// ─── Reports query ──────────────────────────────────────────────────────────

export interface AdminReportsFilters {
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
  granularity?: ReportGranularity;
}

export function useAdminReports(filters: AdminReportsFilters) {
  const { from, to, granularity = "day" } = filters;
  return useQuery({
    queryKey: ["admin-reports", from ?? "", to ?? "", granularity],
    queryFn: () =>
      apiGet<AdminReportsPayload>("/api/admin/reports", {
        from,
        to,
        granularity,
      }),
    placeholderData: keepPreviousData,
  });
}

// ─── Order tracking code (PATCH /api/admin/orders/[id]) ────────────────────

export function useSetTrackingCode(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackingCode: string | null) =>
      apiPatch<{ order: OrderDTO }>(`/api/admin/orders/${orderId}`, { trackingCode }),
    onSuccess: ({ order }) => {
      toast.success(
        order.trackingCode
          ? "کد رهگیری ذخیره شد."
          : "کد رهگیری سفارش حذف شد."
      );
      qc.invalidateQueries({ queryKey: ["admin-order", orderId] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
