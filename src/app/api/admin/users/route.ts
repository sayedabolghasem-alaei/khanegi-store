import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, parseIntParam } from "@/lib/server/api-helpers";
import type { AdminUserRowDTO, Role } from "@/lib/types";
import type { Prisma } from "@prisma/client";

// GET /api/admin/users — paginated user list with order aggregates (ADMIN only).
// Query: q (name/phone/email contains), page, pageSize (default 20), status (all|active|blocked).
// Password hashes / sessions / tokens are NEVER selected or returned.
export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["ADMIN"]);

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const status = sp.get("status") ?? "all";
  const page = parseIntParam(sp.get("page"), 1);
  const pageSize = Math.min(parseIntParam(sp.get("pageSize"), 20), 100);

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
    ];
  }
  if (status === "active") where.isActive = true;
  else if (status === "blocked") where.isActive = false;

  // Aggregate order stats in two groupBy passes over Order (single scan each):
  // - all orders → count + last order date
  // - non-cancelled orders → total spent
  const [users, total, allOrders, validOrders] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
    db.user.count({ where }),
    db.order.groupBy({
      by: ["userId"],
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    db.order.groupBy({
      by: ["userId"],
      where: { status: { not: "CANCELLED" } },
      _sum: { totalToman: true },
    }),
  ]);

  const countByUser = new Map(
    allOrders.map((r) => [r.userId, { count: r._count._all, last: r._max.createdAt }])
  );
  const spentByUser = new Map(validOrders.map((r) => [r.userId, r._sum.totalToman ?? 0]));

  const items: AdminUserRowDTO[] = users.map((u) => {
    const stats = countByUser.get(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role as Role,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      ordersCount: stats?.count ?? 0,
      totalSpentToman: spentByUser.get(u.id) ?? 0,
      lastOrderAt: stats?.last ? stats.last.toISOString() : null,
    };
  });

  return ok({ items, total, page, pageSize });
});
