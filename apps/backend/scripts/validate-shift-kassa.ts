import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function main(): void {
  const schema = read("prisma/schema.prisma");
  const ordersService = read("src/modules/orders/orders.service.ts");
  const shiftPage = read("../pos-web/app/shift/page.tsx");
  const posPage = read("../pos-web/app/pos/page.tsx");
  const auth = read("../pos-web/lib/auth.ts");

  assert.match(schema, /expectedCash\s+Decimal\?/);
  assert.match(schema, /cashDifference\s+Decimal\?/);
  assert.match(ordersService, /assertOpenCashierShift/);
  assert.match(ordersService, /tx\.revenueRecord\.create/);
  assert.match(ordersService, /tx\.cashTransaction\.create/);
  assert.match(ordersService, /CashTransactionType\.SALE/);
  assert.match(posPage, /\/cash-register\/shift/);
  assert.match(posPage, /router\.replace\("\/shift"\)/);
  assert.match(auth, /CASHIER: "\/shift"/);
  assert.match(shiftPage, /\/cash-register\/shift\/open/);
  assert.match(shiftPage, /\/cash-register\/shift\/\$\{shift\.id\}\/close/);
  assert.doesNotMatch(shiftPage, /branchId/);

  console.info("Shift/Kassa static validation passed");
}

main();
