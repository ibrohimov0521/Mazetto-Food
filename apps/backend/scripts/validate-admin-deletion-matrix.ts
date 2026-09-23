import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

type Surface = {
  name: string;
  controller: string;
  controllerPattern: RegExp;
  service: string;
  servicePattern: RegExp;
  ui: string;
  uiPattern: RegExp;
};

const surfaces: Surface[] = [
  {
    name: "buyurtmalar",
    controller: "apps/backend/src/modules/orders/orders.controller.ts",
    controllerPattern: /@Delete\("bulk"\)/,
    service: "apps/backend/src/modules/orders/orders.service.ts",
    servicePattern: /permanentlyDeleteOrders\(/,
    ui: "apps/pos-web/components/admin/admin-orders.tsx",
    uiPattern: /\/orders\/bulk[\s\S]*method: "DELETE"/,
  },
  {
    name: "cheklar",
    controller: "apps/backend/src/modules/receipts/receipts.controller.ts",
    controllerPattern: /@Delete\("bulk"\)/,
    service: "apps/backend/src/modules/receipts/receipts.service.ts",
    servicePattern: /deleteReceipts\(/,
    ui: "apps/pos-web/components/admin/admin-receipts.tsx",
    uiPattern: /\/receipts\/bulk[\s\S]*method: "DELETE"/,
  },
  {
    name: "mahsulotlar",
    controller: "apps/backend/src/modules/menu/menu.controller.ts",
    controllerPattern: /@Delete\("products\/bulk\/permanent"\)/,
    service: "apps/backend/src/modules/menu/menu.service.ts",
    servicePattern: /permanentlyDeleteProducts\(/,
    ui: "apps/pos-web/components/admin/admin-catalog.tsx",
    uiPattern: /\/menu\/products\/bulk\/permanent[\s\S]*method: "DELETE"/,
  },
  {
    name: "kategoriyalar",
    controller: "apps/backend/src/modules/menu/menu.controller.ts",
    controllerPattern: /@Delete\("categories\/bulk\/permanent"\)/,
    service: "apps/backend/src/modules/menu/menu.service.ts",
    servicePattern: /permanentlyDeleteCategories\(/,
    ui: "apps/pos-web/components/admin/admin-categories.tsx",
    uiPattern: /\/menu\/categories\/bulk\/permanent[\s\S]*method: "DELETE"/,
  },
  {
    name: "modifikatorlar",
    controller: "apps/backend/src/modules/menu/menu.controller.ts",
    controllerPattern: /@Delete\("modifiers\/bulk\/permanent"\)/,
    service: "apps/backend/src/modules/menu/menu.service.ts",
    servicePattern: /permanentlyDeleteModifiers\(/,
    ui: "apps/pos-web/components/admin/admin-modifiers.tsx",
    uiPattern: /\/menu\/modifiers\/bulk\/permanent[\s\S]*method: "DELETE"/,
  },
  {
    name: "xodimlar",
    controller: "apps/backend/src/modules/staff/staff.controller.ts",
    controllerPattern: /@Delete\("bulk"\)/,
    service: "apps/backend/src/modules/staff/staff.service.ts",
    servicePattern: /deleteStaffBulk\(/,
    ui: "apps/pos-web/components/admin/admin-staff.tsx",
    uiPattern: /\/staff\/bulk[\s\S]*method: "DELETE"/,
  },
  {
    name: "mijozlar",
    controller: "apps/backend/src/modules/customers/customers.controller.ts",
    controllerPattern: /@Delete\("customers\/bulk"\)/,
    service: "apps/backend/src/modules/customers/customers.service.ts",
    servicePattern: /deleteCustomersBulk\(/,
    ui: "apps/pos-web/components/admin/admin-customers.tsx",
    uiPattern: /\/customers\/bulk[\s\S]*method: "DELETE"/,
  },
  {
    name: "qurilmalar",
    controller: "apps/backend/src/modules/devices/devices.controller.ts",
    controllerPattern: /@Delete\("bulk"\)/,
    service: "apps/backend/src/modules/devices/devices.service.ts",
    servicePattern: /deleteDevices\(/,
    ui: "apps/pos-web/components/admin/admin-devices.tsx",
    uiPattern: /\/devices\/bulk[\s\S]*method: "DELETE"/,
  },
  {
    name: "printerlar",
    controller: "apps/backend/src/modules/printers/printers.controller.ts",
    controllerPattern: /@Delete\("bulk"\)/,
    service: "apps/backend/src/modules/printers/printers.service.ts",
    servicePattern: /deletePrinters\(/,
    ui: "apps/pos-web/app/(shell)/admin/printers/page.tsx",
    uiPattern: /\/printers\/bulk[\s\S]*method: "DELETE"/,
  },
  {
    name: "filiallar",
    controller: "apps/backend/src/modules/branches/branches.controller.ts",
    controllerPattern: /@Delete\("bulk\/permanent"\)/,
    service: "apps/backend/src/modules/branches/branches.service.ts",
    servicePattern: /permanentlyDeleteBranches\(/,
    ui: "apps/pos-web/components/admin/admin-branches.tsx",
    uiPattern: /\/branches\/bulk\/permanent[\s\S]*method: "DELETE"/,
  },
  {
    name: "rollar",
    controller: "apps/backend/src/modules/roles/roles.controller.ts",
    controllerPattern: /@Delete\("roles\/bulk\/permanent"\)/,
    service: "apps/backend/src/modules/roles/roles.service.ts",
    servicePattern: /permanentlyDeleteRoles\(/,
    ui: "apps/pos-web/components/admin/admin-roles.tsx",
    uiPattern: /\/roles\/bulk\/permanent[\s\S]*method: "DELETE"/,
  },
  {
    name: "supplierlar",
    controller: "apps/backend/src/modules/suppliers/suppliers.controller.ts",
    controllerPattern: /@Delete\("bulk"\)/,
    service: "apps/backend/src/modules/suppliers/suppliers.service.ts",
    servicePattern: /deleteSuppliersBulk\(/,
    ui: "apps/pos-web/components/admin/admin-suppliers.tsx",
    uiPattern: /\/suppliers\/bulk[\s\S]*method: "DELETE"/,
  },
  {
    name: "ingredientlar va omborlar",
    controller: "apps/backend/src/modules/inventory/inventory.controller.ts",
    controllerPattern: /@Delete\("ingredients\/bulk\/permanent"\)[\s\S]*@Delete\("warehouses\/bulk\/permanent"\)/,
    service: "apps/backend/src/modules/inventory/inventory.service.ts",
    servicePattern: /permanentlyDeleteIngredients\([\s\S]*permanentlyDeleteWarehouses\(/,
    ui: "apps/pos-web/components/admin/admin-inventory.tsx",
    uiPattern: /\/inventory\/\$\{kind\}\/bulk\/permanent[\s\S]*method: "DELETE"/,
  },
  {
    name: "xarajat kategoriyalari",
    controller: "apps/backend/src/modules/expenses/expenses.controller.ts",
    controllerPattern: /@Delete\("categories\/bulk\/permanent"\)/,
    service: "apps/backend/src/modules/expenses/expenses.service.ts",
    servicePattern: /permanentlyDeleteCategories\(/,
    ui: "apps/pos-web/components/admin/admin-expenses.tsx",
    uiPattern: /\/expenses\/categories\/bulk\/permanent[\s\S]*method: "DELETE"/,
  },
  {
    name: "homepage slaydlar va aksiyalar",
    controller: "apps/backend/src/modules/homepage/homepage.controller.ts",
    controllerPattern: /@Delete\("hero-slides\/bulk"\)[\s\S]*@Delete\("promotions\/bulk"\)/,
    service: "apps/backend/src/modules/homepage/homepage.service.ts",
    servicePattern: /deleteHeroSlidesBulk\([\s\S]*deletePromotionsBulk\(/,
    ui: "apps/pos-web/components/admin/admin-homepage.tsx",
    uiPattern: /pendingDelete\.kind[\s\S]*\/bulk[\s\S]*method: "DELETE"/,
  },
];

for (const surface of surfaces) {
  const controller = read(surface.controller);
  const service = read(surface.service);
  const ui = read(surface.ui);
  assert.match(controller, surface.controllerPattern, `${surface.name}: controller delete endpointi yo'q`);
  assert.match(service, surface.servicePattern, `${surface.name}: service permanent/bulk delete yo'q`);
  assert.match(ui, surface.uiPattern, `${surface.name}: UI delete amali yo'q`);
}

for (const path of [
  "apps/pos-web/components/admin/admin-audit.tsx",
  "apps/pos-web/components/admin/admin-payments.tsx",
  "apps/pos-web/components/admin/admin-shifts.tsx",
]) {
  const source = read(path);
  assert.doesNotMatch(source, /method:\s*["']DELETE["']/, `${path}: tarixiy yozuvlarni o'chirish UI'si bo'lmasin`);
}

console.info(`Admin deletion matrix passed (${surfaces.length} mutable surfaces; immutable history protected)`);

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}
