import assert from "node:assert/strict";
import test from "node:test";
import { NotificationDeadLetterService } from "../src/modules/notifications/notification-dead-letter.service";
import { TelegramOrderNotificationService } from "../src/modules/telegram/telegram-order-notification.service";

test("Telegram notification retries are tenant-guarded and preserve failed deliveries", async () => {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  const previousChatId = process.env.TELEGRAM_STAFF_CHAT_ID;
  const previousFetch = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = "staging-mock-token";
  process.env.TELEGRAM_STAFF_CHAT_ID = "staging-mock-chat";

  const activeTenantIds = ["tenant-a"];
  const order = {
    id: "order-a",
    orderNumber: "100",
    displayOrderNumber: "QA-100",
    staffTelegramChatId: null,
    staffTelegramMessageId: null,
    customerName: "Synthetic customer",
    customerPhone: null,
    deliveryAddress: null,
    deliveryLocation: null,
    type: "TAKEAWAY",
    status: "CONFIRMED",
    total: 12000,
    notes: null,
    items: [],
    customerOrder: null,
    kitchenTickets: [],
  };
  let fetchCalls = 0;
  const updates: unknown[] = [];
  const prisma = {
    restaurantTenant: {
      findMany: async () => activeTenantIds.map((id) => ({ id })),
    },
    order: {
      findUnique: async () => ({ branch: { tenantId: "tenant-a" } }),
      findFirst: async ({
        where,
      }: {
        where: { branch: { tenantId: string } };
      }) => (where.branch.tenantId === "tenant-a" ? order : null),
      update: async (input: unknown) => {
        updates.push(input);
      },
    },
  };
  const deadLetters = new NotificationDeadLetterService({
    getClient: () => null,
  } as never);
  const service = new TelegramOrderNotificationService(
    prisma as never,
    {} as never,
    deadLetters,
  );
  (service as unknown as { sleep: (ms: number) => Promise<void> }).sleep =
    async () => {};

  try {
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response("temporary outage", { status: 503 });
    }) as typeof fetch;

    await service.notifyNewOrder("order-a");
    assert.equal(
      fetchCalls,
      3,
      "transient Telegram errors should use all attempts",
    );

    const [failedDelivery] = await deadLetters.list("tenant-a");
    assert.ok(failedDelivery);
    assert.equal(failedDelivery.orderId, "order-a");
    assert.equal(failedDelivery.attempts, 3);
    assert.deepEqual(await deadLetters.list("tenant-b"), []);

    activeTenantIds.push("tenant-b");
    await assert.rejects(
      service.retryDeadLetter("tenant-a", failedDelivery.messageId),
    );
    assert.equal(
      fetchCalls,
      3,
      "ambiguous tenant context must not call Telegram",
    );
    assert.equal((await deadLetters.list("tenant-a")).length, 1);

    activeTenantIds.splice(0, activeTenantIds.length, "tenant-a");
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          result: { message_id: 77, chat: { id: "staging-mock-chat" } },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;

    assert.equal(
      await service.retryDeadLetter("tenant-a", failedDelivery.messageId),
      true,
    );
    assert.equal(updates.length, 1);
    assert.equal((await deadLetters.list("tenant-a")).length, 0);
  } finally {
    service.onModuleDestroy();
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
    if (previousChatId === undefined) delete process.env.TELEGRAM_STAFF_CHAT_ID;
    else process.env.TELEGRAM_STAFF_CHAT_ID = previousChatId;
  }
});
