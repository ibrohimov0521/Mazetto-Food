import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";
import { SettingsService } from "../settings/settings.service";
import { parseIntSetting, settingFallback } from "../settings/setting-rules";
import type { SettingKey } from "../settings/setting-rules";

const KEY_PREFIX = "login-throttle:";
const ADDRESS_LIMIT_KEY = "login_throttle_address_failures";
const IDENTIFIER_LIMIT_KEY = "login_throttle_identifier_failures";
const WINDOW_MINUTES_KEY = "login_throttle_window_minutes";

/*
 * One bucket is scoped to a login and its client address, so one employee's
 * mistakes behind a shared office network do not lock out every coworker.
 * The account bucket spans addresses and provides the stronger brute-force cap.
 * Trusted restaurant hosts can tune both limits and the expiry window in settings.
 */

type ThrottleKey = { key: string; maxFailures: number };
type LoginThrottleLimits = {
  addressFailures: number;
  identifierFailures: number;
  windowSeconds: number;
};

@Injectable()
export class LoginThrottleService {
  /*
   * Redis yo'q bo'lgandagi zaxira jadvali. Kalitni so'rov yuboruvchi
   * tanlagani sababli u chegaralangan va muddati o'tgan yozuvlar tozalanadi.
   */
  private readonly fallback = new Map<
    string,
    { failures: number; expiresAt: number }
  >();
  private static readonly FALLBACK_MAX_ENTRIES = 10_000;

  constructor(
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
  ) {}

  async assertAllowed(
    identifier: string,
    clientAddress: string,
    tenantId?: string,
  ): Promise<void> {
    const limits = await this.resolveLimits(tenantId);
    for (const { key, maxFailures } of this.buildKeys(
      identifier,
      clientAddress,
      limits,
    )) {
      if ((await this.readFailures(key)) >= maxFailures) {
        throw new HttpException(
          "Kirish vaqtincha cheklangan. Belgilangan muddatdan keyin qayta urinib ko'ring.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  async registerFailure(
    identifier: string,
    clientAddress: string,
    tenantId?: string,
  ): Promise<void> {
    const limits = await this.resolveLimits(tenantId);
    for (const { key } of this.buildKeys(identifier, clientAddress, limits)) {
      await this.incrementFailures(key, limits.windowSeconds);
    }
  }

  async clear(identifier: string, clientAddress: string): Promise<void> {
    const client = this.redis.getClient();
    const keys = [
      KEY_PREFIX + identifier + ":address:" + clientAddress,
      KEY_PREFIX + identifier + ":account",
    ];
    for (const key of keys) {
      this.fallback.delete(key);
      if (client) await client.del(key).catch(() => undefined);
    }
  }

  private buildKeys(
    identifier: string,
    clientAddress: string,
    limits: LoginThrottleLimits,
  ): ThrottleKey[] {
    return [
      {
        key: KEY_PREFIX + identifier + ":address:" + clientAddress,
        maxFailures: limits.addressFailures,
      },
      {
        key: KEY_PREFIX + identifier + ":account",
        maxFailures: limits.identifierFailures,
      },
    ];
  }

  private async resolveLimits(tenantId?: string): Promise<LoginThrottleLimits> {
    // Tasdiqlangan restoran hosti bo'lmasa, platforma loginlari defaultdan foydalanadi.
    if (!tenantId) {
      return {
        addressFailures: this.defaultLimit(ADDRESS_LIMIT_KEY),
        identifierFailures: this.defaultLimit(IDENTIFIER_LIMIT_KEY),
        windowSeconds: this.defaultLimit(WINDOW_MINUTES_KEY) * 60,
      };
    }
    const [addressFailures, identifierFailures, windowMinutes] =
      await Promise.all([
        this.settings.getInt(ADDRESS_LIMIT_KEY, tenantId),
        this.settings.getInt(IDENTIFIER_LIMIT_KEY, tenantId),
        this.settings.getInt(WINDOW_MINUTES_KEY, tenantId),
      ]);
    return {
      addressFailures,
      identifierFailures,
      windowSeconds: windowMinutes * 60,
    };
  }

  private defaultLimit(key: SettingKey): number {
    return parseIntSetting(key, settingFallback(key));
  }

  private async readFailures(key: string): Promise<number> {
    const client = this.redis.getClient();
    if (client) {
      try {
        return Number((await client.get(key)) ?? 0);
      } catch {
        // Redis o'qib bo'lmasa, zaxira jadvalidan foydalanamiz.
      }
    }
    const record = this.fallback.get(key);
    return !record || record.expiresAt <= Date.now() ? 0 : record.failures;
  }

  private async incrementFailures(
    key: string,
    windowSeconds: number,
  ): Promise<void> {
    const client = this.redis.getClient();
    if (client) {
      try {
        // Muvaffaqiyatsiz urinish TTL'ni yangilaydi: muddat oxirgi urinishdan sanaladi.
        await client.multi().incr(key).expire(key, windowSeconds).exec();
        return;
      } catch {
        // Redis ishlamasa, zaxira jadvalidan foydalanamiz.
      }
    }
    this.pruneFallback();
    const now = Date.now();
    const current = this.fallback.get(key);
    const record =
      current && current.expiresAt > now
        ? current
        : { failures: 0, expiresAt: now + windowSeconds * 1000 };
    record.failures += 1;
    record.expiresAt = now + windowSeconds * 1000;
    this.fallback.set(key, record);
  }

  private pruneFallback(): void {
    if (this.fallback.size < LoginThrottleService.FALLBACK_MAX_ENTRIES) return;
    const now = Date.now();
    for (const [key, record] of this.fallback) {
      if (record.expiresAt <= now) this.fallback.delete(key);
    }
    if (this.fallback.size < LoginThrottleService.FALLBACK_MAX_ENTRIES) return;
    const oldestFirst = [...this.fallback.entries()].sort(
      ([, a], [, b]) => a.expiresAt - b.expiresAt,
    );
    const excess =
      this.fallback.size - LoginThrottleService.FALLBACK_MAX_ENTRIES + 1;
    for (const [key] of oldestFirst.slice(0, excess)) this.fallback.delete(key);
  }
}
