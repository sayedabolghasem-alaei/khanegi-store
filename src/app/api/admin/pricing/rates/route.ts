import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, requireRole, ApiError, audit } from "@/lib/server/api-helpers";
import { isRateStale } from "@/lib/server/pricing";
import { rateSetSchema } from "@/lib/validators";
import type { ExchangeRateDTO } from "@/lib/types";

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["STAFF", "ADMIN"]);
  const rates = await db.exchangeRate.findMany({ orderBy: { recordedAt: "desc" } });
  const payload: ExchangeRateDTO[] = rates.map((r) => ({
    id: r.id,
    currency: r.currency,
    rateToman: r.rateToman,
    source: r.source,
    note: r.note,
    isActive: r.isActive,
    recordedAt: r.recordedAt.toISOString(),
    isStale: isRateStale(r.recordedAt),
  }));
  return ok(payload);
});

/** ADMIN only — sets the new active rate for a currency and deactivates the previous one. */
export const POST = handle(async (req: NextRequest) => {
  const admin = await requireRole(req, ["ADMIN"]);
  const body = rateSetSchema.parse(await req.json());

  const rate = await db.$transaction(async (tx) => {
    await tx.exchangeRate.updateMany({
      where: { currency: body.currency, isActive: true },
      data: { isActive: false },
    });
    return tx.exchangeRate.create({
      data: {
        currency: body.currency,
        rateToman: body.rateToman,
        source: "MANUAL",
        note: body.note ?? null,
        isActive: true,
        adminId: admin.id,
      },
    });
  });

  await audit({ id: admin.id, name: admin.name }, "RATE_SET", "ExchangeRate", rate.id, {
    currency: body.currency,
    rateToman: body.rateToman,
    source: "MANUAL",
  });

  const dto: ExchangeRateDTO = {
    id: rate.id,
    currency: rate.currency,
    rateToman: rate.rateToman,
    source: rate.source,
    note: rate.note,
    isActive: rate.isActive,
    recordedAt: rate.recordedAt.toISOString(),
    isStale: isRateStale(rate.recordedAt),
  };
  return ok(dto, 201);
});
