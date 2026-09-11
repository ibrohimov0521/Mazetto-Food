import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { ShiftsService } from "../src/modules/shifts/shifts.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";

const user = (role = "CASHIER", employeeId = "receiver"): AuthenticatedUser => ({ id: "u-" + employeeId, employeeId, branchId: "b1", roles: [role], permissions: ["CASH_TRANSACTION_CREATE", "SHIFT_CLOSE"] });

function fixture(options: { self?: boolean; balance?: number; pending?: boolean } = {}) {
  const writes: { type: string; amount: Prisma.Decimal }[] = [];
  const shift = { id: "s1", branchId: "b1", employeeId: "sender", status: "OPEN", openingBalance: new Prisma.Decimal(0) };
  const receiverShift = { id: "s2", branchId: "b1", employeeId: "receiver", status: "OPEN", openingBalance: new Prisma.Decimal(0), employee: { status: "ACTIVE", firstName: "Receiver", lastName: "", user: { roles: [{ role: { code: "CASHIER" } }] } } };
  const transfer = { id: "t1", fromShiftId: "s1", toShiftId: "s2", branchId: "b1", status: "PENDING", amount: new Prisma.Decimal(40000), fromShift: { employeeId: options.self ? "receiver" : "sender", status: "OPEN" } };
  const calls: string[] = [];
  const tx = {
    $queryRawUnsafe: async () => { calls.push("lock"); return [{ id: "s1" }]; },
    employee: { findFirst: async () => ({ id: "receiver" }) },
    shift: {
      findFirst: async ({ where }: { where?: { employeeId?: string } } = {}) => where?.employeeId === "receiver" ? receiverShift : shift,
      findUnique: async ({ where }: { where: { id: string } }) => where.id === receiverShift.id ? receiverShift : shift,
      findUniqueOrThrow: async () => shift,
    },
    cashTransaction: {
      findMany: async () => { calls.push("balance"); return [{ type: "CASH_SALE", amount: new Prisma.Decimal(options.balance ?? 50000) }]; },
      create: async ({ data }: { data: { type: string; amount: Prisma.Decimal } }) => { writes.push(data); return data; },
    },
    cashTransfer: {
      findFirst: async () => options.pending ? transfer : null,
      findUnique: async () => transfer,
      findUniqueOrThrow: async () => transfer,
      create: async () => transfer,
      update: async ({ data }: { data: { status: string } }) => Object.assign(transfer, data),
    },
  };
  const prisma = { $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx) } as unknown as PrismaService;
  return { service: new ShiftsService(prisma), writes, transfer, calls };
}

test("a kitchen employee can submit cash; only one CASH_OUT is created", async () => {
  const f = fixture();
  await f.service.createCashTransfer({ amount: 40000, toShiftId: "s2" }, user("KITCHEN", "sender"));
  assert.equal(f.writes.length, 1);
  assert.ok(f.writes[0]);
  assert.equal(f.writes[0].type, "CASH_OUT");
  assert.equal(f.writes[0].amount.toString(), "40000");
  assert.ok(f.calls.indexOf("lock") < f.calls.indexOf("balance"));
});

test("handover cannot exceed available employee cash", async () => {
  const f = fixture({ balance: 30000 });
  await assert.rejects(() => f.service.createCashTransfer({ amount: 40000, toShiftId: "s2" }, user("COURIER", "sender")), /oshmasligi/);
  assert.equal(f.writes.length, 0);
});

test("accepting cash creates one incoming movement, never another sale", async () => {
  const f = fixture();
  await f.service.acceptCashTransfer("t1", user());
  assert.equal(f.transfer.status, "ACCEPTED");
  assert.deepEqual(f.writes.map(w => w.type), ["CASH_IN"]);
  await assert.rejects(() => f.service.acceptCashTransfer("t1", user()), /already processed/);
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
  await assert.rejects(() => f.service.acceptCashTransfer("t1", user()), /o'zingiz qabul/);
  assert.equal(f.writes.length, 0);
});

test("courier and kitchen roles cannot approve another employee's cash", async () => {
  for (const role of ["KITCHEN", "COURIER"]) {
    const f = fixture();
    await assert.rejects(() => f.service.acceptCashTransfer("t1", user(role)), /faqat kassir/);
    await assert.rejects(() => f.service.rejectCashTransfer("t1", undefined, user(role)), /faqat kassir/);
    assert.equal(f.writes.length, 0);
  }
});

test("pending outgoing cash blocks closing the shift", async () => {
  const f = fixture({ pending: true });
  await assert.rejects(() => f.service.closeShift("s1", { closingBalance: 10000 }, user("CASHIER", "sender")), /hali tasdiqlanmagan/);
  assert.equal(f.writes.length, 0);
});

test("rejected transfer restores sender cash exactly once", async () => {
  const f = fixture();
  await f.service.rejectCashTransfer("t1", "Summa mos emas", user());
  assert.equal(f.transfer.status, "REJECTED");
  assert.ok(f.writes[0]);
  assert.equal(f.writes[0].type, "CASH_IN");
  await assert.rejects(() => f.service.rejectCashTransfer("t1", undefined, user()), /already processed/);
  assert.equal(f.writes.length, 1);
});
