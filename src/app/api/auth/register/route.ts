import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  ok,
  handle,
  ApiError,
  hashPassword,
  createSession,
  setSessionCookie,
  ensureCart,
  rateLimit,
  clientIp,
  normalizeDigits,
} from "@/lib/server/api-helpers";
import {
  isSupabaseAuthEnabled,
  getSupabaseAdmin,
  supabaseErrorToApiError,
} from "@/lib/server/supabase";
import { registerSchema } from "@/lib/validators";

/**
 * ADMIN_EMAILS bootstrap (see docs/supabase-setup.md — «بوت‌استرپ مدیر»):
 * a new local User row whose (lowercased) email appears in the comma-separated
 * ADMIN_EMAILS env var is provisioned with role ADMIN instead of CUSTOMER —
 * the first admin account can bootstrap itself without touching the DB.
 * Read server-side only; the env contents are never included in any response.
 */
const adminEmailsBootstrap = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function resolveRoleForNewUser(email: string | null): "CUSTOMER" | "ADMIN" {
  if (email && adminEmailsBootstrap.includes(email.trim().toLowerCase())) {
    return "ADMIN";
  }
  return "CUSTOMER";
}

export const POST = handle(async (req: NextRequest) => {
  rateLimit(clientIp(req) + ":auth", 20, 60000);

  const body = registerSchema.parse(await req.json());
  const phone = normalizeDigits(body.phone);

  const existingPhone = await db.user.findUnique({ where: { phone } });
  if (existingPhone) {
    throw new ApiError(409, "PHONE_EXISTS", "این شماره موبایل قبلاً ثبت شده است. وارد شوید یا شماره دیگری را امتحان کنید.");
  }
  if (body.email) {
    const existingEmail = await db.user.findUnique({ where: { email: body.email } });
    if (existingEmail) {
      throw new ApiError(409, "EMAIL_EXISTS", "این ایمیل قبلاً ثبت شده است.");
    }
  }

  // ── Supabase cloud identity (only when configured AND an email was provided).
  // Phone-only registrations stay local-only: Supabase email/password is the
  // cloud identity and a phone number alone cannot represent it there.
  // NOTE: the User model has no supabaseUserId column (schema owned by another
  // task; no db push here) — the local row below is the app profile, resolved
  // against Supabase by its unique email.
  let supabaseUserId: string | null = null;
  if (body.email && isSupabaseAuthEnabled()) {
    const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    });
    if (error) throw supabaseErrorToApiError("createUser", error);
    supabaseUserId = data.user?.id ?? null;
  }

  let user;
  try {
    user = await db.user.create({
      data: {
        name: body.name,
        phone,
        email: body.email ?? null,
        passwordHash: hashPassword(body.password),
        // ADMIN_EMAILS bootstrap — ADMIN instead of CUSTOMER for listed emails.
        role: resolveRoleForNewUser(body.email ?? null),
      },
    });
  } catch (err) {
    // Local row failed after the Supabase user was created → best-effort cleanup
    // so no orphan cloud identity is left behind, then rethrow (handle() maps it).
    if (supabaseUserId) {
      await getSupabaseAdmin()
        .auth.admin.deleteUser(supabaseUserId)
        .catch((e: unknown) => console.error("[supabase] orphan cleanup failed:", e));
    }
    throw err;
  }

  // Adopt the guest cart (if any) as this user's cart.
  await ensureCart(req, user.id);

  const session = await createSession(user.id);
  const res = ok(
    {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
    },
    201
  );
  setSessionCookie(res, session.token);
  return res;
});
