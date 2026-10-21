// Admin bulk product operations — activate/deactivate via updateMany.
// Soft-deleted rows are never resurrected here (deletedAt is not touched).

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handle, requireRole, audit, ApiError } from "@/lib/server/api-helpers";

export const dynamic = "force-dynamic";

const bulkSchema = z.object({
  ids: z
    .array(z.string().min(1, "شناسه محصول نامعتبر است."))
    .min(1, "حداقل یک محصول را انتخاب کنید.")
    .max(200, "حداکثر ۲۰۰ محصول در هر عملیات گروهی قابل انتخاب است."),
  action: z.enum(["activate", "deactivate"], { message: "عملیات گروهی نامعتبر است." }),
});

export const POST = handle(async (req: NextRequest) => {
  const admin = await requireRole(req, ["ADMIN"]);
  const body = bulkSchema.parse(await req.json());

  const uniqueIds = [...new Set(body.ids)];

  const result = await db.product.updateMany({
    where: { id: { in: uniqueIds }, deletedAt: null },
    data: { isActive: body.action === "activate" },
  });

  await audit({ id: admin.id, name: admin.name }, "PRODUCTS_BULK", "Product", null, {
    action: body.action,
    requested: uniqueIds.length,
    updated: result.count,
  });

  if (result.count === 0) {
    throw new ApiError(404, "PRODUCTS_NOT_FOUND", "هیچ محصولی برای این عملیات یافت نشد.");
  }

  return ok({ updated: result.count, action: body.action });
});
