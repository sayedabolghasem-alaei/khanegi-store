"use client";
// Admin hash-route switch: #/admin/** → views, wrapped in the admin shell
// (sidebar + auth guard). Sandbox exposes only "/" so routing is hash-based.

import { ShieldQuestion } from "lucide-react";
import { navigate } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminOverview } from "@/components/admin/overview";
import { AdminProductsList } from "@/components/admin/products-list";
import { AdminProductForm } from "@/components/admin/product-form";
import { AdminOrdersList } from "@/components/admin/orders-list";
import { AdminOrderDetail } from "@/components/admin/order-detail";
import { AdminPricingPage } from "@/components/admin/pricing-page";
import { AdminInventoryPage } from "@/components/admin/inventory-page";
import { AdminCouponsPage } from "@/components/admin/coupons-page";
import { AdminUsersPage } from "@/components/admin/users-page";
import { AdminReviewsPage } from "@/components/admin/reviews-page";
import { AdminReportsPage } from "@/components/admin/reports-page";
import { AdminSettingsPage } from "@/components/admin/settings-page";
import AdminExportsPage from "@/components/admin/exports-page";

function AdminNotFound({ path }: { path: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <ShieldQuestion className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-extrabold">صفحه مدیریتی یافت نشد</h1>
      <p dir="ltr" className="mt-1 font-mono text-xs text-muted-foreground">
        {path}
      </p>
      <Button className="mt-5 font-bold" onClick={() => navigate("/admin/overview")}>
        بازگشت به داشبورد
      </Button>
    </div>
  );
}

export function AdminArea({ segments }: { segments: string[] }) {
  // segments excludes the leading "admin"
  const sub = segments[0] === "admin" ? segments.slice(1) : segments;
  const [first, second] = sub;

  let view: React.ReactNode;
  if (!first || first === "overview") {
    view = <AdminOverview />;
  } else if (first === "products" && second === "new") {
    view = <AdminProductForm key="new" id={null} />;
  } else if (first === "products" && second) {
    view = <AdminProductForm key={second} id={second} />;
  } else if (first === "products") {
    view = <AdminProductsList />;
  } else if (first === "orders" && second) {
    view = <AdminOrderDetail key={second} id={second} />;
  } else if (first === "orders") {
    view = <AdminOrdersList />;
  } else if (first === "pricing") {
    view = <AdminPricingPage />;
  } else if (first === "inventory") {
    view = <AdminInventoryPage />;
  } else if (first === "coupons") {
    view = <AdminCouponsPage />;
  } else if (first === "users") {
    view = <AdminUsersPage />;
  } else if (first === "reviews") {
    view = <AdminReviewsPage />;
  } else if (first === "reports") {
    view = <AdminReportsPage />;
  } else if (first === "settings") {
    view = <AdminSettingsPage />;
  } else if (first === "exports") {
    view = <AdminExportsPage />;
  } else {
    view = <AdminNotFound path={`/#/admin/${sub.join("/")}`} />;
  }

  return <AdminShell>{view}</AdminShell>;
}
