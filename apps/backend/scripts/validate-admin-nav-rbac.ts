import * as assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * 5-bosqich: admin navigatsiyasi va RBAC muvofiqligi.
 *
 * 3-bosqich rejasida va'da qilingan, o'shanda yozilmagan validator.
 *
 * Menyuni yashirish himoya EMAS — haqiqiy authorization backendda. Lekin menyu
 * route bilan mos kelmasa, foydalanuvchi ko'rgan havolasini bosib
 * `/access-denied` ga tushadi yoki teskarisi: ocha oladigan sahifasini
 * menyuda ko'rmaydi. Ikkalasi ham nuqson.
 *
 * Tekshiriladi:
 *   1. Har nav elementining `permission` i backend katalogida mavjud
 *   2. Har nav elementida `icon` bor va u `icon.tsx` da aniqlangan
 *   3. Har `href` uchun haqiqiy route fayli bor
 *   4. Route'ning `RoleGuard` ro'yxati nav elementi bilan AYNAN mos
 *   5. Route'ning `PermissionGuard` i nav elementi bilan AYNAN mos
 *   6. Ikki nav element bir xil `href` ga ishora qilmaydi
 *   7. Sidebar'da harf-ikonka zaxirasi qolmagan
 */

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const permissionsSource = readSource(
  "apps/backend/src/common/auth/permissions.ts",
);
const navSource = readSource("apps/pos-web/lib/admin-nav.ts");
const iconSource = readSource("apps/pos-web/components/admin-ui/icon.tsx");
const sidebarSource = readSource(
  "apps/pos-web/components/admin-shell/admin-sidebar.tsx",
);

const knownPermissions = new Set(
  [...permissionsSource.matchAll(/^\s{2}([A-Z_]+): "([A-Z_*]+)",$/gm)].map(
    (match) => match[2]!,
  ),
);

assert.ok(
  knownPermissions.size > 40,
  `permission katalogi juda kichik: ${knownPermissions.size}`,
);

const definedIcons = new Set(
  [...iconSource.matchAll(/^\s{2}([a-zA-Z]+): (?:\(|<)/gm)].map(
    (match) => match[1]!,
  ),
);

assert.ok(
  definedIcons.size > 20,
  `ikonka to'plami juda kichik: ${definedIcons.size}`,
);

type NavItem = {
  label: string;
  href: string;
  permission: string;
  icon: string;
  roles: string[];
};

const items: NavItem[] = [];

for (const block of navSource.matchAll(/^ {6}\{\n([\s\S]*?)^ {6}\},$/gm)) {
  const body = block[1]!;
  const label = body.match(/label: "([^"]+)"/)?.[1];
  const href = body.match(/href: "([^"]+)"/)?.[1];
  const permission = body.match(/permission: "([^"]+)"/)?.[1];
  const icon = body.match(/icon: "([^"]+)"/)?.[1];
  const roles = body.match(/roles: \[([^\]]*)\]/)?.[1];

  if (!label || !href || !permission || !icon || roles === undefined) {
    continue;
  }

  items.push({
    label,
    href,
    permission,
    icon,
    roles: [...roles.matchAll(/"([A-Z_]+)"/g)].map((match) => match[1]!),
  });
}

assert.equal(
  items.length,
  23,
  `nav elementlari soni kutilganidan farq qiladi: ${items.length}`,
);

const seenHrefs = new Map<string, string>();

for (const item of items) {
  const where = `${item.label} (${item.href})`;

  // 1. Permission backend katalogida mavjud
  assert.ok(
    knownPermissions.has(item.permission),
    `${where}: "${item.permission}" backend permission katalogida yo'q`,
  );

  // 2. Ikonka aniqlangan
  assert.ok(
    definedIcons.has(item.icon),
    `${where}: "${item.icon}" ikonkasi icon.tsx da aniqlanmagan`,
  );

  // 6. Takroriy href yo'q
  const previous = seenHrefs.get(item.href);
  assert.equal(
    previous,
    undefined,
    `${item.href} ikki marta: "${previous}" va "${item.label}"`,
  );
  seenHrefs.set(item.href, item.label);

  // 3. Route fayli mavjud
  const routePath = `apps/pos-web/app${item.href}/page.tsx`;
  assert.ok(
    existsSync(join(repoRoot, routePath)),
    `${where}: ${routePath} topilmadi`,
  );

  const routeSource = readSource(routePath);

  // 4. RoleGuard aynan mos
  const guardRoles = routeSource.match(/RoleGuard roles=\{\[([^\]]*)\]\}/)?.[1];
  assert.ok(guardRoles !== undefined, `${where}: route'da RoleGuard yo'q`);

  const routeRoles = [...guardRoles.matchAll(/"([A-Z_]+)"/g)].map(
    (match) => match[1]!,
  );

  assert.deepEqual(
    [...routeRoles].sort(),
    [...item.roles].sort(),
    `${where}: menyu rollari route RoleGuard'i bilan mos emas.\n` +
      `  menyu: ${item.roles.join(", ")}\n  route: ${routeRoles.join(", ")}`,
  );

  // 5. PermissionGuard aynan mos
  const guardPermission = routeSource.match(
    /PermissionGuard permission="([^"]+)"/,
  )?.[1];
  assert.ok(
    guardPermission !== undefined,
    `${where}: route'da PermissionGuard yo'q`,
  );

  assert.equal(
    guardPermission,
    item.permission,
    `${where}: menyu "${item.permission}" talab qiladi, route esa "${guardPermission}"`,
  );
}

// 7. Harf-ikonka zaxirasi qolmagan
assert.doesNotMatch(
  sidebarSource,
  /label\.slice\(0, ?1\)/,
  "admin-sidebar.tsx hali yorliqning birinchi harfini ikonka o'rniga ishlatmoqda",
);
assert.match(
  sidebarSource,
  /<Icon\b/,
  "admin-sidebar.tsx da <Icon> ishlatilmayapti",
);

// Faol holat sezilarli bo'lishi kerak: #08686a qobiq foni bilan atigi 4% farq qilardi.
assert.match(
  sidebarSource,
  /bg-mz-shell-deep/,
  "faol menyu elementi hali past kontrastli fonda",
);

console.log(`OK — ${items.length} ta nav elementi tekshirildi`);
console.log(`  permission katalogi: ${knownPermissions.size} ta`);
console.log(`  ikonka to'plami: ${definedIcons.size} ta`);
console.log("  har element: permission mavjud · ikonka mavjud · route mavjud");
console.log(
  "  har element: RoleGuard va PermissionGuard menyu bilan aynan mos",
);

function readSource(path: string): string {
  /*
   * CR belgilarini olib tashlaymiz.
   *
   * Bu fayldagi naqshlar qator boshi va oxiriga bog'langan. Windows'da git
   * checkout fayllarni CRLF bilan yozadi, o'shanda qator oxiriga tayangan
   * har bir naqsh jimgina 0 ta moslik topadi va validator buni haqiqiy
   * nuqson deb ko'rsatadi.
   */
  return readFileSync(join(repoRoot, path), "utf8").replace(/\r/g, "");
}

function findRepoRoot(startPath: string): string {
  let current = startPath;

  for (let depth = 0; depth < 8; depth += 1) {
    const packageJsonPath = join(current, "package.json");

    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        name?: string;
      };

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
