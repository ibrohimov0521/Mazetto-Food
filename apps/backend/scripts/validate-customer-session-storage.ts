import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const repoRoot = join(
  fileURLToPath(new URL("../../../", import.meta.url)),
);
const source = readFileSync(
  join(repoRoot, "apps/customer-web/lib/cart.tsx"),
  "utf8",
);

assert.match(
  source,
  /function withoutCustomerRefreshToken\(customer: CustomerSession\)/,
  "customer session sanitizatsiyasi yo'q",
);
assert.match(
  source,
  /delete safeCustomer\.refreshToken/,
  "refresh token sessiondan olib tashlanmayapti",
);
assert.match(
  source,
  /window\.localStorage\.setItem\(customerKey, JSON\.stringify\(browserCustomer\)\)/,
  "customer session localStorage'ga xavfsiz shaklda yozilmayapti",
);
assert.match(
  source,
  /const migrated = withoutCustomerRefreshToken\(/,
  "refresh javobidan oldin session sanitizatsiya qilinmayapti",
);

const localStorageWrites = source.match(
  /window\.localStorage\.setItem\(customerKey[\s\S]*?\);/g,
) ?? [];
for (const write of localStorageWrites) {
  assert.doesNotMatch(
    write,
    /refreshToken/,
    "refresh token customer localStorage yozuviga qayta tushmasin",
  );
}

console.info(
  "Customer session storage validator passed (refresh token stays HttpOnly-cookie-only)",
);
