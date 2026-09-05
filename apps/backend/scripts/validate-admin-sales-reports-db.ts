import {
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentStatus,
  Prisma,
  ShiftStatus,
} from "@prisma/client";
import * as assert from "node:assert/strict";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { PrismaService } from "../src/prisma/prisma.service";
import { ReportPreset } from "../src/modules/reports/dto/report-query.dto";
import { ReportsService } from "../src/modules/reports/reports.service";

type Fixture = {
  runId: string;
  branchAId: string;
  branchBId: string;
  cashierAId: string;
  cashierBId: string;
  shiftAId: string;
  adminAll: AuthenticatedUser;
  adminBranchA: AuthenticatedUser;
  cashier: AuthenticatedUser;
  kitchen: AuthenticatedUser;
};

async function main(): Promise<void> {
  assertIsolatedDatabase();

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const reports = new ReportsService(prisma);
    const fixture = await createFixture(prisma);

    await proveTodayReport(reports, fixture);
    await provePresetRanges(reports, fixture);
    await proveSourceAndBranchFilters(reports, fixture);
    await proveBranchScope(reports, fixture);
    await proveCancelledAndPendingExclusion(reports, fixture);

    console.info("Admin sales reports DB-backed validation passed");
  } finally {
    await prisma.onModuleDestroy();
  }
}

async function createFixture(prisma: PrismaService): Promise<Fixture> {
  const runId = Date.now().toString();
  const branchA = await prisma.branch.create({
    data: { code: `REPORT_A_${runId}`, name: "Reports Sergeli", isActive: true },
  });
  const branchB = await prisma.branch.create({
    data: { code: `REPORT_B_${runId}`, name: "Reports Chilonzor", isActive: true },
  });
  const category = await prisma.category.create({
    data: { code: `REPORT_CAT_${runId}`, name: "Reports Lavash", isActive: true },
  });
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: `REPORT_LAVASH_${runId}`,
      name: "Reports Lavash",
      sellingPrice: new Prisma.Decimal(15000),
      isAvailable: true,
    },
  });
  const drink = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: `REPORT_DRINK_${runId}`,
      name: "Reports Drink",
      sellingPrice: new Prisma.Decimal(10000),
      isAvailable: true,
    },
  });
  const cashMethod =
    (await prisma.paymentMethod.findFirst({ where: { branchId: null, code: "CASH" } })) ??
    (await prisma.paymentMethod.create({ data: { code: "CASH", name: "Naqd", isActive: true } }));
  const cashierAUser = await prisma.user.create({
    data: { email: `reports-cashier-a-${runId}@example.test`, displayName: "Reports Cashier A" },
  });
  const cashierBUser = await prisma.user.create({
    data: { email: `reports-cashier-b-${runId}@example.test`, displayName: "Reports Cashier B" },
  });
  const cashierA = await prisma.employee.create({
    data: {
      userId: cashierAUser.id,
      branchId: branchA.id,
      employeeCode: `RCA_${runId}`,
      firstName: "Reports",
      lastName: "Cashier A",
    },
  });
  const cashierB = await prisma.employee.create({
    data: {
      userId: cashierBUser.id,
      branchId: branchB.id,
      employeeCode: `RCB_${runId}`,
      firstName: "Reports",
      lastName: "Cashier B",
    },
  });
  const shiftA = await prisma.shift.create({
    data: {
      branchId: branchA.id,
      employeeId: cashierA.id,
      shiftNumber: 1,
      status: ShiftStatus.CLOSED,
      openedAt: hoursAgo(3),
      closedAt: hoursAgo(1),
      openingBalance: new Prisma.Decimal(10000),
      closingBalance: new Prisma.Decimal(40000),
      expectedCash: new Prisma.Decimal(40000),
      cashDifference: new Prisma.Decimal(0),
      salesTotal: new Prisma.Decimal(30000),
      cashTotal: new Prisma.Decimal(30000),
      orderCount: 1,
    },
  });
  const shiftB = await prisma.shift.create({
    data: {
      branchId: branchB.id,
      employeeId: cashierB.id,
      shiftNumber: 1,
      status: ShiftStatus.OPEN,
      openedAt: hoursAgo(2),
      openingBalance: new Prisma.Decimal(5000),
    },
  });

  await createPaidOrder(prisma, {
    branchId: branchA.id,
    productId: drink.id,
    productName: drink.name,
    source: OrderSource.WEB,
    total: 10000,
    paymentMethodId: cashMethod.id,
    orderNumber: `WEB-${runId}`,
  });
  await createPaidOrder(prisma, {
    branchId: branchA.id,
    productId: product.id,
    productName: product.name,
    source: OrderSource.TELEGRAM,
    total: 15000,
    paymentMethodId: cashMethod.id,
    orderNumber: `TG-${runId}`,
  });
  await createPaidOrder(prisma, {
    branchId: branchA.id,
    productId: product.id,
    productName: product.name,
    source: OrderSource.POS,
    total: 30000,
    paymentMethodId: cashMethod.id,
    orderNumber: `POS-A-${runId}`,
    employeeId: cashierA.id,
    shiftId: shiftA.id,
    quantity: 2,
  });
  await createPaidOrder(prisma, {
    branchId: branchB.id,
    productId: drink.id,
    productName: drink.name,
    source: OrderSource.POS,
    total: 20000,
    paymentMethodId: cashMethod.id,
    orderNumber: `POS-B-${runId}`,
    employeeId: cashierB.id,
    shiftId: shiftB.id,
    paidAt: yesterday(),
    quantity: 2,
  });
  await createPaidOrder(prisma, {
    branchId: branchA.id,
    productId: product.id,
    productName: product.name,
    source: OrderSource.POS,
    total: 99999,
    paymentMethodId: cashMethod.id,
    orderNumber: `CANCEL-${runId}`,
    employeeId: cashierA.id,
    shiftId: shiftA.id,
    status: OrderStatus.CANCELLED,
  });
  await createPendingOrder(prisma, branchA.id, `PENDING-${runId}`);

  return {
    runId,
    branchAId: branchA.id,
    branchBId: branchB.id,
    cashierAId: cashierA.id,
    cashierBId: cashierB.id,
    shiftAId: shiftA.id,
    adminAll: user("admin-all", undefined, ["SUPER_ADMIN"], ["REPORT_SALES_VIEW"]),
    adminBranchA: user("admin-a", branchA.id, ["ADMIN"], ["REPORT_SALES_VIEW"]),
    cashier: user("cashier", branchA.id, ["CASHIER"], ["POS_USE"]),
    kitchen: user("kitchen", branchA.id, ["KITCHEN"], ["KITCHEN_VIEW"]),
  };
}

async function proveTodayReport(reports: ReportsService, fixture: Fixture): Promise<void> {
  const report = await reports.getSalesReport({ preset: ReportPreset.TODAY }, fixture.adminAll);

  assert.equal(money(report.totalSales), 55000);
  assert.equal(report.orderCount, 3);
  assert.equal(money(report.averageOrderValue), 18333);
  assert.equal(money(report.cashSales), 55000);
  assert.equal(report.cancelledOrders, 1);
  assert.equal(report.sourceBreakdown.find((row) => row.source === OrderSource.WEB)?.orderCount, 1);
  assert.equal(report.sourceBreakdown.find((row) => row.source === OrderSource.TELEGRAM)?.orderCount, 1);
  assert.equal(report.sourceBreakdown.find((row) => row.source === OrderSource.POS)?.orderCount, 1);
  assert.equal(report.branchBreakdown.length, 1);
  assert.equal(report.branchBreakdown[0]?.branch.id, fixture.branchAId);
  assert.equal(report.cashierBreakdown.length, 1);
  assert.equal(report.cashierBreakdown[0]?.cashier.id, fixture.cashierAId);
  assert.equal(report.shiftBreakdown.some((shift) => shift.id === fixture.shiftAId), true);
  assert.equal(report.topProducts[0]?.productName, "Reports Lavash");
  assert.equal(report.categorySales[0]?.category.name, "Reports Lavash");
  assert.equal(report.timeSeries.grain, "day");
  assert.equal(report.period.timezone, "Asia/Tashkent");
  assert.equal(report.refundHandling.supported, false);
}

async function provePresetRanges(reports: ReportsService, fixture: Fixture): Promise<void> {
  const yesterdayReport = await reports.getSalesReport({ preset: ReportPreset.YESTERDAY }, fixture.adminAll);
  const weekReport = await reports.getSalesReport({ preset: ReportPreset.LAST_7_DAYS }, fixture.adminAll);
  const monthReport = await reports.getSalesReport({ preset: ReportPreset.THIS_MONTH }, fixture.adminAll);
  const yearReport = await reports.getSalesReport({ preset: ReportPreset.YEAR, year: new Date().getFullYear() }, fixture.adminAll);
  const customReport = await reports.getSalesReport(
    { preset: ReportPreset.CUSTOM, from: dateInput(new Date()), to: dateInput(new Date()) },
    fixture.adminAll,
  );

  assert.equal(money(yesterdayReport.totalSales), 20000);
  assert.equal(money(weekReport.totalSales), 75000);
  assert.equal(money(monthReport.totalSales) >= 55000, true);
  assert.equal(money(yearReport.totalSales) >= 75000, true);
  assert.equal(yearReport.timeSeries.grain, "month");
  assert.equal(money(customReport.totalSales), 55000);
}

async function proveSourceAndBranchFilters(reports: ReportsService, fixture: Fixture): Promise<void> {
  const posReport = await reports.getSalesReport({ preset: ReportPreset.LAST_7_DAYS, source: OrderSource.POS }, fixture.adminAll);
  const branchBReport = await reports.getSalesReport({ preset: ReportPreset.LAST_7_DAYS, branchId: fixture.branchBId }, fixture.adminAll);

  assert.equal(money(posReport.totalSales), 50000);
  assert.equal(posReport.orderCount, 2);
  assert.equal(posReport.cashierBreakdown.length, 2);
  assert.equal(money(branchBReport.totalSales), 20000);
  assert.equal(branchBReport.branchBreakdown[0]?.branch.id, fixture.branchBId);
}

async function proveBranchScope(reports: ReportsService, fixture: Fixture): Promise<void> {
  const ownBranch = await reports.getSalesReport({ preset: ReportPreset.LAST_7_DAYS }, fixture.adminBranchA);

  assert.equal(money(ownBranch.totalSales), 55000);
  await assert.rejects(
    () => reports.getSalesReport({ preset: ReportPreset.LAST_7_DAYS, branchId: fixture.branchBId }, fixture.adminBranchA),
    /another branch/i,
  );
}

async function proveCancelledAndPendingExclusion(reports: ReportsService, fixture: Fixture): Promise<void> {
  const report = await reports.getSalesReport({ preset: ReportPreset.TODAY }, fixture.adminAll);

  assert.equal(money(report.totalSales), 55000);
  assert.equal(report.cancelledOrders, 1);
  assert.equal(report.salesRule.excludedOrderStatuses.includes(OrderStatus.CANCELLED), true);
  assert.equal(report.salesRule.paymentStatuses.includes(PaymentStatus.PAID), true);
  assert.equal(report.salesRule.paymentStatuses.includes(PaymentStatus.SUCCESS), true);
}

async function createPaidOrder(
  prisma: PrismaService,
  input: {
    branchId: string;
    productId: string;
    productName: string;
    source: OrderSource;
    total: number;
    paymentMethodId: string;
    orderNumber: string;
    employeeId?: string;
    shiftId?: string;
    paidAt?: Date;
    quantity?: number;
    status?: OrderStatus;
  },
): Promise<void> {
  const status = input.status ?? OrderStatus.CONFIRMED;
  const order = await prisma.order.create({
    data: {
      branchId: input.branchId,
      shiftId: input.shiftId ?? null,
      orderNumber: input.orderNumber,
      source: input.source,
      type: input.source === OrderSource.WEB ? OrderType.DELIVERY : OrderType.TAKEAWAY,
      status,
      paymentStatus: status === OrderStatus.CANCELLED ? PaymentStatus.PAID : PaymentStatus.PAID,
      total: new Prisma.Decimal(input.total),
      subtotal: new Prisma.Decimal(input.total),
      createdById: input.employeeId ?? null,
      acceptedById: input.employeeId ?? null,
      createdAt: input.paidAt ?? new Date(),
    },
  });
  const quantity = new Prisma.Decimal(input.quantity ?? 1);

  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      productId: input.productId,
      createdById: input.employeeId ?? null,
      productName: input.productName,
      quantity,
      unitPrice: new Prisma.Decimal(input.total).div(quantity),
      totalPrice: new Prisma.Decimal(input.total),
    },
  });
  await prisma.payment.create({
    data: {
      orderId: order.id,
      paymentMethodId: input.paymentMethodId,
      acceptedById: input.employeeId ?? null,
      status: PaymentStatus.PAID,
      amount: new Prisma.Decimal(input.total),
      methodCode: "CASH",
      paidAt: input.paidAt ?? new Date(),
    },
  });
}

async function createPendingOrder(prisma: PrismaService, branchId: string, orderNumber: string): Promise<void> {
  await prisma.order.create({
    data: {
      branchId,
      orderNumber,
      source: OrderSource.WEB,
      type: OrderType.DELIVERY,
      status: OrderStatus.NEW,
      paymentStatus: PaymentStatus.PENDING,
      total: new Prisma.Decimal(45000),
      subtotal: new Prisma.Decimal(45000),
    },
  });
}

function user(id: string, branchId: string | undefined, roles: string[], permissions: string[]): AuthenticatedUser {
  return {
    id,
    ...(branchId ? { branchId, employeeId: `${id}-employee` } : {}),
    roles,
    permissions,
  };
}

function money(value: unknown): number {
  return Math.round(Number(value ?? 0));
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function yesterday(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function dateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function assertIsolatedDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL ?? "";

  if (!/localhost|127\.0\.0\.1/.test(databaseUrl) || !/mazetto_reports_isolated/i.test(databaseUrl)) {
    throw new Error("Refusing to run Admin Sales Reports DB validation outside an isolated localhost database");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
