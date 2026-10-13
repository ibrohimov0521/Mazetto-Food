const DEFAULT_MEDIA_URL = "https://media.mazettofood.uz";

/**
 * @param {string | undefined} mediaUrl
 * @returns {import("next").RemotePattern}
 */
export function createMediaRemotePattern(mediaUrl) {
  let url;
  try {
    url = new URL(mediaUrl?.trim() || DEFAULT_MEDIA_URL);
  } catch {
    throw new Error("NEXT_PUBLIC_MEDIA_URL must be a valid HTTP(S) URL");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "NEXT_PUBLIC_MEDIA_URL must be a credential-free HTTP(S) base URL",
    );
  }

  const basePath = url.pathname.replace(/\/+$/, "");
  return {
    protocol: /** @type {"http" | "https"} */ (url.protocol.slice(0, -1)),
    hostname: url.hostname,
    port: url.port,
    pathname: `${basePath}/**`,
  };
}

/**
 * @param {string | undefined} mediaUrl
 * @param {string | undefined} nodeEnv
 */
export function createMediaImageConfig(mediaUrl, nodeEnv) {
  return {
    remotePatterns: [createMediaRemotePattern(mediaUrl)],
    unoptimized: nodeEnv !== "production",
  };
}
