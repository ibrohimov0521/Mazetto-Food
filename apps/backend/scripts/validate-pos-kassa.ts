import * as assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const permissions = readSource("apps/backend/src/common/auth/permissions.ts");
const ordersModule = readSource("apps/backend/src/modules/orders/orders.module.ts");
const posController = readSource("apps/backend/src/modules/orders/pos.controller.ts");
const posDto = readSource("apps/backend/src/modules/orders/dto/pos-checkout.dto.ts");
const ordersService = readSource("apps/backend/src/modules/orders/orders.service.ts");
const schema = readSource("apps/backend/prisma/schema.prisma");
/*
 * VIZUAL assertlar ATAYLAB olib tashlandi.
 *
 * Bu skript Tailwind sinf satrlarini tekshirardi (`bg-[#062d2b]`,
 * `grid-cols-[minmax(0,1fr)_390px]`). Bunday assert hech qanday xatti-harakatni
 * himoya qilmaydi — u faqat ekran restayl qilinganda buziladi, va aynan
 * shunday bo'ldi: POS qayta dizayn qilinganda ular jimgina yiqildi va hech
 * kim sezmadi.
 *
 * Layout regressiyasi uchun brauzer tekshiruvi kerak, regex emas. Bu yerda
 * faqat XATTI-HARAKAT tekshiriladi: RBAC, endpoint, pul hisobi, guardlar.
 */
const posPage = readSource("apps/pos-web/app/(fullscreen)/pos/page.tsx");
const posMedia = readSource("apps/pos-web/lib/media.ts");
const posGlobals = readSource("apps/pos-web/app/globals.css");
const authProvider = readSource("apps/pos-web/components/auth/auth-provider.tsx");
const posAuth = readSource("apps/pos-web/lib/auth.ts");

/*
 * Endpoint assertlari chaqiruv FORMATLANISHIGA emas, MANZILGA qaraydi.
 *
 * Ilgari ular `apiFetch<Type>("/url")` ni bir qatorda kutardi. Prettier
 * chaqiruvni ko'p qatorga bo'lganda ular jimgina yiqilardi — tekshirilayotgan
 * xatti-harakat esa umuman o'zgarmagan bo'lardi.
 */

assert.match(permissions, /POS_USE: "POS_USE"/);
assert.match(schema, /enum OrderSource[\s\S]*\bPOS\b/);
assert.match(ordersModule, /PosController/);
assert.match(posController, /@Controller\("pos"\)/);
assert.match(posController, /@Get\("catalog"\)[\s\S]*@Permissions\(PERMISSIONS\.POS_USE\)/);
assert.match(posController, /@Post\("orders"\)[\s\S]*@Permissions\(PERMISSIONS\.POS_USE\)/);
assert.match(posDto, /idempotencyKey/);
assert.match(posDto, /cashReceived/);
assert.match(posDto, /@ArrayMinSize\(1\)/);
assert.match(posDto, /@Max\(99\)/);

assert.match(ordersService, /resolveRequiredBranchScope\(user\)/);
assert.match(ordersService, /const employeeId = this\.requireEmployee\(user\)/);
assert.match(ordersService, /source: OrderSource\.POS/);
assert.match(ordersService, /code: \{ in: \[\.\.\.customerVisibleProductCodes\] \}/);
assert.match(ordersService, /this\.createItemSnapshot\(tx, branchId, item, \{\s*requireCanonical: true/);
assert.match(ordersService, /new Prisma\.Decimal\(dto\.cashReceived\)/);
assert.match(ordersService, /paymentStatus: PaymentStatus\.PAID/);
assert.match(ordersService, /this\.confirmOrderForPreparation/);
assert.match(ordersService, /this\.createPosIdempotencyKey/);
assert.match(ordersService, /paymentOperation\.findUnique/);
assert.match(ordersService, /assertOpenCashierShift/);
assert.match(ordersService, /tx\.revenueRecord\.create/);
assert.match(ordersService, /tx\.cashTransaction\.create/);
const posCheckoutBody = ordersService.match(/async createPosCheckout[\s\S]*?\n {2}async createOrder/)?.[0] ?? "";
assert.match(posCheckoutBody, /resolveRequiredBranchScope\(user\)/);
assert.doesNotMatch(posCheckoutBody, /dto\.branchId/);
assert.doesNotMatch(posCheckoutBody, /dto\.cashierId/);
assert.doesNotMatch(posCheckoutBody, /dto\.total/);
assert.doesNotMatch(posCheckoutBody, /dto\.source/);

assert.match(posPage, /PermissionGuard permission="POS_USE"/);
assert.match(posPage, /RoleGuard roles=\{\["CASHIER", "SUPER_ADMIN", "BRANCH_MANAGER"\]\}/);
assert.match(posPage, /"\/cash-register\/shift"/);
assert.match(posPage, /router\.replace\("\/shift"\)/);
assert.match(posPage, /"\/pos\/catalog"/);
assert.match(posPage, /"\/pos\/orders"/);
assert.match(posPage, /const \[checkoutKey, setCheckoutKey\] = useState\(createCheckoutKey\)/);
assert.match(posPage, /handleProductImageError\(event\.currentTarget\)/);
assert.match(posMedia, /const defaultMediaUrl = "https:\/\/media\.mazettofood\.uz"/);
assert.match(posMedia, /export const fallbackImage =/);
assert.match(posMedia, /return `\$\{getMediaUrl\(\)\}\$\{imageUrl\}`/);
assert.match(posMedia, /return `\$\{getMediaUrl\(\)\}\/\$\{imageUrl\.replace/);
assert.match(posMedia, /export function handleProductImageError\(image: HTMLImageElement\)/);
assert.match(posGlobals, /\.no-scrollbar/);
const posOrderPayload = posPage.match(/body: JSON\.stringify\(\{[\s\S]*?\n {8}\}\),/)?.[0] ?? "";
assert.match(posOrderPayload, /idempotencyKey: checkoutKey/);
assert.match(posOrderPayload, /productId/);
assert.match(posOrderPayload, /quantity/);
assert.doesNotMatch(posOrderPayload, /price:/);
assert.doesNotMatch(posOrderPayload, /total:/);
assert.match(posAuth, /CASHIER: "\/shift"/);
assert.match(posAuth, /KITCHEN: "\/kitchen"/);
assert.match(authProvider, /getLoginRedirect/);
assert.match(authProvider, /\/cash-register\/shift/);
assert.match(authProvider, /payload\.data\?\.status === "OPEN"[\s\S]{0,40}"\/pos"[\s\S]{0,30}"\/shift"/);

console.info("POS/Kassa static validation passed");

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
