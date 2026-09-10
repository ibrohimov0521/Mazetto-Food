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

test("cashier shift history stays scoped to the open shift and today", () => {
  const method = methodSource(cashSource, "getCurrentShiftOrders");

  assert.match(method, /const employeeId = this\.requireEmployee\(user\)/);
  assert.match(method, /where: \{ employeeId, status: ShiftStatus\.OPEN \}/);
  assert.match(method, /this\.assertCanViewShift\(user, shift\.employeeId\)/);
  assert.match(method, /const day = this\.todayTashkentRange\(\)/);
  assert.match(method, /shiftId: shift\.id/);
  assert.match(method, /createdAt: \{ gte: day\.start, lt: day\.end \}/);
  assert.match(method, /take: this\.parseLimit\(query\.limit\)/);
});
