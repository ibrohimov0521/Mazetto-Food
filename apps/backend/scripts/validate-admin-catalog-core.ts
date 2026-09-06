import * as assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const menuController = readSource("apps/backend/src/modules/menu/menu.controller.ts");
const menuService = readSource("apps/backend/src/modules/menu/menu.service.ts");
const listDto = readSource("apps/backend/src/modules/menu/dto/list-menu.dto.ts");
const managementDto = readSource("apps/backend/src/modules/menu/dto/menu-management.dto.ts");
const adminCatalog = readSource("apps/pos-web/components/admin/admin-catalog.tsx");
const adminDashboard = readSource("apps/pos-web/app/admin/dashboard/page.tsx");
const adminProducts = readSource("apps/pos-web/app/admin/products/page.tsx");
const adminProductNew = readSource("apps/pos-web/app/admin/products/new/page.tsx");
const adminProductEdit = readSource("apps/pos-web/app/admin/products/[id]/page.tsx");
const adminCategories = readSource("apps/pos-web/app/admin/categories/page.tsx");
const adminBranches = readSource("apps/pos-web/app/admin/branches/page.tsx");
const adminProductEditor = readSource("apps/pos-web/components/admin/admin-product-editor.tsx");
const adminModifiers = readSource("apps/pos-web/components/admin/admin-modifiers.tsx");
const posRouteVerifier = readSource("scripts/verify-pos-public-route.mjs");

assert.match(listDto, /includeInactive\?: string/);
assert.match(menuController, /@Get\("products\/:id"\)/);
assert.match(menuController, /PERMISSIONS\.MENU_VIEW/);
assert.match(menuService, /query\.includeInactive === "true" \? \{\} : \{ isAvailable: true \}/);
assert.match(menuService, /async getProduct\(id: string\)/);
assert.match(menuService, /catalogVisibility: this\.getCatalogVisibility\(product\.code\)/);
assert.match(menuService, /customerVisibleProductCodeSet/);
assert.match(menuService, /legacyProductCodeSet/);
assert.match(menuService, /isRecommended: dto\.isRecommended \?\? false/);
assert.match(menuService, /sortOrder: dto\.sortOrder \?\? 0/);
assert.match(menuService, /return this\.getProduct\(product\.id\)/);
assert.match(menuService, /return this\.getProduct\(id\)/);

assert.match(managementDto, /isRecommended\?: boolean/);
assert.match(managementDto, /sortOrder\?: number/);

for (const source of [
  adminDashboard,
  adminProducts,
  adminProductNew,
  adminProductEdit,
  adminCategories,
  adminBranches,
]) {
  assert.match(source, /RoleGuard roles=\{\["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"\]\}/);
}

assert.match(adminDashboard, /PermissionGuard permission="ADMIN_ACCESS"/);
assert.match(adminProducts, /PermissionGuard permission="MENU_VIEW"/);
assert.match(adminProductNew, /PermissionGuard permission="MENU_CREATE"/);
assert.match(adminProductEdit, /PermissionGuard permission="MENU_EDIT"/);
assert.match(adminCategories, /PermissionGuard permission="MENU_VIEW"/);
assert.match(adminBranches, /PermissionGuard permission="BRANCH_VIEW"/);

assert.match(adminCatalog, /apiFetch<Product\[]>\("\/menu\/products\?includeInactive=true"\)/);
assert.match(adminCatalog, /apiFetch<Category\[]>\("\/menu\/categories\?includeInactive=true"\)/);
assert.match(adminCatalog, /catalogVisibility/);
assert.doesNotMatch(adminCatalog, /method: "DELETE"/);

/*
 * Mahsulot editori `admin-product-editor.tsx` ga ko'chirildi (katalog 2-bosqichi).
 * Aniq matn emas, NIYAT tekshiriladi.
 */
// Media yuklash hali yo'qligi foydalanuvchiga aytilishi kerak
assert.match(adminProductEditor, /Media yuklash|Rasm boshqaruvi/);
// Yangi mahsulot ommaviy katalogga avtomatik kirmasligi aytilishi kerak
assert.match(adminProductEditor, /avtomatik ommaviy katalogga kirmaydi|avtomatik canonical/);
assert.doesNotMatch(adminProductEditor, /method: "DELETE"/);

// Katalog 2-bosqichi: ko'p variant, modifier biriktirish, filial mavjudligi
assert.match(adminProductEditor, /variants: cleanVariants\.map/, "editor bir nechta variant yubormayapti");
assert.match(adminProductEditor, /isDefault: variant\.isDefault/, "standart variant yuborilmayapti");
assert.match(adminProductEditor, /modifiers: selectedModifierIds\.map/, "modifier biriktirish yuborilmayapti");
assert.match(adminProductEditor, /product-availability/, "filial mavjudligi boshqaruvi yo'q");
assert.match(adminProductEditor, /hasPermission\(user, "BRANCH_EDIT"\)/, "filial mavjudligi BRANCH_EDIT bilan cheklanmagan");

// Backend modifier katalogi
assert.match(menuController, /@Get\("modifiers"\)/, "GET /menu/modifiers yo'q");
assert.match(menuController, /@Patch\("modifiers\/:id"\)/, "PATCH /menu/modifiers/:id yo'q");
assert.match(menuService, /listModifiers\(/, "listModifiers yo'q");
assert.match(menuService, /branchAvailabilities: \{/, "getProduct filial mavjudligini qaytarmayapti");

/*
 * Modifier o'chirilmasligi kerak — buyurtma tarixidagi `modifierSnapshot`
 * bilan bog'liq. Nofaol qilish tarixiy yaxlitlikni saqlaydi.
 */
assert.doesNotMatch(menuController, /@Delete\("modifiers/, "modifier o'chirish endpoint'i bo'lmasin");
assert.doesNotMatch(adminModifiers, /method: "DELETE"/, "modifier ekranida o'chirish bo'lmasin");

assert.match(posRouteVerifier, /pos\.mazettofood\.uz/);
assert.match(posRouteVerifier, /Kitchen API public safety/);
assert.match(posRouteVerifier, /status === 401 \|\| kitchenApi\.status === 403/);

console.info("Admin catalog core validation passed");

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
