import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { writeAuditLog } from "../audit/audit-write";
import type { UpdatePlatformTenantTelegramDto } from "./dto/update-platform-tenant-telegram.dto";

function telegramBotUsername(): string | null {
  const direct = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (direct && /^[A-Za-z0-9_]{5,32}$/.test(direct)) return direct;
  for (const configuredUrl of [process.env.TELEGRAM_CUSTOMER_BOT_URL, process.env.TELEGRAM_BOT_URL]) {
    if (!configuredUrl) continue;
    try {
      const parsed = new URL(configuredUrl);
      const username = parsed.pathname.split("/").filter(Boolean)[0];
      if (["t.me", "www.t.me", "telegram.me"].includes(parsed.hostname.toLowerCase()) && username && /^[A-Za-z0-9_]{5,32}$/.test(username)) return username;
    } catch {
      // Ignore malformed optional links; the panel reports that no bot username is configured.
    }
  }
  return null;
}

@Injectable()
export class PlatformTenantTelegramService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const tenant = await this.prisma.restaurantTenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        code: true,
        status: true,
        features: { where: { code: "TELEGRAM_ORDERS" }, select: { isEnabled: true } },
      },
    });
    if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");
    const configuration = await this.prisma.tenantTelegramConfiguration.findUnique({
      where: { tenantId },
      select: { staffChatId: true, updatedAt: true },
    });
    const username = telegramBotUsername();
    const telegramOrdersEnabled = tenant.features.some((feature) => feature.isEnabled);
    const botConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET);
    const staffChatId = configuration?.staffChatId ?? (tenant.code === "MAZETTO_FOOD" ? process.env.TELEGRAM_STAFF_CHAT_ID ?? "" : "");
    const customerBotLink = username && telegramOrdersEnabled && tenant.status === "ACTIVE"
      ? `https://t.me/${username}?start=t_${tenant.code.toLowerCase()}`
      : null;
    return {
      tenant: { id: tenant.id, code: tenant.code, status: tenant.status },
      telegramOrdersEnabled,
      staffChatId,
      updatedAt: configuration?.updatedAt ?? null,
      customerBotUsername: username,
      customerBotLink,
      botConfigured,
      staffNotificationsReady: Boolean(staffChatId && process.env.TELEGRAM_BOT_TOKEN),
      ready: telegramOrdersEnabled && botConfigured && Boolean(staffChatId) && Boolean(username),
    };
  }

  async update(tenantId: string, dto: UpdatePlatformTenantTelegramDto, actor: AuthenticatedUser) {
    const tenant = await this.prisma.restaurantTenant.findUnique({
      where: { id: tenantId },
      select: { id: true, code: true },
    });
    if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");
    const staffChatId = dto.staffChatId?.trim() || null;
    if (staffChatId && !/^-?[0-9]{5,20}$/.test(staffChatId)) {
      throw new BadRequestException("Telegram guruhining Chat ID raqamini tekshiring.");
    }
    if (!staffChatId) {
      const feature = await this.prisma.tenantFeature.findUnique({
        where: { tenantId_code: { tenantId, code: "TELEGRAM_ORDERS" } },
        select: { isEnabled: true },
      });
      if (feature?.isEnabled && !(tenant.code === "MAZETTO_FOOD" && process.env.TELEGRAM_STAFF_CHAT_ID)) {
        throw new BadRequestException("Avval Telegram buyurtmalarini o'chiring; faol kanalning xodimlar guruhini olib tashlab bo'lmaydi.");
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.tenantTelegramConfiguration.upsert({
        where: { tenantId },
        create: { tenantId, staffChatId },
        update: { staffChatId },
      });
      await writeAuditLog(tx, {
        tenantId,
        userId: actor.id,
        action: "PLATFORM_TENANT_TELEGRAM_UPDATED",
        entity: "RESTAURANT_TENANT",
        entityId: tenantId,
        metadata: { tenantId, code: tenant.code, staffChatIdConfigured: Boolean(staffChatId) },
      });
    });
    return this.get(tenantId);
  }
}
