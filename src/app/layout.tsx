import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/constants";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ariakhaneh.example"),
  title: {
    default: `فروشگاه لوازم خانگی ${SITE_NAME} | خرید آنلاین با گارانتی رسمی`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "لوازم خانگی",
    "یخچال",
    "ماشین لباسشویی",
    "ماشین ظرفشویی",
    "تلویزیون",
    "خرید آنلاین",
    SITE_NAME,
  ],
  icons: { icon: "/logo.svg" },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: SITE_NAME,
    title: `فروشگاه لوازم خانگی ${SITE_NAME} | خرید آنلاین با گارانتی رسمی`,
    description: SITE_DESCRIPTION,
    url: "https://ariakhaneh.example",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#2c3653",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazirmatn.variable} antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
