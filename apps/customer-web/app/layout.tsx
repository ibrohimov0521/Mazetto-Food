import type { Metadata, Viewport } from "next";
import { CartProvider } from "../lib/cart";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAZETTO FOOD",
  description: "MAZETTO FOOD'dan issiq fast-fud buyurtma qiling.",
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
