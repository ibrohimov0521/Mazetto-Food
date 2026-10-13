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
  assert.deepEqual((calls[0]?.value as { target: unknown }).target, {
    chatId: "42",
  });
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
  assert.deepEqual(calls, [{ kind: "link-required", value: { chatId: "42" } }]);
});

type CartHarnessItem = {
  id: string;
  quantity: number;
  modifierSnapshot: unknown;
};

function createCartHarness(existingItems: CartHarnessItem[] = []) {
  const mutations: Array<{ kind: "create" | "update"; data: unknown }> = [];
  const cartItem = {
    findMany: async () => existingItems,
    update: async (input: { where: { id: string }; data: unknown }) => {
      mutations.push({ kind: "update", data: input.data });
      return { id: input.where.id };
    },
    create: async (input: { data: unknown }) => {
      mutations.push({ kind: "create", data: input.data });
      return { id: "new-line" };
    },
  };
  const tx = { cartItem };
  const prisma = {
    $transaction: async (
      callback: (transaction: typeof tx) => Promise<unknown>,
    ) => callback(tx),
  };
  const cart = {
    lockTelegramCart: async () => undefined,
    getOrCreateCartForTransaction: async () => ({ id: "cart-1" }),
    lockCartLine: async () => undefined,
  };
  const service = new TelegramCustomerOrderingService(
    prisma as never,
    {} as never,
    {} as never,
    cart as never,
    {} as never,
    {} as never,
  );
  const addCartItem = (
    service as unknown as {
      addCartItem: (
        customerId: string,
        productId: string,
        variantId: string | null,
        quantity: number,
        modifiers: Array<{ modifierId: string; quantity: number }>,
      ) => Promise<{ id: string }>;
    }
  ).addCartItem.bind(service);

  return { addCartItem, mutations };
}

test("Telegram cart stores required modifier quantities on the line", async () => {
  const { addCartItem, mutations } = createCartHarness();
  await addCartItem("customer-1", "product-1", null, 1, [
    { modifierId: "modifier-a", quantity: 2 },
  ]);

  assert.equal(mutations[0]?.kind, "create");
  assert.deepEqual(
    (mutations[0]?.data as { modifierSnapshot: unknown }).modifierSnapshot,
    [{ modifierId: "modifier-a", quantity: 2 }],
  );
});

test("Telegram cart merges identical modifier selections regardless of order", async () => {
  const { addCartItem, mutations } = createCartHarness([
    {
      id: "line-1",
      quantity: 2,
      modifierSnapshot: [
        { modifierId: "modifier-a", quantity: 2 },
        { modifierId: "modifier-b", quantity: 1 },
      ],
    },
  ]);
  await addCartItem("customer-1", "product-1", null, 1, [
    { modifierId: "modifier-b", quantity: 1 },
    { modifierId: "modifier-a", quantity: 2 },
  ]);

  assert.deepEqual(
    mutations.map((mutation) => mutation.kind),
    ["update"],
  );
});

test("Telegram cart keeps different modifier selections on separate lines", async () => {
  const { addCartItem, mutations } = createCartHarness([
    {
      id: "line-1",
      quantity: 2,
      modifierSnapshot: [{ modifierId: "modifier-a", quantity: 1 }],
    },
  ]);
  await addCartItem("customer-1", "product-1", null, 1, [
    { modifierId: "modifier-a", quantity: 2 },
  ]);

  assert.deepEqual(
    mutations.map((mutation) => mutation.kind),
    ["create"],
  );
});
