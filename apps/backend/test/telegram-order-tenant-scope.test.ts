import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { TelegramOrderNotificationService } from "../src/modules/telegram/telegram-order-notification.service";

function makeService(activeTenantIds: string[], orderRead: (query: unknown) => void) {
  const service = new TelegramOrderNotificationService(
    {
      restaurantTenant: { findMany: async () => activeTenantIds.map((id) => ({ id })) },
      order: { findFirst: async (query: unknown) => { orderRead(query); return null; } },
    } as never,
    {} as never,
    {} as never,
  );
  return service as unknown as {
    findOrderForMessage(orderId: string, client?: unknown, expectedTenantId?: string): Promise<unknown>;
    onModuleDestroy(): void;
  };
}

test("Telegram order notification refuses an ambiguous tenant before reading an order", async () => {
  let orderReads = 0;
  const service = makeService(["tenant-a", "tenant-b"], () => { orderReads += 1; });
  try {
    await assert.rejects(service.findOrderForMessage("order-a"), ForbiddenException);
    assert.equal(orderReads, 0);
  } finally {
    service.onModuleDestroy();
  }
});

test("Telegram order notification rejects an expected tenant that is not the active tenant", async () => {
  let orderReads = 0;
  const service = makeService(["tenant-a"], () => { orderReads += 1; });
  try {
    await assert.rejects(service.findOrderForMessage("order-b", undefined, "tenant-b"), ForbiddenException);
    assert.equal(orderReads, 0);
  } finally {
    service.onModuleDestroy();
  }
});

test("Telegram order notification query is constrained to the sole tenant branch", async () => {
  let query: unknown;
  const service = makeService(["tenant-a"], (input) => { query = input; });
  try {
    await service.findOrderForMessage("order-a");
    assert.deepEqual(query, {
      where: { id: "order-a", branch: { tenantId: "tenant-a" } },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        customerOrder: {
          include: { customer: { select: { telegramChatId: true } } },
        },
        kitchenTickets: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  } finally {
    service.onModuleDestroy();
  }
});
