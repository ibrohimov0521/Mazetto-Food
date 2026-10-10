import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { decodeBranchRevisionCursor } from "../src/modules/realtime/realtime.service";
import { RealtimeBootstrapService } from "../src/modules/realtime/desktop-bootstrap.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: ["POS_USE", "MENU_VIEW", "TABLE_VIEW"],
};

test("POS bootstrap returns a branch-bound safe catalog in a repeatable-read snapshot", async () => {
  let transactionOptions: unknown;
  let productSelect: Record<string, unknown> | undefined;
  let categoryWhere: Record<string, unknown> | undefined;
  const reads = {
    categories: 0,
    products: 0,
    paymentMethods: 0,
    tables: 0,
    halls: 0,
  };
  let tableSelect: Record<string, unknown> | undefined;
  let tableWhere: Record<string, unknown> | undefined;
  let tableOrdersQuery: Record<string, unknown> | undefined;
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
      branchId: "branch-a",
      hallId: "hall-a",
      code: "T1",
      name: "1-stol",
      number: 1,
      capacity: 4,
      status: "AVAILABLE",
      hall: { id: "hall-a", name: "Asosiy zal" },
      orders: [],
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
  const service = new RealtimeBootstrapService(
    {
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
              reads.categories += 1;
              categoryWhere = args.where;
              return [{ id: "category-a", name: "Lavash" }];
            },
          },
          product: {
            findMany: async (args: { select: Record<string, unknown> }) => {
              reads.products += 1;
              productSelect = args.select;
              return [{ id: "product-a", sellingPrice: 1000 }];
            },
          },
          paymentMethod: {
            findMany: async () => {
              reads.paymentMethods += 1;
              return configuredPaymentMethods;
            },
          },
          restaurantTable: {
            findMany: async (args: {
              where: Record<string, unknown>;
              select: Record<string, unknown>;
            }) => {
              reads.tables += 1;
              tableSelect = args.select;
              tableWhere = args.where;
              const ordersQuery = args.select.orders;
              if (ordersQuery && typeof ordersQuery === "object") {
                tableOrdersQuery = ordersQuery as Record<string, unknown>;
              }
              return "orders" in args.select
                ? tables
                : tables.map((table) =>
                    Object.fromEntries(
                      Object.entries(table).filter(([key]) => key !== "orders"),
                    ),
                  );
            },
          },
          hall: {
            findMany: async () => {
              reads.halls += 1;
              return [
                {
                  id: "hall-a",
                  branchId: "branch-a",
                  code: "MAIN",
                  name: "Asosiy zal",
                  isActive: true,
                  sortOrder: 1,
                },
              ];
            },
          },
        });
      },
    } as never,
    {
      getCsv: async () => ["CASH", "CARD"],
    } as never,
  );

  const snapshot = await service.create("branch-a", owner);
  const waiterSnapshot = await service.create("branch-a", {
    ...owner,
    permissions: ["TABLE_VIEW", "MENU_VIEW"],
  });
  const tableOnlySnapshot = await service.create("branch-a", {
    ...owner,
    permissions: ["TABLE_VIEW"],
  });
  const posOnlySnapshot = await service.create("branch-a", {
    ...owner,
    permissions: ["POS_USE"],
  });

  assert.equal(snapshot.tenantId, "tenant-a");
  assert.equal(snapshot.branchId, "branch-a");
  assert.equal("realtimeRevision" in snapshot.branch, false);
  assert.deepEqual(decodeBranchRevisionCursor(snapshot.cursor), {
    version: 2,
    branches: { "branch-a": "44" },
  });
  assert.ok(snapshot.catalog);
  assert.ok(snapshot.offlineCapabilities);
  assert.ok(waiterSnapshot.menu);
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
  assert.deepEqual(snapshot.tables, tables);
  assert.deepEqual(snapshot.halls, [
    {
      id: "hall-a",
      branchId: "branch-a",
      code: "MAIN",
      name: "Asosiy zal",
      isActive: true,
      sortOrder: 1,
    },
  ]);
  assert.deepEqual(waiterSnapshot.menu.categories, [
    { id: "category-a", name: "Lavash" },
  ]);
  assert.equal("catalog" in waiterSnapshot, false);
  assert.equal("offlineCapabilities" in waiterSnapshot, false);
  assert.deepEqual(tableOnlySnapshot.tables, tables);
  assert.ok(posOnlySnapshot.catalog);
  assert.equal("orders" in (posOnlySnapshot.catalog.tables[0] ?? {}), false);
  assert.equal("orders" in (tableSelect ?? {}), false);
  assert.deepEqual(tableWhere, { branchId: "branch-a", isActive: true });
  assert.ok(tableOrdersQuery);
  assert.equal("take" in tableOrdersQuery, false);
  assert.equal("menu" in tableOnlySnapshot, false);
  assert.equal("catalog" in tableOnlySnapshot, false);
  assert.deepEqual(reads, {
    categories: 3,
    products: 3,
    paymentMethods: 2,
    tables: 4,
    halls: 4,
  });
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

test("kitchen bootstrap returns a bounded, branch-scoped queue without customer data", async () => {
  let kitchenQuery: Record<string, unknown> | undefined;
  let transactionOptions: unknown;
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
    realtimeRevision: 9n,
  };
  const ticket = {
    id: "ticket-a",
    ticketNumber: "K-101",
    status: "COOKING",
    priority: 1,
    version: 2,
    revisionNumber: 1,
    isSupplement: false,
    createdAt: new Date("2026-10-01T08:00:00.000Z"),
    acceptedAt: new Date("2026-10-01T08:01:00.000Z"),
    items: [
      {
        id: "ticket-item-a",
        productName: "Lavash",
        variantName: null,
        quantity: "1",
        notes: null,
        modifierSnapshot: [],
        stationRouting: "KITCHEN",
        printerNameSnapshot: "Oshxona",
      },
    ],
    order: {
      id: "order-a",
      branchId: "branch-a",
      version: 3,
      total: "12000",
      paymentStatus: "PAID",
      payments: [
        {
          amount: "12000",
          status: "PARTIALLY_REFUNDED",
          refunds: [{ amount: "1000" }],
        },
      ],
      orderNumber: "A-101",
      displayOrderNumber: "101",
      source: "POS",
      type: "DINE_IN",
      isSupplemental: false,
      supplementNumber: null,
      notes: null,
      kitchenComment: null,
      branch: { name: "Mazetto" },
      table: { number: 3, name: "3-stol" },
      items: [],
    },
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
        kitchenTicket: {
          findMany: async (args: Record<string, unknown>) => {
            kitchenQuery = args;
            return [ticket];
          },
        },
      });
    },
  } as never);
  const cook = {
    ...owner,
    id: "cook-a",
    employeeId: "employee-a",
    roles: ["KITCHEN"],
    permissions: ["KITCHEN_VIEW"],
  };

  await assert.rejects(service.create("branch-a", cook));
  const snapshot = await service.create("branch-a", cook, "kitchen");

  assert.equal(snapshot.branchId, "branch-a");
  assert.equal(snapshot.schemaVersion, 2);
  assert.deepEqual(snapshot.kitchenQueue, {
    items: [ticket],
    hasMore: false,
    limit: 250,
  });
  assert.equal(kitchenQuery?.take, 251);
  const where = kitchenQuery?.where as {
    order: { branchId: string };
  };
  assert.equal(where.order.branchId, "branch-a");
  const select = kitchenQuery?.select as {
    order: { select: Record<string, unknown> };
  };
  assert.equal(select.order.select.paymentStatus, true);
  assert.deepEqual(select.order.select.payments, {
    select: {
      amount: true,
      status: true,
      refunds: { select: { amount: true } },
    },
  });
  assert.equal("customerName" in select.order.select, false);
  assert.equal("customerPhone" in select.order.select, false);
  assert.equal(
    (transactionOptions as { isolationLevel: string }).isolationLevel,
    "RepeatableRead",
  );
});
