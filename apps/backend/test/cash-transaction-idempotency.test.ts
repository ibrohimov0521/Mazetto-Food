import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { ShiftsService } from "../src/modules/shifts/shifts.service";

const cashier: AuthenticatedUser = {
  id: "cashier-a",
  employeeId: "employee-a",
  branchId: "branch-a",
  isGlobalScope: false,
  roles: ["CASHIER"],
  permissions: ["CASH_TRANSACTION_CREATE"],
};

test("cash transaction replay returns the original ledger row without a second write", async () => {
  let transactionActive = false;
  let writes = 0;
  let shiftLocks = 0;
  let storedTransaction: Record<string, unknown> | null = null;
  let idempotencyRecord:
    | {
        id: string;
        requestHash: string;
        resourceId?: string | undefined;
        resourceType?: string | undefined;
        status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
      }
    | undefined;
  let claimedScope = "";
  let claimedKey = "";

  const tx = {
    branch: {
      findUnique: async () => ({ tenantId: "tenant-a" }),
      findFirst: async () => ({ id: "branch-a" }),
    },
    shift: {
      findUnique: async () => ({
        id: "shift-a",
        branchId: "branch-a",
        employeeId: "employee-a",
        status: "OPEN",
      }),
      updateMany: async () => {
        shiftLocks += 1;
        return { count: 1 };
      },
    },
    employee: { findFirst: async () => ({ id: "employee-a" }) },
    order: { findFirst: async () => null },
    payment: { findFirst: async () => null },
    cashTransaction: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes += 1;
        storedTransaction = { id: "cash-transaction-a", ...data };
        return storedTransaction;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        storedTransaction &&
        where.id === storedTransaction.id &&
        where.shiftId === storedTransaction.shiftId &&
        where.createdById === storedTransaction.createdById
          ? storedTransaction
          : null,
    },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      transactionActive = true;
      try {
        return await callback(tx);
      } finally {
        transactionActive = false;
      }
    },
  };
  const idempotency = {
    start: async (input: {
      scope: string;
      key: string;
      requestHash: string;
    }) => {
      claimedScope = input.scope;
      claimedKey = input.key;
      if (idempotencyRecord) {
        if (idempotencyRecord.requestHash !== input.requestHash) {
          throw new ConflictException(
            "Idempotency key was already used with a different request",
          );
        }
        if (idempotencyRecord.status === "COMPLETED") {
          return { kind: "REPLAY" as const, record: idempotencyRecord };
        }
        throw new ConflictException("The same request is still in progress");
      }
      idempotencyRecord = {
        id: "idempotency-a",
        requestHash: input.requestHash,
        status: "IN_PROGRESS",
      };
      return { kind: "CLAIMED" as const, record: idempotencyRecord };
    },
    complete: async (
      id: string,
      result: {
        requestHash: string;
        resourceId?: string;
        resourceType?: string;
      },
      database: typeof tx,
    ) => {
      assert.equal(transactionActive, true);
      assert.equal(database, tx);
      assert.equal(id, "idempotency-a");
      assert.ok(idempotencyRecord);
      idempotencyRecord.status = "COMPLETED";
      idempotencyRecord.requestHash = result.requestHash;
      idempotencyRecord.resourceId = result.resourceId;
      idempotencyRecord.resourceType = result.resourceType;
    },
    fail: async () => {
      if (idempotencyRecord) idempotencyRecord.status = "FAILED";
    },
  };
  const service = new ShiftsService(prisma as never, idempotency as never);
  const dto = { type: "CASH_IN", amount: 500 } as const;
  const context = {
    idempotencyKey: "cash-ledger-key-1",
    correlationId: "request-a",
  };

  const first = await service.createCashTransaction(
    "shift-a",
    dto as never,
    cashier,
    context,
  );
  const replay = await service.createCashTransaction(
    "shift-a",
    dto as never,
    cashier,
    context,
  );

  assert.equal(claimedScope, "cash-transaction:shift-a:cashier-a");
  assert.equal(claimedKey, context.idempotencyKey);
  assert.deepEqual(replay, first);
  assert.equal(writes, 1);
  assert.equal(shiftLocks, 1);

  await assert.rejects(
    service.createCashTransaction(
      "shift-a",
      { ...dto, amount: 700 } as never,
      cashier,
      context,
    ),
    /different request/,
  );
  assert.equal(writes, 1);
});
