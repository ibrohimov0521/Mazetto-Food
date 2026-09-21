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

function fixture(methodCode = "CASH") {
  const calls: string[] = [];
  const amount = new Prisma.Decimal(74000);
  const payment = {
    id: "payment-1",
    orderId: "order-1",
    amount,
    status: PaymentStatus.SUCCESS,
    refund: null,
    method: { id: "method-1", code: methodCode, name: methodCode },
    order: {
      id: "order-1",
      branchId: "branch-1",
      orderNumber: "109",
      branch: { id: "branch-1", name: "Sergeli" },
      items: [],
      payments: [],
    },
  };
  const tx = {
    $executeRaw: async () => {
      calls.push("lock");
      return 1;
    },
    paymentRefund: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push("refund");
        return { id: "refund-1", ...data };
      },
    },
    payment: {
      findUnique: async () => payment,
      update: async ({ data }: { data: { status: PaymentStatus } }) => {
        calls.push(`payment:${data.status}`);
        return payment;
      },
      aggregate: async () => ({ _sum: { amount: null } }),
    },
    shift: {
      findFirst: async () => ({ id: "shift-1", employeeId: "employee-1" }),
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
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
      callback(tx),
  } as unknown as PrismaService;
  return { calls, service: new PaymentsService(prisma) };
}

test("CASH refund writes one immutable reversal and queues its receipt", async () => {
  const { calls, service } = fixture();
  const result = await service.refundPayment(
    "payment-1",
    { shiftId: "shift-1", reason: "Mijoz qaytardi", idempotencyKey: "refund-key-1" },
    actor,
  );

  assert.equal(result.id, "refund-1");
  assert.deepEqual(calls, [
    "lock",
    "refund",
    "payment:REFUNDED",
    "revenue:-74000.00",
    "cash:REFUND",
    "order:REFUNDED",
    "receipt:REFUND:payment-1",
    "print-job",
    "audit",
  ]);
});

test("provider payment refund stays disabled until provider reconciliation exists", async () => {
  const { service } = fixture("CLICK");
  await assert.rejects(
    service.refundPayment(
      "payment-1",
      { shiftId: "shift-1", reason: "Mijoz qaytardi", idempotencyKey: "refund-key-2" },
      actor,
    ),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === "CLICK refund provider is not enabled",
  );
});
