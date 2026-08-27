import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { KitchenTicketStatus, OrderStatus, Prisma } from "@prisma/client";
import { KitchenService } from "../kitchen/kitchen.service";
import { PrismaService } from "../../prisma/prisma.service";

type TelegramCallbackStatus = "CONFIRMED" | "PREPARING" | "READY" | "CANCELLED";
type TelegramInlineKeyboard = {
  inline_keyboard: { text: string; callback_data: string }[][];
};
type TelegramCallbackQuery = {
  id: string;
  data?: string;
  message?: {
    chat?: { id: number | string };
    message_id?: number;
  };
};
type TelegramUpdate = {
  callback_query?: TelegramCallbackQuery;
};

const callbackPrefix = "mazetto_order";
const statusLabels: Record<TelegramCallbackStatus, string> = {
  CONFIRMED: "Qabul qilindi",
  PREPARING: "Tayyorlanmoqda",
  READY: "Tayyor",
  CANCELLED: "Bekor qilindi",
};

@Injectable()
export class TelegramOrderNotificationService {
  private readonly logger = new Logger(TelegramOrderNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenService: KitchenService,
  ) {}

  async notifyNewOrder(orderId: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn("Telegram order notifications are disabled: TELEGRAM_BOT_TOKEN or TELEGRAM_STAFF_CHAT_ID is missing");
      return;
    }

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { orderBy: { createdAt: "asc" } },
          customerOrder: true,
        },
      });

      if (!order) {
        this.logger.warn(`Telegram notification skipped: order ${orderId} was not found`);
        return;
      }

      await this.telegramRequest("sendMessage", {
        chat_id: this.staffChatId(),
        text: this.formatNewOrderMessage(order),
        parse_mode: "HTML",
        reply_markup: this.orderKeyboard(order.id),
      });
    } catch (error) {
      this.logger.error(
        `Telegram order notification failed for order ${orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async handleWebhook(secret: string, update: unknown) {
    this.assertWebhookSecret(secret);
    const callback = this.toTelegramUpdate(update).callback_query;

    if (!callback?.data?.startsWith(`${callbackPrefix}:`)) {
      return { ok: true, handled: false };
    }

    try {
      const { orderId, status } = this.parseCallbackData(callback.data);
      const order = await this.updateOrderStatus(orderId, status);

      await this.answerCallback(callback.id, `${order.orderNumber}: ${statusLabels[status]}`);
      await this.sendStatusMessage(callback, order.orderNumber, status);

      return { ok: true, handled: true };
    } catch (error) {
      this.logger.error(
        "Telegram callback handling failed",
        error instanceof Error ? error.stack : String(error),
      );

      if (callback.id) {
        await this.answerCallback(callback.id, "Amal bajarilmadi. Qayta urinib ko'ring.");
      }

      return { ok: true, handled: false };
    }
  }

  private async updateOrderStatus(orderId: string, nextStatus: TelegramCallbackStatus) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { kitchenTickets: { orderBy: { createdAt: "desc" }, take: 1 } },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (
        (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) &&
        order.status !== nextStatus
      ) {
        throw new Error(`Order ${order.orderNumber} is already ${order.status}`);
      }

      const data: Prisma.OrderUpdateInput = {};

      if (order.status !== nextStatus) {
        data.status = nextStatus;
      }

      if (nextStatus === OrderStatus.CONFIRMED && !order.acceptedAt) {
        data.acceptedAt = new Date();
      }

      if (nextStatus === OrderStatus.CANCELLED) {
        data.cancelledAt = order.cancelledAt ?? new Date();
        data.cancellationReason = order.cancellationReason ?? "Telegram orqali bekor qilindi";
      }

      if (Object.keys(data).length > 0) {
        await tx.order.update({ where: { id: orderId }, data });
      }

      if (order.status !== nextStatus) {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: nextStatus,
            reason: `Telegram: ${statusLabels[nextStatus]}`,
          },
        });
      }

      await this.updateKitchenTicket(tx, order.id, nextStatus);

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: { orderBy: { createdAt: "asc" } }, kitchenTickets: true },
      });
    });

    this.kitchenService.emitOrderStatusChanged(result);
    return result;
  }

  private async updateKitchenTicket(
    tx: Prisma.TransactionClient,
    orderId: string,
    nextStatus: TelegramCallbackStatus,
  ): Promise<void> {
    const ticket = await tx.kitchenTicket.findFirst({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });

    if (!ticket) {
      return;
    }

    const ticketStatus = this.toKitchenTicketStatus(nextStatus);

    if (ticket.status === ticketStatus) {
      return;
    }

    await tx.kitchenTicket.update({
      where: { id: ticket.id },
      data: {
        status: ticketStatus,
        ...(ticketStatus === KitchenTicketStatus.ACCEPTED || ticketStatus === KitchenTicketStatus.COOKING
          ? { acceptedAt: ticket.acceptedAt ?? new Date() }
          : {}),
        ...(ticketStatus === KitchenTicketStatus.CANCELLED || ticketStatus === KitchenTicketStatus.COMPLETED
          ? { completedAt: ticket.completedAt ?? new Date() }
          : {}),
      },
    });
  }

  private formatNewOrderMessage(order: {
    orderNumber: string;
    customerName: string | null;
    customerPhone: string | null;
    deliveryAddress: string | null;
    type: string;
    items: {
      productName: string;
      variantName: string | null;
      quantity: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
      modifierSnapshot: Prisma.JsonValue;
      notes: string | null;
    }[];
    total: Prisma.Decimal;
    customerOrder: { paymentMethod: string | null } | null;
    notes: string | null;
  }): string {
    const lines = [
      "🔥 <b>Yangi buyurtma</b>",
      "",
      `<b>Raqam:</b> ${this.escapeHtml(order.orderNumber)}`,
      `<b>Mijoz:</b> ${this.escapeHtml(order.customerName ?? "Noma'lum")}`,
      `<b>Telefon:</b> ${this.escapeHtml(order.customerPhone ?? "Kiritilmagan")}`,
      `<b>Manzil:</b> ${this.escapeHtml(order.deliveryAddress ?? "Olib ketish")}`,
      `<b>Turi:</b> ${this.orderTypeLabel(order.type)}`,
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
    modifierSnapshot: Prisma.JsonValue;
    notes: string | null;
  }): string[] {
    const quantity = Number(item.quantity).toLocaleString("uz-UZ");
    const title = `• ${quantity}x ${this.escapeHtml(item.productName)}${item.variantName ? ` ${this.escapeHtml(item.variantName)}` : ""} — ${this.formatMoney(item.totalPrice)}`;
    const modifiers = this.modifierNames(item.modifierSnapshot).map((modifier) => `  - ${this.escapeHtml(modifier)}`);
    const notes = item.notes ? [`  - Izoh: ${this.escapeHtml(item.notes)}`] : [];
    return [title, ...modifiers, ...notes];
  }

  private modifierNames(snapshot: Prisma.JsonValue): string[] {
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

  private orderKeyboard(orderId: string): TelegramInlineKeyboard {
    return {
      inline_keyboard: [
        [
          { text: "Qabul qilish", callback_data: this.callbackData(orderId, "CONFIRMED") },
          { text: "Tayyorlanmoqda", callback_data: this.callbackData(orderId, "PREPARING") },
        ],
        [
          { text: "Tayyor", callback_data: this.callbackData(orderId, "READY") },
          { text: "Bekor qilish", callback_data: this.callbackData(orderId, "CANCELLED") },
        ],
      ],
    };
  }

  private callbackData(orderId: string, status: TelegramCallbackStatus): string {
    return `${callbackPrefix}:${status}:${orderId}`;
  }

  private parseCallbackData(data: string): { orderId: string; status: TelegramCallbackStatus } {
    const [, status, orderId] = data.split(":");

    if (!this.isTelegramCallbackStatus(status) || !orderId) {
      throw new Error("Invalid Telegram callback payload");
    }

    return { orderId, status };
  }

  private isTelegramCallbackStatus(value: string | undefined): value is TelegramCallbackStatus {
    return value === "CONFIRMED" || value === "PREPARING" || value === "READY" || value === "CANCELLED";
  }

  private toKitchenTicketStatus(status: TelegramCallbackStatus): KitchenTicketStatus {
    const statusMap: Record<TelegramCallbackStatus, KitchenTicketStatus> = {
      CONFIRMED: KitchenTicketStatus.ACCEPTED,
      PREPARING: KitchenTicketStatus.COOKING,
      READY: KitchenTicketStatus.READY,
      CANCELLED: KitchenTicketStatus.CANCELLED,
    };

    return statusMap[status];
  }

  private async answerCallback(callbackQueryId: string, text: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    await this.telegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    });
  }

  private async sendStatusMessage(
    callback: TelegramCallbackQuery,
    orderNumber: string,
    status: TelegramCallbackStatus,
  ): Promise<void> {
    const chatId = callback.message?.chat?.id ?? this.staffChatId();

    await this.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: `✅ ${this.escapeHtml(orderNumber)}: ${this.escapeHtml(statusLabels[status])}`,
      parse_mode: "HTML",
    });
  }

  private async telegramRequest(method: string, payload: unknown): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram ${method} failed with ${response.status}: ${body}`);
    }
  }

  private assertWebhookSecret(secret: string): void {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException("Invalid Telegram webhook secret");
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

  private orderTypeLabel(type: string): string {
    if (type === "DELIVERY") {
      return "Yetkazib berish";
    }

    if (type === "TAKEAWAY") {
      return "Olib ketish";
    }

    return this.escapeHtml(type);
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
