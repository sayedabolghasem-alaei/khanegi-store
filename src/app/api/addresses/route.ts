import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireUser } from "@/lib/server/api-helpers";
import { addressCreateSchema } from "@/lib/validators";
import type { AddressDTO } from "@/lib/types";

function toAddressDTO(a: {
  id: string;
  title: string;
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  line: string;
  isDefault: boolean;
}): AddressDTO {
  return {
    id: a.id,
    title: a.title,
    receiverName: a.receiverName,
    phone: a.phone,
    province: a.province,
    city: a.city,
    postalCode: a.postalCode,
    line: a.line,
    isDefault: a.isDefault,
  };
}

export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const addresses = await db.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return ok(addresses.map(toAddressDTO));
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const body = addressCreateSchema.parse(await req.json());

  const count = await db.address.count({ where: { userId: user.id } });
  const isDefault = body.isDefault ?? count === 0;

  if (isDefault) {
    await db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }

  const address = await db.address.create({
    data: {
      userId: user.id,
      title: body.title,
      receiverName: body.receiverName,
      phone: body.phone,
      province: body.province,
      city: body.city,
      postalCode: body.postalCode,
      line: body.line,
      isDefault,
    },
  });

  return ok(toAddressDTO(address), 201);
});
