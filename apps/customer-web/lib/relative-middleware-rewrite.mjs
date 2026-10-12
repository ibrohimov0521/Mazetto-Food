export function resolveServerProtocol(forwardedProtocol, fallback) {
  const candidate = String(forwardedProtocol || "")
    .split(",", 1)[0]
    .trim()
    .toLowerCase();
  if (candidate === "http" || candidate === "https") return `${candidate}:`;
  return fallback;
}

export function toServerMiddlewareRewrite(value, { hostname, port, protocol }) {
  if (!value) return null;

  try {
    const destination = new URL(value);
    if (destination.protocol !== "http:" && destination.protocol !== "https:") {
      return null;
    }
    if (
      !destination.pathname.startsWith("/") ||
      destination.pathname.startsWith("//")
    ) {
      return null;
    }

    const serverHost = String(hostname || "").trim();
    const isIpv6 = serverHost.includes(":") && /^[0-9a-f:]+$/i.test(serverHost);
    if (!isIpv6 && !/^[a-z0-9.-]+$/i.test(serverHost)) return null;

    const serverPort = Number(port);
    if (!Number.isInteger(serverPort) || serverPort < 1 || serverPort > 65535) {
      return null;
    }
    if (protocol !== "http:" && protocol !== "https:") return null;

    const formattedHost = isIpv6 ? `[${serverHost}]` : serverHost;
    const serverOrigin = new URL(`${protocol}//${formattedHost}:${serverPort}`);
    return new URL(
      `${destination.pathname}${destination.search}${destination.hash}`,
      serverOrigin,
    ).toString();
  } catch {
    return null;
  }
}
