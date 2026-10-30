import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type TelegramUpdateShape = {
  message?: {
    chat?: { id?: string | number };
    from?: { id?: string | number };
    text?: string;
  };
  callback_query?: {
    from?: { id?: string | number };
    message?: { chat?: { id?: string | number } };
  };
};

@Injectable()
export class TelegramTenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveCustomerTenantId(update: unknown): Promise<string | null> {
    const value = update && typeof update === "object" ? update as TelegramUpdateShape : {};
    const message = value.message;
    const callback = value.callback_query;
    const chatId = message?.chat?.id ?? callback?.message?.chat?.id;
    const telegramUserId = message?.from?.id ?? callback?.from?.id;
    if (chatId === undefined || telegramUserId === undefined || chatId === null || telegramUserId === null) return null;
    const chatIdText = String(chatId);
    const userIdText = String(telegramUserId);
    if (!/^-?[0-9]{1,24}$/.test(chatIdText) || !/^[0-9]{1,24}$/.test(userIdText)) return null;

    const startMatch = message?.text?.trim().match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+([^\s]+))?/);
    const startPayload = startMatch?.[1];
    const callbackData = (update as { callback_query?: { data?: unknown } } | null)?.callback_query?.data;
    const legacyOrderId = typeof callbackData === "string"
      ? callbackData.match(/^mazetto_order:[^:]+:([^:]+)$/)?.[1]
      : undefined;
    if (legacyOrderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: legacyOrderId },
        select: { branch: { select: { tenantId: true } } },
      });
      const ownerTenantId = order?.branch.tenantId;
      if (ownerTenantId && await this.isEnabledTelegramTenant(ownerTenantId)) return ownerTenantId;
      return null;
    }
    let tenantId: string | null = null;

    if (startPayload !== undefined) {
      const tenantCode = startPayload.match(/^t_([A-Za-z0-9_-]{2,32})$/i)?.[1]?.toUpperCase();
      if (!tenantCode || !/^[A-Z0-9](?:[A-Z0-9_-]{0,30}[A-Z0-9])$/.test(tenantCode)) return null;
      tenantId = await this.findEnabledTelegramTenant({ code: tenantCode });
      if (!tenantId) return null;
    } else {
      const existing = await this.prisma.telegramCustomerContext.findUnique({
        where: { chatId_telegramUserId: { chatId: chatIdText, telegramUserId: userIdText } },
        select: { tenantId: true },
      });
      if (existing) {
        if (!await this.isEnabledTelegramTenant(existing.tenantId)) return null;
        tenantId = existing.tenantId;
      } else {
        tenantId = await this.findEnabledTelegramTenant({ code: "MAZETTO_FOOD" });
      }
      if (!tenantId) return null;
    }

    await this.prisma.telegramCustomerContext.upsert({
      where: { chatId_telegramUserId: { chatId: chatIdText, telegramUserId: userIdText } },
      create: { chatId: chatIdText, telegramUserId: userIdText, tenantId },
      update: { tenantId },
    });
    return tenantId;
  }

  async resolveStaffTenantId(update: unknown): Promise<string | null> {
    const value = update && typeof update === "object" ? update as TelegramUpdateShape : {};
    const telegramUserId = value.message?.from?.id ?? value.callback_query?.from?.id;
    if (telegramUserId === undefined || telegramUserId === null) return null;
    const key = String(telegramUserId);
    const employee = await this.prisma.employee.findUnique({
      where: { telegramUserId: key },
      select: { status: true, branch: { select: { tenantId: true, tenant: { select: { status: true } } } } },
    });
    if (employee?.status === "ACTIVE" && employee.branch.tenant.status === "ACTIVE") {
      return employee.branch.tenantId;
    }

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId: key },
      select: {
        isActive: true,
        employee: {
          select: {
            status: true,
            branch: { select: { tenantId: true, tenant: { select: { status: true } } } },
          },
        },
        tenantMemberships: {
          where: {
            status: "ACTIVE",
            branchId: null,
            tenant: { status: "ACTIVE" },
            roles: { some: { role: { code: "SUPER_ADMIN", isActive: true } } },
          },
          select: { tenantId: true },
        },
      },
    });
    const linkedEmployee = user?.employee;
    if (linkedEmployee?.status === "ACTIVE" && linkedEmployee.branch.tenant.status === "ACTIVE") {
      return linkedEmployee.branch.tenantId;
    }
    if (!user?.isActive) return null;

    const ownerTenantIds = [...new Set(user.tenantMemberships.map((membership) => membership.tenantId))];
    return ownerTenantIds.length === 1 ? ownerTenantIds[0] ?? null : null;
  }

  private async findEnabledTelegramTenant(where: { code: string }): Promise<string | null> {
    const tenant = await this.prisma.restaurantTenant.findFirst({
      where: {
        ...where,
        status: "ACTIVE",
        features: { some: { code: "TELEGRAM_ORDERS", isEnabled: true } },
        domains: { some: { status: "VERIFIED" } },
      },
      select: { id: true, code: true },
    });
    if (!tenant) return null;
    return await this.hasStaffNotificationRoute(tenant.id, tenant.code) ? tenant.id : null;
  }

  private async isEnabledTelegramTenant(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.restaurantTenant.findFirst({
      where: {
        id: tenantId,
        status: "ACTIVE",
        features: { some: { code: "TELEGRAM_ORDERS", isEnabled: true } },
        domains: { some: { status: "VERIFIED" } },
      },
      select: { id: true, code: true },
    });
    return Boolean(tenant && await this.hasStaffNotificationRoute(tenant.id, tenant.code));
  }

  private async hasStaffNotificationRoute(tenantId: string, tenantCode: string): Promise<boolean> {
    const configuration = await this.prisma.tenantTelegramConfiguration.findUnique({
      where: { tenantId },
      select: { staffChatId: true },
    });
    return Boolean(configuration?.staffChatId || (tenantCode === "MAZETTO_FOOD" && process.env.TELEGRAM_STAFF_CHAT_ID));
  }
}
