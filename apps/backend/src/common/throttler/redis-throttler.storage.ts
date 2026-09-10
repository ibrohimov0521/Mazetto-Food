import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import type { RedisService } from "../../redis/redis.service";

/*
 * Rate limit hisoblagichlari uchun Redis saqlagichi (7-bosqich 3-to'lqin).
 *
 * Standart saqlagich jarayon xotirasida ishlaydi. Bu ikki narsani buzadi:
 * har deploy'da hisoblagich nolga tushadi, va ikkinchi instance ko'tarilsa
 * har biri o'zicha sanaydi — ya'ni haqiqiy chegara instance soniga
 * ko'paytiriladi.
 *
 * Kalitlar `throttle:` prefiksi bilan nomlanadi, aks holda ular biznes
 * keshlari bilan bir fazoda turib, tasodifan to'qnashishi mumkin edi.
 */

const KEY_PREFIX = "throttle:";

export class RedisThrottlerStorage implements ThrottlerStorage {
  /** Redis yo'q bo'lganda ishlatiladigan zaxira — bitta instance uchun. */
  private readonly fallback = new Map<string, { hits: number; expiresAt: number }>();

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redis.getClient();

    if (!client) {
      return this.incrementInMemory(key, ttl, limit, blockDuration);
    }

    const redisKey = `${KEY_PREFIX}${throttlerName}:${key}`;

    try {
      const result = await client.multi().incr(redisKey).pttl(redisKey).exec();
      const totalHits = Number(result?.[0]?.[1] ?? 0);
      const pttl = Number(result?.[1]?.[1] ?? -1);

      /*
       * PTTL `-1` = kalit bor, lekin muddati YO'Q.
       *
       * Bu birinchi `INCR` dan keyingi holat. TTL o'rnatilmasa kalit
       * abadiy qoladi va mijoz bir marta chegaraga yetgach BUTUNLAY
       * bloklanib qolardi — hisoblagich hech qachon tozalanmagani uchun.
       */
      if (pttl < 0) {
        // Sekundga yaxlitlanadi, lekin hech qachon 0 emas: `EXPIRE 0`
        // kalitni darhol o'chirib, cheklovni ma'nosiz qilardi.
        const seconds = Math.max(1, Math.ceil(ttl / 1000));
        await client.expire(redisKey, seconds);

        return {
          totalHits,
          timeToExpire: seconds,
          isBlocked: totalHits > limit,
          timeToBlockExpire: Math.ceil(blockDuration / 1000),
        };
      }

      return {
        totalHits,
        timeToExpire: Math.ceil(pttl / 1000),
        isBlocked: totalHits > limit,
        timeToBlockExpire: Math.ceil(blockDuration / 1000),
      };
    } catch {
      // Redis tushib qolsa cheklov butunlay yo'qolmasin — bitta instance
      // doirasida bo'lsa ham sanashda davom etamiz.
      return this.incrementInMemory(key, ttl, limit, blockDuration);
    }
  }

  private incrementInMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    const current = this.fallback.get(key);
    const record =
      current && current.expiresAt > now
        ? current
        : { hits: 0, expiresAt: now + ttl };

    record.hits += 1;
    this.fallback.set(key, record);

    // Zaxira jadval ham cheksiz o'smasligi kerak (H2 bilan bir xil sabab).
    if (this.fallback.size > 10_000) {
      for (const [candidate, value] of this.fallback) {
        if (value.expiresAt <= now) {
          this.fallback.delete(candidate);
        }
      }
    }

    return {
      totalHits: record.hits,
      timeToExpire: Math.ceil((record.expiresAt - now) / 1000),
      isBlocked: record.hits > limit,
      timeToBlockExpire: Math.ceil(blockDuration / 1000),
    };
  }
}
