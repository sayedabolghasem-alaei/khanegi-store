import { NextRequest } from "next/server";
import { ok, handle, requireUser } from "@/lib/server/api-helpers";
import { findOrderByIdOrNumber, requireOrderAccess, toOrderDTO } from "@/lib/server/orders";

export const GET = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser(req);
    const { id } = await params;
    const order = await findOrderByIdOrNumber(id);
    await requireOrderAccess(order, user);
    return ok(toOrderDTO(order!));
  }
);
