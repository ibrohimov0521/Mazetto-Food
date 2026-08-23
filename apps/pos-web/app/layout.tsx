import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAZETTO FOOD POS",
  description: "MAZETTO FOOD POS foundation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
