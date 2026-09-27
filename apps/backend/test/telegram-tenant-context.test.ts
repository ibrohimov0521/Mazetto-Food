import assert from "node:assert/strict";
import test from "node:test";
import { TelegramController } from "../src/modules/telegram/telegram.controller";

test("Telegram webhooks drop tenant-global customer and staff actions when two tenants are active", async () => {
  const calls: string[] = [];
  const oldCustomerSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const oldStaffSecret = process.env.TELEGRAM_STAFF_WEBHOOK_SECRET;
  process.env.TELEGRAM_WEBHOOK_SECRET = "customer-secret";
  process.env.TELEGRAM_STAFF_WEBHOOK_SECRET = "staff-secret";
  try {
    const controller = new TelegramController(
      { handleWebhookUpdate: async () => { calls.push("customer"); return { ok: true, handled: true }; } } as never,
      { handleWebhook: async () => { calls.push("order"); return { ok: true, handled: true }; } } as never,
      {
        restaurantTenant: {
          findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
        },
      } as never,
      { handleWebhookUpdate: async () => { calls.push("staff"); return { ok: true, handled: true }; } } as never,
    );

    assert.deepEqual(await controller.handleWebhook("customer-secret", {}), { ok: true, handled: false });
    assert.deepEqual(await controller.handleStaffWebhook("staff-secret", {}), { ok: true, handled: false });
    assert.deepEqual(calls, []);
  } finally {
    if (oldCustomerSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
    else process.env.TELEGRAM_WEBHOOK_SECRET = oldCustomerSecret;
    if (oldStaffSecret === undefined) delete process.env.TELEGRAM_STAFF_WEBHOOK_SECRET;
    else process.env.TELEGRAM_STAFF_WEBHOOK_SECRET = oldStaffSecret;
  }
});
