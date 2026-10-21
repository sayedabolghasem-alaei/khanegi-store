"use client";
// Price display: current toman price, optional strikethrough original + % badge.

import { formatToman, toFaDigits } from "@/lib/money";
import { cn } from "@/lib/utils";

export function PriceTag({
  price,
  original,
  size = "md",
  className,
}: {
  price: number;
  original?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const discount =
    original && original > price ? Math.round(((original - price) / original) * 100) : 0;

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-extrabold tabular-fa",
          size === "lg" && "text-2xl",
          size === "md" && "text-base",
          size === "sm" && "text-sm"
        )}
      >
        {formatToman(price)}
      </span>
      {original && original > price && (
        <span className="text-xs text-muted-foreground line-through tabular-fa">
          {formatToman(original, false)}
        </span>
      )}
      {discount > 0 && (
        <span className="rounded-full bg-highlight px-1.5 py-0.5 text-[11px] font-bold tabular-fa text-highlight-foreground">
          {toFaDigits(String(discount))}٪
        </span>
      )}
    </div>
  );
}
