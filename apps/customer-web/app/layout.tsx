import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAZETTO FOOD Customer Web",
  description: "MAZETTO FOOD customer web foundation",
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
