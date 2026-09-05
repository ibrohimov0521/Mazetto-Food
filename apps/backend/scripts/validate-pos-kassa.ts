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
const posPage = readSource("apps/pos-web/app/pos/page.tsx");
const authProvider = readSource("apps/pos-web/components/auth/auth-provider.tsx");
const posAuth = readSource("apps/pos-web/lib/auth.ts");

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
assert.match(posPage, /apiFetch<CurrentShift \| null>\("\/cash-register\/shift"\)/);
assert.match(posPage, /router\.replace\("\/shift"\)/);
assert.match(posPage, /apiFetch<Catalog>\("\/pos\/catalog"\)/);
assert.match(posPage, /apiFetch<PosOrderResult>\("\/pos\/orders"/);
assert.match(posPage, /const \[checkoutKey, setCheckoutKey\] = useState\(createCheckoutKey\)/);
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
assert.match(authProvider, /payload\.data\?\.status === "OPEN" \? "\/pos" : "\/shift"/);

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
