import {
  CashTransactionType,
  EmployeeStatus,
  OrderSource,
  PaymentStatus,
  Prisma,
  ShiftStatus,
} from "@prisma/client";
import * as assert from "node:assert/strict";
import { CashRegisterService } from "../src/modules/cash-register/cash-register.service";
import { InventoryService } from "../src/modules/inventory/inventory.service";
import { KitchenService } from "../src/modules/kitchen/kitchen.service";
import { OrdersService } from "../src/modules/orders/orders.service";
import type { CreatePosCheckoutDto } from "../src/modules/orders/dto/pos-checkout.dto";
import { ShiftsService } from "../src/modules/shifts/shifts.service";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { PrismaService } from "../src/prisma/prisma.service";

type Fixture = {
  runId: string;
  branchId: string;
  otherBranchId: string;
  cashier: AuthenticatedUser;
  otherCashier: AuthenticatedUser;
  productId: string;
};

async function main(): Promise<void> {
  assertIsolatedDatabase();

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const shiftsService = new ShiftsService(prisma);
    const cashRegisterService = new CashRegisterService(prisma, shiftsService);
    const kitchenService = new KitchenService(prisma, {
      emitOrderCreated: () => undefined,
      emitOrderConfirmed: () => undefined,
      emitOrderSentToKitchen: () => undefined,
      emitOrderStatusChanged: () => undefined,
    } as never);
    const ordersService = new OrdersService(prisma, new InventoryService(prisma), kitchenService);
    const fixture = await createFixture(prisma);

    await assert.rejects(
      () => ordersService.createPosCheckout(posDto(fixture, "without-shift", 1, 12000), fixture.cashier),
      /Open cashier shift/i,
    );

    const opened = await cashRegisterService.openShift({ openingBalance: 100000 }, fixture.cashier);
    assert.equal(opened.branchId, fixture.branchId);
    assert.equal(opened.employeeId, fixture.cashier.employeeId);
    assert.equal(opened.status, ShiftStatus.OPEN);

    await assert.rejects(
      () => cashRegisterService.openShift({ openingBalance: 0 }, fixture.cashier),
      /already has an open shift/i,
    );

    const sale = await ordersService.createPosCheckout(posDto(fixture, "sale", 2, 30000), fixture.cashier);
    assert.equal(sale.order.source, OrderSource.POS);
    assert.equal(sale.order.paymentStatus, PaymentStatus.PAID);
    assert.equal(sale.order.total.toFixed(0), "24000");
    const persistedSale = await prisma.order.findUniqueOrThrow({ where: { id: sale.order.id } });
    assert.equal(persistedSale.shiftId, opened.id);

    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: sale.order.id } });
    assert.equal(
      await prisma.revenueRecord.count({ where: { orderId: sale.order.id, shiftId: opened.id } }),
      1,
    );

    const retry = await ordersService.createPosCheckout(posDto(fixture, "sale", 2, 30000), fixture.cashier);
    assert.equal(retry.order.id, sale.order.id);
    assert.equal(await prisma.revenueRecord.count({ where: { orderId: sale.order.id, shiftId: opened.id } }), 1);
    assert.equal(await prisma.cashTransaction.count({ where: { orderId: sale.order.id, shiftId: opened.id, type: CashTransactionType.SALE } }), 1);

    await assert.rejects(
      () => cashRegisterService.closeShift(opened.id, { closingBalance: 124000 }, fixture.otherCashier),
      /another cashier shift/i,
    );
    await assert.rejects(
      () => cashRegisterService.openShift({ branchId: fixture.otherBranchId, openingBalance: 0 }, fixture.cashier),
      /another branch/i,
    );
    assert.equal(
      await prisma.cashTransaction.count({
        where: { orderId: sale.order.id, paymentId: payment.id, shiftId: opened.id, type: CashTransactionType.SALE },
      }),
      1,
    );

    const current = await cashRegisterService.getCurrentShift(fixture.cashier);
    assert.ok(current);
    assert.equal(current.orderCount, 1);
    assert.equal(current.cashSales.toFixed(0), "24000");
    assert.equal(current.expectedCash.toFixed(0), "124000");

    const closed = await cashRegisterService.closeShift(opened.id, { closingBalance: 125500 }, fixture.cashier);
    assert.equal(closed.status, ShiftStatus.CLOSED);
    assert.equal(closed.expectedCash?.toFixed(0), "124000");
    assert.equal(closed.cashDifference?.toFixed(0), "1500");
    assert.equal(closed.orderCount, 1);
    assert.equal(closed.cashTotal.toFixed(0), "24000");
    assert.equal(await prisma.cashTransaction.count({ where: { shiftId: opened.id, type: CashTransactionType.CLOSING_BALANCE } }), 1);
    await assert.rejects(
      () => cashRegisterService.closeShift(opened.id, { closingBalance: 125500 }, fixture.cashier),
      /already closed/i,
    );
    assert.equal(await prisma.cashTransaction.count({ where: { shiftId: opened.id, type: CashTransactionType.CLOSING_BALANCE } }), 1);

    await assert.rejects(
      () => ordersService.createPosCheckout(posDto(fixture, "after-close", 1, 12000), fixture.cashier),
      /Open cashier shift/i,
    );

    const reopened = await cashRegisterService.openShift({ openingBalance: 0 }, fixture.cashier);
    assert.equal(reopened.status, ShiftStatus.OPEN);
    assert.notEqual(reopened.id, opened.id);
    const zero = await cashRegisterService.closeShift(reopened.id, { closingBalance: 0 }, fixture.cashier);
    assert.equal(zero.cashDifference?.toFixed(0), "0");

    const negativeShift = await cashRegisterService.openShift({ openingBalance: 1000 }, fixture.cashier);
    const negative = await cashRegisterService.closeShift(negativeShift.id, { closingBalance: 500 }, fixture.cashier);
    assert.equal(negative.cashDifference?.toFixed(0), "-500");

    await proveConcurrentOpen(prisma, cashRegisterService);
    await proveConcurrentClose(prisma, cashRegisterService);
    await proveSaleVsCloseRace(prisma, ordersService, cashRegisterService);

    console.info("Shift/Kassa DB-backed validation passed");
  } finally {
    await prisma.onModuleDestroy();
  }
}

async function createFixture(prisma: PrismaService): Promise<Fixture> {
  const runId = Date.now().toString();
  const branch = await prisma.branch.create({
    data: { code: `SHIFT_${runId}`, name: "Shift Sergeli", isActive: true, acceptsOrders: true },
  });
  const otherBranch = await prisma.branch.create({
    data: { code: `SHIFT_OTHER_${runId}`, name: "Shift Other", isActive: true, acceptsOrders: true },
  });
  const category = await prisma.category.create({
    data: { code: `SHIFT_CAT_${runId}`, name: "Shift Lavash", isActive: true },
  });
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "CLASSIC_LAVASH",
      name: `Shift Lavash ${runId}`,
      sellingPrice: new Prisma.Decimal(12000),
      isAvailable: true,
    },
  });
  await prisma.paymentMethod.create({ data: { code: "CASH", name: "Naqd", isActive: true } });
  const user = await prisma.user.create({ data: { email: `shift-${runId}@example.test`, displayName: "Shift Cashier" } });
  const employee = await prisma.employee.create({
    data: {
      branchId: branch.id,
      userId: user.id,
      employeeCode: `SHIFT-CASH-${runId}`,
      firstName: "Shift",
      lastName: "Cashier",
      status: EmployeeStatus.ACTIVE,
    },
  });
  const otherUser = await prisma.user.create({ data: { email: `shift-other-${runId}@example.test`, displayName: "Other Cashier" } });
  const otherEmployee = await prisma.employee.create({
    data: {
      branchId: branch.id,
      userId: otherUser.id,
      employeeCode: `SHIFT-OTHER-${runId}`,
      firstName: "Other",
      lastName: "Cashier",
      status: EmployeeStatus.ACTIVE,
    },
  });

  return {
    runId,
    branchId: branch.id,
    otherBranchId: otherBranch.id,
    productId: product.id,
    cashier: {
      id: user.id,
      employeeId: employee.id,
      branchId: branch.id,
      roles: ["CASHIER"],
      permissions: ["POS_USE", "SHIFT_VIEW_OWN", "SHIFT_OPEN", "SHIFT_CLOSE"],
    },
    otherCashier: {
      id: otherUser.id,
      employeeId: otherEmployee.id,
      branchId: branch.id,
      roles: ["CASHIER"],
      permissions: ["POS_USE", "SHIFT_VIEW_OWN", "SHIFT_OPEN", "SHIFT_CLOSE"],
    },
  };
}

async function proveConcurrentOpen(
  prisma: PrismaService,
  cashRegisterService: CashRegisterService,
): Promise<void> {
  const fixture = await createFixture(prisma);
  const results = await Promise.allSettled([
    cashRegisterService.openShift({ openingBalance: 0 }, fixture.cashier),
    cashRegisterService.openShift({ openingBalance: 0 }, fixture.cashier),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(
    await prisma.shift.count({
      where: { branchId: fixture.branchId, employeeId: fixture.cashier.employeeId, status: ShiftStatus.OPEN },
    }),
    1,
  );
}

async function proveConcurrentClose(
  prisma: PrismaService,
  cashRegisterService: CashRegisterService,
): Promise<void> {
  const fixture = await createFixture(prisma);
  const opened = await cashRegisterService.openShift({ openingBalance: 1000 }, fixture.cashier);
  const results = await Promise.allSettled([
    cashRegisterService.closeShift(opened.id, { closingBalance: 1000 }, fixture.cashier),
    cashRegisterService.closeShift(opened.id, { closingBalance: 1000 }, fixture.cashier),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await prisma.cashTransaction.count({ where: { shiftId: opened.id, type: CashTransactionType.CLOSING_BALANCE } }), 1);
  const closed = await prisma.shift.findUniqueOrThrow({ where: { id: opened.id } });
  assert.equal(closed.status, ShiftStatus.CLOSED);
  assert.equal(closed.expectedCash?.toFixed(0), "1000");
}

async function proveSaleVsCloseRace(
  prisma: PrismaService,
  ordersService: OrdersService,
  cashRegisterService: CashRegisterService,
): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    const fixture = await createFixture(prisma);
    const opened = await cashRegisterService.openShift({ openingBalance: 1000 }, fixture.cashier);
    const results = await Promise.allSettled([
      ordersService.createPosCheckout(posDto(fixture, `race-${index}`, 1, 12000), fixture.cashier),
      cashRegisterService.closeShift(opened.id, { closingBalance: 13000 }, fixture.cashier),
    ]);
    const orders = await prisma.order.findMany({ where: { shiftId: opened.id }, include: { revenueRecords: true, cashTransactions: true } });
    const shift = await prisma.shift.findUniqueOrThrow({ where: { id: opened.id } });

    if (orders.length === 1) {
      assert.equal(orders[0]?.revenueRecords.length, 1);
      assert.equal(orders[0]?.cashTransactions.length, 1);
      assert.equal(shift.status, ShiftStatus.CLOSED);
      assert.equal(shift.cashTotal.toFixed(0), "12000");
      assert.equal(shift.expectedCash?.toFixed(0), "13000");
    } else {
      assert.equal(orders.length, 0);
      assert.ok(results.some((result) => result.status === "rejected"));
      assert.equal(shift.status, ShiftStatus.CLOSED);
      assert.equal(shift.cashTotal.toFixed(0), "0");
      assert.equal(shift.expectedCash?.toFixed(0), "1000");
    }
  }
}

function posDto(
  fixture: Fixture,
  suffix: string,
  quantity: number,
  cashReceived: number,
): CreatePosCheckoutDto {
  return {
    idempotencyKey: `${fixture.runId}-${suffix}`,
    cashReceived,
    items: [{ productId: fixture.productId, quantity }],
  };
}

function assertIsolatedDatabase(): void {
  if (process.env.MAZETTO_SHIFT_DB_SMOKE !== "1") {
    throw new Error("MAZETTO_SHIFT_DB_SMOKE=1 is required");
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";

  if (!/localhost|127\.0\.0\.1/.test(databaseUrl) || /mazettofood|production|dokploy/i.test(databaseUrl)) {
    throw new Error("Refusing to run Shift/Kassa DB smoke outside an isolated localhost database");
  }
}

void main();
