"use client";
// Sticky storefront header: logo, search, account, wishlist, cart, mobile menu.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Heart,
  LogOut,
  MapPin,
  Menu,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  User,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/store/logo";
import { SearchBox } from "@/components/store/search-box";
import { MobileMenu } from "@/components/store/mobile-menu";
import { useCategoriesMeta } from "@/hooks/use-catalog-meta";
import { useAuth, logoutRequest } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { useUIStore } from "@/lib/store";
import { href, navigate } from "@/lib/router";
import { toast } from "sonner";
import { toFaDigits } from "@/lib/money";
import { SITE_NAME } from "@/lib/constants";

export function Header() {
  const { items: CATEGORIES } = useCategoriesMeta();
  const { user } = useAuth();
  const { cart } = useCart();
  const { data: wishlist } = useWishlist(!!user);
  const setCartOpen = useUIStore((s) => s.setCartOpen);
  const [searchOpen, setSearchOpen] = useState(false);
  const qc = useQueryClient();

  const cartCount = cart?.itemCount ?? 0;
  const wishlistCount = user ? (wishlist?.items.length ?? 0) : 0;

  const logout = useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      qc.setQueryData(["me"], { user: null });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success("از حساب خود خارج شدید. به امید دیدار دوباره!");
      navigate("/");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 shadow-[0_1px_0_0_rgba(0,0,0,0.02)] backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="container-store flex h-16 items-center gap-3">
        {/* Mobile: menu + search triggers */}
        <div className="flex items-center gap-1 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="باز کردن منو">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto p-0">
              <SheetHeader className="border-b p-4">
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <MobileMenu />
            </SheetContent>
          </Sheet>

          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="جستجو">
                <Search className="size-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="top-20 translate-y-0 p-4 sm:top-24">
              <DialogHeader className="sr-only">
                <DialogTitle>جستجو در {SITE_NAME}</DialogTitle>
              </DialogHeader>
              <SearchBox variant="mobile" autoFocus onDone={() => setSearchOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <Logo />

        {/* Desktop search */}
        <div className="mx-auto hidden w-full max-w-xl px-4 lg:block">
          <SearchBox variant="desktop" />
        </div>

        <div className="ms-auto flex items-center gap-1 lg:ms-0">
          {/* Account */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-11 gap-1.5 px-2.5" aria-label="حساب کاربری">
                <UserCircle2 className="size-5" />
                <span className="hidden max-w-24 truncate text-sm font-medium sm:inline">
                  {user ? user.name : "ورود"}
                </span>
                <ChevronDown className="hidden size-3.5 text-muted-foreground sm:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user ? (
                <>
                  <DropdownMenuLabel>
                    <span className="block truncate">{user.name}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground" dir="ltr">
                      {toFaDigits(user.phone)}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/account")}>
                    <User className="size-4" /> حساب کاربری
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/account/orders")}>
                    <Package className="size-4" /> سفارش‌های من
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/account/addresses")}>
                    <MapPin className="size-4" /> آدرس‌های من
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/wishlist")}>
                    <Heart className="size-4" /> علاقه‌مندی‌ها
                  </DropdownMenuItem>
                  {(user.role === "STAFF" || user.role === "ADMIN") && (
                    <DropdownMenuItem onClick={() => navigate("/admin/overview")}>
                      <ShieldCheck className="size-4" /> پنل مدیریت
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => logout.mutate()}
                    disabled={logout.isPending}
                  >
                    <LogOut className="size-4" /> خروج از حساب
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => navigate("/login")}>
                    <User className="size-4" /> ورود به حساب
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/register")}>
                    <Settings className="size-4" /> ثبت‌نام
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Wishlist */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-11 w-11"
            aria-label={`علاقه‌مندی‌ها${wishlistCount ? ` (${toFaDigits(String(wishlistCount))})` : ""}`}
            onClick={() => (user ? navigate("/wishlist") : navigate("/login?redirect=/wishlist"))}
          >
            <Heart className="size-5" />
            {wishlistCount > 0 && (
              <Badge className="absolute -top-1 -end-1 h-5 min-w-5 rounded-full px-1 tabular-fa text-[10px]">
                {toFaDigits(String(wishlistCount))}
              </Badge>
            )}
          </Button>

          {/* Cart */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-11 w-11"
            aria-label={`سبد خرید (${toFaDigits(String(cartCount))})`}
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBasket className="size-5" />
            {cartCount > 0 && (
              <Badge className="absolute -top-1 -end-1 h-5 min-w-5 rounded-full bg-highlight px-1 tabular-fa text-[10px] text-highlight-foreground">
                {toFaDigits(String(cartCount))}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Category nav (desktop) */}
      <div className="hidden border-t lg:block">
        <div className="container-store">
          <nav aria-label="دسته‌بندی محصولات" className="flex h-11 items-center gap-1 overflow-x-auto">
            {CATEGORIES.map((c) => (
              <a
                key={c.slug}
                href={href(`/category/${c.slug}`)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <c.icon className="size-4 text-highlight" aria-hidden />
                {c.name}
              </a>
            ))}
            <Separator orientation="vertical" className="mx-2 h-5" />
            <a
              href={href("/compare")}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              مقایسه محصولات
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
