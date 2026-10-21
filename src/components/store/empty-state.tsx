"use client";
// Friendly empty state + destructive error box with retry.

import { AlertTriangle, PackageOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function EmptyState({
  title = "محصولی یافت نشد",
  description = "فیلترها را تغییر دهید یا عبارت دیگری را جستجو کنید.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 py-14 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-muted">
        <PackageOpen className="size-8 text-muted-foreground" aria-hidden />
      </span>
      <p className="text-base font-bold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  message = "خطایی در دریافت اطلاعات رخ داد.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive" className="my-6">
      <AlertTriangle className="size-4" />
      <AlertTitle>مشکلی پیش آمد</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button size="sm" variant="outline" className="h-8 bg-white" onClick={onRetry}>
            <RotateCcw className="size-3.5" />
            تلاش دوباره
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
