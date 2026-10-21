import { db } from "@/lib/db";
import { ok, handle } from "@/lib/server/api-helpers";
import type { ShippingMethodDTO } from "@/lib/types";

export const GET = handle(async () => {
  const methods = await db.shippingMethod.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  const payload: ShippingMethodDTO[] = methods.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    costToman: m.costToman,
    freeThresholdToman: m.freeThresholdToman,
    estimatedDays: m.estimatedDays,
  }));
  return ok(payload);
});
