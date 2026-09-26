import assert from "node:assert/strict";
import test from "node:test";
import { buildOrderListWhere } from "../src/modules/orders/orders-list-filters";

test("cashier queue filters unpaid orders, hides cancellations and searches server-side", () => {
  const where = buildOrderListWhere(
    {
      paymentStatus: "PENDING",
      excludeStatus: "CANCELLED",
      search: "  0042  ",
    },
    "branch-a",
  );

  assert.equal(where.branchId, "branch-a");
  assert.equal(where.paymentStatus, "PENDING");
  assert.deepEqual(where.NOT, { status: "CANCELLED" });
  assert.ok(where.OR);
});

test("admin order date filters use the complete local calendar day", () => {
  const where = buildOrderListWhere({
    from: "2026-09-25",
    to: "2026-09-25",
  });

  assert.deepEqual(where.createdAt, {
    gte: new Date("2026-09-24T19:00:00.000Z"),
    lte: new Date("2026-09-25T18:59:59.999Z"),
  });
});
