// Admin shipping methods — GET lists all (incl. inactive), POST creates.
// ⚠️ Checkout (public /api/shipping/methods + order creation) reads these rows;
// edit carefully and never remove a method referenced by orders (the DELETE
// route refuses with 409 — offer deactivation instead).

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, audit } from "@/lib/server/api-helpers";
import { shippingMethodInputSchema } from "@/lib/server/shipping-admin";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["STAFF", "ADMIN"]);
  const methods = await db.shippingMethod.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return ok({ items: methods });
});

export const POST = handle(async (req: NextRequest) => {
  const admin = await requireRole(req, ["STAFF", "ADMIN"]);
  const body = shippingMethodInputSchema.parse(await req.json());

  const method = await db.shippingMethod.create({
    data: {
      name: body.name,
      description: body.description || null,
      costToman: body.costToman,
      freeThresholdToman: body.freeThresholdToman ?? null,
      estimatedDays: body.estimatedDays || null,
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  });

  await audit({ id: admin.id, name: admin.name }, "SHIPPING_CREATE", "ShippingMethod", method.id, {
    name: method.name,
    costToman: method.costToman,
  });

  return ok({ method }, 201);
});
