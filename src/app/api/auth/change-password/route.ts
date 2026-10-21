import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  ok,
  handle,
  ApiError,
  requireUser,
  hashPassword,
  verifyPassword,
  audit,
} from "@/lib/server/api-helpers";
import {
  isSupabaseAuthEnabled,
  getSupabaseAdmin,
  findSupabaseUserIdByEmail,
  supabaseErrorToApiError,
} from "@/lib/server/supabase";
import { changePasswordSchema } from "@/lib/validators";

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const body = changePasswordSchema.parse(await req.json());

  if (!verifyPassword(body.currentPassword, user.passwordHash)) {
    throw new ApiError(400, "WRONG_PASSWORD", "رمز عبور فعلی اشتباه است.");
  }

  // ── Supabase sync (only when configured and the account carries a cloud
  // identity, i.e. an email). Runs BEFORE the local update so a provider
  // failure leaves both sides consistent and the user can simply retry.
  if (isSupabaseAuthEnabled() && user.email) {
    const sbUserId = await findSupabaseUserIdByEmail(user.email);
    if (sbUserId) {
      const { error } = await getSupabaseAdmin().auth.admin.updateUserById(sbUserId, {
        password: body.newPassword,
      });
      if (error) throw supabaseErrorToApiError("updateUserById", error);
    }
    // Not found in Supabase (e.g. phone-only/local-only account) → local update only.
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(body.newPassword) },
  });

  await audit({ id: user.id, name: user.name }, "PASSWORD_CHANGE", "User", user.id);
  return ok({ ok: true });
});
