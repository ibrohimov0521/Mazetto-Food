import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { TelegramCustomerOrderingService } from "./telegram-customer-ordering.service";

type TelegramMessage = {
  chat?: { id?: number | string };
  from?: {
    id?: number | string;
    first_name?: string;
    last_name?: string;
  };
  text?: string;
  contact?: {
    phone_number?: string;
    user_id?: number | string;
    first_name?: string;
    last_name?: string;
  };
};
type TelegramCallbackQuery = {
  id?: string;
  data?: string;
  message?: {
    chat?: { id?: number | string };
    message_id?: number;
  };
  from?: { id?: number | string };
};

type TelegramUpdate = {
  callback_query?: TelegramCallbackQuery;
  message?: TelegramMessage;
};

type VerificationDelivery =
  | {
      channel: "TELEGRAM";
      status: "SENT";
      message: string;
      botUrl?: string;
    }
  | {
      channel: "TELEGRAM";
      status: "TELEGRAM_LINK_REQUIRED";
      message: string;
      botUrl?: string;
    }
  | {
      channel: "TELEGRAM";
      status: "PENDING_INTEGRATION";
      message: string;
      botUrl?: string;
    };

const CUSTOMER_CODE_TTL_MS = 10 * 60 * 1000;
const CUSTOMER_CODE_REQUEST_WINDOW_MS = 60 * 1000;
const CUSTOMER_CODE_REQUEST_LIMIT = 3;
const customerCallbackPrefix = "cust";

@Injectable()
export class TelegramCustomerAuthService {
  private readonly logger = new Logger(TelegramCustomerAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramCustomerOrderingService: TelegramCustomerOrderingService,
  ) {}

  async deliverVerificationCode(params: {
    phone: string;
    code: string;
  }): Promise<VerificationDelivery> {
    if (!this.hasBotToken()) {
      return this.withBotUrl({
        channel: "TELEGRAM",
        status: "PENDING_INTEGRATION",
        message:
          "Telegram tasdiqlash hozircha sozlanmagan. Bot token production muhitida kiritilishi kerak.",
      });
    }

    const customer = await this.prisma.customer.findUnique({
      where: { phone: params.phone },
      select: { telegramChatId: true },
    });

    if (!customer?.telegramChatId) {
      return this.withBotUrl({
        channel: "TELEGRAM",
        status: "TELEGRAM_LINK_REQUIRED",
        message:
          "Telefon raqam Telegram bilan bog'lanmagan. MAZETTO botga o'tib /start bosing va telefon raqamingizni yuboring.",
      });
    }

    await this.sendVerificationCode(customer.telegramChatId, params.code);

    return this.withBotUrl({
      channel: "TELEGRAM",
      status: "SENT",
      message: "Tasdiqlash kodi Telegram orqali yuborildi.",
    });
  }

  async handleWebhookUpdate(update: unknown) {
    const telegramUpdate = this.toTelegramUpdate(update);
    const callback = telegramUpdate.callback_query;
    const message = telegramUpdate.message;

    if (!message) {
      if (!callback?.data?.startsWith(`${customerCallbackPrefix}:`)) {
        return { ok: true, handled: false };
      }
    }

    try {
      if (callback?.data?.startsWith(`${customerCallbackPrefix}:`)) {
        await this.handleCustomerCallback(callback);
        return { ok: true, handled: true };
      }

      if (!message) {
        return { ok: true, handled: false };
      }

      if (message.contact) {
        await this.handleContactMessage(message);
        return { ok: true, handled: true };
      }

      if (message.text?.trim().startsWith("/start")) {
        await this.sendStartOrMainMenu(message);
        return { ok: true, handled: true };
      }

      const text = message.text?.trim();

      if (text === "🍽 Menyu") {
        await this.telegramCustomerOrderingService.sendCategoryMenu(message);
        return { ok: true, handled: true };
      }

      if (text === "📦 Buyurtmalarim") {
        await this.sendCustomerOrders(message);
        return { ok: true, handled: true };
      }

      if (text === "👤 Profil") {
        await this.sendCustomerProfile(message);
        return { ok: true, handled: true };
      }

      if (text === "📍 Filial") {
        await this.telegramCustomerOrderingService.sendBranches(message);
        return { ok: true, handled: true };
      }

      if (text === "🛒 Savat") {
        await this.telegramCustomerOrderingService.sendCartFromMessage(message);
        return { ok: true, handled: true };
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        this.logger.warn(error.message);
      } else {
        this.logger.error(
          "Telegram customer auth handling failed",
          error instanceof Error ? error.stack : String(error),
        );
      }
      await this.sendCustomerAuthError(message?.chat?.id ?? callback?.message?.chat?.id);
      return { ok: true, handled: true };
    }

    return { ok: true, handled: false };
  }

  private async handleContactMessage(message: TelegramMessage): Promise<void> {
    const chatId = this.requiredTelegramId(message.chat?.id, "chat id");
    const fromId = this.requiredTelegramId(message.from?.id, "user id");
    const contactUserId = message.contact?.user_id
      ? String(message.contact.user_id)
      : fromId;

    if (contactUserId !== fromId) {
      await this.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Iltimos, faqat o'zingizning telefon raqamingizni yuboring.",
      });
      return;
    }

    const phone = this.normalizePhone(message.contact?.phone_number ?? "");
    const displayName = this.displayName(message);
    const now = new Date();

    const { challenge } = await this.prisma.$transaction(async (tx) => {
      await this.assertCanCreateChallenge(tx, phone);
      const linkedToOtherPhone = await tx.customer.findFirst({
        where: { telegramUserId: fromId, phone: { not: phone } },
        select: { phone: true },
      });

      if (linkedToOtherPhone) {
        throw new BadRequestException(
          "Bu Telegram account boshqa telefon raqamga bog'langan.",
        );
      }

      const customer = await tx.customer.upsert({
        where: { phone },
        update: {
          name: displayName,
          telegramUserId: fromId,
          telegramChatId: chatId,
          telegramLinkedAt: now,
        },
        create: {
          name: displayName,
          phone,
          telegramUserId: fromId,
          telegramChatId: chatId,
          telegramLinkedAt: now,
        },
        select: { id: true, phone: true },
      });

      await this.expireActiveChallenges(tx, customer.phone);
      const code = this.generateVerificationCode();
      const challenge = await tx.customerVerificationChallenge.create({
        data: {
          customerId: customer.id,
          phone: customer.phone,
          codeHash: await bcrypt.hash(code, 12),
          expiresAt: new Date(Date.now() + CUSTOMER_CODE_TTL_MS),
        },
        select: { id: true },
      });

      return { customer, challenge: { ...challenge, code } };
    });

    await this.sendVerificationCode(chatId, challenge.code);
    await this.sendMainMenu(chatId, displayName);
  }

  private async sendStartOrMainMenu(message: TelegramMessage) {
    const chatId = message.chat?.id;

    if (!chatId || !this.hasBotToken()) {
      return;
    }

    const fromId = message.from?.id ? String(message.from.id) : undefined;
    const linkedCustomer = fromId
      ? await this.prisma.customer.findUnique({
          where: { telegramUserId: fromId },
          select: { name: true },
        })
      : null;

    if (linkedCustomer) {
      await this.sendMainMenu(String(chatId), linkedCustomer.name);
      return;
    }

    await this.telegramRequest("sendMessage", {
      chat_id: String(chatId),
      text:
        "MAZETTO FOOD profilini ulash uchun telefon raqamingizni yuboring. Keyin web sahifada kodni kiriting.",
      reply_markup: {
        keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  private async handleCustomerCallback(callback: TelegramCallbackQuery): Promise<void> {
    await this.telegramCustomerOrderingService.handleCustomerCallback(callback);
  }

  private async sendMainMenu(chatId: string, name?: string | null): Promise<void> {
    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: [
        `Assalomu alaykum${name ? `, ${this.escapeHtml(name)}` : ""}!`,
        "",
        "MAZETTO FOOD botida menyuni ko'rishingiz, buyurtmalaringizni tekshirishingiz va profilingizni boshqarishingiz mumkin.",
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

  private async sendCategoryMenu(message: TelegramMessage): Promise<void> {
    const chatId = this.requiredTelegramId(message.chat?.id, "chat id");
    const customer = await this.findLinkedCustomer(message.from?.id);

    if (!customer) {
      await this.sendStartOrMainMenu(message);
      return;
    }

    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    });
    const sorted = [...categories].sort((a, b) => (a.code === "SETS" ? -1 : 0) - (b.code === "SETS" ? -1 : 0));

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
          [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
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
      text: [
        "🍽 <b>Mahsulotlar</b>",
        "",
        ...products.flatMap((product) => {
          const variant = product.variants.find((item) => item.isDefault) ?? product.variants[0];
          return [
            `<b>${this.escapeHtml(product.name)}</b>`,
            `${this.escapeHtml(product.description ?? "Buyurtmadan keyin tayyorlanadi.")}`,
            `Narx: ${this.formatMoney(variant?.sellingPrice ?? product.sellingPrice)}`,
            "",
          ];
        }),
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "⬅️ Bo'limlarga qaytish", callback_data: `${customerCallbackPrefix}:home` }]],
      },
    });
  }

  private async sendCustomerOrders(message: TelegramMessage): Promise<void> {
    const chatId = this.requiredTelegramId(message.chat?.id, "chat id");
    const customer = await this.findLinkedCustomer(message.from?.id);

    if (!customer) {
      await this.sendStartOrMainMenu(message);
      return;
    }

    const orders = await this.prisma.customerOrder.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        branch: { select: { name: true } },
        order: { select: { orderNumber: true, status: true, total: true } },
      },
    });

    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: orders.length
        ? [
            "📦 <b>Buyurtmalaringiz</b>",
            "",
            ...orders.map((order) =>
              [
                `<b>${this.escapeHtml(order.order.orderNumber)}</b>`,
                `${this.escapeHtml(order.branch.name)} · ${this.statusLabel(order.order.status)}`,
                `Jami: ${this.formatMoney(order.order.total)}`,
              ].join("\n"),
            ),
          ].join("\n\n")
        : "Hali buyurtmalaringiz yo'q. Menyudan taom tanlab buyurtma berishingiz mumkin.",
      parse_mode: "HTML",
    });
  }

  private async sendCustomerProfile(message: TelegramMessage): Promise<void> {
    const chatId = this.requiredTelegramId(message.chat?.id, "chat id");
    const customer = await this.findLinkedCustomer(message.from?.id);

    if (!customer) {
      await this.sendStartOrMainMenu(message);
      return;
    }

    const orderCount = await this.prisma.customerOrder.count({
      where: { customerId: customer.id },
    });

    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: [
        "👤 <b>Profil</b>",
        "",
        `<b>Ism:</b> ${this.escapeHtml(customer.name)}`,
        `<b>Telefon:</b> ${this.escapeHtml(customer.phone)}`,
        `<b>Buyurtmalar:</b> ${orderCount}`,
        `<b>Bonus:</b> ${this.formatMoney(customer.bonusBalance)}`,
      ].join("\n"),
      parse_mode: "HTML",
    });
  }

  private async sendBranches(message: TelegramMessage): Promise<void> {
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
            branch.acceptsOrders && !branch.isTemporarilyClosed ? "Buyurtma qabul qilmoqda" : "Hozir buyurtma qabul qilmayapti",
            `${branch.pickupEnabled ? "Olib ketish ✅" : "Olib ketish ❌"} · ${branch.deliveryEnabled ? "Yetkazib berish ✅" : "Yetkazib berish ❌"}`,
          ].join("\n"),
        ),
      ].join("\n\n"),
      parse_mode: "HTML",
    });
  }

  private async sendCartPlaceholder(message: TelegramMessage): Promise<void> {
    const chatId = this.requiredTelegramId(message.chat?.id, "chat id");
    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: "🛒 Telegram savat orqali buyurtma berish navbatdagi bosqichda to'liq ulanadi. Hozircha web sayt orqali buyurtma berishingiz mumkin.",
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

  private async sendVerificationCode(
    chatId: string,
    code: string,
  ): Promise<void> {
    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: [
        "MAZETTO FOOD tasdiqlash kodi:",
        "",
        `<b>${this.escapeHtml(code)}</b>`,
        "",
        "Kod 10 daqiqa amal qiladi. Uni web sahifadagi tasdiqlash oynasiga kiriting.",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    });
  }

  private async sendCustomerAuthError(
    chatId: number | string | undefined,
  ): Promise<void> {
    if (!chatId || !this.hasBotToken()) {
      return;
    }

    await this.telegramRequest("sendMessage", {
      chat_id: String(chatId),
      text:
        "Telefon raqamni bog'lashda xatolik bo'ldi. Iltimos, /start bosib qayta urinib ko'ring.",
    }).catch(() => undefined);
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

  private async assertCanCreateChallenge(
    tx: Prisma.TransactionClient,
    phone: string,
  ): Promise<void> {
    const recentRequests = await tx.customerVerificationChallenge.count({
      where: {
        phone,
        createdAt: {
          gte: new Date(Date.now() - CUSTOMER_CODE_REQUEST_WINDOW_MS),
        },
      },
    });

    if (recentRequests >= CUSTOMER_CODE_REQUEST_LIMIT) {
      throw new BadRequestException(
        "Too many verification code requests. Please wait before trying again.",
      );
    }
  }

  private async expireActiveChallenges(
    tx: Prisma.TransactionClient,
    phone: string,
  ): Promise<void> {
    const now = new Date();

    await tx.customerVerificationChallenge.updateMany({
      where: {
        phone,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
  }

  private displayName(message: TelegramMessage): string {
    const parts = [
      message.contact?.first_name ?? message.from?.first_name,
      message.contact?.last_name ?? message.from?.last_name,
    ]
      .filter(Boolean)
      .map((part) => String(part).trim())
      .filter(Boolean);

    return parts.join(" ") || this.normalizePhone(message.contact?.phone_number ?? "");
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

  private toTelegramUpdate(update: unknown): TelegramUpdate {
    return update && typeof update === "object" ? (update as TelegramUpdate) : {};
  }

  private generateVerificationCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  private normalizePhone(phone: string): string {
    const normalized = phone.trim().replace(/[^\d+]/g, "");

    if (!normalized || normalized.length < 7 || normalized.length > 20) {
      throw new BadRequestException("Phone number is invalid");
    }

    return normalized.startsWith("998") ? `+${normalized}` : normalized;
  }

  private hasBotToken(): boolean {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN);
  }

  private customerBotUrl(): string | undefined {
    return process.env.TELEGRAM_CUSTOMER_BOT_URL || process.env.TELEGRAM_BOT_URL;
  }

  private withBotUrl(delivery: VerificationDelivery): VerificationDelivery {
    const botUrl = this.customerBotUrl();

    return botUrl ? { ...delivery, botUrl } : delivery;
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

  private formatMoney(value: Prisma.Decimal | number | string): string {
    return `${Number(value).toLocaleString("uz-UZ")} so'm`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}
