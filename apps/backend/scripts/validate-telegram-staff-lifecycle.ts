import { CustomerOrderType, KitchenTicketStatus, OrderSource, OrderStatus, OrderType, Prisma } from "@prisma/client";
import * as assert from "node:assert/strict";
import { KitchenService } from "../src/modules/kitchen/kitchen.service";
import { TelegramOrderNotificationService } from "../src/modules/telegram/telegram-order-notification.service";
import { PrismaService } from "../src/prisma/prisma.service";

type SentTelegramPayload = {
  method: string;
  payload: {
    callback_query_id?: string;
    chat_id?: string;
    message_id?: number;
    text?: string;
    reply_markup?: {
      inline_keyboard?: { text: string; callback_data?: string; url?: string }[][];
    };
  };
};
type StaffLifecycleFixture = {
  branchId: string;
  customerId: string;
  customerChatId: string;
  runId: string;
};

const sentTelegramPayloads: SentTelegramPayload[] = [];
const editFailures = new Set<number>();
const forcedFetchFailures = new Set<string>();
const transientFetchFailures = new Map<string, number>();

globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const method = String(url).split("/").at(-1) ?? "";
  const payload = JSON.parse(String(init?.body)) as SentTelegramPayload["payload"];
  sentTelegramPayloads.push({ method, payload });

  if (forcedFetchFailures.has(method)) {
    throw new TypeError("fetch failed");
  }

  const remainingTransientFailures = transientFetchFailures.get(method) ?? 0;
  if (remainingTransientFailures > 0) {
    transientFetchFailures.set(method, remainingTransientFailures - 1);
    throw new TypeError("fetch failed");
  }

  if (method === "editMessageText" && payload.message_id && editFailures.has(payload.message_id)) {
    editFailures.delete(payload.message_id);
    return new Response(JSON.stringify({ ok: false, description: "Bad Request: message can't be edited" }), {
      status: 400,
    });
  }

  if (method === "sendMessage" && payload.chat_id === "customer-fail-chat") {
    return new Response(JSON.stringify({ ok: false, description: "Forbidden: bot was blocked by the user" }), {
      status: 403,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as typeof fetch;

async function main(): Promise<void> {
  assertIsolatedDatabase();
  process.env.TELEGRAM_BOT_TOKEN = "step16-mock-telegram-token";
  process.env.TELEGRAM_WEBHOOK_SECRET = "step16-staff-secret";
  process.env.TELEGRAM_STAFF_CHAT_ID = "900016";

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const gateway = {
      emitOrderCreated: () => undefined,
      emitOrderConfirmed: () => undefined,
      emitOrderSentToKitchen: () => undefined,
      emitOrderStatusChanged: () => undefined,
    };
    const kitchenService = new KitchenService(prisma, gateway as never);
    const staffNotifications = new TelegramOrderNotificationService(prisma, kitchenService);
    const fixture = await createFixture(prisma);

    await proveNewOrderNotification(prisma, staffNotifications, fixture);
    await proveNewOrderNotificationRetriesTransientFailure(prisma, staffNotifications, fixture);
    await proveLifecycle(prisma, staffNotifications, fixture);
    await proveLifecycleCustomerNotificationSurvivesCallbackAckFailure(prisma, staffNotifications, fixture);
    await proveCancellation(prisma, staffNotifications, fixture);
    await proveUnauthorizedCallback(prisma, staffNotifications, fixture);
    await proveInvalidAndStaleCallback(prisma, staffNotifications, fixture);
    await proveConcurrentAccept(prisma, staffNotifications, fixture);
    await proveEditFallbackAndCustomerNotificationFailure(prisma, staffNotifications, fixture);

    console.info("Telegram staff lifecycle validation passed");
  } finally {
    await prisma.onModuleDestroy();
  }
}

async function createFixture(prisma: PrismaService): Promise<StaffLifecycleFixture> {
  const runId = Date.now().toString();
  const branch = await prisma.branch.create({
    data: {
      code: `STEP16_STAFF_${runId}`,
      name: "STEP 16 Staff Branch",
      address: "Isolated localhost DB",
      timezone: "Asia/Tashkent",
      isActive: true,
      acceptsOrders: true,
      deliveryEnabled: true,
      pickupEnabled: true,
      sortOrder: -Number(runId.slice(-8)),
    },
  });
  const customerChatId = `916${runId.slice(-7)}`;
  const customer = await prisma.customer.create({
    data: {
      name: "Step 16 Telegram Customer",
      phone: `+99816${runId.slice(-7)}`,
      telegramUserId: `816${runId.slice(-7)}`,
      telegramChatId: customerChatId,
      telegramLinkedAt: new Date(),
    },
  });

  return { branchId: branch.id, customerChatId, customerId: customer.id, runId };
}

async function proveNewOrderNotification(
  prisma: PrismaService,
  staffNotifications: TelegramOrderNotificationService,
  fixture: StaffLifecycleFixture,
): Promise<void> {
  sentTelegramPayloads.length = 0;
  const order = await createStaffOrder(prisma, fixture, "notify");

  await staffNotifications.notifyNewOrder(order.id);

  const message = sentTelegramPayloads.find((payload) => payload.method === "sendMessage");
  assert.equal(message?.payload.chat_id, process.env.TELEGRAM_STAFF_CHAT_ID);
  assert.match(message?.payload.text ?? "", /Yangi buyurtma/);
  assert.match(message?.payload.text ?? "", new RegExp(order.orderNumber));
  assertKeyboardTexts(message, ["Qabul qilish", "Bekor qilish"]);
  assertNoKeyboardTexts(message, ["Tayyorlanmoqda", "Tayyor"]);
}

async function proveNewOrderNotificationRetriesTransientFailure(
  prisma: PrismaService,
  staffNotifications: TelegramOrderNotificationService,
  fixture: StaffLifecycleFixture,
): Promise<void> {
  sentTelegramPayloads.length = 0;
  transientFetchFailures.set("sendMessage", 1);
  const order = await createStaffOrder(prisma, fixture, "notify-retry");

  await staffNotifications.notifyNewOrder(order.id);

  const staffMessages = sentTelegramPayloads.filter(
    (payload) => payload.method === "sendMessage" && payload.payload.chat_id === process.env.TELEGRAM_STAFF_CHAT_ID,
  );
  assert.equal(staffMessages.length, 2, "staff new-order notification should retry once after a transient fetch failure");
  assert.match(staffMessages.at(-1)?.payload.text ?? "", new RegExp(order.orderNumber));
}

async function proveLifecycle(
  prisma: PrismaService,
  staffNotifications: TelegramOrderNotificationService,
  fixture: StaffLifecycleFixture,
): Promise<void> {
  sentTelegramPayloads.length = 0;
  const order = await createStaffOrder(prisma, fixture, "lifecycle");

  await handleStaffCallback(staffNotifications, `mazetto_order:accept:${order.id}`, 1001);
  await assertOrderState(prisma, order.id, OrderStatus.CONFIRMED, KitchenTicketStatus.ACCEPTED);
  assertKeyboardTexts(latestEdit(), ["Tayyorlanmoqda", "Bekor qilish"]);
  assertCustomerMessage(order.orderNumber, /qabul qilindi/);
  const afterAcceptHistory = await statusHistoryCount(prisma, order.id);

  await handleStaffCallback(staffNotifications, `mazetto_order:accept:${order.id}`, 1001);
  assert.equal(await statusHistoryCount(prisma, order.id), afterAcceptHistory, "duplicate accept must not create another status history row");

  await handleStaffCallback(staffNotifications, `mazetto_order:start_preparing:${order.id}`, 1001);
  await assertOrderState(prisma, order.id, OrderStatus.PREPARING, KitchenTicketStatus.COOKING);
  assertKeyboardTexts(latestEdit(), ["Tayyor", "Bekor qilish"]);
  assertCustomerMessage(order.orderNumber, /tayyorlanmoqda/);

  await handleStaffCallback(staffNotifications, `mazetto_order:mark_ready:${order.id}`, 1001);
  await assertOrderState(prisma, order.id, OrderStatus.READY, KitchenTicketStatus.READY);
  assert.deepEqual(latestEdit()?.payload.reply_markup?.inline_keyboard, []);
  assertCustomerMessage(order.orderNumber, /tayyor/);
}

async function proveLifecycleCustomerNotificationSurvivesCallbackAckFailure(
  prisma: PrismaService,
  staffNotifications: TelegramOrderNotificationService,
  fixture: StaffLifecycleFixture,
): Promise<void> {
  sentTelegramPayloads.length = 0;
  forcedFetchFailures.add("answerCallbackQuery");
  const order = await createStaffOrder(prisma, fixture, "callback-ack-fail");

  try {
    await handleStaffCallback(staffNotifications, `mazetto_order:accept:${order.id}`, 1101);
  } finally {
    forcedFetchFailures.delete("answerCallbackQuery");
  }

  await assertOrderState(prisma, order.id, OrderStatus.CONFIRMED, KitchenTicketStatus.ACCEPTED);
  assertKeyboardTexts(latestEdit(), ["Tayyorlanmoqda", "Bekor qilish"]);
  assertCustomerMessage(order.orderNumber, /qabul qilindi/);
}

async function proveCancellation(
  prisma: PrismaService,
  staffNotifications: TelegramOrderNotificationService,
  fixture: StaffLifecycleFixture,
): Promise<void> {
  sentTelegramPayloads.length = 0;
  const order = await createStaffOrder(prisma, fixture, "cancel");

  await handleStaffCallback(staffNotifications, `mazetto_order:cancel:${order.id}`, 2001);

  await assertOrderState(prisma, order.id, OrderStatus.CANCELLED, KitchenTicketStatus.CANCELLED);
  assert.deepEqual(latestEdit()?.payload.reply_markup?.inline_keyboard, []);
  assertCustomerMessage(order.orderNumber, /bekor qilindi/);
}

async function proveUnauthorizedCallback(
  prisma: PrismaService,
  staffNotifications: TelegramOrderNotificationService,
  fixture: StaffLifecycleFixture,
): Promise<void> {
  sentTelegramPayloads.length = 0;
  const order = await createStaffOrder(prisma, fixture, "unauthorized");
  const before = await statusHistoryCount(prisma, order.id);

  await staffNotifications.handleWebhook("step16-staff-secret", {
    callback_query: {
      id: "bad-chat",
      data: `mazetto_order:accept:${order.id}`,
      message: { chat: { id: "wrong-chat" }, message_id: 3001 },
    },
  });

  await assertOrderState(prisma, order.id, OrderStatus.NEW, KitchenTicketStatus.NEW);
  assert.equal(await statusHistoryCount(prisma, order.id), before);
  assert.match(latestAnswer()?.payload.text ?? "", /ruxsat/i);
}

async function proveInvalidAndStaleCallback(
  prisma: PrismaService,
  staffNotifications: TelegramOrderNotificationService,
  fixture: StaffLifecycleFixture,
): Promise<void> {
  sentTelegramPayloads.length = 0;
  const order = await createStaffOrder(prisma, fixture, "invalid");
  const before = await statusHistoryCount(prisma, order.id);

  await handleStaffCallback(staffNotifications, `mazetto_order:mark_ready:${order.id}`, 4001);
  await assertOrderState(prisma, order.id, OrderStatus.NEW, KitchenTicketStatus.NEW);
  assert.equal(await statusHistoryCount(prisma, order.id), before);
  assert.match(latestAnswer()?.payload.text ?? "", /statusdan/);

  await handleStaffCallback(staffNotifications, `mazetto_order:CONFIRMED:${order.id}`, 4001);
  await assertOrderState(prisma, order.id, OrderStatus.CONFIRMED, KitchenTicketStatus.ACCEPTED);
}

async function proveConcurrentAccept(
  prisma: PrismaService,
  staffNotifications: TelegramOrderNotificationService,
  fixture: StaffLifecycleFixture,
): Promise<void> {
  sentTelegramPayloads.length = 0;
  const order = await createStaffOrder(prisma, fixture, "concurrent");

  await Promise.all([
    handleStaffCallback(staffNotifications, `mazetto_order:accept:${order.id}`, 5001, "concurrent-a"),
    handleStaffCallback(staffNotifications, `mazetto_order:accept:${order.id}`, 5001, "concurrent-b"),
  ]);

  await assertOrderState(prisma, order.id, OrderStatus.CONFIRMED, KitchenTicketStatus.ACCEPTED);
  const histories = await prisma.orderStatusHistory.count({
    where: { orderId: order.id, toStatus: OrderStatus.CONFIRMED },
  });
  assert.equal(histories, 1, "concurrent accept must create one CONFIRMED history row");
}

async function proveEditFallbackAndCustomerNotificationFailure(
  prisma: PrismaService,
  staffNotifications: TelegramOrderNotificationService,
  fixture: StaffLifecycleFixture,
): Promise<void> {
  sentTelegramPayloads.length = 0;
  editFailures.add(6001);
  const order = await createStaffOrder(prisma, { ...fixture, customerChatId: "customer-fail-chat" }, "edit-fallback");

  await handleStaffCallback(staffNotifications, `mazetto_order:accept:${order.id}`, 6001);

  await assertOrderState(prisma, order.id, OrderStatus.CONFIRMED, KitchenTicketStatus.ACCEPTED);
  assert.ok(sentTelegramPayloads.some((payload) => payload.method === "editMessageText"));
  assert.ok(
    sentTelegramPayloads.some(
      (payload) =>
        payload.method === "sendMessage" &&
        payload.payload.chat_id === process.env.TELEGRAM_STAFF_CHAT_ID,
    ),
    "edit-impossible staff screen must fall back to one replacement message",
  );
}

async function createStaffOrder(
  prisma: PrismaService,
  fixture: StaffLifecycleFixture,
  scenario: string,
) {
  const orderNumber = `STEP16-${fixture.runId}-${scenario}`;
  const order = await prisma.order.create({
    data: {
      branchId: fixture.branchId,
      orderNumber,
      source: OrderSource.TELEGRAM,
      type: OrderType.DELIVERY,
      status: OrderStatus.NEW,
      paymentStatus: "PENDING",
      customerName: "Step 16 Customer",
      customerPhone: "+998901112233",
      deliveryAddress: "Step 16 isolated address",
      subtotal: new Prisma.Decimal(68000),
      total: new Prisma.Decimal(68000),
      items: {
        create: {
          productName: "Mol go'shtli lavash",
          variantName: "Standart",
          quantity: new Prisma.Decimal(2),
          unitPrice: new Prisma.Decimal(34000),
          totalPrice: new Prisma.Decimal(68000),
          modifierSnapshot: [],
        },
      },
      statusHistory: {
        create: {
          toStatus: OrderStatus.NEW,
          reason: "Step 16 synthetic order",
        },
      },
      kitchenTickets: {
        create: {
          ticketNumber: `STEP16-TICKET-${fixture.runId}-${scenario}`,
          status: KitchenTicketStatus.NEW,
        },
      },
    },
  });

  await prisma.customerOrder.create({
    data: {
      customerId: fixture.customerId,
      branchId: fixture.branchId,
      orderId: order.id,
      type: CustomerOrderType.DELIVERY,
      paymentMethod: "CASH",
      deliveryAddress: "Step 16 isolated address",
      notes: "Step 16 staff lifecycle validation",
    },
  });

  return order;
}

async function handleStaffCallback(
  staffNotifications: TelegramOrderNotificationService,
  data: string,
  messageId: number,
  callbackId = `cb-${messageId}-${Date.now()}`,
): Promise<void> {
  await staffNotifications.handleWebhook("step16-staff-secret", {
    callback_query: {
      id: callbackId,
      data,
      message: { chat: { id: process.env.TELEGRAM_STAFF_CHAT_ID }, message_id: messageId },
    },
  });
}

async function assertOrderState(
  prisma: PrismaService,
  orderId: string,
  orderStatus: OrderStatus,
  ticketStatus: KitchenTicketStatus,
): Promise<void> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { customerOrder: true, kitchenTickets: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  assert.equal(order.status, orderStatus);
  assert.equal(order.kitchenTickets[0]?.status, ticketStatus);
  assert.equal(order.customerOrder?.paymentMethod, "CASH");
}

async function statusHistoryCount(prisma: PrismaService, orderId: string): Promise<number> {
  return prisma.orderStatusHistory.count({ where: { orderId } });
}

function latestEdit(): SentTelegramPayload | undefined {
  return sentTelegramPayloads.toReversed().find((payload) => payload.method === "editMessageText");
}

function latestAnswer(): SentTelegramPayload | undefined {
  return sentTelegramPayloads.toReversed().find((payload) => payload.method === "answerCallbackQuery");
}

function assertKeyboardTexts(payload: SentTelegramPayload | undefined, labels: string[]): void {
  const texts = keyboardTexts(payload);

  for (const label of labels) {
    assert.ok(texts.includes(label), `keyboard must include ${label}`);
  }
}

function assertNoKeyboardTexts(payload: SentTelegramPayload | undefined, labels: string[]): void {
  const texts = keyboardTexts(payload);

  for (const label of labels) {
    assert.equal(texts.includes(label), false, `keyboard must not include ${label}`);
  }
}

function keyboardTexts(payload: SentTelegramPayload | undefined): string[] {
  return payload?.payload.reply_markup?.inline_keyboard?.flatMap((row) => row.map((button) => button.text)) ?? [];
}

function assertCustomerMessage(orderNumber: string, pattern: RegExp): void {
  const message = sentTelegramPayloads
    .toReversed()
    .filter((payload) => payload.method === "sendMessage")
    .find((payload) => payload.payload.chat_id !== process.env.TELEGRAM_STAFF_CHAT_ID && payload.payload.text?.includes(orderNumber));

  assert.match(message?.payload.text ?? "", pattern);
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

  if (!parsed.pathname.includes("step16")) {
    throw new Error("Refusing to run DB E2E without a step16 database name");
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
