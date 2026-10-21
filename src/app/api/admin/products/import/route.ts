import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, requireRole, audit, normalizeDigits, ApiError, ok } from "@/lib/server/api-helpers";
import { parseCsv, toCsv } from "@/lib/server/csv";
import { generateSku } from "@/lib/server/admin-products";

// POST /api/admin/products/import   (ADMIN only)
//   body: { csv: string, commit?: boolean }
//   commit=false (default) → dry-run: { totalRows, validCount, errorCount, errors, preview }
//   commit=true            → upsert by slug inside one $transaction → { created, updated }
// GET  /api/admin/products/import?template=1 → sample CSV (expected header + 2 example rows).
//
// Update policy (commit): only name / priceToman / originalPriceToman / stock /
// categoryId / brandId / isActive are overwritten — images, description, SKU,
// model and nameEn of existing products are never touched.

export const dynamic = "force-dynamic";

const IMPORT_HEADERS = [
  "slug", "name", "nameEn", "sku", "model", "categorySlug", "brandSlug",
  "priceToman", "originalPriceToman", "stock", "isActive",
];

const REQUIRED_HEADERS = ["slug", "name", "categorySlug", "brandSlug", "priceToman"];

const TEMPLATE_ROWS: string[][] = [
  [
    "tv-samsung-55au7000",
    "تلویزیون سامسونگ ۵۵ اینچ AU7000",
    "Samsung 55AU7000",
    "SAM-55AU7000",
    "UA55AU7000",
    "tv",
    "samsung",
    "32000000",
    "35500000",
    "4",
    "true",
  ],
  [
    "vacuum-philips-2000",
    "جاروبرقی فیلیپس ۲۰۰۰ وات",
    "Philips 2000W",
    "PHL-2000W",
    "FC9350",
    "vacuum",
    "philips",
    "14500000",
    "",
    "6",
    "true",
  ],
];

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["ADMIN"]);
  const sp = req.nextUrl.searchParams;
  if (sp.get("template")) {
    return new NextResponse(toCsv(IMPORT_HEADERS, TEMPLATE_ROWS), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="products-import-template.csv"',
        "Cache-Control": "no-store",
      },
    });
  }
  return ok({ headers: IMPORT_HEADERS, required: REQUIRED_HEADERS });
});

// ─── Parsing / validation ───────────────────────────────────────────────────

const cell = (v: string | undefined) => (v ?? "").trim();

/** "" → null | integer (Persian/Arabic digits + thousand separators accepted) | NaN */
function toIntOrNull(raw: string): number | null {
  const s = normalizeDigits(raw).replace(/[,٬\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : Number.NaN;
}

interface ImportRow {
  row: number;
  slug: string;
  name: string;
  nameEn: string | null;
  sku: string | null;
  model: string | null;
  categorySlug: string;
  brandSlug: string;
  priceToman: number;
  originalPriceToman: number | null;
  stock: number;
  isActive: boolean;
  existsInDb: boolean;
}

interface ValidationResult {
  totalRows: number;
  valid: ImportRow[];
  errors: { row: number; message: string }[];
}

async function validateCsv(csv: string): Promise<ValidationResult> {
  const parsed = parseCsv(csv);
  if (parsed.length === 0) {
    throw new ApiError(400, "EMPTY_CSV", "فایل CSV خالی است؛ سطر عنوان و حداقل یک سطر داده لازم است.");
  }

  const header = parsed[0].map((h) => h.trim().toLowerCase());
  const headerIdx = new Map<string, number>();
  header.forEach((h, i) => {
    if (!headerIdx.has(h)) headerIdx.set(h, i);
  });
  const colIdx = new Map<string, number>();
  IMPORT_HEADERS.forEach((h) => colIdx.set(h, headerIdx.get(h.toLowerCase()) ?? -1));
  const missing = REQUIRED_HEADERS.filter((h) => (colIdx.get(h) ?? -1) < 0);
  if (missing.length > 0) {
    throw new ApiError(
      400,
      "BAD_HEADER",
      `سطر عنوان CSV معتبر نیست؛ ستون‌های الزامی یافت نشدند: ${missing.join("، ")}`
    );
  }
  const get = (r: string[], name: string) => cell(r[colIdx.get(name) ?? -1]);

  const dataRows = parsed.slice(1);
  const errors: { row: number; message: string }[] = [];

  // DB lookups (case-sensitive slug maps).
  const slugVals = [...new Set(dataRows.map((r) => get(r, "slug")).filter(Boolean))];
  const catVals = [...new Set(dataRows.map((r) => get(r, "categorySlug")).filter(Boolean))];
  const brandVals = [...new Set(dataRows.map((r) => get(r, "brandSlug")).filter(Boolean))];

  const [dbCategories, dbBrands, dbBySlug] = await Promise.all([
    db.category.findMany({ where: { slug: { in: catVals } }, select: { slug: true, id: true } }),
    db.brand.findMany({ where: { slug: { in: brandVals } }, select: { slug: true, id: true } }),
    slugVals.length
      ? db.product.findMany({ where: { slug: { in: slugVals } }, select: { slug: true, sku: true } })
      : Promise.resolve([]),
  ]);
  const catMap = new Map(dbCategories.map((c) => [c.slug, c.id]));
  const brandMap = new Map(dbBrands.map((b) => [b.slug, b.id]));
  const dbSlugSet = new Set(dbBySlug.map((p) => p.slug));
  const dbSkuMap = new Map<string, string>(); // sku → slug (existing products)
  if (slugVals.length) {
    const skuRows = await db.product.findMany({
      where: { sku: { in: [...new Set(dataRows.map((r) => get(r, "sku")).filter(Boolean))] } },
      select: { slug: true, sku: true },
    });
    skuRows.forEach((p) => dbSkuMap.set(p.sku, p.slug));
  }

  const seenSlugs = new Map<string, number>(); // slug → first row
  const seenSkus = new Map<string, number>(); // sku → first row (within file)
  const valid: ImportRow[] = [];
  const invalidRows = new Set<number>();

  const fail = (row: number, message: string) => {
    errors.push({ row, message });
    invalidRows.add(row);
  };

  dataRows.forEach((r, i) => {
    const row = i + 1; // 1-based, counting data rows
    const slug = get(r, "slug");
    const name = get(r, "name");
    const nameEn = get(r, "nameEn") || null;
    const sku = get(r, "sku") || null;
    const model = get(r, "model") || null;
    const categorySlug = get(r, "categorySlug");
    const brandSlug = get(r, "brandSlug");
    const priceToman = toIntOrNull(get(r, "priceToman"));
    const originalPriceToman = toIntOrNull(get(r, "originalPriceToman"));
    const stock = toIntOrNull(get(r, "stock"));
    const isActiveRaw = get(r, "isActive").toLowerCase();

    let rowOk = true;
    const mark = (message: string) => {
      rowOk = false;
      fail(row, message);
    };

    // slug — required, well-formed, unique within the file
    if (!slug) mark("شناسه محصول (slug) الزامی است.");
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug))
      mark("شناسه محصول (slug) فقط می‌تواند شامل حروف لاتین، عدد و خط تیره باشد.");
    else if (seenSlugs.has(slug)) mark(`شناسه «${slug}» در سطر ${toFaRow(seenSlugs.get(slug)!)} تکراری است.`);
    else seenSlugs.set(slug, row);

    // name — required
    if (!name) mark("نام محصول الزامی است.");

    // priceToman — positive integer
    if (priceToman === null) mark("قیمت فروش (priceToman) الزامی است.");
    else if (Number.isNaN(priceToman) || priceToman <= 0)
      mark("قیمت فروش باید عدد صحیح مثبت باشد (تومان).");

    // originalPriceToman — optional, ≥ price when present
    if (originalPriceToman !== null) {
      if (Number.isNaN(originalPriceToman) || originalPriceToman < 0)
        mark("قیمت قبل از تخفیف باید عدد صحیح نامنفی باشد (تومان).");
      else if (priceToman !== null && !Number.isNaN(priceToman) && originalPriceToman < priceToman)
        mark("قیمت قبل از تخفیف باید بزرگ‌تر یا مساوی قیمت فروش باشد.");
    }

    // stock — optional, ≥ 0 integer (default 0)
    if (stock !== null && (Number.isNaN(stock) || stock < 0))
      mark("موجودی باید عدد صحیح بزرگ‌تر یا مساوی صفر باشد.");

    // isActive — optional, "true"/"false" (default true)
    let isActive = true;
    if (isActiveRaw !== "") {
      if (isActiveRaw === "true") isActive = true;
      else if (isActiveRaw === "false") isActive = false;
      else mark("مقدار ستون isActive باید true یا false باشد.");
    }

    // categorySlug / brandSlug — must exist in DB (case-sensitive)
    let categoryId: string | null = null;
    if (!categorySlug) mark("شناسه دسته‌بندی (categorySlug) الزامی است.");
    else {
      const id = catMap.get(categorySlug);
      if (!id) mark(`دسته‌بندی با شناسه «${categorySlug}» یافت نشد.`);
      else categoryId = id;
    }
    let brandId: string | null = null;
    if (!brandSlug) mark("شناسه برند (brandSlug) الزامی است.");
    else {
      const id = brandMap.get(brandSlug);
      if (!id) mark(`برند با شناسه «${brandSlug}» یافت نشد.`);
      else brandId = id;
    }

    // sku — optional; must be unique within the file and free in the DB for NEW slugs
    if (sku) {
      if (seenSkus.has(sku)) mark(`کد کالا (SKU) «${sku}» در سطر ${toFaRow(seenSkus.get(sku)!)} تکراری است.`);
      else seenSkus.set(sku, row);
      if (!dbSlugSet.has(slug) && dbSkuMap.has(sku) && dbSkuMap.get(sku) !== slug)
        mark(`کد کالا (SKU) «${sku}» قبلاً برای محصول دیگری ثبت شده است.`);
    }

    if (rowOk && categoryId && brandId && priceToman !== null && !Number.isNaN(priceToman)) {
      valid.push({
        row,
        slug,
        name,
        nameEn,
        sku,
        model,
        categorySlug,
        brandSlug,
        priceToman,
        originalPriceToman,
        stock: stock ?? 0,
        isActive,
        existsInDb: dbSlugSet.has(slug),
      });
    }
  });

  return { totalRows: dataRows.length, valid, errors };
}

/** Persian-digit row number for error copy (local helper). */
function toFaRow(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

// ─── POST ───────────────────────────────────────────────────────────────────

export const POST = handle(async (req: NextRequest) => {
  const admin = await requireRole(req, ["ADMIN"]);
  const body = (await req.json().catch(() => null)) as { csv?: unknown; commit?: unknown } | null;
  if (!body || typeof body.csv !== "string" || body.csv.trim() === "") {
    throw new ApiError(400, "BAD_REQUEST", "متن CSV ارسال نشده است.");
  }
  const commit = body.commit === true;

  const { totalRows, valid, errors } = await validateCsv(body.csv);

  if (!commit) {
    return ok({
      totalRows,
      validCount: valid.length,
      errorCount: errors.length,
      errors,
      preview: valid.slice(0, 5),
    });
  }

  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "IMPORT_ERRORS",
          message: `اعمال تغییرات انجام نشد؛ ${toFaRow(errors.length)} سطر نامعتبر است. ابتدا خطاها را برطرف کنید.`,
          errors,
        },
      },
      { status: 422 }
    );
  }

  const result = await db.$transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    for (const r of valid) {
      const categoryId = (await tx.category.findUnique({ where: { slug: r.categorySlug } }))?.id;
      const brandId = (await tx.brand.findUnique({ where: { slug: r.brandSlug } }))?.id;
      if (!categoryId || !brandId) {
        throw new ApiError(
          400,
          "TAXONOMY_MISSING",
          `دسته‌بندی یا برند سطر ${toFaRow(r.row)} حین ذخیره یافت نشد؛ عملیات لغو شد.`
        );
      }
      const existing = await tx.product.findUnique({ where: { slug: r.slug }, select: { id: true } });
      if (existing) {
        await tx.product.update({
          where: { id: existing.id },
          data: {
            name: r.name,
            priceToman: r.priceToman,
            originalPriceToman: r.originalPriceToman,
            stock: r.stock,
            categoryId,
            brandId,
            isActive: r.isActive,
          },
        });
        updated += 1;
      } else {
        await tx.product.create({
          data: {
            slug: r.slug,
            name: r.name,
            nameEn: r.nameEn,
            sku: r.sku || generateSku(),
            model: r.model,
            categoryId,
            brandId,
            description: `${r.name}\n\nتوضیحات کامل این محصول از طریق ورود گروهی ایجاد شده و به‌زودی تکمیل می‌شود.`,
            priceToman: r.priceToman,
            originalPriceToman: r.originalPriceToman,
            stock: r.stock,
            isActive: r.isActive,
            isPriceManual: true,
          },
        });
        created += 1;
      }
    }
    return { created, updated };
  });

  await audit({ id: admin.id, name: admin.name }, "IMPORT_CSV", "Product", null, {
    created: result.created,
    updated: result.updated,
    slugs: valid.map((r) => r.slug),
  });

  return ok(result);
});
