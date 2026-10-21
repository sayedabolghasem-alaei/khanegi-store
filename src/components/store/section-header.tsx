"use client";
// Section header with title + optional «مشاهده همه» link.

import { ChevronLeft } from "lucide-react";
import { href } from "@/lib/router";

export function SectionHeader({
  title,
  subtitle,
  moreHref,
  moreLabel = "مشاهده همه",
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  moreHref?: string;
  moreLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
          {Icon && (
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-highlight-soft text-highlight">
              <Icon className="size-4.5" aria-hidden />
            </span>
          )}
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {moreHref && (
        <a
          href={href(moreHref)}
          className="flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-[13px] font-bold text-highlight transition-colors hover:bg-highlight-soft"
        >
          {moreLabel}
          <ChevronLeft className="size-4" aria-hidden />
        </a>
      )}
    </div>
  );
}
