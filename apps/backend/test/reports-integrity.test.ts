import assert from "node:assert/strict";
import test from "node:test";
import {
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  PaymentStatus,
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
  assert.equal(order.source, OrderSource.POS);
  assert.ok(order.payments.some.paidAt.gte instanceof Date);
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
