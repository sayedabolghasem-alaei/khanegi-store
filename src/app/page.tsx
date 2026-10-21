"use client";
// خانه‌گی — storefront SPA. The sandbox exposes a single route (/), so all
// views render here via the hash router (src/lib/router.ts).

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Providers } from "@/components/store/providers";
import { AnnouncementBar } from "@/components/store/announcement-bar";
import { Header } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { CartDrawer } from "@/components/store/cart-drawer";
import { ScrollToTop } from "@/components/store/scroll-to-top";
import { HomePage } from "@/components/store/home-page";
import { CatalogPage } from "@/components/store/catalog-page";
import { ProductPage } from "@/components/store/product-page";
import { CartPage } from "@/components/store/cart-page";
import { CheckoutPage } from "@/components/store/checkout-page";
import { OrderPage } from "@/components/store/order-page";
import { LoginPage } from "@/components/store/login-page";
import { RegisterPage } from "@/components/store/register-page";
import { AccountPage } from "@/components/store/account-page";
import { WishlistPage } from "@/components/store/wishlist-page";
import { ComparePage } from "@/components/store/compare-page";
import { StaticPage } from "@/components/store/static-page";
import { NotFoundPage } from "@/components/store/not-found-page";
import { useHashLocation } from "@/lib/router";
import { AdminArea } from "@/components/admin/admin-area";

function CurrentView({ path }: { path: string }) {
  const segments = useMemo(() => path.split("/").filter(Boolean), [path]);

  // ── Home
  if (path === "/" || segments.length === 0) return <HomePage />;

  switch (segments[0]) {
    case "category":
      return segments[1] ? (
        <CatalogPage mode="category" categorySlug={segments[1]} />
      ) : (
        <NotFoundPage path={path} />
      );

    case "search":
      return <CatalogPage mode="search" />;

    case "product":
      // key ensures qty/variant/gallery state resets between products
      return segments[1] ? (
        <ProductPage key={segments[1]} slug={segments[1]} />
      ) : (
        <NotFoundPage path={path} />
      );

    case "cart":
      return <CartPage />;

    case "checkout":
      return <CheckoutPage />;

    case "order":
      return segments[1] ? <OrderPage orderNumber={segments[1]} /> : <NotFoundPage path={path} />;

    case "account": {
      const tab = segments[1];
      if (!tab) return <AccountPage tab="overview" />;
      if (tab === "orders") return <AccountPage tab="orders" />;
      if (tab === "profile") return <AccountPage tab="profile" />;
      if (tab === "addresses") return <AccountPage tab="addresses" />;
      return <NotFoundPage path={path} />;
    }

    case "wishlist":
      return <WishlistPage />;

    case "compare":
      return <ComparePage />;

    case "login":
      return <LoginPage />;

    case "register":
      return <RegisterPage />;

    case "page":
      return segments[1] ? <StaticPage slug={segments[1]} /> : <NotFoundPage path={path} />;

    default:
      return <NotFoundPage path={path} />;
  }
}

function Shell() {
  const { path } = useHashLocation();
  const reduceMotion = useReducedMotion();
  const isAdminRoute = path === "/admin" || path.startsWith("/admin/");
  const segments = useMemo(() => path.split("/").filter(Boolean), [path]);

  // Keep <html lang/dir> correct on first paint for the SPA (defensive; set in layout too)
  useEffect(() => {
    document.documentElement.lang = "fa";
    document.documentElement.dir = "rtl";
  }, []);

  // Admin renders its own chrome (sidebar, guard) — independent of store header/footer.
  if (isAdminRoute) {
    return <AdminArea segments={segments} />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar />
      <Header />
      <main className="flex-1" id="main-content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={path}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <CurrentView path={path} />
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <CartDrawer />
      <ScrollToTop />
    </div>
  );
}

export default function Page() {
  return (
    <Providers>
      <Shell />
    </Providers>
  );
}
