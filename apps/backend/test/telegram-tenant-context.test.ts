import assert from "node:assert/strict";
import test from "node:test";
import { resolveSoleActiveTenantId, runWithTenantScope } from "../src/common/auth/tenant-scope";
import { TelegramController } from "../src/modules/telegram/telegram.controller";
import { TelegramTenantContextService } from "../src/modules/telegram/telegram-tenant-context.service";

function tenantContextFixture() {
  const tenants = [
    { id: "tenant-a", code: "MAZETTO_FOOD", status: "ACTIVE", feature: true, domain: true },
    { id: "tenant-b", code: "NORTH_CAFE", status: "ACTIVE", feature: true, domain: true },
    { id: "tenant-off", code: "NO_TELEGRAM", status: "ACTIVE", feature: false, domain: true },
  ];
  const contexts = new Map<string, string>();
  const staffUsers = new Map<string, {
    isActive: boolean;
    employee: null;
    tenantMemberships: Array<{ tenantId: string }>;
  }>();
  const prisma = {
    restaurantTenant: {
      findFirst: async ({ where }: { where: { id?: string; code?: string; status?: string } }) => {
        const tenant = tenants.find((item) => (!where.id || item.id === where.id) && (!where.code || item.code === where.code) && (!where.status || item.status === where.status) && item.feature && item.domain);
        return tenant ? { id: tenant.id, code: tenant.code } : null;
      },
    },
    telegramCustomerContext: {
      findUnique: async ({ where }: { where: { chatId_telegramUserId: { chatId: string; telegramUserId: string } } }) => {
        const key = `${where.chatId_telegramUserId.chatId}:${where.chatId_telegramUserId.telegramUserId}`;
        const tenantId = contexts.get(key);
        return tenantId ? { tenantId } : null;
      },
      upsert: async ({ where, create, update }: { where: { chatId_telegramUserId: { chatId: string; telegramUserId: string } }; create: { tenantId: string }; update: { tenantId: string } }) => {
        const key = `${where.chatId_telegramUserId.chatId}:${where.chatId_telegramUserId.telegramUserId}`;
        const tenantId = contexts.has(key) ? update.tenantId : create.tenantId;
        contexts.set(key, tenantId);
        return { tenantId };
      },
    },
    tenantTelegramConfiguration: {
      findUnique: async ({ where }: { where: { tenantId: string } }) => ({ staffChatId: where.tenantId === "tenant-off" ? null : "-1001234567890" }),
    },
    employee: {
      findUnique: async ({ where }: { where: { telegramUserId: string } }) =>
        where.telegramUserId === "88"
          ? { status: "ACTIVE", branch: { tenantId: "tenant-b", tenant: { status: "ACTIVE" } } }
          : null,
    },
    user: {
      findUnique: async ({ where }: { where: { telegramUserId: string } }) =>
        staffUsers.get(where.telegramUserId) ?? null,
    },
  };
  return { contexts, prisma, staffUsers };
}

test("Telegram start deep link selects and persists the verified enabled tenant", async () => {
  const fixture = tenantContextFixture();
  const service = new TelegramTenantContextService(fixture.prisma as never);
  const tenantId = await service.resolveCustomerTenantId({
    message: { chat: { id: 9001 }, from: { id: 9001 }, text: "/start t_north_cafe" },
  });

  assert.equal(tenantId, "tenant-b");
  assert.equal(fixture.contexts.get("9001:9001"), "tenant-b");
});

test("Telegram customer follow-up retains its mapped tenant after the first start", async () => {
  const fixture = tenantContextFixture();
  const service = new TelegramTenantContextService(fixture.prisma as never);
  await service.resolveCustomerTenantId({ message: { chat: { id: 9001 }, from: { id: 9001 }, text: "/start t_north_cafe" } });

  assert.equal(await service.resolveCustomerTenantId({ message: { chat: { id: 9001 }, from: { id: 9001 }, text: "🍽 Menyu" } }), "tenant-b");
});

test("invalid or disabled Telegram start payloads do not fall back to another tenant", async () => {
  const fixture = tenantContextFixture();
  const service = new TelegramTenantContextService(fixture.prisma as never);
  assert.equal(await service.resolveCustomerTenantId({ message: { chat: { id: 2 }, from: { id: 2 }, text: "/start t_no_telegram" } }), null);
  assert.equal(await service.resolveCustomerTenantId({ message: { chat: { id: 3 }, from: { id: 3 }, text: "/start arbitrary-value" } }), null);
  assert.equal(fixture.contexts.size, 0);
});

test("Telegram without a tenant deep link preserves legacy Mazetto Food routing", async () => {
  const fixture = tenantContextFixture();
  const service = new TelegramTenantContextService(fixture.prisma as never);
  assert.equal(await service.resolveCustomerTenantId({ message: { chat: { id: 1 }, from: { id: 1 }, text: "/start" } }), "tenant-a");
});

test("a disabled mapped tenant never silently reroutes a customer to Mazetto Food", async () => {
  const fixture = tenantContextFixture();
  fixture.contexts.set("4:4", "tenant-off");
  const service = new TelegramTenantContextService(fixture.prisma as never);

  assert.equal(await service.resolveCustomerTenantId({ message: { chat: { id: 4 }, from: { id: 4 }, text: "🍽 Menyu" } }), null);
  assert.equal(fixture.contexts.get("4:4"), "tenant-off");
});

test("staff Telegram updates resolve from the employee's active branch tenant", async () => {
  const fixture = tenantContextFixture();
  const service = new TelegramTenantContextService(fixture.prisma as never);
  assert.equal(await service.resolveStaffTenantId({ message: { chat: { id: 99 }, from: { id: 88 }, text: "/staff" } }), "tenant-b");
});



test("owner staff commands resolve only a unique active tenant membership", async () => {
  const fixture = tenantContextFixture();
  fixture.staffUsers.set("77", {
    isActive: true,
    employee: null,
    tenantMemberships: [{ tenantId: "tenant-a" }],
  });
  fixture.staffUsers.set("78", {
    isActive: true,
    employee: null,
    tenantMemberships: [{ tenantId: "tenant-a" }, { tenantId: "tenant-b" }],
  });
  fixture.staffUsers.set("79", {
    isActive: false,
    employee: null,
    tenantMemberships: [{ tenantId: "tenant-a" }],
  });
  const service = new TelegramTenantContextService(fixture.prisma as never);

  assert.equal(await service.resolveStaffTenantId({ message: { from: { id: 77 } } }), "tenant-a");
  assert.equal(await service.resolveStaffTenantId({ message: { from: { id: 78 } } }), null);
  assert.equal(await service.resolveStaffTenantId({ message: { from: { id: 79 } } }), null);
});

test("webhooks run tenant services inside the selected tenant scope", async () => {
  const oldSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  process.env.TELEGRAM_WEBHOOK_SECRET = "customer-secret";
  try {
    const active = new Set(["tenant-a", "tenant-b"]);
    const scopeDb = {
      restaurantTenant: {
        findFirst: async ({ where }: { where: { id: string; status: string } }) => active.has(where.id) ? { id: where.id } : null,
        findMany: async () => { throw new Error("Ambiguous tenant fallback must not run."); },
      },
    } as never;
    let routedTenant = "";
    const controller = new TelegramController(
      { handleWebhookUpdate: async () => {
        routedTenant = await resolveSoleActiveTenantId(scopeDb);
        return { ok: true, handled: true };
      } } as never,
      { handleWebhook: async () => ({ ok: true, handled: false }) } as never,
      undefined,
      { resolveCustomerTenantId: async () => "tenant-b" } as never,
    );
    assert.deepEqual(await controller.handleWebhook("customer-secret", { message: { text: "🍽 Menyu" } }), { ok: true, handled: true });
    assert.equal(routedTenant, "tenant-b");
  } finally {
    if (oldSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
    else process.env.TELEGRAM_WEBHOOK_SECRET = oldSecret;
  }
});

test("the scoped tenant is revalidated as active for every request", async () => {
  const database = {
    restaurantTenant: { findFirst: async () => null, findMany: async () => [] },
  } as never;
  await assert.rejects(
    runWithTenantScope("tenant-archived", () => resolveSoleActiveTenantId(database)),
    /not active/i,
  );
});
