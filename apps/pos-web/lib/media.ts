"use client";

const fallbackImage = "/mazetto-fallback.webp";

export function productImage(imageUrl?: string | null): string {
  if (!imageUrl) {
    return fallbackImage;
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL?.replace(/\/$/, "");
    return mediaUrl ? `${mediaUrl}${imageUrl}` : imageUrl;
  }

  return imageUrl;
}
