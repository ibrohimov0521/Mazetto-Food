import { resolve4, resolve6 } from "node:dns/promises";

const endpoints = [
  ["Backend health", "https://api.mazettofood.uz/api/v1/health"],
  ["Customer web", "https://mazettofood.uz/"],
  ["POS web login", "https://pos.mazettofood.uz/login"],
  ["POS web kitchen", "https://pos.mazettofood.uz/kitchen"],
];

const timeoutMs = 10_000;

async function main() {
  const dns = await checkDns("pos.mazettofood.uz");
  console.info(`DNS pos.mazettofood.uz: ${dns.ok ? "OK" : "FAILED"}${dns.detail ? ` (${dns.detail})` : ""}`);

  for (const [label, url] of endpoints) {
    const result = await checkHttp(url);
    console.info(`${label}: ${result.status ?? "FAILED"} ${result.detail}`);
  }

  const kitchenApi = await checkHttp("https://api.mazettofood.uz/api/v1/kitchen/orders");
  const safe = kitchenApi.status === 401 || kitchenApi.status === 403;
  console.info(`Kitchen API public safety: ${safe ? "OK" : "FAILED"} (${kitchenApi.status ?? "no status"})`);

  if (!dns.ok || !safe) {
    process.exitCode = 1;
  }
}

async function checkDns(hostname) {
  try {
    const [v4, v6] = await Promise.allSettled([resolve4(hostname), resolve6(hostname)]);
    const addresses = [
      ...(v4.status === "fulfilled" ? v4.value : []),
      ...(v6.status === "fulfilled" ? v6.value : []),
    ];

    return {
      ok: addresses.length > 0,
      detail: addresses.length > 0 ? `${addresses.length} address(es)` : "no A/AAAA records",
    };
  } catch (error) {
    return { ok: false, detail: getMessage(error) };
  }
}

async function checkHttp(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text().catch(() => "");
    const exposesKitchenData =
      url.endsWith("/kitchen") &&
      response.ok &&
      contentType.includes("application/json") &&
      /orderNumber|kitchen_tickets|customerPhone|deliveryAddress/i.test(body);

    return {
      status: response.status,
      detail: exposesKitchenData ? "exposes kitchen data" : response.statusText || "OK",
    };
  } catch (error) {
    return { status: null, detail: getMessage(error) };
  } finally {
    clearTimeout(timeout);
  }
}

function getMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

void main();
