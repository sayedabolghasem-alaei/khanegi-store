"use client";
// Admin reviews moderation page (#/admin/reviews) — status tabs with pending
// count badge, rating/date filters, review cards with approve/reject actions
// and a manager-reply dialog (Task 7-b).

import { useEffect, useState } from "react";
import { Check, Loader2, MessageSquareReply, Star, X } from "lucide-react";
import { formatDateTimeFa, toFaDigits } from "@/lib/money";
import { href } from "@/lib/router";
import {
  useAdminReviews,
  useModerateReview,
  type AdminReviewsRatingFilter,
  type AdminReviewsStatusFilter,
} from "@/hooks/use-admin-reviews";
import type { AdminReviewDTO, ReviewStatus } from "@/lib/types";
import { ErrorState } from "@/components/store/empty-state";
import { RatingStars } from "@/components/store/rating-stars";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { SkeletonRows, ToneBadge, type Tone } from "@/components/admin/admin-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const MAX_REPLY_LENGTH = 1000;

const STATUS_TONES: Record<ReviewStatus, Tone> = {
  PENDING: "amber",
  APPROVED: "emerald",
  REJECTED: "rose",
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأییدشده",
  REJECTED: "ردشده",
};

// ─── Manager reply dialog ───────────────────────────────────────────────────

function ReplyDialog({
  review,
  onClose,
}: {
  review: AdminReviewDTO | null;
  onClose: () => void;
}) {
  const moderate = useModerateReview();
  // Initialized from the review; the parent remounts this dialog per review
  // (key), so no state-sync effect is needed.
  const [text, setText] = useState(review?.adminReply ?? "");

  const len = text.trim().length;

  return (
    <Dialog
      open={!!review}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareReply className="size-5 text-highlight" aria-hidden />
            پاسخ مدیر به دیدگاه
          </DialogTitle>
        </DialogHeader>
        {review && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3 text-xs leading-6">
              <p className="font-bold">
                {review.product.name} · {review.user.name}
              </p>
              <p className="mt-1 line-clamp-3 text-muted-foreground">{review.comment}</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-reply-text">متن پاسخ</Label>
                <span
                  className={`text-xs tabular-fa ${len > MAX_REPLY_LENGTH ? "font-bold text-destructive" : "text-muted-foreground"}`}
                >
                  {toFaDigits(String(len))} / {toFaDigits(String(MAX_REPLY_LENGTH))}
                </span>
              </div>
              <Textarea
                id="admin-reply-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                maxLength={MAX_REPLY_LENGTH}
                className="mt-1.5 bg-white"
                placeholder="پاسخ رسمی فروشگاه به این دیدگاه…"
                aria-label="متن پاسخ مدیر"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                پاسخ در صفحه محصول زیر دیدگاه نمایش داده می‌شود. برای حذف پاسخ، فیلد را خالی ذخیره کنید.
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" className="font-bold" onClick={onClose}>
            انصراف
          </Button>
          <Button
            type="button"
            className="gap-1.5 font-bold"
            disabled={moderate.isPending}
            onClick={() =>
              review &&
              moderate.mutate(
                { id: review.id, adminReply: text.trim() ? text.trim() : null },
                { onSuccess: onClose }
              )
            }
          >
            {moderate.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            ذخیره پاسخ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Review card ────────────────────────────────────────────────────────────

function ReviewCard({
  r,
  onReply,
  moderatePending,
  onDecide,
}: {
  r: AdminReviewDTO;
  onReply: (r: AdminReviewDTO) => void;
  moderatePending: boolean;
  onDecide: (r: AdminReviewDTO, status: "APPROVED" | "REJECTED") => void;
}) {
  return (
    <article className="rounded-xl border bg-white p-4 transition-colors hover:border-highlight/40 sm:p-5">
      {/* Header: product + status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href={href(`/product/${r.product.slug}`)}
          className="text-sm font-extrabold text-highlight underline-offset-4 hover:underline"
        >
          {r.product.name}
        </a>
        <ToneBadge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</ToneBadge>
      </div>

      {/* Rating + title + date */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <RatingStars value={r.rating} showValue={false} />
          {r.title && <span className="text-sm font-bold">{r.title}</span>}
          {r.isVerifiedPurchase && (
            <ToneBadge tone="emerald">
              <Star className="size-3" aria-hidden />
              خرید تأییدشده
            </ToneBadge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{formatDateTimeFa(r.createdAt)}</span>
      </div>

      {/* Comment */}
      <p className="mt-2.5 text-sm leading-7 text-foreground/90">{r.comment}</p>

      {/* User */}
      <p className="mt-2 text-xs font-bold text-muted-foreground">
        {r.user.name} · <span dir="ltr">{r.user.phone}</span>
      </p>

      {/* Existing manager reply */}
      {r.adminReply && (
        <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50/70 p-3">
          <p className="text-xs font-extrabold text-teal-800">پاسخ فروشگاه</p>
          <p className="mt-1 text-sm leading-6 text-teal-900/90">{r.adminReply}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
        {r.status !== "APPROVED" && (
          <Button
            size="sm"
            className="h-8 gap-1 bg-emerald-600 font-bold text-white hover:bg-emerald-700"
            disabled={moderatePending}
            onClick={() => onDecide(r, "APPROVED")}
          >
            <Check className="size-3.5" aria-hidden />
            تأیید
          </Button>
        )}
        {r.status !== "REJECTED" && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 border-rose-200 font-bold text-rose-700 hover:bg-rose-50"
            disabled={moderatePending}
            onClick={() => onDecide(r, "REJECTED")}
          >
            <X className="size-3.5" aria-hidden />
            رد
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1 font-bold text-highlight"
          onClick={() => onReply(r)}
        >
          <MessageSquareReply className="size-3.5" aria-hidden />
          پاسخ مدیر
        </Button>
        {r.reviewedAt && (
          <span className="ms-auto text-[11px] text-muted-foreground">
            آخرین بررسی: {formatDateTimeFa(r.reviewedAt)}
          </span>
        )}
      </div>
    </article>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

const EMPTY_MESSAGES: Record<AdminReviewsStatusFilter, string> = {
  PENDING: "دیدگاه در انتظار بررسی وجود ندارد.",
  APPROVED: "دیدگاه تأییدشده‌ای وجود ندارد.",
  REJECTED: "دیدگاه ردشده‌ای وجود ندارد.",
  all: "دیدگاهی با این فیلترها یافت نشد.",
};

export function AdminReviewsPage() {
  const [status, setStatus] = useState<AdminReviewsStatusFilter>("PENDING");
  const [rating, setRating] = useState<AdminReviewsRatingFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [replyTarget, setReplyTarget] = useState<AdminReviewDTO | null>(null);

  const { data, isLoading, isError, refetch } = useAdminReviews({
    status,
    rating,
    from: from || undefined,
    to: to || undefined,
    page,
  });
  const moderate = useModerateReview();

  useEffect(() => {
    document.title = "دیدگاه‌ها | پنل مدیریت خانه‌گی";
  }, []);

  const rows = data?.items ?? [];

  return (
    <div>
      <AdminPageHeader
        title="دیدگاه‌ها"
        description="بررسی و تأیید دیدگاه‌های کاربران؛ فقط دیدگاه‌های تأییدشده در فروشگاه نمایش داده می‌شوند."
      />

      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v as AdminReviewsStatusFilter);
          setPage(1);
        }}
        className="gap-0"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-white p-1.5">
          <TabsTrigger value="PENDING" className="gap-1.5 rounded-lg px-4 py-2 text-[13px]">
            در انتظار
            {!!data?.counts.PENDING && (
              <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-extrabold text-amber-800 tabular-fa">
                {toFaDigits(String(data.counts.PENDING))}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="APPROVED" className="rounded-lg px-4 py-2 text-[13px]">
            تأییدشده
          </TabsTrigger>
          <TabsTrigger value="REJECTED" className="rounded-lg px-4 py-2 text-[13px]">
            ردشده
          </TabsTrigger>
          <TabsTrigger value="all" className="rounded-lg px-4 py-2 text-[13px]">
            همه
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Rating + date filters */}
      <Card className="my-4 rounded-xl">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <Label className="text-xs text-muted-foreground">امتیاز</Label>
            <Select
              value={rating}
              onValueChange={(v) => {
                setRating(v as AdminReviewsRatingFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="mt-1.5 h-10 w-full bg-white" aria-label="فیلتر امتیاز">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه امتیازها</SelectItem>
                <SelectItem value="5">۵ ستاره</SelectItem>
                <SelectItem value="4">۴ ستاره</SelectItem>
                <SelectItem value="3">۳ ستاره</SelectItem>
                <SelectItem value="2">۲ ستاره</SelectItem>
                <SelectItem value="1">۱ ستاره</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rv-from" className="text-xs text-muted-foreground">
              از تاریخ
            </Label>
            <Input
              id="rv-from"
              type="date"
              dir="ltr"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="mt-1.5 h-10 bg-white text-right"
              aria-label="فیلتر از تاریخ"
            />
          </div>
          <div>
            <Label htmlFor="rv-to" className="text-xs text-muted-foreground">
              تا تاریخ
            </Label>
            <Input
              id="rv-to"
              type="date"
              dir="ltr"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="mt-1.5 h-10 bg-white text-right"
              aria-label="فیلتر تا تاریخ"
            />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">
          {EMPTY_MESSAGES[status]}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <ReviewCard
              key={r.id}
              r={r}
              moderatePending={moderate.isPending && moderate.variables?.id === r.id}
              onDecide={(rv, s) => moderate.mutate({ id: rv.id, status: s })}
              onReply={setReplyTarget}
            />
          ))}
        </div>
      )}

      {/* Simple pagination (cards) */}
      {!isLoading && !isError && (data?.total ?? 0) > 20 && (
        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="h-9 font-bold"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            صفحه قبل
          </Button>
          <span className="text-xs text-muted-foreground tabular-fa">
            صفحه {toFaDigits(String(page))}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-9 font-bold"
            disabled={page * 20 >= (data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            صفحه بعد
          </Button>
        </div>
      )}

      <ReplyDialog
        key={replyTarget?.id ?? "none"}
        review={replyTarget}
        onClose={() => setReplyTarget(null)}
      />
    </div>
  );
}
