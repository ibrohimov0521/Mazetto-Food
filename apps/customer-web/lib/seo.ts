import type { Metadata } from "next";
export const siteUrl = "https://mazettofood.uz";
export function pageMetadata(title: string, description: string, path: string, image?: string | null): Metadata {
  return {
    title, description, alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: "Mazetto Food", type: "website", locale: "uz_UZ", images: [image || "/brand/mazetto-food-logo.webp"] },
    twitter: { card: "summary_large_image", title, description, images: [image || "/brand/mazetto-food-logo.webp"] },
  };
}
export function jsonLd(data: unknown): string { return JSON.stringify(data).replace(/</g, "\\u003c"); }
