import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { ReceiptsService } from "../src/modules/receipts/receipts.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

const activeTenant = {
  restaurantTenant: {
    findMany: async () => [{ id: "tenant-a" }],
  },
};

function receiptWithOrderFallback(content: Record<string, unknown>) {
  return {
    id: "receipt-a",
    branchId: "branch-a",
    receiptNumber: "RCPT-1",
    documentType: "REFUND:refund-a",
    content,
    total: { toFixed: () => "-12000.00" },
    createdAt: new Date("2026-10-10T06:00:00Z"),
    branch: { name: "Sergeli" },
    order: {
      orderNumber: "M-104",
      displayOrderNumber: "M-104",
      items: [{
        productName: "Lavash",
        variantName: null,
        quantity: { toFixed: () => "1.000" },
        totalPrice: { toFixed: () => "36000.00" },
      }],
      payments: [{ method: { code: "CASH" }, amount: { toFixed: () => "36000.00" } }],
      closedBy: null,
    },
  };
}

test("receipt and print queue listing plus repair stay inside tenant", async () => {
  const filters = new Map<string, Record<string, unknown>>();
  const service = new ReceiptsService({
    ...activeTenant,
    receipt: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.set("receipts", args.where);
        return [];
      },
    },
    printJob: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.set("printJobs", args.where);
        return [];
      },
    },
  } as never);

  await service.listReceipts({} as never, owner);
  await service.listPrintJobs({} as never, owner);

  assert.deepEqual(filters.get("receipts")?.branch, { tenantId: "tenant-a" });
  assert.deepEqual(filters.get("printJobs")?.branch, { tenantId: "tenant-a" });
});

test("foreign receipt detail and bulk delete preflight return not found", async () => {
  const lookups: Record<string, unknown>[] = [];
  let transactionStarted = false;
  const service = new ReceiptsService({
    ...activeTenant,
    receipt: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        lookups.push(args.where);
        return null;
      },
      findMany: async (args: { where: Record<string, unknown> }) => {
        lookups.push(args.where);
        return [];
      },
    },
    $transaction: async () => {
      transactionStarted = true;
    },
  } as never);

  await assert.rejects(service.getReceipt("receipt-b", owner), /Receipt not found/);
  await assert.rejects(
    service.deleteReceipts(["receipt-b"], owner),
    /Tanlangan cheklarning biri topilmadi/,
  );
  assert.deepEqual(lookups[0], {
    id: "receipt-b",
    branch: { tenantId: "tenant-a" },
  });
  assert.deepEqual(lookups[1], {
    id: { in: ["receipt-b"] },
    branch: { tenantId: "tenant-a" },
  });
  assert.equal(transactionStarted, false);
});

test("bulk receipt deletion preserves unfinished print jobs", async () => {
  let receiptDeleteCalled = false;
  let printJobsLocked = false;
  const service = new ReceiptsService({
    ...activeTenant,
    receipt: {
      findMany: async () => [{
        id: "receipt-a",
        branchId: "branch-a",
        receiptNumber: "RCPT-1",
        documentType: "RECEIPT",
      }],
    },
    $transaction: async (callback: (tx: object) => Promise<unknown>) => callback({
      $executeRaw: async () => 1,
      $queryRaw: async () => {
        printJobsLocked = true;
        return [{ id: "print-job-a" }];
      },
      printJob: {
        findMany: async () => [{ receiptId: "receipt-a" }],
      },
      receipt: {
        deleteMany: async () => {
          receiptDeleteCalled = true;
          return { count: 1 };
        },
      },
      auditLog: { create: async () => ({}) },
    }),
  } as never);

  await assert.rejects(
    service.deleteReceipts(["receipt-a"], owner),
    /Chop navbatida yoki tekshiruvda turgan chekni o'chirib bo'lmaydi/,
  );
  assert.equal(printJobsLocked, true);
  assert.equal(receiptDeleteCalled, false);
});

test("foreign receipt cannot be reprinted by a global actor", async () => {
  let receiptWhere: unknown;
  let transactionStarted = false;
  const service = new ReceiptsService({
    ...activeTenant,
    receipt: {
      findUnique: async () => ({ id: "receipt-b", branchId: "branch-b", content: null }),
      findFirst: async (args: { where: unknown }) => {
        receiptWhere = args.where;
        return null;
      },
    },
    $transaction: async (callback: (tx: object) => Promise<unknown>) => {
      transactionStarted = true;
      return callback({
        printer: { findMany: async () => [] },
        printJob: { create: async () => ({ id: "print-job-b" }) },
        receipt: { update: async () => ({ id: "receipt-b" }) },
      });
    },
  } as never);

  await assert.rejects(service.reprintReceipt("receipt-b", owner), /Receipt not found/);
  assert.deepEqual(receiptWhere, {
    id: "receipt-b",
    branch: { tenantId: "tenant-a" },
  });
  assert.equal(transactionStarted, false);
});

test("mark printed keeps the tenant filter on the database update", async () => {
  let updateWhere: unknown;
  let legacyUpdateCalled = false;
  const service = new ReceiptsService({
    ...activeTenant,
    receipt: {
      updateMany: async (args: { where: unknown }) => {
        updateWhere = args.where;
        return { count: 0 };
      },
      update: async () => {
        legacyUpdateCalled = true;
      },
    },
  } as never);

  await assert.rejects(service.markPrinted("receipt-b", owner), /Receipt not found/);
  assert.deepEqual(updateWhere, {
    id: "receipt-b",
    branch: { tenantId: "tenant-a" },
  });
  assert.equal(legacyUpdateCalled, false);
});

test("reprint aborts before queueing if the tenant-scoped receipt update loses its scope", async () => {
  let receiptLookup: unknown;
  let updateWhere: unknown;
  let printerLookup = false;
  const service = new ReceiptsService({
    ...activeTenant,
    receipt: {
      findFirst: async (args: { where: unknown }) => {
        receiptLookup = args.where;
        return { id: "receipt-a", branchId: "branch-a", content: null };
      },
    },
    $transaction: async (callback: (tx: object) => Promise<unknown>) => callback({
      receipt: {
        updateMany: async (args: { where: unknown }) => {
          updateWhere = args.where;
          return { count: 0 };
        },
      },
      printer: { findMany: async () => { printerLookup = true; return []; } },
    }),
  } as never);

  await assert.rejects(service.reprintReceipt("receipt-a", owner), /Receipt not found/);
  assert.deepEqual(receiptLookup, { id: "receipt-a", branch: { tenantId: "tenant-a" } });
  assert.deepEqual(updateWhere, { id: "receipt-a", branchId: "branch-a", branch: { tenantId: "tenant-a" } });
  assert.equal(printerLookup, false);
});

test("manual receipt reprint queues a job that bypasses local replay deduplication", async () => {
  const queuedPayloads: unknown[] = [];
  const content = {
    documentType: "RECEIPT",
    orderNumber: "M-104",
    branchName: "Sergeli",
    items: [{ name: "Lavash", quantity: "1", total: "36000" }],
    payments: [],
    total: "36000",
  };
  const service = new ReceiptsService({
    ...activeTenant,
    receipt: {
      findFirst: async () => ({
        id: "receipt-a",
        branchId: "branch-a",
        content,
        receiptNumber: "RCPT-1",
        documentType: "RECEIPT",
        branch: { name: "Sergeli" },
        order: {
          orderNumber: "M-104",
          displayOrderNumber: "M-104",
          items: [],
          payments: [],
        },
        createdAt: new Date("2026-10-10T06:00:00Z"),
        total: { toFixed: () => "36000.00" },
      }),
    },
    $transaction: async (callback: (tx: object) => Promise<unknown>) =>
      callback({
        $executeRaw: async () => 1,
        receipt: { updateMany: async () => ({ count: 1 }) },
        printer: { findMany: async () => [] },
        printJob: {
          create: async ({ data }: { data: { payload: unknown } }) => {
            queuedPayloads.push(data.payload);
          },
        },
      }),
  } as never);

  await service.reprintReceipt("receipt-a", owner);

  assert.deepEqual(queuedPayloads, [
    { ...content, __bestteamAllowLocalReprint: true },
  ]);
});
test("receipt snapshots preserve explicit empty arrays and legacy fallback remains", async () => {
  const getCommands = async (content: Record<string, unknown>) => {
    const service = new ReceiptsService({
      ...activeTenant,
      receipt: { findFirst: async () => receiptWithOrderFallback(content) },
    } as never);
    const receipt = await service.getReceipt("receipt-a", owner);
    return receipt.escpos.commands as Array<Record<string, unknown>>;
  };
  const refundCommands = await getCommands({ documentType: "REFUND", items: [], payments: [] });
  assert.deepEqual(refundCommands.filter((command) => command.type === "item"), []);
  assert.deepEqual(refundCommands.filter((command) => command.type === "payment"), []);
  const legacyCommands = await getCommands({ documentType: "RECEIPT" });
  assert.deepEqual(legacyCommands.filter((command) => command.type === "item").map((command) => command.name), ["Lavash"]);
  assert.deepEqual(legacyCommands.filter((command) => command.type === "payment").map((command) => command.method), ["CASH"]);
  const issuedSnapshotCommands = await getCommands({
    documentType: "RECEIPT",
    items: [{ name: "Issued item", quantity: "1", total: "12000.00" }],
    payments: [{ method: "CARD", amount: "12000.00" }],
  });
  assert.deepEqual(issuedSnapshotCommands.filter((command) => command.type === "item").map((command) => command.name), ["Issued item"]);
  assert.deepEqual(issuedSnapshotCommands.filter((command) => command.type === "payment").map((command) => command.method), ["CARD"]);
});
