import * as assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const permissions = readSource("apps/backend/src/common/auth/permissions.ts");
const seed = readSource("apps/backend/prisma/seed.ts");
const appModule = readSource("apps/backend/src/app.module.ts");
const staffController = readSource("apps/backend/src/modules/staff/staff.controller.ts");
const staffService = readSource("apps/backend/src/modules/staff/staff.service.ts");
const staffDto = readSource("apps/backend/src/modules/staff/dto/staff.dto.ts");
const authService = readSource("apps/backend/src/modules/auth/auth.service.ts");
const jwtGuard = readSource("apps/backend/src/common/guards/jwt-auth.guard.ts");
const cashRegisterController = readSource("apps/backend/src/modules/cash-register/cash-register.controller.ts");
const posAuth = readSource("apps/pos-web/lib/auth.ts");
const loginPage = readSource("apps/pos-web/app/login/page.tsx");
const accessDeniedPage = readSource("apps/pos-web/app/access-denied/page.tsx");
const staffListPage = readSource("apps/pos-web/app/admin/staff/page.tsx");
const staffNewPage = readSource("apps/pos-web/app/admin/staff/new/page.tsx");
const staffDetailPage = readSource("apps/pos-web/app/admin/staff/[id]/page.tsx");
const reportsPage = readSource("apps/pos-web/app/admin/reports/page.tsx");
const adminStaff = readSource("apps/pos-web/components/admin/admin-staff.tsx");
const adminReports = readSource("apps/pos-web/components/admin/admin-reports.tsx");
const posPage = readSource("apps/pos-web/app/pos/page.tsx");
const kitchenPage = readSource("apps/pos-web/app/kitchen/page.tsx");
const printersPage = readSource("apps/pos-web/app/admin/printers/page.tsx");

for (const permission of [
  "ADMIN_ACCESS",
  "STAFF_VIEW",
  "STAFF_CREATE",
  "STAFF_UPDATE",
  "STAFF_PASSWORD_RESET",
  "STAFF_STATUS_CHANGE",
  "STAFF_ROLE_ASSIGN",
  "POS_USE",
  "SHIFT_VIEW_OWN",
]) {
  assert.match(permissions, new RegExp(`${permission}: "${permission}"`));
  assert.match(seed, new RegExp(`PERMISSIONS\\.${permission}`));
}

assert.match(seed, /code: "ADMIN"/);
assert.match(seed, /code: "CASHIER"[\s\S]*PERMISSIONS\.POS_USE/);
assert.match(seed, /code: "CASHIER"[\s\S]*PERMISSIONS\.SHIFT_VIEW_OWN/);
assert.doesNotMatch(seed.match(/code: "CASHIER"[\s\S]*?\n {2}\},/)?.[0] ?? "", /ADMIN_ACCESS|STAFF_|KITCHEN_VIEW/);
assert.match(seed, /code: "KITCHEN"[\s\S]*PERMISSIONS\.KITCHEN_VIEW/);
assert.doesNotMatch(seed.match(/code: "KITCHEN"[\s\S]*?\n {2}\},/)?.[0] ?? "", /ADMIN_ACCESS|STAFF_|POS_USE|MENU_CREATE/);

assert.match(appModule, /StaffModule/);
assert.match(staffController, /@Controller\("staff"\)/);
assert.match(staffController, /@Permissions\(PERMISSIONS\.STAFF_VIEW\)/);
assert.match(staffController, /@Permissions\(PERMISSIONS\.STAFF_CREATE\)/);
assert.match(staffController, /@Permissions\(PERMISSIONS\.STAFF_UPDATE\)/);
assert.match(staffController, /@Permissions\(PERMISSIONS\.STAFF_ROLE_ASSIGN\)/);
assert.match(staffController, /@Permissions\(PERMISSIONS\.STAFF_STATUS_CHANGE\)/);
assert.match(staffController, /@Permissions\(PERMISSIONS\.STAFF_PASSWORD_RESET\)/);

assert.match(staffDto, /MinLength\(8\)/);
assert.match(staffService, /hash\(dto\.password, 12\)/);
assert.match(staffService, /compare\(dto\.currentPassword/);
assert.match(staffService, /revokeUserSessions/);
assert.match(staffService, /At least one active SUPER_ADMIN account must remain/);
assert.match(staffService, /Only SUPER_ADMIN can assign SUPER_ADMIN/);
assert.match(staffService, /Only SUPER_ADMIN can assign global staff roles/);
assert.match(staffService, /normalizeCustomerPhone/);
assert.doesNotMatch(staffController, /passwordHash/);
assert.doesNotMatch(adminStaff, /passwordHash/);
assert.match(authService, /normalizeIdentifier/);
assert.match(jwtGuard, /resolveCurrentUser/);
assert.match(jwtGuard, /isActive: true/);
assert.match(cashRegisterController, /PERMISSIONS\.SHIFT_VIEW_OWN/);

assert.match(posAuth, /\| "ADMIN"/);
assert.match(posAuth, /ADMIN: "\/admin\/dashboard"/);
assert.match(loginPage, /Xavfsiz kirish/);
assert.match(accessDeniedPage, /Kirish cheklangan/);
assert.match(staffListPage, /PermissionGuard permission="STAFF_VIEW"/);
assert.match(staffNewPage, /PermissionGuard permission="STAFF_CREATE"/);
assert.match(staffDetailPage, /PermissionGuard permission="STAFF_UPDATE"/);
assert.match(reportsPage, /PermissionGuard permission="REPORT_SALES_VIEW"/);
assert.match(adminStaff, /apiFetch<Staff\[]>\("\/staff"\)/);
assert.match(adminStaff, /password-reset/);
assert.match(adminStaff, /\/staff\/me\/password/);
assert.match(adminReports, /\/reports\/sales/);
assert.match(posPage, /PermissionGuard permission="POS_USE"/);
assert.doesNotMatch(posPage, /\/admin\/printers/);
assert.match(kitchenPage, /PermissionGuard permission="KITCHEN_VIEW"/);
assert.doesNotMatch(printersPage, /"CASHIER"/);

console.info("Staff RBAC static validation passed");

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
