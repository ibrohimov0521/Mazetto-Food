import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const checkout = readFileSync(
  resolve(process.cwd(), "../customer-web/app/[locale]/checkout/page.tsx"),
  "utf8",
);

assert.match(checkout, /window\.navigator\.onLine/);
assert.match(checkout, /addEventListener\("offline"/);
assert.match(checkout, /!online \|\|/);
assert.match(checkout, /localizeCustomerCopy\(offlineMessage, locale\)/);
const customerCopy = readFileSync(
  resolve(process.cwd(), "../customer-web/lib/customer-copy.mjs"),
  "utf8",
);
assert.ok(customerCopy.includes("Internet aloqasi yo'q. Buyurtma yuborish uchun internetga ulaning."));
assert.ok(customerCopy.includes("Нет подключения к интернету. Подключитесь к сети, чтобы отправить заказ."));
assert.doesNotMatch(checkout, /serviceWorker\.register|offlineOrderQueue/);
