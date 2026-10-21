"use client";
// Login page (#/login?redirect=...).

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Info, LogIn } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/client-api";
import { navigate, useHashLocation } from "@/lib/router";
import { DEMO_CUSTOMER } from "@/lib/constants";
import type { UserDTO } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  phone: z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود."),
  password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد."),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { user } = useAuth();
  const { query } = useHashLocation();
  const qc = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  // Freeze the destination at mount: during the AnimatePresence exit (URL already
  // changed) the live query would be empty and would otherwise redirect to /account.
  const [redirect] = useState(() => query.get("redirect") ?? "/account");

  useEffect(() => {
    document.title = "ورود به حساب کاربری";
    if (user) navigate(redirect, { replace: true });
  }, [user, redirect]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });

  const login = useMutation({
    mutationFn: (values: LoginForm) => apiPost<{ user: UserDTO }>("/api/auth/login", values),
    onSuccess: ({ user: u }) => {
      qc.setQueryData(["me"], { user: u });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success(`${u.name} عزیز، خوش آمدید!`);
      navigate(redirect, { replace: true });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="container-store flex justify-center py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-white p-6 sm:p-8">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-highlight-soft text-highlight">
              <LogIn className="size-6" aria-hidden />
            </span>
            <h1 className="text-xl font-extrabold">ورود به حساب کاربری</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              برای پیگیری سفارش‌ها و خرید سریع‌تر وارد شوید.
            </p>
          </div>

          <form className="space-y-4" onSubmit={form.handleSubmit((v) => login.mutate(v))} noValidate>
            <div>
              <Label htmlFor="login-phone">شماره موبایل</Label>
              <Input
                id="login-phone"
                inputMode="numeric"
                dir="ltr"
                placeholder="09xxxxxxxxx"
                className="mt-1.5 h-11 bg-white text-right"
                autoComplete="tel"
                {...form.register("phone")}
              />
              {form.formState.errors.phone && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.phone.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="login-password">رمز عبور</Label>
              <div className="relative mt-1.5">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  className="h-11 bg-white pl-10 text-right"
                  autoComplete="current-password"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "پنهان‌کردن رمز" : "نمایش رمز"}
                  className="absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="h-11 w-full font-bold"
              disabled={login.isPending}
            >
              {login.isPending ? "در حال ورود…" : "ورود"}
            </Button>
          </form>

          <div className="mt-5 flex items-start gap-2 rounded-lg bg-highlight-soft p-3 text-xs leading-6 text-accent-foreground">
            <Info className="mt-1 size-4 shrink-0" aria-hidden />
            <p>
              حساب نمایشی: <span dir="ltr" className="font-bold">{DEMO_CUSTOMER.phone}</span> /{" "}
              <span dir="ltr" className="font-bold">{DEMO_CUSTOMER.password}</span>
              [نشان‌گذاری آزمایشی]
            </p>
          </div>

          <p className="mt-5 text-center text-[13px] text-muted-foreground">
            حساب کاربری ندارید؟{" "}
            <button
              type="button"
              className="font-bold text-highlight hover:underline"
              onClick={() => navigate(`/register?redirect=${encodeURIComponent(redirect)}`)}
            >
              ثبت‌نام کنید
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
