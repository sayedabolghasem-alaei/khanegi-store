import { NextRequest } from "next/server";
import { ok, handle } from "@/lib/server/api-helpers";
import { getProductDetail } from "@/lib/server/catalog";

export const GET = handle(
  async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    return ok(await getProductDetail(slug));
  }
);
