// ─────────────────────────────────────────────────────────────────────────────
// SERVER ONLY — Supabase Auth integration for «خانه‌گی».
//
// Never import this module from client components ("use client"). The
// service-role key must NEVER reach the browser; this file is only imported by
// API route handlers (src/app/api/auth/**), which always run server-side.
//
// When the three env vars below are absent (sandbox default), everything falls
// back to the local scrypt password auth (src/lib/server/api-helpers.ts) and the
// app behaves exactly as before — no network calls, no Supabase dependency.
//
// Required env vars (ALL three must be set to enable Supabase mode):
//   SUPABASE_URL                e.g. https://<project-ref>.supabase.co
//   SUPABASE_ANON_KEY           anon / publishable key (password sign-in only)
//   SUPABASE_SERVICE_ROLE_KEY   service_role key (admin API — server only!)
//
// Note on identity mapping: the local User model has no supabaseUserId column
// (schema is owned by another task; no db push performed here). The local User
// row is the app profile and is resolved against Supabase by its unique email.
// Phone-only accounts (no email) stay local-only; Supabase identity is the
// email/password cloud identity.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient, type AuthError } from "@supabase/supabase-js";
import { ApiError } from "@/lib/server/api-helpers";

// ─── Enablement flag (memoized per process) ─────────────────────────────────

let memoizedEnabled: boolean | null = null;

/** True iff all three Supabase env vars are set. Evaluated once per process. */
export function isSupabaseAuthEnabled(): boolean {
  if (memoizedEnabled === null) {
    memoizedEnabled = Boolean(
      process.env.SUPABASE_URL &&
        process.env.SUPABASE_ANON_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return memoizedEnabled;
}

// ─── Lazy clients ────────────────────────────────────────────────────────────

let anonClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    // Internal guard only — this must never happen when isSupabaseAuthEnabled() is checked first.
    throw new Error(`Missing Supabase env var: ${name}`);
  }
  return v;
}

/** Anon-key client for password sign-in (`auth.signInWithPassword`). Server-side only. */
export function getSupabaseAnon(): SupabaseClient {
  if (!isSupabaseAuthEnabled()) {
    throw new Error("Supabase auth is not configured.");
  }
  if (!anonClient) {
    anonClient = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return anonClient;
}

/** Service-role client for admin APIs (`auth.admin.*`). Bypasses RLS — server side only. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseAuthEnabled()) {
    throw new Error("Supabase auth is not configured.");
  }
  if (!adminClient) {
    adminClient = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return adminClient;
}

// ─── Error mapping (Persian, project-standard ApiError) ─────────────────────

function isAuthError(err: unknown): err is AuthError {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: unknown }).name === "AuthError"
  );
}

/**
 * Converts a Supabase Auth error into the project's standard ApiError with a
 * Persian, user-displayable message. SDK internals/keys are never included in
 * the thrown error — details are logged server-side only.
 */
export function supabaseErrorToApiError(scope: string, err: unknown): ApiError {
  const code = isAuthError(err) ? (err.code ?? "") : "";
  const status = isAuthError(err) ? (err.status ?? 0) : 0;
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[supabase] ${scope} failed:`, { code, status, message });

  if (code === "email_exists" || code === "user_already_exists" || code === "already_registered") {
    return new ApiError(409, "EMAIL_EXISTS", "این ایمیل قبلاً ثبت شده است.");
  }
  if (code === "weak_password" || code === "password_too_short" || code === "password_too_weak") {
    return new ApiError(400, "WEAK_PASSWORD", "رمز عبور بیش از حد ساده است. رمز قوی‌تری انتخاب کنید.");
  }
  if (code === "invalid_credentials" || code === "user_banned") {
    return new ApiError(401, "BAD_CREDENTIALS", "ایمیل یا رمز عبور اشتباه است.");
  }
  if (code === "user_not_found") {
    return new ApiError(404, "USER_NOT_FOUND", "حساب کاربری با این ایمیل یافت نشد.");
  }
  if (code === "over_email_send_rate_limit" || code === "request_timeout" || status === 429) {
    return new ApiError(
      429,
      "RATE_LIMITED",
      "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید."
    );
  }
  if (code === "validation_failed" || code === "invalid_email") {
    return new ApiError(400, "VALIDATION_ERROR", "داده‌های ورودی نامعتبر است.");
  }
  // Unknown provider failure — generic Persian message, internals stay in server logs.
  return new ApiError(
    502,
    "AUTH_PROVIDER_ERROR",
    "خطا در سرویس احراز هویت رخ داد. لطفاً دوباره تلاش کنید."
  );
}

// ─── Admin helpers ───────────────────────────────────────────────────────────

/**
 * Finds a Supabase auth user by email via the admin API (paginated listUsers;
 * there is no direct admin lookup-by-email in supabase-js). Returns the user
 * id, or null when not found / not configured.
 */
export async function findSupabaseUserIdByEmail(email: string): Promise<string | null> {
  if (!isSupabaseAuthEnabled()) return null;
  const admin = getSupabaseAdmin();
  const target = email.trim().toLowerCase();
  const perPage = 200;
  // Safety cap: 20 pages × 200 = 4000 users per lookup; enough for this storefront.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw supabaseErrorToApiError("listUsers", error);
    const hit = data.users.find(
      (u) => typeof u.email === "string" && u.email.trim().toLowerCase() === target
    );
    if (hit) return hit.id;
    if (data.users.length < perPage) break;
  }
  return null;
}
