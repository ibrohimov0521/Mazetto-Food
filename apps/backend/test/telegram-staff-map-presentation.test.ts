import assert from "node:assert/strict";
import test from "node:test";
import { TelegramOrderNotificationService } from "../src/modules/telegram/telegram-order-notification.service";

test("staff order notification uses an explicit map button without a link preview", async () => {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  const previousChatId = process.env.TELEGRAM_STAFF_CHAT_ID;
  const previousFetch = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_STAFF_CHAT_ID = "staff-chat";

  const sent: Array<{ method: string; payload: Record<string, unknown> }> = [];
  const order = {
    id: "order-1",
    orderNumber: "101",
    displayOrderNumber: "WEB101",
    staffTelegramChatId: null as string | null,
    staffTelegramMessageId: null as number | null,
    customerName: "Customer",
    customerPhone: "+998900000000",
    deliveryAddress: "Toshkent",
    deliveryLocation: { latitude: 41.2154, longitude: 69.1548 } as {
      latitude: number | null;
      longitude: number | null;
    },
    type: "DELIVERY",
    status: "NEW",
    total: 85000,
    notes: null,
    items: [],
    customerOrder: {
      type: "DELIVERY",
      paymentMethod: "CASH",
      customer: { telegramChatId: null },
    },
    kitchenTickets: [],
  };
  const service = new TelegramOrderNotificationService(
    {
      restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
      order: {
        findUnique: async () => ({ branch: { tenantId: "tenant-a" } }),
        findFirst: async () => order,
        update: async ({ data }: { data: { staffTelegramChatId: string; staffTelegramMessageId: number } }) => {
          order.staffTelegramChatId = data.staffTelegramChatId;
          order.staffTelegramMessageId = data.staffTelegramMessageId;
        },
      },
    } as never,
    {} as never,
    {} as never,
  );

  try {
    globalThis.fetch = (async (input, init) => {
      const method = String(input).split("/").at(-1) ?? "";
      sent.push({ method, payload: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({
        ok: true,
        result: { message_id: 42, chat: { id: "staff-chat" } },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    assert.equal(await service.deliverOutboxNewOrder("order-1", "tenant-a"), "sent");
    assert.equal(await service.deliverOutboxStaffStatusRefresh("order-1", "tenant-a"), "sent");
    assert.deepEqual(sent.map(({ method }) => method), ["sendMessage", "editMessageText"]);
    for (const { payload } of sent) {
      assert.deepEqual(payload.link_preview_options, { is_disabled: true });
      assert.deepEqual(payload.reply_markup, {
        inline_keyboard: [[{
          text: "📍 Xaritada ochish",
          url: "https://www.google.com/maps/search/?api=1&query=41.2154,69.1548",
        }]],
      });
      assert.match(String(payload.text), /Lokatsiya:<\/b> xaritada ochish/);
      assert.doesNotMatch(String(payload.text), /<a href=/);
    }

    order.deliveryLocation = { latitude: null, longitude: null };
    assert.equal(await service.deliverOutboxStaffStatusRefresh("order-1", "tenant-a"), "sent");
    assert.deepEqual(sent.at(-1)?.payload.reply_markup, { inline_keyboard: [] });
    assert.doesNotMatch(String(sent.at(-1)?.payload.text), /Lokatsiya:/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
    if (previousChatId === undefined) delete process.env.TELEGRAM_STAFF_CHAT_ID;
    else process.env.TELEGRAM_STAFF_CHAT_ID = previousChatId;
  }
});
