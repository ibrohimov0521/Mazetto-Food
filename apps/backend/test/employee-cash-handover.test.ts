import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { ShiftsService } from "../src/modules/shifts/shifts.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";

const user = (
  role = "CASHIER",
  employeeId = "receiver",
): AuthenticatedUser => ({
  id: "u-" + employeeId,
  employeeId,
  branchId: "b1",
  roles: [role],
  permissions: ["CASH_TRANSACTION_CREATE", "SHIFT_CLOSE"],
});

function fixture(
  options: {
    self?: boolean;
    balance?: number;
    pending?: boolean;
    pendingIncoming?: boolean;
    receiverClosesBeforeCreate?: boolean;
  } = {},
) {
  const writes: { type: string; amount: Prisma.Decimal }[] = [];
  const auditEntries: Array<Record<string, unknown>> = [];
  const lockedShiftIds: string[] = [];
  let shiftCloseWrites = 0;
  const allocationWrites: Array<{
    amount: Prisma.Decimal;
    orderId: string | null;
    paymentId: string | null;
  }> = [];
  const shift = {
    id: "s1",
    branchId: "b1",
    employeeId: "sender",
    status: "OPEN",
    openingBalance: new Prisma.Decimal(0),
  };
  const receiverShift = {
    id: "s2",
    branchId: "b1",
    employeeId: "receiver",
    status: "OPEN",
    openingBalance: new Prisma.Decimal(0),
    employee: {
      status: "ACTIVE",
      firstName: "Receiver",
      lastName: "",
      user: { roles: [{ role: { code: "CASHIER" } }] },
    },
  };
  const transfer = {
    id: "t1",
    fromShiftId: "s1",
    toShiftId: "s2",
    branchId: "b1",
    status: "PENDING",
    amount: new Prisma.Decimal(40000),
    fromShift: {
      employeeId: options.self ? "receiver" : "sender",
      status: "OPEN",
    },
  };
  const calls: string[] = [];
  const tx = {
    $queryRawUnsafe: async (_query: string, shiftId: string) => {
      calls.push("lock");
      lockedShiftIds.push(shiftId);
      if (options.receiverClosesBeforeCreate && shiftId === receiverShift.id) {
        receiverShift.status = "CLOSED";
      }
      return [{ id: shiftId }];
    },
    employee: { findFirst: async () => ({ id: "receiver" }) },
    branch: {
      findUnique: async () => ({ tenantId: "tenant-a" }),
      findFirst: async () => ({ id: "b1" }),
    },
    shift: {
      findFirst: async ({ where }: { where?: { employeeId?: string } } = {}) =>
        where?.employeeId === "receiver" ? receiverShift : shift,
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === receiverShift.id ? receiverShift : shift,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) =>
        where.id === receiverShift.id ? receiverShift : shift,
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        shiftCloseWrites += 1;
        const target = where.id === receiverShift.id ? receiverShift : shift;
        Object.assign(target, data);
        return { count: 1 };
      },
    },
    cashTransaction: {
      findMany: async ({ where }: { where?: { shiftId?: string } } = {}) => {
        calls.push("balance");
        if (where?.shiftId === receiverShift.id) return [];
        return [
          {
            id: "cash-sale-1",
            type: "SALE",
            amount: new Prisma.Decimal(options.balance ?? 50000),
            orderId: "order-1",
            paymentId: "payment-1",
            cashTransferId: null,
            reason: "Cash sale",
            order: { orderNumber: "101", displayOrderNumber: "101" },
            cashTransfer: null,
          },
        ];
      },
      create: async ({
        data,
      }: {
        data: { type: string; amount: Prisma.Decimal };
      }) => {
        writes.push(data);
        return data;
      },
    },
    cashTransferAllocation: {
      createMany: async ({ data }: { data: typeof allocationWrites }) => {
        allocationWrites.push(...data);
        return { count: data.length };
      },
    },
    cashTransfer: {
      findFirst: async ({
        where,
      }: {
        where?: { branchId?: string; fromShiftId?: string; toShiftId?: string };
      } = {}) => {
        if (where?.fromShiftId === shift.id) return options.pending ? transfer : null;
        if (where?.toShiftId === receiverShift.id) {
          return options.pendingIncoming ? transfer : null;
        }
        return where?.branchId === "b1" ? transfer : null;
      },
      findUnique: async () => transfer,
      findUniqueOrThrow: async () => transfer,
      create: async () => transfer,
      update: async ({ data }: { data: { status: string } }) =>
        Object.assign(transfer, data),
      updateMany: async ({
        where,
        data,
      }: {
        where: { fromShiftId?: string; toShiftId?: string };
        data: Record<string, unknown>;
      }) => {
        if (where.fromShiftId === receiverShift.id) return { count: 0 };
        if (where.toShiftId === receiverShift.id && options.pendingIncoming) {
          Object.assign(transfer, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    payment: { findMany: async () => [] },
    order: { count: async () => 0 },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        auditEntries.push(data);
        return data;
      },
    },
  };
  const prisma = {
    branch: {
      findUnique: async () => ({ tenantId: "tenant-a" }),
      findFirst: async () => ({ id: "b1" }),
    },
    $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
  } as unknown as PrismaService;
  return {
    service: new ShiftsService(prisma),
    writes,
    allocationWrites,
    transfer,
    calls,
    auditEntries,
    lockedShiftIds,
    get shiftCloseWrites() {
      return shiftCloseWrites;
    },
  };
}

test("a kitchen employee can submit cash; only one CASH_OUT is created", async () => {
  const f = fixture();
  await f.service.createCashTransfer(
    { amount: 40000, toShiftId: "s2" },
    user("KITCHEN", "sender"),
  );
  assert.equal(f.writes.length, 1);
  assert.ok(f.writes[0]);
  assert.equal(f.writes[0].type, "CASH_OUT");
  assert.equal(f.writes[0].amount.toString(), "40000");
  assert.equal(f.allocationWrites.length, 1);
  assert.equal(f.allocationWrites[0]?.amount.toString(), "40000");
  assert.equal(f.allocationWrites[0]?.orderId, "order-1");
  assert.equal(f.allocationWrites[0]?.paymentId, "payment-1");
  assert.ok(f.calls.indexOf("lock") < f.calls.indexOf("balance"));
  assert.deepEqual(f.lockedShiftIds, ["s1", "s2"]);
});

test("cash transfer is refused if the selected cashier shift closes before both shifts lock", async () => {
  const f = fixture({ receiverClosesBeforeCreate: true });

  await assert.rejects(
    () => f.service.createCashTransfer(
      { amount: 40000, toShiftId: "s2" },
      user("KITCHEN", "sender"),
    ),
    /kassir smenasi ochiq emas/,
  );
  assert.equal(f.writes.length, 0);
  assert.deepEqual(f.lockedShiftIds, ["s1", "s2"]);
});

test("handover cannot exceed available employee cash", async () => {
  const f = fixture({ balance: 30000 });
  await assert.rejects(
    () =>
      f.service.createCashTransfer(
        { amount: 40000, toShiftId: "s2" },
        user("COURIER", "sender"),
      ),
    /oshmasligi/,
  );
  assert.equal(f.writes.length, 0);
});

test("accepting cash creates one incoming movement, never another sale", async () => {
  const f = fixture();
  await f.service.acceptCashTransfer("t1", user());
  assert.equal(f.transfer.status, "ACCEPTED");
  assert.deepEqual(
    f.writes.map((w) => w.type),
    ["CASH_IN"],
  );
  await assert.rejects(
    () => f.service.acceptCashTransfer("t1", user()),
    /already processed/,
  );
  assert.equal(f.writes.length, 1);
});

test("a different cashier cannot approve a handover assigned to another shift", async () => {
  const f = fixture();
  await assert.rejects(
    () => f.service.acceptCashTransfer("t1", user("CASHIER", "other")),
    /boshqa kassir smenasiga/,
  );
  assert.equal(f.writes.length, 0);
});

test("employee cannot approve their own handover", async () => {
  const f = fixture({ self: true });
  await assert.rejects(
    () => f.service.acceptCashTransfer("t1", user()),
    /o'zingiz qabul/,
  );
  assert.equal(f.writes.length, 0);
});

test("courier and kitchen roles cannot approve another employee's cash", async () => {
  for (const role of ["KITCHEN", "COURIER"]) {
    const f = fixture();
    await assert.rejects(
      () => f.service.acceptCashTransfer("t1", user(role)),
      /faqat kassir/,
    );
    await assert.rejects(
      () => f.service.rejectCashTransfer("t1", undefined, user(role)),
      /faqat kassir/,
    );
    assert.equal(f.writes.length, 0);
  }
});

test("pending outgoing cash blocks closing the shift", async () => {
  const f = fixture({ pending: true });
  await assert.rejects(
    () =>
      f.service.closeShift(
        "s1",
        { closingBalance: 10000 },
        user("CASHIER", "sender"),
      ),
    /hali tasdiqlanmagan/,
  );
  assert.equal(f.writes.length, 0);
});

test("pending incoming cash blocks the cashier shift from closing", async () => {
  const f = fixture({ pendingIncoming: true });
  await assert.rejects(
    () => f.service.closeShift(
      "s2",
      { closingBalance: 0 },
      user("CASHIER", "receiver"),
    ),
    /kelgan pul topshiruvi hali hal qilinmagan/,
  );
  assert.equal(f.shiftCloseWrites, 0);
});

test("force-closing a recipient shift unassigns pending cash without disputing it", async () => {
  const f = fixture({ pendingIncoming: true });
  const closed = await f.service.forceCloseShift(
    "s2",
    { reason: "Kassir smenasi yakunlandi" },
    user("BRANCH_MANAGER", "receiver"),
  );

  assert.equal(closed.status, "CLOSED");
  assert.equal(f.transfer.status, "PENDING");
  assert.equal(f.transfer.toShiftId, null);
  assert.equal(f.shiftCloseWrites, 1);
  assert.equal(
    f.auditEntries[0]?.metadata &&
      (f.auditEntries[0].metadata as Record<string, unknown>)
        .pendingIncomingTransfersUnassigned,
    1,
  );
});

test("rejected transfer restores sender cash exactly once", async () => {
  const f = fixture();
  await f.service.rejectCashTransfer("t1", "Summa mos emas", user());
  assert.equal(f.transfer.status, "REJECTED");
  assert.ok(f.writes[0]);
  assert.equal(f.writes[0].type, "CASH_IN");
  await assert.rejects(
    () => f.service.rejectCashTransfer("t1", undefined, user()),
    /already processed/,
  );
  assert.equal(f.writes.length, 1);
});
