import * as assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const authController = readSource("apps/backend/src/modules/auth/auth.controller.ts");
const authService = readSource("apps/backend/src/modules/auth/auth.service.ts");
const clientAddress = readSource("apps/backend/src/common/http/client-address.ts");
const customerService = readSource("apps/backend/src/modules/customers/customers.service.ts");
const telegramCustomerAuth = readSource("apps/backend/src/modules/telegram/telegram-customer-auth.service.ts");

// Mijoz manzili faqat yagona hal qiluvchi orqali olinadi. Controller
// proxy header'larini o'zi o'qimasligi shart (PHASE 6 H1).
assert.match(authController, /resolveClientAddress\(request\)/);
assert.doesNotMatch(authController, /cf-connecting-ip/);
assert.doesNotMatch(authController, /x-forwarded-for/);

// Proxy header'lariga faqat e'lon qilingan hop soni bo'lganda ishoniladi;
// default 0, ya'ni hech qanday header'ga ishonilmaydi.
assert.match(clientAddress, /TRUSTED_PROXY_HOP_COUNT/);
assert.match(clientAddress, /if \(hops === 0\) \{/);
assert.match(clientAddress, /chain\.length - hops/);

assert.match(authService, /const LOGIN_THROTTLE_WINDOW_MS = 15 \* 60 \* 1000/);
assert.match(authService, /const LOGIN_THROTTLE_BLOCK_MS = 15 \* 60 \* 1000/);
assert.match(authService, /const LOGIN_THROTTLE_MAX_ADDRESS_FAILURES = 5/);
assert.match(authService, /const LOGIN_THROTTLE_MAX_IDENTIFIER_FAILURES = 20/);
assert.match(authService, /private readonly loginThrottle = new Map<string, LoginThrottleRecord>\(\)/);
assert.match(authService, /this\.assertLoginAllowed\(throttle\.key\)/);
assert.match(authService, /this\.registerFailedLogin\(throttleKeys\)/);
assert.match(authService, /this\.loginThrottle\.delete\(throttle\.key\)/);
assert.match(authService, /key: `login:\$\{identifier\}:address:\$\{clientAddress\}`/);
assert.match(authService, /key: `login:\$\{identifier\}:account`/);
assert.match(authService, /HttpStatus\.TOO_MANY_REQUESTS/);

// Kalitning bir qismini so'rov yuboruvchi tanlaydi, shuning uchun jadval
// chegaralangan bo'lishi shart (PHASE 6 H2).
assert.match(authService, /const LOGIN_THROTTLE_MAX_ENTRIES = 10_000/);
assert.match(authService, /this\.pruneLoginThrottle\(now\)/);
assert.doesNotMatch(authService, /passwordMatches[^]*throw new UnauthorizedException\(`[^`]*\$\{/);

assert.match(customerService, /const CUSTOMER_CODE_REQUEST_WINDOW_MS = 60 \* 1000/);
assert.match(customerService, /const CUSTOMER_CODE_REQUEST_LIMIT = 3/);
assert.match(customerService, /await this\.assertCanRequestCode\(tx, phone\)/);
assert.match(telegramCustomerAuth, /const CUSTOMER_CODE_REQUEST_WINDOW_MS = 60 \* 1000/);
assert.match(telegramCustomerAuth, /const CUSTOMER_CODE_REQUEST_LIMIT = 3/);

console.info("Login and verification throttling validation passed");

function readSource(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
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
