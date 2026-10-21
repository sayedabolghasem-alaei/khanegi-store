import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handle, ApiError, requireRole, audit } from "@/lib/server/api-helpers";
import { ROLES } from "@/lib/constants";
import type { AdminUserRowDTO, Role } from "@/lib/types";

// POST /api/admin/users/[id]/role — change a user's role (ADMIN only; STAFF
// must never be able to change roles — enforced here via the ADMIN-only guard).
// Server-enforced guards (Persian errors): cannot change your own role, cannot
// demote the last active ADMIN, role must be a valid one.
const roleSchema = z.object({
  role: z.enum(ROLES, { error: "نقش انتخاب‌شده معتبر نیست." }),
});

const userSafeSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireRole(req, ["ADMIN"]);
    const { id } = await params;
    const body = roleSchema.parse(await req.json());

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "کاربر مورد نظر یافت نشد.");
    }

    if (user.id === admin.id) {
      throw new ApiError(409, "SELF_ROLE_CHANGE", "تغییر نقش حساب کاربری خودتان مجاز نیست.");
    }

    if (user.role === "ADMIN" && body.role !== "ADMIN") {
      const otherActiveAdmins = await db.user.count({
        where: { role: "ADMIN", isActive: true, id: { not: user.id } },
      });
      if (otherActiveAdmins === 0) {
        throw new ApiError(
          409,
          "LAST_ADMIN",
          "این حساب تنها مدیر فعال سیستم است و امکان تنزل نقش آن وجود ندارد."
        );
      }
    }

    // Idempotent no-op: same role requested → nothing changes, no audit noise.
    if (user.role === body.role) {
      const current = await db.user.findUnique({
        where: { id: user.id },
        select: userSafeSelect,
      });
      return ok({
        user: {
          ...(current ?? {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            isActive: user.isActive,
          }),
          role: user.role as Role,
          createdAt: user.createdAt.toISOString(),
        },
      });
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: { role: body.role },
      select: userSafeSelect,
    });

    await audit(
      { id: admin.id, name: admin.name },
      "USER_ROLE_CHANGE",
      "User",
      user.id,
      { from: user.role, to: body.role, phone: user.phone, name: user.name }
    );

    const row: AdminUserRowDTO = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role as Role,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      ordersCount: 0,
      totalSpentToman: 0,
      lastOrderAt: null,
    };
    return ok({ user: row });
  }
);
