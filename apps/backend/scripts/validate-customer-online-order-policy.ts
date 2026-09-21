import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const checkout = readFileSync(
  resolve(process.cwd(), "../customer-web/app/checkout/page.tsx"),
  "utf8",
);

assert.match(checkout, /window\.navigator\.onLine/);
assert.match(checkout, /addEventListener\("offline"/);
assert.match(checkout, /!online \|\|/);
assert.match(checkout, /Buyurtma yuborish uchun internetga ulaning/);
assert.doesNotMatch(checkout, /serviceWorker\.register|offlineOrderQueue/);
