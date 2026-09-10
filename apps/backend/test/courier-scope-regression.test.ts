import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceSource = readFileSync(
  join(__dirname, "../src/modules/customers/customers.service.ts"),
  "utf8",
);
const courierUiSource = readFileSync(
  join(__dirname, "../../pos-web/components/courier/courier-orders.tsx"),
  "utf8",
);

function methodSource(name: string): string {
  const start = serviceSource.indexOf(`async ${name}(`);
  assert.notEqual(start, -1, `${name} method must exist`);
  const next = serviceSource.indexOf("\n  async ", start + 1);
  return serviceSource.slice(start, next === -1 ? undefined : next);
}

test("courier active order search keeps courier ownership scope", () => {
  const method = methodSource("listCourierDeliveryOrders");

  assert.match(method, /const orderFilters: Prisma\.OrderWhereInput\[\]/);
  assert.match(method, /servedById: null/);
  assert.match(method, /servedById: employeeId/);
  assert.match(method, /orderFilters\.push\(this\.buildOrderSearchWhere\(search\)\)/);
  assert.match(method, /AND: orderFilters/);
  assert.doesNotMatch(
    method, /OR: \[\{ servedById: null \}, \{ servedById: employeeId \}\],[\s\S]*\.\.\.\(search \? \{ OR:/,
    "search OR must not replace the servedBy courier scope",
  );
});

test("courier history filters are applied by the backend request", () => {
  assert.match(courierUiSource, /params\.set\("status", historyStatus\)/);
  assert.match(courierUiSource, /params\.set\("search", historySearch\.trim\(\)\)/);
  assert.match(courierUiSource, /courier\/orders\/history\?\$\{params\.toString\(\)\}/);
  assert.match(courierUiSource, /\}, \[historySearch, historyStatus\]\);/);
});
