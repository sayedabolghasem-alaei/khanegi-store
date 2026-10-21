"use client";
// Static Persian pages (#/page/:slug) — about, contact, faq, shipping,
// returns, privacy, terms, warranty. Content: src/data/static-pages.ts.

import { useEffect, useState } from "react";
import { AlertCircle, Info, Send } from "lucide-react";
import { toast } from "sonner";
import { STATIC_PAGES } from "@/data/static-pages";
import type { PageBlock } from "@/data/static-pages";
import { href, navigate } from "@/lib/router";
import { EmptyState } from "@/components/store/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function Block({ block }: { block: PageBlock }) {
  switch (block.type) {
    case "h2":
      return <h2>{block.text}</h2>;
    case "h3":
      return <h3>{block.text}</h3>;
    case "p":
      return <p>{block.text}</p>;
    case "ul":
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="my-4 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="bg-muted/60">
                {block.head.map((h, i) => (
                  <th key={i} className="p-3 text-start font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/30"}>
                  {row.map((cell, j) => (
                    <td key={j} className="p-3 align-top">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note":
      return (
        <div className="my-4 flex items-start gap-2.5 rounded-xl bg-highlight-soft p-4 text-[13px] leading-7 text-accent-foreground">
          <Info className="mt-1 size-4 shrink-0" aria-hidden />
          <p>{block.text}</p>
        </div>
      );
    default:
      return null;
  }
}

function ContactForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  // Client-side only (demo): stores nothing on a server.
  return (
    <form
      className="my-6 space-y-4 rounded-xl border bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim().length < 3 || message.trim().length < 10) {
          toast.warning("لطفاً نام و متن پیام را کامل وارد کنید.");
          return;
        }
        toast.success("پیام شما ثبت شد (نمایشی — ارسال به سرور انجام نشد). [نشان‌گذاری آزمایشی]");
        setName("");
        setPhone("");
        setMessage("");
      }}
    >
      <p className="font-bold">فرم تماس با ما</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-name">نام و نام خانوادگی *</Label>
          <Input
            id="contact-name"
            className="mt-1.5 bg-white"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="contact-phone">شماره تماس (اختیاری)</Label>
          <Input
            id="contact-phone"
            inputMode="tel"
            dir="ltr"
            className="mt-1.5 bg-white text-right"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="contact-message">متن پیام *</Label>
        <Textarea
          id="contact-message"
          rows={4}
          className="mt-1.5 bg-white"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="سؤال یا پیام خود را بنویسید…"
        />
      </div>
      <Button type="submit" className="font-bold">
        <Send className="size-4" aria-hidden />
        ارسال پیام
      </Button>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertCircle className="size-3.5" aria-hidden />
        این فرم در نسخه نمایشی فقط پیام را به‌صورت محلی ثبت می‌کند.
      </p>
    </form>
  );
}

export function StaticPage({ slug }: { slug: string }) {
  const page = STATIC_PAGES[slug];

  useEffect(() => {
    document.title = page ? page.title : "صفحه یافت نشد";
  }, [page]);

  if (!page) {
    return (
      <div className="container-store py-10">
        <EmptyState
          title="صفحه مورد نظر یافت نشد"
          description="ممکن است نشانی را اشتباه وارد کرده باشید."
          action={<Button onClick={() => navigate("/")}>بازگشت به صفحه اصلی</Button>}
        />
      </div>
    );
  }

  return (
    <div className="container-store max-w-4xl py-8">
      {/* Breadcrumbs */}
      <nav aria-label="مسیر صفحه" className="mb-5 text-[13px] text-muted-foreground">
        <a href={href("/")} className="transition-colors hover:text-highlight">خانه</a>
        <span className="mx-1.5">/</span>
        <span className="font-bold text-foreground">{page.title}</span>
      </nav>

      <header className="mb-6 border-b pb-5">
        <h1 className="text-2xl font-black">{page.title}</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{page.subtitle}</p>
      </header>

      <article className="prose-fa">
        {page.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}

        {page.showContactForm && <ContactForm />}

        {page.faq && (
          <Accordion type="single" collapsible className="mt-4 rounded-xl border bg-white px-4">
            {page.faq.map((f, i) => (
              <AccordionItem key={i} value={`q-${i}`} className="last:border-b-0">
                <AccordionTrigger className="text-start text-sm font-bold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-7 text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </article>
    </div>
  );
}
