import { orderStatusLabel as sharedOrderStatusLabel } from "../../common/utils/order-status-label";
import { Injectable, Logger } from "@nestjs/common";
import { CustomerOrderType, OrderSource, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import {
  customerVisibleCategoryCodes,
  customerVisibleProductCodes,
} from "../customers/customer-catalog-visibility";
import { CustomerOrderEngineService } from "../customers/customer-order-engine.service";
import {
  OnlineOrderTypeDto,
  OnlinePaymentMethodDto,
} from "../customers/dto/customer.dto";
import { TelegramOrderNotificationService } from "./telegram-order-notification.service";
import {
  branchMapUrl,
  branchSupportsType,
  burgerTelegramRows,
  categoryButtonLabel,
  chunkButtons,
  cleanAddress,
  escapeHtml,
  formatMoney,
  isMessageNotModifiedError,
  isSimpleQuickAddProduct,
  lavashTelegramRows,
  maskPhone,
  parseCustomerOrderType,
  readCartModifiers,
  requiredTelegramId,
  telegramProductButtonLabel,
  type BranchForCheckout,
} from "./telegram-customer-presentation";

type TelegramMessage = {
  chat?: { id?: number | string };
  from?: { id?: number | string; first_name?: string; last_name?: string };
  text?: string;
};
type TelegramCallbackQuery = {
  id?: string;
  data?: string;
  message?: { chat?: { id?: number | string }; message_id?: number };
  from?: { id?: number | string };
};
type LinkedCustomer = {
  id: string;
  name: string;
  phone: string;
  bonusBalance: Prisma.Decimal;
};
type CheckoutStep = "ORDER_TYPE" | "ADDRESS" | "NOTE" | "SUMMARY";
type TelegramCartForCheckout = {
  id: string;
  updatedAt: Date;
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    quantity: Prisma.Decimal;
    modifierSnapshot: Prisma.JsonValue | null;
    notes: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
};
type TelegramCheckoutSessionForKey = {
  branchId: string | null;
  orderType: CustomerOrderType | null;
  address: string | null;
  note: string | null;
};
type TelegramInlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
};
type CustomerScreenTarget = {
  chatId: string;
  callbackQueryId?: string;
  messageId?: number;
};
type CustomerScreenPayload = {
  text: string;
  parse_mode?: "HTML";
  reply_markup?: {
    inline_keyboard?: TelegramInlineButton[][];
    keyboard?: string[][];
    resize_keyboard?: boolean;
  };
};
const customerCallbackPrefix = "cust";
const TELEGRAM_CHECKOUT_SESSION_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class TelegramCustomerOrderingService {
  private readonly logger = new Logger(TelegramCustomerOrderingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customerOrderEngine: CustomerOrderEngineService,
    private readonly telegramOrderNotificationService: TelegramOrderNotificationService,
  ) {}

  async handleCustomerCallback(callback: TelegramCallbackQuery): Promise<boolean> {
    const chatId = callback.message?.chat?.id;
    const data = callback.data ?? "";

    if (!data.startsWith(`${customerCallbackPrefix}:`) || !chatId) {
      return false;
    }

    const [, action, ...values] = data.split(":");
    const customer = await this.findLinkedCustomer(callback.from?.id);
    const target = this.callbackTarget(callback);

    if (!customer) {
      await this.sendLinkRequired(target);
      return true;
    }

    if (action === "home") {
      await this.answerCallback(callback);
      await this.sendMainMenu(target, customer.name, customer.id);
      return true;
    }

    if (action === "menu") {
      await this.answerCallback(callback);
      await this.sendCategoryMenuToTarget(target, customer.id);
      return true;
    }

    if (action === "branches") {
      await this.answerCallback(callback);
      await this.sendBranchesToTarget(target);
      return true;
    }

    if (action === "orders") {
      await this.answerCallback(callback);
      await this.sendCustomerOrders(target, customer);
      return true;
    }

    if (action === "profile") {
      await this.answerCallback(callback);
      await this.sendCustomerProfile(target, customer);
      return true;
    }

    if (action === "cat" && values[0]) {
      await this.answerCallback(callback);
      await this.sendProductsForCategory(target, customer.id, values[0]);
      return true;
    }

    if (action === "prod" && values[0]) {
      await this.answerCallback(callback);
      await this.sendProductConfigurator(target, values[0]);
      return true;
    }

    if (action === "qprod" && values[0]) {
      await this.quickAddSimpleProduct(target, callback, customer, values[0], values[1]);
      return true;
    }

    if (action === "addv" && values[0]) {
      await this.addVariantToCart(target, callback, customer, values[0]);
      return true;
    }

    if (action === "addp" && values[0]) {
      await this.addProductToCart(target, callback, customer, values[0]);
      return true;
    }

    if (action === "mod" || action === "rm") {
      await this.answerCallback(callback, "Bu menyu eskirgan. Qayta oching.", true);
      await this.sendCart(target, customer);
      return true;
    }

    if (action === "qty" && values[0] && values[1]) {
      await this.answerCallback(callback);
      await this.changeCartQuantity(target, customer, values[0], values[1]);
      return true;
    }

    if (action === "cart") {
      await this.answerCallback(callback);
      await this.sendCart(target, customer);
      return true;
    }

    if (action === "checkout") {
      await this.answerCallback(callback);
      await this.startCheckout(target, customer);
      return true;
    }

    if (action === "type" && values[0]) {
      await this.answerCallback(callback);
      await this.selectOrderType(target, customer, values[0]);
      return true;
    }

    if (action === "note" && values[0]) {
      await this.answerCallback(callback);
      await this.handleNoteChoice(target, customer, values[0]);
      return true;
    }

    if (action === "confirm" && values[0]) {
      await this.answerCallback(callback);
      await this.confirmCartOrder(target, customer, values[0]);
      return true;
    }

    await this.answerCallback(callback, "Bu menyu eskirgan. Qayta oching.", true);
    await this.renderCustomerScreen(target, {
      text: "Bu tugma eskirgan bo'lishi mumkin. Iltimos, bosh menyudan qayta tanlang.",
      reply_markup: {
        inline_keyboard: [[{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }]],
      },
    });
    return true;
  }

  async handleCustomerMessage(message: TelegramMessage): Promise<boolean> {
    const text = message.text?.trim();

    if (!text || text.startsWith("/")) {
      return false;
    }

    const chatId = requiredTelegramId(message.chat?.id, "chat id");
    const customer = await this.findLinkedCustomer(message.from?.id);

    if (!customer) {
      return false;
    }

    const session = await this.getActiveCheckoutSession(customer.id, chatId);

    if (!session) {
      return false;
    }

    if (text === "🏠 Bosh menyu") {
      await this.clearCheckoutSession(customer.id, chatId);
      await this.sendMainMenu({ chatId }, customer.name, customer.id);
      return true;
    }

    if (text === "⬅️ Orqaga") {
      await this.handleBack(chatId, customer, session.step as CheckoutStep);
      return true;
    }

    if (session.step === "ADDRESS") {
      await this.acceptDeliveryAddress(chatId, customer, text);
      return true;
    }

    if (session.step === "NOTE") {
      await this.acceptDeliveryNote(chatId, customer, text);
      return true;
    }

    return false;
  }

  async sendCategoryMenu(message: TelegramMessage): Promise<void> {
    const chatId = requiredTelegramId(message.chat?.id, "chat id");
    const customer = await this.findLinkedCustomer(message.from?.id);

    if (!customer) {
      await this.sendLinkRequired({ chatId });
      return;
    }

    await this.sendCategoryMenuToTarget({ chatId }, customer.id);
  }

  private async sendCategoryMenuToTarget(target: CustomerScreenTarget, customerId?: string): Promise<void> {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true, code: { in: [...customerVisibleCategoryCodes] } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    });
    const sorted = [...categories].sort(
      (a, b) => (a.code === "SETS" ? -1 : 0) - (b.code === "SETS" ? -1 : 0),
    );

    const cartLabel = await this.cartButtonLabel(customerId);

    await this.renderCustomerScreen(target, {
      text: "🍽 <b>Menyu bo'limini tanlang</b>",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...chunkButtons(
            sorted.map((category) => ({
              text: categoryButtonLabel(category.code, category.name),
              callback_data: `${customerCallbackPrefix}:cat:${category.id}`,
            })),
            2,
          ),
          [{ text: cartLabel, callback_data: `${customerCallbackPrefix}:cart` }],
          [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  async sendCartFromMessage(message: TelegramMessage): Promise<void> {
    const chatId = requiredTelegramId(message.chat?.id, "chat id");
    const customer = await this.findLinkedCustomer(message.from?.id);

    if (!customer) {
      await this.sendLinkRequired({ chatId });
      return;
    }

    await this.sendCart({ chatId }, customer);
  }

  async sendMainMenuFromMessage(
    message: TelegramMessage,
    name?: string | null,
  ): Promise<void> {
    const chatId = requiredTelegramId(message.chat?.id, "chat id");
    await this.sendMainMenu({ chatId }, name);
  }

  async sendBranches(message: TelegramMessage): Promise<void> {
    const chatId = requiredTelegramId(message.chat?.id, "chat id");
    await this.sendBranchesToTarget({ chatId });
  }

  private async sendBranchesToTarget(target: CustomerScreenTarget): Promise<void> {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        acceptsOrders: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        isTemporarilyClosed: true,
      },
    });

    await this.renderCustomerScreen(target, {
      text: [
        "📍 <b>Filiallar</b>",
        "",
        ...branches.map((branch) =>
          [
            `<b>${escapeHtml(branch.name)}</b>`,
            escapeHtml(branch.address ?? "Manzil kiritilmagan"),
            branch.acceptsOrders && !branch.isTemporarilyClosed
              ? "Buyurtma qabul qilmoqda"
              : "Hozir buyurtma qabul qilmayapti",
            `${branch.pickupEnabled ? "Olib ketish ✅" : "Olib ketish ❌"} · ${branch.deliveryEnabled ? "Yetkazib berish ✅" : "Yetkazib berish ❌"}`,
          ].join("\n"),
        ),
      ].join("\n\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...branches.flatMap((branch) => {
            const mapUrl = branchMapUrl(branch);
            return mapUrl
              ? [[{ text: `📍 ${branch.name} xaritada`, url: mapUrl }]]
              : [];
          }),
          [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  private async sendCustomerOrders(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
  ): Promise<void> {
    const orders = await this.prisma.customerOrder.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        branch: { select: { name: true } },
        order: { select: { orderNumber: true, displayOrderNumber: true, status: true, total: true } },
      },
    });

    await this.renderCustomerScreen(target, {
      text: orders.length
        ? [
            "📦 <b>Buyurtmalaringiz</b>",
            "",
            ...orders.map((order) =>
              [
                `<b>${escapeHtml(order.order.displayOrderNumber ?? order.order.orderNumber)}</b>`,
                `${escapeHtml(order.branch.name)} · ${this.statusLabel(order.order.status, order.type)}`,
                `Jami: ${formatMoney(order.order.total)}`,
              ].join("\n"),
            ),
          ].join("\n\n")
        : "Hali buyurtmalaringiz yo'q. Menyudan taom tanlab buyurtma berishingiz mumkin.",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🍽 Menyu", callback_data: `${customerCallbackPrefix}:menu` }],
          [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  private async sendCustomerProfile(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
  ): Promise<void> {
    const orderCount = await this.prisma.customerOrder.count({
      where: { customerId: customer.id },
    });

    await this.renderCustomerScreen(target, {
      text: [
        "👤 <b>Profil</b>",
        "",
        `<b>Ism:</b> ${escapeHtml(customer.name)}`,
        `<b>Telefon:</b> ${maskPhone(customer.phone)}`,
        `<b>Buyurtmalar:</b> ${orderCount}`,
        `<b>Bonus:</b> ${formatMoney(customer.bonusBalance)}`,
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📦 Buyurtmalarim", callback_data: `${customerCallbackPrefix}:orders` }],
          [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  private async sendProductsForCategory(
    target: CustomerScreenTarget,
    customerId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        isActive: true,
        code: { in: [...customerVisibleCategoryCodes] },
      },
      select: { code: true, name: true },
    });

    if (category?.code === "LAVASH" || category?.code === "BURGER") {
      await this.sendPairedCanonicalProductsForCategory(
        target,
        customerId,
        categoryId,
        category.code,
      );
      return;
    }

    const products = await this.prisma.product.findMany({
      where: {
        categoryId,
        isAvailable: true,
        code: { in: [...customerVisibleProductCodes] },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        category: { select: { code: true, name: true } },
        variants: {
          where: { isAvailable: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        modifiers: {
          where: { modifier: { isActive: true } },
          orderBy: { sortOrder: "asc" },
          include: { modifier: true },
        },
      },
    });

    if (!products.length) {
      await this.renderCustomerScreen(target, {
        text: "Bu bo'limda hozircha mahsulot yo'q.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Bo'limlarga qaytish", callback_data: `${customerCallbackPrefix}:menu` }],
          ],
        },
      });
      return;
    }

    const cartLabel = await this.cartButtonLabel(customerId);
    const hasQuickAddableProducts = products.some((product) =>
      isSimpleQuickAddProduct(product),
    );

    await this.renderCustomerScreen(target, {
      text: [
        "🍽 <b>Mahsulot tanlang</b>",
        hasQuickAddableProducts
          ? "\nBitta turdagi mahsulotlar bir bosishda savatga qo'shiladi."
          : "",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...chunkButtons(products.map((product) => {
            const variant =
              product.variants.find((item) => item.isDefault) ?? product.variants[0];
            const quickAddable = isSimpleQuickAddProduct(product);
            return {
              text: `${quickAddable ? "➕ " : ""}${product.name} · ${formatMoney(variant?.sellingPrice ?? product.sellingPrice)}`,
              callback_data: quickAddable
                ? `${customerCallbackPrefix}:qprod:${product.id}:${categoryId}`
                : `${customerCallbackPrefix}:prod:${product.id}`,
            };
          }), 2),
          [{ text: "⬅️ Bo'limlarga qaytish", callback_data: `${customerCallbackPrefix}:menu` }],
          [{ text: cartLabel, callback_data: `${customerCallbackPrefix}:cart` }],
        ],
      },
    });
  }

  private async sendPairedCanonicalProductsForCategory(
    target: CustomerScreenTarget,
    customerId: string,
    categoryId: string,
    categoryCode: "LAVASH" | "BURGER",
  ): Promise<void> {
    const configuredRows = categoryCode === "LAVASH" ? lavashTelegramRows : burgerTelegramRows;
    const productCodes = configuredRows.flat();
    const products = await this.prisma.product.findMany({
      where: {
        categoryId,
        code: {
          in: productCodes.filter((code) =>
            customerVisibleProductCodes.includes(code),
          ),
        },
        isAvailable: true,
      },
      include: {
        category: { select: { code: true, name: true } },
        variants: {
          where: { isAvailable: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        modifiers: {
          where: { modifier: { isActive: true } },
          orderBy: { sortOrder: "asc" },
          include: { modifier: true },
        },
      },
    });
    const productByCode = new Map(products.map((product) => [product.code, product]));
    const rows = configuredRows
      .map((row) =>
        row
          .map((code) => productByCode.get(code))
          .filter((product): product is NonNullable<typeof product> => Boolean(product))
          .map((product) => {
            const variant = product.variants.find((item) => item.isDefault) ?? product.variants[0];
            return {
              text: `${telegramProductButtonLabel(product.code, product.name)} · ${formatMoney(variant?.sellingPrice ?? product.sellingPrice)}`,
              callback_data: isSimpleQuickAddProduct(product)
                ? `${customerCallbackPrefix}:qprod:${product.id}:${categoryId}:1`
                : `${customerCallbackPrefix}:prod:${product.id}`,
            };
          }),
      )
      .filter((row) => row.length > 0);

    const cartLabel = await this.cartButtonLabel(customerId);

    await this.renderCustomerScreen(target, {
      text: [
        categoryCode === "LAVASH"
          ? "🌯 <b>Lavashlar</b>"
          : "🍔 <b>Burgerlar</b>",
        "",
        "Chapda mol go'shtli, o'ngda tovuqli mahsulotlar.",
        "Tanlanganda mahsulot savatga qo'shiladi.",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...rows,
          [{ text: "⬅️ Bo'limlarga qaytish", callback_data: `${customerCallbackPrefix}:menu` }],
          [{ text: cartLabel, callback_data: `${customerCallbackPrefix}:cart` }],
        ],
      },
    });
  }

  private async sendProductConfigurator(
    target: CustomerScreenTarget,
    productId: string,
  ): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isAvailable: true,
        code: { in: [...customerVisibleProductCodes] },
      },
      include: {
        category: { select: { name: true } },
        variants: {
          where: { isAvailable: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        modifiers: {
          where: { modifier: { isActive: true } },
          orderBy: { sortOrder: "asc" },
          include: { modifier: true },
        },
      },
    });

    if (!product) {
      await this.renderCustomerScreen(target, {
        text: "Mahsulot topilmadi yoki hozir mavjud emas.",
      });
      return;
    }

    const variantButtons = product.variants.length
      ? product.variants.map((variant) => [
          {
            text: `${variant.name} · ${formatMoney(variant.sellingPrice)}`,
            callback_data: `${customerCallbackPrefix}:addv:${variant.id}`,
          },
        ])
      : [[{
          text: `Savatga qo'shish · ${formatMoney(product.sellingPrice)}`,
          callback_data: `${customerCallbackPrefix}:addp:${product.id}`,
        }]];

    await this.renderCustomerScreen(target, {
      text: [
        `🍽 <b>${escapeHtml(product.name)}</b>`,
        product.category?.name ? escapeHtml(product.category.name) : "",
        "",
        escapeHtml(product.description ?? "Buyurtmadan keyin tayyorlanadi."),
        product.modifiers.length
          ? "\nQo'shimchalarni mahsulot savatga qo'shilgandan keyin tanlaysiz."
          : "",
      ].filter(Boolean).join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...variantButtons,
          [{ text: "⬅️ Menyuga qaytish", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  private async quickAddSimpleProduct(
    target: CustomerScreenTarget,
    callback: TelegramCallbackQuery,
    customer: LinkedCustomer,
    productId: string,
    categoryId?: string,
  ): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isAvailable: true,
        code: { in: [...customerVisibleProductCodes] },
      },
      include: {
        category: { select: { code: true, name: true } },
        variants: {
          where: { isAvailable: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        modifiers: {
          where: { modifier: { isActive: true } },
          orderBy: { sortOrder: "asc" },
          include: { modifier: true },
        },
      },
    });

    if (!product || !isSimpleQuickAddProduct(product)) {
      await this.answerCallback(callback, "Bu mahsulotni qayta tanlang.", true);
      if (product) {
        await this.sendProductConfigurator(target, product.id);
      }
      return;
    }

    const variant = product.variants.find((item) => item.isDefault) ?? product.variants[0] ?? null;
    await this.addCartItem(customer.id, product.id, variant?.id ?? null);
    await this.answerCallback(callback, "Savatga qo'shildi ✅");

    if (categoryId) {
      await this.sendProductsForCategory(target, customer.id, categoryId);
      return;
    }

    await this.sendCategoryMenuToTarget(target, customer.id);
  }

  private async addVariantToCart(
    target: CustomerScreenTarget,
    callback: TelegramCallbackQuery,
    customer: LinkedCustomer,
    variantId: string,
  ): Promise<void> {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        isAvailable: true,
        product: {
          isAvailable: true,
          code: { in: [...customerVisibleProductCodes] },
        },
      },
      include: {
        product: {
          include: {
            modifiers: {
              where: { modifier: { isActive: true } },
              orderBy: { sortOrder: "asc" },
              include: { modifier: true },
            },
          },
        },
      },
    });

    if (!variant) {
      await this.answerCallback(callback, "Variant topilmadi yoki mavjud emas.", true);
      await this.renderCustomerScreen(target, { text: "Variant topilmadi yoki hozir mavjud emas." });
      return;
    }

    const cartItem = await this.addCartItem(customer.id, variant.productId, variant.id);
    await this.answerCallback(callback, "Savatga qo'shildi ✅");
    await this.sendCartItemConfigured(target, cartItem.id, variant.product.name);
  }

  private async addProductToCart(
    target: CustomerScreenTarget,
    callback: TelegramCallbackQuery,
    customer: LinkedCustomer,
    productId: string,
  ): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isAvailable: true,
        code: { in: [...customerVisibleProductCodes] },
      },
      include: {
        modifiers: {
          where: { modifier: { isActive: true } },
          orderBy: { sortOrder: "asc" },
          include: { modifier: true },
        },
      },
    });

    if (!product) {
      await this.answerCallback(callback, "Mahsulot topilmadi yoki mavjud emas.", true);
      await this.renderCustomerScreen(target, { text: "Mahsulot topilmadi yoki hozir mavjud emas." });
      return;
    }

    const cartItem = await this.addCartItem(customer.id, product.id, null);
    await this.answerCallback(callback, "Savatga qo'shildi ✅");
    await this.sendCartItemConfigured(target, cartItem.id, product.name);
  }

  private async addCartItem(
    customerId: string,
    productId: string,
    variantId: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockTelegramCart(tx, customerId);
      const cart = await this.getOrCreateCartForTransaction(tx, customerId);
      await this.lockCartLine(tx, cart.id, productId, variantId);

      const existingItems = await tx.cartItem.findMany({
        where: {
          cartId: cart.id,
          productId,
          variantId,
          notes: null,
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          modifierSnapshot: true,
        },
      });
      const existing = existingItems.find(
        (item) => readCartModifiers(item.modifierSnapshot).length === 0,
      );

      if (existing) {
        return tx.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: new Prisma.Decimal(existing.quantity).add(1),
          },
          select: { id: true },
        });
      }

      return tx.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variantId,
          quantity: new Prisma.Decimal(1),
          modifierSnapshot: [],
        },
        select: { id: true },
      });
    });
  }

  private async getOrCreateCartForTransaction(
    tx: Prisma.TransactionClient,
    customerId: string,
  ): Promise<{ id: string }> {
    const existing = await tx.cart.findFirst({
      where: { customerId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (existing) {
      return existing;
    }

    return tx.cart.create({
      data: { customerId },
      select: { id: true },
    });
  }

  private async sendCartItemConfigured(
    target: CustomerScreenTarget,
    cartItemId: string,
    productName: string,
  ): Promise<void> {
    await this.renderCustomerScreen(target, {
      text: `✅ <b>${escapeHtml(productName)}</b> savatga qo'shildi.`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "−", callback_data: `${customerCallbackPrefix}:qty:${cartItemId}:dec` },
            { text: "+", callback_data: `${customerCallbackPrefix}:qty:${cartItemId}:inc` },
          ],
          [{ text: "🛒 Savatni ko'rish", callback_data: `${customerCallbackPrefix}:cart` }],
          [{ text: "🍽 Menyuga qaytish", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  private async changeCartQuantity(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
    cartItemId: string,
    direction: string,
  ): Promise<void> {
    const item = await this.findCustomerCartItem(customer.id, cartItemId);

    if (!item) {
      await this.sendCart(target, customer);
      return;
    }

    const current = Number(item.quantity);
    const next = direction === "inc" ? current + 1 : current - 1;

    if (next <= 0) {
      await this.prisma.cartItem.delete({ where: { id: cartItemId } });
    } else {
      await this.prisma.cartItem.update({
        where: { id: cartItemId },
        data: { quantity: new Prisma.Decimal(next) },
      });
    }

    await this.sendCart(target, customer);
  }

  private async sendCart(target: CustomerScreenTarget, customer: LinkedCustomer): Promise<void> {
    const cart = await this.getCartWithItems(customer.id);

    if (!cart?.items.length) {
      await this.renderCustomerScreen(target, {
        text: "🛒 Savatingiz bo'sh. Menyudan taom tanlang.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🍽 Menyu", callback_data: `${customerCallbackPrefix}:menu` }],
            [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
          ],
        },
      });
      return;
    }

    const totals = await this.calculateCartTotals(cart.items);

    await this.renderCustomerScreen(target, {
      text: [
        "🛒 <b>Savat</b>",
        "",
        ...totals.lines,
        "",
        `<b>Jami: ${formatMoney(totals.total)}</b>`,
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...cart.items.flatMap((item) => [
            [
              { text: `− ${item.product.name}`, callback_data: `${customerCallbackPrefix}:qty:${item.id}:dec` },
              { text: "+", callback_data: `${customerCallbackPrefix}:qty:${item.id}:inc` },
            ],
          ]),
          [{ text: "✅ Buyurtma berish", callback_data: `${customerCallbackPrefix}:checkout` }],
          [{ text: "🍽 Menyuga qaytish", callback_data: `${customerCallbackPrefix}:menu` }],
        ],
      },
    });
  }

  private async startCheckout(target: CustomerScreenTarget, customer: LinkedCustomer): Promise<void> {
    const cart = await this.getCartWithItems(customer.id);

    if (!cart?.items.length) {
      await this.sendCart(target, customer);
      return;
    }

    const branches = await this.availableBranches();

    if (!branches.length) {
      await this.renderCustomerScreen(target, {
        text: "Hozir buyurtma qabul qiladigan filial topilmadi.",
      });
      return;
    }

    const branch = branches[0]!;
    await this.upsertCheckoutSession(customer.id, target.chatId, {
      branchId: branch.id,
      step: "ORDER_TYPE",
      orderType: null,
      address: null,
      note: null,
    });

    const typeButtons = this.orderTypeButtons(branch);

    if (!typeButtons.length) {
      await this.renderCustomerScreen(target, {
        text: "Tanlangan filial hozir buyurtma turi qabul qilmayapti.",
      });
      return;
    }

    await this.renderCustomerScreen(target, {
      text: [
        "✅ <b>Buyurtma turi</b>",
        "",
        `Filial: <b>${escapeHtml(branch.name)}</b>`,
        "",
        "Qanday buyurtma berasiz?",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...typeButtons,
          [{ text: "⬅️ Savatga qaytish", callback_data: `${customerCallbackPrefix}:cart` }],
          [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  private async selectOrderType(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
    rawType: string,
  ): Promise<void> {
    const orderType = parseCustomerOrderType(rawType);
    const session = await this.getActiveCheckoutSession(customer.id, target.chatId);
    const branch = session?.branchId
      ? await this.findBranchForCheckout(session.branchId)
      : await this.defaultBranchForType(orderType);

    if (!branch) {
      await this.renderCustomerScreen(target, {
        text: "Hozir bu buyurtma turi uchun ochiq filial topilmadi.",
      });
      return;
    }

    if (!branchSupportsType(branch, orderType)) {
      await this.renderCustomerScreen(target, {
        text:
          orderType === CustomerOrderType.DELIVERY
            ? "Bu filialda yetkazib berish hozir mavjud emas."
            : "Bu filialdan olib ketish hozir mavjud emas.",
      });
      await this.startCheckout(target, customer);
      return;
    }

    if (orderType === CustomerOrderType.DELIVERY) {
      await this.upsertCheckoutSession(customer.id, target.chatId, {
        branchId: branch.id,
        orderType,
        step: "ADDRESS",
        address: null,
        note: null,
      });
      await this.askDeliveryAddress(target, branch);
      return;
    }

    await this.upsertCheckoutSession(customer.id, target.chatId, {
      branchId: branch.id,
      orderType,
      step: "SUMMARY",
      address: null,
      note: null,
    });
    await this.sendCheckoutSummary(target, customer);
  }

  private async askDeliveryAddress(
    target: CustomerScreenTarget,
    branch: { name: string },
  ): Promise<void> {
    await this.renderCustomerScreen(target, {
      text: [
        "🚚 <b>Yetkazib berish manzili</b>",
        "",
        `Filial: <b>${escapeHtml(branch.name)}</b>`,
        "",
        "Manzilingizni yuboring. Masalan: Sergeli 7, 12-uy, 3-podyezd, mo'ljal - maktab yonida.",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [["⬅️ Orqaga", "🏠 Bosh menyu"]],
        resize_keyboard: true,
      },
    });
  }

  private async acceptDeliveryAddress(
    chatId: string,
    customer: LinkedCustomer,
    address: string,
  ): Promise<void> {
    const normalizedAddress = cleanAddress(address);

    if (!normalizedAddress) {
      await this.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Manzil juda qisqa yoki bo'sh. Iltimos, ko'cha, uy va mo'ljalni yozing.",
      });
      return;
    }

    await this.upsertCheckoutSession(customer.id, chatId, {
      step: "NOTE",
      address: normalizedAddress,
    });

    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: [
        "Manzil qabul qilindi.",
        "",
        "Kur'er uchun izoh qo'shasizmi?",
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [{ text: "Izoh qo'shish", callback_data: `${customerCallbackPrefix}:note:add` }],
          [{ text: "O'tkazib yuborish", callback_data: `${customerCallbackPrefix}:note:skip` }],
          [{ text: "⬅️ Orqaga", callback_data: `${customerCallbackPrefix}:type:DELIVERY` }],
          [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  private async handleNoteChoice(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
    choice: string,
  ): Promise<void> {
    if (choice === "skip") {
      await this.upsertCheckoutSession(customer.id, target.chatId, {
        step: "SUMMARY",
        note: null,
      });
      await this.sendCheckoutSummary(target, customer);
      return;
    }

    if (choice === "add") {
      await this.upsertCheckoutSession(customer.id, target.chatId, {
        step: "NOTE",
      });
      await this.renderCustomerScreen(target, {
        text: "Kur'er uchun izohni yuboring. Masalan: Qo'ng'iroq qilmang, eshik oldiga qoldiring.",
        reply_markup: {
          keyboard: [["⬅️ Orqaga", "🏠 Bosh menyu"]],
          resize_keyboard: true,
        },
      });
    }
  }

  private async acceptDeliveryNote(
    chatId: string,
    customer: LinkedCustomer,
    note: string,
  ): Promise<void> {
    const cleanNote = note.trim();

    if (!cleanNote) {
      await this.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Izoh bo'sh bo'lmasin yoki O'tkazib yuborish tugmasini bosing.",
      });
      return;
    }

    await this.upsertCheckoutSession(customer.id, chatId, {
      step: "SUMMARY",
      note: cleanNote.slice(0, 1000),
    });
    await this.sendCheckoutSummary({ chatId }, customer);
  }

  private async sendCheckoutSummary(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
  ): Promise<void> {
    const cart = await this.getCartWithItems(customer.id);

    if (!cart?.items.length) {
      await this.sendCart(target, customer);
      return;
    }

    const session = await this.getActiveCheckoutSession(customer.id, target.chatId);
    const branch = session?.branchId ? await this.findBranchForCheckout(session.branchId) : null;
    const orderType = session?.orderType;

    if (!session || !branch || !orderType) {
      await this.startCheckout(target, customer);
      return;
    }

    if (!branchSupportsType(branch, orderType)) {
      await this.renderCustomerScreen(target, {
        text: "Tanlangan filial yoki buyurtma turi hozir mavjud emas. Iltimos, qayta tanlang.",
      });
      await this.startCheckout(target, customer);
      return;
    }

    if (orderType === CustomerOrderType.DELIVERY && !cleanAddress(session.address ?? "")) {
      await this.upsertCheckoutSession(customer.id, target.chatId, { step: "ADDRESS" });
      await this.askDeliveryAddress(target, branch);
      return;
    }

    await this.upsertCheckoutSession(customer.id, target.chatId, { step: "SUMMARY" });
    const totals = await this.calculateCartTotals(cart.items);
    const quote = await this.customerOrderEngine.quoteCheckout(customer.id, {
      branchId: branch.id,
      type:
        orderType === CustomerOrderType.DELIVERY
          ? OnlineOrderTypeDto.DELIVERY
          : OnlineOrderTypeDto.PICKUP,
      items: cart.items.map((item) => ({
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        quantity: Number(item.quantity),
        modifiers: readCartModifiers(item.modifierSnapshot),
        ...(item.notes ? { notes: item.notes } : {}),
      })),
    });
    const deliveryFee = Number(quote.deliveryFee);

    await this.renderCustomerScreen(target, {
      text: [
        "✅ <b>Buyurtmani tasdiqlash</b>",
        "",
        `Filial: <b>${escapeHtml(branch.name)}</b>`,
        `Turi: <b>${orderType === CustomerOrderType.DELIVERY ? "Yetkazib berish" : "Olib ketish"}</b>`,
        orderType === CustomerOrderType.DELIVERY
          ? `Manzil: <b>${escapeHtml(session.address ?? "")}</b>`
          : "",
        session.note ? `Izoh: ${escapeHtml(session.note)}` : "",
        "To'lov: <b>Naqd</b>",
        "",
        ...totals.lines,
        deliveryFee > 0
          ? `Yetkazib berish: ${formatMoney(new Prisma.Decimal(quote.deliveryFee))}`
          : "",
        "",
        `<b>Jami: ${formatMoney(new Prisma.Decimal(quote.total))}</b>`,
      ].filter(Boolean).join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Tasdiqlash", callback_data: `${customerCallbackPrefix}:confirm:${cart.id}` }],
          [{ text: "⬅️ Orqaga", callback_data: `${customerCallbackPrefix}:checkout` }],
          [{ text: "🛒 Savatga qaytish", callback_data: `${customerCallbackPrefix}:cart` }],
          [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  private async confirmCartOrder(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
    cartId: string,
  ): Promise<void> {
    const cart = await this.getCartWithItems(customer.id);

    if (!cart || cart.id !== cartId || !cart.items.length) {
      await this.renderCustomerScreen(target, {
        text: "Bu tasdiqlash eskirgan. Iltimos, savatni qayta tekshiring.",
      });
      return;
    }

    const session = await this.getActiveCheckoutSession(customer.id, target.chatId);
    const branch = session?.branchId ? await this.findBranchForCheckout(session.branchId) : null;
    const orderType = session?.orderType;

    if (!session || !branch || !orderType) {
      await this.renderCustomerScreen(target, {
        text: "Bu tasdiqlash eskirgan. Iltimos, buyurtma turini qayta tanlang.",
      });
      await this.startCheckout(target, customer);
      return;
    }

    if (!branchSupportsType(branch, orderType)) {
      await this.renderCustomerScreen(target, {
        text: "Tanlangan filial bu buyurtma turini hozir qabul qilmayapti.",
      });
      await this.startCheckout(target, customer);
      return;
    }

    const deliveryAddress =
      orderType === CustomerOrderType.DELIVERY
        ? cleanAddress(session.address ?? "")
        : null;

    if (orderType === CustomerOrderType.DELIVERY && !deliveryAddress) {
      await this.upsertCheckoutSession(customer.id, target.chatId, { step: "ADDRESS" });
      await this.askDeliveryAddress(target, branch);
      return;
    }

    try {
      const result = await this.customerOrderEngine.createOnlineOrder(
        customer.id,
        {
          branchId: branch.id,
          idempotencyKey: this.createTelegramOrderIdempotencyKey(
            customer.id,
            cart,
            session,
          ),
          name: customer.name,
          type:
            orderType === CustomerOrderType.DELIVERY
              ? OnlineOrderTypeDto.DELIVERY
              : OnlineOrderTypeDto.PICKUP,
          ...(deliveryAddress ? { address: deliveryAddress } : {}),
          paymentMethod: OnlinePaymentMethodDto.CASH,
          notes: session.note
            ? `Telegram orqali buyurtma. ${session.note}`
            : "Telegram orqali buyurtma",
          items: cart.items.map((item) => ({
            productId: item.productId,
            ...(item.variantId ? { variantId: item.variantId } : {}),
            quantity: Number(item.quantity),
            modifiers: readCartModifiers(item.modifierSnapshot),
            ...(item.notes ? { notes: item.notes } : {}),
          })),
        },
        { source: OrderSource.TELEGRAM, orderNumberPrefix: "TG" },
      );

      if (result.order?.id) {
        void this.telegramOrderNotificationService.notifyNewOrder(result.order.id);
      }

      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await this.clearCheckoutSession(customer.id, target.chatId);
      await this.renderCustomerScreen(target, {
        text: [
          "🎉 <b>Buyurtma qabul qilindi</b>",
          "",
          `Raqam: <b>${escapeHtml(result.order?.displayOrderNumber ?? result.order?.orderNumber ?? "-")}</b>`,
          `Holat: <b>${this.statusLabel(result.order?.status ?? "NEW")}</b>`,
          "",
          "Buyurtmani web sayt yoki Telegramdagi Buyurtmalarim bo'limidan kuzatishingiz mumkin.",
        ].join("\n"),
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
            [{ text: "🍽 Yana buyurtma", callback_data: `${customerCallbackPrefix}:home` }],
          ],
        },
      });
    } catch (error) {
      this.logger.error(
        "Telegram cart confirmation failed",
        error instanceof Error ? error.stack : String(error),
      );
      await this.telegramRequest("sendMessage", {
        chat_id: target.chatId,
        text: "Buyurtmani yaratishda xatolik bo'ldi. Iltimos, savatni tekshirib qayta urinib ko'ring.",
      });
    }
  }

  private async getOrCreateCart(customerId: string) {
    const existing = await this.prisma.cart.findFirst({
      where: { customerId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.cart.create({
      data: { customerId },
      select: { id: true },
    });
  }

  private createTelegramOrderIdempotencyKey(
    customerId: string,
    cart: TelegramCartForCheckout,
    session: TelegramCheckoutSessionForKey,
  ): string {
    const fingerprint = {
      customerId,
      cartId: cart.id,
      branchId: session.branchId,
      orderType: session.orderType,
      address: session.address?.trim() ?? null,
      note: session.note?.trim() ?? null,
      items: cart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity.toFixed(3),
        modifiers: readCartModifiers(item.modifierSnapshot).sort((a, b) =>
          a.modifierId.localeCompare(b.modifierId),
        ),
        notes: item.notes?.trim() ?? null,
        createdAt: item.createdAt?.toISOString() ?? null,
        updatedAt: item.updatedAt?.toISOString() ?? null,
      })),
    };
    const hash = createHash("sha256")
      .update(JSON.stringify(fingerprint))
      .digest("hex")
      .slice(0, 32);

    return `telegram:${customerId}:${cart.id}:${hash}`;
  }

  private getCartWithItems(customerId: string) {
    return this.prisma.cart.findFirst({
      where: { customerId },
      orderBy: { updatedAt: "desc" },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sellingPrice: true,
                modifiers: {
                  where: { modifier: { isActive: true } },
                  orderBy: { sortOrder: "asc" },
                  include: { modifier: true },
                },
              },
            },
            variant: { select: { id: true, name: true, sellingPrice: true } },
          },
        },
      },
    });
  }

  private findCustomerCartItem(customerId: string, cartItemId: string) {
    return this.prisma.cartItem.findFirst({
      where: { id: cartItemId, cart: { customerId } },
      select: {
        id: true,
        productId: true,
        quantity: true,
        modifierSnapshot: true,
      },
    });
  }

  private async calculateCartTotals(
    items: NonNullable<Awaited<ReturnType<typeof this.getCartWithItems>>>["items"],
  ) {
    const modifierIds = [
      ...new Set(
        items.flatMap((item) =>
          readCartModifiers(item.modifierSnapshot).map((modifier) => modifier.modifierId),
        ),
      ),
    ];
    const modifiers = modifierIds.length
      ? await this.prisma.modifier.findMany({
          where: { id: { in: modifierIds }, isActive: true },
          select: { id: true, name: true, price: true },
        })
      : [];
    let total = new Prisma.Decimal(0);
    const lines = items.map((item) => {
      const quantity = new Prisma.Decimal(item.quantity);
      const selectedModifiers = readCartModifiers(item.modifierSnapshot);
      const modifierTotal = selectedModifiers.reduce((sum, selected) => {
        const modifier = modifiers.find((candidate) => candidate.id === selected.modifierId);
        return modifier
          ? sum.add(modifier.price.mul(new Prisma.Decimal(selected.quantity)))
          : sum;
      }, new Prisma.Decimal(0));
      const unitPrice = item.variant?.sellingPrice ?? item.product.sellingPrice;
      const lineTotal = unitPrice.add(modifierTotal).mul(quantity);
      total = total.add(lineTotal);
      const modifierNames = selectedModifiers
        .map((selected) => modifiers.find((modifier) => modifier.id === selected.modifierId)?.name)
        .filter(Boolean)
        .join(", ");

      return [
        `${quantity.toNumber()}x <b>${escapeHtml(item.product.name)}</b>${item.variant ? ` ${escapeHtml(item.variant.name)}` : ""}`,
        modifierNames ? `  + ${escapeHtml(modifierNames)}` : "",
        `  ${formatMoney(lineTotal)}`,
      ].filter(Boolean).join("\n");
    });

    return { lines, total };
  }

  private async handleBack(
    chatId: string,
    customer: LinkedCustomer,
    step: CheckoutStep,
  ): Promise<void> {
    const target = { chatId };

    if (step === "ADDRESS") {
      await this.startCheckout(target, customer);
      return;
    }

    if (step === "NOTE") {
      const session = await this.getActiveCheckoutSession(customer.id, chatId);
      const branch = session?.branchId ? await this.findBranchForCheckout(session.branchId) : null;
      await this.upsertCheckoutSession(customer.id, chatId, {
        step: "ADDRESS",
        address: null,
        note: null,
      });
      if (branch) {
        await this.askDeliveryAddress(target, branch);
        return;
      }
    }

    await this.sendCart(target, customer);
  }

  private async lockCartLine(
    tx: Prisma.TransactionClient,
    cartId: string,
    productId: string,
    variantId: string | null,
  ): Promise<void> {
    await this.lockByKey(tx, ["telegram-cart-line", cartId, productId, variantId ?? ""]);
  }

  private async lockTelegramCart(
    tx: Prisma.TransactionClient,
    customerId: string,
  ): Promise<void> {
    await this.lockByKey(tx, ["telegram-cart", customerId]);
  }

  private async lockByKey(
    tx: Prisma.TransactionClient,
    values: string[],
  ): Promise<void> {
    const hash = createHash("sha256").update(values.join(":")).digest();
    const firstKey = hash.readInt32BE(0);
    const secondKey = hash.readInt32BE(4);

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${firstKey}, ${secondKey})`;
  }


  private orderTypeButtons(branch: BranchForCheckout) {
    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

    if (branchSupportsType(branch, CustomerOrderType.PICKUP)) {
      buttons.push([
        {
          text: "🚶 Olib ketish",
          callback_data: `${customerCallbackPrefix}:type:${CustomerOrderType.PICKUP}`,
        },
      ]);
    }

    if (branchSupportsType(branch, CustomerOrderType.DELIVERY)) {
      buttons.push([
        {
          text: "🚚 Yetkazib berish",
          callback_data: `${customerCallbackPrefix}:type:${CustomerOrderType.DELIVERY}`,
        },
      ]);
    }

    return buttons;
  }



  private async availableBranches(): Promise<BranchForCheckout[]> {
    return this.prisma.branch.findMany({
      where: {
        isActive: true,
        acceptsOrders: true,
        isTemporarilyClosed: false,
        OR: [{ pickupEnabled: true }, { deliveryEnabled: true }],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        acceptsOrders: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        isTemporarilyClosed: true,
      },
    });
  }

  private findBranchForCheckout(branchId: string): Promise<BranchForCheckout | null> {
    return this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        acceptsOrders: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        isTemporarilyClosed: true,
      },
    });
  }

  private async defaultBranchForType(
    orderType: CustomerOrderType,
  ): Promise<BranchForCheckout | null> {
    const branches = await this.availableBranches();

    return branches.find((branch) => branchSupportsType(branch, orderType)) ?? null;
  }

  private getActiveCheckoutSession(customerId: string, chatId: string) {
    return this.prisma.telegramCheckoutSession.findFirst({
      where: {
        customerId,
        chatId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  private upsertCheckoutSession(
    customerId: string,
    chatId: string,
    data: {
      step?: CheckoutStep;
      branchId?: string | null;
      orderType?: CustomerOrderType | null;
      address?: string | null;
      note?: string | null;
    },
  ) {
    const expiresAt = new Date(Date.now() + TELEGRAM_CHECKOUT_SESSION_TTL_MS);

    return this.prisma.telegramCheckoutSession.upsert({
      where: { customerId_chatId: { customerId, chatId } },
      create: {
        customerId,
        chatId,
        step: data.step ?? "ORDER_TYPE",
        branchId: data.branchId ?? null,
        orderType: data.orderType ?? null,
        address: data.address ?? null,
        note: data.note ?? null,
        expiresAt,
      },
      update: {
        ...("step" in data ? { step: data.step } : {}),
        ...("branchId" in data ? { branchId: data.branchId } : {}),
        ...("orderType" in data ? { orderType: data.orderType } : {}),
        ...("address" in data ? { address: data.address } : {}),
        ...("note" in data ? { note: data.note } : {}),
        expiresAt,
      },
    });
  }

  private clearCheckoutSession(customerId: string, chatId: string): Promise<unknown> {
    return this.prisma.telegramCheckoutSession
      .delete({ where: { customerId_chatId: { customerId, chatId } } })
      .catch(() => undefined);
  }



  private findLinkedCustomer(telegramUserId: number | string | undefined) {
    if (telegramUserId === undefined || telegramUserId === null) {
      return null;
    }

    return this.prisma.customer.findUnique({
      where: { telegramUserId: String(telegramUserId) },
      select: {
        id: true,
        name: true,
        phone: true,
        bonusBalance: true,
      },
    });
  }

  private async sendMainMenu(
    target: CustomerScreenTarget,
    name?: string | null,
    customerId?: string,
  ): Promise<void> {
    const cartLabel = await this.cartButtonLabel(customerId);
    await this.renderCustomerScreen(target, {
      text: [
        `Assalomu alaykum${name ? `, ${escapeHtml(name)}` : ""}!`,
        "",
        "Menyu, savat, filial va profilingiz tayyor.",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🍽 Menyu", callback_data: `${customerCallbackPrefix}:menu` },
            { text: cartLabel, callback_data: `${customerCallbackPrefix}:cart` },
          ],
          [
            { text: "📦 Buyurtmalarim", callback_data: `${customerCallbackPrefix}:orders` },
            { text: "📍 Filial", callback_data: `${customerCallbackPrefix}:branches` },
          ],
          [{ text: "👤 Profil", callback_data: `${customerCallbackPrefix}:profile` }],
        ],
      },
    });
  }


  private async cartButtonLabel(customerId?: string): Promise<string> {
    if (!customerId) {
      return "🛒 Savat";
    }

    const cart = await this.prisma.cart.findFirst({
      where: { customerId },
      include: { items: { select: { quantity: true } } },
    });
    const count = cart?.items.reduce((sum, item) => sum + Number(item.quantity), 0) ?? 0;
    return count > 0 ? `🛒 Savat (${count})` : "🛒 Savat";
  }


  private async sendLinkRequired(target: CustomerScreenTarget): Promise<void> {
    await this.renderCustomerScreen(target, {
      text: "Avval MAZETTO profilingizni ulang: /start bosing va telefon raqamingizni yuboring.",
    });
  }

  private callbackTarget(callback: TelegramCallbackQuery): CustomerScreenTarget {
    return {
      chatId: requiredTelegramId(callback.message?.chat?.id, "chat id"),
      ...(callback.id ? { callbackQueryId: callback.id } : {}),
      ...(callback.message?.message_id ? { messageId: callback.message.message_id } : {}),
    };
  }

  private async answerCallback(
    callback: TelegramCallbackQuery,
    text?: string,
    showAlert = false,
  ): Promise<void> {
    if (!callback.id) {
      return;
    }

    await this.telegramRequest("answerCallbackQuery", {
      callback_query_id: callback.id,
      ...(text ? { text } : {}),
      ...(showAlert ? { show_alert: true } : {}),
    }).catch(() => undefined);
  }

  private async renderCustomerScreen(
    target: CustomerScreenTarget,
    payload: CustomerScreenPayload,
  ): Promise<void> {
    if (target.messageId) {
      try {
        await this.telegramRequest("editMessageText", {
          chat_id: target.chatId,
          message_id: target.messageId,
          ...payload,
        });
        return;
      } catch (error) {
        if (isMessageNotModifiedError(error)) {
          return;
        }
      }
    }

    await this.telegramRequest("sendMessage", {
      chat_id: target.chatId,
      ...payload,
    });
  }


  private async telegramRequest(method: string, payload: unknown): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram ${method} failed with ${response.status}: ${body}`);
    }
  }







  private statusLabel(status: string, type?: string): string {
    return sharedOrderStatusLabel(status, type);
  }
}
