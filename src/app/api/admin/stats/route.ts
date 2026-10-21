import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole } from "@/lib/server/api-helpers";
import type { AdminStats } from "@/lib/types";

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["STAFF", "ADMIN"]);

  const [
    ordersTotal,
    paidAgg,
    pendingOrders,
    customersCount,
    lowStockProducts,
    bestSellers,
    recentOrders,
    recentAudit,
  ] = await Promise.all([
    db.order.count(),
    db.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalToman: true } }),
    db.order.count({ where: { status: "PENDING" } }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.product.findMany({
      where: { isActive: true, deletedAt: null, stock: { lte: 3 } },
      // stock <= lowStockThreshold per product is refined below
      orderBy: { stock: "asc" },
      take: 30,
      select: { id: true, name: true, slug: true, stock: true, lowStockThreshold: true },
    }),
    db.product.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { soldCount: "desc" },
      take: 5,
      select: { id: true, name: true, slug: true, soldCount: true, priceToman: true },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        totalToman: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        actorName: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
      },
    }),
  ]);

  const stats: AdminStats = {
    ordersTotal,
    revenueToman: paidAgg._sum.totalToman ?? 0,
    pendingOrders,
    customersCount,
    lowStock: lowStockProducts
      .filter((p) => p.stock <= p.lowStockThreshold)
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
      })),
    bestSellers: bestSellers.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      soldCount: p.soldCount,
      priceToman: p.priceToman,
    })),
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      totalToman: o.totalToman,
      status: o.status as AdminStats["recentOrders"][number]["status"],
      paymentStatus: o.paymentStatus as AdminStats["recentOrders"][number]["paymentStatus"],
      createdAt: o.createdAt.toISOString(),
    })),
    recentAudit: recentAudit.map((a) => ({
      id: a.id,
      actorName: a.actorName,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  return ok(stats);
});
