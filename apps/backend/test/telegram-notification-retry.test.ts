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
  type StoredDeadLetter = {
    id: number;
    tenantId: string;
    messageId: string;
    kind: string;
    orderId: string;
    error: string;
    failedAt: Date;
    attempts: number;
  };
  const persistedDeadLetters = new Map<string, StoredDeadLetter>();
  let nextDeadLetterId = 1;
  const notificationDeadLetter = {
    async create({ data }: { data: Omit<StoredDeadLetter, "id"> }) {
      const row = { ...data, id: nextDeadLetterId++ };
      persistedDeadLetters.set(`${row.tenantId}:${row.messageId}`, row);
      return row;
    },
    async findMany({
      where,
      skip = 0,
      take,
    }: {
      where: { tenantId: string };
      skip?: number;
      take?: number;
    }) {
      return [...persistedDeadLetters.values()]
        .filter((row) => row.tenantId === where.tenantId)
        .sort(
          (left, right) =>
            right.failedAt.getTime() - left.failedAt.getTime() ||
            right.id - left.id,
        )
        .slice(skip, take === undefined ? undefined : skip + take);
    },
    async findFirst({
      where,
    }: {
      where: { tenantId: string; messageId: string };
    }) {
      return (
        persistedDeadLetters.get(`${where.tenantId}:${where.messageId}`) ?? null
      );
    },
    async deleteMany({
      where,
    }: {
      where: { tenantId: string; messageId: string };
    }) {
      const key = `${where.tenantId}:${where.messageId}`;
      const row = persistedDeadLetters.get(key);
      if (!row) return { count: 0 };
      persistedDeadLetters.delete(key);
      return { count: 1 };
    },
  };
  const deadLetters = new NotificationDeadLetterService(
    { getClient: () => null } as never,
    { notificationDeadLetter } as never,
  );
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
      1,
      "ambiguous sendMessage failure must not retry because Telegram may already have accepted the first request",
    );

    const [failedDelivery] = await deadLetters.list("tenant-a");
    assert.ok(failedDelivery);
    assert.equal(failedDelivery.orderId, "order-a");
    assert.equal(failedDelivery.attempts, 1);
    assert.deepEqual(await deadLetters.list("tenant-b"), []);

    activeTenantIds.push("tenant-b");
    await assert.rejects(
      service.retryDeadLetter("tenant-a", failedDelivery.messageId),
    );
    assert.equal(
      fetchCalls,
      1,
      "ambiguous tenant context must not call Telegram",
    );
    assert.equal((await deadLetters.list("tenant-a")).length, 1);

    activeTenantIds.splice(0, activeTenantIds.length, "tenant-a");

    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(
        JSON.stringify({
          ok: false,
          error_code: 429,
          description: "Too Many Requests",
          parameters: { retry_after: 17 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    assert.deepEqual(
      await service.deliverOutboxNewOrder("order-a", "tenant-a"),
      { kind: "retryable", retryAfterSeconds: 17 },
      "Telegram's explicit rate-limit rejection is safe to retry after its requested delay",
    );
    assert.equal(fetchCalls, 2);
    assert.equal(
      (await deadLetters.list("tenant-a")).length,
      1,
      "a safe rate limit stays scheduled rather than being marked uncertain",
    );

    assert.equal(
      await service.retryDeadLetter("tenant-a", failedDelivery.messageId),
      "failed",
      "an explicit 429 response is not a successful manual retry",
    );
    assert.equal(
      (await deadLetters.list("tenant-a")).length,
      1,
      "a 429 response must preserve the dead letter for a later retry",
    );

    delete process.env.TELEGRAM_BOT_TOKEN;
    assert.equal(
      await service.retryDeadLetter("tenant-a", failedDelivery.messageId),
      "unavailable",
    );
    assert.equal(
      (await deadLetters.list("tenant-a")).length,
      1,
      "missing bot configuration must preserve the failed delivery",
    );
    process.env.TELEGRAM_BOT_TOKEN = "staging-mock-token";

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error_code: 400,
          description: "chat not found",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    assert.equal(
      await service.retryDeadLetter("tenant-a", failedDelivery.messageId),
      "failed",
      "Telegram API errors in an HTTP 200 response must be treated as failures",
    );
    assert.equal(
      (await deadLetters.list("tenant-a")).length,
      1,
      "a failed retry must leave its original dead letter available",
    );

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
      "sent",
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
