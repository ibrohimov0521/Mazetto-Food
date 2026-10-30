import assert from "node:assert/strict";
import test from "node:test";
import { TelegramOrderNotificationService } from "../src/modules/telegram/telegram-order-notification.service";

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-a",
    tenantId: "tenant-a",
    branchId: "branch-a",
    servedById: null,
    orderNumber: "100",
    displayOrderNumber: "A-100",
    staffTelegramChatId: null,
    staffTelegramMessageId: null,
    customerName: "Synthetic customer",
    customerPhone: "+998900000000",
    deliveryAddress: "Synthetic address",
    deliveryLocation: { latitude: 41.3, longitude: 69.2 },
    type: "DELIVERY",
    status: "NEW",
    total: "12000",
    notes: null,
    items: [],
    customerOrder: {
      type: "DELIVERY",
      paymentMethod: "CASH",
      customer: { telegramChatId: null },
    },
    kitchenTickets: [],
    ...overrides,
  };
}

function harness(options: {
  setting?: string;
  order?: Record<string, unknown>;
  ownerChatId?: string | null;
  employeeChatId?: string | null;
  ownerIds?: Array<{ id: string }>;
  cashierIds?: Array<{ id: string }>;
} = {}) {
  const queries: Record<string, unknown>[] = [];
  const queued: Array<Record<string, unknown>> = [];
  const telegramRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const currentOrder = order(options.order);
  const prisma = {
    setting: {
      findUnique: async () => ({ value: options.setting ?? "true" }),
      findMany: async () =>
        options.setting === "false"
          ? []
          : [
              { key: "telegram_owner_order_notifications_enabled" },
              { key: "telegram_cashier_order_notifications_enabled" },
            ],
    },
    order: {
      findUnique: async () => ({ branch: { tenantId: "tenant-a" } }),
      findFirst: async (query: { where: Record<string, unknown> }) => {
        queries.push(query.where);
        return currentOrder;
      },
      update: async () => ({}),
    },
    user: {
      findMany: async () => options.ownerIds ?? [{ id: "owner-a" }],
      findFirst: async (query: { where: Record<string, unknown> }) => {
        queries.push(query.where);
        return options.ownerChatId === null
          ? null
          : { telegramUserId: options.ownerChatId ?? "owner-chat" };
      },
    },
    employee: {
      findMany: async () => options.cashierIds ?? [{ id: "cashier-a" }],
      findFirst: async (query: { where: Record<string, unknown> }) => {
        queries.push(query.where);
        return options.employeeChatId === null
          ? null
          : { telegramUserId: options.employeeChatId ?? "staff-chat" };
      },
    },
    notificationOutbox: {
      createMany: async (query: { data: Array<Record<string, unknown>> }) => {
        queued.push(...query.data);
        return { count: query.data.length };
      },
      findFirst: async () => null,
      updateMany: async () => ({ count: 1 }),
    },
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
      findUnique: async () => ({ status: "ACTIVE" }),
    },
  };
  const service = new TelegramOrderNotificationService(
    prisma as never,
    {} as never,
    { record: async () => undefined } as never,
  );
  return { service, queries, queued, telegramRequests };
}

async function withStaffBot(
  run: (state: ReturnType<typeof harness>) => Promise<void>,
  options: Parameters<typeof harness>[0] = {},
) {
  const previousToken = process.env.TELEGRAM_STAFF_BOT_TOKEN;
  const previousCustomerToken = process.env.TELEGRAM_BOT_TOKEN;
  const previousChat = process.env.TELEGRAM_STAFF_CHAT_ID;
  const previousFetch = globalThis.fetch;
  const state = harness(options);
  process.env.TELEGRAM_STAFF_BOT_TOKEN = "staging-staff-bot-token";
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_STAFF_CHAT_ID;
  globalThis.fetch = (async (input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    state.telegramRequests.push({ url: String(input), body });
    return new Response(
      JSON.stringify({ ok: true, result: { message_id: 55, chat: { id: body.chat_id } } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    await run(state);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.TELEGRAM_STAFF_BOT_TOKEN;
    else process.env.TELEGRAM_STAFF_BOT_TOKEN = previousToken;
    if (previousCustomerToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousCustomerToken;
    if (previousChat === undefined) delete process.env.TELEGRAM_STAFF_CHAT_ID;
    else process.env.TELEGRAM_STAFF_CHAT_ID = previousChat;
  }
}

test("owner order notification is tenant-scoped and sent without action buttons", async () => {
  await withStaffBot(async ({ service, queries, telegramRequests }) => {
    const result = await service.deliverOutboxRoleNewOrder("order-a", "tenant-a", {
      role: "OWNER",
      recipientId: "owner-a",
    });

    assert.equal(result, "sent");
    assert.equal(queries[0]?.tenantId, "tenant-a");
    assert.equal(queries[1]?.tenantMemberships instanceof Object, true);
    assert.equal(telegramRequests.length, 1);
    assert.equal(telegramRequests[0]?.body.chat_id, "owner-chat");
    assert.equal(telegramRequests[0]?.body.reply_markup, undefined);
    assert.match(String(telegramRequests[0]?.body.text), /Boshqaruv paneli: \/admin/);
  });
});

test("cashier receives only its own branch's order notification", async () => {
  await withStaffBot(async ({ service, queries, telegramRequests }) => {
    const result = await service.deliverOutboxRoleNewOrder("order-a", "tenant-a", {
      role: "CASHIER",
      recipientId: "cashier-a",
    });

    assert.equal(result, "sent");
    const recipientQuery = queries.find((query) => query.id === "cashier-a");
    assert.equal(recipientQuery?.branchId, "branch-a");
    assert.equal(telegramRequests[0]?.body.chat_id, "staff-chat");
    assert.match(String(telegramRequests[0]?.body.text), /Kassa paneli: \/cashier/);
  });
});

test("assigned courier receives the delivery card only while the order remains assigned", async () => {
  await withStaffBot(async ({ service, telegramRequests }) => {
    const assigned = await service.deliverOutboxCourierAssignment(
      "order-a",
      "tenant-a",
      { employeeId: "courier-a" },
    );
    assert.equal(assigned, "sent");
    assert.equal(telegramRequests[0]?.body.chat_id, "staff-chat");
    assert.match(String(telegramRequests[0]?.body.text), /Kuryer paneli: \/courier/);
  }, { order: { servedById: "courier-a" } });

  await withStaffBot(async ({ service, telegramRequests }) => {
    const staleAssignment = await service.deliverOutboxCourierAssignment(
      "order-a",
      "tenant-a",
      { employeeId: "old-courier" },
    );
    assert.equal(staleAssignment, "ignored");
    assert.equal(telegramRequests.length, 0);
  }, { order: { servedById: "new-courier" } });
});

test("disabled role switch suppresses the private Telegram message", async () => {
  await withStaffBot(async ({ service, telegramRequests }) => {
    const result = await service.deliverOutboxRoleNewOrder("order-a", "tenant-a", {
      role: "OWNER",
      recipientId: "owner-a",
    });
    assert.equal(result, "ignored");
    assert.equal(telegramRequests.length, 0);
  }, { setting: "false" });
});

test("online-order delivery queues one tenant-scoped outbox job per enabled owner and cashier", async () => {
  await withStaffBot(async ({ service, queued }) => {
    const result = await service.deliverOutboxNewOrder("order-a", "tenant-a");

    assert.equal(result, "sent");
    assert.equal(queued.length, 2);
    assert.ok(queued.every((job) => job.tenantId === "tenant-a"));
    assert.deepEqual(
      queued.map((job) => (job.payload as { role: string }).role).sort(),
      ["CASHIER", "OWNER"],
    );
    assert.ok(queued.every((job) => job.skipDuplicates === undefined));
  });
});

test("ambiguous shared group delivery is skipped safely when no private role notification is enabled", async () => {
  await withStaffBot(async ({ service, telegramRequests, queued }) => {
    process.env.TELEGRAM_BOT_TOKEN = "staging-customer-bot-token";
    process.env.TELEGRAM_STAFF_CHAT_ID = "shared-staff-chat";
    const result = await service.deliverOutboxNewOrder("order-a", "tenant-a");
    assert.equal(result, "sent");
    assert.equal(queued.length, 0);
    assert.equal(telegramRequests.length, 0);
  }, { setting: "false" });
});
