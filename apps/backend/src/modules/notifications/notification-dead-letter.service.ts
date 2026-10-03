import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
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

/** Redis va PostgreSQL zaxira ro'yxatlari cheksiz o'smasin. */
const MAX_ENTRIES = 500;
const REDIS_KEY_PREFIX = "notify:dead:";

export type DeadLetter = {
  tenantId: string;
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
   * PostgreSQL ham mavjud bo'lmagandagi oxirgi zaxira. Oddiy Redis nosozligi
   * yozuvni doimiy bazada saqlaydi; bu xarita faqat ikkala ombor ham
   * ishlamagandagina kerak.
   */
  private readonly fallback = new Map<string, DeadLetter[]>();

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async record(input: {
    tenantId: string;
    kind: string;
    orderId: string;
    error: unknown;
    attempts: number;
  }): Promise<DeadLetter> {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(input.tenantId)) {
      throw new Error("Notification tenant scope is invalid");
    }
    const entry: DeadLetter = {
      tenantId: input.tenantId,
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
        const results = await client
          .pipeline()
          .lpush(REDIS_KEY_PREFIX + input.tenantId, JSON.stringify(entry))
          .ltrim(REDIS_KEY_PREFIX + input.tenantId, 0, MAX_ENTRIES - 1)
          .exec();
        if (!results || results.length !== 2) {
          throw new Error("Redis did not confirm all dead-letter commands");
        }
        const pipelineError = results.find(([error]) => error)?.[0];
        if (pipelineError) throw pipelineError;
        return entry;
      } catch (error) {
        this.logger.warn(
          `O'lik xatni Redis'ga yozib bo'lmadi, xotiraga tushildi: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    await this.recordDatabaseFallback(entry);
    return entry;
  }

  async list(tenantId: string, limit = 50): Promise<DeadLetter[]> {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_ENTRIES);
    const key = REDIS_KEY_PREFIX + tenantId;
    const client = this.redis.getClient();
    let redisEntries: DeadLetter[] = [];

    if (client) {
      try {
        const rows = await client.lrange(key, 0, MAX_ENTRIES - 1);
        redisEntries = rows
          .map((row) => this.parse(row))
          .filter(
            (row): row is DeadLetter =>
              row !== null && row.tenantId === tenantId,
          );
      } catch (error) {
        this.logger.warn(
          `O'lik xatlarni o'qib bo'lmadi: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    let databaseEntries: DeadLetter[] = [];
    try {
      const rows = await this.prisma.notificationDeadLetter.findMany({
        where: { tenantId },
        orderBy: [{ failedAt: "desc" }, { id: "desc" }],
        take: MAX_ENTRIES,
      });
      databaseEntries = rows.map((row) => this.fromDatabase(row));
    } catch (error) {
      this.logger.warn(
        `O'lik xatlarni bazadan o'qib bo'lmadi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return this.mergeEntries(
      redisEntries,
      [...databaseEntries, ...(this.fallback.get(tenantId) ?? [])],
      safeLimit,
    );
  }

  /**
   * Yozuvni ro'yxatdan olib tashlaydi va qaytaradi.
   * Qayta yuborish MUVAFFAQIYATLI bo'lgandagina chaqiriladi.
   */
  async take(tenantId: string, messageId: string): Promise<DeadLetter | null> {
    const key = REDIS_KEY_PREFIX + tenantId;
    const client = this.redis.getClient();
    let removedEntry: DeadLetter | null = null;

    if (client) {
      try {
        const rows = await client.lrange(key, 0, MAX_ENTRIES - 1);
        for (const row of rows) {
          const entry = this.parse(row);
          if (entry?.tenantId === tenantId && entry.messageId === messageId) {
            /*
             * `LREM` aynan shu SATRNI o'chiradi, indeks bo'yicha emas:
             * o'qish va o'chirish orasida ro'yxatga yangi yozuv qo'shilsa,
             * indeks siljib, boshqa yozuv o'chib ketardi.
             */
            const removed = await client.lrem(key, 1, row);
            if (removed > 0) removedEntry = entry;
            break;
          }
        }
      } catch (error) {
        this.logger.warn(
          `O'lik xatni o'chirib bo'lmadi: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    try {
      const entry = await this.prisma.notificationDeadLetter.findFirst({
        where: { tenantId, messageId },
      });
      if (entry) {
        const result = await this.prisma.notificationDeadLetter.deleteMany({
          where: { tenantId, messageId },
        });
        if (result.count > 0) removedEntry ??= this.fromDatabase(entry);
      }
    } catch (error) {
      this.logger.warn(
        `O'lik xatni bazadan o'chirib bo'lmadi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return this.removeFallback(tenantId, messageId) ?? removedEntry;
  }

  private async recordDatabaseFallback(entry: DeadLetter): Promise<void> {
    try {
      await this.prisma.notificationDeadLetter.create({
        data: {
          tenantId: entry.tenantId,
          messageId: entry.messageId,
          kind: entry.kind,
          orderId: entry.orderId,
          error: entry.error,
          failedAt: new Date(entry.failedAt),
          attempts: entry.attempts,
        },
      });
    } catch (error) {
      this.logger.warn(
        `O'lik xatni bazada saqlab bo'lmadi, faqat xotira zaxirasi ishlatildi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      const entries = this.fallbackEntries(entry.tenantId);
      entries.unshift(entry);
      if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
      return;
    }

    try {
      const expired = await this.prisma.notificationDeadLetter.findMany({
        where: { tenantId: entry.tenantId },
        orderBy: [{ failedAt: "desc" }, { id: "desc" }],
        skip: MAX_ENTRIES,
        take: MAX_ENTRIES,
        select: { id: true },
      });
      if (expired.length > 0) {
        await this.prisma.notificationDeadLetter.deleteMany({
          where: {
            tenantId: entry.tenantId,
            id: { in: expired.map(({ id }) => id) },
          },
        });
      }
    } catch (error) {
      this.logger.warn(
        `O'lik xat zaxirasini cheklab bo'lmadi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  private mergeEntries(
    primary: DeadLetter[],
    fallback: DeadLetter[],
    limit: number,
  ): DeadLetter[] {
    const entries = new Map<string, DeadLetter>();
    for (const entry of [...primary, ...fallback]) {
      entries.set(entry.messageId, entry);
    }
    return [...entries.values()]
      .sort((left, right) => right.failedAt.localeCompare(left.failedAt))
      .slice(0, limit);
  }

  private removeFallback(
    tenantId: string,
    messageId: string,
  ): DeadLetter | null {
    const entries = this.fallbackEntries(tenantId);
    const index = entries.findIndex((entry) => entry.messageId === messageId);
    if (index === -1) return null;
    return entries.splice(index, 1)[0] ?? null;
  }

  private fallbackEntries(tenantId: string): DeadLetter[] {
    let entries = this.fallback.get(tenantId);
    if (!entries) {
      entries = [];
      this.fallback.set(tenantId, entries);
    }
    return entries;
  }

  private fromDatabase(row: {
    tenantId: string;
    messageId: string;
    kind: string;
    orderId: string;
    error: string;
    failedAt: Date;
    attempts: number;
  }): DeadLetter {
    return {
      tenantId: row.tenantId,
      messageId: row.messageId,
      kind: row.kind,
      orderId: row.orderId,
      error: row.error,
      failedAt: row.failedAt.toISOString(),
      attempts: row.attempts,
    };
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
