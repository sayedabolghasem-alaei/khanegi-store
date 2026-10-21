import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  handle,
  ApiError,
  requireRole,
  audit,
} from "@/lib/server/api-helpers";
import type { AdminUserDetailDTO, AdminUserRowDTO, OrderStatus, PaymentStatus, Role } from "@/lib/types";

// Shared safe-select: passwordHash (and anything session/token related) must
// never leave the server, so every query below names its columns explicitly.
const userSafeSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

function toRow(u: {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}): AdminUserRowDTO {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role as Role,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    ordersCount: 0,
    totalSpentToman: 0,
    lastOrderAt: null,
  };
}

// GET /api/admin/users/[id] — full profile + 10 most recent orders (ADMIN only).
export const GET = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireRole(req, ["ADMIN"]);
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        ...userSafeSelect,
        orders: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            totalToman: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "کاربر مورد نظر یافت نشد.");
    }

    const [allOrders, validOrders] = await Promise.all([
      db.order.aggregate({
        where: { userId: id },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      db.order.aggregate({
        where: { userId: id, status: { not: "CANCELLED" } },
        _sum: { totalToman: true },
      }),
    ]);

    const detail: AdminUserDetailDTO = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role as Role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      ordersCount: allOrders._count._all,
      totalSpentToman: validOrders._sum.totalToman ?? 0,
      lastOrderAt: allOrders._max.createdAt ? allOrders._max.createdAt.toISOString() : null,
      recentOrders: user.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status as OrderStatus,
        paymentStatus: o.paymentStatus as PaymentStatus,
        totalToman: o.totalToman,
        createdAt: o.createdAt.toISOString(),
      })),
    };

    return ok({ user: detail });
  }
);

// PATCH /api/admin/users/[id] — { isActive: boolean } block/unblock (ADMIN only).
// Guards: cannot block yourself; cannot block the last active ADMIN.
export const PATCH = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireRole(req, ["ADMIN"]);
    const { id } = await params;
    const body = z
      .object({ isActive: z.boolean({ error: "مقدار isActive باید بولی باشد." }) })
      .parse(await req.json());

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "کاربر مورد نظر یافت نشد.");
    }

    if (!body.isActive) {
      if (user.id === admin.id) {
        throw new ApiError(409, "SELF_BLOCK", "شما نمی‌توانید حساب کاربری خودتان را مسدود کنید.");
      }
      if (user.role === "ADMIN" && user.isActive) {
        const otherActiveAdmins = await db.user.count({
          where: { role: "ADMIN", isActive: true, id: { not: user.id } },
        });
        if (otherActiveAdmins === 0) {
          throw new ApiError(
            409,
            "LAST_ADMIN",
            "این حساب تنها مدیر فعال سیستم است و امکان مسدودسازی آن وجود ندارد."
          );
        }
      }
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: { isActive: body.isActive },
      select: userSafeSelect,
    });

    await audit(
      { id: admin.id, name: admin.name },
      body.isActive ? "USER_UNBLOCK" : "USER_BLOCK",
      "User",
      user.id,
      { phone: user.phone, name: user.name }
    );

    return ok({ user: toRow(updated) });
  }
);
