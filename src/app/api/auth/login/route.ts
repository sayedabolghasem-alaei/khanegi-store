import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  ok,
  handle,
  ApiError,
  verifyPassword,
  hashPassword,
  createSession,
  setSessionCookie,
  clearCartCookie,
  getCartToken,
  randomToken,
  rateLimit,
  clientIp,
  normalizeDigits,
} from "@/lib/server/api-helpers";
import { isSupabaseAuthEnabled, getSupabaseAnon } from "@/lib/server/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User as LocalUser } from "@prisma/client";
import { MAX_QTY_PER_LINE } from "@/lib/constants";
import { loginSchema } from "@/lib/validators";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ADMIN_EMAILS bootstrap (see docs/supabase-setup.md — «بوت‌استرپ مدیر»).
 * When a NEW local User row is provisioned (e.g. the first login of a
 * dashboard-invited identity) and its email appears in the comma-separated
 * ADMIN_EMAILS env var, the row is created with role ADMIN instead of
 * CUSTOMER — so the very first admin can come up without touching the DB.
 * Read server-side only; the env contents are never included in any response.
 */
function isAdminEmailBootstrap(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return false;
  const list = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/**
 * Ensures a local User row exists for a Supabase-authenticated identity.
 * Covers accounts provisioned directly in the Supabase dashboard (invite) that
 * have no local row yet: the row is created with the default CUSTOMER role.
 * NOTE: the User model has no supabaseUserId column — the local row is the app
 * profile, resolved against Supabase by its unique email. Phone is a required
 * unique column, so dashboard-invited users get the deterministic placeholder
 * `sb:<supabase-user-id>`; it is never used for local phone login.
 * The password just verified is stored as a normal local scrypt hash so the
 * account also works through the local fallback path afterwards.
 */
async function ensureLocalUserForSupabaseIdentity(sbUser: SupabaseUser, email: string, password: string): Promise<LocalUser> {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;

  const meta = (sbUser.user_metadata ?? {}) as Record<string, unknown>;
  const metaName =
    typeof meta.full_name === "string" && meta.full_name.trim()
      ? meta.full_name.trim()
      : typeof meta.name === "string" && meta.name.trim()
        ? meta.name.trim()
        : email.split("@")[0] || "کاربر";

  try {
    return await db.user.create({
      data: {
        name: metaName,
        phone: `sb:${sbUser.id}`,
        email,
        passwordHash: hashPassword(password),
        // ADMIN_EMAILS bootstrap — ADMIN instead of CUSTOMER for listed emails.
        role: isAdminEmailBootstrap(email) ? "ADMIN" : "CUSTOMER",
      },
    });
  } catch (e) {
    // Unique race (concurrent first login) → re-read instead of failing the login.
    const again = await db.user.findUnique({ where: { email } });
    if (again) return again;
    console.error("[supabase] failed to create local profile for", email, e);
    throw e;
  }
}

export const POST = handle(async (req: NextRequest) => {
  rateLimit(clientIp(req) + ":auth", 20, 60000);

  const body = loginSchema.parse(await req.json());
  const identifier = normalizeDigits(body.phone.trim());
  const looksLikeEmail = EMAIL_RE.test(identifier);

  // Local lookup by phone — exactly as before. In Supabase mode only, an email
  // typed into the login field is also accepted (covers accounts invited via
  // the Supabase dashboard that exist locally or not at all).
  let user: LocalUser | null = await db.user.findUnique({ where: { phone: identifier } });
  if (!user && isSupabaseAuthEnabled() && looksLikeEmail) {
    user = await db.user.findUnique({ where: { email: identifier.toLowerCase() } });
  }

  // ── Supabase Auth (cloud identity) — only when configured and an email is
  // derivable. On failure we FALL THROUGH to the local scrypt check below, so
  // pre-migration local accounts keep working. Supabase access/refresh tokens
  // are never returned to the client: the app session stays the local httpOnly
  // `aria_session` cookie.
  let supabaseOk = false;
  const supabaseEnabled = isSupabaseAuthEnabled();
  const supabaseEmail = user?.email ?? (supabaseEnabled && looksLikeEmail ? identifier.toLowerCase() : null);
  if (supabaseEnabled && supabaseEmail) {
    try {
      const { data, error } = await getSupabaseAnon().auth.signInWithPassword({
        email: supabaseEmail,
        password: body.password,
      });
      if (!error && data.user) {
        supabaseOk = true;
        user = await ensureLocalUserForSupabaseIdentity(data.user, supabaseEmail, body.password);
        if (!user.isActive) {
          // Locally deactivated account must not log in, even with valid Supabase credentials.
          throw new ApiError(
            401,
            "BAD_CREDENTIALS",
            looksLikeEmail ? "ایمیل یا رمز عبور اشتباه است." : "شماره موبایل یا رمز عبور اشتباه است."
          );
        }
      } else if (error) {
        // Invalid credentials / banned user etc. → local fallback decides below.
        console.error("[supabase] signInWithPassword failed:", { code: error.code, status: error.status });
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
      // SDK/network failure → degrade gracefully to local auth instead of erroring out.
      console.error("[supabase] signInWithPassword threw, falling back to local auth:", e);
    }
  }

  if (!supabaseOk) {
    if (!user || !user.isActive || !verifyPassword(body.password, user.passwordHash)) {
      throw new ApiError(
        401,
        "BAD_CREDENTIALS",
        supabaseEnabled && looksLikeEmail
          ? "ایمیل یا رمز عبور اشتباه است."
          : "شماره موبایل یا رمز عبور اشتباه است."
      );
    }
  }
  if (!user) {
    // Unreachable safety net — both paths above guarantee a user.
    throw new ApiError(401, "BAD_CREDENTIALS", "شماره موبایل یا رمز عبور اشتباه است.");
  }

  // ── Guest-cart merge (sum quantities, cap at MAX_QTY_PER_LINE, never exceed stock) ──
  const guestToken = getCartToken(req);
  const guestCart = guestToken
    ? await db.cart.findUnique({ where: { token: guestToken }, include: { items: true } })
    : null;

  let userCart = await db.cart.findUnique({ where: { userId: user.id } });
  if (!userCart) {
    if (guestCart && guestCart.userId === null) {
      // Adopt the guest cart wholesale.
      userCart = await db.cart.update({ where: { id: guestCart.id }, data: { userId: user.id } });
    } else {
      userCart = await db.cart.create({ data: { userId: user.id, token: randomToken() } });
    }
  } else if (guestCart && guestCart.userId === null && guestCart.id !== userCart.id) {
    // Merge item-level into the existing user cart.
    for (const gi of guestCart.items) {
      const product = await db.product.findUnique({ where: { id: gi.productId } });
      if (!product || !product.isActive || product.stock <= 0) continue; // drop dead lines
      const existing = await db.cartItem.findFirst({
        where: { cartId: userCart.id, productId: gi.productId, variantId: gi.variantId },
      });
      const merged = Math.min(
        (existing?.quantity ?? 0) + gi.quantity,
        MAX_QTY_PER_LINE,
        product.stock
      );
      if (existing) {
        await db.cartItem.update({ where: { id: existing.id }, data: { quantity: merged } });
      } else if (merged > 0) {
        await db.cartItem.create({
          data: { cartId: userCart.id, productId: gi.productId, variantId: gi.variantId, quantity: merged },
        });
      }
    }
    await db.cart.delete({ where: { id: guestCart.id } }).catch(() => undefined);
  }

  const session = await createSession(user.id);
  const res = ok({
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  });
  setSessionCookie(res, session.token);
  clearCartCookie(res); // user cart is now keyed by userId
  return res;
});
