"use client";
// Reusable product row: fetches a small slice of the catalog and renders a grid.

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/client-api";
import type { ListResponse, ProductCard as ProductCardDTO } from "@/lib/types";
import { ProductCard } from "@/components/store/product-card";
import { ProductGridSkeleton } from "@/components/store/skeletons";
import { SectionHeader } from "@/components/store/section-header";
import { ErrorState } from "@/components/store/empty-state";

export function ProductRow({
  title,
  subtitle,
  icon,
  moreHref,
  params,
  pageSize = 8,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  moreHref?: string;
  params: Record<string, string | number | boolean | undefined | null>;
  pageSize?: number;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products", params],
    queryFn: () => apiGet<ListResponse<ProductCardDTO>>("/api/products", { ...params, pageSize }),
  });

  // Skip silently when the section has no products
  if (!isLoading && !isError && (data?.items.length ?? 0) === 0) return null;

  return (
    <section className="container-store py-6" aria-label={title}>
      <SectionHeader title={title} subtitle={subtitle} moreHref={moreHref} icon={icon} />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ProductGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {data!.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
