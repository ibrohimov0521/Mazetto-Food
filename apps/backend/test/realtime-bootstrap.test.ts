import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { decodeBranchRevisionCursor } from "../src/modules/realtime/realtime.service";
import { RealtimeBootstrapService } from "../src/modules/realtime/desktop-bootstrap.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

test("POS bootstrap returns a branch-bound safe catalog in a repeatable-read snapshot", async () => {
  let transactionOptions: unknown;
  let productSelect: Record<string, unknown> | undefined;
  let categoryWhere: Record<string, unknown> | undefined;
  const configuredPaymentMethods = [
    {
      branchId: "branch-a",
      code: "CASH",
      name: "Naqd filial",
      sortOrder: 1,
    },
    {
      branchId: null,
      code: "CASH",
      name: "Naqd umumiy",
      sortOrder: 2,
    },
    { branchId: null, code: "CARD", name: "Karta", sortOrder: 3 },
  ];
  const tables = [
    {
      id: "table-a",
      code: "T1",
      name: "1-stol",
      number: 1,
      capacity: 4,
      status: "AVAILABLE",
      hall: { id: "hall-a", name: "Asosiy zal" },
    },
  ];
  const branch = {
    id: "branch-a",
    code: "A",
    name: "Mazetto",
    timezone: "Asia/Tashkent",
    isActive: true,
    isTemporarilyClosed: false,
    acceptsOrders: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    realtimeRevision: 44n,
  };
  const service = new RealtimeBootstrapService({
    $transaction: async (
      callback: (transaction: object) => Promise<unknown>,
      options: unknown,
    ) => {
      transactionOptions = options;
      return callback({
        restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
        branch: {
          findFirst: async (args: { select: Record<string, boolean> }) =>
            "realtimeRevision" in args.select ? branch : { id: "branch-a" },
        },
        category: {
          findMany: async (args: { where: Record<string, unknown> }) => {
            categoryWhere = args.where;
            return [{ id: "category-a", name: "Lavash" }];
          },
        },
        product: {
          findMany: async (args: { select: Record<string, unknown> }) => {
            productSelect = args.select;
            return [{ id: "product-a", sellingPrice: 1000 }];
          },
        },
        paymentMethod: {
          findMany: async () => configuredPaymentMethods,
        },
        restaurantTable: {
          findMany: async () => tables,
        },
      });
    },
  } as never);

  const snapshot = await service.create("branch-a", owner);

  assert.equal(snapshot.tenantId, "tenant-a");
  assert.equal(snapshot.branchId, "branch-a");
  assert.equal("realtimeRevision" in snapshot.branch, false);
  assert.deepEqual(decodeBranchRevisionCursor(snapshot.cursor), {
    version: 2,
    branches: { "branch-a": "44" },
  });
  assert.deepEqual(snapshot.offlineCapabilities.queuedPaymentMethods, ["CASH"]);
  assert.equal(snapshot.schemaVersion, 2);
  assert.deepEqual(snapshot.catalog.categories, [
    { id: "category-a", name: "Lavash" },
  ]);
  assert.deepEqual(snapshot.catalog.paymentMethods, [
    { code: "CASH", name: "Naqd filial", active: true },
    { code: "CARD", name: "Karta", active: true },
  ]);
  assert.deepEqual(snapshot.catalog.tables, tables);
  assert.equal(
    (transactionOptions as { isolationLevel: string }).isolationLevel,
    "RepeatableRead",
  );
  assert.ok(productSelect);
  assert.ok(categoryWhere);
  assert.ok((categoryWhere.products as { some?: unknown }).some);
  assert.equal(productSelect.costPrice, undefined);
  assert.ok(productSelect.variants);
  const variantSelect = (
    productSelect.variants as { select: Record<string, unknown> }
  ).select;
  assert.equal(variantSelect.costPrice, undefined);
});

test("POS bootstrap fails closed while the legacy catalog tenant is ambiguous", async () => {
  let catalogReads = 0;
  const service = new RealtimeBootstrapService({
    $transaction: async (callback: (transaction: object) => Promise<unknown>) =>
      callback({
        restaurantTenant: {
          findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
        },
        branch: {
          findFirst: async () => assert.fail("must not read branches"),
        },
        category: {
          findMany: async () => {
            catalogReads += 1;
            return [];
          },
        },
        product: {
          findMany: async () => {
            catalogReads += 1;
            return [];
          },
        },
      }),
  } as never);

  await assert.rejects(service.create("branch-a", owner));
  assert.equal(catalogReads, 0);
});
