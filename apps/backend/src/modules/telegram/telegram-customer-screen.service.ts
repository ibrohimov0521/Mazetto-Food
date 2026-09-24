import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  isMessageNotModifiedError,
  requiredTelegramId,
} from "./telegram-customer-presentation";

/*
 * Telegram mijoz botining EKRAN (transport) qatlami.
 *
 * NIMA UCHUN AJRATILDI. Bu yerdagi metodlar buyurtma mantig'iga umuman
 * bog'liq emas — ular faqat "xabarni chiz" va "Telegram'ga so'rov yubor"
 * degan ishni bajaradi. Ular buyurtma servisi ichida turganda checkout
 * oqimini alohida servisga chiqarish MUMKIN EMAS edi: checkout ularni
 * chaqiradi, ular esa buyurtma servisida yashaydi — halqa bog'liqlik.
 *
 * Endi bog'liqlik yo'nalishi bir tomonlama: buyurtma -> ekran,
 * checkout -> ekran. Ekran hech kimga qaramaydi.
 */

export type TelegramCallbackQuery = {
  id?: string;
  data?: string;
  message?: { chat?: { id?: number | string }; message_id?: number };
  from?: { id?: number | string };
};

export type CustomerScreenTarget = {
  chatId: string;
  callbackQueryId?: string;
  messageId?: number;
};

export type TelegramInlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

export type TelegramReplyButton =
  | string
  | { text: string; request_location?: boolean; request_contact?: boolean };

export type CustomerScreenPayload = {
  text: string;
  parse_mode?: "HTML";
  /*
   * Telegram ikki xil klaviatura beradi va ular ALMASHTIRILMAYDI:
   *
   * `inline_keyboard` — xabar ostidagi tugmalar, callback yuboradi.
   * `keyboard` — pastdagi doimiy klaviatura, oddiy matn yuboradi.
   *
   * Manzil va izoh so'ralganda ikkinchisi ishlatiladi, chunki mijoz
   * javobni O'ZI yozadi va shu bilan birga "Orqaga" tugmasi ham kerak.
   */
  reply_markup?: {
    inline_keyboard?: TelegramInlineButton[][];
    keyboard?: TelegramReplyButton[][];
    resize_keyboard?: boolean;
  };
};

export type CustomerPhotoScreenPayload = Omit<CustomerScreenPayload, "text"> & {
  photo: string;
  caption: string;
};

function mediaPublicUrl(): string {
  return (
    process.env.MEDIA_PUBLIC_URL?.trim() ||
    process.env.MINIO_PUBLIC_URL?.trim() ||
    "https://media.mazettofood.uz"
  ).replace(/[/]+$/, "");
}

function customerWebPublicUrl(): string {
  return (
    process.env.CUSTOMER_WEB_PUBLIC_URL?.trim() || "https://mazettofood.uz"
  ).replace(/[/]+$/, "");
}

const telegramRequestMaxAttempts = 2;
const telegramRequestRetryDelayMs = 250;

export function resolveTelegramPhotoUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    const objectName = trimmed.replace(/^[/]+/, "");
    if (!objectName) return null;
    if (/^(products|categories)\//i.test(objectName)) {
      // The customer web rewrites these catalog paths to its full-resolution
      // canonical assets. Telegram must render the same catalog image.
      return `${customerWebPublicUrl()}/${objectName}`;
    }
    return `${mediaPublicUrl()}/${objectName}`;
  }
}

@Injectable()
export class TelegramCustomerScreenService implements OnModuleInit {
  private readonly logger = new Logger(TelegramCustomerScreenService.name);

  async onModuleInit(): Promise<void> {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return;
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.configureBotCommands();
        return;
      } catch (error) {
        this.logger.warn(
          `Telegram command menu setup failed (attempt ${attempt}/3): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
        }
      }
    }
  }

  private async configureBotCommands(): Promise<void> {
    await this.telegramRequest("setMyCommands", {
      commands: [
        { command: "start", description: "Foydalanishni boshlash" },
        { command: "buy", description: "Buyurtma berish" },
        { command: "menu", description: "Menyu" },
        { command: "cart", description: "Savat" },
        { command: "orders", description: "Buyurtmalarim" },
        { command: "profile", description: "Profil" },
        { command: "branches", description: "Filiallar" },
        { command: "help", description: "Xizmat haqida" },
        { command: "terms", description: "Foydalanish shartlari" },
        { command: "support", description: "Biz bilan aloqa" },
      ],
    });
    await this.telegramRequest("setChatMenuButton", {
      menu_button: { type: "commands" },
    });
  }

  /*
   * Bitta ekran — bitta xabar.
   *
   * Yangi xabar yuborish o'rniga MAVJUDINI tahrirlaydi: aks holda mijoz
   * menyu bo'ylab yurganda suhbat o'nlab bir xil xabar bilan to'lib
   * ketardi. Tahrirlash imkoni bo'lmasa (xabar id'si yo'q yoki xabar
   * juda eski) yangisi yuboriladi.
   */
  async renderCustomerScreen(
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
        /*
         * "message is not modified" — nosozlik EMAS: bir xil holat ikki
         * marta kelgan. Bu holda yangi xabar ham yubormaymiz, aks holda
         * har takroriy bosish suhbatga nusxa qo'shardi.
         */
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

  /** Product cards need a real Telegram photo, while all other screens stay text. */
  async renderCustomerPhotoScreen(
    target: CustomerScreenTarget,
    payload: CustomerPhotoScreenPayload,
  ): Promise<void> {
    const { photo, caption, ...rest } = payload;
    const photoUrl = resolveTelegramPhotoUrl(photo);

    // Telegram `sendPhoto` accepts a publicly reachable HTTP(S) URL, not the
    // relative paths historically stored for some catalogue images. Do not let
    // a bad image make the whole menu unusable.
    if (!photoUrl) {
      await this.renderCustomerScreen(target, {
        text: caption,
        ...rest,
      });
      return;
    }

    const fallbackToText = async () =>
      this.renderCustomerScreen(target, {
        text: caption,
        ...rest,
      });

    if (target.messageId) {
      try {
        await this.telegramRequest("editMessageMedia", {
          chat_id: target.chatId,
          message_id: target.messageId,
          media: {
            type: "photo",
            media: photoUrl,
            caption,
            ...(rest.parse_mode ? { parse_mode: rest.parse_mode } : {}),
          },
          ...rest,
        });
        return;
      } catch (error) {
        if (isMessageNotModifiedError(error)) {
          return;
        }
      }

      // Editing only the caption leaves the previous screen's photo in place.
      // If Telegram cannot replace the media in-place, send a fresh photo
      // instead of silently keeping an image from another catalog item.
      try {
        await this.telegramRequest("deleteMessage", {
          chat_id: target.chatId,
          message_id: target.messageId,
        });
      } catch {
        // The message may already be too old to delete; still send the right one.
      }
    }

    try {
      await this.telegramRequest("sendPhoto", {
        chat_id: target.chatId,
        photo: photoUrl,
        caption,
        ...rest,
      });
    } catch {
      await fallbackToText();
    }
  }

  async telegramRequest(method: string, payload: unknown): Promise<void> {
    await this.telegramRequestWithToken(process.env.TELEGRAM_BOT_TOKEN, method, payload);
  }

  async telegramRequestWithToken(
    token: string | undefined,
    method: string,
    payload: unknown,
  ): Promise<void> {

    // Token yo'q — bot o'chiq. Bu xato emas, ilova ishlayveradi.
    if (!token) {
      return;
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= telegramRequestMaxAttempts; attempt += 1) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${token}/${method}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(8_000),
          },
        );

        if (response.ok) {
          return;
        }

        const body = await response.text();
        const error = new Error(
          `Telegram ${method} failed with ${response.status}: ${body}`,
        );

        if (!this.shouldRetryTelegramRequest(error, response.status) || attempt === telegramRequestMaxAttempts) {
          throw error;
        }

        lastError = error;
      } catch (error) {
        if (!this.shouldRetryTelegramRequest(error) || attempt === telegramRequestMaxAttempts) {
          throw error;
        }

        lastError = error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, telegramRequestRetryDelayMs * attempt),
      );
    }

    throw lastError instanceof Error ? lastError : new Error(`Telegram ${method} failed`);
  }

  private shouldRetryTelegramRequest(error: unknown, status?: number): boolean {
    if (status && (status === 429 || status >= 500)) {
      return true;
    }

    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes("fetch failed") ||
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("abort")
    );
  }

  async renderWithToken(
    token: string | undefined,
    target: CustomerScreenTarget,
    payload: CustomerScreenPayload,
  ): Promise<void> {
    if (!token) {
      return;
    }
    if (target.messageId) {
      try {
        await this.telegramRequestWithToken(token, "editMessageText", {
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
    await this.telegramRequestWithToken(token, "sendMessage", {
      chat_id: target.chatId,
      ...payload,
    });
  }

  async answerCallbackWithToken(
    token: string | undefined,
    callback: TelegramCallbackQuery,
    text?: string,
    showAlert = false,
  ): Promise<void> {
    if (!token || !callback.id) {
      return;
    }
    await this.telegramRequestWithToken(token, "answerCallbackQuery", {
      callback_query_id: callback.id,
      ...(text ? { text } : {}),
      ...(showAlert ? { show_alert: true } : {}),
    }).catch(() => undefined);
  }

  /*
   * Callback javobi — Telegram'dagi tugmadagi "soatchani" to'xtatadi.
   * Xatosi YUTILADI: javob bermaslik foydalanuvchiga faqat aylanayotgan
   * indikator ko'rsatadi, asosiy amalni esa buzmasligi kerak.
   */
  async answerCallback(
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

  callbackTarget(callback: TelegramCallbackQuery): CustomerScreenTarget {
    return {
      chatId: requiredTelegramId(callback.message?.chat?.id, "chat id"),
      ...(callback.id ? { callbackQueryId: callback.id } : {}),
      ...(callback.message?.message_id
        ? { messageId: callback.message.message_id }
        : {}),
    };
  }

  async sendLinkRequired(target: CustomerScreenTarget): Promise<void> {
    await this.renderCustomerScreen(target, {
      text: "Avval MAZETTO profilingizni ulang: /start bosing va telefon raqamingizni yuboring.",
    });
  }
}
