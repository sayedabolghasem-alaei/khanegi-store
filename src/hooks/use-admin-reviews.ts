"use client";
// Admin review moderation data layer (Task 7-b).
// Query keys: ['admin-reviews', status, rating, productId, from, to, page].

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/client-api";
import { toast } from "sonner";
import type {
  AdminReviewDTO,
  AdminReviewsListResponse,
  ReviewStatus,
} from "@/lib/types";

export type AdminReviewsStatusFilter = ReviewStatus | "all";
export type AdminReviewsRatingFilter = "all" | "1" | "2" | "3" | "4" | "5";

export interface AdminReviewsFilters {
  status: AdminReviewsStatusFilter;
  rating: AdminReviewsRatingFilter;
  productId?: string;
  from?: string;
  to?: string;
  page: number;
}

export function useAdminReviews(filters: AdminReviewsFilters) {
  return useQuery({
    queryKey: [
      "admin-reviews",
      filters.status,
      filters.rating,
      filters.productId ?? "",
      filters.from ?? "",
      filters.to ?? "",
      filters.page,
    ],
    queryFn: () =>
      apiGet<AdminReviewsListResponse>("/api/admin/reviews", {
        status: filters.status,
        rating: filters.rating === "all" ? undefined : filters.rating,
        productId: filters.productId || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        page: filters.page,
        pageSize: 20,
      }),
    placeholderData: keepPreviousData,
  });
}

export interface ModerateReviewInput {
  id: string;
  /** Present → approve/reject decision (recalculates product aggregates). */
  status?: "APPROVED" | "REJECTED";
  /** Present → save/replace reply; null → clear the reply. */
  adminReply?: string | null;
}

export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ModerateReviewInput) =>
      apiPatch<{ review: AdminReviewDTO }>(`/api/admin/reviews/${id}`, body),
    onSuccess: (_, vars) => {
      if (vars.status === "APPROVED") toast.success("دیدگاه تأیید شد.");
      else if (vars.status === "REJECTED") toast.success("دیدگاه رد شد.");
      else toast.success("پاسخ مدیر ذخیره شد.");
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      // Product aggregates may have changed → refresh any open product page.
      qc.invalidateQueries({ queryKey: ["product"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
