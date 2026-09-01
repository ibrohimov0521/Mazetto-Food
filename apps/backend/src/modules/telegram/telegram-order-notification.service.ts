import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { CustomerOrderType, KitchenTicketStatus, OrderStatus, Prisma } from "@prisma/client";
import { KitchenService, type KitchenStaffAction } from "../kitchen/kitchen.service";
import { PrismaService } from "../../prisma/prisma.service";

type StaffOrderAction = Exclude<KitchenStaffAction, "complete">;
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
  orderNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
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
  customerTelegramChatId: string | null;
  order: StaffOrderForMessage;
  requestedAction: StaffOrderAction;
};

const callbackPrefix = "mazetto_order";
const telegramRequestMaxAttempts = 3;
const telegramRequestRetryDelayMs = 250;
const actionLabels: Record<StaffOrderAction, string> = {
  accept: "Qabul qilindi",
  start_preparing: "Tayyorlanmoqda",
  mark_ready: "Tayyor",
  cancel: "Bekor qilindi",
};
const legacyStatusToAction: Record<LegacyCallbackStatus, StaffOrderAction> = {
  CONFIRMED: "accept",
  PREPARING: "start_preparing",
  READY: "mark_ready",
  CANCELLED: "cancel",
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
      const order = await this.findOrderForMessage(orderId);

      if (!order) {
        this.logger.warn(`Telegram notification skipped: order ${orderId} was not found`);
        return;
      }

      await this.telegramRequest("sendMessage", {
        chat_id: this.staffChatId(),
        text: this.formatStaffOrderMessage(order),
        parse_mode: "HTML",
        reply_markup: this.orderKeyboard(order),
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
      this.assertStaffCallback(callback);
      const { orderId, action } = this.parseCallbackData(callback.data);
      const result = await this.applyStaffAction(orderId, action);
      const callbackText = result.changed
        ? `${result.order.orderNumber}: ${actionLabels[action]}`
        : `${result.order.orderNumber}: bu amal allaqachon bajarilgan`;

      await this.answerCallbackSafely(callback.id, callbackText, result.order, action);
      await this.renderStaffOrderMessageSafely(callback, result.order, action);
      await this.notifyCustomerStatus(result);

      return { ok: true, handled: true };
    } catch (error) {
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
      customerTelegramChatId: order.customerOrder?.customer?.telegramChatId ?? null,
      order,
      requestedAction: action,
    };
  }

  private async findOrderForMessage(
    orderId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<StaffOrderForMessage | null> {
    return client.order.findUnique({
      where: { id: orderId },
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
  }

  private formatStaffOrderMessage(order: StaffOrderForMessage): string {
    const ticket = order.kitchenTickets[0] ?? null;
    const lines = [
      "🔥 <b>Yangi buyurtma</b>",
      "",
      `<b>Raqam:</b> ${this.escapeHtml(order.orderNumber)}`,
      `<b>Status:</b> ${this.orderStatusLabel(order.status)}${ticket ? ` / ${this.kitchenStatusLabel(ticket.status)}` : ""}`,
      `<b>Mijoz:</b> ${this.escapeHtml(order.customerName ?? "Noma'lum")}`,
      `<b>Telefon:</b> ${this.escapeHtml(order.customerPhone ?? "Kiritilmagan")}`,
      `<b>Manzil:</b> ${this.escapeHtml(order.deliveryAddress ?? "Olib ketish")}`,
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

  private orderKeyboard(order: Pick<StaffOrderForMessage, "id" | "status" | "kitchenTickets">): TelegramInlineKeyboard {
    const ticketStatus = order.kitchenTickets[0]?.status ?? null;
    const buttons: TelegramInlineButton[][] = [];

    if (
      order.status === OrderStatus.NEW ||
      (order.status === OrderStatus.CONFIRMED && ticketStatus === KitchenTicketStatus.NEW)
    ) {
      buttons.push([
        { text: "Qabul qilish", callback_data: this.callbackData(order.id, "accept") },
        { text: "Bekor qilish", callback_data: this.callbackData(order.id, "cancel") },
      ]);
    } else if (order.status === OrderStatus.CONFIRMED && ticketStatus === KitchenTicketStatus.ACCEPTED) {
      buttons.push([
        { text: "Tayyorlanmoqda", callback_data: this.callbackData(order.id, "start_preparing") },
        { text: "Bekor qilish", callback_data: this.callbackData(order.id, "cancel") },
      ]);
    } else if (order.status === OrderStatus.PREPARING && ticketStatus === KitchenTicketStatus.COOKING) {
      buttons.push([
        { text: "Tayyor", callback_data: this.callbackData(order.id, "mark_ready") },
        { text: "Bekor qilish", callback_data: this.callbackData(order.id, "cancel") },
      ]);
    }

    return { inline_keyboard: buttons };
  }

  private callbackData(orderId: string, action: StaffOrderAction): string {
    return `${callbackPrefix}:${action}:${orderId}`;
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
    return value === "accept" || value === "start_preparing" || value === "mark_ready" || value === "cancel";
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
      reply_markup: this.orderKeyboard(order),
    };

    if (messageId) {
      try {
        await this.telegramRequest("editMessageText", {
          ...payload,
          message_id: messageId,
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

    await this.telegramRequest("sendMessage", payload);
  }

  private async renderStaffOrderMessageSafely(
    callback: TelegramCallbackQuery,
    order: StaffOrderForMessage,
    action: StaffOrderAction,
  ): Promise<void> {
    try {
      await this.renderStaffOrderMessage(callback, order);
    } catch (error) {
      this.logger.warn(
        `Telegram staff message render failed for order ${order.id} (${order.orderNumber}) action ${action}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async notifyCustomerStatus(result: StaffTransitionResult): Promise<void> {
    if (!result.changed || !result.customerTelegramChatId || !process.env.TELEGRAM_BOT_TOKEN) {
      return;
    }

    const message = this.customerStatusMessage(result.order.orderNumber, result.order.status);

    if (!message) {
      return;
    }

    try {
      await this.telegramRequest("sendMessage", {
        chat_id: result.customerTelegramChatId,
        text: message,
        parse_mode: "HTML",
      });
    } catch (error) {
      this.logger.warn(
        `Customer Telegram status notification failed for order ${result.order.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
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

  private async telegramRequest(method: string, payload: unknown): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return;
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= telegramRequestMaxAttempts; attempt += 1) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          return;
        }

        const body = await response.text();
        const error = new Error(`Telegram ${method} failed with ${response.status}: ${body}`);

        if (!this.shouldRetryTelegramRequest(error, response.status) || attempt === telegramRequestMaxAttempts) {
          throw error;
        }

        lastError = error;
      } catch (error) {
        if (!this.shouldRetryTelegramRequest(error) || attempt === telegramRequestMaxAttempts) {
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

  private assertStaffCallback(callback: TelegramCallbackQuery): void {
    const expectedChatId = this.staffChatId();
    const actualChatId = callback.message?.chat?.id;

    if (!expectedChatId || !actualChatId || String(actualChatId) !== expectedChatId) {
      throw new ForbiddenException("Unauthorized staff Telegram chat");
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

  private orderStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      NEW: "Yangi",
      CONFIRMED: "Qabul qilingan",
      PREPARING: "Tayyorlanmoqda",
      READY: "Tayyor",
      SERVED: "Yetkazildi",
      COMPLETED: "Yakunlangan",
      CANCELLED: "Bekor qilingan",
    };

    return labels[status];
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
    if (type === "DELIVERY") {
      return "Yetkazib berish";
    }

    if (type === "TAKEAWAY" || type === "PICKUP") {
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
