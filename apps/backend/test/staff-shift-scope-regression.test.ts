import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const kitchenSource = readFileSync(
  join(__dirname, "../src/modules/kitchen/kitchen.service.ts"),
  "utf8",
);
const cashSource = readFileSync(
  join(__dirname, "../src/modules/cash-register/cash-register.service.ts"),
  "utf8",
);
const shiftMigration = readFileSync(
  join(
    __dirname,
    "../prisma/migrations/20260911120000_one_open_shift_per_employee/migration.sql",
  ),
  "utf8",
);

function methodSource(source: string, name: string): string {
  const start = source.indexOf(`${name}(`);
  assert.notEqual(start, -1, `${name} method must exist`);
  const next = source.indexOf("\n  async ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("kitchen active and history orders stay scoped to today and the acting employee", () => {
  const active = methodSource(kitchenSource, "listOrders");
  const history = methodSource(kitchenSource, "listHistory");

  for (const method of [active, history]) {
    assert.match(method, /const employeeId = this\.requireEmployee\(user\)/);
    assert.match(method, /const day = this\.todayTashkentRange\(\)/);
    assert.match(method, /createdAt: \{ gte: day\.start, lt: day\.end \}/);
    assert.match(method, /changedByEmployeeId: employeeId/);
  }

  assert.match(active, /take: 250/);
  assert.match(history, /take: this\.parseLimit\(query\.limit\)/);
});

test("employee shift history stays scoped to the open shift and today", () => {
  const method = methodSource(cashSource, "getCurrentShiftOrders");

  assert.match(method, /const employeeId = this\.requireEmployee\(user\)/);
  assert.match(method, /where: \{ employeeId, status: ShiftStatus\.OPEN \}/);
  assert.doesNotMatch(method, /ShiftType\.CASHIER/);
  assert.match(method, /this\.assertCanViewShift\(user, shift\.employeeId\)/);
  assert.match(method, /const day = this\.todayTashkentRange\(\)/);
  assert.match(method, /shiftId: shift\.id/);
  assert.match(method, /createdAt: \{ gte: day\.start, lt: day\.end \}/);
  assert.match(method, /take: this\.parseLimit\(query\.limit\)/);
});

test("cash ownership is unified across POS, courier and payment flows", () => {
  const sources = [
    readFileSync(join(__dirname, "../src/modules/orders/order-guards.ts"), "utf8"),
    readFileSync(join(__dirname, "../src/modules/customers/customer-courier.service.ts"), "utf8"),
    readFileSync(join(__dirname, "../src/modules/payments/payments.service.ts"), "utf8"),
    readFileSync(join(__dirname, "../src/modules/shifts/shifts.service.ts"), "utf8"),
  ];

  for (const source of sources.slice(0, 3)) {
    assert.doesNotMatch(source, /type: ShiftType\.(CASHIER|COURIER)/);
  }

  const shifts = sources.at(-1) ?? "";
  assert.match(shifts, /type: ShiftType\.CASHIER/);
  assert.match(shifts, /where: \{ employeeId, status: ShiftStatus\.OPEN \}/);
});

test("one open employee cash drawer is enforced without touching history", () => {
  assert.match(shiftMigration, /CREATE UNIQUE INDEX/);
  assert.match(shiftMigration, /"branchId", "employeeId"/);
  assert.match(shiftMigration, /WHERE "status" = 'OPEN'/);
  assert.doesNotMatch(shiftMigration, /DELETE FROM|DROP TABLE|TRUNCATE/i);
});

test("order status history includes the acting employee and user", () => {
  const orderRules = readFileSync(
    join(__dirname, "../src/modules/orders/order-rules.ts"),
    "utf8",
  );
  const customerShared = readFileSync(
    join(__dirname, "../src/modules/customers/customer-shared.ts"),
    "utf8",
  );

  for (const source of [orderRules, customerShared]) {
    assert.match(source, /statusHistory:/);
    assert.match(source, /changedByEmployee/);
    assert.match(source, /changedByUser/);
    assert.match(source, /createdAt/);
  }
});
