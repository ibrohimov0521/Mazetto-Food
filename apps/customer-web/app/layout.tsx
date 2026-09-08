import type { Metadata, Viewport } from "next";
import { CartProvider } from "../lib/cart";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mazettofood.uz"),
  title: {
    default: "Mazetto Food - Toshkentda fast food va yetkazib berish",
    template: "%s | Mazetto Food",
  },
  description:
    "Mazetto Food rasmiy sayti: lavash, burger, hot-dog va setlar. Toshkentda onlayn buyurtma, yetkazib berish yoki filialdan olib ketish.",
  applicationName: "Mazetto Food",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "uz_UZ",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08686a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
