"use client";
// Auth state via TanStack Query — single source of truth: GET /api/auth/me.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/client-api";
import type { UserDTO } from "@/lib/types";

export function useAuth() {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<{ user: UserDTO | null }>("/api/auth/me"),
    staleTime: 60_000,
    retry: 1,
  });

  return {
    user: query.data?.user ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

/** Invalidate auth state everywhere (after login/register/logout). */
export function useAuthInvalidator() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["wishlist"] });
  };
}

export async function logoutRequest(): Promise<void> {
  await apiPost("/api/auth/logout");
}
