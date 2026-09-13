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
const adminStaff = readSource("apps/pos-web/components/admin/admin-staff.tsx");
const adminReports = readSource("apps/pos-web/components/admin/admin-reports.tsx");
const posPage = readSource("apps/pos-web/app/(fullscreen)/pos/page.tsx");
const kitchenPage = readSource("apps/pos-web/app/(fullscreen)/kitchen/page.tsx");
const printersPage = readSource("apps/pos-web/app/(shell)/admin/printers/page.tsx");
const routeAccess = readSource("apps/pos-web/lib/route-access.ts");

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
// Guardlar 6-bosqich A2 da sahifalardan `app/(shell)/layout.tsx` ga
// ko'chdi; qoidalar endi ruxsat matritsasida e'lon qilinadi.
assertRouteRule(routeAccess, "/admin/staff", "STAFF_VIEW");
assertRouteRule(routeAccess, "/admin/staff/new", "STAFF_CREATE");
assertRouteRule(routeAccess, "/admin/staff/:id", "STAFF_UPDATE");
assertRouteRule(routeAccess, "/admin/reports", "REPORT_SALES_VIEW");
assert.match(adminStaff, /apiFetch<Staff\[]>\("\/staff"\)/);
assert.match(adminStaff, /password-reset/);
assert.match(adminStaff, /\/staff\/me\/password/);
assert.match(adminReports, /\/reports\/sales/);
assert.match(posPage, /PermissionGuard permission="POS_USE"/);
assert.doesNotMatch(posPage, /\/admin\/printers/);
assert.match(kitchenPage, /PermissionGuard permission="KITCHEN_VIEW"/);
assert.doesNotMatch(printersPage, /"CASHIER"/);

/*
 * Ruxsat keshi (PHASE 6 H8).
 *
 * `JwtAuthGuard` ilgari HAR so'rovda to'rt jadvalli join bajarardi. Kesh
 * qo'shildi, lekin u bekor qilishni yo'qotmasligi shart — aks holda
 * bloklangan xodim kesh eskirguncha ishlashda davom etardi.
 */
const authCache = readSource(
  "apps/backend/src/common/auth/user-auth-cache.service.ts",
);

assert.match(jwtGuard, /this\.userAuthCache\.read\(userId\)/);
assert.match(jwtGuard, /this\.userAuthCache\.write\(resolved\)/);
// Faol emas foydalanuvchi keshdan OLDIN rad etiladi.
assert.match(jwtGuard, /User is not active/);

// TTL qisqa bo'lishi shart: u bekor qilish kechikishining eng yomon holati.
assert.match(authCache, /const TTL_SECONDS = 30/);

// Xodim profilini o'zgartiradigan har bir yo'l keshni tozalashi kerak.
assert.equal(
  (staffService.match(/this\.userAuthCache\.invalidate\(/g) ?? []).length,
  5,
  "beshta mutatsiya yo'li ham keshni bekor qilishi kerak",
);

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

function assertRouteRule(source: string, pattern: string, permission: string): void {
  assert.match(
    source,
    new RegExp(
      `pattern:\\s*"${escapeRegExp(pattern)}"[\\s\\S]*?roles:\\s*\\[[^\\]]*\\][\\s\\S]*?permission:\\s*"${permission}"`,
    ),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
