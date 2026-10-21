import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handle, clearSessionCookie, clearCartCookie, SESSION_COOKIE } from "@/lib/server/api-helpers";

export const POST = handle(async (req: NextRequest) => {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
  const res = ok({ ok: true });
  clearSessionCookie(res);
  clearCartCookie(res);
  return res;
});
