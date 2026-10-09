import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function main(): void {
  const schema = read("prisma/schema.prisma");
  const ordersService = read("src/modules/orders/orders.service.ts");
  const shiftPage = read("../pos-web/app/(fullscreen)/shift/page.tsx");
  const posPage = read("../pos-web/app/(fullscreen)/pos/page.tsx");
  const paymentPage = read("../pos-web/app/(fullscreen)/pos/payment/page.tsx");
  const historyPage = read("../pos-web/app/(fullscreen)/pos/history/page.tsx");
  const navigation = read("../pos-web/components/staff/staff-panel-navigation.tsx");
  const auth = read("../pos-web/lib/auth.ts");

  assert.match(schema, /expectedCash\s+Decimal\?/);
  assert.match(schema, /cashDifference\s+Decimal\?/);
  assert.match(schema, /shiftId\s+String\?/);
  assert.match(schema, /shift\s+Shift\?/);
  assert.match(ordersService, /assertOpenCashierShift/);
  assert.match(ordersService, /shiftId: openShift\.id/);
  assert.match(ordersService, /tx\.revenueRecord\.create/);
  assert.match(ordersService, /tx\.cashTransaction\.create/);
  assert.match(ordersService, /CashTransactionType\.SALE/);
  assert.match(posPage, /\/cash-register\/shift/);
  assert.match(posPage, /router\.replace\("\/shift"\)/);
  assert.match(posPage, /CashierWorkspaceNavigation user=\{user\}/);
  assert.match(paymentPage, /CashierWorkspaceNavigation user=\{user\}/);
  assert.match(historyPage, /CashierWorkspaceNavigation user=\{user\}/);
  assert.match(shiftPage, /CashierWorkspaceNavigation user=\{user\}/);
  assert.match(navigation, /href: "\/pos", label: "Kassa"/);
  assert.match(navigation, /href: "\/pos\/payment", label: "Kutilayotgan to'lovlar"/);
  assert.match(navigation, /href: "\/pos\/history", label: "Tarix"/);
  assert.match(navigation, /href: "\/shift", label: "Smena"/);
  assert.match(auth, /CASHIER: "\/shift"/);
  assert.match(shiftPage, /\/cash-register\/shift\/open/);
  assert.match(shiftPage, /\/cash-register\/shift\/\$\{shift\.id\}\/close/);
  assert.match(shiftPage, /const needsBranchChoice = Boolean\(/);
  assert.match(shiftPage, /user && \(user\.roles\.includes\("SUPER_ADMIN"\) \|\| !user\.branchId\)/);
  assert.match(shiftPage, /needsBranchChoice \? \{ branchId: openingBranchId \} : \{\}/);
  assert.match(shiftPage, /setShift\(current\?\.status === "OPEN" \? current : null\)/);
  assert.match(shiftPage, /setIsConfirmingClose\(true\)/);
  assert.match(shiftPage, /Smenani yakunlaysizmi\?/);
  assert.match(shiftPage, /isSaving \? "Yopilmoqda\.\.\." : "Yakunlash"/);
  assert.match(shiftPage, /closingCash !== "" &&\s+Number\.isFinite\(closingValue\) &&\s+closingValue >= 0/);
  assert.match(shiftPage, /const hasUnresolvedCashTransfer = Boolean\(/);
  assert.match(shiftPage, /transfer\.status === "PENDING" \|\| transfer\.pendingSync/);
  assert.match(
    shiftPage,
    /disabled=\{isSaving \|\| !closingValid \|\| hasUnresolvedCashTransfer\}/,
  );
  assert.match(shiftPage, /const difference = closingValue - expectedCash/);
  assert.match(shiftPage, /differenceText\(difference\)/);

  console.info("Shift/Kassa static validation passed");
}

main();
