"use client";
// Admin orders list (#/admin/orders) — status/payment/search filters + table.

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { href } from "@/lib/router";
import { formatDateTimeFa, formatToman, toFaDigits } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { useAdminOrders } from "@/hooks/use-admin";
import { ErrorState } from "@/components/store/empty-state";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import {
  AdminPagination,
  OrderStatusBadge,
  PaymentStatusBadge,
  SkeletonTable,
} from "@/components/admin/admin-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function useDebounced(value: string, delay = 350): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const PAGE_SIZE = 20;

export function AdminOrdersList() {
  const [qInput, setQInput] = useState("");
  const q = useDebounced(qInput);
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [page, setPage] = useState(1);

  const query = useAdminOrders({
    q,
    status: status === "all" ? undefined : status,
    paymentStatus: paymentStatus === "all" ? undefined : paymentStatus,
    page,
  });
  const items = query.data?.items ?? [];

  useEffect(() => {
    document.title = "مدیریت سفارش‌ها | خانه‌گی";
  }, []);

  return (
    <div>
      <AdminPageHeader
        title="سفارش‌ها"
        description="پیگیری و تغییر وضعیت سفارش‌های مشتریان."
      />

      {/* Filters */}
      <Card className="mb-4 rounded-xl">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden />
            <Input
              value={qInput}
              onChange={(e) => {
                setQInput(e.target.value);
                setPage(1);
              }}
              placeholder="جستجو: شماره سفارش، نام یا شماره تماس مشتری…"
              className="h-10 bg-white ps-9"
              aria-label="جستجوی سفارش"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:w-auto">
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full bg-white md:w-44" aria-label="فیلتر وضعیت سفارش">
                <SelectValue placeholder="همه وضعیت‌ها" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                {Object.entries(ORDER_STATUS_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={paymentStatus}
              onValueChange={(v) => {
                setPaymentStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full bg-white md:w-44" aria-label="فیلتر وضعیت پرداخت">
                <SelectValue placeholder="همه پرداخت‌ها" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه پرداخت‌ها</SelectItem>
                {Object.entries(PAYMENT_STATUS_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-xl">
        <CardContent className="p-4">
          {query.isError ? (
            <ErrorState message={(query.error as Error)?.message} onRetry={() => query.refetch()} />
          ) : query.isLoading ? (
            <SkeletonTable rows={7} cols={6} />
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              سفارشی با این فیلترها یافت نشد.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>شماره سفارش</TableHead>
                    <TableHead>مشتری</TableHead>
                    <TableHead>شماره تماس</TableHead>
                    <TableHead>اقلام</TableHead>
                    <TableHead>مبلغ کل</TableHead>
                    <TableHead>وضعیت سفارش</TableHead>
                    <TableHead>پرداخت</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((o) => (
                    <TableRow key={o.id} className="group">
                      <TableCell>
                        <a
                          href={href(`/admin/orders/${o.id}`)}
                          dir="ltr"
                          className="inline-block rounded-md px-1 font-mono text-xs font-bold text-primary transition-colors hover:text-highlight"
                        >
                          {o.orderNumber}
                        </a>
                      </TableCell>
                      <TableCell className="text-[13px] font-bold">{o.customerName}</TableCell>
                      <TableCell dir="ltr" className="text-right text-[13px] tabular-fa">
                        {toFaDigits(o.customerPhone)}
                      </TableCell>
                      <TableCell className="text-[13px] tabular-fa">{toFaDigits(String(o.itemsCount))} قلم</TableCell>
                      <TableCell className="text-[13px] font-bold tabular-fa">{formatToman(o.totalToman)}</TableCell>
                      <TableCell>
                        <OrderStatusBadge status={o.status} />
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={o.paymentStatus} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[13px]">
                        {formatDateTimeFa(o.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!query.isLoading && !query.isError && (
            <AdminPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={query.data?.total ?? 0}
              onPage={setPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
