import assert from "node:assert/strict";
import test from "node:test";
import { readOfflineWaiterSnapshot } from "../lib/offline-waiter-bootstrap.mjs";

const snapshot = () => ({
  schemaVersion: 2,
  branchId: "branch-a",
  generatedAt: "2026-10-01T06:00:00.000Z",
  menu: {
    categories: [{ id: "category-a", name: "Lavash" }],
    products: [
      {
        id: "product-a",
        categoryId: "category-a",
        name: "Lavash",
        sellingPrice: "12000.00",
        variants: [],
        modifiers: [],
      },
    ],
  },
  tables: [
    {
      id: "table-a",
      branchId: "branch-a",
      name: "1-stol",
      status: "OCCUPIED",
      orders: [
        {
          id: "order-a",
          orderNumber: "A-1",
          status: "NEW",
          total: "12000.00",
          createdAt: "2026-10-01T05:59:00.000Z",
          version: 3,
          items: [],
        },
      ],
    },
  ],
});

test("waiter snapshot exposes a complete branch-scoped floor and menu", () => {
  const restored = readOfflineWaiterSnapshot(snapshot(), "branch-a");
  assert.equal(restored?.tables.length, 1);
  assert.equal(restored?.tables[0]?.orders[0]?.version, 3);
  assert.equal(restored?.products[0]?.sellingPrice, "12000.00");
});

test("waiter snapshot rejects cross-branch and incomplete data", () => {
  assert.equal(readOfflineWaiterSnapshot(snapshot(), "branch-b"), null);
  assert.equal(
    readOfflineWaiterSnapshot({ ...snapshot(), tables: undefined }, "branch-a"),
    null,
  );
  const malformed = snapshot();
  malformed.tables[0].orders[0].items = null;
  assert.equal(readOfflineWaiterSnapshot(malformed, "branch-a"), null);
});

test("table-only roles do not require menu fields", () => {
  const withoutMenu = { ...snapshot() };
  delete withoutMenu.menu;
  assert.deepEqual(
    readOfflineWaiterSnapshot(withoutMenu, "branch-a", false)?.products,
    [],
  );
});
