# API Contract — Persian Home Appliances Store (آریا خانه)

**This document is the single source of truth** for both backend routes (`src/app/api/**`)
and frontend calls (`src/lib/client-api.ts`). Types live in `src/lib/types.ts`.

## Conventions

- Base: `/api/...`, JSON only, same-origin (no ports).
- Errors: `{ "error": { "code": string, "message": string } }` — `message` is **Persian**, user-displayable.
- Money: integer **Toman** everywhere (`*Toman` fields).
- Auth: httpOnly cookie `aria_session`. Guest carts: httpOnly cookie `aria_cart` (server-managed).
- DTOs: import from `@/lib/types`. Status strings validated against `@/lib/constants`.
- List responses: `{ items, total, page, pageSize }` unless noted.
- Route handlers must be wrapped with `handle()` from `@/lib/server/api-helpers`.

## Public endpoints

### Auth
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | /api/auth/register | `{name, phone, email?, password}` | `{user: UserDTO}` | 409 if phone exists; sets session cookie; auto-login |
| POST | /api/auth/login | `{phone, password}` | `{user: UserDTO}` | Rate-limited; merges guest cart into user cart; sets cookie |
| POST | /api/auth/logout | — | `{ok: true}` | Clears cookie + deletes session |
| GET | /api/auth/me | — | `{user: UserDTO \| null}` | |
| POST | /api/auth/change-password | `{currentPassword, newPassword}` | `{ok: true}` | auth required |

### Catalog
| Method | Path | Query | Response |
|---|---|---|---|
| GET | /api/products | `category, brand (comma-sep slugs), q, minPrice, maxPrice, inStock(1), sort(newest\|price_asc\|price_desc\|popular\|discount\|rating), page, pageSize, featured(1), isNew(1), discounted(1)` | `ListResponse<ProductCard>` (only isActive products) |
| GET | /api/products/[slug] | — | `ProductDetail` (includes related ≤8 same-category active products, approved reviews, ratingBreakdown) — increments viewCount |
| GET | /api/search/suggest | `q` | `SuggestResponse` (≤6 products, ≤4 categories, ≤4 brands; matches name/sku/model/brand fa+en) |

### Cart (guest OK; server is the only source of truth for prices)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | /api/cart | — | `CartPayload` (lines with **server-validated** unitPriceToman = product.priceToman [+variant.extraPriceToman]; maxQuantity = min(stock, 5); inactive/OOS products are excluded silently) |
| POST | /api/cart | `{productId, variantId?, quantity?}` | `CartPayload` | 404 unknown/inactive product, 409 insufficient stock |
| PATCH | /api/cart | `{itemId, quantity}` (quantity ≥1) | `CartPayload` | quantity 0 deletes; 409 if stock exceeded |
| DELETE | /api/cart | — | `CartPayload` | Clears cart entirely |

### Wishlist (auth required)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | /api/wishlist | — | `WishlistPayload` |
| POST | /api/wishlist | `{productId}` | `WishlistPayload` (toggle add/remove) |

### Reviews (auth required for POST)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | /api/reviews | `{productId, rating (1..5), title?, comment}` | `{ok: true}` — auto-approves; recomputes product ratingAvg/ratingCount |

### Checkout support
| Method | Path | Body | Response |
|---|---|---|---|
| POST | /api/coupons/validate | `{code, subtotalToman}` | `CouponValidation` |
| GET | /api/shipping/methods | — | `ShippingMethodDTO[]` |

### Addresses (auth)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | /api/addresses | — | `AddressDTO[]` |
| POST | /api/addresses | `{title, receiverName, phone, province, city, postalCode, line, isDefault?}` | `AddressDTO` |
| PATCH | /api/addresses/[id] | partial of POST body | `AddressDTO` — 403/404 unless owner |
| DELETE | /api/addresses/[id] | — | `{ok: true}` |

### Orders (auth)
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | /api/orders | — | `OrderDTO[]` (own orders, newest first) | |
| GET | /api/orders/[id] | — | `OrderDTO` | `[id]` = orderNumber **or** id; owner or STAFF/ADMIN only |
| POST | /api/orders | `{addressId, shippingMethodId, couponCode?, note?}` **or** inline `{address:{receiverName,phone,province,city,postalCode,line,title?}}` | `{order: OrderDTO}` | **Server recomputes everything** from DB: unit prices, stock (atomic decrement in `$transaction`, 409 on oversell), coupon, shipping (free if subtotal ≥ freeThresholdToman). Creates OrderStatusHistory. Stock=0 → 409 with Persian message. |
| POST | /api/orders/[id]/pay-test | — | `{order: OrderDTO}` | TEST gateway: creates Payment(PENDING) → simulates provider callback → PAID + order PENDING→CONFIRMED + Payment(PAID, refId). Clearly labeled test mode. 409 if already paid/cancelled. |
| POST | /api/orders/[id]/cancel | — | `{order: OrderDTO}` | Owner, only while PENDING/CONFIRMED; restores stock; history entry. |

## Admin endpoints (role STAFF/ADMIN — enforced server-side via `requireRole`)

| Method | Path | Query/Body | Response |
|---|---|---|---|
| GET | /api/admin/stats | — | `AdminStats` (revenue = sum of PAID orders) |
| GET | /api/admin/products | `q, categoryId, brandId, status(active/inactive/all), page, pageSize` | `ListResponse<AdminProductRow>` |
| POST | /api/admin/products | full product JSON (see AdminProductDetail minus id) + `images: string[]` (urls) | `{product: AdminProductDetail}` — validates slugs/sku unique, zod |
| GET | /api/admin/products/[id] | — | `{product: AdminProductDetail}` |
| PATCH | /api/admin/products/[id] | partial (same shape; images replaced if provided) | `{product: AdminProductDetail}` — writes PriceHistory when priceToman changes (source MANUAL) |
| POST | /api/admin/products/[id]/stock | `{type: IN\|OUT\|ADJUSTMENT, quantity>0, reason}` | `{stock, movement: InventoryMovementRow}` — transaction, never negative (409) |
| GET | /api/admin/inventory/movements | `productId?, page` | `ListResponse<InventoryMovementRow>` |
| GET | /api/admin/orders | `status?, paymentStatus?, q(orderNumber/name/phone), page` | `ListResponse<AdminOrderRow>` |
| GET | /api/admin/orders/[id] | — | `{order: OrderDTO}` |
| POST | /api/admin/orders/[id]/status | `{status, note?}` | `{order: OrderDTO}` — validates transition map (constants.ORDER_STATUS_TRANSITIONS); CANCELLED restores stock; audit + history |
| PATCH | /api/admin/orders/[id] | `{adminNote}` | `{order: OrderDTO}` |
| GET | /api/admin/pricing/rates | — | `ExchangeRateDTO[]` (all, newest first; isStale = recordedAt older than MAX_RATE_AGE_DAYS) |
| POST | /api/admin/pricing/rates | `{currency, rateToman>0, note?}` | `ExchangeRateDTO` — ADMIN only; deactivates previous rate for currency; audit RATE_SET |
| GET | /api/admin/pricing/rules | — | `PricingRuleDTO[]` (affectedCount computed) |
| POST | /api/admin/pricing/rules | `{name, scopeType, categoryId?/brandId?/productId?, marginPercent≥0, extraCostToman≥0, roundingStepToman>0, isActive}` | `PricingRuleDTO` |
| PATCH | /api/admin/pricing/rules/[id] | partial | `PricingRuleDTO` |
| POST | /api/admin/pricing/run | `{dryRun: boolean}` | dryRun: `PricingPreviewResponse`; else applies: updates prices of non-manual products with valid fresh rate, writes PriceHistory (source PRICING_ENGINE), audit PRICE_APPLY. Returns `PricingPreviewResponse` too. |
| GET | /api/admin/pricing/history | `page` | `ListResponse<PriceHistoryRow>` |
| GET | /api/admin/audit | `page, limit` | `ListResponse<{id, actorName, action, entity, entityId, createdAt}>` |
| GET | /api/admin/coupons | — | `CouponDTO[]` |
| POST | /api/admin/coupons | `{code, type: PERCENT\|AMOUNT, value, minOrderToman?, maxDiscountToman?, usageLimit?, validFrom?, validUntil?, isActive}` | `CouponDTO` |
| PATCH | /api/admin/coupons/[id] | `{isActive?}` | `CouponDTO` |

## Pricing engine (src/lib/server/pricing.ts — pure, testable)

```
proposed = round(costPrice × activeRate × (1 + marginPercent/100) + extraCostToman, step)
round(x, step) = Math.round(x / step) × step   // half-up
```
- Rule resolution: PRODUCT > BRAND > CATEGORY > GLOBAL (first active match).
- Skip reasons (never silently price): product.isPriceManual, missing active rate for costCurrency, stale rate (recordedAt older than MAX_RATE_AGE_DAYS).
- Only products with costPrice+costCurrency and isPriceManual=false are recalculated.
- Iranian-brand products: isPriceManual=true (price entered directly in toman).

## Torob feed

| Method | Path | Query | Response |
|---|---|---|---|
| GET | /api/torob/feed | `format=json` (default) or `csv` | `TorobFeedResponse` or CSV text (same fields as header row) |

- Only active products; price = current DB priceToman; canonical URLs built from `NEXT_PUBLIC_SITE_URL` env (fallback relative).
- Implemented as a modular adapter (src/lib/server/torob.ts) — exact Torob spec must be verified against their merchant documentation before going live (documented, not invented).
- GET /api/torob/validate → `{ok, missingFields: string[], warnings: string[], count}` validation report.

## Seed data (prisma/seed.ts)

- 8 categories: refrigerator, washing-machine, dishwasher, tv, vacuum, cooking, air-conditioner, small-appliance (Persian names).
- 10 brands: Snowa(اسنوا), Diamond(دوو), Pakshoma(پاکشوما), Samsung(سامسونگ), LG(ال‌جی), Bosch(بوش), Hisense(هیسنس), Philips(فیلیپس), DeLonghi(دلونگی), GPlus(جی‌پلاس).
- 36 products w/ images from `src/data/images.json` (category → url[]), Persian attributes JSON, color variants, stock (some low/zero to demo states), mixed priceToman + costCurrency pricing for imported brands.
- Global pricing rule (margin 12%, step 100,000), USD/EUR MANUAL rates (labeled demo data).
- Shipping methods ×3, coupons WELCOME10 + NOWRUZ1404, admin + demo customer users, sample orders + movements + audit + reviews.
- Idempotent: wipe & re-create in FK-safe order.

## Frontend hash routes (single visible page — sandbox constraint)

`#/` home · `#/category/:slug` · `#/search?q=` · `#/product/:slug` · `#/cart` · `#/checkout` · `#/order/:orderNumber` · `#/account` (tabs: orders/profile/addresses) · `#/wishlist` · `#/compare` · `#/login` · `#/register` · `#/page/:slug` (about/contact/faq/shipping/returns/privacy/terms/warranty) · `#/admin/overview` · `#/admin/products` · `#/admin/products/new` · `#/admin/products/:id` · `#/admin/orders` · `#/admin/orders/:id` · `#/admin/pricing` · `#/admin/inventory` · `#/admin/coupons` · 404 view.

## Added in Task 6 (Supabase integration)

### Catalog — new public endpoints (Task 6-b)
| Method | Path | Query | Response |
|---|---|---|---|
| GET | /api/categories | — | `{ items: [{ slug, name, nameEn, productCount }] }` — active categories only; `productCount` = count of the category's **active** products; sorted by `name` asc |
| GET | /api/brands | — | same shape for brands (`productCount` over active products); the Brand model has no isActive flag, so all brands are listed; sorted by `name` asc |

Both are `dynamic = "force-dynamic"`, no auth, straight from the DB (no sample data).

### Supabase Auth mode (Task 6-b)
- Enabled **iff** all three env vars are set (memoized per process): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Sandbox default = absent → **local scrypt auth, 100% unchanged** (module: `src/lib/server/supabase.ts`, server-only).
- **register**: with an email and Supabase enabled → Supabase user is created first via admin API (`auth.admin.createUser({ email, password, email_confirm: true })`); Supabase errors are mapped to the project's Persian error JSON (duplicate email → 409 `EMAIL_EXISTS` «این ایمیل قبلاً ثبت شده است»). Local `User` row is created right after with the same fields/role logic as before; if the local row fails, the just-created Supabase user is deleted (orphan cleanup). There is **no `supabaseUserId` column** (no db push) — the local row is the app profile, resolved against Supabase by its unique email. Phone-only registrations stay local-only (cloud identity requires an email).
- **login**: identifier is the phone (as before); in Supabase mode an email typed into the login field is also accepted. When an email is derivable, `auth.signInWithPassword` is tried first; on success a local `User` row is ensured (find by email; missing → created with default CUSTOMER role + deterministic placeholder phone `sb:<supabase-user-id>`), then the normal local session cookie is issued — **Supabase access/refresh tokens are never sent to the client**. On Supabase failure (or SDK/network error) the request falls back to the existing local scrypt check, so pre-migration local accounts keep working.
- **change-password**: current password is verified locally as before; if Supabase is enabled and the account's email is found in Supabase (admin lookup), `auth.admin.updateUserById` syncs the new password — runs *before* the local update, so a provider failure returns the Persian error (`AUTH_PROVIDER_ERROR`) and leaves both sides consistent. Local scrypt update otherwise unchanged.
- **me / logout**: unchanged.

## Added in Task 7 (users management & review moderation)

### Review moderation — behavior change (Task 7-b)
- **POST /api/reviews** (public, auth) now creates reviews with `status: "PENDING"` — they enter the moderation queue and are **not** visible on the product page until an admin/staff approves them. Product `ratingAvg`/`ratingCount` aggregates count **APPROVED reviews only**.
  - 409 `REVIEW_DUPLICATE` «شما قبلاً برای این محصول نظر ثبت کرده‌اید.» when the same user already has a PENDING **or** APPROVED review for the same product (REJECTED ones allow re-submission).
  - The created row carries `isVerifiedPurchase: true` when the user has an Order (status ≠ CANCELLED) containing an OrderItem with that product.
- Product API reviews may include `adminReply?: string | null` and `isVerifiedPurchase?: boolean` (optional fields on `ReviewDTO`; rendered by the product page when present).

### Admin — users management (ADMIN only)
| Method | Path | Query/Body | Response |
|---|---|---|---|
| GET | /api/admin/users | `q (name/phone/email contains), page, pageSize (default 20), status (all\|active\|blocked)` | `ListResponse<AdminUserRowDTO>` — rows: `{id, name, email, phone, role, isActive, createdAt, ordersCount, totalSpentToman, lastOrderAt}`; `totalSpentToman` = sum of `totalToman` where status ≠ CANCELLED (groupBy on Order) |
| GET | /api/admin/users/[id] | — | `{ user: AdminUserDetailDTO }` — profile + `recentOrders` (10 newest: orderNumber, status, paymentStatus, totalToman, createdAt). 404 `USER_NOT_FOUND`. Password/session/token fields are never returned from any users endpoint |
| PATCH | /api/admin/users/[id] | `{ isActive: boolean }` | `{ user: AdminUserRowDTO }` — block/unblock. 409 `SELF_BLOCK` («شما نمی‌توانید حساب کاربری خودتان را مسدود کنید.») when blocking yourself; 409 `LAST_ADMIN` when blocking the last active ADMIN. AuditLog `USER_BLOCK` / `USER_UNBLOCK` |
| POST | /api/admin/users/[id]/role | `{ role: "CUSTOMER"\|"STAFF"\|"ADMIN" }` | `{ user: AdminUserRowDTO }` — ADMIN-only (STAFF can never change roles). 400 invalid role; 409 `SELF_ROLE_CHANGE` («تغییر نقش حساب کاربری خودتان مجاز نیست.»); 409 `LAST_ADMIN` when demoting the last active ADMIN. Same-role requests are an idempotent no-op. AuditLog `USER_ROLE_CHANGE` with detail `{from, to}` |

### Admin — review moderation (STAFF/ADMIN)
| Method | Path | Query/Body | Response |
|---|---|---|---|
| GET | /api/admin/reviews | `status (PENDING\|APPROVED\|REJECTED\|all), rating (1..5), productId, from, to (ISO date or YYYY-MM-DD; "to" is inclusive), page, pageSize` | `AdminReviewsListResponse` = `{ items: AdminReviewDTO[], total, page, pageSize, counts: {PENDING, APPROVED, REJECTED} }` — `counts` is global (ignores filters, for tab badges); rows: `{id, product{id,slug,name}, user{id,name,phone}, rating, title, comment, status, adminReply, isVerifiedPurchase, createdAt, reviewedAt}` |
| PATCH | /api/admin/reviews/[id] | `{ status?: "APPROVED"\|"REJECTED", adminReply?: string\|null }` — at least one field required | `{ review: AdminReviewDTO }` — status change sets `reviewedAt = now` and recalculates the product's `ratingAvg`/`ratingCount` over APPROVED reviews only (same recalc pattern as POST /api/reviews); `adminReply` string saves/replaces the reply (max 1000 chars, Persian error on overflow), `null` clears it, omitted = untouched. 404 `REVIEW_NOT_FOUND`. AuditLog `REVIEW_MODERATE` with detail `{productSlug, from, to, adminReplyUpdated}` |

### Admin bootstrap via `ADMIN_EMAILS` (Task 7-b)
- `ADMIN_EMAILS` (comma-separated, **server-side only**) — when a **new local User row** is provisioned for an email in the list, it is created with `role: "ADMIN"` instead of `"CUSTOMER"`. Applies to: (a) **register** (`POST /api/auth/register`), (b) the login **local-provisioning** path (`ensureLocalUserForSupabaseIdentity`, Supabase mode). The env contents are never exposed in any API response. See `.env.example` and docs/supabase-setup.md for the bootstrap story.
- Frontend pages: `#/admin/users` (src/components/admin/users-page.tsx) and `#/admin/reviews` (src/components/admin/reviews-page.tsx) with hooks `src/hooks/use-admin-users.ts` (keys `["admin-users", …]`, `["admin-user", id]`) and `src/hooks/use-admin-reviews.ts` (key `["admin-reviews", …]`).

## Task 7 additions — CSV export/import infrastructure (Task 7-a)

### CSV conventions (src/lib/server/csv.ts — pure, dependency-free)
- RFC 4180: fields containing `,` `"` or newlines are quoted, embedded quotes doubled; **CRLF** line endings; **UTF-8 BOM** (`\uFEFF`) prefix on every produced document so Excel renders Persian correctly.
- Exports: `toCsv(headers, rows)` (full document) and `csvChunks(headers, rows)` (streaming generator, 500 rows/chunk).
- Import parsing: `parseCsv(text)` — handles quoted fields, `""` escapes, CRLF/LF/CR, strips the BOM, drops blank lines. Pure + testable.

### CSV export
| Method | Path | Query | Response |
|---|---|---|---|
| GET | /api/admin/export | `entity=<name>` (required), `from`/`to` (optional; ISO datetime **or** `yyyy-mm-dd` — date-only `to` is inclusive end-of-day local) | `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="<entity>-<yyyymmdd>.csv"` (streamed) |

Auth: STAFF/ADMIN via `requireRole` — except `users` and `admin_audit_logs` which are **ADMIN only** (STAFF → 403). Unknown entity → 400 `UNKNOWN_ENTITY` (Persian message lists valid entities). Invalid dates → 400 `BAD_DATE`. Every successful export writes an AuditLog entry (`action: "EXPORT_CSV"`, `entity` = the exported entity name, `detail` = `{ rowCount, from, to }`).

Entities + exact columns (order = column order; dates are ISO strings; money = integer Toman; booleans `true`/`false`; empty cell = null):

| entity | columns | notes |
|---|---|---|
| products | id, slug, name, nameEn, sku, model, categorySlug, brandName, priceToman, originalPriceToman, stock, isFeatured, isNew, isActive, deletedAt, createdAt | includes soft-deleted rows (`deletedAt` set); `brandName` = brand display name |
| categories | id, slug, name, nameEn, isActive, sortOrder, productCount, createdAt | `productCount` = ALL products of the category (not only active) |
| brands | id, slug, name, nameEn, country, productCount | **schema deviation:** Brand has no `isActive`/`createdAt` fields → those requested columns are replaced by `nameEn`/`country`; date filters ignored |
| orders | orderNumber, customerName, customerPhone, status, paymentStatus, subtotalToman, discountToman, shippingCostToman, totalToman, couponCode, trackingCode, createdAt | ALL statuses included (CANCELLED rows carry `status` column — caller filters for revenue math); date filter on `createdAt` |
| order_items | orderNumber, productName, sku, variantText, quantity, unitPriceToman, lineTotalToman | joined through Order; date filter on the **order's** `createdAt` |
| reviews | id, productSlug, rating, status, title, comment, isVerifiedPurchase, adminReply, createdAt | |
| inventory_movements | id, productSlug, type, quantity, reason, refOrderNumber, createdAt | **schema deviation:** InventoryMovement has no `variantText` — mapped to its actual fields (`refOrderNumber` included) |
| discounts | code, type, value, minOrderToman, maxDiscountToman, usageLimit, perUserLimit, timesUsed, validFrom, validUntil, isActive, createdAt | Coupon rows (incl. `perUserLimit`) |
| users | id, name, email, phone, role, isActive, createdAt | **ADMIN only — never passwordHash or any token/credential column** |
| admin_audit_logs | id, actorId, actorName, action, entity, entityId, detail, createdAt | **ADMIN only**; `detail` (JSON string) is included **after stripping** any key matching /passw\|token\|secret\|hash\|authoriz\|apikey/ (values → `[REDACTED]`) |

### Bulk product import
| Method | Path | Body | Response |
|---|---|---|---|
| GET | /api/admin/products/import | `?template=1` | sample CSV (UTF-8 BOM): exact expected header + 2 example rows, `Content-Disposition: attachment; filename="products-import-template.csv"` — **ADMIN only** |
| GET | /api/admin/products/import | — | `{ headers: string[], required: string[] }` — machine-readable header description — **ADMIN only** |
| POST | /api/admin/products/import | `{ csv: string, commit?: boolean }` | **ADMIN only** — see below |

Expected header (exact, order-insensitive; extra columns ignored):
```
slug,name,nameEn,sku,model,categorySlug,brandSlug,priceToman,originalPriceToman,stock,isActive
```
Required columns: `slug, name, categorySlug, brandSlug, priceToman`. Optional: `nameEn, sku, model, originalPriceToman, stock` (default 0), `isActive` (default `true`; accepts `true`/`false`, digits normalized Persian→latin, thousand separators allowed).

**commit=false (default, dry-run)** → `{ totalRows, validCount, errorCount, errors: [{row, message}], preview }` — `row` is 1-based counting **data rows** (header excluded); `preview` = first 5 valid parsed rows shaped `{ row, slug, name, nameEn, sku, model, categorySlug, brandSlug, priceToman, originalPriceToman, stock, isActive, existsInDb }`. Validation (all messages Persian): slug required + latin/digit/hyphen + unique-within-file; name required; `priceToman` positive integer; `stock ≥ 0` integer; `originalPriceToman ≥ priceToman` when present; `categorySlug`/`brandSlug` must exist in DB (case-sensitive); `isActive` parses to `true`/`false`; `sku` (when provided) unique-within-file and, for rows that would CREATE, not owned by a different existing product. Missing/bad header → 400 `BAD_HEADER`; empty CSV → 400 `EMPTY_CSV`.

**commit=true** → if any validation errors: **422** `{ error: { code: "IMPORT_ERRORS", message, errors: [{row, message}] } }` — nothing is written. Else upserts **by slug** inside one `prisma.$transaction` and returns `{ created, updated }`. Update policy: only `name, priceToman, originalPriceToman, stock, categoryId, brandId, isActive` are overwritten; images, description, SKU, model, nameEn of existing products are NEVER touched. Create fills gaps with generated SKU (`SKU-…`), placeholder description, `isPriceManual: true`. Success writes AuditLog (`action: "IMPORT_CSV"`, `detail: { created, updated, slugs }`).

### Frontend (client types mirror the payloads above)
- `src/hooks/use-admin-exports.ts`: `useDownloadExport` (blob → programmatic `<a download>`, parses `Content-Disposition` filename; 403 → toast «دسترسی غیرمجاز»), `useDownloadImportTemplate`, `useValidateProductImport`, `useCommitProductImport` (success toast with created/updated counts; invalidates `['admin-products']`, `['admin-product']`, `['admin-stats']`, `['admin-taxonomy']`).
- `src/components/admin/exports-page.tsx` — default export `AdminExportsPage` (hash route `#/admin/exports`; nav wiring owned by the lead) + `src/components/admin/product-import-dialog.tsx` (`ProductImportDialog`).

## Added in Task 7 (sales reports, invoice, tracking code)

### GET /api/admin/reports (Task 7-c)
| Method | Path | Query | Response |
|---|---|---|---|
| GET | /api/admin/reports | `from=YYYY-MM-DD`, `to=YYYY-MM-DD` (both optional, inclusive; default = last 30 days incl. today), `granularity=day\|week\|month` (default `day`) | `{ from, to, granularity, summary, series, topProducts, lowStock }` |

- Role STAFF/ADMIN. `export const dynamic = "force-dynamic"`. All money = integer Toman.
- `summary`: `{ ordersCount (non-cancelled), grossSalesToman (Σ subtotal), discountsToman, shippingToman, netRevenueToman (Σ total), paidCount (paymentStatus=PAID), cancelledCount, newCustomers (role CUSTOMER registered in range), avgOrderToman }`.
- `series`: one point per UTC bucket (day = `YYYY-MM-DD`, week = Monday ISO, month = `YYYY-MM-01`), zero-filled over the whole range; revenue excludes CANCELLED orders. Persian labels are rendered client-side from `bucketISO` via the shared Jalali formatters.
- `topProducts`: ≤ 8 rows `{ productId, productName, quantitySold, revenueToman }` grouped by productId+productName over non-cancelled orders in range, sorted by revenue.
- `lowStock`: ≤ 10 active, non-soft-deleted products with `stock <= lowStockThreshold`, stock asc.
- Errors (Persian 400): `RANGE_INVALID` (bad format / from > to), `RANGE_TOO_LONG` (> 366 days), `GRANULARITY_INVALID`.

### PATCH /api/admin/orders/[id] — extended (Task 7-c)
Body is now a partial of `{ adminNote, trackingCode }`:
- `trackingCode` (optional): absent → unchanged; `null` or `""` → clears the code; string → trimmed, max 60 chars (Persian 400 otherwise).
- `adminNote` behavior preserved: when the key is sent, it is stored verbatim (`null`/`""` clears). A body with **neither** key → 400 `NOTHING_TO_UPDATE` (previously a silent no-op wipe).
- When `trackingCode` changes value, an audit entry `TRACKING_SET` (entity `Order`, detail `{orderNumber, trackingCode}`) is written. Response shape unchanged: `{ order: OrderDTO }`.

### OrderDTO (Task 7-c)
`OrderDTO` now includes `trackingCode: string | null` (mapped in `toOrderDTO`), so the admin order detail, the customer order page (`#/order/:orderNumber`) and the invoice all receive it.

### Invoice + tracking UI (Task 7-c)
- `src/components/admin/order-invoice.tsx`: printable invoice dialog in the admin order detail (`چاپ فاکتور` button → `window.print()`; print CSS prints ONLY the `.invoice-print` subtree). TEST provider invoices carry the note «حالت آزمایشی — فاکتور معتبر مالیاتی نیست».
- Admin order detail: tracking-code input (mono, LTR) + prominent display; customer order page shows a «کد رهگیری ارسال» block when set.
- CSV export buttons link to `GET /api/admin/export?entity=orders&from&to` (endpoint delivered by its own Task-7 subtask).

### Frontend hash route (Task 7-c)
`#/admin/reports` → `AdminReportsPage` (`src/components/admin/reports-page.tsx`). Note: `admin-area.tsx` is intentionally untouched by 7-c — wire `first === "reports"` there when integrating (one-liner, like the other admin views).

## Added in Task 7-d (settings, shipping admin, uploads, soft delete, bulk, sitemap)

### Store settings
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | /api/admin/settings | — | `{ settings: { store_contact, store_commerce, seo } }` | ADMIN; missing keys → Persian defaults; malformed JSON → defaults for that section |
| PUT | /api/admin/settings | partial `{ store_contact?, store_commerce?, seo? }` (zod, Persian errors) | `{ settings, updatedKeys: string[] }` | ADMIN; upsert per key (SiteSettings key → JSON-string); audit `SETTINGS_UPDATE` |
| GET | /api/settings | — | same `settings` payload | **public**; explicit allow-list of non-sensitive keys (store_contact + store_commerce + seo) |

- `store_contact` = `{phone, email, address, instagram, telegram, whatsapp}` (strings, trimmed).
- `store_commerce` = `{minOrderToman:int≥0, freeShippingThresholdToman:int≥0, showPricesWithTaxNote:boolean}` (0 = no limit / disabled).
- `seo` = `{defaultTitle, defaultDescription, keywords}`.
- Server module: `src/lib/server/site-settings.ts` (defaults + tolerant parse/merge).

### Shipping methods admin (CRUD)
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | /api/admin/shipping | — | `{ items: ShippingMethodAdminRow[] }` | STAFF/ADMIN; includes inactive; ordered sortOrder asc |
| POST | /api/admin/shipping | `{name, description?, costToman≥0, freeThresholdToman?≥0|null, estimatedDays?, isActive?, sortOrder?}` | `{ method }` 201 | audit `SHIPPING_CREATE` |
| PATCH | /api/admin/shipping/[id] | partial of POST body | `{ method }` | 404 unknown; audit `SHIPPING_UPDATE` |
| DELETE | /api/admin/shipping/[id] | — | `{ ok: true }` | **Guard**: method referenced by any order → 409 `SHIPPING_IN_USE` «…در N سفارش استفاده شده…؛ می‌توانید آن را غیرفعال کنید» (offer deactivate); unreferenced → hard delete + audit `SHIPPING_DELETE` |

⚠️ Checkout reads ShippingMethod rows (public `/api/shipping/methods` + order creation) — rows are never removed when referenced; only add/edit/deactivate.

### Image upload (local-disk adapter)
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | /api/admin/upload | multipart/form-data field `file` | `{ url: "/uploads/p-<uuid>.<ext>" }` 201 | ADMIN; mime ∈ {image/jpeg, image/png, image/webp}, ≤ 2MB (else 422 Persian); safe name + `fs.mkdir` recursive; audit `UPLOAD_IMAGE` |
| DELETE | /api/admin/upload?url=/uploads/<name> | — | `{ ok: true }` | ADMIN; url must match `^/uploads/[A-Za-z0-9._-]+$` (no `..`, else 400); **409 `IMAGE_IN_USE` «تصویر در حال استفاده است…»** if a ProductImage row references the URL; unlink (idempotent when already gone); audit `DELETE_IMAGE` |

- Files land in `public/uploads/` (`.gitkeep` committed). **در تولید با Supabase Storage جایگزین شود** — this route is the single adapter point (upload + delete).

### Product images — alt support (wire format)
- `images` in POST/PATCH `/api/admin/products` (and `[id]`) now accepts **either** the legacy `string[]` **or** `{ url: string; alt?: string }[]` (max 10). Validators extended in `src/lib/validators.ts` (product image schema only).
- Normalization (`normalizeProductImages` in `src/lib/server/admin-products.ts`): trims, drops empties, assigns sortOrder, and falls back to the product name as `alt` when none provided (existing behavior preserved).

### Product soft delete (deletedAt)
| Method | Path | Response | Notes |
|---|---|---|---|
| DELETE | /api/admin/products/[id] | `{ ok: true, product: {id,name,slug,sku} }` | STAFF/ADMIN; **soft delete only**: `update({ deletedAt: new Date(), isActive: false })` — never hard delete; audit `PRODUCT_DELETE` (detail.softDelete=true); 409 if already deleted |

- Soft-deleted products **disappear from every list** (admin + public); there is no trash view. Slug/SKU uniqueness checks still consider deleted rows (DB unique constraints hold).
- `deletedAt: null` added to every Product where-clause: admin list/detail, storefront list/detail/related, cart payload lines, search suggest, Torob feed/validate, admin stats, pricing engine + rule affected-counts, sitemap, bulk ops.
- Cart/wishlist/order paths are additionally safe because soft delete also sets `isActive=false` (existing guards).

### Bulk operations
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | /api/admin/products/bulk | `{ ids: string[] (1..200), action: "activate"\|"deactivate" }` | `{ updated: number, action }` | ADMIN; `updateMany` (`id in ids`, `deletedAt: null`) — never touches `deletedAt`; audit `PRODUCTS_BULK` {action, requested, updated}; 404 when nothing matched |

### Sitemap
| Route | Notes |
|---|---|
| GET /sitemap.xml | `src/app/sitemap.ts` (MetadataRoute, force-dynamic). Base = `NEXT_PUBLIC_SITE_URL` \|\| `https://ariakhaneh.example`. Includes `/` (1.0), `/#/search` (0.4), active categories (0.8), active non-deleted products (0.7, lastmod = updatedAt). URLs use the canonical SPA hash form (`…/#/product/<slug>`) matching the Torob adapter; migrate to clean paths at SSR cutover. Preview sandbox exposes only `/` — this route works on real deploys. |

### Admin UI (Task 7-d)
- `#/admin/settings` — «تنظیمات فروشگاه» (`AdminSettingsPage`): 3 settings cards (per-card save) + «روش‌های ارسال» CRUD card. Wiring into `admin-area.tsx` / sidebar is owned by the agent that owns those files.
- `#/admin/products` — checkbox column + select-all (indeterminate aware), selection counter chip, «فعال‌سازی»/«غیرفعال‌سازی» with AlertDialog confirm; selection cleared after success.
- Product form images section — «بارگذاری تصویر» (POST /api/admin/upload, client-side 2MB pre-check) + per-row URL + «متن جایگزین (alt)» inputs; add-by-URL row kept.
