import type { Metadata } from "next";
import { CartProvider } from "../lib/cart";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAZETTO FOOD",
  description: "Order fresh MAZETTO FOOD online for delivery or pickup.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
