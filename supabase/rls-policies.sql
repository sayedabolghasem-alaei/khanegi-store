-- ═════════════════════════════════════════════════════════════════════════════
-- آریا خانه (Aria Khaneh) — Row Level Security policies for Supabase
-- ═════════════════════════════════════════════════════════════════════════════
-- DEFENSE-IN-DEPTH ONLY — read this first.
--
-- This application NEVER touches the database from the browser. Every query
-- flows through Next.js API routes (src/app/api/**) using server-side Prisma
-- over the postgres connection string. That connection authenticates as the
-- `postgres` user, which OWNS these tables — and PostgreSQL does not apply
-- RLS to the table owner (unless FORCE ROW LEVEL SECURITY is used, which we
-- deliberately do NOT do here). Supabase's `service_role` key also bypasses
-- RLS (BYPASSRLS attribute). Result: the app keeps working unchanged.
--
-- These policies exist to protect the project IF the Supabase Data API
-- (PostgREST) is ever exposed with the anon key, or if someone connects
-- directly with the anon/authenticated roles. In that scenario:
--   • anon            → read-only access to the public catalog (what the
--                       storefront publishes anyway) and NOTHING else.
--   • authenticated   → catalog read + strictly their own cart / wishlist /
--                       address / order rows.
--   • everything else → zero rows. No policy = no access for those roles;
--                       only the service role can read/write admin data.
--
-- This matches the app architecture exactly: authorization for admin and
-- pricing surfaces is enforced server-side (requireRole in API routes); the
-- client never receives DB credentials beyond, at most, a public anon key.
--
-- NOTES
--   • Run AFTER supabase/migration.sql (tables must exist) in the Supabase
--     SQL Editor or via psql. Requires Supabase (uses auth.uid() from the
--     auth schema — this file will not run on plain PostgreSQL).
--   • Safe to re-run: every policy is DROP POLICY IF EXISTS + CREATE.
--   • Primary keys / FK columns are TEXT (Prisma cuid() strings), so
--     auth.uid() (uuid) is cast with ::text for comparison.
--   • Parent-child ownership (CartItem→Cart, WishlistItem→Wishlist,
--     OrderItem/Payment→Order) is checked through SECURITY DEFINER helper
--     functions. They run as the function owner and bypass RLS inside,
--     which (a) avoids nested-RLS dependency on the parent table's own
--     policies and (b) prevents recursive-policy evaluation issues.
--   • NEVER run `ALTER TABLE ... FORCE ROW LEVEL SECURITY` on these tables:
--     that would subject the postgres owner (i.e. Prisma) to the policies
--     and break the application.
--   • Guest carts (Cart."userId" IS NULL, identified by the aria_cart cookie
--     token) are intentionally invisible to anon/authenticated roles — they
--     are managed exclusively by the server (service role).
-- ═════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────── 1) Enable RLS everywhere ───────────────────────
-- No table is left without RLS: default-deny is the whole point. Enabling RLS
-- with no policies makes a table fully invisible to anon/authenticated roles
-- while the service connection (table owner) keeps full access.

ALTER TABLE public."User"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Category"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Brand"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Product"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProductImage"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProductVariant"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProductReview"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PriceHistory"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ExchangeRate"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PricingRule"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Wishlist"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WishlistItem"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Cart"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CartItem"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Address"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Order"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderItem"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderStatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Coupon"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CouponRedemption"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ShippingMethod"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InventoryMovement"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SiteSettings"       ENABLE ROW LEVEL SECURITY;


-- ──────────────────────── 2) Ownership helper functions ─────────────────────
-- SECURITY DEFINER + stable: evaluated per row, run as owner (bypasses RLS on
-- the parent table), and only return a boolean — they leak no parent data.

CREATE OR REPLACE FUNCTION public.owns_cart(p_cart_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Cart" c
    WHERE c.id = p_cart_id AND c."userId" = auth.uid()::text
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_wishlist(p_wishlist_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Wishlist" w
    WHERE w.id = p_wishlist_id AND w."userId" = auth.uid()::text
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_order(p_order_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Order" o
    WHERE o.id = p_order_id AND o."userId" = auth.uid()::text
  );
$$;

-- Only authenticated Supabase users (i.e. policies below) may call the
-- helpers; anon/public gets no execute right.
REVOKE EXECUTE ON FUNCTION public.owns_cart(text)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_wishlist(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_order(text)    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.owns_cart(text)     TO authenticated;
GRANT  EXECUTE ON FUNCTION public.owns_wishlist(text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.owns_order(text)    TO authenticated;


-- ──────────────────────── 3) Public catalog (read-only) ─────────────────────
-- Exactly the data the storefront already publishes publicly.

-- Categories & brands: fully public reference data.
DROP POLICY IF EXISTS "category_public_select" ON public."Category";
CREATE POLICY "category_public_select" ON public."Category"
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "brand_public_select" ON public."Brand";
CREATE POLICY "brand_public_select" ON public."Brand"
  FOR SELECT TO anon, authenticated
  USING (true);

-- Products: only active (visible) catalog rows.
DROP POLICY IF EXISTS "product_public_select_active" ON public."Product";
CREATE POLICY "product_public_select_active" ON public."Product"
  FOR SELECT TO anon, authenticated
  USING ("isActive" = true);

-- Product images & variants: catalog children; exposing them is harmless and
-- they are useless without their (already filtered) parent product.
DROP POLICY IF EXISTS "product_image_public_select" ON public."ProductImage";
CREATE POLICY "product_image_public_select" ON public."ProductImage"
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "product_variant_public_select" ON public."ProductVariant";
CREATE POLICY "product_variant_public_select" ON public."ProductVariant"
  FOR SELECT TO anon, authenticated
  USING (true);

-- Reviews: only APPROVED reviews are public. Pending/rejected reviews of a
-- user remain visible to that user exclusively through the app's API
-- (service role) — by design, keep this single policy here.
DROP POLICY IF EXISTS "product_review_public_select_approved" ON public."ProductReview";
CREATE POLICY "product_review_public_select_approved" ON public."ProductReview"
  FOR SELECT TO anon, authenticated
  USING ("status" = 'APPROVED');

-- Shipping methods: only active ones (checkout reads these).
DROP POLICY IF EXISTS "shipping_method_public_select_active" ON public."ShippingMethod";
CREATE POLICY "shipping_method_public_select_active" ON public."ShippingMethod"
  FOR SELECT TO anon, authenticated
  USING ("isActive" = true);

-- Site settings: read-only public values (e.g. announcement text, banners).
-- ⚠ CAVEAT: SiteSettings.value is a free-form JSON string. The table holds no
-- credentials today, but if a secret (API key, PSP credential, …) is EVER
-- stored under a settings key, you MUST drop this policy:
--   DROP POLICY "site_settings_public_select" ON public."SiteSettings";
-- and read settings exclusively via the server (service role), or move
-- secrets to Supabase Vault / environment variables.
DROP POLICY IF EXISTS "site_settings_public_select" ON public."SiteSettings";
CREATE POLICY "site_settings_public_select" ON public."SiteSettings"
  FOR SELECT TO anon, authenticated
  USING (true);


-- ───────────────────────── 4) Owner-scoped user data ────────────────────────
-- auth.uid()::text = "userId" — a Supabase user may only see and manage their
-- own rows. (In the current app these operations happen via the API with the
-- service role; these policies only matter for direct PostgREST access.)

-- Cart: owner CRUD. Guest carts ("userId" IS NULL) match nothing →
-- server-managed only, as intended.
DROP POLICY IF EXISTS "cart_owner_select" ON public."Cart";
CREATE POLICY "cart_owner_select" ON public."Cart"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "cart_owner_insert" ON public."Cart";
CREATE POLICY "cart_owner_insert" ON public."Cart"
  FOR INSERT TO authenticated
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "cart_owner_update" ON public."Cart";
CREATE POLICY "cart_owner_update" ON public."Cart"
  FOR UPDATE TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "cart_owner_delete" ON public."Cart";
CREATE POLICY "cart_owner_delete" ON public."Cart"
  FOR DELETE TO authenticated
  USING ("userId" = auth.uid()::text);

-- Cart items: ownership inherited from the parent cart.
DROP POLICY IF EXISTS "cart_item_owner_select" ON public."CartItem";
CREATE POLICY "cart_item_owner_select" ON public."CartItem"
  FOR SELECT TO authenticated
  USING (public.owns_cart("cartId"));

DROP POLICY IF EXISTS "cart_item_owner_insert" ON public."CartItem";
CREATE POLICY "cart_item_owner_insert" ON public."CartItem"
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_cart("cartId"));

DROP POLICY IF EXISTS "cart_item_owner_update" ON public."CartItem";
CREATE POLICY "cart_item_owner_update" ON public."CartItem"
  FOR UPDATE TO authenticated
  USING (public.owns_cart("cartId"))
  WITH CHECK (public.owns_cart("cartId"));

DROP POLICY IF EXISTS "cart_item_owner_delete" ON public."CartItem";
CREATE POLICY "cart_item_owner_delete" ON public."CartItem"
  FOR DELETE TO authenticated
  USING (public.owns_cart("cartId"));

-- Wishlist: one per user (userId is unique) — owner CRUD.
DROP POLICY IF EXISTS "wishlist_owner_select" ON public."Wishlist";
CREATE POLICY "wishlist_owner_select" ON public."Wishlist"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "wishlist_owner_insert" ON public."Wishlist";
CREATE POLICY "wishlist_owner_insert" ON public."Wishlist"
  FOR INSERT TO authenticated
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "wishlist_owner_update" ON public."Wishlist";
CREATE POLICY "wishlist_owner_update" ON public."Wishlist"
  FOR UPDATE TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "wishlist_owner_delete" ON public."Wishlist";
CREATE POLICY "wishlist_owner_delete" ON public."Wishlist"
  FOR DELETE TO authenticated
  USING ("userId" = auth.uid()::text);

-- Wishlist items: ownership inherited from the parent wishlist.
DROP POLICY IF EXISTS "wishlist_item_owner_select" ON public."WishlistItem";
CREATE POLICY "wishlist_item_owner_select" ON public."WishlistItem"
  FOR SELECT TO authenticated
  USING (public.owns_wishlist("wishlistId"));

DROP POLICY IF EXISTS "wishlist_item_owner_insert" ON public."WishlistItem";
CREATE POLICY "wishlist_item_owner_insert" ON public."WishlistItem"
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_wishlist("wishlistId"));

DROP POLICY IF EXISTS "wishlist_item_owner_update" ON public."WishlistItem";
CREATE POLICY "wishlist_item_owner_update" ON public."WishlistItem"
  FOR UPDATE TO authenticated
  USING (public.owns_wishlist("wishlistId"))
  WITH CHECK (public.owns_wishlist("wishlistId"));

DROP POLICY IF EXISTS "wishlist_item_owner_delete" ON public."WishlistItem";
CREATE POLICY "wishlist_item_owner_delete" ON public."WishlistItem"
  FOR DELETE TO authenticated
  USING (public.owns_wishlist("wishlistId"));

-- Addresses: owner CRUD.
DROP POLICY IF EXISTS "address_owner_select" ON public."Address";
CREATE POLICY "address_owner_select" ON public."Address"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "address_owner_insert" ON public."Address";
CREATE POLICY "address_owner_insert" ON public."Address"
  FOR INSERT TO authenticated
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "address_owner_update" ON public."Address";
CREATE POLICY "address_owner_update" ON public."Address"
  FOR UPDATE TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "address_owner_delete" ON public."Address";
CREATE POLICY "address_owner_delete" ON public."Address"
  FOR DELETE TO authenticated
  USING ("userId" = auth.uid()::text);

-- Orders: owner CRUD (cancellation is done via the API; a direct-PostgREST
-- user could still cancel/delete their own row — acceptable for
-- defense-in-depth, the server remains the authoritative path).
DROP POLICY IF EXISTS "order_owner_select" ON public."Order";
CREATE POLICY "order_owner_select" ON public."Order"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "order_owner_insert" ON public."Order";
CREATE POLICY "order_owner_insert" ON public."Order"
  FOR INSERT TO authenticated
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "order_owner_update" ON public."Order";
CREATE POLICY "order_owner_update" ON public."Order"
  FOR UPDATE TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "order_owner_delete" ON public."Order";
CREATE POLICY "order_owner_delete" ON public."Order"
  FOR DELETE TO authenticated
  USING ("userId" = auth.uid()::text);

-- Order items: ownership inherited from the parent order (snapshot rows).
DROP POLICY IF EXISTS "order_item_owner_select" ON public."OrderItem";
CREATE POLICY "order_item_owner_select" ON public."OrderItem"
  FOR SELECT TO authenticated
  USING (public.owns_order("orderId"));

DROP POLICY IF EXISTS "order_item_owner_insert" ON public."OrderItem";
CREATE POLICY "order_item_owner_insert" ON public."OrderItem"
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_order("orderId"));

DROP POLICY IF EXISTS "order_item_owner_update" ON public."OrderItem";
CREATE POLICY "order_item_owner_update" ON public."OrderItem"
  FOR UPDATE TO authenticated
  USING (public.owns_order("orderId"))
  WITH CHECK (public.owns_order("orderId"));

DROP POLICY IF EXISTS "order_item_owner_delete" ON public."OrderItem";
CREATE POLICY "order_item_owner_delete" ON public."OrderItem"
  FOR DELETE TO authenticated
  USING (public.owns_order("orderId"));

-- Payments: OWNER IS READ-ONLY (SELECT). Money records are created and
-- transitioned exclusively by the server (service role) — no anon/authenticated
-- INSERT/UPDATE/DELETE policy exists, so those operations are impossible for
-- them even with direct PostgREST access.
DROP POLICY IF EXISTS "payment_owner_select" ON public."Payment";
CREATE POLICY "payment_owner_select" ON public."Payment"
  FOR SELECT TO authenticated
  USING (public.owns_order("orderId"));


-- ─────────────── 5) Tables intentionally WITHOUT policies ───────────────────
-- RLS is ENABLED on all of the following but no policy is created, so anon and
-- authenticated roles see ZERO rows and can do NOTHING; only the service role
-- / postgres connection (the app's server-side Prisma) can access them. This
-- is exactly the app's trust model — admin + security-sensitive data must
-- never be reachable through PostgREST:
--
--   "User"               → passwordHash + PII; profiles only via /api/auth/*
--   "Session"            → session tokens; httpOnly cookies via the API only
--   "OrderStatusHistory" → surfaced through /api/orders (owner-checked there)
--   "CouponRedemption"   → has userId but is order/bookkeeping data; stricter
--                          to keep service-role-only (served via the API)
--   "Product" (writes)   → public gets SELECT of active rows only; INSERT/
--                          UPDATE/DELETE = admin, server-side requireRole
--   "PriceHistory"       → pricing internals (admin)
--   "ExchangeRate"       → FX internals (admin)
--   "PricingRule"        → pricing engine config (admin)
--   "Coupon"             → codes must not be enumerable by clients;
--                          validation happens via POST /api/coupons/validate
--   "AuditLog"           → admin-only audit trail
--   "InventoryMovement"  → admin stock ledger
--
-- If a future feature needs direct client access to any of these, add a
-- scoped policy deliberately — not by loosening these defaults.


-- ═════════════════════════════════════════════════════════════════════════════
-- END — verification helper (optional, run manually):
--   SELECT tablename, policyname, cmd, roles
--   FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
--   SELECT c.relname, c.relrowsecurity
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname;
-- Expected: every table relrowsecurity = true; 8 public-SELECT policies;
-- 29 owner policies (4×Cart, 4×CartItem, 4×Wishlist, 4×WishlistItem,
-- 4×Address, 4×Order, 4×OrderItem, 1×Payment read-only).
-- ═════════════════════════════════════════════════════════════════════════════
