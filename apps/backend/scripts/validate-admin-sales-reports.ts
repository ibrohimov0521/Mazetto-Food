import * as assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const controller = readSource("apps/backend/src/modules/reports/reports.controller.ts");
const service = readSource("apps/backend/src/modules/reports/reports.service.ts");
const dto = readSource("apps/backend/src/modules/reports/dto/report-query.dto.ts");
const range = readSource("apps/backend/src/modules/reports/report-range.ts");
const reportsPage = readSource("apps/pos-web/app/admin/reports/page.tsx");
const reportsUi = readSource("apps/pos-web/components/admin/admin-reports.tsx");

assert.match(controller, /@Controller\("reports"\)/);
assert.match(controller, /@Get\("sales"\)/);
assert.match(controller, /PERMISSIONS\.REPORT_SALES_VIEW/);
assert.match(reportsPage, /PermissionGuard permission="REPORT_SALES_VIEW"/);

for (const preset of ["TODAY", "YESTERDAY", "LAST_7_DAYS", "THIS_MONTH", "YEAR", "CUSTOM"]) {
  assert.match(dto, new RegExp(`${preset}\\s*=`));
}

assert.match(dto, /@IsEnum\(OrderSource\)/);
assert.match(dto, /year\?: number/);
assert.match(range, /Asia\/Tashkent/);
assert.match(range, /TASHKENT_UTC_OFFSET_MINUTES/);
assert.match(range, /toTashkentDateKey/);
assert.match(range, /toTashkentMonthKey/);

assert.match(service, /successfulPaymentStatuses/);
assert.match(service, /PaymentStatus\.PAID/);
assert.match(service, /PaymentStatus\.SUCCESS/);
assert.match(service, /successfulOrderStatuses/);
assert.match(service, /OrderStatus\.CANCELLED/);
assert.match(service, /sourceBreakdown/);
assert.match(service, /branchBreakdown/);
assert.match(service, /cashierBreakdown/);
assert.match(service, /shiftBreakdown/);
assert.match(service, /topProducts/);
assert.match(service, /categorySales/);
assert.match(service, /timeSeries/);
assert.match(service, /resolveBranchScope\(user, query\.branchId\)/);
assert.match(service, /refundHandling/);
assert.match(service, /supported: false/);
assert.doesNotMatch(service, /Math\.random|mock|fake/i);

for (const uiText of [
  "Jami savdo",
  "Buyurtmalar soni",
  "Kanal kesimi",
  "Filiallar",
  "Kassirlar",
  "Smenalar",
  "Top mahsulotlar",
  "Kategoriya sotuvlari",
  "Faqat PAID/SUCCESS to'lovlar sotuvga kiradi",
]) {
  assert.match(reportsUi, new RegExp(escapeRegExp(uiText)));
}

assert.match(reportsUi, /\/reports\/sales/);
assert.match(reportsUi, /preset/);
assert.match(reportsUi, /source/);
assert.match(reportsUi, /year/);
assert.match(reportsUi, /overflow-x-auto/);

console.info("Admin sales reports static validation passed");

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
