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
  cashier: AuthenticatedUser;
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

    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: sale.order.id } });
    assert.equal(
      await prisma.revenueRecord.count({ where: { orderId: sale.order.id, shiftId: opened.id } }),
      1,
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

    await assert.rejects(
      () => ordersService.createPosCheckout(posDto(fixture, "after-close", 1, 12000), fixture.cashier),
      /Open cashier shift/i,
    );

    const reopened = await cashRegisterService.openShift({ openingBalance: 0 }, fixture.cashier);
    assert.equal(reopened.status, ShiftStatus.OPEN);
    assert.notEqual(reopened.id, opened.id);

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

  return {
    runId,
    branchId: branch.id,
    productId: product.id,
    cashier: {
      id: user.id,
      employeeId: employee.id,
      branchId: branch.id,
      roles: ["CASHIER"],
      permissions: ["POS_USE", "SHIFT_VIEW_OWN", "SHIFT_OPEN", "SHIFT_CLOSE"],
    },
  };
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
