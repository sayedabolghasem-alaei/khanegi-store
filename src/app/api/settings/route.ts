// Public store settings — non-sensitive subset only (store_contact +
// store_commerce + seo). No secrets live in SiteSettings today; this route is
// an explicit allow-list so a future private key can never leak by accident.

import { ok, handle } from "@/lib/server/api-helpers";
import { getPublicStoreSettings } from "@/lib/server/site-settings";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const settings = await getPublicStoreSettings();
  return ok({ settings });
});
