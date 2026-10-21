"use client";
// Admin users management data layer (Task 7-b).
// Query keys: ['admin-users', q, status, page], ['admin-user', id].

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/client-api";
import { toast } from "sonner";
import type {
  AdminUserDetailDTO,
  AdminUserRowDTO,
  ListResponse,
  Role,
} from "@/lib/types";

const USERS_PAGE_SIZE = 20;

export type AdminUsersStatusFilter = "all" | "active" | "blocked";

export interface AdminUsersFilters {
  q: string;
  status: AdminUsersStatusFilter;
  page: number;
}

export function useAdminUsers(filters: AdminUsersFilters) {
  return useQuery({
    queryKey: ["admin-users", filters.q, filters.status, filters.page],
    queryFn: () =>
      apiGet<ListResponse<AdminUserRowDTO>>("/api/admin/users", {
        q: filters.q || undefined,
        status: filters.status,
        page: filters.page,
        pageSize: USERS_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUserDetail(id: string | null) {
  return useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => apiGet<{ user: AdminUserDetailDTO }>(`/api/admin/users/${id}`),
    enabled: !!id,
  });
}

/** Block / unblock a user. Server guards (self / last active admin) surface verbatim via toast. */
export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiPatch<{ user: AdminUserRowDTO }>(`/api/admin/users/${id}`, { isActive }),
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? "حساب کاربری فعال شد." : "حساب کاربری مسدود شد.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "مدیر",
  STAFF: "کارمند",
  CUSTOMER: "مشتری",
};

/** Change a user's role (ADMIN only). Server guard errors surface verbatim via toast. */
export function useChangeUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      apiPost<{ user: AdminUserRowDTO }>(`/api/admin/users/${id}/role`, { role }),
    onSuccess: ({ user }) => {
      toast.success(`نقش «${user.name}» به «${ROLE_LABELS[user.role]}» تغییر کرد.`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
