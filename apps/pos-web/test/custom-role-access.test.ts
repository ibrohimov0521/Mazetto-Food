import assert from "node:assert/strict";
import test from "node:test";
import {
  getAccessiblePanels,
  getPrimaryRedirect,
  type AuthUser,
} from "../lib/auth";
import { checkRouteAccess } from "../lib/route-access";
import { resolveAdminNav } from "../lib/admin-nav";
import { toCsv } from "../lib/csv";

const customUser = (permissions: string[]): AuthUser => ({
  id: "custom-user",
  roles: ["FLOOR_COORDINATOR"],
  permissions,
});

test("maxsus rol ochilmaydigan admin sahifasiga yo'naltirilmaydi", () => {
  const user = customUser(["ADMIN_ACCESS", "TABLE_VIEW"]);

  assert.equal(getPrimaryRedirect(user), "/waiter");
  assert.equal(checkRouteAccess(user, "/admin/branches"), "denied");

  const branchUser = customUser([
    "ADMIN_ACCESS",
    "TABLE_VIEW",
    "BRANCH_VIEW",
  ]);
  assert.equal(getPrimaryRedirect(branchUser), "/admin/branches");
  assert.equal(checkRouteAccess(branchUser, "/admin/branches"), "allowed");
  assert.equal(
    getAccessiblePanels(branchUser).some(
      (panel) => panel.href === "/admin/dashboard",
    ),
    true,
  );
});

test("maxsus operatsion rol nomiga emas permissioniga ko'ra panel oladi", () => {
  const user = customUser(["KITCHEN_VIEW"]);

  assert.equal(getPrimaryRedirect(user), "/kitchen");
  assert.deepEqual(
    getAccessiblePanels(user).map((panel) => panel.href),
    ["/kitchen"],
  );
});

test("ADMIN_ACCESS bo'lmasa admin route yopiq qoladi", () => {
  const user = customUser(["BRANCH_VIEW"]);

  assert.equal(checkRouteAccess(user, "/admin/branches"), "denied");
});

test("bitta maxsus hisobot permissioni hisobot route'ini ochadi", () => {
  const user = customUser(["ADMIN_ACCESS", "REPORT_PRODUCTS_VIEW"]);

  assert.equal(getPrimaryRedirect(user), "/admin/reports");
  assert.equal(checkRouteAccess(user, "/admin/reports"), "allowed");
  assert.ok(
    resolveAdminNav(user).some((group) =>
      group.items.some((item) => item.href === "/admin/reports"),
    ),
  );
});

test("custom admin role permissioni berilgan bo'limni sidebar'da ko'rsatadi", () => {
  const user = customUser(["ADMIN_ACCESS", "HOMEPAGE_MANAGE"]);

  assert.equal(getPrimaryRedirect(user), "/admin/homepage");
  assert.equal(checkRouteAccess(user, "/admin/homepage"), "allowed");
  assert.ok(
    resolveAdminNav(user).some((group) =>
      group.items.some((item) => item.href === "/admin/homepage"),
    ),
  );
});

test("CSV qiymatlari vergul, qo'shtirnoq va yangi qatordan himoyalanadi", () => {
  assert.equal(
    toCsv(["Nomi", "Izoh"], [["Lavash, katta", 'U "maxsus"\nissiq']]),
    '"Nomi","Izoh"\r\n"Lavash, katta","U ""maxsus""\nissiq"',
  );
});
