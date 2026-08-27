import type { Metadata } from "next";
import Script from "next/script";
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
    <html lang="uz" suppressHydrationWarning>
      <body>
        <Script id="mazetto-theme-init" strategy="beforeInteractive">
          {`
(() => {
  try {
    const saved = window.localStorage?.getItem("mazetto-theme");
    const theme = saved === "light" || saved === "dark" ? saved : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
          `}
        </Script>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
