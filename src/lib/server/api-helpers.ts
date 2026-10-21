// Server-side API helpers: JSON responses, auth/session, authorization,
// password hashing (scrypt — zero external deps), audit logging, rate limiting.
// BACKEND-ONLY — never import from client components.

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import type { Role } from "@/lib/types";
import type { Cart } from "@prisma/client";

export const SESSION_COOKIE = "aria_session";
export const CART_COOKIE = "aria_cart";
const SESSION_TTL_DAYS = 30;
const CART_TTL_DAYS = 90;

// ─── JSON helpers ───────────────────────────────────────────────────────────

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Wrap a route handler: converts ApiError/ZodError/uncaught to clean JSON. */
export function handle<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: err.status }
        );
      }
      const zodErr = err as { name?: string; issues?: { message: string }[] };
      if (zodErr?.name === "ZodError" && Array.isArray(zodErr.issues)) {
        const msg = zodErr.issues[0]?.message || "داده‌های ورودی نامعتبر است.";
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: msg } },
          { status: 400 }
        );
      }
      console.error("[api] unhandled error:", err);
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "خطای غیرمنتظره در سرور رخ داد. لطفاً دوباره تلاش کنید." } },
        { status: 500 }
      );
    }
  };
}

// ─── Password hashing (node:crypto scrypt) ──────────────────────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, salt, hash] = stored.split("$");
    if (algo !== "scrypt" || !salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

// ─── Tokens ─────────────────────────────────────────────────────────────────

export function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function cookieOptions(maxAgeDays: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeDays * 24 * 60 * 60,
  };
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_DAYS));
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(SESSION_TTL_DAYS), maxAge: 0 });
}

export async function getSessionUser(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (!session.user.isActive) return null;
  return session.user;
}

export async function requireUser(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "برای این عملیات باید وارد حساب کاربری شوید.");
  return user;
}

export async function requireRole(req: NextRequest, roles: readonly Role[]) {
  const user = await requireUser(req);
  if (!roles.includes(user.role as Role)) {
    throw new ApiError(403, "FORBIDDEN", "شما مجوز دسترسی به این بخش را ندارید.");
  }
  return user;
}

// ─── Cart token (guest carts) ───────────────────────────────────────────────

export function getCartToken(req: NextRequest): string | null {
  return req.cookies.get(CART_COOKIE)?.value ?? null;
}

/** Ensures a cart row exists and returns {cart, newToken} — caller attaches cookie if newToken is set. */
export async function ensureCart(
  req: NextRequest,
  userId?: string
): Promise<{ cart: Cart; newToken: string | null }> {
  const existingToken = getCartToken(req);
  if (userId) {
    // logged-in: prefer the user cart, merge target
    const existing = await db.cart.findUnique({ where: { userId } });
    if (existing) return { cart: existing, newToken: null };
    if (existingToken) {
      const guest = await db.cart.findUnique({ where: { token: existingToken } });
      if (guest) {
        const merged = await db.cart.update({ where: { id: guest.id }, data: { userId } });
        return { cart: merged, newToken: null };
      }
    }
    const created = await db.cart.create({ data: { userId, token: randomToken() } });
    return { cart: created, newToken: null };
  }
  // guest
  if (existingToken) {
    const guest = await db.cart.findUnique({ where: { token: existingToken } });
    if (guest) return { cart: guest, newToken: null };
  }
  const token = randomToken();
  const cart = await db.cart.create({ data: { token } });
  return { cart, newToken: token };
}

export function setCartCookie(res: NextResponse, token: string) {
  res.cookies.set(CART_COOKIE, token, cookieOptions(CART_TTL_DAYS));
}

export function clearCartCookie(res: NextResponse) {
  res.cookies.set(CART_COOKIE, "", { ...cookieOptions(CART_TTL_DAYS), maxAge: 0 });
}

// ─── Audit log ──────────────────────────────────────────────────────────────

export async function audit(
  actor: { id?: string | null; name?: string | null } | null,
  action: string,
  entity: string,
  entityId?: string | null,
  detail?: unknown
) {
  try {
    await db.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? "مهمان",
        action,
        entity,
        entityId: entityId ?? null,
        detail: detail === undefined ? null : JSON.stringify(detail),
      },
    });
  } catch (e) {
    console.error("[audit] failed:", e);
  }
}

// ─── Simple in-memory rate limiter (sensitive public endpoints) ─────────────

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
  if (b.count > limit) {
    throw new ApiError(429, "RATE_LIMITED", "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.");
  }
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

// ─── Misc ───────────────────────────────────────────────────────────────────

export function parseIntParam(v: string | null, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

/** Normalize Persian/Arabic digits to latin and trim. */
export function normalizeDigits(v: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return v.replace(/[۰-۹٠-٩]/g, (d) => String(Math.max(fa.indexOf(d), ar.indexOf(d)))).trim();
}

export function isValidIranMobile(p: string): boolean {
  return /^09\d{9}$/.test(p);
}
