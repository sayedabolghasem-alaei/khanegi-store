import { NextRequest } from "next/server";
import { ok, handle, requireRole } from "@/lib/server/api-helpers";
import { buildAdminReports } from "@/lib/server/reports";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month
 * → { from, to, granularity, summary, series, topProducts, lowStock }
 * from/to optional (default: last 30 days incl. today); money = integer Toman.
 */
export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["STAFF", "ADMIN"]);

  const payload = await buildAdminReports({
    from: req.nextUrl.searchParams.get("from"),
    to: req.nextUrl.searchParams.get("to"),
    granularity: req.nextUrl.searchParams.get("granularity"),
  });

  return ok(payload);
});
