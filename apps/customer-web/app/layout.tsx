import type { Metadata } from "next";
import { CartProvider } from "../lib/cart";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAZETTO FOOD",
  description: "MAZETTO FOOD'dan issiq fast-fud buyurtma qiling.",
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
