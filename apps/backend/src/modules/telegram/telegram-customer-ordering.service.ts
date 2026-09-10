import { orderStatusLabel as sharedOrderStatusLabel } from "../../common/utils/order-status-label";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  customerVisibleCategoryCodes,
  customerVisibleProductCodes,
} from "../customers/customer-catalog-visibility";
import { CustomerOrderEngineService } from "../customers/customer-order-engine.service";
import {
} from "../customers/dto/customer.dto";
import { TelegramOrderNotificationService } from "./telegram-order-notification.service";
import {
  branchMapUrl,
  burgerTelegramRows,
  categoryButtonLabel,
  chunkButtons,
  customerCallbackPrefix,
  type LinkedCustomer,
  escapeHtml,
  formatMoney,
  isSimpleQuickAddProduct,
  lavashTelegramRows,
  maskPhone,
  readCartModifiers,
  requiredTelegramId,
  telegramProductButtonLabel,
} from "./telegram-customer-presentation";
import {
  TelegramCustomerScreenService,
  type CustomerScreenTarget,
  type TelegramCallbackQuery,
} from "./telegram-customer-screen.service";
import {
  TelegramCheckoutSessionService,
  type CheckoutStep,
} from "./telegram-checkout-session.service";
import { TelegramCartService } from "./telegram-cart.service";
import { TelegramCheckoutService } from "./telegram-checkout.service";

type TelegramMessage = {
  chat?: { id?: number | string };
  from?: { id?: number | string; first_name?: string; last_name?: string };
  text?: string;
};

@Injectable()
export class TelegramCustomerOrderingService {
  private readonly logger = new Logger(TelegramCustomerOrderingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customerOrderEngine: CustomerOrderEngineService,
    private readonly telegramOrderNotificationService: TelegramOrderNotificationService,
    private readonly screen: TelegramCustomerScreenService,
    private readonly checkoutSession: TelegramCheckoutSessionService,
    private readonly cart: TelegramCartService,
    private readonly checkout: TelegramCheckoutService,
  ) {}

  async handleCustomerCallback(
    callback: TelegramCallbackQuery,
  ): Promise<boolean> {
    const chatId = callback.message?.chat?.id;
    const data = callback.data ?? "";

    if (!data.startsWith(`${customerCallbackPrefix}:`) || !chatId) {
      return false;
    }

    const [, action, ...values] = data.split(":");
    const customer = await this.findLinkedCustomer(callback.from?.id);
    const target = this.screen.callbackTarget(callback);

    if (!customer) {
      await this.screen.sendLinkRequired(target);
      return true;
    }

    if (action === "home") {
      await this.screen.answerCallback(callback);
      await this.sendMainMenu(target, customer.name, customer.id);
      return true;
    }

    if (action === "menu") {
      await this.screen.answerCallback(callback);
      await this.sendCategoryMenuToTarget(target, customer.id);
      return true;
    }

    if (action === "branches") {
      await this.screen.answerCallback(callback);
      await this.sendBranchesToTarget(target);
      return true;
    }

    if (action === "orders") {
      await this.screen.answerCallback(callback);
      await this.sendCustomerOrders(target, customer);
      return true;
    }

    if (action === "profile") {
      await this.screen.answerCallback(callback);
      await this.sendCustomerProfile(target, customer);
      return true;
    }

    if (action === "cat" && values[0]) {
      await this.screen.answerCallback(callback);
      await this.sendProductsForCategory(target, customer.id, values[0]);
      return true;
    }

    if (action === "prod" && values[0]) {
      await this.screen.answerCallback(callback);
      await this.sendProductConfigurator(target, values[0]);
      return true;
    }

    if (action === "qprod" && values[0]) {
      await this.quickAddSimpleProduct(
        target,
        callback,
        customer,
        values[0],
        values[1],
      );
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
      await this.screen.answerCallback(
        callback,
        "Bu menyu eskirgan. Qayta oching.",
        true,
      );
      await this.cart.sendCart(target, customer);
      return true;
    }

    if (action === "qty" && values[0] && values[1]) {
      await this.screen.answerCallback(callback);
      await this.changeCartQuantity(target, customer, values[0], values[1]);
      return true;
    }

    if (action === "cart") {
      await this.screen.answerCallback(callback);
      await this.cart.sendCart(target, customer);
      return true;
    }

    if (action === "checkout") {
      await this.screen.answerCallback(callback);
      await this.checkout.startCheckout(target, customer);
      return true;
    }

    if (action === "type" && values[0]) {
      await this.screen.answerCallback(callback);
      await this.checkout.selectOrderType(target, customer, values[0]);
      return true;
    }

    if (action === "note" && values[0]) {
      await this.screen.answerCallback(callback);
      await this.checkout.handleNoteChoice(target, customer, values[0]);
      return true;
    }

    if (action === "confirm" && values[0]) {
      await this.screen.answerCallback(callback);
      await this.checkout.confirmCartOrder(target, customer, values[0]);
      return true;
    }

    await this.screen.answerCallback(
      callback,
      "Bu menyu eskirgan. Qayta oching.",
      true,
    );
    await this.screen.renderCustomerScreen(target, {
      text: "Bu tugma eskirgan bo'lishi mumkin. Iltimos, bosh menyudan qayta tanlang.",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🏠 Bosh menyu",
              callback_data: `${customerCallbackPrefix}:home`,
            },
          ],
        ],
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

    const session = await this.checkoutSession.getActiveCheckoutSession(
      customer.id,
      chatId,
    );

    if (!session) {
      return false;
    }

    if (text === "🏠 Bosh menyu") {
      await this.checkoutSession.clearCheckoutSession(customer.id, chatId);
      await this.sendMainMenu({ chatId }, customer.name, customer.id);
      return true;
    }

    if (text === "⬅️ Orqaga") {
      await this.handleBack(chatId, customer, session.step as CheckoutStep);
      return true;
    }

    if (session.step === "ADDRESS") {
      await this.checkout.acceptDeliveryAddress(chatId, customer, text);
      return true;
    }

    if (session.step === "NOTE") {
      await this.checkout.acceptDeliveryNote(chatId, customer, text);
      return true;
    }

    return false;
  }

  async sendCategoryMenu(message: TelegramMessage): Promise<void> {
    const chatId = requiredTelegramId(message.chat?.id, "chat id");
    const customer = await this.findLinkedCustomer(message.from?.id);

    if (!customer) {
      await this.screen.sendLinkRequired({ chatId });
      return;
    }

    await this.sendCategoryMenuToTarget({ chatId }, customer.id);
  }

  private async sendCategoryMenuToTarget(
    target: CustomerScreenTarget,
    customerId?: string,
  ): Promise<void> {
    const categories = await this.prisma.category.findMany({
      where: {
        isActive: true,
        code: { in: [...customerVisibleCategoryCodes] },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    });
    const sorted = [...categories].sort(
      (a, b) => (a.code === "SETS" ? -1 : 0) - (b.code === "SETS" ? -1 : 0),
    );

    const cartLabel = await this.cartButtonLabel(customerId);

    await this.screen.renderCustomerScreen(target, {
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
          [
            {
              text: cartLabel,
              callback_data: `${customerCallbackPrefix}:cart`,
            },
          ],
          [
            {
              text: "🏠 Bosh menyu",
              callback_data: `${customerCallbackPrefix}:home`,
            },
          ],
        ],
      },
    });
  }

  async sendCartFromMessage(message: TelegramMessage): Promise<void> {
    const chatId = requiredTelegramId(message.chat?.id, "chat id");
    const customer = await this.findLinkedCustomer(message.from?.id);

    if (!customer) {
      await this.screen.sendLinkRequired({ chatId });
      return;
    }

    await this.cart.sendCart({ chatId }, customer);
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

  private async sendBranchesToTarget(
    target: CustomerScreenTarget,
  ): Promise<void> {
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

    await this.screen.renderCustomerScreen(target, {
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
          [
            {
              text: "🏠 Bosh menyu",
              callback_data: `${customerCallbackPrefix}:home`,
            },
          ],
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
        order: {
          select: {
            orderNumber: true,
            displayOrderNumber: true,
            status: true,
            total: true,
          },
        },
      },
    });

    await this.screen.renderCustomerScreen(target, {
      text: orders.length
        ? [
            "📦 <b>Buyurtmalaringiz</b>",
            "",
            ...orders.map((order) =>
              [
                `<b>${escapeHtml(order.order.displayOrderNumber ?? order.order.orderNumber)}</b>`,
                `${escapeHtml(order.branch.name)} · ${sharedOrderStatusLabel(order.order.status, order.type)}`,
                `Jami: ${formatMoney(order.order.total)}`,
              ].join("\n"),
            ),
          ].join("\n\n")
        : "Hali buyurtmalaringiz yo'q. Menyudan taom tanlab buyurtma berishingiz mumkin.",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🍽 Menyu",
              callback_data: `${customerCallbackPrefix}:menu`,
            },
          ],
          [
            {
              text: "🏠 Bosh menyu",
              callback_data: `${customerCallbackPrefix}:home`,
            },
          ],
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

    await this.screen.renderCustomerScreen(target, {
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
          [
            {
              text: "📦 Buyurtmalarim",
              callback_data: `${customerCallbackPrefix}:orders`,
            },
          ],
          [
            {
              text: "🏠 Bosh menyu",
              callback_data: `${customerCallbackPrefix}:home`,
            },
          ],
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
      await this.screen.renderCustomerScreen(target, {
        text: "Bu bo'limda hozircha mahsulot yo'q.",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "⬅️ Bo'limlarga qaytish",
                callback_data: `${customerCallbackPrefix}:menu`,
              },
            ],
          ],
        },
      });
      return;
    }

    const cartLabel = await this.cartButtonLabel(customerId);
    const hasQuickAddableProducts = products.some((product) =>
      isSimpleQuickAddProduct(product),
    );

    await this.screen.renderCustomerScreen(target, {
      text: [
        "🍽 <b>Mahsulot tanlang</b>",
        hasQuickAddableProducts
          ? "\nBitta turdagi mahsulotlar bir bosishda savatga qo'shiladi."
          : "",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...chunkButtons(
            products.map((product) => {
              const variant =
                product.variants.find((item) => item.isDefault) ??
                product.variants[0];
              const quickAddable = isSimpleQuickAddProduct(product);
              return {
                text: `${quickAddable ? "➕ " : ""}${product.name} · ${formatMoney(variant?.sellingPrice ?? product.sellingPrice)}`,
                callback_data: quickAddable
                  ? `${customerCallbackPrefix}:qprod:${product.id}:${categoryId}`
                  : `${customerCallbackPrefix}:prod:${product.id}`,
              };
            }),
            2,
          ),
          [
            {
              text: "⬅️ Bo'limlarga qaytish",
              callback_data: `${customerCallbackPrefix}:menu`,
            },
          ],
          [
            {
              text: cartLabel,
              callback_data: `${customerCallbackPrefix}:cart`,
            },
          ],
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
    const configuredRows =
      categoryCode === "LAVASH" ? lavashTelegramRows : burgerTelegramRows;
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
    const productByCode = new Map(
      products.map((product) => [product.code, product]),
    );
    const rows = configuredRows
      .map((row) =>
        row
          .map((code) => productByCode.get(code))
          .filter((product): product is NonNullable<typeof product> =>
            Boolean(product),
          )
          .map((product) => {
            const variant =
              product.variants.find((item) => item.isDefault) ??
              product.variants[0];
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

    await this.screen.renderCustomerScreen(target, {
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
          [
            {
              text: "⬅️ Bo'limlarga qaytish",
              callback_data: `${customerCallbackPrefix}:menu`,
            },
          ],
          [
            {
              text: cartLabel,
              callback_data: `${customerCallbackPrefix}:cart`,
            },
          ],
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
      await this.screen.renderCustomerScreen(target, {
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
      : [
          [
            {
              text: `Savatga qo'shish · ${formatMoney(product.sellingPrice)}`,
              callback_data: `${customerCallbackPrefix}:addp:${product.id}`,
            },
          ],
        ];

    await this.screen.renderCustomerScreen(target, {
      text: [
        `🍽 <b>${escapeHtml(product.name)}</b>`,
        product.category?.name ? escapeHtml(product.category.name) : "",
        "",
        escapeHtml(product.description ?? "Buyurtmadan keyin tayyorlanadi."),
        product.modifiers.length
          ? "\nQo'shimchalarni mahsulot savatga qo'shilgandan keyin tanlaysiz."
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...variantButtons,
          [
            {
              text: "⬅️ Menyuga qaytish",
              callback_data: `${customerCallbackPrefix}:home`,
            },
          ],
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
      await this.screen.answerCallback(
        callback,
        "Bu mahsulotni qayta tanlang.",
        true,
      );
      if (product) {
        await this.sendProductConfigurator(target, product.id);
      }
      return;
    }

    const variant =
      product.variants.find((item) => item.isDefault) ??
      product.variants[0] ??
      null;
    await this.addCartItem(customer.id, product.id, variant?.id ?? null);
    await this.screen.answerCallback(callback, "Savatga qo'shildi ✅");

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
      await this.screen.answerCallback(
        callback,
        "Variant topilmadi yoki mavjud emas.",
        true,
      );
      await this.screen.renderCustomerScreen(target, {
        text: "Variant topilmadi yoki hozir mavjud emas.",
      });
      return;
    }

    const cartItem = await this.addCartItem(
      customer.id,
      variant.productId,
      variant.id,
    );
    await this.screen.answerCallback(callback, "Savatga qo'shildi ✅");
    await this.sendCartItemConfigured(
      target,
      cartItem.id,
      variant.product.name,
    );
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
      await this.screen.answerCallback(
        callback,
        "Mahsulot topilmadi yoki mavjud emas.",
        true,
      );
      await this.screen.renderCustomerScreen(target, {
        text: "Mahsulot topilmadi yoki hozir mavjud emas.",
      });
      return;
    }

    const cartItem = await this.addCartItem(customer.id, product.id, null);
    await this.screen.answerCallback(callback, "Savatga qo'shildi ✅");
    await this.sendCartItemConfigured(target, cartItem.id, product.name);
  }

  private async addCartItem(
    customerId: string,
    productId: string,
    variantId: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.cart.lockTelegramCart(tx, customerId);
      const cart = await this.cart.getOrCreateCartForTransaction(
        tx,
        customerId,
      );
      await this.cart.lockCartLine(tx, cart.id, productId, variantId);

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

  private async sendCartItemConfigured(
    target: CustomerScreenTarget,
    cartItemId: string,
    productName: string,
  ): Promise<void> {
    await this.screen.renderCustomerScreen(target, {
      text: `✅ <b>${escapeHtml(productName)}</b> savatga qo'shildi.`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "−",
              callback_data: `${customerCallbackPrefix}:qty:${cartItemId}:dec`,
            },
            {
              text: "+",
              callback_data: `${customerCallbackPrefix}:qty:${cartItemId}:inc`,
            },
          ],
          [
            {
              text: "🛒 Savatni ko'rish",
              callback_data: `${customerCallbackPrefix}:cart`,
            },
          ],
          [
            {
              text: "🍽 Menyuga qaytish",
              callback_data: `${customerCallbackPrefix}:home`,
            },
          ],
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
    const item = await this.cart.findCustomerCartItem(customer.id, cartItemId);

    if (!item) {
      await this.cart.sendCart(target, customer);
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

    await this.cart.sendCart(target, customer);
  }

  private async handleBack(
    chatId: string,
    customer: LinkedCustomer,
    step: CheckoutStep,
  ): Promise<void> {
    const target = { chatId };

    if (step === "ADDRESS") {
      await this.checkout.startCheckout(target, customer);
      return;
    }

    if (step === "NOTE") {
      const session = await this.checkoutSession.getActiveCheckoutSession(
        customer.id,
        chatId,
      );
      const branch = session?.branchId
        ? await this.checkoutSession.findBranchForCheckout(session.branchId)
        : null;
      await this.checkoutSession.upsertCheckoutSession(customer.id, chatId, {
        step: "ADDRESS",
        address: null,
        note: null,
      });
      if (branch) {
        await this.checkout.askDeliveryAddress(target, branch);
        return;
      }
    }

    await this.cart.sendCart(target, customer);
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
    await this.screen.renderCustomerScreen(target, {
      text: [
        `Assalomu alaykum${name ? `, ${escapeHtml(name)}` : ""}!`,
        "",
        "Menyu, savat, filial va profilingiz tayyor.",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🍽 Menyu",
              callback_data: `${customerCallbackPrefix}:menu`,
            },
            {
              text: cartLabel,
              callback_data: `${customerCallbackPrefix}:cart`,
            },
          ],
          [
            {
              text: "📦 Buyurtmalarim",
              callback_data: `${customerCallbackPrefix}:orders`,
            },
            {
              text: "📍 Filial",
              callback_data: `${customerCallbackPrefix}:branches`,
            },
          ],
          [
            {
              text: "👤 Profil",
              callback_data: `${customerCallbackPrefix}:profile`,
            },
          ],
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
    const count =
      cart?.items.reduce((sum, item) => sum + Number(item.quantity), 0) ?? 0;
    return count > 0 ? `🛒 Savat (${count})` : "🛒 Savat";
  }
}
