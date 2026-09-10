import type { Metadata } from "next";
import { AuthProvider } from "../components/auth/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Mazetto Food boshqaruv paneli", template: "%s | Mazetto Food" },
  description: "Mazetto Food xodimlari uchun kassa, oshxona, kuryer va admin boshqaruv paneli.",
  applicationName: "Mazetto Food",
  icons: {
    icon: [
      { url: "/brand/mazetto-icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/mazetto-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/brand/mazetto-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
