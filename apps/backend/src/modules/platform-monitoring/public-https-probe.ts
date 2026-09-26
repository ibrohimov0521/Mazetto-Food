import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

export type ProbeStatus = "ONLINE" | "OFFLINE";

export type ProbeResult = {
  status: ProbeStatus;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
};

export function isHealthyHttpStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 400;
}

export function isHeadUnsupported(statusCode: number): boolean {
  return statusCode === 405 || statusCode === 501;
}

export function normalizePublicHttpsUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("HTTPS manzil formati noto'g'ri.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password ||
    isIP(host) !== 0 ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".")
  ) {
    throw new Error("Faqat ommaviy domenning HTTPS manzili qabul qilinadi.");
  }

  url.hash = "";
  return url.toString();
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const octets = address.split(".").map(Number);
    const [a = 0, b = 0] = octets;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 192 && b === 88 && octets[2] === 99) ||
      (a === 192 && b === 0 && octets[2] === 2) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && octets[2] === 100))) ||
      (a === 203 && b === 0 && octets[2] === 113) ||
      a >= 224
    );
  }

  if (family === 6) {
    const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
    if (mapped?.[1]) return isPublicAddress(mapped[1]);

    const firstGroup = Number.parseInt(address.split(":")[0] || "0", 16);
    const normalized = address.toLowerCase();
    return (
      firstGroup >= 0x2000 &&
      firstGroup <= 0x3fff &&
      !normalized.startsWith("2001:db8:") &&
      !normalized.startsWith("2001:10:") &&
      !normalized.startsWith("2002:")
    );
  }

  return false;
}

function requestStatus(
  url: URL,
  address: string,
  family: number,
  timeoutMs: number,
  method: "HEAD" | "GET",
): Promise<{ statusCode: number; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const req = request(
      {
        hostname: address,
        family,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method,
        headers: { host: url.host, "user-agent": "BestTeam-Monitor/1.0" },
        servername: url.hostname,
        rejectUnauthorized: true,
      },
      (res) => {
        const statusCode = res.statusCode ?? 0;
        res.destroy();
        resolve({ statusCode, latencyMs: Date.now() - startedAt });
      },
    );

    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function probePublicHttpsUrl(
  rawUrl: string,
  timeoutMs = 5000,
): Promise<ProbeResult> {
  try {
    const url = new URL(normalizePublicHttpsUrl(rawUrl));
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      return {
        status: "OFFLINE",
        statusCode: null,
        latencyMs: null,
        error: "Domen ommaviy server manziliga yechilmadi.",
      };
    }

    let result = await requestStatus(
      url,
      addresses[0]!.address,
      addresses[0]!.family,
      timeoutMs,
      "HEAD",
    );
    if (isHeadUnsupported(result.statusCode)) {
      result = await requestStatus(
        url,
        addresses[0]!.address,
        addresses[0]!.family,
        timeoutMs,
        "GET",
      );
    }
    const online = isHealthyHttpStatus(result.statusCode);
    return {
      status: online ? "ONLINE" : "OFFLINE",
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      error: online ? null : `Server HTTP ${result.statusCode} xatosini qaytardi.`,
    };
  } catch (error) {
    return {
      status: "OFFLINE",
      statusCode: null,
      latencyMs: null,
      error:
        error instanceof Error && error.message === "timeout"
          ? "Javob kutish vaqti tugadi."
          : "Domen yoki HTTPS serveriga ulanib bo'lmadi.",
    };
  }
}
