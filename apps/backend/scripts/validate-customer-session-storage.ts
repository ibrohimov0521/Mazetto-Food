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

const storageSource = readFileSync(
  join(repoRoot, "apps/customer-web/lib/customer-session-storage.mjs"),
  "utf8",
);
assert.match(
  source,
  /function withoutCustomerRefreshToken\([\s\S]*?customer: CustomerProfileSession/,
  "customer profile session sanitizatsiyasi yo'q",
);
assert.match(
  source,
  /delete safeCustomer\.refreshToken/,
  "refresh token sessiondan olib tashlanmayapti",
);
assert.match(
  source,
  /customerProfileForStorage\(legacyCustomer\)/,
  "legacy session localStorage'dan oldin tokenlardan tozalanmayapti",
);
assert.match(
  source,
  /JSON\.stringify\(customerProfileForStorage\(migrated\)\)/,
  "refresh javobidagi tokenlar localStorage'ga yozilmasligi kerak",
);
assert.match(
  source,
  /JSON\.stringify\(customerProfileForStorage\(browserCustomer\)\)/,
  "login sessiyasi localStorage'ga tokenlarsiz yozilishi kerak",
);
assert.match(
  storageSource,
  /delete profile\.accessToken/,
  "access token customer localStorage profilidan olib tashlanmayapti",
);
assert.match(
  storageSource,
  /delete profile\.refreshToken/,
  "refresh token customer localStorage profilidan olib tashlanmayapti",
);
assert.match(
  storageSource,
  /delete profile\.tokenType/,
  "token turi customer localStorage profilidan olib tashlanmayapti",
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
    /accessToken|refreshToken|tokenType/,
    "auth token customer localStorage yozuviga qayta tushmasin",
  );
}

console.info(
  "Customer session storage validator passed (refresh token stays HttpOnly-cookie-only)",
);
