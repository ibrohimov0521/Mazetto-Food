import assert from "node:assert/strict";
import test from "node:test";
import { KitchenTicketStatus } from "@prisma/client";
import { TelegramStaffService } from "../src/modules/telegram/telegram-staff.service";

test("staff panel sends one valid inline keyboard for a cashier who also runs the kitchen", async () => {
  const previousToken = process.env.TELEGRAM_STAFF_BOT_TOKEN;
  process.env.TELEGRAM_STAFF_BOT_TOKEN = "test-token";
  const payloads: Array<{ reply_markup?: Record<string, unknown> }> = [];

  try {
    const service = new TelegramStaffService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        renderWithToken: async (_token: string, _target: unknown, payload: { reply_markup?: Record<string, unknown> }) => {
          payloads.push(payload);
        },
      } as never,
    );
    await (service as unknown as {
      sendStaffPanel(chatId: string, staff: unknown): Promise<void>;
    }).sendStaffPanel("chat-1", {
      displayName: "Xodim",
      user: { roles: ["CASHIER", "KITCHEN"] },
    });

    const markup = payloads[0]?.reply_markup;
    assert.ok(markup);
    assert.deepEqual(Object.keys(markup), ["inline_keyboard"]);
    assert.deepEqual(
      (markup.inline_keyboard as Array<Array<{ text: string }>>).map((row) => row[0]?.text),
      ["🍳 Oshxona buyurtmalari", "💵 Kassa", "🔄 Yangilash"],
    );
  } finally {
    if (previousToken === undefined) delete process.env.TELEGRAM_STAFF_BOT_TOKEN;
    else process.env.TELEGRAM_STAFF_BOT_TOKEN = previousToken;
  }
});

test("kitchen buttons name the action and bind it to the displayed ticket status", async () => {
  const previousToken = process.env.TELEGRAM_STAFF_BOT_TOKEN;
  process.env.TELEGRAM_STAFF_BOT_TOKEN = "test-token";
  const payloads: Array<{ reply_markup?: { inline_keyboard?: Array<Array<{ text: string; callback_data: string }>> } }> = [];
  const statuses = [
    KitchenTicketStatus.NEW,
    KitchenTicketStatus.ACCEPTED,
    KitchenTicketStatus.COOKING,
    KitchenTicketStatus.READY,
  ];

  try {
    const service = new TelegramStaffService(
      {} as never,
      {} as never,
      { listOrders: async () => statuses.map((status, index) => ({
        id: `ticket-${index}`,
        status,
        ticketNumber: index + 1,
        items: [],
      })) } as never,
      {} as never,
      {} as never,
      { renderWithToken: async (_token: string, _target: unknown, payload: typeof payloads[number]) => {
        payloads.push(payload);
      } } as never,
    );
    await (service as unknown as {
      sendKitchenOrders(chatId: string, staff: unknown): Promise<void>;
    }).sendKitchenOrders("chat-1", { user: { roles: ["KITCHEN"], employeeId: "employee-1" } });

    const buttons = payloads[0]?.reply_markup?.inline_keyboard?.map((row) => row[0]);
    assert.deepEqual(buttons?.slice(0, 4), [
      { text: "✅ Qabul qilish #1", callback_data: "s:kt:ticket-0:NEW" },
      { text: "🍳 Tayyorlash #2", callback_data: "s:kt:ticket-1:ACCEPTED" },
      { text: "🔔 Tayyor deb belgilash #3", callback_data: "s:kt:ticket-2:COOKING" },
      { text: "✅ Yakunlash #4", callback_data: "s:kt:ticket-3:READY" },
    ]);
  } finally {
    if (previousToken === undefined) delete process.env.TELEGRAM_STAFF_BOT_TOKEN;
    else process.env.TELEGRAM_STAFF_BOT_TOKEN = previousToken;
  }
});

test("old kitchen buttons refresh the queue without advancing a newer ticket state", async () => {
  const previousToken = process.env.TELEGRAM_STAFF_BOT_TOKEN;
  process.env.TELEGRAM_STAFF_BOT_TOKEN = "test-token";
  let completed = 0;
  let refreshed = 0;
  const staff = { user: { roles: ["KITCHEN"], employeeId: "employee-1" } };

  try {
    const service = new TelegramStaffService(
      {} as never,
      {} as never,
      {
        getTicket: async () => ({ status: KitchenTicketStatus.READY }),
        listOrders: async () => [],
        completeTicket: async () => { completed += 1; },
      } as never,
      {} as never,
      {} as never,
      { renderWithToken: async () => { refreshed += 1; } } as never,
    );
    const kitchen = service as unknown as {
      changeKitchenTicket(chatId: string, staff: unknown, ticketId: string, action: string): Promise<void>;
    };
    await kitchen.changeKitchenTicket("chat-1", staff, "ticket-1", "n");
    await kitchen.changeKitchenTicket("chat-1", staff, "ticket-1", KitchenTicketStatus.NEW);
    assert.equal(completed, 0);
    assert.equal(refreshed, 2);

    await kitchen.changeKitchenTicket("chat-1", staff, "ticket-1", KitchenTicketStatus.READY);
    assert.equal(completed, 1);
    assert.equal(refreshed, 3);
  } finally {
    if (previousToken === undefined) delete process.env.TELEGRAM_STAFF_BOT_TOKEN;
    else process.env.TELEGRAM_STAFF_BOT_TOKEN = previousToken;
  }
});
