import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RedisService } from "../../redis/redis.service";

/*
 * O'LIK XATLAR (Q6).
 *
 * MUAMMO: Telegram bildirishnomasi uch marta urinib ham yuborilmasa,
 * `catch` uni logga yozib, TASHLAB YUBORARDI. Buyurtma bazada bor, lekin
 * oshxona u haqda hech qachon bilmaydi — va hech kim buni sezmaydi ham,
 * chunki yagona iz — server logining bir qatori.
 *
 * Bu servis yo'qotishni KO'RINADIGAN qiladi: har bir muvaffaqiyatsiz
 * bildirishnoma yozib qo'yiladi, ro'yxatda ko'rinadi va qayta yuborilishi
 * mumkin.
 *
 * NIMA UCHUN TO'LIQ NAVBAT EMAS. Reja Redis navbati + worker + adapterlar
 * quvurini taklif qiladi. Hozircha bitta adapter bor (Telegram), va bitta
 * adapter uchun uch bosqichli quvur qurish erta. Bundan tashqari mavjud
 * kod har buyurtma uchun xabarlar KETMA-KETLIGINI saqlaydi (AUD-020:
 * NEW -> PREPARING -> READY tahrirlash tartibi); mustaqil worker bu
 * tartibni buzardi. Shuning uchun yo'qolishning O'ZI tuzatildi, quvur
 * esa ikkinchi adapter paydo bo'lganda quriladi.
 */

/** Redis ro'yxati cheksiz o'smasin. */
const MAX_ENTRIES = 500;
const REDIS_KEY = "notify:dead";

export type DeadLetter = {
  /** Idempotency kaliti: qayta yuborishda takror xabar chiqmasligi uchun. */
  messageId: string;
  kind: string;
  orderId: string;
  error: string;
  failedAt: string;
  attempts: number;
};

@Injectable()
export class NotificationDeadLetterService {
  private readonly logger = new Logger(NotificationDeadLetterService.name);
  /*
   * Redis yo'q bo'lganda ham yo'qotish KO'RINSIN. Chegaralangan: Redis
   * uzoq vaqt tushib turganda xotira to'lib ketmasligi kerak.
   */
  private readonly fallback: DeadLetter[] = [];

  constructor(private readonly redis: RedisService) {}

  async record(input: {
    kind: string;
    orderId: string;
    error: unknown;
    attempts: number;
  }): Promise<DeadLetter> {
    const entry: DeadLetter = {
      messageId: randomUUID(),
      kind: input.kind,
      orderId: input.orderId,
      error:
        input.error instanceof Error
          ? input.error.message
          : String(input.error),
      failedAt: new Date().toISOString(),
      attempts: input.attempts,
    };

    const client = this.redis.getClient();

    if (client) {
      try {
        /*
         * `LPUSH` + `LTRIM` — eng yangisi boshida, ro'yxat chegaralangan.
         * Ikkalasi bitta pipeline'da: orasida uzilish bo'lsa ro'yxat
         * chegaradan oshib ketardi.
         */
        await client
          .pipeline()
          .lpush(REDIS_KEY, JSON.stringify(entry))
          .ltrim(REDIS_KEY, 0, MAX_ENTRIES - 1)
          .exec();
        return entry;
      } catch (error) {
        this.logger.warn(
          `O'lik xatni Redis'ga yozib bo'lmadi, xotiraga tushildi: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.fallback.unshift(entry);
    if (this.fallback.length > MAX_ENTRIES) {
      this.fallback.length = MAX_ENTRIES;
    }
    return entry;
  }

  async list(limit = 50): Promise<DeadLetter[]> {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_ENTRIES);
    const client = this.redis.getClient();

    if (client) {
      try {
        const rows = await client.lrange(REDIS_KEY, 0, safeLimit - 1);
        return rows
          .map((row) => this.parse(row))
          .filter((row): row is DeadLetter => row !== null);
      } catch (error) {
        this.logger.warn(
          `O'lik xatlarni o'qib bo'lmadi: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return this.fallback.slice(0, safeLimit);
  }

  /**
   * Yozuvni ro'yxatdan olib tashlaydi va qaytaradi.
   * Qayta yuborish MUVAFFAQIYATLI bo'lgandagina chaqiriladi.
   */
  async take(messageId: string): Promise<DeadLetter | null> {
    const client = this.redis.getClient();

    if (client) {
      try {
        const rows = await client.lrange(REDIS_KEY, 0, MAX_ENTRIES - 1);
        for (const row of rows) {
          const entry = this.parse(row);
          if (entry?.messageId === messageId) {
            /*
             * `LREM` aynan shu SATRNI o'chiradi, indeks bo'yicha emas:
             * o'qish va o'chirish orasida ro'yxatga yangi yozuv qo'shilsa,
             * indeks siljib, boshqa yozuv o'chib ketardi.
             */
            await client.lrem(REDIS_KEY, 1, row);
            return entry;
          }
        }
        return null;
      } catch (error) {
        this.logger.warn(
          `O'lik xatni o'chirib bo'lmadi: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const index = this.fallback.findIndex(
      (entry) => entry.messageId === messageId,
    );
    if (index === -1) return null;
    return this.fallback.splice(index, 1)[0] ?? null;
  }

  private parse(row: string): DeadLetter | null {
    try {
      return JSON.parse(row) as DeadLetter;
    } catch {
      // Buzuq yozuv butun ro'yxatni yiqitmasligi kerak.
      return null;
    }
  }
}
