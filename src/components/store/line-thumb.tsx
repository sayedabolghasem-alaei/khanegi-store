"use client";
// Shared product-thumbnail with graceful fallback.

import { useState } from "react";
import { cn } from "@/lib/utils";

export function LineThumb({
  src,
  alt,
  size = "md",
}: {
  src: string | null;
  alt: string;
  size?: "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed || !src ? "/images/placeholder.svg" : src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        "rounded-lg border bg-muted/40 object-contain p-1",
        size === "lg" ? "size-24 sm:size-28" : "size-20"
      )}
    />
  );
}
