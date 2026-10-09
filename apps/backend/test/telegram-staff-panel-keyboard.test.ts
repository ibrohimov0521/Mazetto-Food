import assert from "node:assert/strict";
import test from "node:test";
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
