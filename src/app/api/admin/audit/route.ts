import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, audit, parseIntParam } from "@/lib/server/api-helpers";

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["STAFF", "ADMIN"]);
  const sp = req.nextUrl.searchParams;
  const page = parseIntParam(sp.get("page"), 1);
  const limit = Math.min(100, parseIntParam(sp.get("limit"), 20));

  const [total, logs] = await Promise.all([
    db.auditLog.count(),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        actorName: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
      },
    }),
  ]);

  return ok({
    items: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
    total,
    page,
    pageSize: limit,
  });
});
