import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";

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

type TelegramUpdate = {
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

@Injectable()
export class TelegramCustomerAuthService {
  private readonly logger = new Logger(TelegramCustomerAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    const message = this.toTelegramUpdate(update).message;

    if (!message) {
      return { ok: true, handled: false };
    }

    try {
      if (message.contact) {
        await this.handleContactMessage(message);
        return { ok: true, handled: true };
      }

      if (message.text?.trim().startsWith("/start")) {
        await this.sendStartMessage(message.chat?.id);
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
      await this.sendCustomerAuthError(message.chat?.id);
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
  }

  private async sendStartMessage(chatId: number | string | undefined) {
    if (!chatId || !this.hasBotToken()) {
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

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}
