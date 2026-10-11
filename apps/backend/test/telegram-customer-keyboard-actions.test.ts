import assert from "node:assert/strict";
import test from "node:test";
import { TelegramCustomerOrderingService } from "../src/modules/telegram/telegram-customer-ordering.service";

function createService(customer: unknown) {
  const calls: Array<{ kind: string; value?: unknown }> = [];
  const prisma = {
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
    customer: {
      findUnique: async () => customer,
    },
    customerOrder: {
      count: async () => 4,
    },
  };
  const screen = {
    sendLinkRequired: async (target: unknown) => {
      calls.push({ kind: "link-required", value: target });
    },
    renderCustomerScreen: async (target: unknown, payload: unknown) => {
      calls.push({ kind: "screen", value: { target, payload } });
    },
  };
  const orderHistory = {
    sendOrders: async (target: unknown, linkedCustomer: unknown) => {
      calls.push({
        kind: "orders",
        value: { target, customer: linkedCustomer },
      });
    },
  };
  const service = new TelegramCustomerOrderingService(
    prisma as never,
    screen as never,
    {} as never,
    {} as never,
    {} as never,
    orderHistory as never,
  );

  return { calls, service };
}

const customer = {
  id: "customer-1",
  name: "Javohir",
  phone: "+998901234567",
  bonusBalance: "2500",
};

test("customer keyboard order history uses interactive order-history service", async () => {
  const { calls, service } = createService(customer);

  assert.equal(
    await service.handleCustomerMessage({
      chat: { id: 42 },
      from: { id: 73 },
      text: "📦 Buyurtmalarim",
    }),
    true,
  );
  assert.deepEqual(calls, [
    {
      kind: "orders",
      value: { target: { chatId: "42" }, customer },
    },
  ]);
});

test("customer keyboard profile uses the shared profile renderer", async () => {
  const { calls, service } = createService(customer);

  assert.equal(
    await service.handleCustomerMessage({
      chat: { id: 42 },
      from: { id: 73 },
      text: "👤 Profil",
    }),
    true,
  );
  assert.equal(calls[0]?.kind, "screen");
  assert.deepEqual(
    (calls[0]?.value as { target: unknown }).target,
    { chatId: "42" },
  );
  assert.match(
    JSON.stringify((calls[0]?.value as { payload: unknown }).payload),
    /Buyurtmalarim/,
  );
});

test("unlinked customer keyboard actions lead to account linking", async () => {
  const { calls, service } = createService(null);

  assert.equal(
    await service.handleCustomerMessage({
      chat: { id: 42 },
      from: { id: 73 },
      text: "📦 Buyurtmalarim",
    }),
    true,
  );
  assert.deepEqual(calls, [
    { kind: "link-required", value: { chatId: "42" } },
  ]);
});
