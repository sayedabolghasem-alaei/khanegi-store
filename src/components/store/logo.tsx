"use client";
// Brand logo — icon + Persian wordmark, links home.

import { Home as HomeIcon } from "lucide-react";
import { href } from "@/lib/router";
import { SITE_NAME } from "@/lib/constants";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={href("/")}
      className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
      aria-label={`${SITE_NAME} — صفحه اصلی`}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <HomeIcon className="size-5" aria-hidden />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-extrabold tracking-tight text-primary">{SITE_NAME}</span>
          <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
            فروشگاه تخصصی لوازم خانگی
          </span>
        </span>
      )}
    </a>
  );
}
