import { JwtService } from "@nestjs/jwt";
import {
  CustomerOrderType,
  OrderSource,
  OrderStatus,
  Prisma,
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
import { OrdersService } from "../src/modules/orders/orders.service";
import { TelegramCustomerAuthService } from "../src/modules/telegram/telegram-customer-auth.service";
import { TelegramCustomerOrderingService } from "../src/modules/telegram/telegram-customer-ordering.service";
import { TelegramOrderNotificationService } from "../src/modules/telegram/telegram-order-notification.service";
import { PrismaService } from "../src/prisma/prisma.service";

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

    const webOrder = await createWebOrder(services.orderEngine, fixture);
    await proveOrderGraph(prisma, webOrder.customerOrder.id, {
      customerId: fixture.webCustomer.id,
      branchId: fixture.branch.id,
      source: OrderSource.WEB,
      expectedDeliveryFee: new Prisma.Decimal(0),
      expectedTotal: fixture.expectedConfigurableTotal,
      expectedModifierName: fixture.modifier.name,
    });

    const deliveryOrder = await createDeliveryWebOrder(services.orderEngine, fixture);
    await proveOrderGraph(prisma, deliveryOrder.customerOrder.id, {
      customerId: fixture.webCustomer.id,
      branchId: fixture.branch.id,
      source: OrderSource.WEB,
      expectedDeliveryFee: new Prisma.Decimal(0),
      expectedTotal: fixture.expectedConfigurableTotal,
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

    await proveTelegramQuickAddMerge(prisma, services.telegramOrdering, fixture);
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
      afterTelegramConfirm.orders + 1,
      "concurrent Telegram confirms must create one logical order only",
    );
    assert.equal(
      afterConcurrentConfirm.kitchenTickets,
      afterTelegramConfirm.kitchenTickets + 1,
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
  const ordersService = new OrdersService(prisma, inventoryService, kitchenService);
  const orderEngine = new CustomerOrderEngineService(
    prisma,
    branchesService,
    kitchenService,
    ordersService,
  );
  const telegramOrdering = new TelegramCustomerOrderingService(prisma, orderEngine);
  const telegramAuth = new TelegramCustomerAuthService(prisma, telegramOrdering);
  const telegramNotifications = new TelegramOrderNotificationService(
    prisma,
    kitchenService,
  );
  const customersService = new CustomersService(
    prisma,
    branchesService,
    new JwtService(),
    orderEngine,
    telegramAuth,
    telegramNotifications,
  );

  return { customersService, orderEngine, telegramOrdering };
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
  await prisma.warehouse.create({
    data: {
      branchId: branch.id,
      name: "STEP 8 Isolated Warehouse",
    },
  });

  const configurable = await prisma.product.findFirstOrThrow({
    where: {
      isAvailable: true,
      variants: { some: { isAvailable: true } },
      modifiers: { some: { modifier: { isActive: true } } },
    },
    include: {
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
  const modifier = configurable.modifiers[0]!.modifier;
  const expectedConfigurableTotal = variant.sellingPrice.add(modifier.price);
  const webCustomer = await prisma.customer.create({
    data: {
      name: "Step 8 Web Customer",
      phone: `+9980${phoneSuffix}01`,
    },
  });
  const telegramUserId = `88${phoneSuffix}02`;
  const telegramChatId = `88${phoneSuffix}03`;
  const telegramCustomer = await prisma.customer.create({
    data: {
      name: "Step 8 Telegram Customer",
      phone: `+9980${phoneSuffix}02`,
      telegramUserId,
      telegramChatId,
      telegramLinkedAt: new Date(),
    },
  });
  const otherCustomer = await prisma.customer.create({
    data: {
      name: "Step 8 Other Customer",
      phone: `+9980${phoneSuffix}03`,
    },
  });

  return {
    branch,
    configurable,
    expectedConfigurableTotal,
    modifier,
    otherCustomer,
    runId,
    telegramCartId: "",
    telegramChatId,
    telegramCustomer,
    telegramUserId,
    variant,
    webCustomer,
  };
}

async function createWebOrder(
  orderEngine: CustomerOrderEngineService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
) {
  const dto = {
    branchId: fixture.branch.id,
    idempotencyKey: `step8-web-idempotency-key-${fixture.runId}`,
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
  } as const;

  const quote = await orderEngine.quoteCheckout(fixture.webCustomer.id, dto);
  assert.equal(quote.subtotal, fixture.expectedConfigurableTotal.toFixed(2));
  assert.equal(quote.deliveryFee, "0.00");
  assert.equal(quote.total, fixture.expectedConfigurableTotal.toFixed(2));
  assert.deepEqual(quote.paymentMethods.map((method) => method.code), ["CASH"]);

  const result = await orderEngine.createOnlineOrder(fixture.webCustomer.id, dto);
  return { ...result, dto };
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

  await telegramOrdering.handleCustomerCallback({
    id: "step8-add-modifier",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: `cust:mod:${cart.items[0]!.id}:${fixture.modifier.id}`,
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

async function proveTelegramQuickAddMerge(
  prisma: PrismaService,
  telegramOrdering: TelegramCustomerOrderingService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<void> {
  await prisma.cart.deleteMany({ where: { customerId: fixture.telegramCustomer.id } });

  await Promise.all([
    telegramOrdering.handleCustomerCallback({
      id: "step13-quick-add-1",
      message: { chat: { id: fixture.telegramChatId } },
      from: { id: fixture.telegramUserId },
      data: "cust:qadd:burger:max:chicken",
    }),
    telegramOrdering.handleCustomerCallback({
      id: "step13-quick-add-2",
      message: { chat: { id: fixture.telegramChatId } },
      from: { id: fixture.telegramUserId },
      data: "cust:qadd:burger:max:chicken",
    }),
  ]);

  const mergedCart = await prisma.cart.findFirstOrThrow({
    where: { customerId: fixture.telegramCustomer.id },
    include: { items: true },
    orderBy: { updatedAt: "desc" },
  });
  assert.equal(mergedCart.items.length, 1, "equivalent concurrent quick-adds must merge");
  assert.equal(mergedCart.items[0]?.quantity.toNumber(), 2);

  await prisma.cartItem.update({
    where: { id: mergedCart.items[0]!.id },
    data: { modifierSnapshot: [{ modifierId: fixture.modifier.id, quantity: 1 }] },
  });
  await telegramOrdering.handleCustomerCallback({
    id: "step13-quick-add-plain-after-modified",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: "cust:qadd:burger:max:chicken",
  });
  assert.equal(
    await prisma.cartItem.count({ where: { cartId: mergedCart.id } }),
    2,
    "same product with modifiers must not merge with plain quick-add",
  );

  await telegramOrdering.handleCustomerCallback({
    id: "step13-quick-add-different-product",
    message: { chat: { id: fixture.telegramChatId } },
    from: { id: fixture.telegramUserId },
    data: "cust:qadd:lavash:original:beef",
  });
  assert.equal(
    await prisma.cartItem.count({ where: { cartId: mergedCart.id } }),
    3,
    "different product/variant selections must remain separate",
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

async function proveOrderGraph(
  prisma: PrismaService,
  customerOrderId: string,
  expected: {
    customerId: string;
    branchId: string;
    source: OrderSource;
    expectedDeliveryFee: Prisma.Decimal;
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
  assert.equal(
    customerOrder.order.deliveryFeeTotal.toFixed(2),
    expected.expectedDeliveryFee.toFixed(2),
  );
  assert.equal(customerOrder.order.total.toFixed(2), expected.expectedTotal.toFixed(2));

  const item = customerOrder.order.items[0]!;
  assert.equal(item.totalPrice.toFixed(2), expected.expectedTotal.toFixed(2));
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
  const webHistory = await customersService.listCustomerOrders(fixture.webCustomer.id);
  assert.ok(webHistory.some((order) => order.id === orders.webCustomerOrderId));

  const telegramHistory = await customersService.listCustomerOrders(
    fixture.telegramCustomer.id,
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
  ] = await Promise.all([
    prisma.order.count(),
    prisma.customerOrder.count(),
    prisma.customerOrderAttempt.count(),
    prisma.orderItem.count(),
    prisma.orderStatusHistory.count(),
    prisma.kitchenTicket.count(),
  ]);

  return { attempts, customerOrders, kitchenTickets, orderItems, orders, statusHistory };
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
