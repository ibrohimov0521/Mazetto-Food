import assert from "node:assert/strict";
import test from "node:test";
import {
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { ReportsService } from "../src/modules/reports/reports.service";
import {
  ReportPreset,
} from "../src/modules/reports/dto/report-query.dto";
import { resolveReportRange } from "../src/modules/reports/report-range";

const globalUser = {
  id: "owner",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: ["*"],
};

test("mahsulot hisoboti faqat muvaffaqiyatli to'langan buyurtmalarni oladi", async () => {
  let where: Record<string, unknown> | undefined;
  const service = new ReportsService({
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
    orderItem: {
      groupBy: async (args: { where: Record<string, unknown> }) => {
        where = args.where;
        return [];
      },
    },
  } as never);

  await service.getProductReport(
    { preset: ReportPreset.TODAY, source: OrderSource.POS, limit: 20 },
    globalUser,
  );

  assert.equal(where?.status, OrderItemStatus.ACTIVE);
  assert.deepEqual((where?.order as Record<string, unknown>).branch, { tenantId: "tenant-a" });
  const order = where?.order as {
    status: { in: OrderStatus[] };
    paymentStatus: { in: PaymentStatus[] };
    source: string;
    payments: {
      some: {
        status: { in: PaymentStatus[] };
        paidAt: { gte: Date; lte: Date };
      };
    };
  };
  assert.deepEqual(order.status.in, [
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.SERVED,
    OrderStatus.COMPLETED,
  ]);
  assert.deepEqual(order.paymentStatus.in, [
    PaymentStatus.PAID,
    PaymentStatus.SUCCESS,
  ]);
  assert.deepEqual(order.payments.some.status.in, [
    PaymentStatus.PAID,
    PaymentStatus.SUCCESS,
    PaymentStatus.PARTIALLY_REFUNDED,
  ]);
  assert.equal(order.source, OrderSource.POS);
  assert.ok(order.payments.some.paidAt.gte instanceof Date);
});

test("qisman qaytarilgan naqd to'lovlar savdo tushumida qolib, qaytim alohida ko'rsatiladi", async () => {
  const now = new Date();
  const salesAmount = new Prisma.Decimal(74_000);
  const refundAmount = new Prisma.Decimal(24_000);
  const statuses: Record<string, PaymentStatus[]> = {};
  const partialPayment = {
    id: "payment-partial",
    amount: salesAmount,
    paidAt: now,
    methodCode: "CASH",
    acceptedById: "cashier-a",
    method: { id: "cash", code: "CASH", name: "Naqd" },
    order: {
      id: "order-a",
      orderNumber: "101",
      displayOrderNumber: "M-101",
      source: OrderSource.POS,
      status: OrderStatus.COMPLETED,
      total: new Prisma.Decimal(50_000),
      createdAt: now,
      branch: { id: "branch-a", code: "MAIN", name: "Asosiy" },
      createdBy: {
        id: "cashier-a",
        employeeCode: "C-1",
        firstName: "Ali",
        lastName: "Valiyev",
      },
      shiftId: null,
    },
  };
  const service = new ReportsService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    payment: {
      findMany: async ({ where }: { where: { status: { in: PaymentStatus[] } } }) => {
        statuses.sales = where.status.in;
        return [partialPayment];
      },
      groupBy: async ({ where }: { where: { status: { in: PaymentStatus[] } } }) => {
        statuses.employee = where.status.in;
        return [];
      },
    },
    paymentRefund: { findMany: async () => [{ amount: refundAmount }] },
    order: {
      count: async () => 0,
      groupBy: async () => [],
    },
    orderItem: {
      findMany: async () => [],
      groupBy: async ({ where }: { where: { order: { payments: { some: { status: { in: PaymentStatus[] } } } } } }) => {
        statuses.product = where.order.payments.some.status.in;
        return [];
      },
    },
    shift: { findMany: async () => [] },
    employee: { findMany: async () => [] },
  } as never);

  const query = { preset: ReportPreset.TODAY };
  const report = await service.getSalesReport(query, globalUser);

  assert.equal(report.totalSales.toNumber(), 74_000);
  assert.equal(report.cashSales.toNumber(), 74_000);
  assert.equal(report.refundHandling.amount.toNumber(), 24_000);
  assert.equal(report.paymentBreakdown.at(0)?.amount.toNumber(), 74_000);
  assert.deepEqual(report.salesRule.paymentStatuses, [
    PaymentStatus.PAID,
    PaymentStatus.SUCCESS,
    PaymentStatus.PARTIALLY_REFUNDED,
  ]);

  await service.getProductReport({ ...query, limit: 20 }, globalUser);
  await service.getEmployeeReport(query, globalUser);
  for (const paymentStatuses of Object.values(statuses)) {
    assert.deepEqual(paymentStatuses, [
      PaymentStatus.PAID,
      PaymentStatus.SUCCESS,
      PaymentStatus.PARTIALLY_REFUNDED,
    ]);
  }
});

test("teskari maxsus sana oralig'i rad etiladi", () => {
  assert.throws(
    () =>
      resolveReportRange({
        preset: ReportPreset.CUSTOM,
        from: "2026-09-14",
        to: "2026-09-01",
      }),
    /boshlanish sanasi/,
  );
});

test("366 kundan uzun maxsus hisobot rad etiladi", () => {
  assert.throws(
    () =>
      resolveReportRange({
        preset: ReportPreset.CUSTOM,
        from: "2024-01-01",
        to: "2025-01-02",
      }),
    /366 kundan/,
  );
});
