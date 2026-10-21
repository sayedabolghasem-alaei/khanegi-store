import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, parseIntParam } from "@/lib/server/api-helpers";
import { ORDER_STATUSES } from "@/lib/constants";
import type { AdminOrderRow, ListResponse } from "@/lib/types";

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["STAFF", "ADMIN"]);
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? undefined;
  const paymentStatus = sp.get("paymentStatus") ?? undefined;
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const page = parseIntParam(sp.get("page"), 1);
  const pageSize = Math.min(50, parseIntParam(sp.get("pageSize"), 20));

  const orders = await db.order.findMany({
    where: {
      ...(status && ORDER_STATUSES.includes(status as never) ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { id: true } } },
  });

  const filtered = q
    ? orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q)
      )
    : orders;

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items: AdminOrderRow[] = filtered.slice(start, start + pageSize).map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    totalToman: o.totalToman,
    status: o.status as AdminOrderRow["status"],
    paymentStatus: o.paymentStatus as AdminOrderRow["paymentStatus"],
    itemsCount: o.items.length,
    createdAt: o.createdAt.toISOString(),
  }));

  const payload: ListResponse<AdminOrderRow> = { items, total, page, pageSize };
  return ok(payload);
});
