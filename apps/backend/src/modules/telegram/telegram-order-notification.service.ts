import { orderStatusLabel as sharedOrderStatusLabel } from "../../common/utils/order-status-label";
import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { CustomerOrderType, EmployeeStatus, KitchenTicketStatus, OrderStatus, Prisma } from "@prisma/client";
import { KitchenService, type KitchenStaffAction } from "../kitchen/kitchen.service";
import { kitchenStatusForOrder } from "../kitchen/kitchen-status-sync";
import { PrismaService } from "../../prisma/prisma.service";
import { resolveSoleActiveTenantId } from "../../common/auth/tenant-scope";
import { NotificationDeadLetterService } from "../notifications/notification-dead-letter.service";

type StaffOrderAction = KitchenStaffAction;
type LegacyCallbackStatus = "CONFIRMED" | "PREPARING" | "READY" | "CANCELLED";
type TelegramInlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
};
type TelegramInlineKeyboard = {
  inline_keyboard: TelegramInlineButton[][];
};
type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from?: { id?: number | string };
  message?: {
    chat?: { id: number | string };
    message_id?: number;
  };
};
type TelegramUpdate = {
  callback_query?: TelegramCallbackQuery;
};
type StaffOrderForMessage = {
  id: string;
  tenantId: string;
  branchId: string;
  servedById: string | null;
  orderNumber: string;
  displayOrderNumber: string | null;
  staffTelegramChatId: string | null;
  staffTelegramMessageId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryLocation: Prisma.JsonValue | null;
  type: string;
  status: OrderStatus;
  acceptedAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  total: Prisma.Decimal;
  notes: string | null;
  items: {
    productName: string;
    variantName: string | null;
    quantity: Prisma.Decimal;
    totalPrice: Prisma.Decimal;
    modifierSnapshot: Prisma.JsonValue | null;
    notes: string | null;
  }[];
  customerOrder:
    | {
        type: CustomerOrderType;
        paymentMethod: string | null;
        customer: { telegramChatId: string | null } | null;
      }
    | null;
  kitchenTickets: {
    id: string;
    status: KitchenTicketStatus;
    acceptedAt: Date | null;
    completedAt: Date | null;
  }[];
};
type StaffTransitionResult = {
  changed: boolean;
  order: StaffOrderForMessage;
};
type StaffOrderRecipientRole = "OWNER" | "CASHIER";
type StaffOrderRecipientPayload = {
  role: StaffOrderRecipientRole;
  recipientId: string;
};
type TelegramResponse = {
  ok?: boolean;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
  result?: {
    message_id?: number;
    chat?: { id?: number | string };
  };
};
type NewOrderDeliveryResult =
  | "sent"
  | "failed"
  | "skipped"
  | { kind: "retryable"; retryAfterSeconds: number | null };
type OutboxDeliveryResult =
  | NewOrderDeliveryResult
  | "ignored"
  | { kind: "rejected"; reason: string };

class TelegramRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "TelegramRequestError";
  }
}
export type DeadLetterRetryResult =
  | "sent"
  | "failed"
  | "unavailable"
  | "not-found"
  | "not-retryable";

const callbackPrefix = "mazetto_order";
const staffTelegramRoleCodes = ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "KITCHEN"];
const telegramRequestMaxAttempts = 3;
const telegramRequestRetryDelayMs = 250;
const actionLabels: Record<StaffOrderAction, string> = {
  accept: "Qabul qilindi",
  start_preparing: "Tayyorlanmoqda",
  mark_ready: "Tayyor",
  cancel: "Bekor qilindi",
  complete: "Oshxonadan topshirildi",
};
const legacyStatusToAction: Record<LegacyCallbackStatus, StaffOrderAction> = {
  CONFIRMED: "accept",
  PREPARING: "start_preparing",
  READY: "mark_ready",
  CANCELLED: "cancel",
};

@Injectable()
export class TelegramOrderNotificationService {
  private readonly messageUpdates = new Map<string, Promise<void>>();

  private enqueueMessage<T>(orderId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.messageUpdates.get(orderId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(work);
    const tracked = next.then(() => undefined, () => undefined);
    this.messageUpdates.set(orderId, tracked);
    void tracked.finally(() => {
      if (this.messageUpdates.get(orderId) === tracked) this.messageUpdates.delete(orderId);
    }).catch(() => undefined);
    return next;
  }
  private readonly logger = new Logger(TelegramOrderNotificationService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenService: KitchenService,
    private readonly deadLetters: NotificationDeadLetterService,
  ) {}
  async notifyNewOrder(orderId: string): Promise<void> {
    return this.enqueueMessage(orderId, async () => {
      await this.sendNewOrder(orderId);
    });
  }

  async deliverOutboxNewOrder(
    orderId: string,
    tenantId: string,
  ): Promise<NewOrderDeliveryResult> {
    return this.sendNewOrder(orderId, tenantId, false);
  }

  async deliverOutboxRoleNewOrder(
    orderId: string,
    tenantId: string,
    payload: unknown,
  ): Promise<OutboxDeliveryResult> {
    const recipient = this.parseRoleOrderRecipient(payload);
    if (!recipient) {
      return { kind: "rejected", reason: "Staff order recipient payload is invalid." };
    }

    const settingKey =
      recipient.role === "OWNER"
        ? "telegram_owner_order_notifications_enabled"
        : "telegram_cashier_order_notifications_enabled";
    if (!(await this.isNotificationEnabled(tenantId, settingKey))) return "ignored";

    const order = await this.findOrderForTenant(orderId, tenantId);
    if (!order || !order.customerOrder) {
      return { kind: "rejected", reason: "Staff order was not found in its tenant." };
    }

    const chatId = await this.findStaffRecipientChatId(
      tenantId,
      order.branchId,
      recipient,
    );
    if (!chatId) return "ignored";

    return this.sendDirectStaffOrderMessage(chatId, order, recipient.role);
  }

  async deliverOutboxCourierAssignment(
    orderId: string,
    tenantId: string,
    payload: unknown,
  ): Promise<OutboxDeliveryResult> {
    const employeeId = this.parseCourierAssignment(payload);
    if (!employeeId) {
      return { kind: "rejected", reason: "Courier assignment payload is invalid." };
    }
    if (
      !(await this.isNotificationEnabled(
        tenantId,
        "telegram_courier_order_notifications_enabled",
      ))
    ) {
      return "ignored";
    }

    const order = await this.findOrderForTenant(orderId, tenantId);
    if (!order || !order.customerOrder || order.customerOrder.type !== CustomerOrderType.DELIVERY) {
      return "ignored";
    }
    if (order.servedById !== employeeId) return "ignored";

    const courier = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        branchId: order.branchId,
        status: EmployeeStatus.ACTIVE,
        telegramUserId: { not: null },
        user: {
          is: {
            isActive: true,
            tenantMemberships: {
              some: {
                tenantId,
                status: "ACTIVE",
                OR: [{ branchId: null }, { branchId: order.branchId }],
                roles: { some: { role: { code: "COURIER" } } },
              },
            },
          },
        },
      },
      select: { telegramUserId: true },
    });
    const chatId = courier?.telegramUserId;
    if (!chatId) return "ignored";

    return this.sendDirectStaffOrderMessage(chatId, order, "COURIER");
  }

  async deliverOutboxCustomerStatus(
    orderId: string,
    tenantId: string,
    payload: unknown,
  ): Promise<OutboxDeliveryResult> {
    const statusValue =
      payload !== null && typeof payload === "object" && "status" in payload
        ? (payload as { status?: unknown }).status
        : undefined;
    if (
      typeof statusValue !== "string" ||
      !Object.values(OrderStatus).includes(statusValue as OrderStatus)
    ) {
      return { kind: "rejected", reason: "Customer status payload is invalid." };
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) return "skipped";

    const actualTenantId = await this.resolveOrderTenantId(orderId);
    if (!actualTenantId) {
      return { kind: "rejected", reason: "Customer-status order has no tenant." };
    }
    if (actualTenantId !== tenantId) {
      return { kind: "rejected", reason: "Customer-status tenant does not match the order." };
    }

    const order = await this.findOrderForMessage(orderId, this.prisma, tenantId);
    if (!order) {
      return { kind: "rejected", reason: "Customer-status order was not found." };
    }
    const chatId = order.customerOrder?.customer?.telegramChatId;
    if (!chatId) return "ignored";

    const message = this.customerStatusMessage(
      this.publicOrderNumber(order),
      statusValue as OrderStatus,
    );
    if (!message) return "ignored";

    try {
      const response = await this.telegramRequest(
        "sendMessage",
        { chat_id: chatId, text: message, parse_mode: "HTML" },
        { maxAttempts: 1 },
      );
      return response ? "sent" : "skipped";
    } catch (error) {
      if (error instanceof TelegramRequestError && error.status === 429) {
        return {
          kind: "retryable",
          retryAfterSeconds: error.retryAfterSeconds,
        };
      }
      this.logger.warn(
        `Customer Telegram status delivery failed for order ${orderId}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      return "failed";
    }
  }

  private async sendNewOrder(
    orderId: string,
    expectedTenantId?: string,
    recordFailure = true,
  ): Promise<NewOrderDeliveryResult> {
    let tenantId: string | null = null;
    if (!process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_STAFF_BOT_TOKEN) {
      this.logger.warn("Telegram order notifications are disabled: no bot token is configured");
      return "skipped";
    }

    try {
      tenantId = await this.resolveOrderTenantId(orderId);
      if (!tenantId) {
        this.logger.warn("Telegram notification skipped: order " + orderId + " has no tenant branch");
        return "skipped";
      }
      if (expectedTenantId && expectedTenantId !== tenantId) {
        throw new ForbiddenException("Notification order does not belong to the requested tenant");
      }

      const order = await this.findOrderForTenant(orderId, tenantId);
      if (!order) {
        this.logger.warn("Telegram notification skipped: order " + orderId + " was not found");
        return "skipped";
      }

      const roleRecipients = order.customerOrder
        ? await this.queueRoleNewOrderNotifications(order, tenantId)
        : 0;

      if (!this.isConfigured()) {
        if (roleRecipients > 0) return "sent";
        this.logger.warn("Telegram order notifications are disabled: TELEGRAM_BOT_TOKEN or TELEGRAM_STAFF_CHAT_ID is missing");
        return "skipped";
      }

      try {
        // Shared group delivery stays fail-closed when multiple tenants are active.
        const sharedOrder = await this.findOrderForMessage(orderId, this.prisma, tenantId);
        if (!sharedOrder) return roleRecipients > 0 ? "sent" : "skipped";
        const response = await this.telegramRequest(
          "sendMessage",
          {
            chat_id: this.staffChatId(),
            text: this.formatStaffOrderMessage(sharedOrder),
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
            reply_markup: this.staffOrderKeyboard(sharedOrder),
          },
          { maxAttempts: 1 },
        );
        await this.rememberStaffMessage(sharedOrder.id, response);
        return "sent";
      } catch (error) {
        if (error instanceof ForbiddenException && expectedTenantId) {
          this.logger.warn("Shared Telegram staff chat was skipped because tenant context is ambiguous; tenant-scoped notifications were queued when enabled.");
          return "sent";
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof TelegramRequestError && error.status === 429) {
        return {
          kind: "retryable",
          retryAfterSeconds: error.retryAfterSeconds,
        };
      }
      this.logger.error(
        "Telegram order notification failed for order " + orderId,
        error instanceof Error ? error.stack : String(error),
      );
      if (recordFailure && tenantId) await this.deadLetters.record({
        tenantId,
        kind: "staff_new_order",
        orderId,
        error,
        attempts: 1,
      });
      return "failed";
    }
  }

  private async queueRoleNewOrderNotifications(
    order: StaffOrderForMessage,
    tenantId: string,
  ): Promise<number> {
    const enabledRows = await this.prisma.setting.findMany({
      where: {
        tenantId,
        key: {
          in: [
            "telegram_owner_order_notifications_enabled",
            "telegram_cashier_order_notifications_enabled",
          ],
        },
        value: "true",
      },
      select: { key: true },
    });
    const enabled = new Set(enabledRows.map((row) => row.key));
    const ownerEnabled = enabled.has("telegram_owner_order_notifications_enabled");
    const cashierEnabled = enabled.has("telegram_cashier_order_notifications_enabled");
    if (!ownerEnabled && !cashierEnabled) return 0;

    const branchMembership = {
      tenantId,
      status: "ACTIVE" as const,
      OR: [{ branchId: null }, { branchId: order.branchId }],
    };
    const [owners, cashiers] = await Promise.all([
      ownerEnabled
        ? this.prisma.user.findMany({
            where: {
              isActive: true,
              telegramUserId: { not: null },
              tenantMemberships: {
                some: {
                  ...branchMembership,
                  roles: { some: { role: { code: "SUPER_ADMIN" } } },
                },
              },
            },
            select: { id: true },
          })
        : Promise.resolve([]),
      cashierEnabled
        ? this.prisma.employee.findMany({
            where: {
              branchId: order.branchId,
              status: EmployeeStatus.ACTIVE,
              telegramUserId: { not: null },
              user: {
                is: {
                  isActive: true,
                  tenantMemberships: {
                    some: {
                      ...branchMembership,
                      roles: { some: { role: { code: "CASHIER" } } },
                    },
                  },
                },
              },
            },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    const recipients: StaffOrderRecipientPayload[] = [
      ...owners.map((owner) => ({ role: "OWNER" as const, recipientId: owner.id })),
      ...cashiers.map((cashier) => ({ role: "CASHIER" as const, recipientId: cashier.id })),
    ];
    if (recipients.length === 0) return 0;

    await this.prisma.notificationOutbox.createMany({
      data: recipients.map((recipient) => ({
        tenantId,
        dedupeKey:
          "telegram_" +
          recipient.role.toLowerCase() +
          "_new_order:" +
          order.id +
          ":" +
          recipient.recipientId,
        kind: "staff_role_new_order",
        orderId: order.id,
        payload: recipient,
      })),
      skipDuplicates: true,
    });
    return recipients.length;
  }

  private parseRoleOrderRecipient(payload: unknown): StaffOrderRecipientPayload | null {
    if (!payload || typeof payload !== "object") return null;
    const record = payload as { role?: unknown; recipientId?: unknown };
    if (
      (record.role !== "OWNER" && record.role !== "CASHIER") ||
      typeof record.recipientId !== "string" ||
      record.recipientId.length === 0
    ) {
      return null;
    }
    return { role: record.role, recipientId: record.recipientId };
  }

  private parseCourierAssignment(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null;
    const employeeId = (payload as { employeeId?: unknown }).employeeId;
    return typeof employeeId === "string" && employeeId.length > 0
      ? employeeId
      : null;
  }

  private async isNotificationEnabled(
    tenantId: string,
    key:
      | "telegram_owner_order_notifications_enabled"
      | "telegram_cashier_order_notifications_enabled"
      | "telegram_courier_order_notifications_enabled",
  ): Promise<boolean> {
    const setting = await this.prisma.setting.findUnique({
      where: { tenantId_key: { tenantId, key } },
      select: { value: true },
    });
    return setting?.value === "true";
  }

  private async findStaffRecipientChatId(
    tenantId: string,
    branchId: string,
    recipient: StaffOrderRecipientPayload,
  ): Promise<string | null> {
    const branchMembership = {
      tenantId,
      status: "ACTIVE" as const,
      OR: [{ branchId: null }, { branchId }],
    };

    if (recipient.role === "OWNER") {
      const owner = await this.prisma.user.findFirst({
        where: {
          id: recipient.recipientId,
          isActive: true,
          telegramUserId: { not: null },
          tenantMemberships: {
            some: {
              ...branchMembership,
              roles: { some: { role: { code: "SUPER_ADMIN" } } },
            },
          },
        },
        select: { telegramUserId: true },
      });
      return owner?.telegramUserId ?? null;
    }

    const cashier = await this.prisma.employee.findFirst({
      where: {
        id: recipient.recipientId,
        branchId,
        status: EmployeeStatus.ACTIVE,
        telegramUserId: { not: null },
        user: {
          is: {
            isActive: true,
            tenantMemberships: {
              some: {
                ...branchMembership,
                roles: { some: { role: { code: "CASHIER" } } },
              },
            },
          },
        },
      },
      select: { telegramUserId: true },
    });
    return cashier?.telegramUserId ?? null;
  }

  private async sendDirectStaffOrderMessage(
    chatId: string,
    order: StaffOrderForMessage,
    role: StaffOrderRecipientRole | "COURIER",
  ): Promise<OutboxDeliveryResult> {
    const token = process.env.TELEGRAM_STAFF_BOT_TOKEN;
    if (!token) return "skipped";
    const nextStep =
      role === "COURIER"
        ? "Kuryer paneli: /courier"
        : role === "CASHIER"
          ? "Kassa paneli: /cashier"
          : "Boshqaruv paneli: /admin";

    try {
      const response = await this.telegramRequest(
        "sendMessage",
        {
          chat_id: chatId,
          text: this.formatStaffOrderMessage(order) + "\n\n" + nextStep,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        },
        { maxAttempts: 1 },
        token,
      );
      return response ? "sent" : "skipped";
    } catch (error) {
      if (error instanceof TelegramRequestError) {
        if (error.status === 429) {
          return {
            kind: "retryable",
            retryAfterSeconds: error.retryAfterSeconds,
          };
        }
        if (error.status && error.status >= 500) {
          return { kind: "retryable", retryAfterSeconds: null };
        }
        return {
          kind: "rejected",
          reason: "Telegram could not deliver the staff message. The recipient may need to start the staff bot.",
        };
      }
      return {
        kind: "retryable",
        retryAfterSeconds: null,
      };
    }
  }

  /**
   * O'lik xatni qayta yuboradi.
   *
   * Yozuv ro'yxatdan FAQAT muvaffaqiyatdan keyin olib tashlanadi: qayta
   * urinish ham yiqilsa, u ko'rinib turishi kerak. Aks holda "qayta
   * yuborish" tugmasi muammoni yashirib qo'yardi.
   */
  async retryDeadLetter(
    tenantId: string,
    messageId: string,
  ): Promise<DeadLetterRetryResult> {
    const entries = await this.deadLetters.list(tenantId, 500);
    const entry = entries.find((row) => row.messageId === messageId);

    if (!entry) {
      return "not-found";
    }

    /*
     * Status-refresh job'lari hodisaning eski payload'ini takrorlamaydi:
     * xodim xabari buyurtmaning joriy holatidan qayta chiziladi.
     */
    const recipientNotification =
      entry.kind === "staff_role_new_order" ||
      entry.kind === "staff_courier_assignment";
    if (
      ![
        "staff_new_order",
        "staff_status_refresh",
        "customer_status",
        "staff_role_new_order",
        "staff_courier_assignment",
      ].includes(entry.kind)
    ) {
      return "not-retryable";
    }

    if (!recipientNotification) {
      const activeTenantId = await resolveSoleActiveTenantId(this.prisma);
      if (activeTenantId !== tenantId) {
        throw new ForbiddenException("Telegram qayta yuborish tenantiga mos kelmadi");
      }
    } else {
      const tenant = await this.prisma.restaurantTenant.findUnique({
        where: { id: tenantId },
        select: { status: true },
      });
      if (tenant?.status !== "ACTIVE") {
        throw new ForbiddenException("Telegram qayta yuborish tenantiga mos kelmadi");
      }
    }

    let deliveryResult: OutboxDeliveryResult | DeadLetterRetryResult;
    if (recipientNotification) {
      const outboxId = Number(messageId.slice("outbox-".length));
      if (!Number.isSafeInteger(outboxId) || outboxId <= 0) return "not-found";
      const job = await this.prisma.notificationOutbox.findFirst({
        where: {
          id: outboxId,
          tenantId,
          orderId: entry.orderId,
          kind: entry.kind,
        },
        select: { payload: true },
      });
      if (!job) return "not-found";
      deliveryResult =
        entry.kind === "staff_role_new_order"
          ? await this.deliverOutboxRoleNewOrder(entry.orderId, tenantId, job.payload)
          : await this.deliverOutboxCourierAssignment(entry.orderId, tenantId, job.payload);
    } else {
      deliveryResult =
        entry.kind === "staff_status_refresh"
          ? await this.deliverOutboxStaffStatusRefresh(entry.orderId, tenantId)
          : await this.enqueueMessage(entry.orderId, () =>
              entry.kind === "staff_new_order"
                ? this.sendNewOrder(entry.orderId, tenantId, false)
                : this.resendCurrentCustomerStatus(entry.orderId, tenantId),
            );
    }

    if (deliveryResult === "failed") {
      return "failed";
    }
    if (deliveryResult === "skipped" || deliveryResult === "ignored") {
      return "unavailable";
    }

    if (
      typeof deliveryResult === "object" &&
      deliveryResult.kind === "rejected"
    ) {
      return "failed";
    }

    if (
      typeof deliveryResult === "object" &&
      deliveryResult.kind === "retryable"
    ) {
      // Telegram explicitly rejected the request; keep the dead letter visible.
      return "failed";
    }

    // Keep the failed record until Telegram confirms delivery with `ok: true`.
    if (entry.messageId.startsWith("outbox-")) {
      const outboxId = Number(entry.messageId.slice("outbox-".length));
      if (Number.isSafeInteger(outboxId) && outboxId > 0) {
        try {
          await this.prisma.notificationOutbox.updateMany({
            where: {
              id: outboxId,
              tenantId,
              status: { in: ["UNCERTAIN", "FAILED"] },
            },
            data: {
              status: "DELIVERED",
              deliveredAt: new Date(),
              lastError: null,
            },
          });
        } catch (error) {
          this.logger.warn(
            `Telegram delivery succeeded but outbox status could not be updated: ${error instanceof Error ? error.message : "unknown error"}`,
          );
        }
      }
    }
    await this.deadLetters.take(tenantId, messageId);
    return "sent";
  }

  async deliverOutboxStaffStatusRefresh(
    orderId: string,
    tenantId: string,
  ): Promise<OutboxDeliveryResult> {
    if (!this.isConfigured()) return "skipped";

    return this.enqueueMessage(orderId, async () => {
      const actualTenantId = await this.resolveOrderTenantId(orderId);
      if (!actualTenantId) {
        return { kind: "rejected", reason: "Staff-status order has no tenant." };
      }
      if (actualTenantId !== tenantId) {
        return { kind: "rejected", reason: "Staff-status tenant does not match the order." };
      }

      const order = await this.findOrderForMessage(orderId, this.prisma, tenantId);
      if (!order) {
        return { kind: "rejected", reason: "Staff-status order was not found." };
      }
      if (!order.staffTelegramMessageId) return "ignored";

      try {
        await this.renderStoredStaffOrderMessage(order);
        return "sent";
      } catch (error) {
        this.logger.warn(
          `Telegram staff status refresh failed for order ${orderId}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
        return "failed";
      }
    });
  }

  async handleWebhook(secret: string, update: unknown) {
    this.assertWebhookSecret(secret);
    const callback = this.toTelegramUpdate(update).callback_query;

    if (!callback?.data?.startsWith(`${callbackPrefix}:`)) {
      return { ok: true, handled: false };
    }

    try {
      const { orderId, action } = this.parseCallbackData(callback.data);
      await this.assertStaffCallback(callback, orderId);
      const result = await this.applyStaffAction(orderId, action);
      const callbackText = result.changed
        ? `${this.publicOrderNumber(result.order)}: ${actionLabels[action]}`
        : `${this.publicOrderNumber(result.order)}: bu amal allaqachon bajarilgan`;

      await this.answerCallbackSafely(callback.id, callbackText, result.order, action);
      await this.renderStaffOrderMessageSafely(callback, result.order, action);

      return { ok: true, handled: true };
    } catch (error) {
      try {
        const { orderId } = this.parseCallbackData(callback.data);
        await this.assertStaffCallback(callback, orderId);
        const tenantId = await this.resolveOrderTenantId(orderId);
        if (tenantId) {
          await this.deliverOutboxStaffStatusRefresh(orderId, tenantId);
        }
      } catch {
        // Unauthorized and malformed callbacks must not refresh any order.
      }
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        this.logger.warn(
          `Telegram staff callback rejected: ${error instanceof Error ? error.message : String(error)}`,
        );
      } else {
        this.logger.error(
          "Telegram staff callback handling failed",
          error instanceof Error ? error.stack : String(error),
        );
      }

      if (callback.id) {
        await this.answerCallbackErrorSafely(callback.id, error);
      }

      return { ok: true, handled: true };
    }
  }

  private async applyStaffAction(orderId: string, action: StaffOrderAction): Promise<StaffTransitionResult> {
    const transition = await this.kitchenService.applyOrderAction(orderId, action, {
      reasonPrefix: "Telegram staff",
      cancellationReason: "Telegram staff orqali bekor qilindi",
    });
    const order = await this.findOrderForMessage(orderId);

    if (!order) {
      throw new BadRequestException("Buyurtma topilmadi");
    }

    return {
      changed: transition.changed,
      order,
    };
  }

  private async resolveOrderTenantId(orderId: string): Promise<string | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { branch: { select: { tenantId: true } } },
    });
    return order?.branch.tenantId ?? null;
  }

  private async findOrderForTenant(
    orderId: string,
    tenantId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<StaffOrderForMessage | null> {
    const order = await client.order.findFirst({
      where: { id: orderId, tenantId, branch: { tenantId } },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        customerOrder: {
          include: {
            customer: { select: { telegramChatId: true } },
          },
        },
        kitchenTickets: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!order) return null;
    return {
      ...order,
      kitchenTickets: order.kitchenTickets.map((ticket) => ({
        ...ticket,
        status:
          ticket.status === KitchenTicketStatus.COMPLETED ||
          ticket.status === KitchenTicketStatus.CANCELLED
            ? ticket.status
            : kitchenStatusForOrder(order.status) ?? ticket.status,
      })),
    };
  }

  private async findOrderForMessage(
    orderId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
    expectedTenantId?: string,
  ): Promise<StaffOrderForMessage | null> {
    const activeTenantId = await resolveSoleActiveTenantId(client);
    if (expectedTenantId && expectedTenantId !== activeTenantId) {
      throw new ForbiddenException("Telegram notification tenant context is ambiguous");
    }
    const tenantId = expectedTenantId ?? activeTenantId;
    const order = await client.order.findFirst({
      where: { id: orderId, branch: { tenantId } },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        customerOrder: {
          include: {
            customer: { select: { telegramChatId: true } },
          },
        },
        kitchenTickets: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!order) return null;
    return {
      ...order,
      kitchenTickets: order.kitchenTickets.map(ticket => ({
        ...ticket,
        status: ticket.status === KitchenTicketStatus.COMPLETED || ticket.status === KitchenTicketStatus.CANCELLED
          ? ticket.status : kitchenStatusForOrder(order.status) ?? ticket.status,
      })),
    };
  }

  private formatStaffOrderMessage(order: StaffOrderForMessage): string {
    const ticket = order.kitchenTickets[0] ?? null;
    const lines = [
      ticket?.status === KitchenTicketStatus.COMPLETED && order.status === OrderStatus.READY
        ? "<b>Oshxonadan topshirildi</b>" : this.staffOrderTitle(order.status === OrderStatus.CONFIRMED && ticket?.status === KitchenTicketStatus.NEW ? OrderStatus.NEW : order.status, order.customerOrder?.type ?? order.type),
      "",
      `<b>Raqam:</b> ${this.escapeHtml(this.publicOrderNumber(order))}`,
      `<b>Holat:</b> ${ticket?.status === KitchenTicketStatus.COMPLETED && order.status === OrderStatus.READY ? "Oshxonadan topshirildi" : order.status === OrderStatus.CONFIRMED && ticket?.status === KitchenTicketStatus.NEW ? "Yangi" : this.orderStatusLabel(order.status, order.customerOrder?.type ?? order.type)}`,
      `<b>Mijoz:</b> ${this.escapeHtml(order.customerName ?? "Noma'lum")}`,
      `<b>Telefon:</b> ${this.escapeHtml(order.customerPhone ?? "Kiritilmagan")}`,
      ...this.formatDeliveryLocationLines(order),
      `<b>Turi:</b> ${this.orderTypeLabel(order.customerOrder?.type ?? order.type)}`,
      `<b>To'lov:</b> ${this.paymentMethodLabel(order.customerOrder?.paymentMethod ?? null)}`,
      "",
      "<b>Mahsulotlar:</b>",
      ...order.items.flatMap((item) => this.formatItemLines(item)),
      "",
      `<b>Jami:</b> ${this.formatMoney(order.total)}`,
    ];

    if (order.notes) {
      lines.push("", `<b>Izoh:</b> ${this.escapeHtml(order.notes)}`);
    }

    return lines.join("\n");
  }

  private formatItemLines(item: {
    productName: string;
    variantName: string | null;
    quantity: Prisma.Decimal;
    totalPrice: Prisma.Decimal;
    modifierSnapshot: Prisma.JsonValue | null;
    notes: string | null;
  }): string[] {
    const quantity = Number(item.quantity).toLocaleString("uz-UZ");
    const title = `• ${quantity}x ${this.escapeHtml(item.productName)}${item.variantName ? ` ${this.escapeHtml(item.variantName)}` : ""} - ${this.formatMoney(item.totalPrice)}`;
    const modifiers = this.modifierNames(item.modifierSnapshot).map((modifier) => `  - ${this.escapeHtml(modifier)}`);
    const notes = item.notes ? [`  - Izoh: ${this.escapeHtml(item.notes)}`] : [];
    return [title, ...modifiers, ...notes];
  }

  private formatDeliveryLocationLines(order: StaffOrderForMessage): string[] {
    const type = order.customerOrder?.type ?? order.type;

    if (type !== "DELIVERY") {
      return [];
    }

    const lines = [
      `<b>Manzil:</b> ${this.escapeHtml(order.deliveryAddress ?? "Kiritilmagan")}`,
    ];
    const mapUrl = this.deliveryMapUrl(order.deliveryLocation);

    if (mapUrl) {
      lines.push(
        `<b>Lokatsiya:</b> <a href="${this.escapeHtml(mapUrl)}">xaritada ochish</a>`,
      );
    }

    return lines;
  }

  private deliveryMapUrl(location: Prisma.JsonValue | null): string | null {
    if (!location || typeof location !== "object" || Array.isArray(location)) {
      return null;
    }

    const record = location as Record<string, unknown>;
    const rawLatitude = record.latitude;
    const rawLongitude = record.longitude;
    if (
      (typeof rawLatitude !== "number" && (typeof rawLatitude !== "string" || !rawLatitude.trim())) ||
      (typeof rawLongitude !== "number" && (typeof rawLongitude !== "string" || !rawLongitude.trim()))
    ) {
      return null;
    }
    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return null;
    }

    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  private modifierNames(snapshot: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(snapshot)) {
      return [];
    }

    return snapshot
      .map((modifier) => {
        if (modifier && typeof modifier === "object" && "name" in modifier) {
          return String(modifier.name);
        }

        return null;
      })
      .filter((value): value is string => Boolean(value));
  }

  private staffOrderKeyboard(order: StaffOrderForMessage): TelegramInlineKeyboard {
    const type = order.customerOrder?.type ?? order.type;
    const mapUrl = type === "DELIVERY" ? this.deliveryMapUrl(order.deliveryLocation) : null;
    return {
      inline_keyboard: mapUrl
        ? [[{ text: "📍 Xaritada ochish", url: mapUrl }]]
        : [],
    };
  }

  private staffOrderTitle(status: OrderStatus, type?: string): string {
    return `<b>${sharedOrderStatusLabel(status, type)}</b>`;
  }

  private parseCallbackData(data: string): { action: StaffOrderAction; orderId: string } {
    const [, rawAction, orderId] = data.split(":");

    if (!orderId) {
      throw new BadRequestException("Invalid Telegram callback payload");
    }

    if (this.isStaffOrderAction(rawAction)) {
      return { action: rawAction, orderId };
    }

    if (this.isLegacyCallbackStatus(rawAction)) {
      return { action: legacyStatusToAction[rawAction], orderId };
    }

    throw new BadRequestException("Invalid Telegram callback payload");
  }

  private isStaffOrderAction(value: string | undefined): value is StaffOrderAction {
    return value === "accept" || value === "start_preparing" || value === "mark_ready" || value === "cancel" || value === "complete";
  }

  private isLegacyCallbackStatus(value: string | undefined): value is LegacyCallbackStatus {
    return value === "CONFIRMED" || value === "PREPARING" || value === "READY" || value === "CANCELLED";
  }

  private async answerCallback(callbackQueryId: string, text: string): Promise<void> {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return;
    }

    await this.telegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    });
  }

  private async answerCallbackSafely(
    callbackQueryId: string,
    text: string,
    order: Pick<StaffOrderForMessage, "id" | "orderNumber">,
    action: StaffOrderAction,
  ): Promise<void> {
    try {
      await this.answerCallback(callbackQueryId, text);
    } catch (error) {
      this.logger.warn(
        `Telegram staff callback acknowledgement failed for order ${order.id} (${order.orderNumber}) action ${action}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async answerCallbackErrorSafely(callbackQueryId: string, error: unknown): Promise<void> {
    try {
      await this.answerCallback(callbackQueryId, this.safeCallbackError(error));
    } catch (callbackError) {
      this.logger.warn(
        `Telegram staff callback error acknowledgement failed: ${
          callbackError instanceof Error ? callbackError.message : String(callbackError)
        }`,
      );
    }
  }

  private async renderStaffOrderMessage(callback: TelegramCallbackQuery, order: StaffOrderForMessage): Promise<void> {
    const chatId = callback.message?.chat?.id ?? this.staffChatId();
    const messageId = callback.message?.message_id;
    const payload = {
      chat_id: chatId,
      text: this.formatStaffOrderMessage(order),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: this.staffOrderKeyboard(order),
    };

    if (messageId) {
      try {
        await this.telegramRequest("editMessageText", {
          ...payload,
          message_id: messageId,
        });
        await this.rememberStaffMessage(order.id, { result: { message_id: messageId, chat: { id: chatId } } });
        return;
      } catch (error) {
        if (this.isMessageNotModifiedError(error)) {
          return;
        }

        if (!this.isMessageEditImpossibleError(error)) {
          throw error;
        }
      }
    }

    const response = await this.telegramRequest("sendMessage", payload);
    await this.rememberStaffMessage(order.id, response);
  }

  private async renderStoredStaffOrderMessage(order: StaffOrderForMessage): Promise<void> {
    const payload = {
      chat_id: order.staffTelegramChatId ?? this.staffChatId(),
      text: this.formatStaffOrderMessage(order),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: this.staffOrderKeyboard(order),
    };

    if (order.staffTelegramMessageId) {
      try {
        await this.telegramRequest("editMessageText", {
          ...payload,
          message_id: order.staffTelegramMessageId,
        });
        return;
      } catch (error) {
        if (this.isMessageNotModifiedError(error)) {
          return;
        }

        if (!this.isMessageEditImpossibleError(error)) {
          throw error;
        }
      }
    }

    const response = await this.telegramRequest("sendMessage", payload);
    await this.rememberStaffMessage(order.id, response);
  }

  private async renderStaffOrderMessageSafely(
    callback: TelegramCallbackQuery,
    order: StaffOrderForMessage,
    action: StaffOrderAction,
  ): Promise<void> {
    try {
      await this.enqueueMessage(order.id, async () => {
        const latest = await this.findOrderForMessage(order.id);
        if (!latest) return;
        if (latest.staffTelegramMessageId) {
          await this.renderStoredStaffOrderMessage(latest);
          if (callback.message?.message_id && callback.message.message_id !== latest.staffTelegramMessageId) {
            await this.telegramRequest("editMessageReplyMarkup", {
              chat_id: callback.message.chat?.id, message_id: callback.message.message_id,
              reply_markup: { inline_keyboard: [] },
            });
          }
        } else {
          await this.renderStaffOrderMessage(callback, latest);
        }
      });
    } catch (error) {
      this.logger.warn(
        `Telegram staff message render failed for order ${order.id} (${order.orderNumber}) action ${action}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async resendCurrentCustomerStatus(
    orderId: string,
    tenantId: string,
  ): Promise<NewOrderDeliveryResult> {
    if (!process.env.TELEGRAM_BOT_TOKEN) return "skipped";

    const actualTenantId = await this.resolveOrderTenantId(orderId);
    if (!actualTenantId) return "skipped";
    if (actualTenantId !== tenantId) {
      throw new ForbiddenException(
        "Customer notification order does not belong to the requested tenant",
      );
    }

    const order = await this.findOrderForMessage(orderId, this.prisma, tenantId);
    const chatId = order?.customerOrder?.customer?.telegramChatId;
    if (!order || !chatId) return "skipped";

    const message = this.customerStatusMessage(
      this.publicOrderNumber(order),
      order.status,
    );
    if (!message) return "skipped";

    try {
      const response = await this.telegramRequest(
        "sendMessage",
        { chat_id: chatId, text: message, parse_mode: "HTML" },
        { maxAttempts: 1 },
      );
      return response ? "sent" : "skipped";
    } catch (error) {
      if (error instanceof TelegramRequestError && error.status === 429) {
        return {
          kind: "retryable",
          retryAfterSeconds: error.retryAfterSeconds,
        };
      }
      this.logger.warn(
        `Customer Telegram status retry failed for order ${orderId}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      return "failed";
    }
  }

  private customerStatusMessage(orderNumber: string, status: OrderStatus): string | null {
    const escapedOrderNumber = this.escapeHtml(orderNumber);
    const messages: Partial<Record<OrderStatus, string>> = {
      CONFIRMED: `✅ <b>${escapedOrderNumber}</b> buyurtmangiz qabul qilindi.`,
      PREPARING: `👨‍🍳 <b>${escapedOrderNumber}</b> tayyorlanmoqda.`,
      READY: `✨ <b>${escapedOrderNumber}</b> tayyor.`,
      CANCELLED: `⚠️ <b>${escapedOrderNumber}</b> buyurtmangiz bekor qilindi.`,
    };

    return messages[status] ?? null;
  }

  private async telegramRequest(
    method: string,
    payload: unknown,
    options: { maxAttempts?: number } = {},
    requestToken = process.env.TELEGRAM_BOT_TOKEN,
  ): Promise<TelegramResponse | undefined> {
    const token = requestToken;

    if (!token) {
      return undefined;
    }

    let lastError: unknown;
    const maxAttempts = options.maxAttempts ?? (method === "sendMessage" ? 1 : telegramRequestMaxAttempts);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });

        if (response.ok) {
          const result = (await response.json()) as TelegramResponse;
          if (result.ok === true) {
            return result;
          }

          const error = new TelegramRequestError(
            `Telegram ${method} rejected the request: ${result.description ?? "unknown error"}`,
            result.error_code,
            typeof result.parameters?.retry_after === "number"
              ? result.parameters.retry_after
              : null,
          );
          if (
            !this.shouldRetryTelegramRequest(error, result.error_code) ||
            attempt === maxAttempts
          ) {
            throw error;
          }
          lastError = error;
        } else {
          const body = await response.text();
          const headerRetryAfter = Number(response.headers.get("retry-after"));
          const error = new TelegramRequestError(
            `Telegram ${method} failed with ${response.status}: ${body}`,
            response.status,
            Number.isFinite(headerRetryAfter) && headerRetryAfter > 0
              ? headerRetryAfter
              : null,
          );

          if (
            !this.shouldRetryTelegramRequest(error, response.status) ||
            attempt === maxAttempts
          ) {
            throw error;
          }

          lastError = error;
        }
      } catch (error) {
        if (
          !this.shouldRetryTelegramRequest(error) ||
          attempt === maxAttempts
        ) {
          throw error;
        }

        lastError = error;
      }

      await this.sleep(telegramRequestRetryDelayMs * attempt);
    }

    throw lastError instanceof Error ? lastError : new Error(`Telegram ${method} failed`);
  }

  private shouldRetryTelegramRequest(error: unknown, status?: number): boolean {
    if (status && (status === 429 || status >= 500)) {
      return true;
    }

    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return message.includes("fetch failed") || message.includes("econnreset") || message.includes("etimedout");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private assertWebhookSecret(secret: string): void {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException("Invalid Telegram webhook secret");
    }
  }

  private async assertStaffCallback(
    callback: TelegramCallbackQuery,
    orderId: string,
  ): Promise<void> {
    const expectedChatId = this.staffChatId();
    const actualChatId = callback.message?.chat?.id;

    if (!expectedChatId || !actualChatId || String(actualChatId) !== expectedChatId) {
      throw new ForbiddenException("Unauthorized staff Telegram chat");
    }

    const telegramUserId = callback.from?.id;
    if (telegramUserId === undefined || telegramUserId === null) {
      throw new ForbiddenException("Telegram callback does not identify a staff member");
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { branchId: true },
    });
    if (!order) {
      throw new BadRequestException("Buyurtma topilmadi");
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        telegramUserId: String(telegramUserId),
        branchId: order.branchId,
        status: EmployeeStatus.ACTIVE,
        user: {
          is: {
            isActive: true,
            roles: {
              some: {
                role: { code: { in: staffTelegramRoleCodes } },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    if (!employee) {
      throw new ForbiddenException(
        "Telegram foydalanuvchisi bu filialdagi faol oshxona xodimiga biriktirilmagan",
      );
    }
  }

  private toTelegramUpdate(update: unknown): TelegramUpdate {
    return update && typeof update === "object" ? (update as TelegramUpdate) : {};
  }

  private isConfigured(): boolean {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_STAFF_CHAT_ID);
  }

  private staffChatId(): string {
    return process.env.TELEGRAM_STAFF_CHAT_ID ?? "";
  }

  private async rememberStaffMessage(orderId: string, response: TelegramResponse | undefined): Promise<void> {
    const messageId = response?.result?.message_id;
    const chatId = response?.result?.chat?.id;

    if (!messageId || chatId === undefined || chatId === null) {
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        staffTelegramChatId: String(chatId),
        staffTelegramMessageId: messageId,
      },
    });
  }

  private publicOrderNumber(order: Pick<StaffOrderForMessage, "displayOrderNumber" | "orderNumber">): string {
    return order.displayOrderNumber ?? order.orderNumber;
  }

  private safeCallbackError(error: unknown): string {
    if (error instanceof ForbiddenException) {
      return "Bu amal uchun ruxsat yo'q.";
    }

    if (error instanceof BadRequestException) {
      const response = error.getResponse();

      if (typeof response === "string") {
        return response;
      }

      if (response && typeof response === "object" && "message" in response) {
        const message = (response as { message?: string | string[] }).message;
        return Array.isArray(message) ? message[0] ?? "Amal bajarilmadi." : message ?? "Amal bajarilmadi.";
      }
    }

    return "Amal bajarilmadi. Qayta urinib ko'ring.";
  }

  private isMessageNotModifiedError(error: unknown): boolean {
    return error instanceof Error && error.message.toLowerCase().includes("message is not modified");
  }

  private isMessageEditImpossibleError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes("message can't be edited") ||
      message.includes("message to edit not found") ||
      message.includes("message identifier is not specified")
    );
  }

  private orderStatusLabel(status: OrderStatus, type?: string): string {
    return sharedOrderStatusLabel(status, type);
  }

  private kitchenStatusLabel(status: KitchenTicketStatus): string {
    const labels: Record<KitchenTicketStatus, string> = {
      NEW: "Yangi chipta",
      ACCEPTED: "Oshxona qabul qildi",
      COOKING: "Oshxonada",
      READY: "Tayyor",
      COMPLETED: "Yopilgan",
      CANCELLED: "Bekor qilingan",
    };

    return labels[status];
  }

  private orderTypeLabel(type: string): string {
    if (type === "DINE_IN") {
      return "Zal";
    }
    if (type === "DELIVERY") {
      return "Yetkazib berish";
    }

    if (type === "TAKEAWAY" || type === "PICKUP") {
      return "Olib ketish";
    }

    return "Noma'lum";
  }

  private paymentMethodLabel(paymentMethod: string | null): string {
    if (!paymentMethod) {
      return "Kiritilmagan";
    }

    const labels: Record<string, string> = {
      CASH: "Naqd",
      CLICK: "Click",
      PAYME: "Payme",
      CARD: "Karta",
    };

    return labels[paymentMethod] ?? this.escapeHtml(paymentMethod);
  }

  private formatMoney(value: Prisma.Decimal): string {
    return `${Number(value).toLocaleString("uz-UZ")} so'm`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}
