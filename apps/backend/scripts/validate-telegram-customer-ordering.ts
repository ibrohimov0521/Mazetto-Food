import { CustomerOrderType, OrderSource, OrderStatus, Prisma } from "@prisma/client";
import * as assert from "node:assert/strict";
import { TelegramCustomerOrderingService } from "../src/modules/telegram/telegram-customer-ordering.service";

type SentTelegramPayload = {
  method?: string;
  chat_id: string;
  message_id?: number;
  text?: string;
  reply_markup?: {
    inline_keyboard?: { text: string; callback_data?: string; url?: string }[][];
    keyboard?: string[][];
  };
};
type EngineCall = {
  customerId: string;
  dto: {
    branchId: string;
    type: string;
    address?: string;
    paymentMethod: string;
    notes?: string;
    items: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      modifiers?: Array<{ modifierId: string; quantity: number }>;
    }>;
  };
  source?: OrderSource;
};
type StaffNotificationCall = {
  orderId: string;
};

const customer = {
  id: "customer_1",
  name: "Ali",
  phone: "+998901112233",
  bonusBalance: new Prisma.Decimal(0),
};
const category = { id: "category_sets", code: "SETS", name: "Setlar" };
const lavashCategory = { id: "category_lavash", code: "LAVASH", name: "Lavash" };
const chickenLavashCategory = {
  id: "category_chicken_lavash",
  code: "CHICKEN_LAVASH",
  name: "Tovuqli lavash",
};
const burgerCategory = { id: "category_burger", code: "BURGER", name: "Burgerlar" };
const chickenBurgerCategory = {
  id: "category_chicken_burger",
  code: "CHICKEN_BURGER",
  name: "Tovuqli burgerlar",
};
const sauceCategory = { id: "category_sauces", code: "SAUCES", name: "Souslar" };
const drinksCategory = { id: "category_drinks", code: "DRINKS", name: "Ichimliklar" };
const product = {
  id: "product_lavash",
  categoryId: category.id,
  code: "BIG_LAVASH",
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
const miniLavashProduct = {
  ...product,
  id: "product_mini_lavash",
  categoryId: lavashCategory.id,
  code: "MINI_LAVASH",
  name: "Mini lavash",
  sellingPrice: new Prisma.Decimal(24000),
};
const beefLavashProduct = {
  ...product,
  id: "product_beef_lavash",
  categoryId: lavashCategory.id,
  code: "BEEF_LAVASH",
  name: "Mol go'shtli lavash",
  sellingPrice: new Prisma.Decimal(34000),
};
const chickenLavashProduct = {
  ...product,
  id: "product_chicken_lavash",
  categoryId: lavashCategory.id,
  code: "CHICKEN_LAVASH",
  name: "Kurinniy Lavash",
  sellingPrice: new Prisma.Decimal(28000),
};
const canonicalLavashProducts = [
  {
    ...product,
    id: "product_classic_lavash",
    categoryId: lavashCategory.id,
    code: "CLASSIC_LAVASH",
    name: "Lavash",
    sellingPrice: new Prisma.Decimal(32000),
  },
  {
    ...product,
    id: "product_big_lavash",
    categoryId: lavashCategory.id,
    code: "BIG_LAVASH",
    name: "Big Lavash",
    sellingPrice: new Prisma.Decimal(36000),
  },
  {
    ...product,
    id: "product_lavash_cheese",
    categoryId: lavashCategory.id,
    code: "LAVASH_CHEESE",
    name: "Lavash Pishloqli",
    sellingPrice: new Prisma.Decimal(35000),
  },
  {
    ...product,
    id: "product_big_lavash_cheese",
    categoryId: lavashCategory.id,
    code: "BIG_LAVASH_CHEESE",
    name: "Big Lavash Pishloqli",
    sellingPrice: new Prisma.Decimal(39000),
  },
  {
    ...product,
    id: "product_lavash_spicy",
    categoryId: lavashCategory.id,
    code: "LAVASH_SPICY",
    name: "Achchiq Lavash",
    sellingPrice: new Prisma.Decimal(34000),
  },
  {
    ...product,
    id: "product_big_lavash_spicy",
    categoryId: lavashCategory.id,
    code: "BIG_LAVASH_SPICY",
    name: "Achchiq Big Lavash",
    sellingPrice: new Prisma.Decimal(39000),
  },
  {
    ...product,
    id: "product_tandir_lavash",
    categoryId: lavashCategory.id,
    code: "TANDIR_LAVASH",
    name: "Tandir Lavash",
    sellingPrice: new Prisma.Decimal(43000),
  },
  {
    ...product,
    id: "product_tandir_lavash_cheese",
    categoryId: lavashCategory.id,
    code: "TANDIR_LAVASH_CHEESE",
    name: "Tandir Lavash Pishloqli",
    sellingPrice: new Prisma.Decimal(45000),
  },
  chickenLavashProduct,
  {
    ...product,
    id: "product_big_chicken_lavash",
    categoryId: lavashCategory.id,
    code: "BIG_CHICKEN_LAVASH",
    name: "Kurinniy Big Lavash",
    sellingPrice: new Prisma.Decimal(32000),
  },
  {
    ...product,
    id: "product_chicken_cheese_lavash",
    categoryId: lavashCategory.id,
    code: "CHICKEN_CHEESE_LAVASH",
    name: "Kurinniy Lavash Pishloqli",
    sellingPrice: new Prisma.Decimal(31000),
  },
  {
    ...product,
    id: "product_big_chicken_lavash_cheese",
    categoryId: lavashCategory.id,
    code: "BIG_CHICKEN_LAVASH_CHEESE",
    name: "Kurinniy Big Lavash Pishloqli",
    sellingPrice: new Prisma.Decimal(35000),
  },
  {
    ...product,
    id: "product_chicken_spicy_lavash",
    categoryId: lavashCategory.id,
    code: "CHICKEN_SPICY_LAVASH",
    name: "Achchiq Kurinniy Lavash",
    sellingPrice: new Prisma.Decimal(31000),
  },
  {
    ...product,
    id: "product_big_chicken_spicy_lavash",
    categoryId: lavashCategory.id,
    code: "BIG_CHICKEN_SPICY_LAVASH",
    name: "Achchiq Kurinniy Big Lavash",
    sellingPrice: new Prisma.Decimal(35000),
  },
];
const classicBurgerProduct = {
  ...product,
  id: "product_classic_burger",
  categoryId: burgerCategory.id,
  code: "CLASSIC_BURGER",
  name: "Klassik burger",
  sellingPrice: new Prisma.Decimal(29000),
};
const bigBurgerProduct = {
  ...product,
  id: "product_big_burger",
  categoryId: burgerCategory.id,
  code: "BIG_BURGER",
  name: "Katta burger",
  sellingPrice: new Prisma.Decimal(39000),
};
const chickenBurgerProduct = {
  ...product,
  id: "product_chicken_burger",
  categoryId: burgerCategory.id,
  code: "CHICKEN_BURGER",
  name: "Chicken Burger",
  sellingPrice: new Prisma.Decimal(26000),
};
const crispyChickenBurgerProduct = {
  ...product,
  id: "product_crispy_chicken_burger",
  categoryId: chickenBurgerCategory.id,
  code: "CRISPY_CHICKEN_BURGER",
  name: "Qarsildoq tovuqli burger",
  sellingPrice: new Prisma.Decimal(33000),
};
const canonicalBurgerProducts = [
  {
    ...classicBurgerProduct,
    name: "Burger",
  },
  {
    ...product,
    id: "product_cheeseburger",
    categoryId: burgerCategory.id,
    code: "CHEESEBURGER",
    name: "Chizburger",
    sellingPrice: new Prisma.Decimal(32000),
  },
  {
    ...product,
    id: "product_double_burger",
    categoryId: burgerCategory.id,
    code: "DOUBLE_BURGER",
    name: "Double Burger",
    sellingPrice: new Prisma.Decimal(42000),
  },
  {
    ...product,
    id: "product_double_cheeseburger",
    categoryId: burgerCategory.id,
    code: "DOUBLE_CHEESEBURGER",
    name: "Double Chizburger",
    sellingPrice: new Prisma.Decimal(46000),
  },
  chickenBurgerProduct,
  {
    ...product,
    id: "product_chicken_cheeseburger",
    categoryId: burgerCategory.id,
    code: "CHICKEN_CHEESEBURGER",
    name: "Chicken Chizburger",
    sellingPrice: new Prisma.Decimal(29000),
  },
  {
    ...product,
    id: "product_double_chicken_burger",
    categoryId: burgerCategory.id,
    code: "DOUBLE_CHICKEN_BURGER",
    name: "Double Chicken Burger",
    sellingPrice: new Prisma.Decimal(37000),
  },
  {
    ...product,
    id: "product_double_chicken_cheeseburger",
    categoryId: burgerCategory.id,
    code: "DOUBLE_CHICKEN_CHEESEBURGER",
    name: "Double Chicken Chizburger",
    sellingPrice: new Prisma.Decimal(41000),
  },
];
const sauceProduct = {
  ...product,
  id: "product_house_sauce",
  categoryId: sauceCategory.id,
  code: "HOUSE_SAUCE",
  name: "Maxsus sous",
  sellingPrice: new Prisma.Decimal(3000),
};
const drinkProduct = {
  ...product,
  id: "product_cola",
  categoryId: drinksCategory.id,
  code: "COCA_COLA",
  name: "Coca-Cola",
  sellingPrice: new Prisma.Decimal(12000),
};
const products = [
  product,
  ...canonicalLavashProducts,
  ...canonicalBurgerProducts,
  miniLavashProduct,
  beefLavashProduct,
  classicBurgerProduct,
  bigBurgerProduct,
  crispyChickenBurgerProduct,
  sauceProduct,
  drinkProduct,
];
const paginatedCategory = { id: "category_paginated", code: "PAGED", name: "Ko'p mahsulot" };
const paginatedProducts = Array.from({ length: 11 }, (_, index) => ({
  ...product,
  id: `product_page_${index + 1}`,
  categoryId: paginatedCategory.id,
  code: `PAGED_${index + 1}`,
  name: `Page product ${index + 1}`,
  sellingPrice: new Prisma.Decimal(10000 + index),
}));
const allProducts = [...products, ...paginatedProducts];
const allCategories = [
  category,
  paginatedCategory,
  lavashCategory,
  chickenLavashCategory,
  burgerCategory,
  chickenBurgerCategory,
  sauceCategory,
  drinksCategory,
];
function categoryForProduct(productId: string) {
  const foundProduct = allProducts.find((candidate) => candidate.id === productId) ?? product;

  return allCategories.find((item) => item.id === foundProduct.categoryId) ?? category;
}
const modifier = {
  id: "modifier_cheese",
  name: "Extra cheese",
  price: new Prisma.Decimal(4000),
  isActive: true,
};
const branch = {
  id: "branch_sergeli",
  name: "MAZETTO Sergeli",
  acceptsOrders: true,
  deliveryEnabled: true,
  pickupEnabled: true,
  isTemporarilyClosed: false,
  address: "Sergeli 7/3",
  latitude: new Prisma.Decimal("41.1970731"),
  longitude: new Prisma.Decimal("69.2038921"),
};
const deliveryDisabledBranch = {
  ...branch,
  deliveryEnabled: false,
};

class InMemoryPrisma {
  branchRecord = { ...branch };
  checkoutSession: {
    id: string;
    customerId: string;
    chatId: string;
    step: string;
    branchId: string | null;
    orderType: CustomerOrderType | null;
    address: string | null;
    note: string | null;
    expiresAt: Date;
    updatedAt: Date;
  } | null = null;
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
  private transactionQueue = Promise.resolve();

  customer = {
    findUnique: async ({ where }: { where: { telegramUserId?: string } }) =>
      where.telegramUserId === "tg_1" ? customer : null,
  };

  category = {
    findMany: async () => allCategories,
    findFirst: async ({ where }: { where: { id: string } }) =>
      allCategories.find((candidate) => candidate.id === where.id) ?? null,
  };

  product = {
    findMany: async ({
      where,
      skip,
      take,
    }: {
      where?: { categoryId?: string; code?: { in: string[] }; isAvailable?: boolean };
      skip?: number;
      take?: number;
    } = {}) => {
      const candidates = allProducts.filter((candidate) => {
        if (where?.categoryId && candidate.categoryId !== where.categoryId) {
          return false;
        }

        if (where?.code?.in && !where.code.in.includes(candidate.code)) {
          return false;
        }

        return true;
      });

      return candidates.slice(skip ?? 0, take ? (skip ?? 0) + take : undefined).map((candidate) => ({
        ...candidate,
        category: categoryForProduct(candidate.id),
        modifiers: this.productModifiers(candidate.id),
        variants: [{
          ...variant,
          id: `${candidate.id}_standard`,
          productId: candidate.id,
          sellingPrice: candidate.sellingPrice,
        }],
      }));
    },
    findFirst: async ({ where }: { where: { id: string } }) =>
      allProducts.some((candidate) => candidate.id === where.id)
        ? {
            ...(allProducts.find((candidate) => candidate.id === where.id) ?? product),
            category: categoryForProduct(where.id),
            variants: [{
              ...variant,
              id: `${where.id}_standard`,
              productId: where.id,
              sellingPrice: (allProducts.find((candidate) => candidate.id === where.id) ?? product).sellingPrice,
            }],
            modifiers: this.productModifiers(where.id),
          }
        : null,
  };

  productVariant = {
    findFirst: async ({ where }: { where: { id: string } }) =>
      allProducts.some((candidate) => where.id === `${candidate.id}_standard`) || where.id === variant.id
        ? {
            ...variant,
            id: where.id,
            productId: where.id === variant.id ? product.id : where.id.replace(/_standard$/, ""),
            sellingPrice: (
              allProducts.find((candidate) => candidate.id === where.id.replace(/_standard$/, "")) ?? product
            ).sellingPrice,
            product: {
              ...(allProducts.find((candidate) => candidate.id === where.id.replace(/_standard$/, "")) ?? product),
              modifiers: this.productModifiers(where.id.replace(/_standard$/, "")),
            },
          }
        : null,
  };

  private productModifiers(productId: string) {
    const foundProduct = allProducts.find((candidate) => candidate.id === productId);
    const categoryCode = foundProduct ? categoryForProduct(foundProduct.id).code : null;

    return productId === product.id || categoryCode === "LAVASH" || categoryCode === "BURGER"
      ? [{ modifierId: modifier.id, modifier }]
      : [];
  }

  productModifier = {
    findFirst: async ({ where }: { where: { productId: string; modifierId: string } }) =>
      this.productModifiers(where.productId).some((item) => item.modifierId === where.modifierId)
        ? { productId: where.productId, modifierId: modifier.id, modifier }
        : null,
  };

  modifier = {
    findMany: async () => [modifier],
  };

  branch = {
    findMany: async () =>
      this.branchRecord.acceptsOrders &&
      !this.branchRecord.isTemporarilyClosed &&
      (this.branchRecord.pickupEnabled || this.branchRecord.deliveryEnabled)
        ? [this.branchRecord]
        : [],
    findUnique: async ({ where }: { where: { id: string } }) =>
      where.id === this.branchRecord.id ? this.branchRecord : null,
  };

  telegramCheckoutSession = {
    findFirst: async ({ where }: { where: { customerId: string; chatId: string; expiresAt: { gt: Date } } }) =>
      this.checkoutSession?.customerId === where.customerId &&
      this.checkoutSession.chatId === where.chatId &&
      this.checkoutSession.expiresAt > where.expiresAt.gt
        ? this.checkoutSession
        : null,
    upsert: async ({
      create,
      update,
    }: {
      create: NonNullable<InMemoryPrisma["checkoutSession"]>;
      update: Partial<NonNullable<InMemoryPrisma["checkoutSession"]>>;
    }) => {
      if (!this.checkoutSession) {
        this.checkoutSession = { ...create, id: "telegram_checkout_1" };
      } else {
        this.checkoutSession = { ...this.checkoutSession, ...update, updatedAt: new Date() };
      }

      return this.checkoutSession;
    },
    delete: async () => {
      this.checkoutSession = null;
    },
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
    findMany: async ({
      where,
    }: {
      where: { cartId: string; productId: string; variantId: string | null; notes: null };
    }) =>
      this.cartRecord?.id === where.cartId
        ? this.cartRecord.items.filter(
            (item) =>
              item.productId === where.productId &&
              item.variantId === where.variantId &&
              item.notes === where.notes,
          )
        : [],
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

  $executeRaw = async () => 1;

  $transaction = async <T>(callback: (tx: this) => Promise<T>) => {
    const previous = this.transactionQueue;
    let release!: () => void;
    this.transactionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await callback(this);
    } finally {
      release();
    }
  };

  private enrichedCart() {
    if (!this.cartRecord) {
      return null;
    }

    return {
      ...this.cartRecord,
      items: this.cartRecord.items.map((item) => ({
        ...item,
        product: {
          ...(allProducts.find((candidate) => candidate.id === item.productId) ?? product),
          modifiers: this.productModifiers(item.productId),
        },
        variant: {
          ...variant,
          id: item.variantId ?? variant.id,
          productId: item.productId,
        },
      })),
    };
  }
}

const sentTelegramPayloads: SentTelegramPayload[] = [];

globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
  const method = String(_url).split("/").at(-1);
  sentTelegramPayloads.push({
    ...(JSON.parse(String(init?.body)) as SentTelegramPayload),
    ...(method ? { method } : {}),
  });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as typeof fetch;

async function main(): Promise<void> {
  process.env.TELEGRAM_BOT_TOKEN = "mock-telegram-token";
  await testFlattenedCategoryNavigation();
  await testAllCategoriesSinglePage();
  await testSimpleSauceAndDrinkQuickAdd();
  await testDirectProductQuickAdd();
  await testQuickAddMerge();
  await testCartQuantityOnlyControls();
  await testConfiguredItemSeparation();
  await testBranchLocation();
  await testDeliveryFlow();
  await testDeliveryNoteFlow();
  await testPickupRegression();
  await testDeliveryDisabled();
  console.log("Telegram customer ordering validation passed");
}

async function testSimpleSauceAndDrinkQuickAdd(): Promise<void> {
  sentTelegramPayloads.length = 0;
  const prisma = new InMemoryPrisma();
  const { service, callbackBase } = createService(prisma);

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:cat:${sauceCategory.id}` });
  assert.match(lastText(), /Mahsulot tanlang/);
  assert.ok(lastKeyboardText().includes("➕ Maxsus sous"));
  assert.ok(lastKeyboardText().includes("🛒 Savat"));

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:qprod:${sauceProduct.id}:${sauceCategory.id}:1` });
  assert.equal(prisma.cartRecord?.items.length, 1);
  assert.equal(prisma.cartRecord?.items[0]?.productId, sauceProduct.id);
  assert.equal(prisma.cartRecord?.items[0]?.variantId, `${sauceProduct.id}_standard`);
  assert.match(lastText(), /Mahsulot tanlang/);
  assert.ok(lastKeyboardText().includes("🛒 Savat (1)"));
  assert.ok(
    sentTelegramPayloads.some(
      (payload) => payload.method === "answerCallbackQuery" && payload.text === "Savatga qo'shildi ✅",
    ),
  );

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:qprod:${sauceProduct.id}:${sauceCategory.id}:1` });
  assert.equal(prisma.cartRecord?.items.length, 1);
  assert.equal(prisma.cartRecord?.items[0]?.quantity.toNumber(), 2);

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:cat:${drinksCategory.id}` });
  assert.ok(lastKeyboardText().includes("➕ Coca-Cola"));
  await service.handleCustomerCallback({ ...callbackBase, data: `cust:qprod:${drinkProduct.id}:${drinksCategory.id}:1` });
  assert.equal(prisma.cartRecord?.items.length, 2);
  assert.equal(prisma.cartRecord?.items[1]?.productId, drinkProduct.id);
}

async function testAllCategoriesSinglePage(): Promise<void> {
  sentTelegramPayloads.length = 0;
  const prisma = new InMemoryPrisma();
  const { service, callbackBase } = createService(prisma);

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:cat:${paginatedCategory.id}` });
  assert.equal(lastMethod(), "editMessageText");
  assert.match(lastText(), /Mahsulot tanlang/);
  const productButtons = lastProductButtonTexts();
  assert.ok(productButtons.some((text) => text.includes("Page product 1 ·")));
  assert.ok(productButtons.some((text) => text.includes("Page product 8 ·")));
  assert.ok(productButtons.some((text) => text.includes("Page product 9 ·")));
  assert.ok(productButtons.some((text) => text.includes("Page product 11 ·")));
  assert.equal(productButtons.length, 11);
  assert.equal(new Set(productButtons).size, productButtons.length);
  assertNoPaginationControls();
}

async function testFlattenedCategoryNavigation(): Promise<void> {
  sentTelegramPayloads.length = 0;
  const prisma = new InMemoryPrisma();
  const { service, callbackBase } = createService(prisma);

  await service.sendCategoryMenu({ chat: { id: "chat_1" }, from: { id: "tg_1" } });
  assert.match(lastText(), /Menyu bo'limini tanlang/);
  const menuButtons = lastKeyboardText();
  assert.equal((menuButtons.match(/🌯 Lavash/g) ?? []).length, 1);
  assert.equal((menuButtons.match(/🍔 Burger/g) ?? []).length, 1);
  assert.ok(!menuButtons.includes("Tovuqli lavash"));
  assert.ok(!menuButtons.includes("Tovuqli burgerlar"));

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:cat:${lavashCategory.id}` });
  assert.equal(lastMethod(), "editMessageText");
  assert.match(lastText(), /Lavashlar/);
  assert.ok(!lastKeyboardText().includes("Keyingi"));
  assert.ok(!lastKeyboardText().includes("1+"));
  assert.ok(!lastKeyboardText().includes("Xaggi"));
  assert.ok(!lastText().includes("Go'sht turini tanlang"));
  assert.deepEqual(normalizedLastProductButtonTexts(), [
    "Lavash · 32 000 so'm",
    "Kurinniy Lavash · 28 000 so'm",
    "Big Lavash · 36 000 so'm",
    "Kurinniy Big · 32 000 so'm",
    "Pishloqli · 35 000 so'm",
    "Kurinniy Pishloqli · 31 000 so'm",
    "Big Pishloqli · 39 000 so'm",
    "Kurinniy Big Pishloqli · 35 000 so'm",
    "Achchiq Lavash · 34 000 so'm",
    "Achchiq Kurinniy · 31 000 so'm",
    "Achchiq Big · 39 000 so'm",
    "Achchiq Kurinniy Big · 35 000 so'm",
    "Tandir Lavash · 43 000 so'm",
    "Tandir Pishloqli · 45 000 so'm",
  ]);

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:cat:${burgerCategory.id}` });
  assert.equal(lastMethod(), "editMessageText");
  assert.match(lastText(), /Burgerlar/);
  assert.ok(!lastKeyboardText().includes("Keyingi"));
  assert.ok(!lastText().includes("Go'sht turini tanlang"));
  assert.deepEqual(normalizedLastProductButtonTexts(), [
    "Burger · 29 000 so'm",
    "Chicken Burger · 26 000 so'm",
    "Chizburger · 32 000 so'm",
    "Chicken Chizburger · 29 000 so'm",
    "Double Burger · 42 000 so'm",
    "Double Chicken · 37 000 so'm",
    "Double Chizburger · 46 000 so'm",
    "Double Chicken Chizburger · 41 000 so'm",
  ]);
}

async function testDirectProductQuickAdd(): Promise<void> {
  sentTelegramPayloads.length = 0;
  const prisma = new InMemoryPrisma();
  const { service, callbackBase } = createService(prisma);

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:cat:${burgerCategory.id}` });
  assert.ok(normalizedLastKeyboardText().includes("Chicken Burger · 26 000 so'm"));
  assert.ok(!lastKeyboardText().includes("Standart"));

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:qprod:${chickenBurgerProduct.id}:${burgerCategory.id}:1` });
  assert.equal(prisma.cartRecord?.items.length, 1);
  assert.equal(prisma.cartRecord?.items[0]?.productId, chickenBurgerProduct.id);
  assert.equal(prisma.cartRecord?.items[0]?.quantity.toNumber(), 1);
  assert.ok(
    sentTelegramPayloads.some(
      (payload) =>
        payload.method === "answerCallbackQuery" &&
        payload.text === "Savatga qo'shildi ✅",
    ),
  );
  assert.match(lastText(), /Burgerlar/);
  assert.ok(lastKeyboardText().includes("Savat (1)"));
  assert.ok(!lastText().includes("Standart"));
  assert.ok(!lastKeyboardText().includes("−"));
  assert.ok(!lastKeyboardText().includes("+"));

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:cart" });
  assert.ok(lastKeyboardText().includes("−"));
  assert.ok(lastKeyboardText().includes("+"));
  assertCartHasOnlyQuantityControls();
}

async function testQuickAddMerge(): Promise<void> {
  sentTelegramPayloads.length = 0;
  const prisma = new InMemoryPrisma();
  const { service, callbackBase } = createService(prisma);

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:qprod:${sauceProduct.id}:${sauceCategory.id}:1` });
  await service.handleCustomerCallback({ ...callbackBase, data: `cust:qprod:${sauceProduct.id}:${sauceCategory.id}:1` });
  assert.equal(prisma.cartRecord?.items.length, 1);
  assert.equal(prisma.cartRecord?.items[0]?.quantity.toNumber(), 2);

  const concurrentPrisma = new InMemoryPrisma();
  const { service: concurrentService, callbackBase: concurrentCallbackBase } =
    createService(concurrentPrisma);
  await Promise.all([
    concurrentService.handleCustomerCallback({
      ...concurrentCallbackBase,
      id: "callback_merge_a",
      data: `cust:qprod:${sauceProduct.id}:${sauceCategory.id}:1`,
    }),
    concurrentService.handleCustomerCallback({
      ...concurrentCallbackBase,
      id: "callback_merge_b",
      data: `cust:qprod:${sauceProduct.id}:${sauceCategory.id}:1`,
    }),
  ]);
  assert.equal(concurrentPrisma.cartRecord?.items.length, 1);
  assert.equal(concurrentPrisma.cartRecord?.items[0]?.quantity.toNumber(), 2);
}

async function testCartQuantityOnlyControls(): Promise<void> {
  sentTelegramPayloads.length = 0;
  const prisma = new InMemoryPrisma();
  const { service, callbackBase } = createService(prisma);

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:qprod:${sauceProduct.id}:${sauceCategory.id}` });
  await service.handleCustomerCallback({ ...callbackBase, data: `cust:qprod:${drinkProduct.id}:${drinksCategory.id}` });
  await service.handleCustomerCallback({ ...callbackBase, data: "cust:cart" });
  assertCartHasOnlyQuantityControls();
  assert.equal(prisma.cartRecord?.items.length, 2);

  const firstItemId = prisma.cartRecord!.items[0]!.id;
  const secondItemId = prisma.cartRecord!.items[1]!.id;

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:qty:${firstItemId}:inc` });
  assert.equal(prisma.cartRecord?.items[0]?.quantity.toNumber(), 2, "plus should increment the same cart line");

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:qty:${firstItemId}:dec` });
  assert.equal(prisma.cartRecord?.items[0]?.quantity.toNumber(), 1, "minus from 2 should return to 1");

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:qty:${firstItemId}:dec` });
  assert.equal(
    prisma.cartRecord?.items.some((item) => item.id === firstItemId),
    false,
    "minus from 1 should remove the item",
  );
  assert.equal(prisma.cartRecord?.items.some((item) => item.id === secondItemId), true);
  assertCartHasOnlyQuantityControls();
}

async function testConfiguredItemSeparation(): Promise<void> {
  sentTelegramPayloads.length = 0;
  const prisma = new InMemoryPrisma();
  const { service, callbackBase } = createService(prisma);

  await service.handleCustomerCallback({ ...callbackBase, data: `cust:addv:${miniLavashProduct.id}_standard` });
  await service.handleCustomerCallback({ ...callbackBase, data: `cust:addv:${beefLavashProduct.id}_standard` });
  assert.equal(prisma.cartRecord?.items.length, 2, "different products must stay separate");

  const modifiedItem = prisma.cartRecord!.items[0]!;
  modifiedItem.modifierSnapshot = [{ modifierId: modifier.id, quantity: 1 }];
  await service.handleCustomerCallback({ ...callbackBase, data: `cust:addv:${miniLavashProduct.id}_standard` });
  assert.equal(
    prisma.cartRecord?.items.length,
    3,
    "same product with modifiers must stay separate from plain quick-add",
  );
}

async function testBranchLocation(): Promise<void> {
  sentTelegramPayloads.length = 0;
  const prisma = new InMemoryPrisma();
  const { service } = createService(prisma);

  await service.sendBranches({ chat: { id: "chat_1" }, from: { id: "tg_1" } });
  assert.match(lastText(), /MAZETTO Sergeli/);
  assert.match(lastText(), /Sergeli 7\/3/);
  assert.ok(lastPayload().reply_markup?.inline_keyboard?.flat().some((button) =>
    button.url?.includes("41.1970731,69.2038921"),
  ));
}

async function testDeliveryFlow(): Promise<void> {
  sentTelegramPayloads.length = 0;
  const prisma = new InMemoryPrisma();
  const { service, engineCalls, staffNotificationCalls, callbackBase } = createService(prisma);

  await seedCart(service, prisma, callbackBase);
  await service.handleCustomerCallback({ ...callbackBase, data: "cust:checkout" });
  assert.match(lastText(), /Buyurtma turi/);
  assert.ok(lastKeyboardText().includes("🚶 Olib ketish"));
  assert.ok(lastKeyboardText().includes("🚚 Yetkazib berish"));

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:type:DELIVERY" });
  assert.match(lastText(), /Yetkazib berish manzili/);

  await service.handleCustomerMessage({
    chat: { id: "chat_1" },
    from: { id: "tg_1" },
    text: "uy",
  });
  assert.match(lastText(), /Manzil juda qisqa/);
  assert.equal(engineCalls.length, 0);

  await service.handleCustomerMessage({
    chat: { id: "chat_1" },
    from: { id: "tg_1" },
    text: "Sergeli 7, 12-uy, 3-podyezd",
  });
  assert.match(lastText(), /Kur'er uchun izoh/);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:note:skip" });
  assert.match(lastText(), /Buyurtmani tasdiqlash/);
  assert.match(lastText(), /Yetkazib berish/);
  assert.match(lastText(), /Sergeli 7, 12-uy, 3-podyezd/);
  assert.match(lastText(), /To'lov: <b>Naqd<\/b>/);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:confirm:cart_1" });
  assert.equal(engineCalls.length, 1);
  assert.equal(engineCalls[0]?.customerId, customer.id);
  assert.equal(engineCalls[0]?.source, OrderSource.TELEGRAM);
  assert.equal(engineCalls[0]?.dto.type, "DELIVERY");
  assert.equal(engineCalls[0]?.dto.address, "Sergeli 7, 12-uy, 3-podyezd");
  assert.equal(engineCalls[0]?.dto.paymentMethod, "CASH");
  assert.equal(engineCalls[0]?.dto.items.length, 1);
  assert.equal(engineCalls[0]?.dto.items[0]?.productId, product.id);
  assert.equal(engineCalls[0]?.dto.items[0]?.variantId, variant.id);
  assert.deepEqual(engineCalls[0]?.dto.items[0]?.modifiers, [
    { modifierId: modifier.id, quantity: 1 },
  ]);
  assert.equal(prisma.cartRecord?.items.length, 0);
  assert.equal(prisma.checkoutSession, null);
  assert.deepEqual(staffNotificationCalls, [{ orderId: "order_telegram_1" }]);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:confirm:cart_1" });
  assert.equal(engineCalls.length, 1, "stale duplicate confirm must not create another order");
  assert.equal(
    staffNotificationCalls.length,
    1,
    "stale duplicate confirm must not send another staff notification",
  );
}

async function testPickupRegression(): Promise<void> {
  sentTelegramPayloads.length = 0;
  const prisma = new InMemoryPrisma();
  const { service, engineCalls, staffNotificationCalls, callbackBase } = createService(prisma);

  await seedCart(service, prisma, callbackBase);
  await service.handleCustomerCallback({ ...callbackBase, data: "cust:checkout" });
  await service.handleCustomerCallback({ ...callbackBase, data: "cust:type:PICKUP" });
  assert.match(lastText(), /Olib ketish/);
  assert.doesNotMatch(lastText(), /Manzil:/);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:confirm:cart_1" });
  assert.equal(engineCalls.length, 1);
  assert.equal(engineCalls[0]?.dto.type, "PICKUP");
  assert.equal(engineCalls[0]?.dto.address, undefined);
  assert.equal(engineCalls[0]?.dto.paymentMethod, "CASH");
  assert.deepEqual(staffNotificationCalls, [{ orderId: "order_telegram_1" }]);
}

async function testDeliveryNoteFlow(): Promise<void> {
  sentTelegramPayloads.length = 0;
  const prisma = new InMemoryPrisma();
  const { service, engineCalls, callbackBase } = createService(prisma);

  await seedCart(service, prisma, callbackBase);
  await service.handleCustomerCallback({ ...callbackBase, data: "cust:checkout" });
  await service.handleCustomerCallback({ ...callbackBase, data: "cust:type:DELIVERY" });
  await service.handleCustomerMessage({
    chat: { id: "chat_1" },
    from: { id: "tg_1" },
    text: "Sergeli 7, 12-uy, 3-podyezd",
  });
  await service.handleCustomerCallback({ ...callbackBase, data: "cust:note:add" });
  assert.match(lastText(), /Kur'er uchun izohni yuboring/);
  assert.equal(engineCalls.length, 0);

  await service.handleCustomerMessage({
    chat: { id: "chat_1" },
    from: { id: "tg_1" },
    text: "Darvozadan keyin chap taraf",
  });
  assert.match(lastText(), /Buyurtmani tasdiqlash/);
  assert.match(lastText(), /Izoh: Darvozadan keyin chap taraf/);
  assert.equal(engineCalls.length, 0);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:confirm:cart_1" });
  assert.equal(engineCalls.length, 1);
  assert.equal(engineCalls[0]?.dto.type, "DELIVERY");
  assert.equal(engineCalls[0]?.dto.notes, "Telegram orqali buyurtma. Darvozadan keyin chap taraf");
}

async function testDeliveryDisabled(): Promise<void> {
  sentTelegramPayloads.length = 0;
  const prisma = new InMemoryPrisma();
  prisma.branchRecord = { ...deliveryDisabledBranch };
  const { service, engineCalls, callbackBase } = createService(prisma);

  await seedCart(service, prisma, callbackBase);
  await service.handleCustomerCallback({ ...callbackBase, data: "cust:checkout" });
  assert.ok(lastKeyboardText().includes("🚶 Olib ketish"));
  assert.ok(!lastKeyboardText().includes("🚚 Yetkazib berish"));

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:type:DELIVERY" });
  assert.ok(
    sentTelegramPayloads.some((payload) =>
      /yetkazib berish hozir mavjud emas/i.test(payload.text ?? ""),
    ),
  );
  assert.match(lastText(), /Buyurtma turi/);
  assert.equal(engineCalls.length, 0);
}

async function seedCart(
  service: TelegramCustomerOrderingService,
  prisma: InMemoryPrisma,
  callbackBase: { id: string; message: { chat: { id: string } }; from: { id: string } },
): Promise<void> {
  await service.sendCategoryMenu({ chat: { id: "chat_1" }, from: { id: "tg_1" } });
  assert.match(lastText(), /Menyu bo'limini tanlang/);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:cat:category_sets" });
  assert.match(lastText(), /Mahsulot tanlang/);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:prod:product_lavash" });
  assert.match(lastText(), /Big Lavash/);

  await service.handleCustomerCallback({ ...callbackBase, data: "cust:addv:variant_standard" });
  assert.match(lastText(), /savatga qo'shildi/);
  assert.equal(prisma.cartRecord?.items.length, 1);
  prisma.cartRecord!.items[0]!.modifierSnapshot = [{ modifierId: modifier.id, quantity: 1 }];
}

function createService(prisma: InMemoryPrisma) {
  const engineCalls: EngineCall[] = [];
  const staffNotificationCalls: StaffNotificationCall[] = [];
  const orderEngine = {
    quoteCheckout: async () => ({
      subtotal: product.sellingPrice.toFixed(2),
      deliveryFee: "0.00",
      total: product.sellingPrice.toFixed(2),
      paymentMethods: [{ code: "CASH", label: "Naqd", status: "AVAILABLE" }],
    }),
    createOnlineOrder: async (
      customerId: string,
      dto: EngineCall["dto"],
      options?: { source?: OrderSource },
    ) => {
      engineCalls.push({ customerId, dto, source: options?.source });
      return {
        order: { id: "order_telegram_1", orderNumber: "TG-20260828-0001", status: OrderStatus.CONFIRMED },
        customerOrder: { id: "customer_order_1" },
      };
    },
  };
  const staffNotifications = {
    notifyNewOrder: async (orderId: string) => {
      staffNotificationCalls.push({ orderId });
    },
  };
  const service = new TelegramCustomerOrderingService(
    prisma as never,
    orderEngine as never,
    staffNotifications as never,
  );
  const callbackBase = {
    id: "callback_1",
    message: { chat: { id: "chat_1" }, message_id: 10 },
    from: { id: "tg_1" },
  };

  return { service, engineCalls, staffNotificationCalls, callbackBase };
}

function lastText(): string {
  return sentTelegramPayloads.at(-1)?.text ?? "";
}

function lastMethod(): string {
  return sentTelegramPayloads.at(-1)?.method ?? "";
}

function lastPayload(): SentTelegramPayload {
  const payload = sentTelegramPayloads.at(-1);
  assert.ok(payload, "expected a Telegram payload");

  return payload;
}

function lastKeyboardText(): string {
  return (
    sentTelegramPayloads
      .at(-1)
      ?.reply_markup?.inline_keyboard?.flat()
      .map((button) => button.text)
      .join(" ") ?? ""
  );
}

function normalizedLastKeyboardText(): string {
  return lastKeyboardText().replace(/\u00a0/g, " ");
}

function lastProductButtonTexts(): string[] {
  return (
    lastPayload().reply_markup?.inline_keyboard
      ?.flat()
      .filter((button) =>
        button.callback_data?.startsWith("cust:prod:") ||
        button.callback_data?.startsWith("cust:qprod:"),
      )
      .map((button) => button.text) ?? []
  );
}

function normalizedLastProductButtonTexts(): string[] {
  return lastProductButtonTexts().map((text) => text.replace(/\u00a0/g, " "));
}

function assertNoPaginationControls(): void {
  const keyboard = lastKeyboardText();
  assert.ok(!keyboard.includes("Keyingi"), "customer category keyboard must not include Keyingi");
  assert.ok(!keyboard.includes("Oldingi"), "customer category keyboard must not include Oldingi");
  assert.ok(!keyboard.includes("Next"), "customer category keyboard must not include Next");
  assert.ok(!keyboard.includes("Previous"), "customer category keyboard must not include Previous");
  assert.ok(!/\b\d+\+\b/.test(keyboard), "customer category keyboard must not include page indicators");
  assert.ok(
    !(lastPayload().reply_markup?.inline_keyboard?.flat() ?? []).some((button) =>
      /:cat:[^:]+:\d+$/.test(button.callback_data ?? ""),
    ),
    "customer category keyboard must not include page callbacks",
  );
}

function assertCartHasOnlyQuantityControls(): void {
  const keyboard = lastPayload().reply_markup?.inline_keyboard ?? [];
  const forbidden = /[+✓]\s*(Qo'shimcha sous|Qo'shimcha go'sht|Achchiq|Piyozsiz|Bodringsiz|Extra cheese)|O'chirish|modifier/i;
  assert.doesNotMatch(lastKeyboardText(), forbidden);
  assert.ok(
    keyboard.flat().every((button) =>
      button.callback_data?.startsWith("cust:qty:") ||
      button.callback_data === "cust:checkout" ||
      button.callback_data === "cust:menu",
    ),
    "cart keyboard must contain only item quantity controls plus cart-level actions",
  );
}

void main();
