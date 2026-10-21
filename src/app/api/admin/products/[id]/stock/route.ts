import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, ApiError, audit } from "@/lib/server/api-helpers";
import { stockMovementSchema } from "@/lib/validators";

export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireRole(req, ["STAFF", "ADMIN"]);
    const { id } = await params;

    const product = await db.product.findUnique({ where: { id } });
    if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "محصول مورد نظر یافت نشد.");

    const body = stockMovementSchema.parse(await req.json());

    const { stock, movement } = await db.$transaction(async (tx) => {
      let newStock: number;
      let movedQty: number;

      if (body.type === "IN") {
        newStock = product.stock + body.quantity;
        movedQty = body.quantity;
        await tx.product.update({ where: { id }, data: { stock: { increment: body.quantity } } });
      } else if (body.type === "OUT") {
        const upd = await tx.product.updateMany({
          where: { id, stock: { gte: body.quantity } },
          data: { stock: { decrement: body.quantity } },
        });
        if (upd.count === 0) {
          throw new ApiError(409, "INSUFFICIENT_STOCK", `موجودی «${product.name}» برای خارج کردن ${body.quantity} عدد کافی نیست.`);
        }
        newStock = product.stock - body.quantity;
        movedQty = body.quantity;
      } else {
        // ADJUSTMENT: `quantity` is the new absolute stock level (correction).
        newStock = body.quantity;
        movedQty = Math.abs(body.quantity - product.stock);
        await tx.product.update({ where: { id }, data: { stock: body.quantity } });
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          productId: id,
          type: body.type,
          quantity: movedQty,
          reason: body.reason,
          adminId: admin.id,
        },
      });

      return { stock: newStock, movement };
    });

    await audit({ id: admin.id, name: admin.name }, "STOCK_ADJUST", "Product", id, {
      type: body.type,
      quantity: body.quantity,
      reason: body.reason,
      newStock: stock,
    });

    return ok({
      stock,
      movement: {
        id: movement.id,
        productName: product.name,
        productSlug: product.slug,
        type: movement.type as "IN" | "OUT" | "ADJUSTMENT",
        quantity: movement.quantity,
        reason: movement.reason,
        refOrderNumber: movement.refOrderNumber,
        createdAt: movement.createdAt.toISOString(),
      },
    });
  }
);
