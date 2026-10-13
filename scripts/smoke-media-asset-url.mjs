export function resolveMediaAssetUrl(image, mediaBaseUrl) {
  if (typeof image !== "string" || !image.trim()) {
    throw new Error("media URL bo'sh");
  }

  const base = new URL(mediaBaseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  ) {
    throw new Error("media origin noto'g'ri sozlangan");
  }

  const value = image.trim();
  if (/^[\\/]{2}/.test(value)) {
    throw new Error("media URL boshqa hostga yo'naltirilgan");
  }

  const target = new URL(
    value,
    base.href.endsWith("/") ? base.href : `${base.href}/`,
  );
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.origin !== base.origin ||
    target.username ||
    target.password
  ) {
    throw new Error("media URL faqat sozlangan media hostidan bo'lishi kerak");
  }

  return target.href;
}
