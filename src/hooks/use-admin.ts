"use client";
// Admin data layer — queries & mutations for the admin panel.
// Query keys: ['admin-stats'], ['admin-products', …], ['admin-product', id],
// ['admin-order', id], ['admin-orders', …], ['pricing-rules'], ['pricing-rates'],
// ['pricing-preview'], ['pricing-history'], ['inventory-movements'], ['admin-coupons'],
// ['admin-taxonomy'].

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/client-api";
import { toast } from "sonner";
import type {
  AdminOrderRow,
  AdminProductDetail,
  AdminProductRow,
  AdminStats,
  CouponDTO,
  ExchangeRateDTO,
  InventoryMovementRow,
  ListResponse,
  OrderDTO,
  PricingPreviewResponse,
  PricingRuleDTO,
  PriceHistoryRow,
} from "@/lib/types";

const ADMIN_PAGE_SIZE = 20;

// ─── Taxonomy (category/brand id maps) ─────────────────────────────────────
// The public contract exposes no categories/brands endpoint with IDs, yet
// product create/patch and pricing rules need real DB ids. Workaround: fetch
// the full admin products list (rows carry category/brand slugs), then harvest
// ids from a minimal covering set of product details (each detail returns
// categoryId + brandId). Cached per session with staleTime: Infinity.

export interface TaxonomyOption {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
}

export interface Taxonomy {
  categories: TaxonomyOption[];
  brands: TaxonomyOption[];
}

interface AdminProductDetailPayload {
  product: AdminProductDetail;
}

async function fetchAllProductRows(): Promise<AdminProductRow[]> {
  const first = await apiGet<ListResponse<AdminProductRow>>("/api/admin/products", {
    page: 1,
    pageSize: 50,
  });
  const rows = [...first.items];
  const pageCount = Math.ceil(first.total / first.pageSize);
  if (pageCount > 1) {
    const rest = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, i) =>
        apiGet<ListResponse<AdminProductRow>>("/api/admin/products", {
          page: i + 2,
          pageSize: 50,
        })
      )
    );
    rest.forEach((r) => rows.push(...r.items));
  }
  return rows;
}

async function fetchTaxonomy(): Promise<Taxonomy> {
  const rows = await fetchAllProductRows();

  const catName = new Map<string, string>();
  const brandName = new Map<string, string>();
  for (const r of rows) {
    if (!catName.has(r.category.slug)) catName.set(r.category.slug, r.category.name);
    if (!brandName.has(r.brand.slug)) brandName.set(r.brand.slug, r.brand.name);
  }

  // Minimal covering set: one representative per brand, then per uncovered category.
  const seenBrands = new Set<string>();
  const seenCats = new Set<string>();
  const reps: { id: string; brandSlug: string; catSlug: string }[] = [];
  for (const r of rows) {
    if (!seenBrands.has(r.brand.slug)) {
      seenBrands.add(r.brand.slug);
      seenCats.add(r.category.slug);
      reps.push({ id: r.id, brandSlug: r.brand.slug, catSlug: r.category.slug });
    }
  }
  for (const r of rows) {
    if (!seenCats.has(r.category.slug)) {
      seenCats.add(r.category.slug);
      reps.push({ id: r.id, brandSlug: r.brand.slug, catSlug: r.category.slug });
    }
  }

  const catIds = new Map<string, string>();
  const brandIds = new Map<string, string>();
  await Promise.all(
    reps.map(async (rep) => {
      try {
        const { product } = await apiGet<AdminProductDetailPayload>(
          `/api/admin/products/${rep.id}`
        );
        if (!catIds.has(rep.catSlug)) catIds.set(rep.catSlug, product.categoryId);
        if (!brandIds.has(rep.brandSlug)) brandIds.set(rep.brandSlug, product.brandId);
      } catch {
        /* a single failed representative is non-fatal */
      }
    })
  );

  return {
    categories: [...catName.entries()].map(([slug, name]) => ({
      slug,
      name,
      id: catIds.get(slug) ?? "",
    })),
    brands: [...brandName.entries()].map(([slug, name]) => ({
      slug,
      name,
      id: brandIds.get(slug) ?? "",
    })),
  };
}

export function useTaxonomy() {
  return useQuery({
    queryKey: ["admin-taxonomy"],
    queryFn: fetchTaxonomy,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiGet<AdminStats>("/api/admin/stats"),
  });
}

// ─── Products list (server q/status + client category/brand slug filters) ──
// The admin list endpoint filters by categoryId/brandId only; slugs are what
// the UI has, so slug filters are applied client-side on the fetched page.

export interface AdminProductFilters {
  q?: string;
  categorySlug?: string;
  brandSlug?: string;
  status?: "all" | "active" | "inactive";
  page: number;
}

async function fetchAdminProducts(
  f: AdminProductFilters
): Promise<ListResponse<AdminProductRow> & { appliedCategorySlug?: string; appliedBrandSlug?: string }> {
  const res = await apiGet<ListResponse<AdminProductRow>>("/api/admin/products", {
    q: f.q,
    status: f.status && f.status !== "all" ? f.status : undefined,
    page: f.page,
    pageSize: ADMIN_PAGE_SIZE,
  });
  let items = res.items;
  if (f.categorySlug && f.categorySlug !== "all") items = items.filter((p) => p.category.slug === f.categorySlug);
  if (f.brandSlug && f.brandSlug !== "all") items = items.filter((p) => p.brand.slug === f.brandSlug);
  return { ...res, items };
}

export function useAdminProducts(filters: AdminProductFilters) {
  return useQuery({
    queryKey: [
      "admin-products",
      filters.q ?? "",
      filters.categorySlug ?? "",
      filters.brandSlug ?? "",
      filters.status ?? "all",
      filters.page,
    ],
    queryFn: () => fetchAdminProducts(filters),
    placeholderData: keepPreviousData,
  });
}

// Full rows (for pickers / product search dialogs)
export function useAllAdminProducts(enabled = true) {
  return useQuery({
    queryKey: ["admin-products", "all-rows"],
    queryFn: fetchAllProductRows,
    staleTime: 30_000,
    enabled,
  });
}

export function useAdminProduct(id: string | null) {
  return useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => apiGet<AdminProductDetailPayload>(`/api/admin/products/${id}`),
    enabled: !!id,
  });
}

// ─── Product mutations ──────────────────────────────────────────────────────

export interface ProductFormPayload {
  name: string;
  nameEn?: string;
  slug?: string;
  sku?: string;
  model?: string;
  categoryId: string;
  brandId: string;
  shortDescription?: string;
  description: string;
  priceToman: number;
  originalPriceToman: number | null;
  isPriceManual: boolean;
  costPrice: number | null;
  costCurrency: string | null;
  stock: number;
  lowStockThreshold: number;
  warrantyMonths: number | null;
  colorOptions: { name: string; hex: string }[];
  attributes: { group?: string; key: string; value: string }[];
  /** Wire format accepted by the API: legacy plain url or {url, alt} (Task 7-d). */
  images: ({ url: string; alt?: string } | string)[];
  variants: { name: string; value: string; extraPriceToman: number; stock: number }[];
  isFeatured: boolean;
  isNew: boolean;
  isActive: boolean;
}

export function useSaveProduct(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductFormPayload) =>
      id
        ? apiPatch<{ product: AdminProductDetail }>(`/api/admin/products/${id}`, payload)
        : apiPost<{ product: AdminProductDetail }>("/api/admin/products", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product", id] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-taxonomy"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleProductActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiPatch<{ product: AdminProductDetail }>(`/api/admin/products/${id}`, { isActive }),
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? "محصول فعال شد." : "محصول غیرفعال شد.");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product", vars.id] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface StockAdjustInput {
  productId: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  reason: string;
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, ...body }: StockAdjustInput) =>
      apiPost<{ stock: number }>(`/api/admin/products/${productId}/stock`, body),
    onSuccess: () => {
      toast.success("موجودی به‌روزرسانی شد.");
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
      qc.invalidateQueries({ queryKey: ["admin-product"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export interface AdminOrderFilters {
  status?: string;
  paymentStatus?: string;
  q?: string;
  page: number;
}

export function useAdminOrders(filters: AdminOrderFilters) {
  return useQuery({
    queryKey: [
      "admin-orders",
      filters.status ?? "",
      filters.paymentStatus ?? "",
      filters.q ?? "",
      filters.page,
    ],
    queryFn: () =>
      apiGet<ListResponse<AdminOrderRow>>("/api/admin/orders", {
        status: filters.status || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        q: filters.q || undefined,
        page: filters.page,
        pageSize: ADMIN_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminOrder(id: string | null) {
  return useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => apiGet<{ order: OrderDTO }>(`/api/admin/orders/${id}`),
    enabled: !!id,
  });
}

export function useSetOrderStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { status: string; note?: string }) =>
      apiPost<{ order: OrderDTO }>(`/api/admin/orders/${id}/status`, input),
    onSuccess: ({ order }) => {
      toast.success(`وضعیت سفارش به «${statusLabelFa(order.status)}» تغییر کرد.`);
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSaveOrderNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adminNote: string) =>
      apiPatch<{ order: OrderDTO }>(`/api/admin/orders/${id}`, { adminNote }),
    onSuccess: () => {
      toast.success("یادداشت داخلی ذخیره شد.");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

function statusLabelFa(status: string): string {
  const map: Record<string, string> = {
    PENDING: "در انتظار تأیید",
    CONFIRMED: "تأیید شده",
    PROCESSING: "در حال پردازش",
    SHIPPED: "ارسال شده",
    DELIVERED: "تحویل شده",
    CANCELLED: "لغو شده",
  };
  return map[status] ?? status;
}

// ─── Pricing ────────────────────────────────────────────────────────────────

export function usePricingRates() {
  return useQuery({
    queryKey: ["pricing-rates"],
    queryFn: () => apiGet<ExchangeRateDTO[]>("/api/admin/pricing/rates"),
  });
}

export function usePostRate(isAdmin: boolean) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { currency: string; rateToman: number; note?: string }) =>
      apiPost<ExchangeRateDTO>("/api/admin/pricing/rates", input),
    onSuccess: () => {
      toast.success("نرخ ارز ثبت شد.");
      qc.invalidateQueries({ queryKey: ["pricing-rates"] });
      qc.invalidateQueries({ queryKey: ["pricing-preview"] });
    },
    onError: (err: Error) =>
      toast.error(isAdmin ? err.message : "فقط مدیر می‌تواند نرخ ارز ثبت کند."),
  });
}

export function usePricingRules() {
  return useQuery({
    queryKey: ["pricing-rules"],
    queryFn: () => apiGet<PricingRuleDTO[]>("/api/admin/pricing/rules"),
  });
}

export function useSaveRule(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      id
        ? apiPatch<PricingRuleDTO>(`/api/admin/pricing/rules/${id}`, payload)
        : apiPost<PricingRuleDTO>("/api/admin/pricing/rules", payload),
    onSuccess: () => {
      toast.success(id ? "قاعده قیمت‌گذاری به‌روزرسانی شد." : "قاعده قیمت‌گذاری ایجاد شد.");
      qc.invalidateQueries({ queryKey: ["pricing-rules"] });
      qc.invalidateQueries({ queryKey: ["pricing-preview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiPatch<PricingRuleDTO>(`/api/admin/pricing/rules/${id}`, { isActive }),
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? "قاعده فعال شد." : "قاعده غیرفعال شد.");
      qc.invalidateQueries({ queryKey: ["pricing-rules"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRunPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dryRun: boolean) =>
      apiPost<PricingPreviewResponse>("/api/admin/pricing/run", { dryRun }),
    onSuccess: (_data, dryRun) => {
      if (!dryRun) {
        toast.success("قیمت‌ها اعمال شد.");
        qc.invalidateQueries({ queryKey: ["pricing-history"] });
        qc.invalidateQueries({ queryKey: ["admin-products"] });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePricingHistory(page: number) {
  return useQuery({
    queryKey: ["pricing-history", page],
    queryFn: () =>
      apiGet<ListResponse<PriceHistoryRow>>("/api/admin/pricing/history", { page }),
    placeholderData: keepPreviousData,
  });
}

// ─── Inventory movements ────────────────────────────────────────────────────

export function useInventoryMovements(page: number, productId?: string) {
  return useQuery({
    queryKey: ["inventory-movements", page, productId ?? ""],
    queryFn: () =>
      apiGet<ListResponse<InventoryMovementRow>>("/api/admin/inventory/movements", {
        page,
        productId,
      }),
    placeholderData: keepPreviousData,
  });
}

// ─── Coupons ────────────────────────────────────────────────────────────────

export function useAdminCoupons() {
  return useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => apiGet<CouponDTO[]>("/api/admin/coupons"),
  });
}

export interface CouponFormPayload {
  code: string;
  type: "PERCENT" | "AMOUNT";
  value: number;
  minOrderToman: number | null;
  maxDiscountToman: number | null;
  usageLimit: number | null;
  validUntil?: string;
  isActive: boolean;
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CouponFormPayload) =>
      apiPost<CouponDTO>("/api/admin/coupons", payload),
    onSuccess: () => {
      toast.success("کد تخفیف ایجاد شد.");
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiPatch<CouponDTO>(`/api/admin/coupons/${id}`, { isActive }),
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? "کد تخفیف فعال شد." : "کد تخفیف غیرفعال شد.");
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
