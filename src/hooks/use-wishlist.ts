"use client";
// Wishlist — auth required; count badge shares the same cache.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/client-api";
import type { WishlistPayload } from "@/lib/types";
import { toast } from "sonner";

export function useWishlist(enabled: boolean) {
  return useQuery({
    queryKey: ["wishlist"],
    queryFn: () => apiGet<WishlistPayload>("/api/wishlist"),
    enabled,
    staleTime: 30_000,
  });
}

export function useWishlistToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      apiPost<WishlistPayload>("/api/wishlist", { productId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
    onError: (err: Error) => toast.error(err.message),
  });
}
