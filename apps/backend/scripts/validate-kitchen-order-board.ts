import * as assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const kitchenService = readSource("apps/backend/src/modules/kitchen/kitchen.service.ts");
const kitchenController = readSource("apps/backend/src/modules/kitchen/kitchen.controller.ts");
const telegramStaff = readSource("apps/backend/src/modules/telegram/telegram-order-notification.service.ts");
const kitchenPage = readSource("apps/pos-web/app/kitchen/page.tsx");

assert.match(kitchenService, /export type KitchenStaffAction = "accept" \| "start_preparing" \| "mark_ready" \| "complete" \| "cancel"/);
assert.match(kitchenService, /async applyOrderAction\(/);
assert.match(kitchenService, /SELECT id FROM "orders" WHERE id = \$\{orderId\} FOR UPDATE/);
assert.match(kitchenService, /changedByUserId: user\?\.id \?\? null/);
assert.match(kitchenService, /changedByEmployeeId: user\?\.employeeId \?\? null/);
assert.match(kitchenService, /resolveBranchScope\(actor\.user, order\.branchId\)/);
assert.match(kitchenService, /action === "cancel"/);

assert.match(kitchenController, /@Patch\("orders\/:id\/cancel"\)/);
assert.match(kitchenController, /PERMISSIONS\.KITCHEN_STATUS_UPDATE/);

assert.match(telegramStaff, /this\.kitchenService\.applyOrderAction\(orderId, action/);
assert.doesNotMatch(telegramStaff, /private resolveTransition\(/);
assert.doesNotMatch(telegramStaff, /tx\.order\.update\(\{ where: \{ id: orderId \}/);

assert.match(kitchenPage, /RoleGuard roles=\{\["KITCHEN", "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"\]\}/);
assert.match(kitchenPage, /PermissionGuard permission="KITCHEN_VIEW"/);
assert.match(kitchenPage, /const pollIntervalMs = 5000/);
assert.match(kitchenPage, /document\.addEventListener\("visibilitychange"/);
assert.match(kitchenPage, /apiFetch\(`\/kitchen\/orders\/\$\{ticket\.id\}\/\$\{action\}`/);
assert.match(kitchenPage, /type KitchenAction = "accept" \| "start" \| "ready" \| "complete" \| "cancel"/);
assert.match(kitchenPage, /Bekor qilish/);
assert.doesNotMatch(kitchenPage, /from "socket\.io-client"/);
assert.doesNotMatch(kitchenPage, /redis/i);

console.info("Kitchen order board validation passed");

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
