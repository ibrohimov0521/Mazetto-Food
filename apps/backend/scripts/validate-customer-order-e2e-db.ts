import { JwtService } from "@nestjs/jwt";
import {
  CustomerOrderType,
  KitchenTicketStatus,
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  Prisma,
  StockMovementType,
} from "@prisma/client";
import * as assert from "node:assert/strict";
import { BranchesService } from "../src/modules/branches/branches.service";
import { CustomerOrderEngineService } from "../src/modules/customers/customer-order-engine.service";
import { CustomersService } from "../src/modules/customers/customers.service";
import {
  OnlineOrderTypeDto,
  OnlinePaymentMethodDto,
} from "../src/modules/customers/dto/customer.dto";
import { InventoryService } from "../src/modules/inventory/inventory.service";
import { KitchenService } from "../src/modules/kitchen/kitchen.service";
import { NotificationOutboxWorker } from "../src/modules/notifications/notification-outbox.worker";
import { OrdersService } from "../src/modules/orders/orders.service";
import { PosOrderStatus } from "../src/modules/orders/dto/order-status.dto";
import { ORDER_EVENTS } from "../src/modules/orders/order-events";
import { PaymentsService } from "../src/modules/payments/payments.service";
import { TelegramCustomerAuthService } from "../src/modules/telegram/telegram-customer-auth.service";
import { TelegramCustomerOrderingService } from "../src/modules/telegram/telegram-customer-ordering.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { loadEnvironmentFile } from "../src/config/env";
import { createSettingsStub } from "./settings-stub";
import { IdempotencyService } from "../src/common/idempotency/idempotency.service";
import { TelegramCustomerScreenService } from "../src/modules/telegram/telegram-customer-screen.service";
import { TelegramCheckoutSessionService } from "../src/modules/telegram/telegram-checkout-session.service";
import { TelegramCartService } from "../src/modules/telegram/telegram-cart.service";
import { TelegramCheckoutService } from "../src/modules/telegram/telegram-checkout.service";
import { TelegramCustomerOrderHistoryService } from "../src/modules/telegram/telegram-customer-order-history.service";

// Skriptlar `tsx` ostida ishlaydi va `.env` ni o'zi yuklamaydi — Nest
// bootstrap'i bu yerda ishtirok etmaydi (7-bosqich Q3.1).
loadEnvironmentFile();

type SentTelegramPayload = {
  chat_id: string;
  text?: string;
  reply_markup?: {
    inline_keyboard?: { text: string; callback_data: string }[][];
    keyboard?: string[][];
  };
};

const sentTelegramPayloads: SentTelegramPayload[] = [];

globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
  sentTelegramPayloads.push(JSON.parse(String(init?.body)) as SentTelegramPayload);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as typeof fetch;

async function main(): Promise<void> {
  assertIsolatedDatabase();
  process.env.TELEGRAM_BOT_TOKEN = "step8-mock-telegram-token";
  delete process.env.TELEGRAM_STAFF_CHAT_ID;

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const services = createServices(prisma);
    const fixture = await createFixture(prisma);
    const initialCounts = await orderGraphCounts(prisma);
    await proveCancellationStockBehavior(prisma, services.ordersService, services.orderEngine, fixture);

    const webOrder = await createWebOrder(services.orderEngine, fixture);
    await proveOrderGraph(prisma, webOrder.customerOrder.id, {
      customerId: fixture.webCustomer.id,
      branchId: fixture.branch.id,
      source: OrderSource.WEB,
      expectedDeliveryFee: new Prisma.Decimal(0),
      expectedSubtotal: fixture.expectedConfigurableTotal,
      expectedTotal: fixture.expectedConfigurableTotal,
      expectedModifierName: fixture.modifier.name,
    });
    const queuedNotification = await prisma.notificationOutbox.findFirstOrThrow({
      where: {
        tenantId: fixture.branch.tenantId,
        orderId: webOrder.customerOrder.orderId,
      },
    });
    const mockDeliveries: Array<{ orderId: string; tenantId: string }> = [];
    const notificationWorker = new NotificationOutboxWorker(
      prisma,
      {
        deliverOutboxNewOrder: async (orderId: string, tenantId: string) => {
          mockDeliveries.push({ orderId, tenantId });
          return "sent";
        },
        deliverOutboxCustomerStatus: async () => "sent",
        deliverOutboxStaffStatusRefresh: async () => "sent",
      } as never,
    );
    const dueNotificationCount = await prisma.notificationOutbox.count({
      where: { status: "PENDING", scheduledAt: { lte: new Date() } },
    });
    for (let pass = 0; pass < dueNotificationCount; pass += 1) {
      await notificationWorker.dispatchPending();
      const current = await prisma.notificationOutbox.findUniqueOrThrow({
        where: { id: queuedNotification.id },
        select: { status: true },
      });
      if (current.status === "DELIVERED") break;
    }
    assert.equal(
      mockDeliveries.filter(
        ({ orderId }) => orderId === webOrder.customerOrder.orderId,
      ).length,
      1,
      "worker must deliver the target order once even when earlier queue items exist",
    );
    assert.ok(
      mockDeliveries.every(({ tenantId }) => tenantId === fixture.branch.tenantId),
      "worker deliveries must remain tenant-scoped",
    );
    const deliveredNotification =
      await prisma.notificationOutbox.findUniqueOrThrow({
        where: { id: queuedNotification.id },
      });
    assert.equal(deliveredNotification.status, "DELIVERED");
    assert.ok(deliveredNotification.deliveredAt instanceof Date);

    await proveOrderCashStockPrint(
      prisma,
      services.paymentsService,
      services.ordersService,
      fixture,
      webOrder.customerOrder.id,
    );

    const deliveryOrder = await createDeliveryWebOrder(services.orderEngine, fixture);
    await proveOrderGraph(prisma, deliveryOrder.customerOrder.id, {
      customerId: fixture.webCustomer.id,
      branchId: fixture.branch.id,
      source: OrderSource.WEB,
      expectedDeliveryFee: deliveryOrder.serverDeliveryFee,
      expectedSubtotal: fixture.expectedConfigurableTotal,
      expectedTotal: deliveryOrder.serverTotal,
      expectedModifierName: fixture.modifier.name,
    });
    await proveUnsupportedCustomerPayments(services.orderEngine, prisma, fixture);

    const afterWebCounts = await orderGraphCounts(prisma);
    await services.orderEngine.createOnlineOrder(
      fixture.webCustomer.id,
      webOrder.dto,
    );
    assert.deepEqual(
      await orderGraphCounts(prisma),
      afterWebCounts,
      "web idempotent retry must not create another order graph",
    );
    await provePendingAttemptWithExistingOrderRecovery(
      services.orderEngine,
      prisma,
      fixture,
      webOrder.customerOrder.id,
      webOrder.dto,
      afterWebCounts,
    );
    await proveStalePendingAttemptRetry(services.orderEngine, prisma, fixture);
    await proveActivePendingAttemptSafety(services.orderEngine, prisma, fixture);

    await proveTelegramFlattenedCatalogFlow(prisma, services.telegramOrdering, fixture);
    await proveTelegramCart(prisma, services.telegramOrdering, fixture);
    await proveTelegramCheckoutSession(prisma, services.telegramOrdering, fixture);

    const beforeTelegramConfirm = await orderGraphCounts(prisma);
    await services.telegramOrdering.handleCustomerCallback({
      id: "step8-confirm-a",
      message: { chat: { id: fixture.telegramChatId } },
      from: { id: fixture.telegramUserId },
      data: `cust:confirm:${fixture.telegramCartId}`,
    });
    const telegramOrder = await latestCustomerOrder(prisma, fixture.telegramCustomer.id);
    await proveOrderGraph(prisma, telegramOrder.id, {
      customerId: fixture.telegramCustomer.id,
      branchId: fixture.branch.id,
      source: OrderSource.TELEGRAM,
      expectedDeliveryFee: new Prisma.Decimal(0),
      expectedSubtotal: fixture.expectedConfigurableTotal,
      expectedTotal: fixture.expectedConfigurableTotal,
      expectedModifierName: fixture.modifier.name,
    });

    const afterTelegramConfirm = await orderGraphCounts(prisma);
    assert.equal(
      afterTelegramConfirm.orders,
      beforeTelegramConfirm.orders + 1,
      "Telegram confirm must create exactly one order",
    );
    assert.equal(
      await prisma.cartItem.count({ where: { cartId: fixture.telegramCartId } }),
      0,
      "Telegram cart items must be cleared after successful confirm",
    );
    assert.equal(
      await prisma.telegramCheckoutSession.count({
        where: { customerId: fixture.telegramCustomer.id, chatId: fixture.telegramChatId },
      }),
      0,
      "Telegram checkout session must be cleared after successful confirm",
    );

    await services.telegramOrdering.handleCustomerCallback({
      id: "step8-stale-confirm",
      message: { chat: { id: fixture.telegramChatId } },
      from: { id: fixture.telegramUserId },
      data: `cust:confirm:${fixture.telegramCartId}`,
    });
    assert.deepEqual(
      await orderGraphCounts(prisma),
      afterTelegramConfirm,
      "stale Telegram confirm must not create another order graph",
    );

    await proveTelegramNewOrderAfterSuccess(
      prisma,
      services.telegramOrdering,
      fixture,
    );
    const afterPostSuccessNewOrder = await orderGraphCounts(prisma);

    const concurrentFixture = await createTelegramReadyCart(prisma, fixture);
    await Promise.all([
      services.telegramOrdering.handleCustomerCallback({
        id: "step8-concurrent-1",
        message: { chat: { id: fixture.telegramChatId } },
        from: { id: fixture.telegramUserId },
        data: `cust:confirm:${concurrentFixture.cartId}`,
      }),
      services.telegramOrdering.handleCustomerCallback({
        id: "step8-concurrent-2",
        message: { chat: { id: fixture.telegramChatId } },
        from: { id: fixture.telegramUserId },
        data: `cust:confirm:${concurrentFixture.cartId}`,
      }),
    ]);
    const afterConcurrentConfirm = await orderGraphCounts(prisma);
    assert.equal(
      afterConcurrentConfirm.orders,
      afterPostSuccessNewOrder.orders + 1,
      "concurrent Telegram confirms must create one logical order only",
    );
    assert.equal(
      afterConcurrentConfirm.kitchenTickets,
      afterPostSuccessNewOrder.kitchenTickets + 1,
      "concurrent Telegram confirms must create one kitchen ticket only",
    );

    await proveRollbackSafety(services.orderEngine, prisma, fixture);
    await proveHistoryAndOwnership(services.customersService, fixture, {
      webCustomerOrderId: webOrder.customerOrder.id,
      telegramCustomerOrderId: telegramOrder.id,
    });

    assert.ok(
      (await orderGraphCounts(prisma)).orders >= initialCounts.orders + 3,
      "E2E proof should have persisted the expected successful order graphs",
    );

    console.info("DB-backed customer order E2E validation passed");
  } finally {
    await prisma.onModuleDestroy();
  }
}

function createServices(prisma: PrismaService) {
  const gateway = {
    emitOrderCreated: () => undefined,
    emitOrderConfirmed: () => undefined,
    emitOrderSentToKitchen: () => undefined,
    emitOrderStatusChanged: () => undefined,
  };
  const branchesService = new BranchesService(prisma);
  const inventoryService = new InventoryService(prisma);
  const kitchenService = new KitchenService(prisma, gateway as never);
  const ordersService = new OrdersService(
    prisma,
    inventoryService,
    kitchenService,
    undefined,
    new IdempotencyService(prisma),
  );
  const orderEngine = new CustomerOrderEngineService(
    prisma,
    branchesService,
    kitchenService,
    ordersService,
    createSettingsStub(),
  );
  const telegramOrdering = new TelegramCustomerOrderingService(
    prisma,
    new TelegramCustomerScreenService(),
    new TelegramCheckoutSessionService(prisma as never),
    new TelegramCartService(prisma as never, new TelegramCustomerScreenService()),
    new TelegramCheckoutService(
      prisma as never,
      orderEngine as never,
      new TelegramCustomerScreenService(),
      new TelegramCheckoutSessionService(prisma as never),
      new TelegramCartService(prisma as never, new TelegramCustomerScreenService()),
      { reverse: async () => ({ label: "Toshkent", inCity: true }) } as never,
    ),
    new TelegramCustomerOrderHistoryService(
      prisma as never,
      new TelegramCartService(prisma as never, new TelegramCustomerScreenService()),
      new TelegramCustomerScreenService(),
    ),
  );
  const telegramAuth = new TelegramCustomerAuthService(
    prisma,
    telegramOrdering,
    createSettingsStub(),
  );
  const customersService = new CustomersService(
    prisma,
    branchesService,
    kitchenService,
    new JwtService(),
    orderEngine,
    telegramAuth,
    createSettingsStub(),
  );

  const paymentsService = new PaymentsService(prisma);

  return { customersService, orderEngine, ordersService, paymentsService, telegramOrdering };
}

async function createFixture(prisma: PrismaService) {
  const runId = Date.now().toString();
  const phoneSuffix = runId.slice(-7);
  const branch = await prisma.branch.create({
    data: {
      code: `STEP8_TEST_BRANCH_${runId}`,
      name: "STEP 8 Test Branch",
      address: "Isolated localhost DB",
      timezone: "Asia/Tashkent",
      isActive: true,
      acceptsOrders: true,
      deliveryEnabled: true,
      pickupEnabled: true,
      sortOrder: -Number(runId.slice(-8)),
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      branchId: branch.id,
      name: "STEP 8 Isolated Warehouse",
    },
  });

  const configurableBase = await createTestCatalogProduct(
    prisma,
    branch.id,
    runId,
    "STEP8_CONFIGURABLE",
    "STEP 8 Configurable item",
    12000,
  );
  const modifier = await prisma.modifier.create({
    data: {
      code: `STEP8_ADDON_${runId}`,
      name: "STEP 8 test add-on",
      price: 2500,
    },
  });
  await prisma.productModifier.create({
    data: {
      productId: configurableBase.id,
      modifierId: modifier.id,
      maxSelect: 1,
    },
  });
  const configurable = await prisma.product.findUniqueOrThrow({
    where: { id: configurableBase.id },
    include: {
      category: true,
      variants: {
        where: { isAvailable: true },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
      },
      modifiers: {
        where: { modifier: { isActive: true } },
        include: { modifier: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  const variant = configurable.variants[0]!;
  const expectedConfigurableTotal = variant.sellingPrice.add(modifier.price);
  const ingredient = await prisma.ingredient.create({
    data: {
      name: `STEP 8 test ingredient ${runId}`,
      unit: "GRAM",
    },
  });
  const recipe = await prisma.recipe.create({
    data: {
      variantId: variant.id,
      items: {
        create: { ingredientId: ingredient.id, quantity: 1, unit: "GRAM" },
      },
    },
    include: { items: true },
  });
  for (const item of recipe.items) {
    await prisma.stock.upsert({
      where: {
        warehouseId_ingredientId: {
          warehouseId: warehouse.id,
          ingredientId: item.ingredientId,
        },
      },
      create: {
        warehouseId: warehouse.id,
        ingredientId: item.ingredientId,
        quantity: 100000,
      },
      update: { quantity: 100000 },
    });
  }
  const staffUser = await prisma.user.create({
    data: {
      email: `step8-${runId}@qa.local`,
      displayName: "STEP 8 cashier",
      isActive: true,
    },
  });
  const employee = await prisma.employee.create({
    data: {
      userId: staffUser.id,
      branchId: branch.id,
      employeeCode: `STEP8-${runId}`,
      firstName: "STEP 8",
      lastName: "Cashier",
      status: "ACTIVE",
    },
  });
  const device = await prisma.device.create({
    data: {
      branchId: branch.id,
      name: "STEP 8 desktop",
      type: "POS_TERMINAL",
      isActive: true,
    },
  });
  const shift = await prisma.shift.create({
    data: {
      branchId: branch.id,
      employeeId: employee.id,
      deviceId: device.id,
      shiftNumber: 1,
      status: "OPEN",
      type: "CASHIER",
      openingBalance: 0,
    },
  });
  const printer = await prisma.printer.create({
    data: {
      branchId: branch.id,
      name: "STEP 8 virtual receipt printer",
      type: "RECEIPT",
      status: "ONLINE",
      metadata: { printRoles: ["RECEIPT", "CANCELLATION", "REFUND"] },
    },
  });
  await prisma.paymentMethod.create({
    data: {
      branchId: branch.id,
      code: "CASH",
      name: "STEP 8 cash",
      isActive: true,
    },
  });
  await createTestCatalogProduct(
    prisma,
    branch.id,
    runId,
    "CLASSIC_LAVASH",
    "STEP 8 Classic lavash",
    18000,
  );
  await createTestCatalogProduct(
    prisma,
    branch.id,
    runId,
    "CLASSIC_BURGER",
    "STEP 8 Classic burger",
    22000,
  );
  await createTestCatalogProduct(
    prisma,
    branch.id,
    runId,
    "KETCHUP",
    "STEP 8 Ketchup",
    2000,
  );
  await createTestCatalogProduct(
    prisma,
    branch.id,
    runId,
    "SET_CHEESEBURGER",
    "STEP 8 Cheeseburger set",
    28000,
    true,
  );
  const lavash = await findCatalogProduct(prisma, "CLASSIC_LAVASH", branch.id);
  const burger = await findCatalogProduct(prisma, "CLASSIC_BURGER", branch.id);
  const simple = await findCatalogProduct(prisma, "KETCHUP", branch.id);
  const setBase = await findCatalogProduct(prisma, "SET_CHEESEBURGER", branch.id);
  await prisma.productBundleItem.create({
    data: {
      bundleProductId: setBase.id,
      componentCode: "CLASSIC_BURGER",
      componentName: "Classic burger",
      componentProductId: burger.id,
      quantity: 1,
      unitLabel: "set",
    },
  });
  const set = await prisma.product.findUniqueOrThrow({
    where: { id: setBase.id },
    include: {
      category: true,
      variants: {
        where: { isAvailable: true },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
      },
      bundleItems: true,
    },
  });
  const webCustomer = await prisma.customer.create({
    data: {
      tenantId: branch.tenantId,
      name: "Step 8 Web Customer",
      phone: `+9980${phoneSuffix}01`,
    },
  });
  const telegramUserId = `88${phoneSuffix}02`;
  const telegramChatId = `88${phoneSuffix}03`;
  const telegramCustomer = await prisma.customer.create({
    data: {
      tenantId: branch.tenantId,
      name: "Step 8 Telegram Customer",
      phone: `+9980${phoneSuffix}02`,
      telegramUserId,
      telegramChatId,
      telegramLinkedAt: new Date(),
    },
  });
  const otherCustomer = await prisma.customer.create({
    data: {
      tenantId: branch.tenantId,
      name: "Step 8 Other Customer",
      phone: `+9980${phoneSuffix}03`,
    },
  });

  return {
    branch,
    warehouse,
    burger,
    configurable,
    expectedConfigurableTotal,
    lavash,
    modifier,
    employee,
    printer,
    otherCustomer,
    runId,
    set,
    simple,
    shift,
    staffUser,
    telegramCartId: "",
    telegramChatId,
    telegramCustomer,
    telegramUserId,
    variant,
    webCustomer,
  };
}

async function createTestCatalogProduct(
  prisma: PrismaService,
  branchId: string,
  runId: string,
  code: string,
  name: string,
  price: number,
  isCombo = false,
) {
  const category = await prisma.category.create({
    data: {
      branchId,
      code: `STEP8_${code}_${runId}`,
      name: `STEP 8 ${name} category`,
    },
  });
  return prisma.product.create({
    data: {
      branchId,
      categoryId: category.id,
      code,
      name,
      sellingPrice: new Prisma.Decimal(price),
      isCombo,
      variants: {
        create: {
          code: "DEFAULT",
          name: "Standard",
          sellingPrice: new Prisma.Decimal(price),
          isDefault: true,
        },
      },
    },
    include: {
      category: true,
      variants: {
        where: { isAvailable: true },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
      },
      bundleItems: true,
    },
  });
}

async function findCatalogProduct(
  prisma: PrismaService,
  code: string,
  branchId: string,
) {
  return prisma.product.findFirstOrThrow({
    where: { code, branchId, isAvailable: true },
    include: {
      category: true,
      variants: {
        where: { isAvailable: true },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
      },
      modifiers: {
        where: { modifier: { isActive: true } },
        include: { modifier: true },
        orderBy: { sortOrder: "asc" },
      },
      bundleItems: true,
    },
  });
}

async function proveOrderCashStockPrint(
  prisma: PrismaService,
  paymentsService: PaymentsService,
  ordersService: OrdersService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
  customerOrderId: string,
): Promise<void> {
  const customerOrder = await prisma.customerOrder.findUniqueOrThrow({
    where: { id: customerOrderId },
    include: { order: true },
  });
  const actor = {
    id: fixture.staffUser.id,
    employeeId: fixture.employee.id,
    branchId: fixture.branch.id,
    roles: ["CASHIER"],
    permissions: ["PAYMENT_CREATE", "RECEIPT_PRINT"],
  };
  const result = await paymentsService.processOrderPayment(
    {
      orderId: customerOrder.orderId,
      shiftId: fixture.shift.id,
      idempotencyKey: `step8-cash-payment-${fixture.runId}`,
      payments: [
        {
          paymentMethodCode: "CASH",
          amount: customerOrder.order.total.toNumber(),
        },
      ],
    },
    actor,
  );
  assert.equal(result.operation?.status, "COMPLETED");
  assert.equal(result.payments.length, 1);
  assert.equal(result.order?.paymentStatus, "PAID");
  assert.equal(
    await prisma.revenueRecord.count({
      where: { orderId: customerOrder.orderId, shiftId: fixture.shift.id },
    }),
    1,
    "cash payment must create one revenue record",
  );
  assert.equal(
    await prisma.cashTransaction.count({
      where: {
        orderId: customerOrder.orderId,
        shiftId: fixture.shift.id,
        type: "SALE",
      },
    }),
    1,
    "cash payment must enter the drawer once",
  );
  const receipt = await prisma.receipt.findFirstOrThrow({
    where: { orderId: customerOrder.orderId, documentType: "RECEIPT" },
  });
  assert.equal(
    await prisma.printJob.count({
      where: { receiptId: receipt.id, printerId: fixture.printer.id },
    }),
    1,
    "paid order must queue one job for the configured receipt printer",
  );
  assert.equal(
    await prisma.auditLog.count({
      where: {
        action: "PAYMENT_OPERATION_COMPLETED",
        entityId: result.operation?.id,
      },
    }),
    1,
    "payment operation must be auditable",
  );
  assert.ok(
    (await prisma.stockMovement.count({
      where: { sourceType: "ORDER_ITEM_RECIPE", sourceId: customerOrder.orderId },
    })) > 0,
    "confirmed customer order must deduct recipe stock",
  );

  const paidOrder = await prisma.order.findUniqueOrThrow({
    where: { id: customerOrder.orderId },
    include: { items: true },
  });
  assert.equal(
    paidOrder.shiftId,
    null,
    "online order must remain unassigned to a cashier shift",
  );
  const item = paidOrder.items[0]!;
  const refundActor = {
    ...actor,
    permissions: [
      "PAYMENT_CREATE",
      "RECEIPT_PRINT",
      "ORDER_UPDATE",
      "PAYMENT_REFUND",
      "SHIFT_VIEW_BRANCH",
    ],
  };
  const closedShift = await prisma.shift.create({
    data: {
      branchId: fixture.branch.id,
      employeeId: fixture.employee.id,
      deviceId: fixture.shift.deviceId,
      shiftNumber: 2,
      status: "CLOSED",
      type: "CASHIER",
      openingBalance: 0,
      closedAt: new Date(),
    },
  });
  const unrelatedUser = await prisma.user.create({
    data: {
      email: "step8-refund-shift-" + fixture.runId + "@qa.local",
      displayName: "STEP 8 unrelated cashier",
      isActive: true,
    },
  });
  const unrelatedEmployee = await prisma.employee.create({
    data: {
      userId: unrelatedUser.id,
      branchId: fixture.branch.id,
      employeeCode: "STEP8-REFUND-" + fixture.runId,
      firstName: "STEP 8",
      lastName: "Unrelated cashier",
      status: "ACTIVE",
    },
  });
  const unrelatedOpenShift = await prisma.shift.create({
    data: {
      branchId: fixture.branch.id,
      employeeId: unrelatedEmployee.id,
      deviceId: fixture.shift.deviceId,
      shiftNumber: 3,
      status: "OPEN",
      type: "CASHIER",
      openingBalance: 0,
    },
  });
  const cancellationContext = (shiftId: string, suffix: string) => ({
    shiftId,
    expectedVersion: paidOrder.version,
    eventType: ORDER_EVENTS.ITEM_CANCELLED,
    correlationId: "step8-refund-" + suffix + "-" + fixture.runId,
    idempotencyKey: "step8-refund-" + suffix + "-" + fixture.runId,
  });
  const cancellationDto = {
    status: OrderItemStatus.CANCELLED,
    cancellationReason: "Step 8 online order item refund",
  };

  await assert.rejects(
    ordersService.updateItem(
      paidOrder.id,
      item.id,
      cancellationDto,
      refundActor,
      cancellationContext(closedShift.id, "closed"),
    ),
    /smenasi yopilgan/i,
    "refund must reject a closed cashier shift",
  );
  await assert.rejects(
    ordersService.updateItem(
      paidOrder.id,
      item.id,
      cancellationDto,
      refundActor,
      cancellationContext(unrelatedOpenShift.id, "unrelated"),
    ),
    /naqd to'lov tanlangan smenada kassaga kiritilmagan/i,
    "refund must reject an open shift without this order's cash SALE",
  );
  assert.equal(
    await prisma.paymentRefund.count({
      where: { orderItemId: item.id },
    }),
    0,
    "rejected shifts must not create refunds",
  );

  await ordersService.updateItem(
    paidOrder.id,
    item.id,
    cancellationDto,
    refundActor,
    cancellationContext(fixture.shift.id, "valid"),
  );
  const refund = await prisma.paymentRefund.findFirstOrThrow({
    where: { orderItemId: item.id },
  });
  assert.equal(refund.shiftId, fixture.shift.id);
  assert.equal(refund.amount.toFixed(2), paidOrder.total.toFixed(2));
  assert.equal(
    await prisma.cashTransaction.count({
      where: {
        orderId: paidOrder.id,
        shiftId: fixture.shift.id,
        paymentId: refund.paymentId,
        type: "REFUND",
      },
    }),
    1,
    "valid refund must be written to the shift containing the original cash sale",
  );
}

async function proveCancellationStockBehavior(
  prisma: PrismaService,
  ordersService: OrdersService,
  orderEngine: CustomerOrderEngineService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<void> {
  const recipe = await prisma.recipe.findUniqueOrThrow({
    where: { variantId: fixture.variant.id },
    include: { items: true },
  });
  const ingredientIds = recipe.items.map((item) => item.ingredientId);
  const readStock = async () =>
    (
      await prisma.stock.findMany({
        where: {
          warehouseId: fixture.warehouse.id,
          ingredientId: { in: ingredientIds },
        },
        orderBy: { ingredientId: "asc" },
        select: { ingredientId: true, quantity: true },
      })
    ).map((row) => [row.ingredientId, row.quantity.toFixed(3)] as const);
  const actor = {
    id: fixture.staffUser.id,
    employeeId: fixture.employee.id,
    branchId: fixture.branch.id,
    roles: ["CASHIER"],
    permissions: ["ORDER_UPDATE"],
  };

  const unstartedStock = await readStock();
  const unstartedOrder = await createWebOrder(
    orderEngine,
    fixture,
    "cancel-before-kitchen",
  );
  const unstarted = await prisma.order.findUniqueOrThrow({
    where: { id: unstartedOrder.customerOrder.orderId },
    include: { items: true, kitchenTickets: true },
  });
  assert.equal(unstarted.kitchenTickets[0]?.status, KitchenTicketStatus.NEW);
  const deductedStock = await readStock();
  assert.notDeepEqual(deductedStock, unstartedStock);

  const cancelledItem = unstarted.items[0]!;
  await ordersService.updateItem(
    unstarted.id,
    cancelledItem.id,
    {
      status: OrderItemStatus.CANCELLED,
      cancellationReason: "Isolated stock restore proof",
    },
    actor,
    {
      expectedVersion: unstarted.version,
      eventType: ORDER_EVENTS.ITEM_CANCELLED,
      correlationId: "isolated-stock-cancel-item",
      idempotencyKey: "isolated-stock-cancel-item",
    },
  );
  assert.deepEqual(await readStock(), unstartedStock);
  const [itemDeductions, itemRestorations] = await Promise.all([
    prisma.stockMovement.count({
      where: {
        orderItemId: cancelledItem.id,
        sourceType: "ORDER_ITEM_RECIPE",
        type: StockMovementType.OUT,
      },
    }),
    prisma.stockMovement.count({
      where: {
        orderItemId: cancelledItem.id,
        sourceType: "ORDER_ITEM_RECIPE_RESTOCK",
        type: StockMovementType.IN,
      },
    }),
  ]);
  assert.ok(itemDeductions > 0);
  assert.equal(itemRestorations, itemDeductions);

  const startedOrderDraft = await createWebOrder(
    orderEngine,
    fixture,
    "cancel-after-kitchen-accept",
  );
  const started = await prisma.order.findUniqueOrThrow({
    where: { id: startedOrderDraft.customerOrder.orderId },
    include: { kitchenTickets: true },
  });
  const ticket = started.kitchenTickets[0];
  assert.ok(ticket);
  const stockAfterStartedDeduction = await readStock();
  await prisma.kitchenTicket.update({
    where: { id: ticket.id },
    data: { status: KitchenTicketStatus.ACCEPTED },
  });

  await ordersService.updateStatus(
    started.id,
    { status: PosOrderStatus.CANCELLED, reason: "Isolated started-order proof" },
    actor,
  );
  assert.deepEqual(await readStock(), stockAfterStartedDeduction);
  assert.equal(
    await prisma.stockMovement.count({
      where: {
        sourceId: started.id,
        sourceType: "ORDER_ITEM_RECIPE_RESTOCK",
      },
    }),
    0,
  );
}
async function createWebOrder(
  orderEngine: CustomerOrderEngineService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
  suffix = "main",
) {
  const dto = {
    branchId: fixture.branch.id,
    idempotencyKey: `step8-web-idempotency-key-${suffix}-${fixture.runId}`,
    name: fixture.webCustomer.name,
    type: OnlineOrderTypeDto.PICKUP,
    paymentMethod: OnlinePaymentMethodDto.CASH,
    notes: "Step 8 isolated web order",
    items: [
      {
        productId: fixture.configurable.id,
        variantId: fixture.variant.id,
        quantity: 1,
        modifiers: [{ modifierId: fixture.modifier.id, quantity: 1 }],
      },
    ],
  };

  const result = await orderEngine.createOnlineOrder(fixture.webCustomer.id, dto);
  return { ...result, dto };
}

async function createDeliveryWebOrder(
  orderEngine: CustomerOrderEngineService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
) {
  const dto = {
    branchId: fixture.branch.id,
    idempotencyKey: `step11-web-delivery-idempotency-key-${fixture.runId}`,
    name: fixture.webCustomer.name,
    type: OnlineOrderTypeDto.DELIVERY,
    address: "Sergeli 7/3, Step 11 isolated delivery",
    paymentMethod: OnlinePaymentMethodDto.CASH,
    notes: "Step 11 isolated delivery quote order",
    items: [
      {
        productId: fixture.configurable.id,
        variantId: fixture.variant.id,
        quantity: 1,
        modifiers: [{ modifierId: fixture.modifier.id, quantity: 1 }],
      },
    ],
    deliveryFee: 999999,
    total: 999999,
  };

  const quote = await orderEngine.quoteCheckout(fixture.webCustomer.id, dto);
  assert.equal(quote.subtotal, fixture.expectedConfigurableTotal.toFixed(2));
  const serverDeliveryFee = new Prisma.Decimal(quote.deliveryFee);
  const serverTotal = fixture.expectedConfigurableTotal.add(serverDeliveryFee);
  assert.notEqual(quote.deliveryFee, String(dto.deliveryFee));
  assert.equal(quote.total, serverTotal.toFixed(2));
  assert.deepEqual(quote.paymentMethods.map((method) => method.code), ["CASH"]);

  const result = await orderEngine.createOnlineOrder(fixture.webCustomer.id, dto);
  return { ...result, dto, serverDeliveryFee, serverTotal };
}

async function provePendingAttemptWithExistingOrderRecovery(
  orderEngine: CustomerOrderEngineService,
  prisma: PrismaService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
  customerOrderId: string,
  dto: Awaited<ReturnType<typeof createWebOrder>>["dto"],
  expectedCounts: Awaited<ReturnType<typeof orderGraphCounts>>,
): Promise<void> {
  const attempt = await prisma.customerOrderAttempt.findFirstOrThrow({
    where: { customerOrderId },
  });
  await prisma.customerOrderAttempt.update({
    where: { id: attempt.id },
    data: { completedAt: null, status: "PENDING" },
  });

  const recovered = await orderEngine.createOnlineOrder(fixture.webCustomer.id, dto);
  assert.equal(recovered.customerOrder.id, customerOrderId);
  assert.deepEqual(
    await orderGraphCounts(prisma),
    expectedCounts,
    "PENDING attempt with an existing CustomerOrder must reuse the existing order graph",
  );
  assert.equal(
    (
      await prisma.customerOrderAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      })
    ).status,
    "COMPLETED",
  );
}

async function proveStalePendingAttemptRetry(
  orderEngine: CustomerOrderEngineService,
  prisma: PrismaService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<void> {
  const before = await orderGraphCounts(prisma);
  const dto = {
    branchId: fixture.branch.id,
    idempotencyKey: `step12-stale-pending-${fixture.runId}`,
    name: fixture.webCustomer.name,
    type: OnlineOrderTypeDto.PICKUP,
    paymentMethod: OnlinePaymentMethodDto.CASH,
    notes: "Step 12 stale pending recovery",
    items: [
      {
        productId: fixture.configurable.id,
        variantId: fixture.variant.id,
        quantity: 1,
      },
    ],
  };
  await prisma.customerOrderAttempt.create({
    data: {
      customerId: fixture.webCustomer.id,
      idempotencyKey: dto.idempotencyKey,
      requestHash: checkoutRequestHash(orderEngine, dto),
      createdAt: new Date(Date.now() - 3 * 60 * 1000),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const recovered = await orderEngine.createOnlineOrder(fixture.webCustomer.id, dto);
  assert.ok(recovered.customerOrder.id);
  const after = await orderGraphCounts(prisma);
  assert.equal(after.orders, before.orders + 1);
  assert.equal(after.customerOrders, before.customerOrders + 1);
  assert.equal(after.kitchenTickets, before.kitchenTickets + 1);
}

async function proveActivePendingAttemptSafety(
  orderEngine: CustomerOrderEngineService,
  prisma: PrismaService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<void> {
  const before = await orderGraphCounts(prisma);
  const dto = {
    branchId: fixture.branch.id,
    idempotencyKey: `step12-active-pending-${fixture.runId}`,
    name: fixture.webCustomer.name,
    type: OnlineOrderTypeDto.PICKUP,
    paymentMethod: OnlinePaymentMethodDto.CASH,
    notes: "Step 12 active pending safety",
    items: [
      {
        productId: fixture.configurable.id,
        variantId: fixture.variant.id,
        quantity: 1,
      },
    ],
  };
  await prisma.customerOrderAttempt.create({
    data: {
      customerId: fixture.webCustomer.id,
      idempotencyKey: dto.idempotencyKey,
      requestHash: checkoutRequestHash(orderEngine, dto),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await assert.rejects(() => orderEngine.createOnlineOrder(fixture.webCustomer.id, dto));
  const after = await orderGraphCounts(prisma);
  assert.equal(after.orders, before.orders);
  assert.equal(after.customerOrders, before.customerOrders);
  assert.equal(after.kitchenTickets, before.kitchenTickets);
  assert.equal(after.attempts, before.attempts + 1);
}

function checkoutRequestHash(
  orderEngine: CustomerOrderEngineService,
  dto: Parameters<CustomerOrderEngineService["createOnlineOrder"]>[1],
): string {
  return (
    orderEngine as unknown as {
      hashCheckoutRequest(dto: Parameters<CustomerOrderEngineService["createOnlineOrder"]>[1]): string;
    }
  ).hashCheckoutRequest(dto);
}

async function proveTelegramCart(
  prisma: PrismaService,
  telegramOrdering: TelegramCustomerOrderingService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<void> {
  await telegramOrdering.handleCustomerCallback({
    id: "step8-add-variant",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: `cust:addv:${fixture.variant.id}`,
  });
  const cart = await prisma.cart.findFirstOrThrow({
    where: { customerId: fixture.telegramCustomer.id },
    include: { items: true },
    orderBy: { updatedAt: "desc" },
  });
  fixture.telegramCartId = cart.id;
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0]?.productId, fixture.configurable.id);
  assert.equal(cart.items[0]?.variantId, fixture.variant.id);
  assert.equal(cart.items[0]?.quantity.toNumber(), 1);

  await prisma.cartItem.update({
    where: { id: cart.items[0]!.id },
    data: { modifierSnapshot: [{ modifierId: fixture.modifier.id, quantity: 1 }] },
  });
  const withModifier = await prisma.cartItem.findUniqueOrThrow({
    where: { id: cart.items[0]!.id },
  });
  assert.deepEqual(withModifier.modifierSnapshot, [
    { modifierId: fixture.modifier.id, quantity: 1 },
  ]);

  await telegramOrdering.handleCustomerCallback({
    id: "step8-qty-inc",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: `cust:qty:${cart.items[0]!.id}:inc`,
  });
  assert.equal(
    (
      await prisma.cartItem.findUniqueOrThrow({ where: { id: cart.items[0]!.id } })
    ).quantity.toNumber(),
    2,
  );

  await telegramOrdering.handleCustomerCallback({
    id: "step8-qty-dec",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: `cust:qty:${cart.items[0]!.id}:dec`,
  });
  assert.equal(
    (
      await prisma.cartItem.findUniqueOrThrow({ where: { id: cart.items[0]!.id } })
    ).quantity.toNumber(),
    1,
  );
}

async function proveTelegramFlattenedCatalogFlow(
  prisma: PrismaService,
  telegramOrdering: TelegramCustomerOrderingService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<void> {
  await prisma.cart.deleteMany({ where: { customerId: fixture.telegramCustomer.id } });
  sentTelegramPayloads.length = 0;

  await telegramOrdering.handleCustomerCallback({
    id: "step-catalog-lavash-category",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: `cust:cat:${fixture.lavash.categoryId}`,
  });
  assert.ok(
    sentTelegramPayloads.some((payload) =>
      payload.reply_markup?.inline_keyboard
        ?.flat()
        .some(
          (button) =>
            button.callback_data === `cust:prod:${fixture.lavash.id}` ||
            button.callback_data.startsWith(`cust:qprod:${fixture.lavash.id}:`),
        ),
    ),
    "Lavash category must expose real products directly without old meat family callbacks",
  );
  assert.ok(
    !sentTelegramPayloads.some((payload) =>
      JSON.stringify(payload.reply_markup ?? {}).includes("cust:qadd:lavash"),
    ),
    "Lavash category must not expose removed cust:qadd family callbacks",
  );

  await telegramOrdering.handleCustomerCallback({
    id: "step-catalog-burger-category",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: `cust:cat:${fixture.burger.categoryId}`,
  });
  assert.ok(
    sentTelegramPayloads.some((payload) =>
      payload.reply_markup?.inline_keyboard
        ?.flat()
        .some(
          (button) =>
            button.callback_data === `cust:prod:${fixture.burger.id}` ||
            button.callback_data.startsWith(`cust:qprod:${fixture.burger.id}:`),
        ),
    ),
    "Burger category must expose real products directly without old meat family callbacks",
  );
  assert.ok(
    !sentTelegramPayloads.some((payload) =>
      JSON.stringify(payload.reply_markup ?? {}).includes("cust:qadd:burger"),
    ),
    "Burger category must not expose removed cust:qadd family callbacks",
  );

  await Promise.all([
    telegramOrdering.handleCustomerCallback({
      id: "step-current-simple-add-1",
      message: { chat: { id: fixture.telegramChatId } },
      from: { id: fixture.telegramUserId },
      data: `cust:qprod:${fixture.simple.id}:${fixture.simple.categoryId}:1`,
    }),
    telegramOrdering.handleCustomerCallback({
      id: "step-current-simple-add-2",
      message: { chat: { id: fixture.telegramChatId } },
      from: { id: fixture.telegramUserId },
      data: `cust:qprod:${fixture.simple.id}:${fixture.simple.categoryId}:1`,
    }),
  ]);

  const mergedCart = await prisma.cart.findFirstOrThrow({
    where: { customerId: fixture.telegramCustomer.id },
    include: { items: true },
    orderBy: { updatedAt: "desc" },
  });
  assert.equal(mergedCart.items.length, 1, "equivalent concurrent quick-adds must merge");
  assert.equal(mergedCart.items[0]?.productId, fixture.simple.id);
  assert.equal(mergedCart.items[0]?.variantId, fixture.simple.variants[0]?.id);
  assert.equal(mergedCart.items[0]?.quantity.toNumber(), 2);

  await prisma.cartItem.update({
    where: { id: mergedCart.items[0]!.id },
    data: { modifierSnapshot: [{ modifierId: fixture.modifier.id, quantity: 1 }] },
  });
  await telegramOrdering.handleCustomerCallback({
    id: "step-current-simple-plain-after-modified",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: `cust:qprod:${fixture.simple.id}:${fixture.simple.categoryId}:1`,
  });
  assert.equal(
    await prisma.cartItem.count({ where: { cartId: mergedCart.id } }),
    2,
    "same product with modifiers must not merge with plain quick-add",
  );

  await telegramOrdering.handleCustomerCallback({
    id: "step-current-lavash-variant-add",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: `cust:addv:${fixture.lavash.variants[0]!.id}`,
  });
  assert.equal(
    await prisma.cartItem.count({ where: { cartId: mergedCart.id } }),
    3,
    "different product/variant selections must remain separate",
  );

  await telegramOrdering.handleCustomerCallback({
    id: "step-current-burger-variant-add",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: `cust:addv:${fixture.burger.variants[0]!.id}`,
  });
  const bundleComponentIds = fixture.set.bundleItems.flatMap((item) =>
    item.componentProductId ? [item.componentProductId] : [],
  );
  const bundleComponentCountBeforeSet = await prisma.cartItem.count({
    where: {
      cartId: mergedCart.id,
      productId: { in: bundleComponentIds },
    },
  });
  await telegramOrdering.handleCustomerCallback({
    id: "step-current-set-variant-add",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: `cust:addv:${fixture.set.variants[0]!.id}`,
  });
  const cartWithSet = await prisma.cart.findFirstOrThrow({
    where: { customerId: fixture.telegramCustomer.id },
    include: { items: true },
    orderBy: { updatedAt: "desc" },
  });
  assert.equal(
    cartWithSet.items.filter((item) => item.productId === fixture.set.id).length,
    1,
  );
  assert.equal(
    cartWithSet.items.filter((item) => bundleComponentIds.includes(item.productId)).length,
    bundleComponentCountBeforeSet,
    "set quick add must not add bundle components as separately charged cart lines",
  );

  await prisma.cart.deleteMany({ where: { customerId: fixture.telegramCustomer.id } });
}

async function proveTelegramCheckoutSession(
  prisma: PrismaService,
  telegramOrdering: TelegramCustomerOrderingService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<void> {
  await telegramOrdering.handleCustomerCallback({
    id: "step8-checkout",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: "cust:checkout",
  });
  await telegramOrdering.handleCustomerCallback({
    id: "step8-type-pickup",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: "cust:type:PICKUP",
  });

  const session = await prisma.telegramCheckoutSession.findUniqueOrThrow({
    where: {
      customerId_chatId: {
        customerId: fixture.telegramCustomer.id,
        chatId: fixture.telegramChatId,
      },
    },
  });
  assert.equal(session.branchId, fixture.branch.id);
  assert.equal(session.orderType, CustomerOrderType.PICKUP);
  assert.equal(session.step, "SUMMARY");
}

async function createTelegramReadyCart(
  prisma: PrismaService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
) {
  const cart = await prisma.cart.create({
    data: {
      customerId: fixture.telegramCustomer.id,
      items: {
        create: {
          productId: fixture.configurable.id,
          variantId: fixture.variant.id,
          quantity: new Prisma.Decimal(1),
          modifierSnapshot: [{ modifierId: fixture.modifier.id, quantity: 1 }],
        },
      },
    },
  });
  await prisma.telegramCheckoutSession.upsert({
    where: {
      customerId_chatId: {
        customerId: fixture.telegramCustomer.id,
        chatId: fixture.telegramChatId,
      },
    },
    create: {
      customerId: fixture.telegramCustomer.id,
      chatId: fixture.telegramChatId,
      branchId: fixture.branch.id,
      orderType: CustomerOrderType.PICKUP,
      step: "SUMMARY",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
    update: {
      branchId: fixture.branch.id,
      orderType: CustomerOrderType.PICKUP,
      step: "SUMMARY",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return { cartId: cart.id };
}

async function proveTelegramNewOrderAfterSuccess(
  prisma: PrismaService,
  telegramOrdering: TelegramCustomerOrderingService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<void> {
  assert.equal(
    await prisma.telegramCheckoutSession.count({
      where: { customerId: fixture.telegramCustomer.id, chatId: fixture.telegramChatId },
    }),
    0,
    "new Telegram order must start after the previous checkout session was cleared",
  );

  await telegramOrdering.handleCustomerCallback({
    id: "step15-post-success-simple-add",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: `cust:qprod:${fixture.simple.id}:${fixture.simple.categoryId}:1`,
  });
  const cart = await prisma.cart.findFirstOrThrow({
    where: { customerId: fixture.telegramCustomer.id },
    orderBy: { updatedAt: "desc" },
    include: { items: true },
  });
  assert.equal(cart.items.length, 1, "post-success quick-add should create a new cart line");

  await telegramOrdering.handleCustomerCallback({
    id: "step15-post-success-checkout",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: "cust:checkout",
  });
  await telegramOrdering.handleCustomerCallback({
    id: "step15-post-success-type-pickup",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: "cust:type:PICKUP",
  });
  const session = await prisma.telegramCheckoutSession.findUniqueOrThrow({
    where: {
      customerId_chatId: {
        customerId: fixture.telegramCustomer.id,
        chatId: fixture.telegramChatId,
      },
    },
  });
  assert.equal(session.branchId, fixture.branch.id);
  assert.equal(session.orderType, CustomerOrderType.PICKUP);
  assert.equal(session.step, "SUMMARY");
  assert.equal(session.address, null, "new pickup checkout must not inherit old address");
  assert.equal(session.note, null, "new checkout must not inherit old note");

  const beforeConfirm = await orderGraphCounts(prisma);
  await telegramOrdering.handleCustomerCallback({
    id: "step15-post-success-confirm",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: `cust:confirm:${cart.id}`,
  });
  const afterConfirm = await orderGraphCounts(prisma);
  assert.equal(afterConfirm.orders, beforeConfirm.orders + 1);
  assert.equal(afterConfirm.kitchenTickets, beforeConfirm.kitchenTickets + 1);
  assert.equal(
    await prisma.cartItem.count({ where: { cartId: cart.id } }),
    0,
    "second Telegram order cart must be cleared after success",
  );
  assert.equal(
    await prisma.telegramCheckoutSession.count({
      where: { customerId: fixture.telegramCustomer.id, chatId: fixture.telegramChatId },
    }),
    0,
    "second Telegram order session must be cleared after success",
  );
}

async function proveOrderGraph(
  prisma: PrismaService,
  customerOrderId: string,
  expected: {
    customerId: string;
    branchId: string;
    source: OrderSource;
    expectedDeliveryFee: Prisma.Decimal;
    expectedSubtotal: Prisma.Decimal;
    expectedTotal: Prisma.Decimal;
    expectedModifierName: string;
  },
): Promise<void> {
  const customerOrder = await prisma.customerOrder.findUniqueOrThrow({
    where: { id: customerOrderId },
    include: {
      attempt: true,
      order: {
        include: {
          branch: { select: { tenantId: true } },
          items: true,
          kitchenTickets: true,
          statusHistory: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  assert.equal(customerOrder.customerId, expected.customerId);
  assert.equal(customerOrder.branchId, expected.branchId);
  assert.equal(customerOrder.order.source, expected.source);
  assert.equal(customerOrder.order.status, OrderStatus.CONFIRMED);
  assert.equal(customerOrder.order.items.length, 1);
  assert.equal(customerOrder.order.kitchenTickets.length, 1);
  assert.ok(customerOrder.order.statusHistory.length >= 2);
  assert.equal(customerOrder.attempt?.status, "COMPLETED");
  const notification = await prisma.notificationOutbox.findUniqueOrThrow({
    where: {
      tenantId_dedupeKey: {
        tenantId: customerOrder.order.branch.tenantId,
        dedupeKey: `staff_new_order:${customerOrder.order.id}`,
      },
    },
  });
  assert.equal(notification.kind, "staff_new_order");
  assert.equal(notification.orderId, customerOrder.order.id);
  assert.equal(notification.status, "PENDING");
  assert.equal(
    customerOrder.order.deliveryFeeTotal.toFixed(2),
    expected.expectedDeliveryFee.toFixed(2),
  );
  assert.equal(customerOrder.order.total.toFixed(2), expected.expectedTotal.toFixed(2));

  const item = customerOrder.order.items[0]!;
  assert.equal(item.totalPrice.toFixed(2), expected.expectedSubtotal.toFixed(2));
  const modifiers = item.modifierSnapshot;
  assert.ok(Array.isArray(modifiers));
  assert.equal((modifiers[0] as { name?: string }).name, expected.expectedModifierName);
}

async function proveRollbackSafety(
  orderEngine: CustomerOrderEngineService,
  prisma: PrismaService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<void> {
  const before = await orderGraphCounts(prisma);
  await assert.rejects(() =>
    orderEngine.createOnlineOrder(fixture.webCustomer.id, {
      branchId: fixture.branch.id,
      idempotencyKey: "step8-invalid-modifier",
      name: fixture.webCustomer.name,
      type: OnlineOrderTypeDto.PICKUP,
      paymentMethod: OnlinePaymentMethodDto.CASH,
      items: [
        {
          productId: fixture.configurable.id,
          variantId: fixture.variant.id,
          quantity: 1,
          modifiers: [{ modifierId: "missing_modifier", quantity: 1 }],
        },
      ],
    }),
  );
  assert.deepEqual(
    await orderGraphCounts(prisma),
    before,
    "invalid modifier must not leave partial order graph",
  );
}

async function proveUnsupportedCustomerPayments(
  orderEngine: CustomerOrderEngineService,
  prisma: PrismaService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<void> {
  const before = await orderGraphCounts(prisma);

  for (const paymentMethod of [
    OnlinePaymentMethodDto.CLICK,
    OnlinePaymentMethodDto.PAYME,
    OnlinePaymentMethodDto.CARD,
  ]) {
    await assert.rejects(() =>
      orderEngine.createOnlineOrder(fixture.webCustomer.id, {
        branchId: fixture.branch.id,
        idempotencyKey: `step11-unsupported-${paymentMethod}-${fixture.runId}`,
        name: fixture.webCustomer.name,
        type: OnlineOrderTypeDto.PICKUP,
        paymentMethod,
        items: [
          {
            productId: fixture.configurable.id,
            variantId: fixture.variant.id,
            quantity: 1,
          },
        ],
      }),
    );
  }

  assert.deepEqual(
    await orderGraphCounts(prisma),
    before,
    "unsupported customer payment methods must not create order graph rows",
  );
}

async function proveHistoryAndOwnership(
  customersService: CustomersService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
  orders: { webCustomerOrderId: string; telegramCustomerOrderId: string },
): Promise<void> {
  const webHistory = await customersService.listCustomerOrders(fixture.webCustomer.id, {
    limit: 50,
    offset: 0,
  });
  assert.ok(webHistory.some((order) => order.id === orders.webCustomerOrderId));

  const telegramHistory = await customersService.listCustomerOrders(
    fixture.telegramCustomer.id,
    { limit: 50, offset: 0 },
  );
  assert.ok(
    telegramHistory.some((order) => order.id === orders.telegramCustomerOrderId),
  );

  await assert.rejects(() =>
    customersService.getCustomerOrder(
      fixture.otherCustomer.id,
      orders.webCustomerOrderId,
    ),
  );
}

async function latestCustomerOrder(prisma: PrismaService, customerId: string) {
  return prisma.customerOrder.findFirstOrThrow({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
}

async function orderGraphCounts(prisma: PrismaService) {
  const [
    orders,
    customerOrders,
    attempts,
    orderItems,
    statusHistory,
    kitchenTickets,
    notificationOutbox,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.customerOrder.count(),
    prisma.customerOrderAttempt.count(),
    prisma.orderItem.count(),
    prisma.orderStatusHistory.count(),
    prisma.kitchenTicket.count(),
    prisma.notificationOutbox.count(),
  ]);

  return {
    attempts,
    customerOrders,
    kitchenTickets,
    notificationOutbox,
    orderItems,
    orders,
    statusHistory,
  };
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

  if (!parsed.pathname.includes("step8")) {
    throw new Error("Refusing to run DB E2E without a step8 database name");
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
