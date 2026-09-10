import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import {
  isKnownSettingKey,
  isPublicSettingKey,
  parseBoolSetting,
  parseCsvSetting,
  parseIntSetting,
  settingFallback,
  settingKeys,
  validateSettingValue,
  type SettingKey,
} from "./setting-rules";

/*
 * Biznes sozlamalarini o'qish va yozish (7-bosqich Q1).
 *
 * KESH. Sozlamalar deyarli o'zgarmaydi, lekin buyurtma yo'llarida o'qiladi,
 * ya'ni har chaqiruvda bazaga borish ma'nosiz. Redis'da qisqa TTL bilan
 * saqlanadi va HAR YOZISHDA bekor qilinadi.
 *
 * TTL nima uchun kerak, yozishda bekor qilinsa ham: bir nechta instance
 * ishlaganda yozishni bajarган instance keshni faqat O'ZIDA emas, Redis'da
 * bekor qiladi — bu yetarli. TTL esa Redis tushib qayta ko'tarilgan yoki
 * bazaga qo'lda yozilgan holatlar uchun oxirgi himoya.
 */

const CACHE_KEY = "settings:all";
const CACHE_TTL_SECONDS = 60;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // --- Tipli o'qish ------------------------------------------------------

  async getInt(key: SettingKey): Promise<number> {
    return parseIntSetting(key, await this.readRaw(key));
  }

  async getBool(key: SettingKey): Promise<boolean> {
    return parseBoolSetting(key, await this.readRaw(key));
  }

  async getCsv(key: SettingKey): Promise<string[]> {
    return parseCsvSetting(key, await this.readRaw(key));
  }

  // --- Admin ekrani ------------------------------------------------------

  /** Barcha e'lon qilingan sozlamalar, saqlanmaganlari default bilan. */
  async listSettings() {
    const stored = await this.readAll();

    return settingKeys.map((key) => ({
      key,
      value: stored[key] ?? settingFallback(key),
      isStored: stored[key] !== undefined,
      isPublic: isPublicSettingKey(key),
    }));
  }

  /** Mijoz tomoniga oshkor qilinadigan qism. */
  async getPublicSettings(): Promise<Record<string, unknown>> {
    return {
      customerPaymentMethods: await this.getCsv("customer_payment_methods"),
      customerDeliveryEnabled: await this.getBool("customer_delivery_enabled"),
    };
  }

  async updateSetting(key: string, rawValue: string, user: AuthenticatedUser) {
    if (!isKnownSettingKey(key)) {
      // Noma'lum kalitni qabul qilish uni O'QIB bo'lmaydigan qator qilardi:
      // reestrda yo'q kalit hech qachon so'ralmaydi, ya'ni yozuv jimgina
      // ta'sirsiz qolardi.
      throw new BadRequestException(`Noma'lum sozlama kaliti: "${key}"`);
    }

    const value = validateSettingValue(key, rawValue);

    const saved = await this.prisma.setting.upsert({
      where: { key },
      update: { value, updatedById: user.id },
      create: {
        key,
        value,
        isPublic: isPublicSettingKey(key),
        updatedById: user.id,
      },
      select: { key: true, value: true, isPublic: true, updatedAt: true },
    });

    await this.invalidateCache();

    return saved;
  }

  // --- Ichki qismlar -----------------------------------------------------

  private async readRaw(key: SettingKey): Promise<string | undefined> {
    const all = await this.readAll();
    return all[key];
  }

  private async readAll(): Promise<Partial<Record<SettingKey, string>>> {
    const cached = await this.readCache();

    if (cached) {
      return cached;
    }

    const rows = await this.prisma.setting.findMany({
      select: { key: true, value: true },
    });

    const map: Partial<Record<SettingKey, string>> = {};

    for (const row of rows) {
      // Reestrdan olib tashlangan kalitlar bazada qolishi mumkin — ular
      // e'tiborsiz qoldiriladi, o'chirilmaydi: qatorni saqlash sozlamani
      // qaytarib yoqishni oson qiladi.
      if (isKnownSettingKey(row.key)) {
        map[row.key] = row.value;
      }
    }

    await this.writeCache(map);

    return map;
  }

  private async readCache(): Promise<Partial<Record<SettingKey, string>> | null> {
    const client = this.redis.getClient();

    if (!client) {
      return null;
    }

    try {
      const raw = await client.get(CACHE_KEY);
      return raw ? (JSON.parse(raw) as Partial<Record<SettingKey, string>>) : null;
    } catch {
      // Kesh o'qilmadi — bazaga boramiz. Sozlama o'qishi Redis tufayli
      // buzilmasligi kerak.
      return null;
    }
  }

  private async writeCache(map: Partial<Record<SettingKey, string>>): Promise<void> {
    const client = this.redis.getClient();

    if (!client) {
      return;
    }

    try {
      await client.set(CACHE_KEY, JSON.stringify(map), "EX", CACHE_TTL_SECONDS);
    } catch {
      // e'tiborsiz — kesh ixtiyoriy
    }
  }

  private async invalidateCache(): Promise<void> {
    const client = this.redis.getClient();

    if (!client) {
      return;
    }

    try {
      await client.del(CACHE_KEY);
    } catch {
      this.logger.warn("Sozlama keshi bekor qilinmadi — TTL bilan eskiradi");
    }
  }
}
