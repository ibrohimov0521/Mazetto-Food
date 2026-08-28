import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { OrderSource, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CustomerOrderEngineService } from "../customers/customer-order-engine.service";
import {
  OnlineOrderTypeDto,
  OnlinePaymentMethodDto,
} from "../customers/dto/customer.dto";

type TelegramMessage = {
  chat?: { id?: number | string };
  from?: { id?: number | string; first_name?: string; last_name?: string };
};
type TelegramCallbackQuery = {
  id?: string;
  data?: string;
  message?: { chat?: { id?: number | string } };
  from?: { id?: number | string };
};
type LinkedCustomer = {
  id: string;
  name: string;
  phone: string;
  bonusBalance: Prisma.Decimal;
};
type CartModifier = {
  modifierId: string;
  quantity: number;
};

const customerCallbackPrefix = "cust";

@Injectable()
export class TelegramCustomerOrderingService {
  private readonly logger = new Logger(TelegramCustomerOrderingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customerOrderEngine: CustomerOrderEngineService,
  ) {}

  async handleCustomerCallback(callback: TelegramCallbackQuery): Promise<boolean> {
    const chatId = callback.message?.chat?.id;
    const data = callback.data ?? "";

    if (!data.startsWith(`${customerCallbackPrefix}:`) || !chatId) {
      return false;
    }

    if (callback.id) {
      await this.telegramRequest("answerCallbackQuery", {
        callback_query_id: callback.id,
      }).catch(() => undefined);
    }

    const [, action, ...values] = data.split(":");
    const customer = await this.findLinkedCustomer(callback.from?.id);

    if (!customer) {
      await this.sendLinkRequired(String(chatId));
      return true;
    }

    if (action === "home") {
      await this.sendMainMenu(String(chatId), customer.name);
      return true;
    }

    if (action === "cat" && values[0]) {
      await this.sendProductsForCategory(String(chatId), values[0]);
      return true;
    }

    if (action === "prod" && values[0]) {
      await this.sendProductConfigurator(String(chatId), values[0]);
      return true;
    }

    if (action === "addv" && values[0]) {
      await this.addVariantToCart(String(chatId), customer, values[0]);
      return true;
    }

    if (action === "addp" && values[0]) {
      await this.addProductToCart(String(chatId), customer, values[0]);
      return true;
    }

    if (action === "mod" && values[0] && values[1]) {
      await this.toggleCartModifier(String(chatId), customer, values[0], values[1]);
      return true;
    }

    if (action === "qty" && values[0] && values[1]) {
      await this.changeCartQuantity(String(chatId), customer, values[0], values[1]);
      return true;
    }

    if (action === "rm" && values[0]) {
      await this.removeCartItem(String(chatId), customer, values[0]);
      return true;
    }

    if (action === "cart") {
      await this.sendCart(String(chatId), customer);
      return true;
    }

    if (action === "checkout") {
      await this.sendCheckoutSummary(String(chatId), customer);
      return true;
    }

    if (action === "confirm" && values[0]) {
      await this.confirmCartOrder(String(chatId), customer, values[0]);
      return true;
    }

    await this.telegramRequest("sendMessage", {
      chat_id: String(chatId),
      text: "Bu tugma eskirgan bo'lishi mumkin. Iltimos, bosh menyudan qayta tanlang.",
    });
    return true;
  }

  async sendCategoryMenu(message: TelegramMessage): Promise<void> {
    const chatId = this.requiredTelegramId(message.chat?.id, "chat id");
    const customer = await this.findLinkedCustomer(message.from?.id);

    if (!customer) {
      await this.sendLinkRequired(chatId);
      return;
    }

    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    });
    const sorted = [...categories].sort(
      (a, b) => (a.code === "SETS" ? -1 : 0) - (b.code === "SETS" ? -1 : 0),
    );

    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: "🍽 <b>Menyu bo'limini tanlang</b>",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...sorted.map((category) => [
            {
              text: this.categoryButtonLabel(category.code, category.name),
              callback_data: `${customerCallbackPrefix}:cat:${category.id}`,
            },
          ]),
          [{ text: "🛒 Savat", callback_data: `${customerCallbackPrefix}:cart` }],
          [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  async sendCartFromMessage(message: TelegramMessage): Promise<void> {
    const chatId = this.requiredTelegramId(message.chat?.id, "chat id");
    const customer = await this.findLinkedCustomer(message.from?.id);

    if (!customer) {
      await this.sendLinkRequired(chatId);
      return;
    }

    await this.sendCart(chatId, customer);
  }

  async sendBranches(message: TelegramMessage): Promise<void> {
    const chatId = this.requiredTelegramId(message.chat?.id, "chat id");
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        name: true,
        address: true,
        acceptsOrders: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        isTemporarilyClosed: true,
      },
    });

    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: [
        "📍 <b>Filiallar</b>",
        "",
        ...branches.map((branch) =>
          [
            `<b>${this.escapeHtml(branch.name)}</b>`,
            this.escapeHtml(branch.address ?? "Manzil kiritilmagan"),
            branch.acceptsOrders && !branch.isTemporarilyClosed
              ? "Buyurtma qabul qilmoqda"
              : "Hozir buyurtma qabul qilmayapti",
            `${branch.pickupEnabled ? "Olib ketish ✅" : "Olib ketish ❌"} · ${branch.deliveryEnabled ? "Yetkazib berish ✅" : "Yetkazib berish ❌"}`,
          ].join("\n"),
        ),
      ].join("\n\n"),
      parse_mode: "HTML",
    });
  }

  private async sendProductsForCategory(chatId: string, categoryId: string): Promise<void> {
    const products = await this.prisma.product.findMany({
      where: { categoryId, isAvailable: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 8,
      include: {
        variants: {
          where: { isAvailable: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    });

    if (!products.length) {
      await this.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Bu bo'limda hozircha mahsulot yo'q.",
      });
      return;
    }

    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: "🍽 <b>Mahsulot tanlang</b>",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...products.map((product) => {
            const variant =
              product.variants.find((item) => item.isDefault) ?? product.variants[0];
            return [
              {
                text: `${product.name} · ${this.formatMoney(variant?.sellingPrice ?? product.sellingPrice)}`,
                callback_data: `${customerCallbackPrefix}:prod:${product.id}`,
              },
            ];
          }),
          [{ text: "⬅️ Bo'limlarga qaytish", callback_data: `${customerCallbackPrefix}:home` }],
          [{ text: "🛒 Savat", callback_data: `${customerCallbackPrefix}:cart` }],
        ],
      },
    });
  }

  private async sendProductConfigurator(chatId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isAvailable: true },
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
      await this.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Mahsulot topilmadi yoki hozir mavjud emas.",
      });
      return;
    }

    const variantButtons = product.variants.length
      ? product.variants.map((variant) => [
          {
            text: `${variant.name} · ${this.formatMoney(variant.sellingPrice)}`,
            callback_data: `${customerCallbackPrefix}:addv:${variant.id}`,
          },
        ])
      : [[{
          text: `Savatga qo'shish · ${this.formatMoney(product.sellingPrice)}`,
          callback_data: `${customerCallbackPrefix}:addp:${product.id}`,
        }]];

    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: [
        `🍽 <b>${this.escapeHtml(product.name)}</b>`,
        product.category?.name ? this.escapeHtml(product.category.name) : "",
        "",
        this.escapeHtml(product.description ?? "Buyurtmadan keyin tayyorlanadi."),
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

  private async addVariantToCart(
    chatId: string,
    customer: LinkedCustomer,
    variantId: string,
  ): Promise<void> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, isAvailable: true, product: { isAvailable: true } },
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
      await this.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Variant topilmadi yoki hozir mavjud emas.",
      });
      return;
    }

    const cartItem = await this.addCartItem(customer.id, variant.productId, variant.id);
    await this.sendCartItemConfigured(chatId, cartItem.id, variant.product.name, variant.product.modifiers);
  }

  private async addProductToCart(
    chatId: string,
    customer: LinkedCustomer,
    productId: string,
  ): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isAvailable: true },
      include: {
        modifiers: {
          where: { modifier: { isActive: true } },
          orderBy: { sortOrder: "asc" },
          include: { modifier: true },
        },
      },
    });

    if (!product) {
      await this.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Mahsulot topilmadi yoki hozir mavjud emas.",
      });
      return;
    }

    const cartItem = await this.addCartItem(customer.id, product.id, null);
    await this.sendCartItemConfigured(chatId, cartItem.id, product.name, product.modifiers);
  }

  private async addCartItem(
    customerId: string,
    productId: string,
    variantId: string | null,
  ) {
    const cart = await this.getOrCreateCart(customerId);

    return this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        variantId,
        quantity: new Prisma.Decimal(1),
        modifierSnapshot: [],
      },
      select: { id: true },
    });
  }

  private async sendCartItemConfigured(
    chatId: string,
    cartItemId: string,
    productName: string,
    modifiers: Array<{ modifierId: string; modifier: { name: string; price: Prisma.Decimal } }>,
  ): Promise<void> {
    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: `✅ <b>${this.escapeHtml(productName)}</b> savatga qo'shildi.`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...modifiers.map((item) => [
            {
              text: `+ ${item.modifier.name} · ${this.formatMoney(item.modifier.price)}`,
              callback_data: `${customerCallbackPrefix}:mod:${cartItemId}:${item.modifierId}`,
            },
          ]),
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

  private async toggleCartModifier(
    chatId: string,
    customer: LinkedCustomer,
    cartItemId: string,
    modifierId: string,
  ): Promise<void> {
    const item = await this.findCustomerCartItem(customer.id, cartItemId);

    if (!item) {
      await this.sendCart(chatId, customer);
      return;
    }

    const allowed = await this.prisma.productModifier.findFirst({
      where: {
        productId: item.productId,
        modifierId,
        modifier: { isActive: true },
      },
      include: { modifier: true },
    });

    if (!allowed) {
      throw new BadRequestException("Modifier is not available for this product");
    }

    const current = this.readCartModifiers(item.modifierSnapshot);
    const exists = current.some((modifier) => modifier.modifierId === modifierId);
    const next = exists
      ? current.filter((modifier) => modifier.modifierId !== modifierId)
      : [...current, { modifierId, quantity: 1 }];

    await this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { modifierSnapshot: next },
    });

    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: exists
        ? `${allowed.modifier.name} savatdan olib tashlandi.`
        : `${allowed.modifier.name} qo'shildi.`,
    });
    await this.sendCart(chatId, customer);
  }

  private async changeCartQuantity(
    chatId: string,
    customer: LinkedCustomer,
    cartItemId: string,
    direction: string,
  ): Promise<void> {
    const item = await this.findCustomerCartItem(customer.id, cartItemId);

    if (!item) {
      await this.sendCart(chatId, customer);
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

    await this.sendCart(chatId, customer);
  }

  private async removeCartItem(
    chatId: string,
    customer: LinkedCustomer,
    cartItemId: string,
  ): Promise<void> {
    const item = await this.findCustomerCartItem(customer.id, cartItemId);

    if (item) {
      await this.prisma.cartItem.delete({ where: { id: cartItemId } });
    }

    await this.sendCart(chatId, customer);
  }

  private async sendCart(chatId: string, customer: LinkedCustomer): Promise<void> {
    const cart = await this.getCartWithItems(customer.id);

    if (!cart?.items.length) {
      await this.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "🛒 Savatingiz bo'sh. Menyudan taom tanlang.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🍽 Menyu", callback_data: `${customerCallbackPrefix}:home` }],
          ],
        },
      });
      return;
    }

    const totals = await this.calculateCartTotals(cart.items);

    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: [
        "🛒 <b>Savat</b>",
        "",
        ...totals.lines,
        "",
        `<b>Jami: ${this.formatMoney(totals.total)}</b>`,
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...cart.items.flatMap((item) => [
            [
              { text: `− ${item.product.name}`, callback_data: `${customerCallbackPrefix}:qty:${item.id}:dec` },
              { text: "+", callback_data: `${customerCallbackPrefix}:qty:${item.id}:inc` },
            ],
            [{ text: `O'chirish · ${item.product.name}`, callback_data: `${customerCallbackPrefix}:rm:${item.id}` }],
          ]),
          [{ text: "✅ Buyurtma berish", callback_data: `${customerCallbackPrefix}:checkout` }],
          [{ text: "🍽 Menyuga qaytish", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  private async sendCheckoutSummary(chatId: string, customer: LinkedCustomer): Promise<void> {
    const cart = await this.getCartWithItems(customer.id);

    if (!cart?.items.length) {
      await this.sendCart(chatId, customer);
      return;
    }

    const branch = await this.defaultBranch();

    if (!branch) {
      await this.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Hozir buyurtma qabul qiladigan filial topilmadi.",
      });
      return;
    }

    const totals = await this.calculateCartTotals(cart.items);

    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: [
        "✅ <b>Buyurtmani tasdiqlash</b>",
        "",
        `Filial: <b>${this.escapeHtml(branch.name)}</b>`,
        "Turi: <b>Olib ketish</b>",
        "To'lov: <b>Naqd</b>",
        "",
        ...totals.lines,
        "",
        `<b>Jami: ${this.formatMoney(totals.total)}</b>`,
        "",
        "Click/Payme to'lovlari provider tasdig'i ulanmaguncha Telegramda yakunlangan deb belgilanmaydi.",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Tasdiqlash", callback_data: `${customerCallbackPrefix}:confirm:${cart.id}` }],
          [{ text: "⬅️ Savatga qaytish", callback_data: `${customerCallbackPrefix}:cart` }],
        ],
      },
    });
  }

  private async confirmCartOrder(
    chatId: string,
    customer: LinkedCustomer,
    cartId: string,
  ): Promise<void> {
    const cart = await this.getCartWithItems(customer.id);

    if (!cart || cart.id !== cartId || !cart.items.length) {
      await this.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Bu tasdiqlash eskirgan. Iltimos, savatni qayta tekshiring.",
      });
      return;
    }

    const branch = await this.defaultBranch();

    if (!branch) {
      await this.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Hozir buyurtma qabul qiladigan filial topilmadi.",
      });
      return;
    }

    try {
      const result = await this.customerOrderEngine.createOnlineOrder(
        customer.id,
        {
          branchId: branch.id,
          idempotencyKey: `telegram:${customer.id}:${cart.id}:${cart.updatedAt.getTime()}`,
          name: customer.name,
          type: OnlineOrderTypeDto.PICKUP,
          paymentMethod: OnlinePaymentMethodDto.CASH,
          notes: "Telegram orqali buyurtma",
          items: cart.items.map((item) => ({
            productId: item.productId,
            ...(item.variantId ? { variantId: item.variantId } : {}),
            quantity: Number(item.quantity),
            modifiers: this.readCartModifiers(item.modifierSnapshot),
            ...(item.notes ? { notes: item.notes } : {}),
          })),
        },
        { source: OrderSource.TELEGRAM, orderNumberPrefix: "TG" },
      );

      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await this.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: [
          "🎉 <b>Buyurtma qabul qilindi</b>",
          "",
          `Raqam: <b>${this.escapeHtml(result.order?.orderNumber ?? "-")}</b>`,
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
        chat_id: chatId,
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

  private getCartWithItems(customerId: string) {
    return this.prisma.cart.findFirst({
      where: { customerId },
      orderBy: { updatedAt: "desc" },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            product: { select: { id: true, name: true, sellingPrice: true } },
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
          this.readCartModifiers(item.modifierSnapshot).map((modifier) => modifier.modifierId),
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
      const selectedModifiers = this.readCartModifiers(item.modifierSnapshot);
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
        `${quantity.toNumber()}x <b>${this.escapeHtml(item.product.name)}</b>${item.variant ? ` ${this.escapeHtml(item.variant.name)}` : ""}`,
        modifierNames ? `  + ${this.escapeHtml(modifierNames)}` : "",
        `  ${this.formatMoney(lineTotal)}`,
      ].filter(Boolean).join("\n");
    });

    return { lines, total };
  }

  private async defaultBranch() {
    return this.prisma.branch.findFirst({
      where: {
        isActive: true,
        acceptsOrders: true,
        pickupEnabled: true,
        isTemporarilyClosed: false,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });
  }

  private readCartModifiers(value: Prisma.JsonValue | null): CartModifier[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return [];
      }

      const modifierId = "modifierId" in item ? String(item.modifierId) : "";
      const quantity =
        "quantity" in item && Number(item.quantity) > 0 ? Number(item.quantity) : 1;

      return modifierId ? [{ modifierId, quantity }] : [];
    });
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

  private async sendMainMenu(chatId: string, name?: string | null): Promise<void> {
    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: [
        `Assalomu alaykum${name ? `, ${this.escapeHtml(name)}` : ""}!`,
        "",
        "Menyu, savat, filial va profilingiz tayyor.",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [
          ["🍽 Menyu", "🛒 Savat"],
          ["📦 Buyurtmalarim", "📍 Filial"],
          ["👤 Profil"],
        ],
        resize_keyboard: true,
      },
    });
  }

  private async sendLinkRequired(chatId: string): Promise<void> {
    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: "Avval MAZETTO profilingizni ulang: /start bosing va telefon raqamingizni yuboring.",
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

  private requiredTelegramId(
    value: number | string | undefined,
    label: string,
  ): string {
    if (value === undefined || value === null || String(value).trim() === "") {
      throw new BadRequestException(`Telegram ${label} is missing`);
    }

    return String(value);
  }

  private formatMoney(value: Prisma.Decimal | number | string): string {
    const amount = Number(value);

    return `${new Intl.NumberFormat("uz-UZ").format(amount)} so'm`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  private categoryButtonLabel(code: string | null | undefined, name: string): string {
    const icons: Record<string, string> = {
      BURGER: "🍔",
      CHICKEN_BURGER: "🍔",
      CHICKEN_LAVASH: "🍗",
      DONER: "🥙",
      DRINKS: "🥤",
      FAST_FOOD: "🍟",
      HOT_DOG: "🌭",
      LAVASH: "🌯",
      SAUCES: "🥫",
      SETS: "🔥",
    };

    return `${icons[code ?? ""] ?? "🍽"} ${name}`;
  }

  private statusLabel(status: string): string {
    const labels: Record<string, string> = {
      CANCELLED: "Bekor qilindi",
      COMPLETED: "Yakunlandi",
      CONFIRMED: "Qabul qilindi",
      NEW: "Yangi",
      PREPARING: "Tayyorlanmoqda",
      READY: "Tayyor",
      SERVED: "Berildi",
    };

    return labels[status] ?? this.escapeHtml(status);
  }
}
