import assert from "node:assert/strict";
import test from "node:test";
import { readOfflinePosCatalogSnapshot } from "../lib/offline-pos-bootstrap.mjs";

const snapshot = {
  schemaVersion: 2,
  branchId: "branch-a",
  generatedAt: "2026-09-30T12:00:00.000Z",
  catalog: {
    branchId: "branch-a",
    categories: [{ id: "category-a", name: "Lavash" }],
    products: [
      {
        id: "product-a",
        categoryId: "category-a",
        name: "Classic lavash",
        sellingPrice: "32000",
        variants: [],
        modifiers: [],
      },
    ],
    paymentMethods: [{ code: "CASH", name: "Naqd", active: true }],
    tables: [
      {
        id: "table-a",
        code: "T1",
        name: "1-stol",
        status: "AVAILABLE",
      },
    ],
  },
};

test("restores a versioned POS catalog only for its authenticated branch", () => {
  const restored = readOfflinePosCatalogSnapshot(snapshot, "branch-a");

  assert.equal(restored.branchId, "branch-a");
  assert.equal(restored.generatedAt, snapshot.generatedAt);
  assert.deepEqual(restored.catalog, snapshot.catalog);
});

test("rejects unsupported, unscoped or cross-branch bootstrap snapshots", () => {
  assert.equal(readOfflinePosCatalogSnapshot({ ...snapshot, schemaVersion: 1 }, "branch-a"), null);
  assert.equal(readOfflinePosCatalogSnapshot(snapshot, null), null);
  assert.equal(readOfflinePosCatalogSnapshot(snapshot, "branch-b"), null);
  assert.equal(
    readOfflinePosCatalogSnapshot(
      { ...snapshot, catalog: { ...snapshot.catalog, branchId: "branch-b" } },
      "branch-a",
    ),
    null,
  );
});

test("rejects partial or malformed catalog data instead of rendering it", () => {
  assert.equal(
    readOfflinePosCatalogSnapshot(
      { ...snapshot, catalog: { ...snapshot.catalog, tables: null } },
      "branch-a",
    ),
    null,
  );
  assert.equal(
    readOfflinePosCatalogSnapshot(
      { ...snapshot, generatedAt: "not-a-date" },
      "branch-a",
    ),
    null,
  );
  assert.equal(
    readOfflinePosCatalogSnapshot(
      {
        ...snapshot,
        catalog: {
          ...snapshot.catalog,
          products: [{ id: "broken", name: "No price" }],
        },
      },
      "branch-a",
    ),
    null,
  );
});
