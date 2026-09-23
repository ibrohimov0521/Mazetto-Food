import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { KitchenTicketStatus, OrderStatus } from "@prisma/client";
import { orderStatusLabel } from "../../common/utils/order-status-label";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { CustomerCourierService } from "../customers/customer-courier.service";
import { CourierOrderStatus } from "../customers/dto/list-customers.dto";
import { KitchenService } from "../kitchen/kitchen.service";
import { TablesService } from "../tables/tables.service";
import { CashRegisterService } from "../cash-register/cash-register.service";
import { TelegramCustomerScreenService, type TelegramReplyButton } from "./telegram-customer-screen.service";

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

type TelegramStaffItem = {
  productName?: unknown;
  quantity?: unknown;
  totalPrice?: unknown;
};

type TelegramStaffOrder = {
  id: string;
  status?: unknown;
  displayOrderNumber?: unknown;
  orderNumber?: unknown;
  total?: unknown;
  outstandingAmount?: unknown;
  items?: TelegramStaffItem[];
  order?: TelegramStaffOrder;
  customer?: { name?: unknown; phone?: unknown };
  deliveryAddress?: unknown;
  deliveryLocation?: unknown;
  paymentMethod?: unknown;
};

type TelegramKitchenTicket = {
  id: string;
  status?: unknown;
  ticketNumber?: unknown;
  order?: Pick<TelegramStaffOrder, "displayOrderNumber" | "orderNumber"> | null;
  items?: TelegramStaffItem[];
};

type TelegramStaffRoleRecord = {
  role: {
    code: string;
    isBranchScoped: boolean;
    permissions: Array<{ permission: { code: string } }>;
  };
};

type TelegramStaffUserRecord = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  isActive: boolean;
  roles: TelegramStaffRoleRecord[];
};

type TelegramStaffEmployeeRecord = {
  id: string;
  branchId: string;
  firstName: string;
  lastName: string | null;
  status: string;
};

const staffCallbackPrefix = "s";
const legacyStaffCallbackPrefix = "staff";

@Injectable()
export class TelegramStaffService implements OnModuleInit {
  private readonly logger = new Logger(TelegramStaffService.name);
  private readonly botToken = process.env.TELEGRAM_STAFF_BOT_TOKEN;

  constructor(
    private readonly prisma: PrismaService,
    private readonly courierService: CustomerCourierService,
    private readonly kitchenService: KitchenService,
    private readonly tablesService: TablesService,
    private readonly cashRegisterService: CashRegisterService,
    private readonly screen: TelegramCustomerScreenService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.botToken) {
      return;
    }

    try {
      await this.screen.telegramRequestWithToken(this.botToken, "setMyCommands", {
        commands: [
          { command: "start", description: "Xodim paneli" },
          { command: "staff", description: "Xodim paneli" },
          { command: "courier", description: "Kuryer buyurtmalari" },
          { command: "kitchen", description: "Oshxona buyurtmalari" },
          { command: "waiter", description: "Ofitsiant buyurtmalari" },
          { command: "cashier", description: "Kassa smenasi" },
          { command: "admin", description: "Boshqaruv paneli" },
          { command: "accountant", description: "Buxgalteriya" },
          { command: "myid", description: "Telegram ID ni ko'rsatish" },
          { command: "help", description: "Yordam" },
        ],
      });
      await this.screen.telegramRequestWithToken(this.botToken, "setChatMenuButton", {
        menu_button: { type: "commands" },
      });
    } catch (error) {
      this.logger.warn(
        `Telegram staff command menu setup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async handleWebhookUpdate(update: unknown) {
    const telegramUpdate = this.toTelegramUpdate(update);
    const callback = telegramUpdate.callback_query;
    const message = telegramUpdate.message;

    try {
      if (callback && this.isStaffCallback(callback.data)) {
        await this.handleStaffCallback(callback);
        return { ok: true, handled: true };
      }

      if (!message?.text) {
        return { ok: true, handled: false };
      }

      const text = message.text.trim();
      const isStaffCommand = /^\/(?:start|staff|courier|kitchen|waiter|cashier|admin|accountant)(?:@[A-Za-z0-9_]+)?$/.test(
        text,
      );
      const isStaffKeyboard =
        [
          "👔 Xodim paneli",
          "🚚 Kuryer buyurtmalari",
          "🍳 Oshxona buyurtmalari",
          "🍽 Ofitsiant buyurtmalari",
          "💵 Kassa",
        ].includes(text);

      if (!isStaffCommand && !isStaffKeyboard) {
        return { ok: true, handled: false };
      }

      const staff = await this.findStaffByTelegramId(message.from?.id);
      if (!staff) {
        if (isStaffCommand || isStaffKeyboard) {
          await this.screen.telegramRequestWithToken(this.botToken, "sendMessage", {
            chat_id: message.chat?.id,
            text: "Bu Telegram account xodimga biriktirilmagan. Avval admin panelda xodim profiliga Telegram foydalanuvchi ID ni kiriting.",
          });
          return { ok: true, handled: true };
        }
        return { ok: true, handled: false };
      }

      if (text === "🚚 Kuryer buyurtmalari" || /^\/courier/.test(text)) {
        await this.sendCourierOrdersFromMessage(message, staff);
      } else if (/^\/kitchen/.test(text) || text === "🍳 Oshxona buyurtmalari") {
        await this.sendKitchenOrders(this.requiredId(message.chat?.id), staff);
      } else if (/^\/waiter/.test(text) || text === "🍽 Ofitsiant buyurtmalari") {
        await this.sendWaiterOrders(this.requiredId(message.chat?.id), staff);
      } else if (/^\/cashier/.test(text) || text === "💵 Kassa") {
        await this.sendCashierPanel(this.requiredId(message.chat?.id), staff);
      } else if (/^\/(?:admin|accountant)/.test(text)) {
        await this.sendManagementPanel(this.requiredId(message.chat?.id), staff);
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
        await this.screen.telegramRequestWithToken(this.botToken, "sendMessage", {
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
      await this.screen.answerCallbackWithToken(
        this.botToken,
        callback,
        "Bu Telegram account xodimga biriktirilmagan.",
        true,
      );
      return;
    }

    const chatId = String(rawChatId);
    const { action, values } = this.parseStaffCallback(callback.data ?? "");

    if (action === "home" || action === "h") {
      await this.screen.answerCallbackWithToken(this.botToken, callback);
      await this.sendStaffPanel(chatId, staff, callback.message?.message_id);
      return;
    }

    if (action === "courier" || action === "co") {
      await this.screen.answerCallbackWithToken(this.botToken, callback);
      await this.sendCourierOrders(chatId, staff, callback.message?.message_id);
      return;
    }

    if ((action === "courier_order" || action === "cod") && values[0]) {
      await this.screen.answerCallbackWithToken(this.botToken, callback);
      await this.sendCourierOrderDetail(
        chatId,
        staff,
        values[0],
        callback.message?.message_id,
      );
      return;
    }

    if (action === "kitchen" || action === "ki") {
      await this.screen.answerCallbackWithToken(this.botToken, callback);
      await this.sendKitchenOrders(chatId, staff, callback.message?.message_id);
      return;
    }

    if (action === "waiter" || action === "wa") {
      await this.screen.answerCallbackWithToken(this.botToken, callback);
      await this.sendWaiterOrders(chatId, staff, callback.message?.message_id);
      return;
    }

    if (action === "cashier" || action === "ca") {
      await this.screen.answerCallbackWithToken(this.botToken, callback);
      await this.sendCashierPanel(chatId, staff, callback.message?.message_id);
      return;
    }

    if (action === "management" || action === "mg") {
      await this.screen.answerCallbackWithToken(this.botToken, callback);
      await this.sendManagementPanel(chatId, staff, callback.message?.message_id);
      return;
    }

    if ((action === "kitchen_ticket" || action === "kt") && values[0] && values[1]) {
      await this.screen.answerCallbackWithToken(this.botToken, callback, "Amal bajarilmoqda...");
      await this.changeKitchenTicket(chatId, staff, values[0], values[1], callback.message?.message_id);
      return;
    }

    if ((action === "courier_status" || action === "cs") && values[0] && values[1]) {
      await this.screen.answerCallbackWithToken(this.botToken, callback, "Amal bajarilmoqda...");
      await this.changeCourierStatus(
        chatId,
        staff,
        values[0],
        values[1] as CourierOrderStatus,
        callback.message?.message_id,
      );
      return;
    }

    await this.screen.answerCallbackWithToken(this.botToken, callback, "Tugma eskirgan.", true);
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
              callback_data: `${staffCallbackPrefix}:co`,
        },
      ]);
    }
    if (this.canUseKitchen(staff)) {
      rows.push([{ text: "🍳 Oshxona buyurtmalari", callback_data: `${staffCallbackPrefix}:ki` }]);
    }
    if (staff.user.roles.includes("WAITER")) {
      rows.push([{ text: "🍽 Ofitsiant buyurtmalari", callback_data: `${staffCallbackPrefix}:wa` }]);
    }
    if (this.canUseCashier(staff)) {
      rows.push([{ text: "💵 Kassa", callback_data: `${staffCallbackPrefix}:ca` }]);
    }
    if (staff.user.roles.some((role) => ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"].includes(role))) {
      rows.push([{ text: "📊 Boshqaruv ko'rsatkichlari", callback_data: `${staffCallbackPrefix}:mg` }]);
    }

    rows.push([
      {
        text: "🔄 Yangilash",
        callback_data: `${staffCallbackPrefix}:h`,
      },
    ]);

    const keyboard: TelegramReplyButton[][] = [["👔 Xodim paneli"]];
    if (staff.user.roles.includes("COURIER")) keyboard.push(["🚚 Kuryer buyurtmalari"]);
    if (this.canUseKitchen(staff)) keyboard.push(["🍳 Oshxona buyurtmalari"]);
    if (staff.user.roles.includes("WAITER")) keyboard.push(["🍽 Ofitsiant buyurtmalari"]);
    if (this.canUseCashier(staff)) keyboard.push(["💵 Kassa"]);

    await this.screen.renderWithToken(this.botToken,
      this.screenTarget(chatId, messageId),
      {
        text: [
          `<b>👔 Xodim paneli</b>`,
          "",
          `<b>Xodim:</b> ${this.escapeHtml(staff.displayName)}`,
          `<b>Rollar:</b> ${staff.user.roles.join(", ") || "—"}`,
          "",
          this.staffPanelHint(staff.user.roles),
        ].join("\n"),
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: rows,
          keyboard,
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
      await this.screen.renderWithToken(this.botToken,
        this.screenTarget(chatId, messageId),
        {
          text: "Sizda kuryer buyurtmalarini ko'rish ruxsati yo'q.",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }],
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
      await this.screen.renderWithToken(this.botToken,
        this.screenTarget(chatId, messageId),
        {
          text: "🚚 Hozir sizga tegishli faol yetkazish buyurtmasi yo'q.",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:co` }],
              [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }],
            ],
          },
        },
      );
      return;
    }

    await this.screen.renderWithToken(this.botToken,
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
                callback_data: `${staffCallbackPrefix}:cod:${order.id}`,
              },
            ]),
            [{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:co` }],
            [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }],
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
      await this.screen.renderWithToken(this.botToken,
        this.screenTarget(chatId, messageId),
        {
          text: "Buyurtma topilmadi yoki endi sizga tegishli emas.",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🚚 Ro'yxat", callback_data: `${staffCallbackPrefix}:co` }],
            ],
          },
        },
      );
      return;
    }

    await this.screen.renderWithToken(this.botToken,
      this.screenTarget(chatId, messageId),
      {
        text: this.courierOrderDetailText(order),
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            ...this.courierActionRows(order),
            [{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:cod:${order.id}` }],
            [{ text: "⬅️ Ro'yxat", callback_data: `${staffCallbackPrefix}:co` }],
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

  private courierActionRows(order: TelegramStaffOrder) {
    const status = order.order?.status as OrderStatus | undefined;
    if (status === OrderStatus.READY) {
      return [
        [
          {
            text: "🚚 Yo'lga chiqdim",
            callback_data: `${staffCallbackPrefix}:cs:${order.id}:${CourierOrderStatus.SERVED}`,
          },
        ],
      ];
    }
    if (status === OrderStatus.SERVED) {
      return [
        [
          {
            text: "✅ Yetkazdim",
            callback_data: `${staffCallbackPrefix}:cs:${order.id}:${CourierOrderStatus.COMPLETED}`,
          },
        ],
      ];
    }
    return [];
  }

  private courierOrderLine(order: TelegramStaffOrder): string {
    const status = order.order?.status as OrderStatus | undefined;
    const number = order.order?.displayOrderNumber ?? order.order?.orderNumber ?? order.id;
    const total = this.formatMoney(order.order?.total);
    const address = order.deliveryAddress ?? "Manzil ko'rsatilmagan";
    return [
      `<b>#${this.escapeHtml(String(number))}</b> · ${this.escapeHtml(
        status ? orderStatusLabel(status, "DELIVERY") : "Noma'lum",
      )}`,
      `${this.escapeHtml(String(order.customer?.name ?? "Mijoz"))} · ${this.escapeHtml(String(order.customer?.phone ?? "—"))}`,
      `${this.escapeHtml(String(address))}`,
      `<b>Jami:</b> ${this.escapeHtml(total)}`,
    ].join("\n");
  }

  private async sendKitchenOrders(chatId: string, staff: StaffIdentity, messageId?: number): Promise<void> {
    if (!this.canUseKitchen(staff)) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), { text: "Sizda oshxona paneliga ruxsat yo'q." });
      return;
    }
    if (!staff.user.employeeId) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
        text: "Oshxona paneli uchun xodim filialga biriktirilgan bo'lishi kerak.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }],
          ],
        },
      });
      return;
    }
    const tickets = await this.kitchenService.listOrders(staff.user);
    const text = tickets.length
      ? `<b>🍳 Oshxona navbati</b>\n\n${tickets.map((ticket: TelegramKitchenTicket) => `<b>#${this.escapeHtml(String(ticket.order?.displayOrderNumber ?? ticket.order?.orderNumber ?? ticket.ticketNumber))}</b> · ${this.escapeHtml(String(ticket.status))}\n${(ticket.items ?? []).map((item: TelegramStaffItem) => `${Number(item.quantity)}x ${this.escapeHtml(String(item.productName ?? "—"))}`).join(", ")}`).join("\n\n")}`
      : "🍳 Hozir oshxonada faol buyurtma yo'q.";
    await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
      text, parse_mode: "HTML", reply_markup: { inline_keyboard: [
        ...tickets.map((ticket: TelegramKitchenTicket) => [{ text: `#${String(ticket.order?.displayOrderNumber ?? ticket.ticketNumber)}`, callback_data: `${staffCallbackPrefix}:kt:${ticket.id}:n` }]),
        [{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:ki` }],
        [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }],
      ] },
    });
  }

  private async changeKitchenTicket(chatId: string, staff: StaffIdentity, ticketId: string, action: string, messageId?: number): Promise<void> {
    const ticket = await this.kitchenService.getTicket(ticketId, staff.user);
    const next = ticket.status === KitchenTicketStatus.NEW
      ? "accept"
      : ticket.status === KitchenTicketStatus.ACCEPTED
        ? "start"
        : ticket.status === KitchenTicketStatus.COOKING
          ? "ready"
          : "complete";
    if (next === "accept") await this.kitchenService.acceptTicket(ticketId, staff.user);
    else if (next === "start") await this.kitchenService.startTicket(ticketId, staff.user);
    else if (next === "ready") await this.kitchenService.readyTicket(ticketId, staff.user);
    else await this.kitchenService.completeTicket(ticketId, staff.user);
    await this.sendKitchenOrders(chatId, staff, messageId);
  }

  private async sendWaiterOrders(chatId: string, staff: StaffIdentity, messageId?: number): Promise<void> {
    if (!staff.user.roles.includes("WAITER")) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), { text: "Sizda ofitsiant paneliga ruxsat yo'q." });
      return;
    }
    const orders = await this.tablesService.listWaiterOrders(staff.user);
    await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
      text: orders.length ? `<b>🍽 Ofitsiant buyurtmalari</b>\n\n${orders.map((order: TelegramStaffOrder) => `#${this.escapeHtml(String(order.displayOrderNumber ?? order.orderNumber))} · ${this.escapeHtml(String(order.status))}\n${(order.items ?? []).map((item: TelegramStaffItem) => `${Number(item.quantity)}x ${this.escapeHtml(String(item.productName ?? "—"))}`).join(", ")}`).join("\n\n")}` : "🍽 Sizga biriktirilgan faol zal buyurtmasi yo'q.",
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:wa` }], [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }]] },
    });
  }

  private async sendCashierPanel(chatId: string, staff: StaffIdentity, messageId?: number): Promise<void> {
    if (!this.canUseCashier(staff)) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), { text: "Sizda kassa ma'lumotlariga ruxsat yo'q." });
      return;
    }
    if (!staff.user.employeeId) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
        text: "Kassa paneli uchun xodim filialga biriktirilgan bo'lishi kerak.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }],
          ],
        },
      });
      return;
    }
    const shift = await this.cashRegisterService.getCurrentShift(staff.user);
    await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
      text: shift ? `<b>💵 Kassa smenasi</b>\n\nHolat: Ochiq\nFilial: ${this.escapeHtml(shift.branch?.name ?? "—")}\nJami naqd: ${this.escapeHtml(this.formatMoney(shift.cashSales ?? 0))}\nBuyurtmalar: ${shift.orderCount ?? 0}` : "💵 Sizda ochiq kassa smenasi yo'q.",
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:ca` }], [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }]] },
    });
  }

  private async sendManagementPanel(chatId: string, staff: StaffIdentity, messageId?: number): Promise<void> {
    const allowed = staff.user.roles.some((role) => ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"].includes(role));
    if (!allowed) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), { text: "Sizda boshqaruv ko'rsatkichlariga ruxsat yo'q." });
      return;
    }
    const branchId = staff.user.isGlobalScope ? undefined : staff.user.branchId ?? undefined;
    const [orders, employees] = await Promise.all([
      this.prisma.order.count({ where: { ...(branchId ? { branchId } : {}), createdAt: { gte: this.todayStart() } } }),
      this.prisma.employee.count({ where: { ...(branchId ? { branchId } : {}), status: "ACTIVE" } }),
    ]);
    await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
      text: `<b>📊 Boshqaruv</b>\n\nBugungi buyurtmalar: <b>${orders}</b>\nFaol xodimlar: <b>${employees}</b>\nRollar: ${this.escapeHtml(staff.user.roles.join(", "))}`,
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:mg` }], [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }]] },
    });
  }

  private todayStart(): Date {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private staffPanelHint(roles: string[]): string {
    const actions = [
      roles.includes("COURIER") ? "kuryer buyurtmalari" : null,
      roles.includes("KITCHEN") ? "oshxona buyurtmalari" : null,
      roles.includes("WAITER") ? "zal buyurtmalari" : null,
      roles.some((role) => ["CASHIER", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].includes(role)) ? "kassa" : null,
      roles.some((role) => ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"].includes(role)) ? "boshqaruv ko'rsatkichlari" : null,
    ].filter((item): item is string => Boolean(item));
    return actions.length
      ? `Siz uchun mavjud bo'limlar: ${actions.join(", ")}. Kerakli tugmani tanlang.`
      : "Bu accountga Telegram orqali bajariladigan amal biriktirilmagan.";
  }

  private courierOrderDetailText(order: TelegramStaffOrder): string {
    const status = order.order?.status as OrderStatus | undefined;
    const items = (order.order?.items ?? [])
      .map(
        (item: TelegramStaffItem) =>
          `• ${this.escapeHtml(String(item.productName ?? "—"))} × ${Number(item.quantity)} — ${this.escapeHtml(this.formatMoney(item.totalPrice))}`,
      )
      .join("\n");
    const outstanding = Number(order.order?.outstandingAmount ?? 0);
    const location = this.locationLink(order.deliveryLocation);

    return [
      `<b>🚚 Buyurtma #${this.escapeHtml(String(order.order?.displayOrderNumber ?? order.order?.orderNumber ?? order.id))}</b>`,
      `<b>Holat:</b> ${this.escapeHtml(status ? orderStatusLabel(status, "DELIVERY") : "Noma'lum")}`,
      `<b>Mijoz:</b> ${this.escapeHtml(String(order.customer?.name ?? "—"))}`,
      `<b>Telefon:</b> ${this.escapeHtml(String(order.customer?.phone ?? "—"))}`,
      `<b>Manzil:</b> ${this.escapeHtml(String(order.deliveryAddress ?? "—"))}`,
      ...(location ? [`<b>Lokatsiya:</b> ${location}`] : []),
      "",
      `<b>Tarkib:</b>`,
      items || "—",
      "",
      `<b>To'lov:</b> ${this.escapeHtml(String(order.paymentMethod ?? "—"))}`,
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

    const telegramUserIdText = String(telegramUserId);
    const userRecord = await this.prisma.user.findUnique({
      where: { telegramUserId: telegramUserIdText },
      include: {
        employee: true,
        roles: {
          where: { role: { isActive: true } },
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: { select: { code: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    let employee: TelegramStaffEmployeeRecord | null =
      userRecord?.employee ?? null;
    let staffUser: TelegramStaffUserRecord | null = userRecord;

    if (!staffUser) {
      const employeeRecord = await this.prisma.employee.findUnique({
        where: { telegramUserId: telegramUserIdText },
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
      employee = employeeRecord;
      staffUser = employeeRecord?.user ?? null;
    }

    if (!staffUser?.isActive) {
      return null;
    }
    if (employee && employee.status !== "ACTIVE") {
      return null;
    }

    const roles = staffUser.roles.map((item) => item.role.code);
    const permissions = staffUser.roles.flatMap((item) =>
      item.role.permissions.map((permission) => permission.permission.code),
    );

    const user: AuthenticatedUser = {
      id: staffUser.id,
      ...(employee ? { employeeId: employee.id, branchId: employee.branchId } : {}),
      isGlobalScope: staffUser.roles.some(
        (item) => !item.role.isBranchScoped,
      ),
      roles,
      permissions,
    };
    if (staffUser.email) {
      user.email = staffUser.email;
    }
    if (staffUser.phone) {
      user.phone = staffUser.phone;
    }

    return {
      user,
      displayName:
        employee
          ? [employee.firstName, employee.lastName].filter(Boolean).join(" ")
          : (staffUser.displayName ?? staffUser.email ?? staffUser.phone ?? "Xodim"),
    };
  }

  private canUseKitchen(staff: StaffIdentity): boolean {
    return staff.user.roles.some((role) =>
      ["KITCHEN", "ADMIN", "SUPER_ADMIN", "BRANCH_MANAGER"].includes(role),
    );
  }

  private canUseCashier(staff: StaffIdentity): boolean {
    return staff.user.roles.some((role) =>
      ["CASHIER", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].includes(role),
    );
  }

  private isStaffCallback(data: string | undefined): boolean {
    return Boolean(
      data?.startsWith(`${staffCallbackPrefix}:`) ||
      data?.startsWith(`${legacyStaffCallbackPrefix}:`),
    );
  }

  private parseStaffCallback(data: string): { action: string; values: string[] } {
    const [, action, ...values] = data.split(":");
    return { action: action ?? "", values };
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

  private locationLink(value: unknown): string | null {
    if (!value || typeof value !== "object" || !("latitude" in value) || !("longitude" in value)) {
      return null;
    }
    const location = value as { latitude: unknown; longitude: unknown };
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `https://maps.google.com/?q=${latitude},${longitude}`
      : null;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
