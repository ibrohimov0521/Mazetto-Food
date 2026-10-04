import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { CartProvider } from "@/lib/cart";
import { routing } from "../../i18n/routing";
import "../globals.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isRussian = locale === "ru";

  return {
    metadataBase: new URL("https://mazettofood.uz"),
    title: {
      default: isRussian
        ? "Mazetto Food — фастфуд и доставка в Ташкенте"
        : "Mazetto Food - Toshkentda fast food va yetkazib berish",
      template: "%s | Mazetto Food",
    },
    description: isRussian
      ? "Официальный сайт Mazetto Food: лаваш, бургеры, хот-доги и сеты. Заказывайте онлайн с доставкой по Ташкенту или забирайте в филиале."
      : "Mazetto Food rasmiy sayti: lavash, burger, hot-dog va setlar. Toshkentda onlayn buyurtma, yetkazib berish yoki filialdan olib ketish.",
    applicationName: "Mazetto Food",
    icons: {
      icon: [
        {
          url: "/brand/mazetto-m-icon-192-v2.png",
          type: "image/png",
          sizes: "192x192",
        },
        {
          url: "/brand/mazetto-icon-512.png",
          type: "image/png",
          sizes: "512x512",
        },
      ],
      shortcut: [
        {
          url: "/brand/mazetto-m-icon-192-v2.png",
          type: "image/png",
          sizes: "192x192",
        },
      ],
      apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
    },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: isRussian ? "ru_RU" : "uz_UZ",
      siteName: "Mazetto Food",
      images: [
        {
          url: "/brand/mazetto-food-logo.webp",
          width: 2048,
          height: 895,
          alt: "Mazetto Food",
        },
      ],
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08686a",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <CartProvider>{children}</CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
