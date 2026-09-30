import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { ShiftsService } from "../src/modules/shifts/shifts.service";

const cashier: AuthenticatedUser = {
  id: "receiver-user",
  employeeId: "receiver-employee",
  branchId: "branch-a",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  isGlobalScope: false,
  roles: ["CASHIER"],
  permissions: ["CASH_TRANSACTION_CREATE"],
};

function createFixture() {
  let transactionActive = false;
  let ledgerWrites = 0;
  let record:
    | {
        id: string;
        requestHash: string;
        resourceId: string | undefined;
        resourceType: string | undefined;
        status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
      }
    | undefined;
  let finalTransfer: Record<string, unknown> = {
    id: "transfer-a",
    branchId: "branch-a",
    fromShiftId: "sender-shift",
    toShiftId: "receiver-shift",
    status: "PENDING",
    rejectedAt: null,
    acceptedById: null,
    amount: 2_000,
    fromShift: { employeeId: "sender-employee" },
    toShift: { employeeId: "receiver-employee" },
    allocations: [],
  };
  const readTransfer = () => ({ ...finalTransfer });
  const tx = {
    restaurantTenant: { findFirst: async () => ({ id: "tenant-a" }) },
    branch: { findFirst: async () => ({ id: "branch-a" }) },
    employee: { findFirst: async () => ({ id: "receiver-employee" }) },
    shift: {
      findFirst: async () => ({
        id: "receiver-shift",
        branchId: "branch-a",
        employeeId: "receiver-employee",
        status: "OPEN",
      }),
      findUnique: async () => ({ id: "receiver-shift", status: "OPEN" }),
      findUniqueOrThrow: async () => ({
        id: "sender-shift",
        status: "OPEN",
        branchId: "branch-a",
        employeeId: "sender-employee",
      }),
    },
    $queryRawUnsafe: async () => [{ id: "locked" }],
    cashTransaction: {
      create: async () => {
        ledgerWrites += 1;
        return { id: `ledger-${ledgerWrites}` };
      },
    },
    cashTransfer: {
      findFirst: async () => readTransfer(),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        finalTransfer = { ...finalTransfer, ...data };
        return readTransfer();
      },
    },
  };
  const prisma = {
    restaurantTenant: tx.restaurantTenant,
    branch: {
      findFirst: tx.branch.findFirst,
      findUnique: async () => ({ tenantId: "tenant-a" }),
    },
    cashTransfer: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        assert.equal(where.id, "transfer-a");
        if (where.acceptedById) {
          assert.equal(where.acceptedById, cashier.id);
          assert.deepEqual(where.toShift, {
            is: { employeeId: cashier.employeeId },
          });
        }
        return readTransfer();
      },
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
    start: async (input: { scope: string; requestHash: string }) => {
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
      assert.ok(input.scope.includes(cashier.id));
      record = {
        id: "resolution-idem-a",
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
      database: typeof tx,
    ) => {
      assert.equal(transactionActive, true);
      assert.equal(database, tx);
      assert.equal(id, "resolution-idem-a");
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
  const service = new ShiftsService(prisma as never, idempotency as never);
  return {
    service,
    get ledgerWrites() {
      return ledgerWrites;
    },
    get transactionActive() {
      return transactionActive;
    },
  };
}

test("cash transfer acceptance replay creates only one receiver ledger row", async () => {
  const fixture = createFixture();
  const context = {
    idempotencyKey: "accept-transfer-key-a",
    correlationId: "accept-transfer-request-a",
  };

  const first = await fixture.service.acceptCashTransfer(
    "transfer-a",
    cashier,
    context,
  );
  const replay = await fixture.service.acceptCashTransfer(
    "transfer-a",
    cashier,
    context,
  );

  assert.equal(first.status, "ACCEPTED");
  assert.deepEqual(replay, first);
  assert.equal(fixture.ledgerWrites, 1);
  assert.equal(fixture.transactionActive, false);
});

test("cash transfer rejection replay creates only one source refund ledger row", async () => {
  const fixture = createFixture();
  const context = {
    idempotencyKey: "reject-transfer-key-a",
    correlationId: "reject-transfer-request-a",
  };

  const first = await fixture.service.rejectCashTransfer(
    "transfer-a",
    "Summani qayta sanash kerak",
    cashier,
    context,
  );
  const replay = await fixture.service.rejectCashTransfer(
    "transfer-a",
    "Summani qayta sanash kerak",
    cashier,
    context,
  );

  assert.equal(first.status, "REJECTED");
  assert.deepEqual(replay, first);
  assert.equal(fixture.ledgerWrites, 1);
  assert.equal(fixture.transactionActive, false);

  await assert.rejects(
    fixture.service.rejectCashTransfer(
      "transfer-a",
      "Boshqa sabab",
      cashier,
      context,
    ),
    /different request/,
  );
  assert.equal(fixture.ledgerWrites, 1);
});
