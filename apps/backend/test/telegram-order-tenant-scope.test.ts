import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { TelegramOrderNotificationService } from "../src/modules/telegram/telegram-order-notification.service";

function makeService(activeTenantIds: string[], orderRead: (query: unknown) => void) {
  const service = new TelegramOrderNotificationService(
    {
      restaurantTenant: {
        findMany: async () => activeTenantIds.map((id) => ({ id })),
        findFirst: async ({ where }: { where: { id: string } }) => activeTenantIds.includes(where.id) ? { id: where.id } : null,
      },
      order: {
        findUnique: async () => ({ branch: { tenantId: "tenant-a" } }),
        findFirst: async (query: unknown) => { orderRead(query); return null; },
      },
    } as never,
    {} as never,
    {} as never,
  );
  return service as unknown as {
    findOrderForMessage(orderId: string, client?: unknown, expectedTenantId?: string): Promise<unknown>;
  };
}

const expectedQuery = (tenantId: string) => ({
  where: { id: "order-a", branch: { tenantId } },
  include: {
    items: { orderBy: { createdAt: "asc" } },
    customerOrder: {
      include: { customer: { select: { telegramChatId: true } } },
    },
    kitchenTickets: { orderBy: { createdAt: "desc" }, take: 1 },
  },
});

test("Telegram order notification refuses an ambiguous unscoped tenant before reading an order", async () => {
  let orderReads = 0;
  const service = makeService(["tenant-a", "tenant-b"], () => { orderReads += 1; });
  await assert.rejects(service.findOrderForMessage("order-a"), ForbiddenException);
  assert.equal(orderReads, 0);
});

test("Telegram notification accepts an explicit active tenant and constrains the order query", async () => {
  let query: unknown;
  const service = makeService(["tenant-a", "tenant-b"], (input) => { query = input; });
  await service.findOrderForMessage("order-a", undefined, "tenant-b");
  assert.deepEqual(query, expectedQuery("tenant-b"));
});

test("Telegram notification rejects an expected tenant that is not active", async () => {
  let orderReads = 0;
  const service = makeService(["tenant-a"], () => { orderReads += 1; });
  await assert.rejects(service.findOrderForMessage("order-a", undefined, "tenant-b"), ForbiddenException);
  assert.equal(orderReads, 0);
});

test("unscoped single-tenant notifications remain tenant-constrained for compatibility", async () => {
  let query: unknown;
  const service = makeService(["tenant-a"], (input) => { query = input; });
  await service.findOrderForMessage("order-a");
  assert.deepEqual(query, expectedQuery("tenant-a"));
});
