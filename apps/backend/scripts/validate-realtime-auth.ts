import * as assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const gateway = readSource("apps/backend/src/modules/kitchen/kitchen.gateway.ts");
const customerOrdersPage = readSource("apps/customer-web/app/orders/page.tsx");
const customerOrderUpdates = readSource("apps/customer-web/lib/use-order-updates.ts");
const waiterPage = readSource("apps/pos-web/app/(fullscreen)/waiter/page.tsx");
const adminKitchenMonitor = readSource("apps/pos-web/components/admin/admin-kitchen-monitor.tsx");
const realtimePayloadBlock = sourceBetween(
  gateway,
  "  private toRealtimePayload(payload: unknown, scope: OrderEventScope): OrderRealtimePayload {",
  "  private readString(value: unknown, path: string): string | undefined {",
);

// WebSocket CORS va HTTP CORS bitta manbadan oziqlanadi (PHASE 6 H12).
// Ilgari ro'yxat ikki faylda bayt-baytiga takrorlangan edi va biri ortda
// qolishi hech narsa bilan ushlanmasdi.
const corsConfig = readSource("apps/backend/src/config/cors.config.ts");
const mainBootstrap = readSource("apps/backend/src/main.ts");

assert.match(gateway, /@WebSocketGateway\(\{\s*cors:\s*\{\s*credentials:\s*true,\s*origin:\s*resolveAllowedOrigins\(\),/s);
assert.doesNotMatch(gateway, /origin:\s*"\*"/);
assert.doesNotMatch(gateway, /const allowedOrigins = \[/);
assert.match(mainBootstrap, /origin:\s*resolveAllowedOrigins\(\)/);
assert.doesNotMatch(mainBootstrap, /const allowedOrigins = \[/);

assert.match(corsConfig, /CORS_ORIGINS/);
assert.match(corsConfig, /https:\/\/mazettofood\.uz/);
assert.match(corsConfig, /https:\/\/pos\.mazettofood\.uz/);
// `credentials: true` bilan wildcard brauzerda ishlamaydi — u ishlayotgandek
// ko'rinib, aslida hamma so'rovni buzardi.
assert.match(corsConfig, /cannot be '\*' while credentials are enabled/);

assert.match(gateway, /private async authenticateSocket\(client: Socket\): Promise<RealtimeAuth \| null>/);
assert.match(gateway, /client\.disconnect\(true\)/);
assert.match(gateway, /getCustomerJwtAccessSecret\(\)/);
assert.match(gateway, /getJwtAccessSecret\(\)/);
assert.match(gateway, /payload\.tokenUse !== "customer_access"/);

assert.match(gateway, /void client\.join\(this\.customerRoom\(auth\.customerId\)\)/);
assert.match(gateway, /void client\.join\(this\.branchRoom\(auth\.branchId\)\)/);
assert.match(gateway, /void client\.join\(this\.globalStaffRoom\(\)\)/);
assert.match(gateway, /this\.server\.to\(\[...rooms\]\)\.emit\(event, this\.toRealtimePayload\(payload, scope\)\)/);
assert.doesNotMatch(gateway, /this\.server\.emit\(event, payload\)/);
assert.doesNotMatch(gateway, /\.emit\(event,\s*payload\)/);

assert.match(gateway, /customerOrder: \{ select: \{ customerId: true \} \}/);
assert.match(gateway, /private toRealtimePayload\(payload: unknown, scope: OrderEventScope\): OrderRealtimePayload/);
assert.doesNotMatch(realtimePayloadBlock, /phone/);
assert.doesNotMatch(realtimePayloadBlock, /deliveryAddress/);
assert.doesNotMatch(realtimePayloadBlock, /\.\.\.payload/);

// Socket handshake sahifadan `lib/use-order-updates.ts` hook ichiga ko`chirildi;
// token endi sahifadan parametr sifatida uzatiladi.
assert.match(customerOrdersPage, /useOrderUpdates\(customer\?\.accessToken, load\)/);
assert.match(customerOrderUpdates, /auth: \{ token, tokenType: "customer" \}/);
assert.match(customerOrderUpdates, /if \(!token\) return;/);
assert.match(customerOrderUpdates, /transports: \["websocket"\]/);
assert.match(waiterPage, /auth: \{ token: session\.tokens\.accessToken, tokenType: "staff" \}/);
assert.match(waiterPage, /transports: \["websocket"\]/);
assert.doesNotMatch(adminKitchenMonitor, /autentifikatsiyasiz\s+global broadcast/i);

console.info("Realtime auth and room scoping validation passed");

function readSource(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);

  assert.notEqual(startIndex, -1, `Missing source block start: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source block end: ${end}`);
  assert.ok(endIndex > startIndex, `Invalid source block order: ${start}`);

  return source.slice(startIndex, endIndex);
}

function findRepoRoot(startPath: string): string {
  let current = startPath;

  for (let depth = 0; depth < 8; depth += 1) {
    const packageJsonPath = join(current, "package.json");

    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string };

      if (packageJson.name === "mazetto-food") {
        return current;
      }
    }

    const parent = dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  throw new Error("Could not locate mazetto-food repository root");
}
