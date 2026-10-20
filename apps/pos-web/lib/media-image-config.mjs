const DEFAULT_MEDIA_URL = "https://media.mazettofood.uz";

/** @param {string | undefined} value @param {string} label */
function httpBaseUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(label + " must be a valid HTTP(S) URL");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(label + " must be a credential-free HTTP(S) base URL");
  }
  return url;
}

/** @param {URL} url */
function basePath(url) {
  let pathname = url.pathname;
  while (pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  return pathname;
}

/**
 * @param {string | undefined} mediaUrl
 * @param {string | undefined} optimizerOrigin
 */
export function createPosImageConfig(mediaUrl, optimizerOrigin) {
  const media = httpBaseUrl(
    mediaUrl?.trim() || DEFAULT_MEDIA_URL,
    "NEXT_PUBLIC_MEDIA_URL",
  );
  let imagePath;
  if (optimizerOrigin?.trim()) {
    const optimizer = httpBaseUrl(
      optimizerOrigin.trim(),
      "MAZETTO_DESKTOP_IMAGE_OPTIMIZER_ORIGIN",
    );
    if (optimizer.pathname !== "/") {
      throw new Error(
        "MAZETTO_DESKTOP_IMAGE_OPTIMIZER_ORIGIN must not contain a path",
      );
    }
    // Packaged UI files can be read-only. Shared optimized images also use
    // Chromium's persistent HTTP cache without writing into the installation.
    imagePath = optimizer.origin + "/_next/image";
  }
  return {
    remotePatterns: [
      {
        protocol: /** @type {"http" | "https"} */ (media.protocol.slice(0, -1)),
        hostname: media.hostname,
        port: media.port,
        pathname: basePath(media) + "/**",
      },
    ],
    deviceSizes: [320, 480, 640, 768, 1024, 1280, 1600],
    imageSizes: [96, 192, 256, 384, 512],
    qualities: [75],
    ...(imagePath ? { path: imagePath } : {}),
  };
}

/** @param {string} src @param {string | undefined} mediaUrl */
export function canOptimizeProductImage(src, mediaUrl) {
  try {
    const media = httpBaseUrl(
      mediaUrl?.trim() || DEFAULT_MEDIA_URL,
      "NEXT_PUBLIC_MEDIA_URL",
    );
    const image = new URL(src);
    return (
      !image.username &&
      !image.password &&
      image.origin === media.origin &&
      image.pathname.startsWith(basePath(media) + "/")
    );
  } catch {
    return false;
  }
}
