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
  permissions: ["SHIFT_OPEN", "SHIFT_CLOSE"],
};

function createIdempotency(transactionIsActive: () => boolean, tx: object) {
  let record:
    | {
        id: string;
        requestHash: string;
        resourceId: string | undefined;
        resourceType: string | undefined;
        status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
      }
    | undefined;
  return {
    start: async (input: { requestHash: string }) => {
      if (record) {
        if (record.requestHash !== input.requestHash) {
          throw new ConflictException(
            "Idempotency key was already used with a different request",
          );
        }
        if (record.status === "COMPLETED") {
          return { kind: "REPLAY" as const, record };
        }
        throw new ConflictException("The same request is still in progress");
      }
      record = {
        id: "shift-idem-a",
        requestHash: input.requestHash,
        resourceId: undefined,
        resourceType: undefined,
        status: "IN_PROGRESS",
      };
      return { kind: "CLAIMED" as const, record };
    },
    complete: async (
      id: string,
      result: {
        requestHash: string;
        resourceId?: string;
        resourceType?: string;
      },
      database: object,
    ) => {
      assert.equal(transactionIsActive(), true);
      assert.equal(database, tx);
      assert.equal(id, "shift-idem-a");
      assert.ok(record);
      record.status = "COMPLETED";
      record.requestHash = result.requestHash;
      record.resourceId = result.resourceId;
      record.resourceType = result.resourceType;
    },
    fail: async () => {
      if (record) record.status = "FAILED";
    },
  };
}

test("shift opening replay returns its shift without a second opening ledger row", async () => {
  let transactionActive = false;
  let shiftsCreated = 0;
  let openingRows = 0;
  const shift = {
    id: "shift-a",
    branchId: "branch-a",
    employeeId: "employee-a",
    status: "OPEN",
    shiftNumber: 8,
    openingBalance: new Prisma.Decimal(5_000),
  };
  const tx = {
    restaurantTenant: { findFirst: async () => ({ id: "tenant-a" }) },
    branch: { findFirst: async () => ({ id: "branch-a" }) },
    employee: { findFirst: async () => ({ id: "employee-a" }) },
    device: { findFirst: async () => null },
    $executeRaw: async () => 1,
    shift: {
      findFirst: async ({ where }: { where: { status?: string } }) =>
        where.status === "OPEN" ? null : { shiftNumber: 7 },
      create: async () => {
        shiftsCreated += 1;
        return shift;
      },
    },
    cashTransaction: {
      create: async () => {
        openingRows += 1;
        return { id: "opening-row-a" };
      },
    },
  };
  const prisma = {
    restaurantTenant: tx.restaurantTenant,
    branch: {
      findFirst: tx.branch.findFirst,
      findUnique: async () => ({ tenantId: "tenant-a" }),
    },
    employee: tx.employee,
    device: tx.device,
    shift: {
      findFirst: async () => shift,
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
  const idempotency = createIdempotency(() => transactionActive, tx);
  const service = new ShiftsService(prisma as never, idempotency as never);
  const dto = { branchId: "branch-a", openingBalance: 5_000 };
  const context = {
    idempotencyKey: "shift-open-key-a",
    correlationId: "shift-open-request-a",
  };

  const first = await service.openShift(dto, cashier, context);
  const replay = await service.openShift(dto, cashier, context);

  assert.equal(first.id, "shift-a");
  assert.deepEqual(replay, shift);
  assert.equal(shiftsCreated, 1);
  assert.equal(openingRows, 1);

  await assert.rejects(
    service.openShift({ ...dto, openingBalance: 6_000 }, cashier, context),
    /different request/,
  );
  assert.equal(shiftsCreated, 1);
  assert.equal(openingRows, 1);
});

test("shift close replay does not add another closing ledger row", async () => {
  let transactionActive = false;
  let closeWrites = 0;
  let closingRows = 0;
  const shiftState: Record<string, unknown> = {
    id: "shift-a",
    branchId: "branch-a",
    employeeId: "employee-a",
    status: "OPEN",
    openingBalance: new Prisma.Decimal(5_000),
    closingBalance: null,
  };
  const tx = {
    restaurantTenant: { findFirst: async () => ({ id: "tenant-a" }) },
    branch: { findFirst: async () => ({ id: "branch-a" }) },
    employee: { findFirst: async () => ({ id: "employee-a" }) },
    shift: {
      findUnique: async () => ({ ...shiftState }),
      findUniqueOrThrow: async () => ({ ...shiftState }),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        closeWrites += 1;
        Object.assign(shiftState, data);
        return { count: 1 };
      },
    },
    cashTransfer: { findFirst: async () => null },
    payment: { findMany: async () => [] },
    cashTransaction: {
      findMany: async () => [],
      create: async () => {
        closingRows += 1;
        return { id: "closing-row-a" };
      },
    },
    $queryRawUnsafe: async () => [],
  };
  const prisma = {
    restaurantTenant: tx.restaurantTenant,
    branch: {
      findFirst: tx.branch.findFirst,
      findUnique: async () => ({ tenantId: "tenant-a" }),
    },
    employee: tx.employee,
    shift: {
      findUnique: async () => ({ ...shiftState }),
      findFirst: async ({ where }: { where: { status?: string } }) =>
        where.status === "CLOSED" ? { ...shiftState } : null,
    },
    $transaction: async <T>(
      callback: (database: typeof tx) => Promise<T>,
    ) => {
      transactionActive = true;
      try {
        return await callback(tx);
      } finally {
        transactionActive = false;
      }
    },
  };
  const idempotency = createIdempotency(() => transactionActive, tx);
  const service = new ShiftsService(prisma as never, idempotency as never);
  const dto = { closingBalance: 5_000 };
  const context = {
    idempotencyKey: "shift-close-key-a",
    correlationId: "shift-close-request-a",
  };

  const first = await service.closeShift("shift-a", dto, cashier, context);
  const replay = await service.closeShift("shift-a", dto, cashier, context);

  assert.equal(first.status, "CLOSED");
  assert.deepEqual(replay, first);
  assert.equal(closeWrites, 1);
  assert.equal(closingRows, 1);

  await assert.rejects(
    service.closeShift("shift-a", { closingBalance: 6_000 }, cashier, context),
    /different request/,
  );
  assert.equal(closeWrites, 1);
  assert.equal(closingRows, 1);
});
