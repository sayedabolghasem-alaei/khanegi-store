import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, parseIntParam } from "@/lib/server/api-helpers";
import type { InventoryMovementRow, ListResponse } from "@/lib/types";

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["STAFF", "ADMIN"]);
  const sp = req.nextUrl.searchParams;
  const productId = sp.get("productId") ?? undefined;
  const page = parseIntParam(sp.get("page"), 1);
  const pageSize = Math.min(100, parseIntParam(sp.get("pageSize"), 20));

  const [total, movements] = await Promise.all([
    db.inventoryMovement.count({ where: productId ? { productId } : {} }),
    db.inventoryMovement.findMany({
      where: productId ? { productId } : {},
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { product: { select: { name: true, slug: true } } },
    }),
  ]);

  const items: InventoryMovementRow[] = movements.map((m) => ({
    id: m.id,
    productName: m.product.name,
    productSlug: m.product.slug,
    type: m.type as "IN" | "OUT" | "ADJUSTMENT",
    quantity: m.quantity,
    reason: m.reason,
    refOrderNumber: m.refOrderNumber,
    createdAt: m.createdAt.toISOString(),
  }));

  const payload: ListResponse<InventoryMovementRow> = { items, total, page, pageSize };
  return ok(payload);
});
