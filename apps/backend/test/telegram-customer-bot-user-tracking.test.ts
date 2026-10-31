import assert from "node:assert/strict";
import test from "node:test";
import { TelegramCustomerAuthService } from "../src/modules/telegram/telegram-customer-auth.service";

function makeService(upsert: (args: unknown) => Promise<unknown>) {
  const calls: unknown[] = [];
  const prisma = {
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
    telegramBotUser: {
      upsert: async (args: unknown) => {
        calls.push(args);
        return upsert(args);
      },
    },
  };
  const ordering = {
    handleCustomerMessage: async () => false,
  };
  return {
    service: new TelegramCustomerAuthService(
      prisma as never,
      ordering as never,
      {} as never,
    ),
    calls,
  };
}

test("private bot messages create a user record without storing message text", async () => {
  const { service, calls } = makeService(async () => ({}));

  await service.handleWebhookUpdate({
    message: {
      chat: { id: 123456, type: "private" },
      from: { id: 123456, first_name: "Test" },
      text: "salom, bu matn saqlanmasin",
    },
  });

  assert.equal(calls.length, 1);
  const query = calls[0] as {
    where: unknown;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  };
  assert.deepEqual(query.where, {
    tenantId_telegramUserId: {
      tenantId: "tenant-a",
      telegramUserId: "123456",
    },
  });
  assert.equal(query.create.chatId, "123456");
  assert.equal(query.create.isBlocked, false);
  assert.equal("text" in query.create, false);
  assert.equal("first_name" in query.create, false);
  assert.equal("text" in query.update, false);
});

test("group chats are excluded from customer bot audience statistics", async () => {
  const { service, calls } = makeService(async () => ({}));

  await service.handleWebhookUpdate({
    message: {
      chat: { id: -100123, type: "group" },
      from: { id: 123456 },
      text: "salom",
    },
  });

  assert.equal(calls.length, 0);
});

test("Telegram membership events mark blocked users and new interactions reactivate them", async () => {
  const { service, calls } = makeService(async () => ({}));

  await service.handleWebhookUpdate({
    my_chat_member: {
      chat: { id: 123456, type: "private" },
      from: { id: 123456 },
      new_chat_member: { status: "kicked" },
    },
  });
  await service.handleWebhookUpdate({
    message: {
      chat: { id: 123456, type: "private" },
      from: { id: 123456 },
      text: "/start",
    },
  });

  assert.equal((calls[0] as { create: { isBlocked: boolean } }).create.isBlocked, true);
  assert.equal((calls[1] as { update: { isBlocked: boolean } }).update.isBlocked, false);
});

test("tracking database failures do not block bot message handling", async () => {
  const { service } = makeService(async () => {
    throw new Error("database unavailable");
  });

  const result = await service.handleWebhookUpdate({
    message: {
      chat: { id: 123456, type: "private" },
      from: { id: 123456 },
      text: "oddiy xabar",
    },
  });

  assert.deepEqual(result, { ok: true, handled: false });
});
