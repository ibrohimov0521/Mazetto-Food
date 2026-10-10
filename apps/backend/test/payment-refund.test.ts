import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { PaymentStatus, Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { PaymentsService } from "../src/modules/payments/payments.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const actor: AuthenticatedUser = {
  id: "user-1",
  employeeId: "employee-1",
  branchId: "branch-1",
  roles: ["BRANCH_MANAGER"],
  permissions: ["PAYMENT_REFUND"],
};

function fixture(methodCode = "CASH", orderTotal = 74000) {
  const calls: string[] = [];
  const refunds: {
    id: string;
    amount: Prisma.Decimal;
    reason: string;
    createdAt: Date;
    paymentId: string;
    idempotencyKey: string;
  }[] = [];
  const amount = new Prisma.Decimal(74000);
  const payment = {
    id: "payment-1",
    orderId: "order-1",
    amount,
    status: PaymentStatus.SUCCESS,
    refunds,
    method: { id: "method-1", code: methodCode, name: methodCode },
    order: {
      id: "order-1",
      branchId: "branch-1",
      orderNumber: "109",
      total: new Prisma.Decimal(orderTotal),
      branch: { id: "branch-1", name: "Sergeli" },
      items: [],
      payments: [],
    },
  };
  const tx = {
    $queryRaw: async () => {
      calls.push("lock");
      return 1;
    },
    paymentRefund: {
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
        refunds.find(
          (refund) => refund.idempotencyKey === where.idempotencyKey,
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push("refund");
        const refund = {
          id: `refund-${refunds.length + 1}`,
          amount: data.amount as Prisma.Decimal,
          reason: String(data.reason),
          createdAt: new Date(),
          paymentId: String(data.paymentId),
          idempotencyKey: String(data.idempotencyKey),
        };
        refunds.push(refund);
        return refund;
      },
    },
    payment: {
      findFirst: async () => payment,
      findUnique: async () => payment,
      update: async ({
        data,
      }: {
        data: { status: PaymentStatus; refundedAt?: Date | null };
      }) => {
        Object.assign(payment, data);
        calls.push(`payment:${data.status}`);
        return payment;
      },
      findMany: async () => [payment],
    },
    shift: {
      findFirst: async () => ({ id: "shift-1", employeeId: "employee-1" }),
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => ({ id: "shift-1", employeeId: "employee-1" }),
    },
    revenueRecord: {
      create: async ({ data }: { data: { amount: Prisma.Decimal } }) => {
        calls.push(`revenue:${data.amount.toFixed(2)}`);
        return data;
      },
    },
    cashTransaction: {
      create: async () => {
        calls.push("cash:REFUND");
        return {};
      },
    },
    order: {
      update: async ({ data }: { data: { paymentStatus: PaymentStatus } }) => {
        calls.push(`order:${data.paymentStatus}`);
        return {};
      },
    },
    receipt: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push(`receipt:${String(data.documentType)}`);
        return {
          id: "receipt-1",
          branchId: "branch-1",
          content: data.content,
        };
      },
    },
    printer: { findMany: async () => [] },
    printJob: {
      create: async () => {
        calls.push("print-job");
        return {};
      },
      createMany: async () => ({ count: 0 }),
    },
    auditLog: {
      create: async () => {
        calls.push("audit");
        return {};
      },
    },
  };
  const prisma = {
    branch: {
      findUnique: async () => ({ tenantId: "tenant-a" }),
    },
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
      callback(tx),
  } as unknown as PrismaService;
  return { calls, service: new PaymentsService(prisma) };
}

test("CASH refund writes one immutable reversal and queues its receipt", async () => {
  const { calls, service } = fixture();
  const result = await service.refundPayment(
    "payment-1",
    {
      shiftId: "shift-1",
      reason: "Mijoz qaytardi",
      idempotencyKey: "refund-key-1",
    },
    actor,
  );

  assert.equal(result.id, "refund-1");
  assert.deepEqual(calls, [
    "lock",
    "lock",
    "refund",
    "payment:REFUNDED",
    "revenue:-74000.00",
    "cash:REFUND",
    "receipt:REFUND:refund-1",
    "print-job",
    "audit",
    "order:REFUNDED",
  ]);
});

test("partial cash refunds preserve a refundable balance and then close it exactly", async () => {
  const { calls, service } = fixture();
  await service.refundPayment(
    "payment-1",
    {
      shiftId: "shift-1",
      amount: 24000,
      reason: "Bir mahsulot qaytdi",
      idempotencyKey: "refund-part-1",
    },
    actor,
  );
  await service.refundPayment(
    "payment-1",
    {
      shiftId: "shift-1",
      reason: "Qolgan summa",
      idempotencyKey: "refund-part-2",
    },
    actor,
  );

  assert.ok(calls.includes("payment:PARTIALLY_REFUNDED"));
  assert.ok(calls.includes("order:PENDING"));
  assert.equal(calls.filter((call) => call === "refund").length, 2);
  assert.ok(calls.includes("receipt:REFUND:refund-1"));
  assert.ok(calls.includes("receipt:REFUND:refund-2"));
  assert.equal(calls.at(-1), "order:REFUNDED");
});

test("partial cash refund keeps a fully covered order paid", async () => {
  const { calls, service } = fixture("CASH", 50000);
  await service.refundPayment(
    "payment-1",
    {
      shiftId: "shift-1",
      amount: 24000,
      reason: "Ortiqcha tushum qaytarildi",
      idempotencyKey: "refund-covered-order",
    },
    actor,
  );

  assert.equal(calls.at(-1), "order:PAID");
});

test("provider payment refund stays disabled until provider reconciliation exists", async () => {
  const { service } = fixture("CLICK");
  await assert.rejects(
    service.refundPayment(
      "payment-1",
      {
        shiftId: "shift-1",
        reason: "Mijoz qaytardi",
        idempotencyKey: "refund-key-2",
      },
      actor,
    ),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === "CLICK refund provider is not enabled",
  );
});
