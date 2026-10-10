import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { ShiftsService } from "../src/modules/shifts/shifts.service";

const cashier: AuthenticatedUser = {
  id: "cashier-a",
  employeeId: "employee-a",
  branchId: "branch-a",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  isGlobalScope: false,
  roles: ["CASHIER"],
  permissions: ["CASH_TRANSACTION_CREATE"],
};

test("cash transfer replay does not create another transfer or ledger row", async () => {
  let transactionActive = false;
  let transferWrites = 0;
  let ledgerWrites = 0;
  let allocationSnapshots = 0;
  const lockedShiftIds: string[] = [];
  let idemRecord:
    | {
        id: string;
        requestHash: string;
        resourceId: string | undefined;
        resourceType: string | undefined;
        status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
      }
    | undefined;
  let transfer: Record<string, unknown> | undefined;

  const tx = {
    restaurantTenant: { findFirst: async () => ({ id: "tenant-a" }) },
    branch: { findFirst: async () => ({ id: "branch-a" }) },
    employee: { findFirst: async () => ({ id: "employee-a" }) },
    shift: {
      findFirst: async () => ({
        id: "source-shift",
        branchId: "branch-a",
        employeeId: "employee-a",
        status: "OPEN",
        openingBalance: new Prisma.Decimal(10_000),
      }),
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === "source-shift"
          ? {
              id: "source-shift",
              branchId: "branch-a",
              employeeId: "employee-a",
              status: "OPEN",
              openingBalance: new Prisma.Decimal(10_000),
            }
          : {
              id: "receiver-shift",
              branchId: "branch-a",
              employeeId: "employee-b",
              status: "OPEN",
              employee: {
                status: "ACTIVE",
                firstName: "Receiver",
                lastName: "Cashier",
                user: { roles: [{ role: { code: "CASHIER" } }] },
              },
            },
      findUniqueOrThrow: async () => ({
        openingBalance: new Prisma.Decimal(10_000),
      }),
    },
    $queryRawUnsafe: async (_query: string, shiftId: string) => {
      lockedShiftIds.push(shiftId);
      return [{ id: shiftId }];
    },
    cashTransaction: {
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        ledgerWrites += 1;
        return { id: "cash-out-a", ...data };
      },
    },
    cashTransfer: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        transferWrites += 1;
        transfer = { id: "transfer-a", ...data };
        return transfer;
      },
      findUniqueOrThrow: async () => ({
        ...transfer,
        fromShift: { employee: { id: "employee-a" } },
        toShift: { employee: { id: "employee-b" } },
        allocations: [],
      }),
    },
  };
  const prisma = {
    restaurantTenant: tx.restaurantTenant,
    branch: {
      findFirst: tx.branch.findFirst,
      findUnique: async () => ({ tenantId: "tenant-a" }),
    },
    cashTransfer: {
      findFirst: async ({ where }: { where: { id: string } }) =>
        transfer?.id === where.id
          ? {
              ...transfer,
              fromShift: { employee: { id: "employee-a" } },
              toShift: { employee: { id: "employee-b" } },
              allocations: [],
            }
          : null,
    },
    $transaction: async <T>(callback: (database: typeof tx) => Promise<T>) => {
      transactionActive = true;
      try {
        return await callback(tx);
      } finally {
        transactionActive = false;
      }
    },
  };
  const idempotency = {
    start: async (input: { requestHash: string }) => {
      if (idemRecord) {
        if (idemRecord.requestHash !== input.requestHash) {
          throw new ConflictException(
            "Idempotency key was already used with a different request",
          );
        }
        if (idemRecord.status === "COMPLETED") {
          return { kind: "REPLAY" as const, record: idemRecord };
        }
        throw new ConflictException("The same request is still in progress");
      }
      idemRecord = {
        id: "idem-transfer-a",
        requestHash: input.requestHash,
        resourceId: undefined,
        resourceType: undefined,
        status: "IN_PROGRESS",
      };
      return { kind: "CLAIMED" as const, record: idemRecord };
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
      assert.equal(id, "idem-transfer-a");
      assert.ok(idemRecord);
      idemRecord.status = "COMPLETED";
      idemRecord.requestHash = result.requestHash;
      idemRecord.resourceId = result.resourceId;
      idemRecord.resourceType = result.resourceType;
    },
    fail: async () => {
      if (idemRecord) idemRecord.status = "FAILED";
    },
  };
  const service = new ShiftsService(prisma as never, idempotency as never);
  Object.defineProperty(service, "createTransferAllocations", {
    value: async (database: typeof tx) => {
      assert.equal(transactionActive, true);
      assert.equal(database, tx);
      allocationSnapshots += 1;
    },
  });

  const dto = { amount: 2_500, toShiftId: "receiver-shift" };
  const context = {
    idempotencyKey: "cash-transfer-key-a",
    correlationId: "request-transfer-a",
  };
  const created = await service.createCashTransfer(dto, cashier, context);
  const replay = await service.createCashTransfer(dto, cashier, context);

  assert.equal(created.id, "transfer-a");
  assert.deepEqual(replay, {
    ...transfer,
    fromShift: { employee: { id: "employee-a" } },
    toShift: { employee: { id: "employee-b" } },
    allocations: [],
  });
  assert.equal(transferWrites, 1);
  assert.equal(ledgerWrites, 1);
  assert.equal(allocationSnapshots, 1);
  assert.deepEqual(lockedShiftIds, ["receiver-shift", "source-shift"]);
  assert.equal(idemRecord?.status, "COMPLETED");

  await assert.rejects(
    service.createCashTransfer({ ...dto, amount: 2_600 }, cashier, context),
    /different request/,
  );
  assert.equal(transferWrites, 1);
  assert.equal(ledgerWrites, 1);
  assert.equal(allocationSnapshots, 1);
});
