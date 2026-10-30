import assert from "node:assert/strict";
import test from "node:test";
import { TelegramController } from "../src/modules/telegram/telegram.controller";

test("staff /help remains available without a linked tenant when multiple restaurants are active", async () => {
  const previousSecret = process.env.TELEGRAM_STAFF_WEBHOOK_SECRET;
  process.env.TELEGRAM_STAFF_WEBHOOK_SECRET = "test-webhook-secret";
  let tenantContextLookups = 0;
  let staffServiceCalls = 0;
  const controller = new TelegramController(
    {} as never,
    {} as never,
    {
      handleWebhookUpdate: async () => {
        staffServiceCalls += 1;
        return { ok: true, handled: true };
      },
    } as never,
    {
      resolveStaffTenantId: async () => {
        tenantContextLookups += 1;
        return null;
      },
    } as never,
  );

  try {
    const result = await controller.handleStaffWebhook("test-webhook-secret", {
      message: { chat: { id: 123 }, text: "/help" },
    });
    assert.deepEqual(result, { ok: true, handled: true });
    assert.equal(tenantContextLookups, 1);
    assert.equal(staffServiceCalls, 1);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.TELEGRAM_STAFF_WEBHOOK_SECRET;
    } else {
      process.env.TELEGRAM_STAFF_WEBHOOK_SECRET = previousSecret;
    }
  }
});
