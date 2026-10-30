import assert from "node:assert/strict";
import test from "node:test";
import { TelegramStaffService } from "../src/modules/telegram/telegram-staff.service";

test("staff /help command explains account linking and role commands", async () => {
  const previousToken = process.env.TELEGRAM_STAFF_BOT_TOKEN;
  process.env.TELEGRAM_STAFF_BOT_TOKEN = "staging-staff-bot-token";
  const requests: Array<Record<string, unknown>> = [];
  const service = new TelegramStaffService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      renderWithToken: async (_token: string, _target: unknown, payload: unknown) => {
        requests.push(payload as Record<string, unknown>);
      },
    } as never,
    {} as never,
  );

  try {
    const response = await service.handleWebhookUpdate({
      message: { chat: { id: 123 }, from: { id: 456 }, text: "/help" },
    });
    assert.deepEqual(response, { ok: true, handled: true });
    assert.equal(requests.length, 1);
    const message = String(requests[0]?.text);
    assert.match(message, /Telegram ID/);
    assert.match(message, /\/courier/);
    assert.match(message, /\/cashier/);
    assert.match(message, /\/stats/);
    assert.match(message, /\/couriercash/);
  } finally {
    if (previousToken === undefined) delete process.env.TELEGRAM_STAFF_BOT_TOKEN;
    else process.env.TELEGRAM_STAFF_BOT_TOKEN = previousToken;
  }
});
