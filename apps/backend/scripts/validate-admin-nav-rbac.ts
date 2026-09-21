import * as assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { adminNavGroups } from "../../pos-web/lib/admin-nav";
import { resolveRouteAccess, routeAccessRules } from "../../pos-web/lib/route-access";
import { resolveRouteIntent } from "../../pos-web/lib/route-intent";

/*
 * Admin navigatsiyasi va RBAC muvofiqligi.
 *
 * Menyuni yashirish himoya EMAS — haqiqiy authorization backendda. Lekin menyu
 * route bilan mos kelmasa, foydalanuvchi ko'rgan havolasini bosib rad etish
 * paneliga tushadi yoki teskarisi: ocha oladigan sahifasini menyuda ko'rmaydi.
 * Ikkalasi ham nuqson.
 *
 * 6-BOSQICH A2 dan keyin guardlar sahifalarda emas, `app/(shell)/layout.tsx`
 * da bir marta qo'llanadi va qoidalar `lib/route-access.ts` da e'lon qilinadi.
 * Shuning uchun bu validator endi menyuni SAHIFA fayllari bilan emas, RUXSAT
 * MATRITSASI bilan solishtiradi.
 *
 * Tekshiriladi:
 *   1. Har nav elementining `permission` i backend katalogida mavjud
 *   2. Har nav elementida `icon` bor va u `icon.tsx` da aniqlangan
 *   3. Har `href` uchun haqiqiy route fayli `(shell)` ichida bor
 *   4. Har `href` uchun ruxsat matritsasida qoida bor
 *   5. Nav rollari matritsa rollarining QISM TO'PLAMI — menyu route rad
 *      etadigan narsani hech qachon ko'rsatmaydi (teskarisi ruxsat etiladi:
 *      SUPER_ADMIN URL orqali kirsa ham menyusi tartibli qoladi)
 *   6. Nav permission'i matritsa permission'i bilan mos
 *   7. `(shell)` ichidagi HAR sahifa matritsada qoidaga ega
 *   8. Sahifalarda guard o'ramlari qolmagan (ular layoutga ko'chgan)
 *   9. Ikki nav element bir xil `href` ga ishora qilmaydi
 *  10. Sidebar'da harf-ikonka zaxirasi qolmagan
 */

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const permissionsSource = readSource(
  "apps/backend/src/common/auth/permissions.ts",
);
const iconSource = readSource("apps/pos-web/components/admin-ui/icon.tsx");
const sidebarSource = readSource(
  "apps/pos-web/components/admin-shell/admin-sidebar.tsx",
);
const shellLayoutSource = readSource("apps/pos-web/app/(shell)/layout.tsx");

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

const items: NavItem[] = adminNavGroups.flatMap((group) => group.items);

assert.equal(
  items.length,
  28,
  `nav elementlari soni kutilganidan farq qiladi: ${items.length}`,
);

// Stollar filialning ichki ish maydonida. Printer navbati esa kunlik kassa
// amali bo'lgani uchun Cheklar yonidan bevosita ochiladi.
assert.ok(!items.some((item) => item.href === "/admin/tables"));
assert.ok(items.some((item) => item.href === "/admin/printers"));

/*
 * Ruxsat matritsasi (`lib/route-access.ts`) — endi guardlarning yagona manbai.
 * Naqsh tartibi muhim, shuning uchun ro'yxat sifatida o'qiladi.
 */
/** Matritsa uchun `:id`, disk uchun `[id]` — ikkalasi ham kerak. */
type ShellRoute = { route: string; dirPath: string };

const accessRules = routeAccessRules;

assert.ok(
  accessRules.length > 25,
  `ruxsat matritsasi juda kichik: ${accessRules.length}`,
);

function findRule(pathname: string) {
  return resolveRouteAccess(pathname) ?? undefined;
}

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

  // 3. Route fayli `(shell)` guruhi ichida mavjud
  const routePath = `apps/pos-web/app/(shell)${item.href}/page.tsx`;
  assert.ok(
    existsSync(join(repoRoot, routePath)),
    `${where}: ${routePath} topilmadi`,
  );

  // 4. Ruxsat matritsasida qoida bor
  const rule = findRule(item.href);
  assert.ok(
    rule !== undefined,
    `${where}: lib/route-access.ts da qoida yo'q — qobiq bu sahifani rad etadi`,
  );

  // 5. Nav rollari matritsa rollarining QISM TO'PLAMI.
  //    Menyu route rad etadigan narsani ko'rsatmasligi shart. Teskarisi
  //    ruxsat etiladi: SUPER_ADMIN hamma joyga kira oladi, lekin uning
  //    menyusida uchta dashboard turishi shart emas.
  const extraRoles = item.roles.filter((role) => !rule.roles.includes(role));
  assert.deepEqual(
    extraRoles,
    [],
    `${where}: menyu bu rollarga havola ko'rsatadi, matritsa rad etadi: ${extraRoles.join(", ")}`,
  );

  // 6. Permission mos
  if (rule.permission) {
    assert.equal(
      item.permission,
      rule.permission,
      `${where}: menyu "${item.permission}" talab qiladi, matritsa "${rule.permission}"`,
    );
  }
}

/*
 * 7. `(shell)` ichidagi HAR sahifa matritsada qoidaga ega bo'lishi shart.
 *
 * Qoidasiz sahifa ochilmaydi (qobiq "sozlanmagan sahifa" panelini ko'rsatadi),
 * shuning uchun buni yig'ilishdan oldin ushlash kerak.
 */
const shellRoutes = listShellRoutes(join(repoRoot, "apps/pos-web/app/(shell)"));

assert.ok(
  shellRoutes.length > 25,
  `(shell) sahifalari juda kam: ${shellRoutes.length}`,
);

for (const { route } of shellRoutes) {
  assert.ok(
    findRule(route) !== undefined,
    `${route}: (shell) ichida, lekin lib/route-access.ts da qoidasi yo'q`,
  );
  assert.ok(
    resolveRouteIntent(route) !== null,
    `${route}: sidebar, child, workspace yoki hidden intent e'lon qilinmagan`,
  );
}

for (const rule of accessRules) {
  assert.ok(
    resolveRouteIntent(rule.pattern) !== null,
    `${rule.pattern}: route access qoidasi bor, lekin route intent yo'q`,
  );
}

/*
 * 8. Sahifalarda guard o'ramlari qolmagan.
 *
 * Ular `app/(shell)/layout.tsx` ga ko'chgan. Sahifada qolib ketgan o'ram ikki
 * marta tekshiruv degani emas — u qobiqni yana kontent ICHIGA qo'yib,
 * tuzatilgan nuqsonni qaytarardi.
 */
for (const { route, dirPath } of shellRoutes) {
  const source = readSource(`apps/pos-web/app/(shell)${dirPath}/page.tsx`);

  for (const wrapper of ["RoleGuard", "PermissionGuard", "AdminLayout"]) {
    assert.ok(
      !source.includes(`<${wrapper}`),
      `${route}: <${wrapper}> hali sahifada — u layoutga ko'chishi kerak`,
    );
  }
}

// Qobiq guardni haqiqatan qo'llayotganini tasdiqlaymiz.
assert.match(shellLayoutSource, /checkRouteAccess\(user, pathname\)/);
assert.match(shellLayoutSource, /AccessDeniedPanel/);
assert.match(shellLayoutSource, /UnknownRoutePanel/);
// Oq ekran o'rniga skeleton (A4).
assert.match(shellLayoutSource, /ShellContentSkeleton/);
assert.doesNotMatch(shellLayoutSource, /min-h-screen bg-white/);

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
console.log(`  ruxsat matritsasi: ${accessRules.length} ta qoida`);
console.log(`  (shell) sahifalari: ${shellRoutes.length} ta, hammasi qoidali`);
console.log("  har element: permission mavjud · ikonka mavjud · route mavjud");
console.log("  nav rollari matritsa rollarining qism to'plami");
console.log("  sahifalarda guard o'rami qolmagan — guard layoutda");

/**
 * `(shell)` ichidagi barcha route yo'llarini qaytaradi.
 *
 * Guruh papkasi (`(shell)`) URL ga kirmaydi, shuning uchun natija allaqachon
 * brauzerdagi yo'l bilan bir xil. Dinamik segmentlar (`[id]`) matritsa
 * naqshiga mos kelishi uchun `:id` ga aylantiriladi.
 */
function listShellRoutes(shellDir: string): ShellRoute[] {
  const routes: ShellRoute[] = [];

  function walk(dir: string, route: string, dirPath: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // `[id]` matritsa naqshida `:id` ko'rinishida, lekin diskda `[id]`
        // bo'lib qoladi — shuning uchun ikkalasi ham olib yuriladi.
        const segment = entry.name.startsWith("[")
          ? `:${entry.name.slice(1, -1)}`
          : entry.name;
        walk(
          join(dir, entry.name),
          `${route}/${segment}`,
          `${dirPath}/${entry.name}`,
        );
        continue;
      }

      if (entry.name === "page.tsx" && route) {
        routes.push({ route, dirPath });
      }
    }
  }

  walk(shellDir, "", "");
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}

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
