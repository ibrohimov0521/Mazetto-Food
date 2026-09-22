import { Injectable, Logger } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { orderStatusLabel } from "../../common/utils/order-status-label";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { CustomerCourierService } from "../customers/customer-courier.service";
import { CourierOrderStatus } from "../customers/dto/list-customers.dto";
import { TelegramCustomerScreenService } from "./telegram-customer-screen.service";

type TelegramMessage = {
  chat?: { id?: number | string };
  from?: { id?: number | string };
  text?: string;
};

type TelegramCallbackQuery = {
  id?: string;
  data?: string;
  message?: { chat?: { id?: number | string }; message_id?: number };
  from?: { id?: number | string };
};

type TelegramUpdate = {
  callback_query?: TelegramCallbackQuery;
  message?: TelegramMessage;
};

type StaffIdentity = {
  user: AuthenticatedUser;
  displayName: string;
};

const staffCallbackPrefix = "staff";

@Injectable()
export class TelegramStaffService {
  private readonly logger = new Logger(TelegramStaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly courierService: CustomerCourierService,
    private readonly screen: TelegramCustomerScreenService,
  ) {}

  async handleWebhookUpdate(update: unknown) {
    const telegramUpdate = this.toTelegramUpdate(update);
    const callback = telegramUpdate.callback_query;
    const message = telegramUpdate.message;

    try {
      if (callback?.data?.startsWith(`${staffCallbackPrefix}:`)) {
        await this.handleStaffCallback(callback);
        return { ok: true, handled: true };
      }

      if (!message?.text) {
        return { ok: true, handled: false };
      }

      const text = message.text.trim();
      const isStaffCommand = /^\/(?:start|staff|courier|admin)(?:@[A-Za-z0-9_]+)?$/.test(
        text,
      );
      const isStaffKeyboard =
        text === "👔 Xodim paneli" || text === "🚚 Kuryer buyurtmalari";

      if (!isStaffCommand && !isStaffKeyboard) {
        return { ok: true, handled: false };
      }

      const staff = await this.findStaffByTelegramId(message.from?.id);
      if (!staff) {
        if (/^\/(?:staff|courier|admin)/.test(text)) {
          await this.screen.telegramRequest("sendMessage", {
            chat_id: message.chat?.id,
            text: "Bu Telegram account xodimga biriktirilmagan. Avval admin panelda xodim profiliga Telegram foydalanuvchi ID ni kiriting.",
          });
          return { ok: true, handled: true };
        }
        return { ok: true, handled: false };
      }

      if (text === "🚚 Kuryer buyurtmalari" || /^\/courier/.test(text)) {
        await this.sendCourierOrdersFromMessage(message, staff);
      } else {
        await this.sendStaffPanelFromMessage(message, staff);
      }

      return { ok: true, handled: true };
    } catch (error) {
      this.logger.error(
        "Telegram staff handling failed",
        error instanceof Error ? error.stack : String(error),
      );
      const chatId = message?.chat?.id ?? callback?.message?.chat?.id;
      if (chatId) {
        await this.screen.telegramRequest("sendMessage", {
          chat_id: chatId,
          text: "Xodim panelida xatolik bo'ldi. Iltimos, qayta urinib ko'ring.",
        });
      }
      return { ok: true, handled: true };
    }
  }

  private async handleStaffCallback(
    callback: TelegramCallbackQuery,
  ): Promise<void> {
    const staff = await this.findStaffByTelegramId(callback.from?.id);
    const rawChatId = callback.message?.chat?.id;

    if (!staff || rawChatId === undefined || rawChatId === null) {
      await this.screen.answerCallback(
        callback,
        "Bu Telegram account xodimga biriktirilmagan.",
        true,
      );
      return;
    }

    const chatId = String(rawChatId);
    const [, action, ...values] = (callback.data ?? "").split(":");

    if (action === "home") {
      await this.screen.answerCallback(callback);
      await this.sendStaffPanel(chatId, staff, callback.message?.message_id);
      return;
    }

    if (action === "courier") {
      await this.screen.answerCallback(callback);
      await this.sendCourierOrders(chatId, staff, callback.message?.message_id);
      return;
    }

    if (action === "courier_order" && values[0]) {
      await this.screen.answerCallback(callback);
      await this.sendCourierOrderDetail(
        chatId,
        staff,
        values[0],
        callback.message?.message_id,
      );
      return;
    }

    if (action === "courier_status" && values[0] && values[1]) {
      await this.screen.answerCallback(callback, "Amal bajarilmoqda...");
      await this.changeCourierStatus(
        chatId,
        staff,
        values[0],
        values[1] as CourierOrderStatus,
        callback.message?.message_id,
      );
      return;
    }

    await this.screen.answerCallback(callback, "Tugma eskirgan.", true);
    await this.sendStaffPanel(chatId, staff, callback.message?.message_id);
  }

  private async sendStaffPanelFromMessage(
    message: TelegramMessage,
    staff: StaffIdentity,
  ): Promise<void> {
    const chatId = this.requiredId(message.chat?.id);
    await this.sendStaffPanel(chatId, staff);
  }

  private async sendStaffPanel(
    chatId: string,
    staff: StaffIdentity,
    messageId?: number,
  ): Promise<void> {
    const rows = [];
    if (staff.user.roles.includes("COURIER")) {
      rows.push([
        {
          text: "🚚 Kuryer buyurtmalari",
          callback_data: `${staffCallbackPrefix}:courier`,
        },
      ]);
    }

    rows.push([
      {
        text: "🔄 Yangilash",
        callback_data: `${staffCallbackPrefix}:home`,
      },
    ]);

    await this.screen.renderCustomerScreen(
      this.screenTarget(chatId, messageId),
      {
        text: [
          `<b>👔 Xodim paneli</b>`,
          "",
          `<b>Xodim:</b> ${this.escapeHtml(staff.displayName)}`,
          `<b>Rollar:</b> ${staff.user.roles.join(", ") || "—"}`,
          "",
          staff.user.roles.includes("COURIER")
            ? "Kuryer buyurtmalaringizni ko'rish uchun pastdagi tugmani bosing."
            : "Bu rol uchun Telegram amallari keyingi bosqichda qo'shiladi.",
        ].join("\n"),
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: rows,
          keyboard: [["👔 Xodim paneli"], ["🚚 Kuryer buyurtmalari"]],
          resize_keyboard: true,
        },
      },
    );
  }

  private async sendCourierOrdersFromMessage(
    message: TelegramMessage,
    staff: StaffIdentity,
  ): Promise<void> {
    const chatId = this.requiredId(message.chat?.id);
    await this.sendCourierOrders(chatId, staff);
  }

  private async sendCourierOrders(
    chatId: string,
    staff: StaffIdentity,
    messageId?: number,
  ): Promise<void> {
    if (!staff.user.roles.includes("COURIER")) {
      await this.screen.renderCustomerScreen(
        this.screenTarget(chatId, messageId),
        {
          text: "Sizda kuryer buyurtmalarini ko'rish ruxsati yo'q.",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:home` }],
            ],
          },
        },
      );
      return;
    }

    const orders = await this.courierService.listCourierDeliveryOrders(
      { limit: 10, offset: 0 },
      staff.user,
    );

    if (!orders.length) {
      await this.screen.renderCustomerScreen(
        this.screenTarget(chatId, messageId),
        {
          text: "🚚 Hozir sizga tegishli faol yetkazish buyurtmasi yo'q.",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:courier` }],
              [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:home` }],
            ],
          },
        },
      );
      return;
    }

    await this.screen.renderCustomerScreen(
      this.screenTarget(chatId, messageId),
      {
        text: `<b>🚚 Kuryer buyurtmalari</b>\n\n${orders
          .map((order) => this.courierOrderLine(order))
          .join("\n\n")}`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            ...orders.map((order) => [
              {
                text: `#${order.order?.displayOrderNumber ?? order.order?.orderNumber ?? order.id}`,
                callback_data: `${staffCallbackPrefix}:courier_order:${order.id}`,
              },
            ]),
            [{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:courier` }],
            [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:home` }],
          ],
        },
      },
    );
  }

  private async sendCourierOrderDetail(
    chatId: string,
    staff: StaffIdentity,
    customerOrderId: string,
    messageId?: number,
  ): Promise<void> {
    const order = await this.findCourierOrder(staff, customerOrderId);
    if (!order) {
      await this.screen.renderCustomerScreen(
        this.screenTarget(chatId, messageId),
        {
          text: "Buyurtma topilmadi yoki endi sizga tegishli emas.",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🚚 Ro'yxat", callback_data: `${staffCallbackPrefix}:courier` }],
            ],
          },
        },
      );
      return;
    }

    await this.screen.renderCustomerScreen(
      this.screenTarget(chatId, messageId),
      {
        text: this.courierOrderDetailText(order),
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            ...this.courierActionRows(order),
            [{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:courier_order:${order.id}` }],
            [{ text: "⬅️ Ro'yxat", callback_data: `${staffCallbackPrefix}:courier` }],
          ],
        },
      },
    );
  }

  private async changeCourierStatus(
    chatId: string,
    staff: StaffIdentity,
    customerOrderId: string,
    status: CourierOrderStatus,
    messageId?: number,
  ): Promise<void> {
    const order = await this.findCourierOrder(staff, customerOrderId);
    const outstandingAmount = Number(order?.order?.outstandingAmount ?? 0);

    await this.courierService.updateCourierOrderStatus(
      customerOrderId,
      {
        status,
        idempotencyKey: `telegram-staff:${customerOrderId}:${status}`,
        ...(status === CourierOrderStatus.COMPLETED && outstandingAmount > 0
          ? { amount: outstandingAmount, paymentMethodCode: "CASH" }
          : {}),
      },
      staff.user,
    );

    await this.sendCourierOrderDetail(chatId, staff, customerOrderId, messageId);
  }

  private async findCourierOrder(
    staff: StaffIdentity,
    customerOrderId: string,
  ) {
    const orders = await this.courierService.listCourierDeliveryOrders(
      { limit: 100, offset: 0 },
      staff.user,
    );
    return orders.find((order) => order.id === customerOrderId) ?? null;
  }

  private courierActionRows(order: any) {
    const status = order.order?.status as OrderStatus | undefined;
    if (status === OrderStatus.READY) {
      return [
        [
          {
            text: "🚚 Yo'lga chiqdim",
            callback_data: `${staffCallbackPrefix}:courier_status:${order.id}:${CourierOrderStatus.SERVED}`,
          },
        ],
      ];
    }
    if (status === OrderStatus.SERVED) {
      return [
        [
          {
            text: "✅ Yetkazdim",
            callback_data: `${staffCallbackPrefix}:courier_status:${order.id}:${CourierOrderStatus.COMPLETED}`,
          },
        ],
      ];
    }
    return [];
  }

  private courierOrderLine(order: any): string {
    const status = order.order?.status as OrderStatus | undefined;
    const number = order.order?.displayOrderNumber ?? order.order?.orderNumber ?? order.id;
    const total = this.formatMoney(order.order?.total);
    const address = order.deliveryAddress ?? "Manzil ko'rsatilmagan";
    return [
      `<b>#${this.escapeHtml(number)}</b> · ${this.escapeHtml(
        status ? orderStatusLabel(status, "DELIVERY") : "Noma'lum",
      )}`,
      `${this.escapeHtml(order.customer?.name ?? "Mijoz")} · ${this.escapeHtml(order.customer?.phone ?? "—")}`,
      `${this.escapeHtml(address)}`,
      `<b>Jami:</b> ${this.escapeHtml(total)}`,
    ].join("\n");
  }

  private courierOrderDetailText(order: any): string {
    const status = order.order?.status as OrderStatus | undefined;
    const items = (order.order?.items ?? [])
      .map(
        (item: any) =>
          `• ${this.escapeHtml(item.productName)} × ${Number(item.quantity)} — ${this.escapeHtml(this.formatMoney(item.totalPrice))}`,
      )
      .join("\n");
    const outstanding = Number(order.order?.outstandingAmount ?? 0);
    const location = order.deliveryLocation
      ? `https://maps.google.com/?q=${order.deliveryLocation.latitude},${order.deliveryLocation.longitude}`
      : null;

    return [
      `<b>🚚 Buyurtma #${this.escapeHtml(order.order?.displayOrderNumber ?? order.order?.orderNumber ?? order.id)}</b>`,
      `<b>Holat:</b> ${this.escapeHtml(status ? orderStatusLabel(status, "DELIVERY") : "Noma'lum")}`,
      `<b>Mijoz:</b> ${this.escapeHtml(order.customer?.name ?? "—")}`,
      `<b>Telefon:</b> ${this.escapeHtml(order.customer?.phone ?? "—")}`,
      `<b>Manzil:</b> ${this.escapeHtml(order.deliveryAddress ?? "—")}`,
      ...(location ? [`<b>Lokatsiya:</b> ${location}`] : []),
      "",
      `<b>Tarkib:</b>`,
      items || "—",
      "",
      `<b>To'lov:</b> ${this.escapeHtml(order.paymentMethod ?? "—")}`,
      `<b>Jami:</b> ${this.escapeHtml(this.formatMoney(order.order?.total))}`,
      `<b>Qoldiq:</b> ${this.escapeHtml(this.formatMoney(outstanding))}`,
    ].join("\n");
  }

  private async findStaffByTelegramId(
    telegramUserId: number | string | undefined,
  ): Promise<StaffIdentity | null> {
    if (telegramUserId === undefined || telegramUserId === null) {
      return null;
    }

    const employee = await this.prisma.employee.findUnique({
      where: { telegramUserId: String(telegramUserId) },
      include: {
        user: {
          include: {
            roles: {
              where: { role: { isActive: true } },
              include: {
                role: {
                  include: {
                    permissions: {
                      include: { permission: { select: { code: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!employee || employee.status !== "ACTIVE" || !employee.user?.isActive) {
      return null;
    }

    const roles = employee.user.roles.map((item) => item.role.code);
    const permissions = employee.user.roles.flatMap((item) =>
      item.role.permissions.map((permission) => permission.permission.code),
    );

    const user: AuthenticatedUser = {
      id: employee.user.id,
      employeeId: employee.id,
      branchId: employee.branchId,
      isGlobalScope: employee.user.roles.some(
        (item) => !item.role.isBranchScoped,
      ),
      roles,
      permissions,
    };
    if (employee.user.email) {
      user.email = employee.user.email;
    }
    if (employee.user.phone) {
      user.phone = employee.user.phone;
    }

    return {
      user,
      displayName: [employee.firstName, employee.lastName]
        .filter(Boolean)
        .join(" "),
    };
  }

  private toTelegramUpdate(update: unknown): TelegramUpdate {
    return update && typeof update === "object" ? (update as TelegramUpdate) : {};
  }

  private screenTarget(chatId: string, messageId?: number) {
    return messageId === undefined ? { chatId } : { chatId, messageId };
  }

  private requiredId(value: number | string | undefined): string {
    if (value === undefined || value === null) {
      throw new Error("Telegram chat id is required");
    }
    return String(value);
  }

  private formatMoney(value: unknown): string {
    const number = Number(value ?? 0);
    return Number.isFinite(number)
      ? `${new Intl.NumberFormat("uz-UZ").format(Math.round(number))} so'm`
      : "—";
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
