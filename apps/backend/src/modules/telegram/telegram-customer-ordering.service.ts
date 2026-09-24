import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  customerVisibleCategoryCodes,
  customerVisibleProductCodeSet,
  customerVisibleProductWhere,
} from "../customers/customer-catalog-visibility";
import { CustomerOrderEngineService } from "../customers/customer-order-engine.service";
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
import { TelegramCustomerOrderHistoryService } from "./telegram-customer-order-history.service";
import {
  TelegramCustomerScreenService,
  type CustomerScreenPayload,
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
  location?: {
    latitude?: number;
    longitude?: number;
    horizontal_accuracy?: number;
  };
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
    private readonly orderHistory: TelegramCustomerOrderHistoryService,
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
      await this.orderHistory.sendOrders(target, customer);
      return true;
    }

    if (action === "order" && values[0] && values[1]) {
      await this.screen.answerCallback(callback);
      if (values[0] === "detail") {
        await this.orderHistory.sendOrderDetail(target, customer, values[1]);
      } else if (values[0] === "repeat") {
        await this.orderHistory.repeatOrder(target, customer, values[1]);
      }
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

    if ((action === "prod" || action === "p") && values[0]) {
      await this.screen.answerCallback(callback);
      const legacyFormat = values.length >= 4;
      await this.sendProductConfigurator(target, values[0], {
        ...(legacyFormat ? { categoryId: values[1] } : {}),
        quantity: legacyFormat ? values[2] : values[1],
        variantId: legacyFormat ? values[3] : values[2],
      });
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

    if ((action === "addp" || action === "a") && values[0]) {
      await this.addProductToCart(
        target,
        callback,
        customer,
        values[0],
        values[1],
        values[2],
        values[3],
      );
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

    if (action === "clear" && values[0]) {
      await this.screen.answerCallback(callback);
      await this.handleCartClear(target, customer, values[0]);
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

    if (action === "address" && values[0]) {
      await this.screen.answerCallback(callback);
      await this.checkout.handleAddressChoice(target, customer, values[0]);
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

    if (text === "🏠 Bosh menyu") {
      await this.checkoutSession.clearCheckoutSession(customer.id, chatId);
      await this.sendMainMenu({ chatId }, customer.name, customer.id);
      return true;
    }

    const session = await this.checkoutSession.getActiveCheckoutSession(
      customer.id,
      chatId,
    );

    if (!session) {
      return false;
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

  async handleCustomerCommand(
    message: TelegramMessage,
    command: string,
  ): Promise<boolean> {
    const normalized = command.toLowerCase().replace(/@[^\s]+$/, "");

    if (normalized === "/menu" || normalized === "/buy") {
      await this.sendCategoryMenu(message);
      return true;
    }
    if (normalized === "/cart") {
      await this.sendCartFromMessage(message);
      return true;
    }
    if (normalized === "/branches") {
      await this.sendBranches(message);
      return true;
    }
    if (normalized === "/orders") {
      const chatId = requiredTelegramId(message.chat?.id, "chat id");
      const customer = await this.findLinkedCustomer(message.from?.id);
      if (!customer) {
        await this.screen.sendLinkRequired({ chatId });
      } else {
        await this.orderHistory.sendOrders({ chatId }, customer);
      }
      return true;
    }
    if (normalized === "/profile") {
      const chatId = requiredTelegramId(message.chat?.id, "chat id");
      const customer = await this.findLinkedCustomer(message.from?.id);
      if (!customer) {
        await this.screen.sendLinkRequired({ chatId });
      } else {
        await this.sendCustomerProfile({ chatId }, customer);
      }
      return true;
    }
    if (normalized === "/cancel") {
      const chatId = requiredTelegramId(message.chat?.id, "chat id");
      const customer = await this.findLinkedCustomer(message.from?.id);
      if (customer) {
        await this.checkoutSession.clearCheckoutSession(customer.id, chatId);
        await this.sendMainMenu({ chatId }, customer.name, customer.id);
      }
      return true;
    }
    if (normalized === "/support" || normalized === "/help") {
      const chatId = requiredTelegramId(message.chat?.id, "chat id");
      await this.screen.renderCustomerScreen(
        { chatId },
        {
          text: "Yordam kerak bo'lsa, /menu orqali menyuni oching yoki operatorga murojaat qiling.",
        },
      );
      return true;
    }
    if (normalized === "/terms") {
      const chatId = requiredTelegramId(message.chat?.id, "chat id");
      await this.screen.renderCustomerScreen(
        { chatId },
        {
          text: "Foydalanish shartlari: buyurtmani tasdiqlaganingizdan keyin filial uni tayyorlashni boshlaydi. Yetkazib berish hududi va vaqtiga qarab operator aniqlashtirishi mumkin.",
        },
      );
      return true;
    }

    return false;
  }

  async handleCustomerLocation(message: TelegramMessage): Promise<boolean> {
    const chatId = requiredTelegramId(message.chat?.id, "chat id");
    const customer = await this.findLinkedCustomer(message.from?.id);
    const location = message.location;
    if (
      !customer ||
      !location ||
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude)
    ) {
      return false;
    }

    const session = await this.checkoutSession.getActiveCheckoutSession(
      customer.id,
      chatId,
    );
    if (session?.step !== "ADDRESS") {
      return false;
    }

    await this.checkout.acceptDeliveryLocation(chatId, customer, {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      ...(Number.isFinite(location.horizontal_accuracy)
        ? { accuracyMeters: Number(location.horizontal_accuracy) }
        : {}),
    });
    return true;
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
      parse_mode: "HTML" as const,
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
      parse_mode: "HTML" as const,
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
      select: { code: true, name: true, imageUrl: true },
    });

    if (category?.code === "LAVASH" || category?.code === "BURGER") {
      await this.sendPairedCanonicalProductsForCategory(
        target,
        customerId,
        categoryId,
        category.code,
        category.imageUrl,
      );
      return;
    }

    const products = await this.prisma.product.findMany({
      where: {
        categoryId,
        isAvailable: true,
        ...customerVisibleProductWhere(),
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
    const productButtons = products.map((product) => ({
      text: telegramProductButtonLabel(product.code, product.name, product.category?.code),
      callback_data: `${customerCallbackPrefix}:prod:${product.id}`,
    }));
    const columns = productButtons.some((button) => button.text.length > 18) ? 1 : 2;
    const payload: CustomerScreenPayload = {
      text: [
        `🍽 <b>${escapeHtml(category?.name ?? "Mahsulotlar")}</b>`,
        "Mahsulotni tanlang, keyingi sahifada miqdorini belgilang.",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...chunkButtons(
            productButtons,
            columns,
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
    };
    const categoryPhotoUrl =
      products.find((product) => product.imageUrl)?.imageUrl ?? category?.imageUrl;
    if (categoryPhotoUrl) {
      await this.screen.renderCustomerPhotoScreen(target, {
        photo: categoryPhotoUrl,
        caption: payload.text,
        parse_mode: "HTML",
        reply_markup: payload.reply_markup!,
      });
      return;
    }
    await this.screen.renderCustomerScreen(target, payload);
  }

  private async sendPairedCanonicalProductsForCategory(
    target: CustomerScreenTarget,
    customerId: string,
    categoryId: string,
    categoryCode: "LAVASH" | "BURGER",
    categoryImageUrl?: string | null,
  ): Promise<void> {
    const configuredRows =
      categoryCode === "LAVASH" ? lavashTelegramRows : burgerTelegramRows;
    const products = await this.prisma.product.findMany({
      where: {
        categoryId,
        isAvailable: true,
        ...customerVisibleProductWhere(),
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
    const categoryPhotoUrl =
      products.find((product) => product.imageUrl)?.imageUrl ?? categoryImageUrl;
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
            return {
              text: telegramProductButtonLabel(
                product.code,
                product.name,
                categoryCode,
              ),
              callback_data: `${customerCallbackPrefix}:prod:${product.id}`,
            };
          }),
      )
      .filter((row) => row.length > 0);
    const configuredProductCodes = new Set<string>(configuredRows.flat());
    const additionalButtons = products
      .filter((product) => !configuredProductCodes.has(product.code))
      .map((product) => ({
        text: telegramProductButtonLabel(
          product.code,
          product.name,
          categoryCode,
        ),
        callback_data: `${customerCallbackPrefix}:prod:${product.id}`,
      }));
    rows.push(...chunkButtons(additionalButtons, 2));

    const cartLabel = await this.cartButtonLabel(customerId);

    const payload: CustomerScreenPayload = {
      text: [
        categoryCode === "LAVASH"
          ? "🌯 <b>Lavashlar</b>"
          : "🍔 <b>Burgerlar</b>",
        "",
        "Chapda mol go'shtli, o'ngda tovuqli mahsulotlar.",
        "Mahsulotni tanlang, keyingi sahifada miqdorini belgilang.",
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
    };
    if (categoryPhotoUrl) {
      await this.screen.renderCustomerPhotoScreen(target, {
        photo: categoryPhotoUrl,
        caption: payload.text,
        parse_mode: "HTML",
        reply_markup: payload.reply_markup!,
      });
      return;
    }
    await this.screen.renderCustomerScreen(target, payload);
  }

  private async sendProductConfigurator(
    target: CustomerScreenTarget,
    productId: string,
    selection: {
      categoryId?: string | undefined;
      quantity?: string | undefined;
      variantId?: string | undefined;
    } = {},
  ): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isAvailable: true,
        ...customerVisibleProductWhere(),
      },
      include: {
        category: { select: { id: true, name: true } },
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
    }) ?? await this.prisma.product.findFirst({
      where: {
        code: productId,
        isAvailable: true,
        ...customerVisibleProductWhere(),
      },
      include: {
        category: { select: { id: true, name: true } },
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

    const categoryId = selection.categoryId || product.category.id;
    const quantity = Math.max(1, Math.min(99, Number(selection.quantity) || 1));
    const selectedVariant =
      product.variants.find((variant) => variant.id === selection.variantId) ??
      product.variants.find((variant) => variant.isDefault) ??
      product.variants[0] ??
      null;
    const price = selectedVariant?.sellingPrice ?? product.sellingPrice;
    const productToken = this.callbackToken(product) ?? product.id;
    const state = (
      nextQuantity: number,
      variantToken = this.callbackToken(selectedVariant) ?? "-",
    ) =>
      `${customerCallbackPrefix}:p:${productToken}:${nextQuantity}:${variantToken}`;
    const controls = [
      ...(product.variants.length > 1
        ? product.variants.map((variant) => [
            {
              text: `${variant.id === selectedVariant?.id ? "✓ " : ""}${variant.name} · ${formatMoney(variant.sellingPrice)}`,
              callback_data: state(quantity, this.callbackToken(variant) ?? variant.id),
            },
          ])
        : []),
      [
        { text: "−", callback_data: state(Math.max(1, quantity - 1)) },
        { text: String(quantity), callback_data: state(quantity) },
        { text: "+", callback_data: state(Math.min(99, quantity + 1)) },
      ],
      [
        {
          text: "🛒 Savatga qo'shish",
          callback_data: `${customerCallbackPrefix}:a:${productToken}:${this.callbackToken(selectedVariant) ?? "-"}:${quantity}`,
        },
      ],
      [
        {
          text: "⬅️ Orqaga",
          callback_data: `${customerCallbackPrefix}:cat:${categoryId}`,
        },
      ],
    ];
    const payload = {
      text: [
        `🍽 <b>${escapeHtml(product.name)}</b>`,
        `Narxi: <b>${formatMoney(price)}</b>`,
        "",
        escapeHtml(product.description ?? "Buyurtmadan keyin tayyorlanadi."),
        product.modifiers.length
          ? "\nQo'shimchalarni savatda mahsulotga biriktirasiz."
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      parse_mode: "HTML" as const,
      reply_markup: { inline_keyboard: controls },
    };

    if (product.imageUrl) {
      await this.screen.renderCustomerPhotoScreen(target, {
        photo: product.imageUrl,
        caption: payload.text,
        parse_mode: payload.parse_mode,
        reply_markup: payload.reply_markup,
      });
      return;
    }

    await this.screen.renderCustomerScreen(target, payload);
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
        ...customerVisibleProductWhere(),
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
    }) ?? await this.prisma.product.findFirst({
      where: {
        code: productId,
        isAvailable: true,
        ...customerVisibleProductWhere(),
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

    if (
      !product ||
      !customerVisibleProductCodeSet.has(product.code) ||
      !isSimpleQuickAddProduct(product)
    ) {
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
          ...customerVisibleProductWhere(),
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

    await this.addCartItem(customer.id, variant.productId, variant.id);
    await this.screen.answerCallback(callback, "Savatga qo'shildi ✅");
    await this.sendProductsForCategory(
      target,
      customer.id,
      variant.product.categoryId,
    );
  }

  private async addProductToCart(
    target: CustomerScreenTarget,
    callback: TelegramCallbackQuery,
    customer: LinkedCustomer,
    productId: string,
    rawVariantId?: string,
    rawQuantity?: string,
    categoryId?: string,
  ): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isAvailable: true,
        ...customerVisibleProductWhere(),
      },
      include: {
        modifiers: {
          where: { modifier: { isActive: true } },
          orderBy: { sortOrder: "asc" },
          include: { modifier: true },
        },
      },
    }) ?? await this.prisma.product.findFirst({
      where: {
        code: productId,
        isAvailable: true,
        ...customerVisibleProductWhere(),
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

    const variant =
      rawVariantId && rawVariantId !== "-"
        ? (await this.prisma.productVariant.findFirst({
            where: {
              id: rawVariantId,
              productId: product.id,
              isAvailable: true,
            },
            select: { id: true },
          }) ?? await this.prisma.productVariant.findFirst({
            where: {
              code: rawVariantId,
              productId: product.id,
              isAvailable: true,
            },
            select: { id: true },
          }))
        : null;
    if (rawVariantId && rawVariantId !== "-" && !variant) {
      await this.screen.answerCallback(
        callback,
        "Tanlangan tur hozir mavjud emas.",
        true,
      );
      await this.sendProductConfigurator(target, product.id, {
        ...(categoryId ? { categoryId } : {}),
      });
      return;
    }

    const quantity = Math.max(1, Math.min(99, Number(rawQuantity) || 1));
    await this.addCartItem(
      customer.id,
      product.id,
      variant?.id ?? null,
      quantity,
    );
    await this.screen.answerCallback(callback, "Savatga qo'shildi ✅");
    await this.sendProductsForCategory(
      target,
      customer.id,
      categoryId ?? product.categoryId,
    );
  }

  private async addCartItem(
    customerId: string,
    productId: string,
    variantId: string | null,
    quantity = 1,
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
            quantity: new Prisma.Decimal(existing.quantity).add(quantity),
          },
          select: { id: true },
        });
      }

      return tx.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variantId,
          quantity: new Prisma.Decimal(quantity),
          modifierSnapshot: [],
        },
        select: { id: true },
      });
    });
  }

  private callbackToken(
    record: { code?: string | null; id?: string | null } | null | undefined,
  ): string | null {
    const code = record?.code?.trim();
    return code || record?.id || null;
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

  private async handleCartClear(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
    choice: string,
  ): Promise<void> {
    if (choice === "confirm") {
      const count = await this.cart.clearCart(customer.id);
      await this.screen.renderCustomerScreen(target, {
        text: count ? "🗑 Savat bo'shatildi." : "🛒 Savat allaqachon bo'sh.",
        reply_markup: { inline_keyboard: [
          [{ text: "🍽 Menyu", callback_data: `${customerCallbackPrefix}:menu` }],
          [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
        ] },
      });
      return;
    }
    await this.screen.renderCustomerScreen(target, {
      text: "Savatdagi barcha mahsulotlar o'chiriladi. Davom etasizmi?",
      reply_markup: { inline_keyboard: [
        [{ text: "🗑 Ha, bo'shatish", callback_data: `${customerCallbackPrefix}:clear:confirm` }],
        [{ text: "⬅️ Savatga qaytish", callback_data: `${customerCallbackPrefix}:cart` }],
      ] },
    });
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

    if (step === "ADDRESS_CONFIRM") {
      const session = await this.checkoutSession.getActiveCheckoutSession(customer.id, chatId);
      const branch = session?.branchId
        ? await this.checkoutSession.findBranchForCheckout(session.branchId)
        : null;
      await this.checkoutSession.upsertCheckoutSession(customer.id, chatId, { step: "ADDRESS" });
      if (branch) {
        await this.checkout.askDeliveryAddress(target, branch);
        return;
      }
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
        keyboard: [
          ["🍽 Menyu", cartLabel],
          ["📦 Buyurtmalarim", "📍 Filial"],
          ["👤 Profil", "🏠 Bosh menyu"],
        ],
        resize_keyboard: true,
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
