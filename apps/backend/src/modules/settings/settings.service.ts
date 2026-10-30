import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { resolveRestaurantTenantId } from "../../common/auth/tenant-scope";
import { RedisService } from "../../redis/redis.service";
import {
  affectsCustomerCheckout,
  describeSettingRule,
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
import { writeAuditLog } from "../audit/audit-write";

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
 *
 * `cashier_payment_methods` istisno: eskirgan kesh o'chirilgan to'lovni
 * qayta yoqmasligi uchun doim DB'dan o'qiladi, mavjud transaction qayta ishlatiladi.
 */

const cacheKey = (tenantId: string) => `settings:${tenantId}:all`;
const CACHE_TTL_SECONDS = 60;
// A cashier payment-method kill switch must not depend on Redis invalidation.
const IMMEDIATE_SETTING_KEYS = new Set<SettingKey>([
  "cashier_payment_methods",
  "kitchen_pos_orders_enabled",
  "order_display_number_start",
  "telegram_owner_telegram_user_id",
  "telegram_owner_order_notifications_enabled",
  "telegram_cashier_order_notifications_enabled",
  "telegram_courier_order_notifications_enabled",
]);
type SettingReadClient = Pick<Prisma.TransactionClient, "setting">;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // --- Tipli o'qish ------------------------------------------------------

  async getInt(
    key: SettingKey,
    tenantId: string,
    client?: SettingReadClient,
  ): Promise<number> {
    return parseIntSetting(key, await this.readRaw(key, tenantId, client));
  }

  async getBool(
    key: SettingKey,
    tenantId: string,
    client?: SettingReadClient,
  ): Promise<boolean> {
    return parseBoolSetting(key, await this.readRaw(key, tenantId, client));
  }

  async getCsv(
    key: SettingKey,
    tenantId: string,
    client?: SettingReadClient,
  ): Promise<string[]> {
    return parseCsvSetting(key, await this.readRaw(key, tenantId, client));
  }

  // --- Admin ekrani ------------------------------------------------------

  /**
   * Barcha e'lon qilingan sozlamalar, saqlanmaganlari default bilan.
   *
   * QOIDA ham qaytariladi (`rule`), chunki admin ekrani qaysi boshqaruv
   * elementini chizishni bilishi kerak: butun son uchun raqam kiritish,
   * mantiqiy uchun toggle, ro'yxat uchun tanlov. Buni frontendda qaytadan
   * yozish reestr yechayotgan drift muammosini qaytarardi — bu safar
   * backend bilan UI orasida.
   */
  async listSettings(user: AuthenticatedUser) {
    const tenantId = await resolveRestaurantTenantId(this.prisma, user);
    const [stored, immediate, currentUser] = await Promise.all([
      this.readAll(tenantId),
      this.readImmediateSettings(tenantId),
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { telegramUserId: true },
      }),
    ]);

    return settingKeys.map((key) => {
      const rawValue =
        key === "telegram_owner_telegram_user_id"
          ? currentUser?.telegramUserId ?? undefined
          : IMMEDIATE_SETTING_KEYS.has(key)
            ? immediate[key]
            : stored[key];

      return {
        key,
        value:
          describeSettingRule(key).kind === "csv-enum"
            ? parseCsvSetting(key, rawValue).join(",")
            : (rawValue ?? settingFallback(key)),
        isStored:
          key === "telegram_owner_telegram_user_id"
            ? Boolean(currentUser?.telegramUserId)
            : rawValue !== undefined,
        isPublic: isPublicSettingKey(key),
        affectsCustomer: affectsCustomerCheckout(key),
        rule: describeSettingRule(key),
        fallback: settingFallback(key),
      };
    });
  }

  /** Mijoz tomoniga oshkor qilinadigan qism. */
  async getPublicSettings(tenantId: string): Promise<Record<string, unknown>> {
    return {
      customerPaymentMethods: await this.getCsv(
        "customer_payment_methods",
        tenantId,
      ),
      customerDeliveryEnabled: await this.getBool(
        "customer_delivery_enabled",
        tenantId,
      ),
      customerDeliveryFee: await this.getInt("customer_delivery_fee", tenantId),
    };
  }

  async updateSetting(key: string, rawValue: string, user: AuthenticatedUser) {
    const tenantId = await resolveRestaurantTenantId(this.prisma, user);
    if (!isKnownSettingKey(key)) {
      // Noma'lum kalitni qabul qilish uni O'QIB bo'lmaydigan qator qilardi:
      // reestrda yo'q kalit hech qachon so'ralmaydi, ya'ni yozuv jimgina
      // ta'sirsiz qolardi.
      throw new BadRequestException(`Noma'lum sozlama kaliti: "${key}"`);
    }

    const value = validateSettingValue(key, rawValue);

    const saved = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.setting.findUnique({
        where: { tenantId_key: { tenantId, key } },
        select: { value: true },
      });
      let beforeValue = previous?.value ?? settingFallback(key);
      if (key === "telegram_owner_telegram_user_id") {
        const currentUser = await tx.user.findUnique({
          where: { id: user.id },
          select: { telegramUserId: true },
        });
        beforeValue = currentUser?.telegramUserId ?? "";

        if (value) {
          const [existingUser, existingEmployee] = await Promise.all([
            tx.user.findUnique({
              where: { telegramUserId: value },
              select: { id: true },
            }),
            tx.employee.findFirst({
              where: { telegramUserId: value, userId: { not: user.id } },
              select: { id: true },
            }),
          ]);
          if (existingUser && existingUser.id !== user.id) {
            throw new BadRequestException("Bu Telegram ID boshqa foydalanuvchiga bog'langan.");
          }
          if (existingEmployee) {
            throw new BadRequestException("Bu Telegram ID boshqa xodimga bog'langan.");
          }
        }

        await tx.user.update({
          where: { id: user.id },
          data: { telegramUserId: value || null },
        });
        await tx.employee.updateMany({
          where: { userId: user.id },
          data: { telegramUserId: value || null },
        });
      }

      const updated = await tx.setting.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: { value, updatedById: user.id },
        create: {
          tenantId,
          key,
          value,
          isPublic: isPublicSettingKey(key),
          updatedById: user.id,
        },
        select: { key: true, value: true, isPublic: true, updatedAt: true },
      });
      await writeAuditLog(tx, {
        tenantId,
        userId: user.id,
        action: "SETTING_UPDATED",
        entity: "Setting",
        entityId: key,
        metadata: {
          before: beforeValue,
          after: value,
          wasStored: previous !== null,
        },
      });
      return updated;
    });

    await this.invalidateCache(tenantId);

    return saved;
  }

  // --- Ichki qismlar -----------------------------------------------------

  private async readRaw(
    key: SettingKey,
    tenantId: string,
    client?: SettingReadClient,
  ): Promise<string | undefined> {
    if (IMMEDIATE_SETTING_KEYS.has(key)) {
      return this.readImmediateSetting(key, tenantId, client);
    }

    const all = await this.readAll(tenantId);
    return all[key];
  }

  private async readImmediateSettings(
    tenantId: string,
  ): Promise<Partial<Record<SettingKey, string>>> {
    const entries = await Promise.all(
      [...IMMEDIATE_SETTING_KEYS].map(
        async (key) =>
          [key, await this.readImmediateSetting(key, tenantId)] as const,
      ),
    );

    return Object.fromEntries(
      entries.filter(
        (entry): entry is readonly [SettingKey, string] =>
          entry[1] !== undefined,
      ),
    );
  }

  private async readImmediateSetting(
    key: SettingKey,
    tenantId: string,
    client: SettingReadClient = this.prisma,
  ): Promise<string | undefined> {
    const row = await client.setting.findUnique({
      where: { tenantId_key: { tenantId, key } },
      select: { value: true },
    });

    return row?.value;
  }

  private async readAll(
    tenantId: string,
  ): Promise<Partial<Record<SettingKey, string>>> {
    const cached = await this.readCache(tenantId);

    if (cached) {
      return cached;
    }

    const rows = await this.prisma.setting.findMany({
      where: { tenantId },
      select: { key: true, value: true },
    });

    const map: Partial<Record<SettingKey, string>> = {};

    for (const row of rows) {
      // Reestrdan olib tashlangan kalitlar bazada qolishi mumkin — ular
      // e'tiborsiz qoldiriladi, o'chirilmaydi: qatorni saqlash sozlamani
      // qaytarib yoqishni oson qiladi.
      if (isKnownSettingKey(row.key) && !IMMEDIATE_SETTING_KEYS.has(row.key)) {
        map[row.key] = row.value;
      }
    }

    await this.writeCache(tenantId, map);

    return map;
  }

  private async readCache(
    tenantId: string,
  ): Promise<Partial<Record<SettingKey, string>> | null> {
    const client = this.redis.getClient();

    if (!client) {
      return null;
    }

    try {
      const raw = await client.get(cacheKey(tenantId));
      return raw
        ? (JSON.parse(raw) as Partial<Record<SettingKey, string>>)
        : null;
    } catch {
      // Kesh o'qilmadi — bazaga boramiz. Sozlama o'qishi Redis tufayli
      // buzilmasligi kerak.
      return null;
    }
  }

  private async writeCache(
    tenantId: string,
    map: Partial<Record<SettingKey, string>>,
  ): Promise<void> {
    const client = this.redis.getClient();

    if (!client) {
      return;
    }

    try {
      await client.set(
        cacheKey(tenantId),
        JSON.stringify(map),
        "EX",
        CACHE_TTL_SECONDS,
      );
    } catch {
      // e'tiborsiz — kesh ixtiyoriy
    }
  }

  private async invalidateCache(tenantId: string): Promise<void> {
    const client = this.redis.getClient();

    if (!client) {
      return;
    }

    try {
      await client.del(cacheKey(tenantId));
    } catch {
      this.logger.warn("Sozlama keshi bekor qilinmadi — TTL bilan eskiradi");
    }
  }
}
