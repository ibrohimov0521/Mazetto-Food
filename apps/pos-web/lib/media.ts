"use client";

const defaultMediaUrl = "https://media.mazettofood.uz";

export const fallbackImage =
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
  <defs>
    <radialGradient id="glow" cx="50%" cy="24%" r="70%">
      <stop offset="0%" stop-color="#0b7770"/>
      <stop offset="55%" stop-color="#073f3b"/>
      <stop offset="100%" stop-color="#052a28"/>
    </radialGradient>
  </defs>
  <rect width="640" height="480" fill="url(#glow)"/>
  <circle cx="320" cy="214" r="74" fill="#ffd52e" opacity=".16"/>
  <text x="320" y="226" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="900" fill="#ffd52e">MAZETTO</text>
  <text x="320" y="268" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#fffaf0">FOOD</text>
</svg>
`)}`;

export function productImage(imageUrl?: string | null): string {
  if (!imageUrl) {
    return fallbackImage;
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    return `${getMediaUrl()}${imageUrl}`;
  }

  return `${getMediaUrl()}/${imageUrl.replace(/^\/+/, "")}`;
}

export function handleProductImageError(image: HTMLImageElement): void {
  if (image.src !== fallbackImage) {
    image.src = fallbackImage;
  }
}

function getMediaUrl(): string {
  return (process.env.NEXT_PUBLIC_MEDIA_URL || defaultMediaUrl).replace(/\/$/, "");
}
