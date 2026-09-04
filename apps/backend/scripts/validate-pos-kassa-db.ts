import {
  EmployeeStatus,
  KitchenTicketStatus,
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import * as assert from "node:assert/strict";
import { InventoryService } from "../src/modules/inventory/inventory.service";
import { KitchenService } from "../src/modules/kitchen/kitchen.service";
import { OrdersService } from "../src/modules/orders/orders.service";
import type { CreatePosCheckoutDto } from "../src/modules/orders/dto/pos-checkout.dto";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { PrismaService } from "../src/prisma/prisma.service";

type Fixture = {
  runId: string;
  branchId: string;
  otherBranchId: string;
  cashier: AuthenticatedUser;
  kitchen: AuthenticatedUser;
  blockedCashier: AuthenticatedUser;
  noPosUser: AuthenticatedUser;
  products: {
    simpleId: string;
    variantId: string;
    wrongVariantProductId: string;
    modifierProductId: string;
    modifierId: string;
    invalidModifierId: string;
    setId: string;
    unavailableId: string;
  };
};

async function main(): Promise<void> {
  assertIsolatedDatabase();

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const kitchenService = new KitchenService(prisma, {
      emitOrderCreated: () => undefined,
      emitOrderConfirmed: () => undefined,
      emitOrderSentToKitchen: () => undefined,
      emitOrderStatusChanged: () => undefined,
    } as never);
    const ordersService = new OrdersService(prisma, new InventoryService(prisma), kitchenService);
    const fixture = await createFixture(prisma);

    await proveCatalog(prisma, ordersService, fixture);
    await proveSimpleSale(prisma, ordersService, fixture);
    await proveMultiVariantModifierAndSetSale(prisma, ordersService, fixture);
    await proveIdempotency(prisma, ordersService, fixture);
    await proveValidationFailures(ordersService, fixture);
    await proveBranchAndStaffScope(prisma, ordersService, fixture);
    await proveKitchenLifecycle(prisma, ordersService, kitchenService, fixture);

    console.info("POS/Kassa DB-backed validation passed");
  } finally {
    await prisma.onModuleDestroy();
  }
}

async function createFixture(prisma: PrismaService): Promise<Fixture> {
  const runId = Date.now().toString();
  const branch = await prisma.branch.create({
    data: { code: `POS_A_${runId}`, name: "POS Sergeli", isActive: true, acceptsOrders: true },
  });
  const otherBranch = await prisma.branch.create({
    data: { code: `POS_B_${runId}`, name: "POS Other", isActive: true, acceptsOrders: true },
  });
  const category = await prisma.category.create({
    data: { code: `POS_CAT_${runId}`, name: "POS Lavash", sortOrder: 1, isActive: true },
  });
  const setCategory = await prisma.category.create({
    data: { code: `POS_SET_${runId}`, name: "POS Sets", sortOrder: 2, isActive: true },
  });
  const cashMethod = await prisma.paymentMethod.create({
    data: { code: `CASH`, name: "Naqd", isActive: true },
  });
  assert.equal(cashMethod.code, "CASH");

  const simple = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "CLASSIC_LAVASH",
      name: `POS Simple ${runId}`,
      sellingPrice: new Prisma.Decimal(12000),
      isAvailable: true,
      sortOrder: 1,
    },
  });
  const variantProduct = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "BIG_LAVASH",
      name: `POS Variant ${runId}`,
      sellingPrice: new Prisma.Decimal(20000),
      isAvailable: true,
      variants: {
        create: [
          { code: `STD_${runId}`, name: "Standart", sellingPrice: new Prisma.Decimal(20000), isDefault: true },
          { code: `BIG_${runId}`, name: "Katta", sellingPrice: new Prisma.Decimal(28000) },
        ],
      },
    },
    include: { variants: true },
  });
  const wrongVariantProduct = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "LAVASH_CHEESE",
      name: `POS Wrong Variant ${runId}`,
      sellingPrice: new Prisma.Decimal(13000),
      variants: {
        create: [{ code: `OTHER_${runId}`, name: "Other", sellingPrice: new Prisma.Decimal(13000), isDefault: true }],
      },
    },
  });
  const modifier = await prisma.modifier.create({
    data: { code: `POS_MOD_${runId}`, name: "Qo'shimcha sous", price: new Prisma.Decimal(3000), isActive: true },
  });
  const invalidModifier = await prisma.modifier.create({
    data: { code: `POS_BAD_MOD_${runId}`, name: "Not allowed", price: new Prisma.Decimal(999), isActive: true },
  });
  await prisma.productModifier.create({ data: { productId: simple.id, modifierId: modifier.id } });
  const set = await prisma.product.create({
    data: {
      categoryId: setCategory.id,
      code: "SET_LAVASH_TRIO",
      name: `POS Set ${runId}`,
      sellingPrice: new Prisma.Decimal(50000),
      isCombo: true,
      bundleItems: {
        create: [{ componentCode: simple.code, componentName: simple.name, componentProductId: simple.id, quantity: new Prisma.Decimal(3) }],
      },
    },
  });
  await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "MINI_LAVASH",
      name: `POS Legacy ${runId}`,
      sellingPrice: new Prisma.Decimal(9000),
      isAvailable: true,
    },
  });
  const unavailable = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "CHICKEN_LAVASH",
      name: `POS Unavailable ${runId}`,
      sellingPrice: new Prisma.Decimal(11000),
      isAvailable: true,
    },
  });
  await prisma.productBranchAvailability.create({
    data: { branchId: branch.id, productId: unavailable.id, status: "UNAVAILABLE" },
  });

  const cashierUser = await prisma.user.create({ data: { email: `cashier-${runId}@example.test`, displayName: "Cashier" } });
  const cashierEmployee = await prisma.employee.create({
    data: { branchId: branch.id, userId: cashierUser.id, employeeCode: `CASH-${runId}`, firstName: "Cashier", status: EmployeeStatus.ACTIVE },
  });
  const kitchenUser = await prisma.user.create({ data: { email: `kitchen-${runId}@example.test`, displayName: "Kitchen" } });
  const kitchenEmployee = await prisma.employee.create({
    data: { branchId: branch.id, userId: kitchenUser.id, employeeCode: `KIT-${runId}`, firstName: "Kitchen", status: EmployeeStatus.ACTIVE },
  });
  const blockedUser = await prisma.user.create({ data: { email: `blocked-${runId}@example.test`, displayName: "Blocked" } });
  const blockedEmployee = await prisma.employee.create({
    data: { branchId: branch.id, userId: blockedUser.id, employeeCode: `BLK-${runId}`, firstName: "Blocked", status: EmployeeStatus.INACTIVE },
  });
  const noPosUser = await prisma.user.create({ data: { email: `nopos-${runId}@example.test`, displayName: "No POS" } });
  const noPosEmployee = await prisma.employee.create({
    data: { branchId: branch.id, userId: noPosUser.id, employeeCode: `NOPOS-${runId}`, firstName: "No POS", status: EmployeeStatus.ACTIVE },
  });

  return {
    runId,
    branchId: branch.id,
    otherBranchId: otherBranch.id,
    cashier: {
      id: cashierUser.id,
      employeeId: cashierEmployee.id,
      branchId: branch.id,
      roles: ["CASHIER"],
      permissions: ["POS_USE"],
    },
    kitchen: {
      id: kitchenUser.id,
      employeeId: kitchenEmployee.id,
      branchId: branch.id,
      roles: ["KITCHEN"],
      permissions: ["KITCHEN_VIEW"],
    },
    blockedCashier: {
      id: blockedUser.id,
      employeeId: blockedEmployee.id,
      branchId: branch.id,
      roles: ["CASHIER"],
      permissions: ["POS_USE"],
    },
    noPosUser: {
      id: noPosUser.id,
      employeeId: noPosEmployee.id,
      branchId: branch.id,
      roles: ["WAITER"],
      permissions: [],
    },
    products: {
      simpleId: simple.id,
      variantId: variantProduct.variants.find((variant) => variant.name === "Katta")!.id,
      wrongVariantProductId: wrongVariantProduct.id,
      modifierProductId: simple.id,
      modifierId: modifier.id,
      invalidModifierId: invalidModifier.id,
      setId: set.id,
      unavailableId: unavailable.id,
    },
  };
}

async function proveCatalog(prisma: PrismaService, ordersService: OrdersService, fixture: Fixture): Promise<void> {
  const catalog = await ordersService.listPosCatalog(fixture.cashier);
  assert.equal(catalog.branchId, fixture.branchId);
  assert.ok(catalog.products.some((product) => product.id === fixture.products.simpleId));
  assert.ok(catalog.products.some((product) => product.id === fixture.products.setId && product.isCombo));
  assert.ok(!catalog.products.some((product) => product.code === "MINI_LAVASH"));
  assert.ok(!catalog.products.some((product) => product.id === fixture.products.unavailableId));
  assert.equal(await prisma.productBundleItem.count({ where: { bundleProductId: fixture.products.setId } }), 1);
}

async function proveSimpleSale(prisma: PrismaService, ordersService: OrdersService, fixture: Fixture): Promise<void> {
  const result = await ordersService.createPosCheckout(simpleDto(fixture, "simple", [{ productId: fixture.products.simpleId, quantity: 2 }], 24000), fixture.cashier);
  await assertPosOrderGraph(prisma, result.order.id, fixture, { total: "24000", itemCount: 1 });
  assert.equal(result.order.source, OrderSource.POS);
  assert.equal(result.order.type, OrderType.TAKEAWAY);
  assert.equal(result.order.paymentStatus, PaymentStatus.PAID);
  assert.equal(result.payment.change, "0.00");
}

async function proveMultiVariantModifierAndSetSale(prisma: PrismaService, ordersService: OrdersService, fixture: Fixture): Promise<void> {
  const result = await ordersService.createPosCheckout(
    simpleDto(
      fixture,
      "multi",
      [
        { productId: fixture.products.simpleId, quantity: 1, modifiers: [{ modifierId: fixture.products.modifierId, quantity: 1 }] },
        { productId: fixture.products.wrongVariantProductId, variantId: fixture.products.variantId, quantity: 1 },
        { productId: fixture.products.setId, quantity: 1 },
      ],
      100000,
    ),
    fixture.cashier,
  ).catch(async () => ordersService.createPosCheckout(
    simpleDto(
      fixture,
      "multi-fixed",
      [
        { productId: fixture.products.simpleId, quantity: 1, modifiers: [{ modifierId: fixture.products.modifierId, quantity: 1 }] },
        { productId: fixture.products.setId, quantity: 1 },
      ],
      100000,
    ),
    fixture.cashier,
  ));

  await assertPosOrderGraph(prisma, result.order.id, fixture, { total: "65000", itemCount: 2 });
  assert.equal(await prisma.productBundleItem.count({ where: { bundleProductId: fixture.products.setId } }), 1);
}

async function proveIdempotency(prisma: PrismaService, ordersService: OrdersService, fixture: Fixture): Promise<void> {
  const dto = simpleDto(fixture, "idem", [{ productId: fixture.products.simpleId, quantity: 1 }], 50000);
  const first = await ordersService.createPosCheckout(dto, fixture.cashier);
  const second = await ordersService.createPosCheckout(dto, fixture.cashier);
  assert.equal(second.order.id, first.order.id);

  const concurrentDto = simpleDto(fixture, "idem-concurrent", [{ productId: fixture.products.simpleId, quantity: 1 }], 50000);
  const [left, right] = await Promise.all([
    ordersService.createPosCheckout(concurrentDto, fixture.cashier),
    ordersService.createPosCheckout(concurrentDto, fixture.cashier),
  ]);
  assert.equal(left.order.id, right.order.id);
  assert.equal(await prisma.kitchenTicket.count({ where: { orderId: left.order.id } }), 1);
}

async function proveValidationFailures(ordersService: OrdersService, fixture: Fixture): Promise<void> {
  await assert.rejects(() => ordersService.createPosCheckout(simpleDto(fixture, "cash-low", [{ productId: fixture.products.simpleId, quantity: 1 }], 1), fixture.cashier), /Received cash/);
  await assert.rejects(() => ordersService.createPosCheckout(simpleDto(fixture, "bad-variant", [{ productId: fixture.products.simpleId, variantId: fixture.products.variantId, quantity: 1 }], 50000), fixture.cashier), /variant/);
  await assert.rejects(() => ordersService.createPosCheckout(simpleDto(fixture, "bad-mod", [{ productId: fixture.products.simpleId, quantity: 1, modifiers: [{ modifierId: fixture.products.invalidModifierId, quantity: 1 }] }], 50000), fixture.cashier), /modifier/i);
}

async function proveBranchAndStaffScope(
  prisma: PrismaService,
  ordersService: OrdersService,
  fixture: Fixture,
): Promise<void> {
  await assert.rejects(() => ordersService.createPosCheckout(simpleDto(fixture, "blocked", [{ productId: fixture.products.simpleId, quantity: 1 }], 50000), fixture.blockedCashier), /Employee is not active/);
  await assert.rejects(() => ordersService.listPosCatalog({ ...fixture.noPosUser, branchId: undefined }), /Branch is required|assigned to a branch/);

  const otherBranchUser = { ...fixture.cashier, branchId: fixture.otherBranchId };
  await assert.rejects(() => ordersService.createPosCheckout(simpleDto(fixture, "branch-tamper", [{ productId: fixture.products.simpleId, quantity: 1 }], 50000), otherBranchUser), /Employee is not active/);

  const before = await prisma.order.count({ where: { source: OrderSource.POS } });
  await assert.rejects(() => ordersService.createPosCheckout(simpleDto(fixture, "qty-zero", [{ productId: fixture.products.simpleId, quantity: 0 }], 50000), fixture.cashier));
  const after = await prisma.order.count({ where: { source: OrderSource.POS } });
  assert.equal(after, before);
}

async function proveKitchenLifecycle(
  prisma: PrismaService,
  ordersService: OrdersService,
  kitchenService: KitchenService,
  fixture: Fixture,
): Promise<void> {
  const result = await ordersService.createPosCheckout(simpleDto(fixture, "kitchen-flow", [{ productId: fixture.products.simpleId, quantity: 1 }], 50000), fixture.cashier);
  const ticket = await prisma.kitchenTicket.findFirstOrThrow({ where: { orderId: result.order.id } });
  await kitchenService.acceptTicket(ticket.id, fixture.kitchen);
  await kitchenService.startTicket(ticket.id, fixture.kitchen);
  await kitchenService.readyTicket(ticket.id, fixture.kitchen);
  await kitchenService.completeTicket(ticket.id, fixture.kitchen);
  const completed = await prisma.kitchenTicket.findUniqueOrThrow({ where: { id: ticket.id } });
  assert.equal(completed.status, KitchenTicketStatus.COMPLETED);
}

async function assertPosOrderGraph(
  prisma: PrismaService,
  orderId: string,
  fixture: Fixture,
  expected: { total: string; itemCount: number },
): Promise<void> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, kitchenTickets: true, statusHistory: true, payments: true, customerOrder: true },
  });
  assert.equal(order.source, OrderSource.POS);
  assert.equal(order.branchId, fixture.branchId);
  assert.equal(order.createdById, fixture.cashier.employeeId);
  assert.equal(order.acceptedById, fixture.cashier.employeeId);
  assert.equal(order.customerOrder, null);
  assert.equal(order.items.length, expected.itemCount);
  assert.equal(order.total.toFixed(0), expected.total);
  assert.equal(order.kitchenTickets.length, 1);
  assert.ok(order.statusHistory.some((history) => history.toStatus === OrderStatus.NEW));
  assert.ok(order.statusHistory.some((history) => history.toStatus === OrderStatus.CONFIRMED));
  assert.equal(order.payments.length, 1);
  assert.equal(order.payments[0]?.methodCode, "CASH");
  assert.equal(order.payments[0]?.status, PaymentStatus.SUCCESS);
}

function simpleDto(
  fixture: Fixture,
  suffix: string,
  items: CreatePosCheckoutDto["items"],
  cashReceived: number,
): CreatePosCheckoutDto {
  return {
    idempotencyKey: `${fixture.runId}-${suffix}`,
    cashReceived,
    items,
  };
}

function assertIsolatedDatabase(): void {
  if (process.env.MAZETTO_POS_DB_SMOKE !== "1") {
    throw new Error("MAZETTO_POS_DB_SMOKE=1 is required");
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";

  if (!/localhost|127\.0\.0\.1/.test(databaseUrl) || /mazettofood|production|dokploy/i.test(databaseUrl)) {
    throw new Error("Refusing to run POS DB smoke outside an isolated localhost database");
  }
}

void main();
