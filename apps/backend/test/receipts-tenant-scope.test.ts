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
