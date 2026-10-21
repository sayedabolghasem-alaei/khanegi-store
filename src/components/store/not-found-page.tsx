"use client";
// 404 view for unknown hash paths.

import { useEffect } from "react";
import { Compass, Home } from "lucide-react";
import { navigate } from "@/lib/router";
import { toFaDigits } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { useCategoriesMeta } from "@/hooks/use-catalog-meta";

export function NotFoundPage({ path }: { path: string }) {
  const { items: CATEGORIES } = useCategoriesMeta();
  useEffect(() => {
    document.title = "صفحه یافت نشد";
  }, []);

  return (
    <div className="container-store flex flex-col items-center py-16 text-center">
      <p className="text-7xl font-black tabular-fa text-highlight sm:text-8xl">
        {toFaDigits("404")}
      </p>
      <h1 className="mt-4 text-xl font-extrabold">صفحه‌ای که دنبالش بودید پیدا نشد</h1>
      <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
        مسیر «<span dir="ltr" className="font-bold">{path}</span>» در خانه‌گی وجود ندارد.
        شاید نشانی تغییر کرده باشد یا لینک قدیمی بوده است.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => navigate("/")} className="font-bold">
          <Home className="size-4" aria-hidden />
          صفحه اصلی
        </Button>
        <Button variant="outline" onClick={() => navigate("/search")}>
          <Compass className="size-4" aria-hidden />
          مشاهده محصولات
        </Button>
      </div>

      <div className="mt-10 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORIES.slice(0, 8).map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => navigate(`/category/${c.slug}`)}
            className="flex flex-col items-center gap-2 rounded-xl border bg-white p-4 text-xs font-bold transition-colors hover:border-highlight hover:text-highlight"
          >
            <c.icon className="size-5 text-highlight" aria-hidden />
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
