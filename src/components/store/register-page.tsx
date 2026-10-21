"use client";
// Register page (#/register?redirect=...).

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/client-api";
import { navigate, useHashLocation } from "@/lib/router";
import type { UserDTO } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const registerSchema = z
  .object({
    name: z.string().min(3, "نام و نام خانوادگی باید حداقل ۳ حرف باشد."),
    phone: z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود."),
    email: z
      .string()
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "ایمیل معتبر نیست.")
      .optional()
      .or(z.literal("")),
    password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد."),
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v === true, "پذیرش قوانین الزامی است."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "تکرار رمز عبور با رمز عبور یکسان نیست.",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { user } = useAuth();
  const { query } = useHashLocation();
  const qc = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  // Freeze at mount — see login-page note about AnimatePresence exit race.
  const [redirect] = useState(() => query.get("redirect") ?? "/account");

  useEffect(() => {
    document.title = "ثبت‌نام";
    if (user) navigate(redirect, { replace: true });
  }, [user, redirect]);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", phone: "", email: "", password: "", confirmPassword: "", acceptTerms: false },
  });

  const register = useMutation({
    mutationFn: (values: RegisterForm) =>
      apiPost<{ user: UserDTO }>("/api/auth/register", {
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        password: values.password,
      }),
    onSuccess: ({ user: u }) => {
      qc.setQueryData(["me"], { user: u });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
      toast.success(`${u.name} عزیز، حساب شما ساخته شد. خوش آمدید!`);
      navigate(redirect, { replace: true });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const err = (k: keyof RegisterForm) => form.formState.errors[k]?.message as string | undefined;

  return (
    <div className="container-store flex justify-center py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-white p-6 sm:p-8">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-highlight-soft text-highlight">
              <UserPlus className="size-6" aria-hidden />
            </span>
            <h1 className="text-xl font-extrabold">ساخت حساب کاربری</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              در کمتر از یک دقیقه عضو خانواده خانه‌گی شوید.
            </p>
          </div>

          <form className="space-y-4" onSubmit={form.handleSubmit((v) => register.mutate(v))} noValidate>
            <div>
              <Label htmlFor="reg-name">نام و نام خانوادگی *</Label>
              <Input id="reg-name" className="mt-1.5 h-11 bg-white" autoComplete="name" {...form.register("name")} />
              {err("name") && <p className="mt-1 text-xs text-destructive">{err("name")}</p>}
            </div>

            <div>
              <Label htmlFor="reg-phone">شماره موبایل *</Label>
              <Input
                id="reg-phone"
                inputMode="numeric"
                dir="ltr"
                placeholder="09xxxxxxxxx"
                className="mt-1.5 h-11 bg-white text-right"
                autoComplete="tel"
                {...form.register("phone")}
              />
              {err("phone") && <p className="mt-1 text-xs text-destructive">{err("phone")}</p>}
            </div>

            <div>
              <Label htmlFor="reg-email">ایمیل (اختیاری)</Label>
              <Input
                id="reg-email"
                type="email"
                dir="ltr"
                className="mt-1.5 h-11 bg-white text-right"
                autoComplete="email"
                {...form.register("email")}
              />
              {err("email") && <p className="mt-1 text-xs text-destructive">{err("email")}</p>}
            </div>

            <div>
              <Label htmlFor="reg-password">رمز عبور *</Label>
              <div className="relative mt-1.5">
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  className="h-11 bg-white pl-10 text-right"
                  autoComplete="new-password"
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
              {err("password") && <p className="mt-1 text-xs text-destructive">{err("password")}</p>}
            </div>

            <div>
              <Label htmlFor="reg-confirm">تکرار رمز عبور *</Label>
              <Input
                id="reg-confirm"
                type={showPassword ? "text" : "password"}
                dir="ltr"
                className="mt-1.5 h-11 bg-white text-right"
                autoComplete="new-password"
                {...form.register("confirmPassword")}
              />
              {err("confirmPassword") && (
                <p className="mt-1 text-xs text-destructive">{err("confirmPassword")}</p>
              )}
            </div>

            <div>
              <label className="flex cursor-pointer items-start gap-2 text-[13px]">
                <Checkbox
                  className="mt-0.5"
                  checked={form.watch("acceptTerms")}
                  onCheckedChange={(v) => form.setValue("acceptTerms", v === true, { shouldValidate: true })}
                  aria-label="پذیرش قوانین"
                />
                <span className="leading-6 text-muted-foreground">
                  <button
                    type="button"
                    className="font-bold text-highlight hover:underline"
                    onClick={() => navigate("/page/terms")}
                  >
                    شرایط و قوانین
                  </button>{" "}
                  خانه‌گی را می‌پذیرم. *
                </span>
              </label>
              {err("acceptTerms") && <p className="mt-1 text-xs text-destructive">{err("acceptTerms")}</p>}
            </div>

            <Button type="submit" className="h-11 w-full font-bold" disabled={register.isPending}>
              {register.isPending ? "در حال ثبت…" : "ثبت‌نام"}
            </Button>
          </form>

          <p className="mt-5 text-center text-[13px] text-muted-foreground">
            قبلاً ثبت‌نام کرده‌اید؟{" "}
            <button
              type="button"
              className="font-bold text-highlight hover:underline"
              onClick={() => navigate(`/login?redirect=${encodeURIComponent(redirect)}`)}
            >
              وارد شوید
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
