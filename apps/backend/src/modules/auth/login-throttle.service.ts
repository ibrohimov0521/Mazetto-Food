import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";

/*
 * Login urinishlari cheklovi (PHASE 6 H1/H2, 7-bosqich 3-to'lqin).
 *
 * ILGARI bu `AuthService` ichidagi `Map` edi va uchta nuqsoni bor edi:
 *
 *   1. Deploy'da yoki qayta ishga tushishda butunlay nolga tushardi.
 *   2. Ikkinchi instance ko'tarilsa har biri o'zicha sanardi.
 *   3. CHEKSIZ O'SARDI. Kalitning bir qismi login identifikatori, ya'ni uni
 *      so'rov yuboruvchi tanlaydi; tozalash esa faqat AYNAN o'sha kalit qayta
 *      so'ralganda ishlardi, hujumchi esa hech qachon takrorlamaydi.
 *
 * Redis uchalasini ham yopadi: hisoblagich umumiy, va TTL tozalashni
 * Redis'ning o'zi bajaradi.
 *
 * IKKI KALIT ikki xil hujumga qarshi:
 *   - `address` — bitta manzildan ko'p akkauntni sinash (parol sepish)
 *   - `account` — bitta akkauntni ko'p paroldan sinash (brute-force)
 * Manzil kaliti faqat XFF ishonchli bo'lganda ma'noli, shuning uchun
 * `resolveClientAddress` ishonchli proxy soni e'lon qilinmaguncha TCP peer
 * manzilini beradi (H1).
 */

const KEY_PREFIX = "login-throttle:";
const WINDOW_SECONDS = 15 * 60;
const MAX_ADDRESS_FAILURES = 5;
const MAX_IDENTIFIER_FAILURES = 20;

type ThrottleKey = { key: string; maxFailures: number };

@Injectable()
export class LoginThrottleService {
  /*
   * Redis yo'q bo'lgandagi zaxira.
   *
   * Chegaralangan: kalitni so'rov yuboruvchi tanlagani uchun bu jadval ham
   * cheksiz o'sishi mumkin edi. Chegaraga yetganda avval eskirganlar, keyin
   * eng eskilari tashlanadi.
   */
  private readonly fallback = new Map<string, { failures: number; expiresAt: number }>();
  private static readonly FALLBACK_MAX_ENTRIES = 10_000;

  constructor(private readonly redis: RedisService) {}

  async assertAllowed(identifier: string, clientAddress: string): Promise<void> {
    for (const { key, maxFailures } of this.buildKeys(identifier, clientAddress)) {
      const failures = await this.readFailures(key);

      if (failures >= maxFailures) {
        throw new HttpException(
          "Too many login attempts. Please wait before trying again.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  async registerFailure(identifier: string, clientAddress: string): Promise<void> {
    for (const { key } of this.buildKeys(identifier, clientAddress)) {
      await this.incrementFailures(key);
    }
  }

  async clear(identifier: string, clientAddress: string): Promise<void> {
    const client = this.redis.getClient();

    for (const { key } of this.buildKeys(identifier, clientAddress)) {
      this.fallback.delete(key);

      if (client) {
        await client.del(key).catch(() => undefined);
      }
    }
  }

  private buildKeys(identifier: string, clientAddress: string): ThrottleKey[] {
    return [
      {
        key: `${KEY_PREFIX}${identifier}:address:${clientAddress}`,
        maxFailures: MAX_ADDRESS_FAILURES,
      },
      {
        key: `${KEY_PREFIX}${identifier}:account`,
        maxFailures: MAX_IDENTIFIER_FAILURES,
      },
    ];
  }

  private async readFailures(key: string): Promise<number> {
    const client = this.redis.getClient();

    if (client) {
      try {
        return Number((await client.get(key)) ?? 0);
      } catch {
        // Redis o'qib bo'lmadi — zaxiraga tushamiz. Cheklovni butunlay
        // o'chirib qo'yishdan ko'ra bitta instance doirasida saqlash yaxshi.
      }
    }

    const record = this.fallback.get(key);

    if (!record || record.expiresAt <= Date.now()) {
      return 0;
    }

    return record.failures;
  }

  private async incrementFailures(key: string): Promise<void> {
    const client = this.redis.getClient();

    if (client) {
      try {
        // TTL har muvaffaqiyatsiz urinishda yangilanadi: oyna oxirgi
        // urinishdan boshlab hisoblanadi, birinchisidan emas.
        await client.multi().incr(key).expire(key, WINDOW_SECONDS).exec();
        return;
      } catch {
        // pastdagi zaxiraga tushadi
      }
    }

    this.pruneFallback();

    const now = Date.now();
    const current = this.fallback.get(key);
    const record =
      current && current.expiresAt > now
        ? current
        : { failures: 0, expiresAt: now + WINDOW_SECONDS * 1000 };

    record.failures += 1;
    record.expiresAt = now + WINDOW_SECONDS * 1000;
    this.fallback.set(key, record);
  }

  private pruneFallback(): void {
    if (this.fallback.size < LoginThrottleService.FALLBACK_MAX_ENTRIES) {
      return;
    }

    const now = Date.now();

    for (const [key, record] of this.fallback) {
      if (record.expiresAt <= now) {
        this.fallback.delete(key);
      }
    }

    if (this.fallback.size < LoginThrottleService.FALLBACK_MAX_ENTRIES) {
      return;
    }

    const oldestFirst = [...this.fallback.entries()].sort(
      ([, a], [, b]) => a.expiresAt - b.expiresAt,
    );
    const excess = this.fallback.size - LoginThrottleService.FALLBACK_MAX_ENTRIES + 1;

    for (const [key] of oldestFirst.slice(0, excess)) {
      this.fallback.delete(key);
    }
  }
}
