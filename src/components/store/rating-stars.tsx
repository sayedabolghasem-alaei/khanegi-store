"use client";
// Star rating display (Persian digits for the numeric value).

import { Star } from "lucide-react";
import { toFaDigits } from "@/lib/money";
import { cn } from "@/lib/utils";

export function RatingStars({
  value,
  count,
  size = "sm",
  showValue = true,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
  showValue?: boolean;
}) {
  const dimension = size === "md" ? "size-4" : "size-3.5";
  const rounded = Math.round(value * 2) / 2; // nearest 0.5

  return (
    <span className="flex items-center gap-1" aria-label={`امتیاز ${toFaDigits(value.toFixed(1))} از ۵`}>
      <span className="flex items-center gap-px" dir="ltr">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = rounded >= i;
          const half = !filled && rounded >= i - 0.5;
          return (
            <Star
              key={i}
              className={cn(
                dimension,
                filled || half
                  ? "fill-amber-400 text-amber-400"
                  : "fill-muted text-muted-foreground/30"
              )}
              strokeWidth={1.5}
              aria-hidden
            />
          );
        })}
      </span>
      {showValue && (
        <span className="text-xs font-bold tabular-fa text-muted-foreground">
          {toFaDigits(value.toFixed(1))}
        </span>
      )}
      {typeof count === "number" && (
        <span className="text-[11px] tabular-fa text-muted-foreground/80">
          ({toFaDigits(String(count))})
        </span>
      )}
    </span>
  );
}
