import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { PlatformTenantTelegramService } from "../src/modules/platform-monitoring/platform-tenant-telegram.service";

function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return run().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("tenant Telegram settings use the legacy main group without exposing bot secrets", async () => {
  await withEnv({
    TELEGRAM_BOT_TOKEN: "test-private-token",
    TELEGRAM_WEBHOOK_SECRET: "test-private-webhook-secret",
    TELEGRAM_STAFF_CHAT_ID: "-1001234567890",
    TELEGRAM_BOT_USERNAME: "mazetto_customer_bot",
  }, async () => {
    const service = new PlatformTenantTelegramService({
      restaurantTenant: { findUnique: async () => ({
        id: "tenant-main",
        code: "MAZETTO_FOOD",
        status: "ACTIVE",
        features: [{ isEnabled: true }],
      }) },
      tenantTelegramConfiguration: { findUnique: async () => null },
    } as never);

    const settings = await service.get("tenant-main");
    assert.equal(settings.staffChatId, "-1001234567890");
    assert.equal(settings.staffNotificationsReady, true);
    assert.equal(settings.ready, true);
    assert.equal(settings.customerBotLink, "https://t.me/mazetto_customer_bot?start=t_mazetto_food");
    assert.doesNotMatch(JSON.stringify(settings), /test-private-token|test-private-webhook-secret/);
  });
});

test("tenant Telegram group changes are audited atomically", async () => {
  const auditRows: Array<Record<string, unknown>> = [];
  let savedChatId: string | null = null;
  const transaction = {
    tenantTelegramConfiguration: {
      upsert: async ({ create, update }: { create: { staffChatId: string | null }; update: { staffChatId: string | null } }) => {
        savedChatId = create.staffChatId ?? update.staffChatId;
        return { staffChatId: savedChatId };
      },
    },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { auditRows.push(data); } },
  };
  const service = new PlatformTenantTelegramService({
    restaurantTenant: { findUnique: async () => ({
      id: "tenant-north",
      code: "NORTH_CAFE",
      status: "PROVISIONING",
      features: [{ isEnabled: false }],
    }) },
    tenantTelegramConfiguration: { findUnique: async () => savedChatId ? { staffChatId: savedChatId, updatedAt: new Date("2026-10-24T00:00:00Z") } : null },
    $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
  } as never);

  const result = await service.update("tenant-north", { staffChatId: "-1001234567890" }, { id: "platform-owner" } as never);
  assert.equal(result.staffChatId, "-1001234567890");
  assert.equal(auditRows.length, 1);
  const [auditRow] = auditRows;
  assert.ok(auditRow);
  assert.equal(auditRow.action, "PLATFORM_TENANT_TELEGRAM_UPDATED");
  assert.deepEqual(auditRow.metadata, {
    tenantId: "tenant-north",
    code: "NORTH_CAFE",
    staffChatIdConfigured: true,
  });
});

test("an enabled Telegram channel cannot lose its staff group", async () => {
  await withEnv({ TELEGRAM_STAFF_CHAT_ID: undefined }, async () => {
    const service = new PlatformTenantTelegramService({
      restaurantTenant: { findUnique: async () => ({ id: "tenant-north", code: "NORTH_CAFE" }) },
      tenantFeature: { findUnique: async () => ({ isEnabled: true }) },
      $transaction: async () => { throw new Error("should not start a transaction"); },
    } as never);

    await assert.rejects(
      service.update("tenant-north", { staffChatId: null }, { id: "platform-owner" } as never),
      BadRequestException,
    );
  });
});
