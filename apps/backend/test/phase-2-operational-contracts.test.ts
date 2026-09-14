import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("phase 2 migrations are additive and preserve historical rows", () => {
  const migrations = [
    "prisma/migrations/20260914130000_cash_transfer_allocations/migration.sql",
    "prisma/migrations/20260914133000_kitchen_ticket_revisions/migration.sql",
  ]
    .map(read)
    .join("\n");

  assert.doesNotMatch(migrations, /^\s*(?:DROP|TRUNCATE|DELETE)\b/im);
  assert.match(migrations, /KitchenTicketImported/);
  assert.match(migrations, /cash_transfer_allocations/);
});

test("cash handover snapshots provenance before writing CASH_OUT", () => {
  const source = read("src/modules/shifts/shifts.service.ts");
  const method = source.slice(
    source.indexOf("async createCashTransfer"),
    source.indexOf("async getCashTransferDetail"),
  );

  assert.ok(method.indexOf("createTransferAllocations") >= 0);
  assert.ok(
    method.indexOf("createTransferAllocations") <
      method.indexOf("CashTransactionType.CASH_OUT"),
  );
  assert.match(source, /item\.cashTransfer\?\.allocations\.length/);
});

test("staff termination keeps history and blocks open financial duties", () => {
  const source = read("src/modules/staff/staff.service.ts");

  assert.match(source, /async terminateStaff/);
  assert.match(source, /EmployeeStatus\.TERMINATED/);
  assert.match(source, /assertNoOpenFinancialDuties/);
  assert.match(source, /CashTransferStatus\.PENDING/);
  assert.match(source, /STAFF_TERMINATED/);
  assert.match(source, /async rehireStaff/);
  assert.match(source, /STAFF_REHIRED/);
  assert.match(source, /assertNotTerminated/);
});

test("kitchen tickets snapshot items and append versioned events", () => {
  const source = read("src/modules/kitchen/kitchen.service.ts");

  assert.match(source, /KitchenSupplementCreated/);
  assert.match(source, /sourceOrderVersion/);
  assert.match(source, /kitchenTicketEvent\.create/);
  assert.match(source, /version: \{ increment: 1 \}/);
  assert.match(
    source,
    /items: \{\s*where: \{ status: OrderItemStatus\.ACTIVE \}/,
  );
});
