import { Injectable } from "@nestjs/common";
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
    keyboard?: string[][];
    resize_keyboard?: boolean;
  };
};

@Injectable()
export class TelegramCustomerScreenService {
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

  async telegramRequest(method: string, payload: unknown): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    // Token yo'q — bot o'chiq. Bu xato emas, ilova ishlayveradi.
    if (!token) {
      return;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Telegram ${method} failed with ${response.status}: ${body}`,
      );
    }
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
