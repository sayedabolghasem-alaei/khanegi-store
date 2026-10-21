import { NextRequest } from "next/server";
import { ok, handle, getSessionUser } from "@/lib/server/api-helpers";

export const GET = handle(async (req: NextRequest) => {
  const user = await getSessionUser(req);
  if (!user) return ok({ user: null });
  return ok({
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  });
});
