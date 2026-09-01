import { KitchenTicketStatus, OrderSource, OrderStatus, OrderType, Prisma } from "@prisma/client";
import * as assert from "node:assert/strict";
import { KitchenService } from "../src/modules/kitchen/kitchen.service";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { PrismaService } from "../src/prisma/prisma.service";

type Fixture = {
  branchId: string;
  otherBranchId: string;
  user: AuthenticatedUser;
  globalUser: AuthenticatedUser;
  customerId: string;
  runId: string;
};

const emittedStatusChanges: unknown[] = [];

async function main(): Promise<void> {
  assertIsolatedDatabase();

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const kitchenService = new KitchenService(prisma, {
      emitOrderCreated: () => undefined,
      emitOrderConfirmed: () => undefined,
      emitOrderSentToKitchen: () => undefined,
      emitOrderStatusChanged: (payload: unknown) => emittedStatusChanges.push(payload),
    } as never);
    const fixture = await createFixture(prisma);

    await proveLifecycle(prisma, kitchenService, fixture);
    await proveCancellation(prisma, kitchenService, fixture);
    await proveInvalidTransition(prisma, kitchenService, fixture);
    await proveDoubleClick(prisma, kitchenService, fixture);
    await proveStaleClientRace(prisma, kitchenService, fixture);
    await proveActiveBoardRemoval(prisma, kitchenService, fixture);
    await proveBranchScope(prisma, kitchenService, fixture);
    await proveNoDuplicateRows(prisma, fixture);

    console.info("Kitchen DB-backed order board validation passed");
  } finally {
    await prisma.onModuleDestroy();
  }
}

async function createFixture(prisma: PrismaService): Promise<Fixture> {
  const runId = Date.now().toString();
  const branch = await prisma.branch.create({
    data: {
      code: `KITCHEN_GATE_${runId}`,
      name: "Kitchen Gate Branch",
      address: "Local isolated DB",
      timezone: "Asia/Tashkent",
      isActive: true,
      acceptsOrders: true,
      deliveryEnabled: true,
      pickupEnabled: true,
      sortOrder: -Number(runId.slice(-8)),
    },
  });
  const otherBranch = await prisma.branch.create({
    data: {
      code: `KITCHEN_OTHER_${runId}`,
      name: "Kitchen Other Branch",
      address: "Local isolated DB",
      timezone: "Asia/Tashkent",
      isActive: true,
      acceptsOrders: true,
      deliveryEnabled: true,
      pickupEnabled: true,
      sortOrder: -Number(runId.slice(-8)) - 1,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `kitchen-${runId}@example.test`,
      displayName: "Kitchen Gate User",
    },
  });
  const employee = await prisma.employee.create({
    data: {
      branchId: branch.id,
      userId: user.id,
      employeeCode: `KITCHEN-${runId}`,
      firstName: "Kitchen",
      status: "ACTIVE",
    },
  });
  const customer = await prisma.customer.create({
    data: {
      name: "Kitchen Gate Customer",
      phone: `+99888${runId.slice(-7)}`,
      telegramUserId: `88${runId.slice(-7)}`,
      telegramChatId: `99${runId.slice(-7)}`,
      telegramLinkedAt: new Date(),
    },
  });

  return {
    branchId: branch.id,
    otherBranchId: otherBranch.id,
    customerId: customer.id,
    runId,
    user: {
      id: user.id,
      employeeId: employee.id,
      branchId: branch.id,
      roles: ["KITCHEN"],
      permissions: ["KITCHEN_VIEW", "KITCHEN_ACCEPT", "KITCHEN_STATUS_UPDATE"],
    },
    globalUser: {
      id: user.id,
      employeeId: employee.id,
      roles: ["SUPER_ADMIN"],
      permissions: ["*"],
    },
  };
}

async function proveLifecycle(
  prisma: PrismaService,
  kitchenService: KitchenService,
  fixture: Fixture,
): Promise<void> {
  const order = await createKitchenOrder(prisma, fixture, "lifecycle");

  const accepted = await kitchenService.acceptTicket(order.ticketId, fixture.user);
  assert.equal(accepted.status, KitchenTicketStatus.ACCEPTED);
  await assertOrderState(prisma, order.orderId, OrderStatus.CONFIRMED, KitchenTicketStatus.ACCEPTED);

  const cooking = await kitchenService.startTicket(order.ticketId, fixture.user);
  assert.equal(cooking.status, KitchenTicketStatus.COOKING);
  await assertOrderState(prisma, order.orderId, OrderStatus.PREPARING, KitchenTicketStatus.COOKING);

  const ready = await kitchenService.readyTicket(order.ticketId, fixture.user);
  assert.equal(ready.status, KitchenTicketStatus.READY);
  await assertOrderState(prisma, order.orderId, OrderStatus.READY, KitchenTicketStatus.READY);

  const completed = await kitchenService.completeTicket(order.ticketId, fixture.user);
  assert.equal(completed.status, KitchenTicketStatus.COMPLETED);
  await assertOrderState(prisma, order.orderId, OrderStatus.READY, KitchenTicketStatus.COMPLETED);
}

async function proveCancellation(
  prisma: PrismaService,
  kitchenService: KitchenService,
  fixture: Fixture,
): Promise<void> {
  const order = await createKitchenOrder(prisma, fixture, "cancel");
  const cancelled = await kitchenService.cancelTicket(order.ticketId, fixture.user);

  assert.equal(cancelled.status, KitchenTicketStatus.CANCELLED);
  await assertOrderState(prisma, order.orderId, OrderStatus.CANCELLED, KitchenTicketStatus.CANCELLED);
}

async function proveInvalidTransition(
  prisma: PrismaService,
  kitchenService: KitchenService,
  fixture: Fixture,
): Promise<void> {
  const order = await createKitchenOrder(prisma, fixture, "invalid");

  await assert.rejects(
    () => kitchenService.readyTicket(order.ticketId, fixture.user),
    /Bu statusdan bunday amal bajarib bo'lmaydi/,
  );
  await assertOrderState(prisma, order.orderId, OrderStatus.NEW, KitchenTicketStatus.NEW);
}

async function proveDoubleClick(
  prisma: PrismaService,
  kitchenService: KitchenService,
  fixture: Fixture,
): Promise<void> {
  const order = await createKitchenOrder(prisma, fixture, "double-click");

  await kitchenService.acceptTicket(order.ticketId, fixture.user);
  await kitchenService.acceptTicket(order.ticketId, fixture.user);

  await assertOrderState(prisma, order.orderId, OrderStatus.CONFIRMED, KitchenTicketStatus.ACCEPTED);
  const historyCount = await prisma.orderStatusHistory.count({
    where: { orderId: order.orderId, toStatus: OrderStatus.CONFIRMED },
  });
  assert.equal(historyCount, 1, "same accept action must create one CONFIRMED history row");
}

async function proveStaleClientRace(
  prisma: PrismaService,
  kitchenService: KitchenService,
  fixture: Fixture,
): Promise<void> {
  const order = await createKitchenOrder(prisma, fixture, "stale-race");

  await Promise.all([
    kitchenService.acceptTicket(order.ticketId, fixture.user),
    kitchenService.acceptTicket(order.ticketId, fixture.user),
  ]);

  await assertOrderState(prisma, order.orderId, OrderStatus.CONFIRMED, KitchenTicketStatus.ACCEPTED);
  const historyCount = await prisma.orderStatusHistory.count({
    where: { orderId: order.orderId, toStatus: OrderStatus.CONFIRMED },
  });
  assert.equal(historyCount, 1, "concurrent accept must create one CONFIRMED history row");
}

async function proveActiveBoardRemoval(
  prisma: PrismaService,
  kitchenService: KitchenService,
  fixture: Fixture,
): Promise<void> {
  const completed = await createKitchenOrder(prisma, fixture, "active-complete");
  await kitchenService.acceptTicket(completed.ticketId, fixture.user);
  await kitchenService.startTicket(completed.ticketId, fixture.user);
  await kitchenService.readyTicket(completed.ticketId, fixture.user);
  await kitchenService.completeTicket(completed.ticketId, fixture.user);

  const cancelled = await createKitchenOrder(prisma, fixture, "active-cancel");
  await kitchenService.cancelTicket(cancelled.ticketId, fixture.user);

  const activeTickets = await kitchenService.listOrders(fixture.user);
  const activeIds = new Set(activeTickets.map((ticket) => ticket.id));

  assert.equal(activeIds.has(completed.ticketId), false, "completed tickets must leave active board");
  assert.equal(activeIds.has(cancelled.ticketId), false, "cancelled tickets must leave active board");
}

async function proveBranchScope(
  prisma: PrismaService,
  kitchenService: KitchenService,
  fixture: Fixture,
): Promise<void> {
  const ownBranch = await createKitchenOrder(prisma, fixture, "branch-own");
  const otherBranch = await createKitchenOrder(prisma, { ...fixture, branchId: fixture.otherBranchId }, "branch-other");

  const visibleTickets = await kitchenService.listOrders(fixture.user);
  const visibleIds = new Set(visibleTickets.map((ticket) => ticket.id));
  assert.equal(visibleIds.has(ownBranch.ticketId), true);
  assert.equal(visibleIds.has(otherBranch.ticketId), false);

  await assert.rejects(() => kitchenService.acceptTicket(otherBranch.ticketId, fixture.user), /Cannot access another branch/);
  await kitchenService.acceptTicket(otherBranch.ticketId, fixture.globalUser);
  await assertOrderState(prisma, otherBranch.orderId, OrderStatus.CONFIRMED, KitchenTicketStatus.ACCEPTED);
}

async function proveNoDuplicateRows(prisma: PrismaService, fixture: Fixture): Promise<void> {
  const where = { orderNumber: { startsWith: `KITCHEN-${fixture.runId}` } };
  const orders = await prisma.order.count({ where });
  const customerOrders = await prisma.customerOrder.count({ where: { order: where } });
  const kitchenTickets = await prisma.kitchenTicket.count({ where: { order: where } });

  assert.equal(customerOrders, orders, "status transitions must not create CustomerOrder rows");
  assert.equal(kitchenTickets, orders, "status transitions must not create extra KitchenTicket rows");
}

async function createKitchenOrder(
  prisma: PrismaService,
  fixture: Fixture,
  scenario: string,
): Promise<{ orderId: string; ticketId: string }> {
  const order = await prisma.order.create({
    data: {
      branchId: fixture.branchId,
      orderNumber: `KITCHEN-${fixture.runId}-${scenario}`,
      source: OrderSource.TELEGRAM,
      type: OrderType.DELIVERY,
      status: OrderStatus.NEW,
      paymentStatus: "PENDING",
      customerName: "Kitchen Gate Customer",
      customerPhone: "+998000000000",
      deliveryAddress: "Local isolated DB",
      subtotal: new Prisma.Decimal(68000),
      total: new Prisma.Decimal(68000),
      items: {
        create: {
          productName: "Mol go'shtli lavash",
          variantName: "Original",
          quantity: new Prisma.Decimal(2),
          unitPrice: new Prisma.Decimal(34000),
          totalPrice: new Prisma.Decimal(68000),
          modifierSnapshot: [{ name: "Qo'shimcha pishloq", quantity: "1" }],
        },
      },
      statusHistory: {
        create: {
          toStatus: OrderStatus.NEW,
          changedByUserId: fixture.user.id,
          changedByEmployeeId: fixture.user.employeeId,
          reason: "Kitchen DB release gate fixture",
        },
      },
      kitchenTickets: {
        create: {
          ticketNumber: `KITCHEN-TICKET-${fixture.runId}-${scenario}`,
          status: KitchenTicketStatus.NEW,
        },
      },
    },
    include: {
      kitchenTickets: true,
    },
  });

  await prisma.customerOrder.create({
    data: {
      customerId: fixture.customerId,
      branchId: fixture.branchId,
      orderId: order.id,
      type: "DELIVERY",
      paymentMethod: "CASH",
      deliveryAddress: "Local isolated DB",
    },
  });

  const ticketId = order.kitchenTickets[0]?.id;

  if (!ticketId) {
    throw new Error("Kitchen ticket fixture was not created");
  }

  return { orderId: order.id, ticketId };
}

async function assertOrderState(
  prisma: PrismaService,
  orderId: string,
  orderStatus: OrderStatus,
  ticketStatus: KitchenTicketStatus,
): Promise<void> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { kitchenTickets: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  assert.equal(order.status, orderStatus);
  assert.equal(order.kitchenTickets[0]?.status, ticketStatus);
}

function assertIsolatedDatabase(): void {
  if (process.env.MAZETTO_E2E_ISOLATED_DB !== "1") {
    throw new Error("MAZETTO_E2E_ISOLATED_DB=1 is required for this DB E2E script");
  }

  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const parsed = new URL(url);
  const safeHosts = new Set(["127.0.0.1", "localhost"]);

  if (!safeHosts.has(parsed.hostname)) {
    throw new Error("Refusing to run DB E2E against a non-localhost database");
  }

  if (!parsed.pathname.includes("kitchen")) {
    throw new Error("Refusing to run DB E2E without a kitchen database name");
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
