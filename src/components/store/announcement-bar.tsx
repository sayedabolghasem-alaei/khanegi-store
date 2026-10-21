"use client";
// Navy announcement strip at the very top of the page.

import { Megaphone } from "lucide-react";
import { ANNOUNCEMENT } from "@/lib/constants";

export function AnnouncementBar() {
  return (
    <div className="bg-primary text-primary-foreground text-xs sm:text-[13px]">
      <div className="container-store flex h-9 items-center justify-center gap-2">
        <Megaphone className="size-3.5 shrink-0 opacity-80" aria-hidden />
        <p className="truncate text-center font-medium tracking-tight">{ANNOUNCEMENT}</p>
      </div>
    </div>
  );
}
