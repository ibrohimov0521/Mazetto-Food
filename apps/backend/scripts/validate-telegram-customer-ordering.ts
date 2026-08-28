import { OrderSource, OrderStatus, Prisma } from "@prisma/client";
import * as assert from "node:assert/strict";
import { TelegramCustomerOrderingService } from "../src/modules/telegram/telegram-customer-ordering.service";

type SentTelegramPayload = {
  chat_id: string;
  text?: string;
  reply_markup?: {
    inline_keyboard?: { text: string; callback_data: string }[][];
  };
};

const customer = {
  id: "customer_1",
  name: "Ali",
  phone: "+998901112233",
  bonusBalance: new Prisma.Decimal(0),
};
const category = { id: "category_sets", code: "SETS", name: "Setlar" };
const product = {
  id: "product_lavash",
  categoryId: category.id,
  isAvailable: true,
  name: "Big Lavash",
  description: "Katta lavash",
  sellingPrice: new Prisma.Decimal(36000),
};
const variant = {
  id: "variant_standard",
  productId: product.id,
  name: "Standard",
  sellingPrice: new Prisma.Decimal(36000),
  isDefault: true,
  isAvailable: true,
};
const modifier = {
  id: "modifier_cheese",
  name: "Extra cheese",
  price: new Prisma.Decimal(4000),
  isActive: true,
};
const branch = { id: "branch_sergeli", name: "MAZETTO Sergeli" };

class InMemoryPrisma {
  cartRecord: {
    id: string;
    customerId: string;
    updatedAt: Date;
    items: Array<{
      id: string;
      cartId: string;
      productId: string;
      variantId: string | null;
      quantity: Prisma.Decimal;
      modifierSnapshot: Prisma.JsonValue;
      notes: string | null;
      createdAt: Date;
    }>;
  } | null = null;
  private sequence = 0;

  customer = {
    findUnique: async ({ where }: { where: { telegramUserId?: string } }) =>
      where.telegramUserId === "tg_1" ? customer : null,
  };

  category = {
    findMany: async () => [category],
  };

  product = {
    findMany: async () => [{ ...product, variants: [variant] }],
    findFirst: async ({ where }: { where: { id: string } }) =>
      where.id === product.id
        ? {
            ...product,
            category,
            variants: [variant],
            modifiers: [{ modifierId: modifier.id, modifier }],
          }
        : null,
  };

  productVariant = {
    findFirst: async ({ where }: { where: { id: string } }) =>
      where.id === variant.id
        ? {
            ...variant,
            product: {
              ...product,
              modifiers: [{ modifierId: modifier.id, modifier }],
            },
          }
        : null,
  };

  productModifier = {
    findFirst: async ({ where }: { where: { productId: string; modifierId: string } }) =>
      where.productId === product.id && where.modifierId === modifier.id
        ? { productId: product.id, modifierId: modifier.id, modifier }
        : null,
  };

  modifier = {
    findMany: async () => [modifier],
  };

  branch = {
    findFirst: async () => branch,
  };

  cart = {
    findFirst: async () => this.enrichedCart(),
    create: async ({ data }: { data: { customerId: string } }) => {
      this.cartRecord = {
        id: "cart_1",
        customerId: data.customerId,
        updatedAt: new Date("2026-08-28T00:00:00.000Z"),
        items: [],
      };
      return { id: this.cartRecord.id };
    },
  };

  cartItem = {
    create: async ({
      data,
    }: {
      data: {
        cartId: string;
        productId: string;
        variantId: string | null;
        quantity: Prisma.Decimal;
        modifierSnapshot: Prisma.JsonValue;
      };
    }) => {
      assert.ok(this.cartRecord, "cart must exist before cart item create");
      const item = {
        id: `cart_item_${++this.sequence}`,
        cartId: data.cartId,
        productId: data.productId,
        variantId: data.variantId,
        quantity: data.quantity,
        modifierSnapshot: data.modifierSnapshot,
        notes: null,
        createdAt: new Date(Date.now() + this.sequence),
      };
      this.cartRecord.items.push(item);
      this.cartRecord.updatedAt = new Date("2026-08-28T00:01:00.000Z");
      return { id: item.id };
    },
    findFirst: async ({ where }: { where: { id: string; cart: { customerId: string } } }) =>
      this.cartRecord?.customerId === where.cart.customerId
        ? this.cartRecord.items.find((item) => item.id === where.id) ?? null
        : null,
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { quantity?: Prisma.Decimal; modifierSnapshot?: Prisma.JsonValue };
    }) => {
      const item = this.cartRecord?.items.find((candidate) => candidate.id === where.id);
      assert.ok(item, "cart item must exist before update");
      if (data.quantity) {
        item.quantity = data.quantity;
      }
      if (data.modifierSnapshot) {
        item.modifierSnapshot = data.modifierSnapshot;
      }
      this.cartRecord!.updatedAt = new Date("2026-08-28T00:02:00.000Z");
      return item;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      assert.ok(this.cartRecord, "cart must exist before delete");
      this.cartRecord.items = this.cartRecord.items.filter((item) => item.id !== where.id);
    },
    deleteMany: async ({ where }: { where: { cartId: string } }) => {
      if (this.cartRecord?.id === where.cartId) {
        this.cartRecord.items = [];
      }
      return { count: 1 };
    },
  };

  private enrichedCart() {
    if (!this.cartRecord) {
      return null;
    }

    return {
      ...this.cartRecord,
      items: this.cartRecord.items.map((item) => ({
        ...item,
        product,
        variant,
      })),
    };
  }
}

const sentTelegramPayloads: SentTelegramPayload[] = [];

globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
  sentTelegramPayloads.push(JSON.parse(String(init?.body)) as SentTelegramPayload);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as typeof fetch;

async function main(): Promise<void> {
  process.env.TELEGRAM_BOT_TOKEN = "mock-telegram-token";
  const prisma = new InMemoryPrisma();
  const engineCalls: Array<{ customerId: string; dto: unknown; source?: OrderSource }> = [];
  const orderEngine = {
    createOnlineOrder: async (customerId: string, dto: unknown, options?: { source?: OrderSource }) => {
      engineCalls.push({ customerId, dto, source: options?.source });
      return {
        order: { orderNumber: "TG-20260828-0001", status: OrderStatus.CONFIRMED },
        customerOrder: { id: "customer_order_1" },
      };
    },
  };
  const service = new TelegramCustomerOrderingService(
    prisma as never,
    orderEngine as never,
  );
  const callbackBase = {
    id: "callback_1",
    message: { chat: { id: "chat_1" } },
    from: { id: "tg_1" },
  };

  await service.sendCategoryMenu({ chat: { id: "chat_1" }, from: { id: "tg_1" } });
  assert.match(lastText(), /Menyu bo'limini tanlang/);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:cat:category_sets" });
  assert.match(lastText(), /Mahsulot tanlang/);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:prod:product_lavash" });
  assert.match(lastText(), /Big Lavash/);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:addv:variant_standard" });
  assert.match(lastText(), /savatga qo'shildi/);
  assert.equal(prisma.cartRecord?.items.length, 1);

  const cartItemId = prisma.cartRecord!.items[0]!.id;
  await service.handleCustomerCallback({ ...callbackBase, data: `cust:mod:${cartItemId}:modifier_cheese` });
  assert.deepEqual(prisma.cartRecord?.items[0]?.modifierSnapshot, [
    { modifierId: "modifier_cheese", quantity: 1 },
  ]);

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:qty:${cartItemId}:inc` });
  assert.equal(Number(prisma.cartRecord?.items[0]?.quantity), 2);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:checkout" });
  assert.match(lastText(), /Buyurtmani tasdiqlash/);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:confirm:cart_1" });
  assert.equal(engineCalls.length, 1);
  assert.equal(engineCalls[0]?.customerId, customer.id);
  assert.equal(engineCalls[0]?.source, OrderSource.TELEGRAM);
  assert.equal(prisma.cartRecord?.items.length, 0);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:confirm:cart_1" });
  assert.equal(engineCalls.length, 1, "stale duplicate confirm must not create another order");

  console.log("Telegram customer ordering validation passed");
}

function lastText(): string {
  return sentTelegramPayloads.at(-1)?.text ?? "";
}

void main();
