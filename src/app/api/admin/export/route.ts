import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, requireRole, audit, ApiError } from "@/lib/server/api-helpers";
import { csvChunks, type CsvCell } from "@/lib/server/csv";

// GET /api/admin/export?entity=<name>&from=<ISO|yyyy-mm-dd>&to=<ISO|yyyy-mm-dd>
// Streams real DB data as RFC4180 CSV (UTF-8 BOM + CRLF) for Excel-friendly
// Persian exports. STAFF/ADMIN for catalog/sales entities; ADMIN only for
// users + audit logs. Every export writes an EXPORT_CSV audit entry.

export const dynamic = "force-dynamic";

type DateRange = { gte?: Date; lte?: Date };

/** Parses from/to query values; date-only values use local midnight/end-of-day so "to" is inclusive. */
function parseRange(sp: URLSearchParams): DateRange {
  const range: DateRange = {};
  const fromRaw = sp.get("from")?.trim();
  const toRaw = sp.get("to")?.trim();

  if (fromRaw) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromRaw)) {
      const [y, m, d] = fromRaw.split("-").map(Number);
      range.gte = new Date(y, m - 1, d, 0, 0, 0, 0);
    } else {
      const d = new Date(fromRaw);
      if (Number.isNaN(d.getTime())) {
        throw new ApiError(400, "BAD_DATE", "تاریخ «از» نامعتبر است؛ فرمت صحیح: YYYY-MM-DD یا ISO کامل.");
      }
      range.gte = d;
    }
  }
  if (toRaw) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
      const [y, m, d] = toRaw.split("-").map(Number);
      range.lte = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else {
      const d = new Date(toRaw);
      if (Number.isNaN(d.getTime())) {
        throw new ApiError(400, "BAD_DATE", "تاریخ «تا» نامعتبر است؛ فرمت صحیح: YYYY-MM-DD یا ISO کامل.");
      }
      range.lte = d;
    }
  }
  return range;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

// Audit detail is a free-form JSON string written by audit() callers; before it
// leaves the system we blank every key that looks sensitive.
const SECRET_KEY_RE = /(passw|token|secret|hash|authoriz|apikey|api_key)/i;
function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_RE.test(k) ? "[REDACTED]" : stripSecrets(v);
    }
    return out;
  }
  return value;
}

function sanitizeAuditDetail(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(stripSecrets(JSON.parse(raw)));
  } catch {
    // Not JSON — redact obvious key=value pairs defensively.
    return raw.replace(
      /((?:password|passwd|token|secret|hash)[^=:,}]*)\s*[=:]\s*[^,}\s"']+/gi,
      "$1=[REDACTED]"
    );
  }
}

interface EntityDef {
  /** Extra role gate (users + audit logs are ADMIN-only). */
  adminOnly?: boolean;
  build: (range: DateRange) => Promise<{ headers: string[]; rows: CsvCell[][] }>;
}

function createdAtWhere(range: DateRange): { createdAt?: DateRange } {
  const w: { createdAt?: DateRange } = {};
  if (range.gte) w.createdAt = { ...w.createdAt, gte: range.gte };
  if (range.lte) w.createdAt = { ...w.createdAt, lte: range.lte };
  return w;
}

const ENTITIES: Record<string, EntityDef> = {
  products: {
    async build(range) {
      const products = await db.product.findMany({
        where: createdAtWhere(range),
        include: {
          category: { select: { slug: true } },
          brand: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return {
        headers: [
          "id", "slug", "name", "nameEn", "sku", "model", "categorySlug", "brandName",
          "priceToman", "originalPriceToman", "stock", "isFeatured", "isNew", "isActive",
          "deletedAt", "createdAt",
        ],
        rows: products.map((p) => [
          p.id, p.slug, p.name, p.nameEn, p.sku, p.model, p.category.slug, p.brand.name,
          p.priceToman, p.originalPriceToman, p.stock, p.isFeatured, p.isNew, p.isActive,
          iso(p.deletedAt), iso(p.createdAt),
        ]),
      };
    },
  },

  categories: {
    async build(range) {
      const categories = await db.category.findMany({
        where: createdAtWhere(range),
        include: { _count: { select: { products: true } } },
        orderBy: { sortOrder: "asc" },
      });
      return {
        headers: ["id", "slug", "name", "nameEn", "isActive", "sortOrder", "productCount", "createdAt"],
        rows: categories.map((c) => [
          c.id, c.slug, c.name, c.nameEn, c.isActive, c.sortOrder, c._count.products, iso(c.createdAt),
        ]),
      };
    },
  },

  // NOTE: the Brand model has no isActive/createdAt fields — those columns are
  // replaced by nameEn/country (documented in docs/contracts.md → Task 7).
  brands: {
    async build() {
      const brands = await db.brand.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { name: "asc" },
      });
      return {
        headers: ["id", "slug", "name", "nameEn", "country", "productCount"],
        rows: brands.map((b) => [b.id, b.slug, b.name, b.nameEn, b.country, b._count.products]),
      };
    },
  },

  orders: {
    async build(range) {
      const orders = await db.order.findMany({
        where: createdAtWhere(range),
        orderBy: { createdAt: "asc" },
      });
      return {
        headers: [
          "orderNumber", "customerName", "customerPhone", "status", "paymentStatus",
          "subtotalToman", "discountToman", "shippingCostToman", "totalToman",
          "couponCode", "trackingCode", "createdAt",
        ],
        rows: orders.map((o) => [
          o.orderNumber, o.customerName, o.customerPhone, o.status, o.paymentStatus,
          o.subtotalToman, o.discountToman, o.shippingCostToman, o.totalToman,
          o.couponCode, o.trackingCode, iso(o.createdAt),
        ]),
      };
    },
  },

  order_items: {
    async build(range) {
      const items = await db.orderItem.findMany({
        where: { order: createdAtWhere(range) },
        include: { order: { select: { orderNumber: true } } },
        orderBy: { orderId: "asc" },
      });
      return {
        headers: ["orderNumber", "productName", "sku", "variantText", "quantity", "unitPriceToman", "lineTotalToman"],
        rows: items.map((it) => [
          it.order.orderNumber, it.productName, it.productSku, it.variantText,
          it.quantity, it.unitPriceToman, it.lineTotalToman,
        ]),
      };
    },
  },

  reviews: {
    async build(range) {
      const reviews = await db.productReview.findMany({
        where: createdAtWhere(range),
        include: { product: { select: { slug: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        headers: ["id", "productSlug", "rating", "status", "title", "comment", "isVerifiedPurchase", "adminReply", "createdAt"],
        rows: reviews.map((r) => [
          r.id, r.product.slug, r.rating, r.status, r.title, r.comment,
          r.isVerifiedPurchase, r.adminReply, iso(r.createdAt),
        ]),
      };
    },
  },

  // Mapped to the ACTUAL InventoryMovement fields (the model has no variantText;
  // it carries refOrderNumber instead — see docs/contracts.md → Task 7).
  inventory_movements: {
    async build(range) {
      const movements = await db.inventoryMovement.findMany({
        where: createdAtWhere(range),
        include: { product: { select: { slug: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        headers: ["id", "productSlug", "type", "quantity", "reason", "refOrderNumber", "createdAt"],
        rows: movements.map((m) => [
          m.id, m.product.slug, m.type, m.quantity, m.reason, m.refOrderNumber, iso(m.createdAt),
        ]),
      };
    },
  },

  discounts: {
    async build(range) {
      const coupons = await db.coupon.findMany({
        where: createdAtWhere(range),
        orderBy: { createdAt: "asc" },
      });
      return {
        headers: [
          "code", "type", "value", "minOrderToman", "maxDiscountToman", "usageLimit",
          "perUserLimit", "timesUsed", "validFrom", "validUntil", "isActive", "createdAt",
        ],
        rows: coupons.map((c) => [
          c.code, c.type, c.value, c.minOrderToman, c.maxDiscountToman, c.usageLimit,
          c.perUserLimit, c.timesUsed, iso(c.validFrom), iso(c.validUntil), c.isActive, iso(c.createdAt),
        ]),
      };
    },
  },

  users: {
    adminOnly: true,
    async build(range) {
      // NEVER export passwordHash or any credential material.
      const users = await db.user.findMany({
        where: createdAtWhere(range),
        orderBy: { createdAt: "asc" },
      });
      return {
        headers: ["id", "name", "email", "phone", "role", "isActive", "createdAt"],
        rows: users.map((u) => [u.id, u.name, u.email, u.phone, u.role, u.isActive, iso(u.createdAt)]),
      };
    },
  },

  admin_audit_logs: {
    adminOnly: true,
    async build(range) {
      const logs = await db.auditLog.findMany({
        where: createdAtWhere(range),
        orderBy: { createdAt: "asc" },
      });
      return {
        headers: ["id", "actorId", "actorName", "action", "entity", "entityId", "detail", "createdAt"],
        rows: logs.map((l) => [
          l.id, l.actorId, l.actorName, l.action, l.entity, l.entityId,
          sanitizeAuditDetail(l.detail), iso(l.createdAt),
        ]),
      };
    },
  },
};

function csvResponse(entity: string, headers: string[], rows: CsvCell[][]): NextResponse {
  const now = new Date();
  const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const encoder = new TextEncoder();
  const iterator = csvChunks(headers, rows);
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = iterator.next();
      if (next.done) controller.close();
      else controller.enqueue(encoder.encode(next.value));
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entity}-${yyyymmdd}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRole(req, ["STAFF", "ADMIN"]);
  const sp = req.nextUrl.searchParams;
  const entity = sp.get("entity")?.trim() ?? "";

  const def = ENTITIES[entity];
  if (!def) {
    throw new ApiError(
      400,
      "UNKNOWN_ENTITY",
      `خروجی برای «${entity || "—"}» تعریف نشده است. موجودها: ${Object.keys(ENTITIES).join("، ")}`
    );
  }
  if (def.adminOnly && user.role !== "ADMIN") {
    throw new ApiError(403, "FORBIDDEN", "شما مجوز دسترسی به این بخش را ندارید.");
  }

  const range = parseRange(sp);
  const { headers, rows } = await def.build(range);

  await audit({ id: user.id, name: user.name }, "EXPORT_CSV", entity, null, {
    rowCount: rows.length,
    from: range.gte ? range.gte.toISOString() : null,
    to: range.lte ? range.lte.toISOString() : null,
  });

  return csvResponse(entity, headers, rows);
});
