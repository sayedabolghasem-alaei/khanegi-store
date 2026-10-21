// Admin image upload — local-disk adapter (public/uploads).
// ⚠️ در تولید با Supabase Storage جایگزین شود — این فایل تنها نقطهٔ اتصال
// (adapter point) است: POST آپلود و DELETE حذف، هر دو اینجا متمرکزند تا
// مهاجرت به object storage فقط با تغییر همین route انجام شود.
//
// POST  multipart/form-data, field `file` — mime ∈ {jpeg,png,webp}, ≤ 2MB.
// DELETE ?url=/uploads/<name> — refuses paths escaping /uploads, refuses
//         URLs still referenced by a ProductImage row (409), then unlinks.

import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { ok, handle, requireRole, audit, ApiError } from "@/lib/server/api-helpers";

export const dynamic = "force-dynamic";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB

// /uploads/<safe-name> — letters, digits, dot, underscore, dash only (no "..",
// no separators) so the resolved path can never escape the uploads directory.
const SAFE_URL_RE = /^\/uploads\/[A-Za-z0-9._-]+$/;

export const POST = handle(async (req: NextRequest) => {
  const admin = await requireRole(req, ["ADMIN"]);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "درخواست نامعتبر است؛ فایل ارسال نشده است.");
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    throw new ApiError(400, "FILE_REQUIRED", "فایل تصویری ارسال نشده است.");
  }

  const mime = file.type || "";
  const ext = MIME_EXT[mime];
  if (!ext) {
    throw new ApiError(
      422,
      "FILE_TYPE_INVALID",
      "فقط تصاویر با فرمت JPG، PNG یا WebP پذیرفته می‌شوند."
    );
  }
  if (file.size <= 0) {
    throw new ApiError(422, "FILE_EMPTY", "فایل ارسال‌شده خالی است.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(422, "FILE_TOO_LARGE", "حجم تصویر باید حداکثر ۲ مگابایت باشد.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = `p-${crypto.randomUUID()}.${ext}`;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOADS_DIR, name), buffer);

  const url = `/uploads/${name}`;
  await audit({ id: admin.id, name: admin.name }, "UPLOAD_IMAGE", "ProductImage", null, { url });

  return ok({ url }, 201);
});

export const DELETE = handle(async (req: NextRequest) => {
  const admin = await requireRole(req, ["ADMIN"]);

  const url = (req.nextUrl.searchParams.get("url") ?? "").trim();
  if (!url || !SAFE_URL_RE.test(url) || url.includes("..")) {
    throw new ApiError(400, "URL_INVALID", "آدرس تصویر نامعتبر است.");
  }

  const inUse = await db.productImage.count({ where: { url } });
  if (inUse > 0) {
    throw new ApiError(409, "IMAGE_IN_USE", "تصویر در حال استفاده است و قابل حذف نیست.");
  }

  const fileName = path.basename(url); // SAFE_URL_RE guarantees a flat name
  const filePath = path.join(UPLOADS_DIR, fileName);
  try {
    await fs.unlink(filePath);
  } catch {
    // File already gone — the delete request is still satisfied (idempotent).
  }

  await audit({ id: admin.id, name: admin.name }, "DELETE_IMAGE", "ProductImage", null, { url });

  return ok({ ok: true });
});
