import * as assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const authController = readSource("apps/backend/src/modules/auth/auth.controller.ts");
const authService = readSource("apps/backend/src/modules/auth/auth.service.ts");
const loginThrottle = readSource(
  "apps/backend/src/modules/auth/login-throttle.service.ts",
);
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

// Login cheklovi 7-bosqich 3-to'lqinda `AuthService` dan alohida servisga
// ko'chdi va hisoblagichlar Redis'da saqlanadi.
//
// NIMA UCHUN: jarayon xotirasidagi jadval deploy'da nolga tushardi, ikkinchi
// instance o'zicha sanardi, va CHEKSIZ o'sardi — kalitning bir qismi login
// identifikatori, ya'ni uni so'rov yuboruvchi tanlaydi, tozalash esa faqat
// aynan o'sha kalit qayta so'ralganda ishlardi (PHASE 6 H2).
assert.doesNotMatch(authService, /new Map<string, LoginThrottleRecord>/);
assert.doesNotMatch(authService, /LOGIN_THROTTLE_/);
assert.match(authService, /this\.loginThrottle\.assertAllowed\(identifier, clientAddress\)/);
assert.match(authService, /this\.loginThrottle\.registerFailure\(identifier, clientAddress\)/);
assert.match(authService, /this\.loginThrottle\.clear\(identifier, clientAddress\)/);

// Ikki kalit ikki xil hujumga qarshi: manzil bo'yicha parol sepish,
// akkaunt bo'yicha brute-force.
assert.match(loginThrottle, /:address:\$\{clientAddress\}/);
assert.match(loginThrottle, /:account/);
assert.match(loginThrottle, /const MAX_ADDRESS_FAILURES = 5/);
assert.match(loginThrottle, /const MAX_IDENTIFIER_FAILURES = 20/);
assert.match(loginThrottle, /HttpStatus\.TOO_MANY_REQUESTS/);
// TTL tozalashni Redis bajaradi; oyna oxirgi urinishdan hisoblanadi.
assert.match(loginThrottle, /expire\(key, WINDOW_SECONDS\)/);
// Redis tushganda cheklov butunlay yo'qolmaydi, lekin zaxira jadval ham
// chegaralangan bo'lishi shart — kalitni hujumchi tanlaydi.
assert.match(loginThrottle, /FALLBACK_MAX_ENTRIES/);
assert.match(loginThrottle, /private pruneFallback\(\)/);

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
