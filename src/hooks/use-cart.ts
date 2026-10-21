"use client";
// Cart state — server is the source of truth; mutations invalidate ['cart'].

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/client-api";
import type { CartPayload } from "@/lib/types";
import { toast } from "sonner";

export interface AddToCartInput {
  productId: string;
  variantId?: string | null;
  quantity?: number;
}

export function useCart() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["cart"],
    queryFn: () => apiGet<CartPayload>("/api/cart"),
    staleTime: 15_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cart"] });

  const addItem = useMutation({
    mutationFn: (input: AddToCartInput) => apiPost<CartPayload>("/api/cart", input),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  const updateQty = useMutation({
    mutationFn: (input: { itemId: string; quantity: number }) =>
      apiPatch<CartPayload>("/api/cart", input),
    onSuccess: invalidate,
    onError: (err: Error) => {
      toast.error(err.message);
      invalidate();
    },
  });

  const clear = useMutation({
    mutationFn: () => apiDelete<CartPayload>("/api/cart"),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    cart: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    addItem,
    updateQty,
    clear,
  };
}
