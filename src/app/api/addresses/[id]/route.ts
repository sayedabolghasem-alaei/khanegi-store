import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, ApiError, requireUser } from "@/lib/server/api-helpers";
import { addressPatchSchema } from "@/lib/validators";
import type { AddressDTO } from "@/lib/types";

export const PATCH = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser(req);
    const { id } = await params;

    const address = await db.address.findUnique({ where: { id } });
    if (!address || address.userId !== user.id) {
      throw new ApiError(404, "ADDRESS_NOT_FOUND", "آدرس مورد نظر یافت نشد.");
    }

    const body = addressPatchSchema.parse(await req.json());

    if (body.isDefault) {
      await db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    }

    const updated = await db.address.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.receiverName !== undefined ? { receiverName: body.receiverName } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.province !== undefined ? { province: body.province } : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.postalCode !== undefined ? { postalCode: body.postalCode } : {}),
        ...(body.line !== undefined ? { line: body.line } : {}),
        ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
      },
    });

    const dto: AddressDTO = {
      id: updated.id,
      title: updated.title,
      receiverName: updated.receiverName,
      phone: updated.phone,
      province: updated.province,
      city: updated.city,
      postalCode: updated.postalCode,
      line: updated.line,
      isDefault: updated.isDefault,
    };
    return ok(dto);
  }
);

export const DELETE = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser(req);
    const { id } = await params;

    const address = await db.address.findUnique({ where: { id } });
    if (!address || address.userId !== user.id) {
      throw new ApiError(404, "ADDRESS_NOT_FOUND", "آدرس مورد نظر یافت نشد.");
    }

    await db.address.delete({ where: { id } });
    return ok({ ok: true });
  }
);
