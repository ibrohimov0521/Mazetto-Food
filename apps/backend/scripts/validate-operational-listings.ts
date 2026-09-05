import * as assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * 4-bosqich: operatsion ro'yxat endpointlari.
 *
 * `GET /shifts`, `GET /receipts`, `GET /payments` — 3-bosqichda admin panelda
 * qurib bo'lmagan modullarni ochadi.
 *
 * Bu validator quyidagilarni tekshiradi:
 *   - yangi permissionlar `permissions.ts` va `seed.ts` da bor
 *   - ular TO'G'RI rollarga berilgan (va noto'g'rilariga berilmagan)
 *   - kontrollerlar to'g'ri permission bilan himoyalangan
 *   - servislar branch scope'ni majburlaydi
 *   - ro'yxatlar cheklangan (pagination) — cheksiz so'rov yo'q
 */

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const permissions = readSource("apps/backend/src/common/auth/permissions.ts");
const seed = readSource("apps/backend/prisma/seed.ts");

const shiftsController = readSource("apps/backend/src/modules/shifts/shifts.controller.ts");
const shiftsService = readSource("apps/backend/src/modules/shifts/shifts.service.ts");
const shiftsDto = readSource("apps/backend/src/modules/shifts/dto/list-shifts.dto.ts");

const receiptsController = readSource("apps/backend/src/modules/receipts/receipts.controller.ts");
const receiptsService = readSource("apps/backend/src/modules/receipts/receipts.service.ts");
const receiptsDto = readSource("apps/backend/src/modules/receipts/dto/list-receipts.dto.ts");

const paymentsController = readSource("apps/backend/src/modules/payments/payments.controller.ts");
const paymentsService = readSource("apps/backend/src/modules/payments/payments.service.ts");
const paymentsDto = readSource("apps/backend/src/modules/payments/dto/list-payments.dto.ts");

// 1. Yangi permissionlar mavjud
for (const permission of ["SHIFT_VIEW_BRANCH", "PAYMENT_VIEW"]) {
  assert.match(permissions, new RegExp(`${permission}: "${permission}"`), `${permission} permissions.ts da yo'q`);
  assert.match(seed, new RegExp(`PERMISSIONS\\.${permission}`), `${permission} seed.ts da yo'q`);
  assert.match(seed, new RegExp(`\\[PERMISSIONS\\.${permission}\\]:`), `${permission} uchun nom yo'q`);
}

// 2. Rol matritsasi — berilishi kerak bo'lganlarga berilgan
const branchManagerBlock = seed.match(/code: "BRANCH_MANAGER"[\s\S]*?\n {2}\},/)?.[0] ?? "";
assert.match(branchManagerBlock, /PERMISSIONS\.SHIFT_VIEW_BRANCH/, "BRANCH_MANAGER da SHIFT_VIEW_BRANCH yo'q");
assert.match(branchManagerBlock, /PERMISSIONS\.PAYMENT_VIEW/, "BRANCH_MANAGER da PAYMENT_VIEW yo'q");

const accountantBlock = seed.match(/code: "ACCOUNTANT"[\s\S]*?\n {2}\},/)?.[0] ?? "";
assert.match(accountantBlock, /PERMISSIONS\.PAYMENT_VIEW/, "ACCOUNTANT da PAYMENT_VIEW yo'q");

// 3. Rol matritsasi — berilmasligi kerak bo'lganlarga berilmagan
const cashierBlock = seed.match(/code: "CASHIER"[\s\S]*?\n {2}\},/)?.[0] ?? "";
assert.doesNotMatch(
  cashierBlock,
  /PERMISSIONS\.SHIFT_VIEW_BRANCH/,
  "CASHIER faqat O'Z smenasini ko'rishi kerak — SHIFT_VIEW_BRANCH berilmasin",
);
assert.doesNotMatch(cashierBlock, /PERMISSIONS\.PAYMENT_VIEW/, "CASHIER ga PAYMENT_VIEW berilmasin");

const waiterBlock = seed.match(/code: "WAITER"[\s\S]*?\n {2}\},/)?.[0] ?? "";
const kitchenBlock = seed.match(/code: "KITCHEN"[\s\S]*?\n {2}\},/)?.[0] ?? "";
for (const [name, block] of [
  ["WAITER", waiterBlock],
  ["KITCHEN", kitchenBlock],
] as const) {
  assert.doesNotMatch(block, /PERMISSIONS\.SHIFT_VIEW_BRANCH/, `${name} ga SHIFT_VIEW_BRANCH berilmasin`);
  assert.doesNotMatch(block, /PERMISSIONS\.PAYMENT_VIEW/, `${name} ga PAYMENT_VIEW berilmasin`);
}

// ACCOUNTANT global read-only — smena boshqaruvi uning ishi emas
assert.doesNotMatch(accountantBlock, /PERMISSIONS\.SHIFT_OPEN|PERMISSIONS\.SHIFT_CLOSE/, "ACCOUNTANT smena ocha/yopa olmasligi kerak");

// 4. Kontrollerlar to'g'ri permission bilan himoyalangan
assert.match(shiftsController, /@Get\(\)\s*\n\s*@Permissions\(PERMISSIONS\.SHIFT_VIEW_BRANCH\)/, "GET /shifts noto'g'ri himoyalangan");
assert.match(receiptsController, /@Get\(\)\s*\n\s*@Permissions\(PERMISSIONS\.RECEIPT_VIEW\)/, "GET /receipts noto'g'ri himoyalangan");
assert.match(paymentsController, /@Get\(\)\s*\n\s*@Permissions\(PERMISSIONS\.PAYMENT_VIEW\)/, "GET /payments noto'g'ri himoyalangan");

// Yozish endpointlari o'z permissionlarini saqlab qolgan
assert.match(paymentsController, /@Permissions\(PERMISSIONS\.PAYMENT_CREATE\)/, "PAYMENT_CREATE himoyasi yo'qolgan");
assert.match(shiftsController, /@Permissions\(PERMISSIONS\.SHIFT_OPEN\)/, "SHIFT_OPEN himoyasi yo'qolgan");
assert.match(shiftsController, /@Permissions\(PERMISSIONS\.SHIFT_CLOSE\)/, "SHIFT_CLOSE himoyasi yo'qolgan");
assert.match(receiptsController, /@Permissions\(PERMISSIONS\.RECEIPT_PRINT\)/, "RECEIPT_PRINT himoyasi yo'qolgan");

// 5. Servislar branch scope'ni majburlaydi
for (const [name, source] of [
  ["shifts", shiftsService],
  ["receipts", receiptsService],
  ["payments", paymentsService],
] as const) {
  assert.match(source, /resolveBranchScope\(user, query\.branchId\)/, `${name} listida branch scope yo'q`);
}

// To'lovda branch scope buyurtma orqali qo'llanadi (Payment da branchId yo'q)
assert.match(paymentsService, /order: \{ branchId \}/, "payments branch scope buyurtma orqali qo'llanmagan");

// 6. Ro'yxatlar cheklangan — cheksiz so'rov yo'q
for (const [name, source] of [
  ["shifts", shiftsService],
  ["receipts", receiptsService],
  ["payments", paymentsService],
] as const) {
  assert.match(source, /take: query\.limit/, `${name} listida take yo'q — cheksiz so'rov`);
  assert.match(source, /skip: query\.offset/, `${name} listida skip yo'q`);
}

for (const [name, dto] of [
  ["shifts", shiftsDto],
  ["receipts", receiptsDto],
  ["payments", paymentsDto],
] as const) {
  assert.match(dto, /@Max\(100\)/, `${name} DTO da limit chegarasi yo'q`);
  assert.match(dto, /@Min\(1\)/, `${name} DTO da minimal limit yo'q`);
  assert.match(dto, /limit = 50/, `${name} DTO da standart limit yo'q`);
  assert.match(dto, /offset = 0/, `${name} DTO da standart offset yo'q`);
}

// 7. Chek ro'yxati og'ir maydonlarni qaytarmaydi
const listReceiptsBlock = receiptsService.match(/async listReceipts\([\s\S]*?\n {2}\}/)?.[0] ?? "";
assert.doesNotMatch(listReceiptsBlock, /content: true/, "chek ro'yxatida `content` qaytarilmasin");
assert.doesNotMatch(listReceiptsBlock, /escpos/, "chek ro'yxatida ESC/POS qaytarilmasin");

console.log("validate-operational-listings: OK");
console.log("  GET /shifts    → SHIFT_VIEW_BRANCH (yangi)");
console.log("  GET /receipts  → RECEIPT_VIEW");
console.log("  GET /payments  → PAYMENT_VIEW (yangi)");

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
