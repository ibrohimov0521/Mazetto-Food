import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { CashTransactionType, KitchenTicketStatus, OrderStatus } from "@prisma/client";
import { orderStatusLabel } from "../../common/utils/order-status-label";
import { hasRestaurantGlobalScope } from "../../common/auth/access-scope";
import { hasPermission } from "../../common/auth/authorization";
import { PERMISSIONS } from "../../common/auth/permissions";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { CustomerCourierService } from "../customers/customer-courier.service";
import { CourierOrderStatus } from "../customers/dto/list-customers.dto";
import { KitchenService } from "../kitchen/kitchen.service";
import { TablesService } from "../tables/tables.service";
import { CashRegisterService } from "../cash-register/cash-register.service";
import { TelegramCustomerScreenService } from "./telegram-customer-screen.service";
import { isWithinTashkent } from "../customers/tashkent-bounds";
import { resolveRestaurantScope } from "../../common/auth/tenant-scope";
import { ReportPreset } from "../reports/dto/report-query.dto";
import { ReportsService } from "../reports/reports.service";

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

type TelegramReportSection = "sales" | "products" | "employees" | "expenses" | "z";

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
    private readonly reportsService: ReportsService,
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
          { command: "couriercash", description: "Kuryer smena tushumlari" },
          { command: "kitchen", description: "Oshxona buyurtmalari" },
          { command: "waiter", description: "Ofitsiant buyurtmalari" },
          { command: "cashier", description: "Kassa smenasi va buyurtmalar" },
          { command: "shiftorders", description: "Smenadagi buyurtmalar" },
          { command: "admin", description: "Boshqaruv statistikasi" },
          { command: "stats", description: "Restoran statistikasi" },
          { command: "sales", description: "Savdo hisoboti" },
          { command: "products", description: "Mahsulotlar hisoboti" },
          { command: "employees", description: "Xodimlar hisoboti" },
          { command: "expenses", description: "Xarajatlar hisoboti" },
          { command: "zreport", description: "Kun yakuni hisoboti" },
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
      if (/^\/help(?:@[A-Za-z0-9_]+)?$/.test(text)) {
        await this.sendStaffHelp(this.requiredId(message.chat?.id));
        return { ok: true, handled: true };
      }

      const isStaffCommand = /^\/(?:start|staff|courier|couriercash|kitchen|waiter|cashier|shiftorders|admin|accountant|stats|sales|products|employees|expenses|zreport)(?:@[A-Za-z0-9_]+)?$/.test(
        text,
      );
      const isStaffKeyboard =
        [
          "👔 Xodim paneli",
          "🚚 Kuryer buyurtmalari",
          "💰 Kuryer smena hisoboti",
          "🍳 Oshxona buyurtmalari",
          "🍽 Ofitsiant buyurtmalari",
          "💵 Kassa",
          "💵 Kassa va smena buyurtmalari",
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

      const chatId = this.requiredId(message.chat?.id);
      if (text === "🚚 Kuryer buyurtmalari" || this.commandMatches(text, "courier")) {
        await this.sendCourierOrdersFromMessage(message, staff);
      } else if (text === "💰 Kuryer smena hisoboti" || this.commandMatches(text, "couriercash")) {
        await this.sendCourierShiftCash(chatId, staff);
      } else if (this.commandMatches(text, "shiftorders")) {
        await this.sendShiftAccountingPage(chatId, staff, false, 0);
      } else if (/^\/kitchen(?:@[A-Za-z0-9_]+)?$/.test(text) || text === "🍳 Oshxona buyurtmalari") {
        await this.sendKitchenOrders(chatId, staff);
      } else if (/^\/waiter(?:@[A-Za-z0-9_]+)?$/.test(text) || text === "🍽 Ofitsiant buyurtmalari") {
        await this.sendWaiterOrders(chatId, staff);
      } else if (this.commandMatches(text, "cashier") || (text === "💵 Kassa" || text === "💵 Kassa va smena buyurtmalari")) {
        await this.sendCashierPanel(chatId, staff);
      } else if (["admin", "accountant", "stats"].some((command) => this.commandMatches(text, command))) {
        await this.sendManagementPanel(chatId, staff);
      } else {
        const reportSection = this.reportSectionForCommand(text);
        if (reportSection) {
          await this.sendManagementReport(chatId, staff, reportSection, ReportPreset.TODAY);
        } else {
          await this.sendStaffPanelFromMessage(message, staff);
        }
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

    if (action === "shift_orders" || action === "so") {
      await this.screen.answerCallbackWithToken(this.botToken, callback);
      await this.sendShiftAccountingPage(
        chatId,
        staff,
        false,
        this.parsePageOffset(values[0]),
        callback.message?.message_id,
      );
      return;
    }

    if (action === "courier_cash" || action === "cc") {
      await this.screen.answerCallbackWithToken(this.botToken, callback);
      await this.sendShiftAccountingPage(
        chatId,
        staff,
        true,
        this.parsePageOffset(values[0]),
        callback.message?.message_id,
      );
      return;
    }

    if (action === "report" || action === "rp") {
      await this.screen.answerCallbackWithToken(this.botToken, callback);
      const section = values[0];
      const preset = values[1];
      if (this.isReportSection(section) && this.isReportPreset(preset)) {
        await this.sendManagementReport(
          chatId,
          staff,
          section,
          preset,
          callback.message?.message_id,
        );
      } else {
        await this.sendManagementPanel(chatId, staff, callback.message?.message_id);
      }
      return;
    }

    if ((action === "kitchen_ticket" || action === "kt") && values[0] && values[1]) {
      await this.screen.answerCallbackWithToken(this.botToken, callback, "Holat tekshirilmoqda...");
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

  private async sendStaffHelp(chatId: string): Promise<void> {
    await this.screen.renderWithToken(this.botToken, { chatId }, {
      text: [
        "<b>MAZETTO Staff — yordam</b>",
        "",
        "Owner Telegram ID'sini POS → Sozlamalar → Telegram buyurtma xabarlari bo'limida bog'laydi. Kassir, kuryer va boshqa xodimlar ID'sini Admin → Xodimlar bo'limida bog'laydi. Har bir oluvchi botni /start bilan avval ochishi kerak.",
        "",
        "/start — xodim paneli",
        "/courier — kuryerning faol yetkazish buyurtmalari",
        "/couriercash — joriy smenaga tushgan yetkazish to'lovlari",
        "/cashier — kassa smenasi va buyurtmalar bo'yicha naqd tushum",
        "/shiftorders — smenangizdagi buyurtmalar",
        "/admin yoki /stats — restoran statistikasi",
        "/sales, /products, /employees, /expenses, /zreport — alohida hisobotlar",
        "/kitchen — oshxona buyurtmalari",
        "/waiter — ofitsiant buyurtmalari",
        "/myid — Telegram foydalanuvchi ID'si",
        "/help — shu yordam",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "👔 Xodim paneli", callback_data: staffCallbackPrefix + ":h" }]],
      },
    });
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
    const rows: Array<Array<{ text: string; callback_data: string }>> = [];
    if (staff.user.roles.includes("COURIER")) {
      rows.push([
        {
          text: "🚚 Kuryer buyurtmalari",
          callback_data: `${staffCallbackPrefix}:co`,
        },
      ]);
    }
    if (this.canViewOwnShift(staff) && staff.user.roles.includes("COURIER")) {
      rows.push([{ text: "💰 Kuryer smena hisoboti", callback_data: `${staffCallbackPrefix}:cc:0` }]);
    }
    if (this.canUseKitchen(staff)) {
      rows.push([{ text: "🍳 Oshxona buyurtmalari", callback_data: `${staffCallbackPrefix}:ki` }]);
    }
    if (staff.user.roles.includes("WAITER")) {
      rows.push([{ text: "🍽 Ofitsiant buyurtmalari", callback_data: `${staffCallbackPrefix}:wa` }]);
    }
    if (this.canUseCashier(staff)) {
      rows.push([{ text: "💵 Kassa va smena buyurtmalari", callback_data: `${staffCallbackPrefix}:ca` }]);
    }
    if (this.canViewAnyManagementReport(staff)) {
      rows.push([{ text: "📊 Boshqaruv statistikasi", callback_data: `${staffCallbackPrefix}:mg` }]);
    }

    rows.push([{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:h` }]);

    await this.screen.renderWithToken(
      this.botToken,
      this.screenTarget(chatId, messageId),
      {
        text: [
          `<b>👔 Xodim paneli</b>`,
          "",
          `<b>Xodim:</b> ${this.escapeHtml(staff.displayName)}`,
          `<b>Rollar:</b> ${this.escapeHtml(staff.user.roles.join(", ") || "—")}`,
          "",
          this.staffPanelHint(staff.user.roles, staff.user.permissions),
        ].join("\n"),
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: rows },
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
              [{ text: "💰 Smena hisoboti", callback_data: `${staffCallbackPrefix}:cc:0` }],
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
            [{ text: "💰 Smena hisoboti", callback_data: `${staffCallbackPrefix}:cc:0` }],
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
        ...tickets.flatMap((ticket: TelegramKitchenTicket) => {
          const actionLabel = this.kitchenActionLabel(ticket.status);
          return actionLabel ? [[{
            text: `${actionLabel} #${String(ticket.order?.displayOrderNumber ?? ticket.ticketNumber)}`,
            callback_data: `${staffCallbackPrefix}:kt:${ticket.id}:${String(ticket.status)}`,
          }]] : [];
        }),
        [{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:ki` }],
        [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }],
      ] },
    });
  }

  private kitchenActionLabel(status: unknown): string | null {
    switch (status) {
      case KitchenTicketStatus.NEW: return "✅ Qabul qilish";
      case KitchenTicketStatus.ACCEPTED: return "🍳 Tayyorlash";
      case KitchenTicketStatus.COOKING: return "🔔 Tayyor deb belgilash";
      case KitchenTicketStatus.READY: return "✅ Yakunlash";
      default: return null;
    }
  }

  private async changeKitchenTicket(chatId: string, staff: StaffIdentity, ticketId: string, action: string, messageId?: number): Promise<void> {
    const ticket = await this.kitchenService.getTicket(ticketId, staff.user);
    if (action !== ticket.status || !this.kitchenActionLabel(ticket.status)) {
      await this.sendKitchenOrders(chatId, staff, messageId);
      return;
    }
    if (ticket.status === KitchenTicketStatus.NEW) await this.kitchenService.acceptTicket(ticketId, staff.user);
    else if (ticket.status === KitchenTicketStatus.ACCEPTED) await this.kitchenService.startTicket(ticketId, staff.user);
    else if (ticket.status === KitchenTicketStatus.COOKING) await this.kitchenService.readyTicket(ticketId, staff.user);
    else if (ticket.status === KitchenTicketStatus.READY) await this.kitchenService.completeTicket(ticketId, staff.user);
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

  private async sendCashierPanel(
    chatId: string,
    staff: StaffIdentity,
    messageId?: number,
  ): Promise<void> {
    if (!this.canUseCashier(staff)) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
        text: "Sizda o'z smenangiz ma'lumotlarini ko'rish ruxsati yo'q.",
      });
      return;
    }
    await this.sendShiftAccountingPage(chatId, staff, false, 0, messageId);
  }

  private async sendCourierShiftCash(
    chatId: string,
    staff: StaffIdentity,
    messageId?: number,
  ): Promise<void> {
    if (!staff.user.roles.includes("COURIER")) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
        text: "Bu bo'lim faqat kuryerning o'z smenasi uchun.",
      });
      return;
    }
    await this.sendShiftAccountingPage(chatId, staff, true, 0, messageId);
  }

  private async sendShiftAccountingPage(
    chatId: string,
    staff: StaffIdentity,
    deliveryOnly: boolean,
    offset: number,
    messageId?: number,
  ): Promise<void> {
    if (deliveryOnly && !staff.user.roles.includes("COURIER")) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
        text: "Bu bo'lim faqat kuryerning o'z smenasi uchun.",
      });
      return;
    }
    if (!staff.user.employeeId || !hasPermission(staff.user, PERMISSIONS.SHIFT_VIEW_OWN)) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
        text: "Shaxsiy smena hisoboti uchun faol xodim profili va o'z smenasini ko'rish ruxsati kerak.",
        reply_markup: { inline_keyboard: [[{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }]] },
      });
      return;
    }

    const shift = await this.cashRegisterService.getCurrentShift(staff.user);
    if (!shift) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
        text: deliveryOnly
          ? "💰 Ochiq smena topilmadi. Yetkazishdan naqd pul qabul qilishdan oldin smenangizni oching."
          : "💵 Ochiq smena topilmadi. Buyurtma va kassa qoldig'i faqat smena ochilganda ko'rinadi.",
        reply_markup: {
          inline_keyboard: [
            ...(deliveryOnly ? [[{ text: "🚚 Kuryer buyurtmalari", callback_data: `${staffCallbackPrefix}:co` }]] : []),
            [{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }],
          ],
        },
      });
      return;
    }

    const pageSize = 10;
    const fetchedOrders = await this.cashRegisterService.getCurrentShiftOrders(
      {
        limit: String(pageSize + 1),
        offset: String(offset),
        ...(deliveryOnly ? { deliveryOnly: true } : {}),
      },
      staff.user,
    );
    const hasNext = fetchedOrders.length > pageSize;
    const orders = fetchedOrders.slice(0, pageSize);
    const cashByOrder = new Map<string, number>();

    if (orders.length > 0) {
      const movements = await this.prisma.cashTransaction.groupBy({
        by: ["orderId", "type"],
        where: {
          shiftId: shift.id,
          branchId: shift.branchId,
          orderId: { in: orders.map((order) => order.id) },
        },
        _sum: { amount: true },
      });
      for (const movement of movements) {
        if (!movement.orderId) continue;
        const amount = Number(movement._sum.amount ?? 0);
        const sign = movement.type === CashTransactionType.REFUND
          ? -1
          : movement.type === CashTransactionType.SALE
            ? 1
            : 0;
        if (sign !== 0) {
          cashByOrder.set(
            movement.orderId,
            (cashByOrder.get(movement.orderId) ?? 0) + sign * amount,
          );
        }
      }
    }

    const rows = orders.length
      ? orders.map((order) => {
          const number = order.displayOrderNumber ?? order.orderNumber ?? order.id;
          const status = String(order.status ?? "Noma'lum");
          const orderCash = cashByOrder.get(order.id) ?? 0;
          return [
            `<b>#${this.escapeHtml(String(number))}</b> · ${this.escapeHtml(status)}`,
            `Smenadagi naqd: <b>${this.escapeHtml(this.formatMoney(orderCash))}</b> · Buyurtma jami: ${this.escapeHtml(this.formatMoney(order.total))}`,
          ].join("\n");
        }).join("\n\n")
      : offset > 0
        ? "Bu sahifada buyurtma yo'q. Oldingi sahifaga qayting."
        : deliveryOnly
          ? "Bu smenada yetkazish buyurtmalariga naqd to'lov yozilmagan."
          : "Bu smenada buyurtmalarga to'lov hali yozilmagan.";

    const pageCash = orders.reduce((sum, order) => sum + (cashByOrder.get(order.id) ?? 0), 0);
    const title = deliveryOnly ? "💰 Kuryer smena tushumlari" : "💵 Kassa smenasi va buyurtmalar";
    const prefix = deliveryOnly ? "cc" : "so";
    const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
    if (offset > 0 || hasNext) {
      keyboard.push([
        ...(offset > 0
          ? [{ text: "⬅️ Oldingi", callback_data: `${staffCallbackPrefix}:${prefix}:${Math.max(0, offset - pageSize)}` }]
          : []),
        ...(hasNext
          ? [{ text: "Keyingi ➡️", callback_data: `${staffCallbackPrefix}:${prefix}:${offset + pageSize}` }]
          : []),
      ]);
    }
    keyboard.push([{ text: "🔄 Yangilash", callback_data: `${staffCallbackPrefix}:${prefix}:${offset}` }]);
    if (deliveryOnly) {
      keyboard.push([{ text: "🚚 Faol kuryer buyurtmalari", callback_data: `${staffCallbackPrefix}:co` }]);
    }
    keyboard.push([{ text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` }]);

    await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
      text: this.fitTelegramMessage([
        `<b>${title}</b>`,
        `Filial: ${this.escapeHtml(shift.branch?.name ?? "—")}`,
        `Kassa kutilayotgan qoldig'i: <b>${this.escapeHtml(this.formatMoney(shift.currentBalance ?? 0))}</b>`,
        `Smenadagi naqd savdo: ${this.escapeHtml(this.formatMoney(shift.cashSales ?? 0))}`,
        `Smenadagi buyurtmalar: ${shift.orderCount ?? 0}`,
        "",
        rows,
        ...(orders.length
          ? ["", `Ushbu sahifadagi buyurtmalar naqd tushumi: <b>${this.escapeHtml(this.formatMoney(pageCash))}</b>`]
          : []),
        "",
        "<i>Har buyurtma uchun naqd summa aynan shu smenaga yozilgan savdo va qaytimlardan hisoblanadi. Kutilayotgan kassa qoldig'i boshlang'ich pul hamda boshqa kirim-chiqimlarni ham qamraydi.</i>",
      ]),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  private async sendManagementPanel(
    chatId: string,
    staff: StaffIdentity,
    messageId?: number,
  ): Promise<void> {
    if (!this.canViewAnyManagementReport(staff)) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
        text: "Sizda boshqaruv hisobotlariga ruxsat yo'q.",
      });
      return;
    }

    const lines = ["<b>📊 Restoran statistikasi · Bugun</b>", ""];
    if (hasPermission(staff.user, PERMISSIONS.REPORT_SALES_VIEW)) {
      const report = await this.reportsService.getSalesReport(
        { preset: ReportPreset.TODAY },
        staff.user,
      );
      lines.push(
        `Jami tushum: <b>${this.escapeHtml(this.formatMoney(report.revenue))}</b>`,
        `Buyurtmalar: <b>${report.orderCount}</b> · O'rtacha chek: ${this.escapeHtml(this.formatMoney(report.averageOrderValue))}`,
        `Naqd savdo: ${this.escapeHtml(this.formatMoney(report.cashSales))}`,
        `Qaytarilgan: ${this.escapeHtml(this.formatMoney(report.refundHandling.amount))} · Bekor qilingan: ${report.cancelledOrders}`,
      );
      const branches = report.branchBreakdown.slice(0, 5);
      if (branches.length) {
        lines.push("", "<b>Filiallar:</b>", ...branches.map((item) =>
          `${this.escapeHtml(item.branch.name)} — ${this.escapeHtml(this.formatMoney(item.amount))} (${item.orderCount})`,
        ));
      }
      if (report.paymentBreakdown.length) {
        lines.push("", "<b>To'lov usullari:</b>", ...report.paymentBreakdown.slice(0, 4).map((item) =>
          `${this.escapeHtml(item.paymentMethod.name)} — ${this.escapeHtml(this.formatMoney(item.amount))}`,
        ));
      }
    } else {
      lines.push("Hisobot bo'limini tanlang:");
    }

    if (hasPermission(staff.user, PERMISSIONS.REPORT_EMPLOYEES_VIEW)) {
      const { tenantId, branchId } = await resolveRestaurantScope(this.prisma, staff.user);
      const activeEmployees = await this.prisma.employee.count({
        where: {
          branch: { tenantId, ...(branchId ? { id: branchId } : {}) },
          status: "ACTIVE",
        },
      });
      lines.push("", `Faol xodimlar: <b>${activeEmployees}</b>`);
    }

    const available = this.availableReportSections(staff);
    const primary = available[0] ?? "sales";
    await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
      text: this.fitTelegramMessage(lines),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: this.managementReportKeyboard("dashboard", primary, ReportPreset.TODAY, staff) },
    });
  }

  private async sendManagementReport(
    chatId: string,
    staff: StaffIdentity,
    section: TelegramReportSection,
    preset: ReportPreset,
    messageId?: number,
  ): Promise<void> {
    if (!hasPermission(staff.user, this.reportPermission(section))) {
      await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
        text: "Bu hisobotni ko'rish uchun ruxsatingiz yo'q.",
        reply_markup: { inline_keyboard: [[{ text: "📊 Boshqaruv", callback_data: `${staffCallbackPrefix}:mg` }]] },
      });
      return;
    }

    const query = { preset };
    const period = this.reportPresetLabel(preset);
    let lines: string[] = [];

    if (section === "sales") {
      const report = await this.reportsService.getSalesReport(query, staff.user);
      lines = [
        `<b>💰 Savdo hisoboti · ${period}</b>`,
        `Tushum: <b>${this.escapeHtml(this.formatMoney(report.revenue))}</b>`,
        `Buyurtmalar: <b>${report.orderCount}</b>`,
        `O'rtacha chek: ${this.escapeHtml(this.formatMoney(report.averageOrderValue))}`,
        `Naqd: ${this.escapeHtml(this.formatMoney(report.cashSales))}`,
        `Qaytarilgan: ${this.escapeHtml(this.formatMoney(report.refundHandling.amount))}`,
        `Bekor qilingan: ${report.cancelledOrders}`,
        "",
        "<b>To'lov usullari:</b>",
        ...(report.paymentBreakdown.length
          ? report.paymentBreakdown.slice(0, 5).map((item) =>
              `${this.escapeHtml(item.paymentMethod.name)} — ${this.escapeHtml(this.formatMoney(item.amount))} (${item.count})`,
            )
          : ["Hozircha to'lov qayd etilmagan."]),
        "",
        "<b>Buyurtma kanallari:</b>",
        ...report.sourceBreakdown.filter((item) => item.orderCount > 0).slice(0, 5).map((item) =>
          `${this.escapeHtml(item.source)} — ${this.escapeHtml(this.formatMoney(item.amount))} (${item.orderCount} buyurtma)`,
        ),
        "",
        "<b>Filiallar:</b>",
        ...(report.branchBreakdown.length
          ? report.branchBreakdown.slice(0, 5).map((item) =>
              `${this.escapeHtml(item.branch.name)} — ${this.escapeHtml(this.formatMoney(item.amount))} (${item.orderCount})`,
            )
          : ["Filial savdosi topilmadi."]),
        ...(report.cashierBreakdown.length
          ? ["", "<b>Kassirlar:</b>", ...report.cashierBreakdown.slice(0, 5).map((item) =>
              `${this.escapeHtml([item.cashier.firstName, item.cashier.lastName].filter(Boolean).join(" "))} — ${this.escapeHtml(this.formatMoney(item.amount))} (${item.orderCount})`,
            )]
          : []),
        ...(report.topProducts.length
          ? ["", "<b>Ko'p sotilgan mahsulotlar:</b>", ...report.topProducts.slice(0, 5).map((item) =>
              `${this.escapeHtml(item.productName)} — ${this.escapeHtml(this.formatQuantity(item.quantity))} dona, ${this.escapeHtml(this.formatMoney(item.amount))}`,
            )]
          : []),
      ];
    } else if (section === "products") {
      const report = await this.reportsService.getProductReport(
        { ...query, limit: 10 },
        staff.user,
      );
      lines = [
        `<b>🥇 Mahsulotlar hisoboti · ${period}</b>`,
        ...(report.products.length
          ? report.products.slice(0, 10).map((item, index) =>
              `${index + 1}. ${this.escapeHtml(item.productName)} — ${this.escapeHtml(this.formatQuantity(item.quantitySold))} dona · ${this.escapeHtml(this.formatMoney(item.revenue))}`,
            )
          : ["Bu davrda sotilgan mahsulot topilmadi."]),
      ];
    } else if (section === "employees") {
      const report = await this.reportsService.getEmployeeReport(query, staff.user);
      const employees = [...report.employees]
        .sort((left, right) => Number(right.salesAmount) - Number(left.salesAmount))
        .slice(0, 10);
      lines = [
        `<b>👥 Xodimlar hisoboti · ${period}</b>`,
        ...(employees.length
          ? employees.map((item, index) => {
              const name = [item.employee?.firstName, item.employee?.lastName].filter(Boolean).join(" ") || item.employee?.employeeCode || "Xodim";
              return `${index + 1}. ${this.escapeHtml(name)} — ${item.ordersHandled} buyurtma · ${this.escapeHtml(this.formatMoney(item.salesAmount))} · ${item.shifts.length} smena`;
            })
          : ["Bu davrda xodimlar bo'yicha savdo yo'q."]),
        ...(report.employees.length > 10 ? ["", `Birinchi 10 xodim ko'rsatildi (${report.employees.length} jami).`] : []),
      ];
    } else if (section === "expenses") {
      const report = await this.reportsService.getExpenseReport(query, staff.user);
      lines = [
        `<b>💸 Xarajatlar hisoboti · ${period}</b>`,
        `Jami: <b>${this.escapeHtml(this.formatMoney(report.totalAmount))}</b> · ${report.expenseCount} ta xarajat`,
        "",
        "<b>Toifalar:</b>",
        ...(report.categories.length
          ? report.categories.slice(0, 10).map((item) =>
              `${this.escapeHtml(item.category)} — ${this.escapeHtml(this.formatMoney(item.amount))} (${item.count})`,
            )
          : ["Xarajat qayd etilmagan."]),
      ];
    } else {
      const report = await this.reportsService.getZReport(query, staff.user);
      lines = [
        `<b>📄 Kun yakuni hisoboti · ${period}</b>`,
        `Jami tushum: <b>${this.escapeHtml(this.formatMoney(report.totalSales))}</b>`,
        `Naqd tushum: ${this.escapeHtml(this.formatMoney(report.cashSales))}`,
        `Buyurtmalar: ${report.ordersCount} · O'rtacha chek: ${this.escapeHtml(this.formatMoney(report.averageOrder))}`,
        `Xarajatlar: ${this.escapeHtml(this.formatMoney(report.expenses))}`,
        `Shartli qoldiq: <b>${this.escapeHtml(this.formatMoney(report.profit))}</b>`,
        "",
        "<i>Shartli qoldiq tannarxni va to'liq refund/provider reconciliation'ni hisoblamaydi; yakuniy foyda sifatida talqin qilmang.</i>",
      ];
    }

    const keyboard = this.managementReportKeyboard(section, section, preset, staff);
    await this.screen.renderWithToken(this.botToken, this.screenTarget(chatId, messageId), {
      text: this.fitTelegramMessage(lines),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  private managementReportKeyboard(
    view: "dashboard" | TelegramReportSection,
    activeSection: TelegramReportSection,
    preset: ReportPreset,
    staff: StaffIdentity,
  ): Array<Array<{ text: string; callback_data: string }>> {
    const rows: Array<Array<{ text: string; callback_data: string }>> = [];
    const sections = this.availableReportSections(staff);
    for (let index = 0; index < sections.length; index += 2) {
      rows.push(sections.slice(index, index + 2).map((section) => ({
        text: `${section === activeSection ? "✓ " : ""}${this.reportSectionLabel(section)}`,
        callback_data: `${staffCallbackPrefix}:rp:${section}:${preset}`,
      })));
    }

    const presets = [
      { value: ReportPreset.TODAY, label: "Bugun" },
      { value: ReportPreset.YESTERDAY, label: "Kecha" },
      { value: ReportPreset.LAST_7_DAYS, label: "7 kun" },
      { value: ReportPreset.THIS_MONTH, label: "Oy" },
      { value: ReportPreset.YEAR, label: "Yil" },
    ];
    for (let index = 0; index < presets.length; index += 2) {
      rows.push(presets.slice(index, index + 2).map((option) => ({
        text: `${option.value === preset ? "✓ " : ""}${option.label}`,
        callback_data: `${staffCallbackPrefix}:rp:${activeSection}:${option.value}`,
      })));
    }

    rows.push([
      {
        text: "🔄 Yangilash",
        callback_data: view === "dashboard"
          ? `${staffCallbackPrefix}:mg`
          : `${staffCallbackPrefix}:rp:${activeSection}:${preset}`,
      },
      { text: "🏠 Xodim paneli", callback_data: `${staffCallbackPrefix}:h` },
    ]);
    return rows;
  }

  private availableReportSections(staff: StaffIdentity): TelegramReportSection[] {
    return ([
      ["sales", PERMISSIONS.REPORT_SALES_VIEW],
      ["products", PERMISSIONS.REPORT_PRODUCTS_VIEW],
      ["employees", PERMISSIONS.REPORT_EMPLOYEES_VIEW],
      ["expenses", PERMISSIONS.REPORT_EXPENSES_VIEW],
      ["z", PERMISSIONS.REPORT_SALES_VIEW],
    ] as const)
      .filter(([, permission]) => hasPermission(staff.user, permission))
      .map(([section]) => section);
  }

  private canViewAnyManagementReport(staff: StaffIdentity): boolean {
    return this.availableReportSections(staff).length > 0;
  }

  private reportPermission(section: TelegramReportSection): string {
    switch (section) {
      case "sales":
      case "z":
        return PERMISSIONS.REPORT_SALES_VIEW;
      case "products":
        return PERMISSIONS.REPORT_PRODUCTS_VIEW;
      case "employees":
        return PERMISSIONS.REPORT_EMPLOYEES_VIEW;
      case "expenses":
        return PERMISSIONS.REPORT_EXPENSES_VIEW;
    }
  }

  private reportSectionLabel(section: TelegramReportSection): string {
    switch (section) {
      case "sales": return "💰 Savdo";
      case "products": return "🥇 Mahsulotlar";
      case "employees": return "👥 Xodimlar";
      case "expenses": return "💸 Xarajatlar";
      case "z": return "📄 Z-hisobot";
    }
  }

  private reportPresetLabel(preset: ReportPreset): string {
    switch (preset) {
      case ReportPreset.TODAY: return "Bugun";
      case ReportPreset.YESTERDAY: return "Kecha";
      case ReportPreset.LAST_7_DAYS: return "Oxirgi 7 kun";
      case ReportPreset.THIS_MONTH: return "Shu oy";
      case ReportPreset.YEAR: return "Yil boshidan";
      default: return "Tanlangan davr";
    }
  }

  private isReportSection(value: string | undefined): value is TelegramReportSection {
    return value === "sales" || value === "products" || value === "employees" || value === "expenses" || value === "z";
  }

  private isReportPreset(value: string | undefined): value is ReportPreset {
    return value === ReportPreset.TODAY
      || value === ReportPreset.YESTERDAY
      || value === ReportPreset.LAST_7_DAYS
      || value === ReportPreset.THIS_MONTH
      || value === ReportPreset.YEAR;
  }

  private reportSectionForCommand(text: string): TelegramReportSection | null {
    const commands: Array<[string, TelegramReportSection]> = [
      ["sales", "sales"],
      ["products", "products"],
      ["employees", "employees"],
      ["expenses", "expenses"],
      ["zreport", "z"],
    ];
    return commands.find(([command]) => this.commandMatches(text, command))?.[1] ?? null;
  }

  private commandMatches(text: string, command: string): boolean {
    return new RegExp(`^/${command}(?:@[A-Za-z0-9_]+)?$`).test(text);
  }

  private parsePageOffset(value: string | undefined): number {
    if (!value || !/^[0-9]{1,5}$/.test(value)) return 0;
    const offset = Number(value);
    return Number.isSafeInteger(offset) && offset <= 10000 ? offset : 0;
  }

  private staffPanelHint(roles: string[], permissions: string[]): string {
    const reportPermissions = new Set<string>([
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_PRODUCTS_VIEW,
      PERMISSIONS.REPORT_EMPLOYEES_VIEW,
      PERMISSIONS.REPORT_EXPENSES_VIEW,
    ]);
    const actions = [
      roles.includes("COURIER") ? "kuryer buyurtmalari va o'z smenasi" : null,
      roles.includes("KITCHEN") ? "oshxona buyurtmalari" : null,
      roles.includes("WAITER") ? "zal buyurtmalari" : null,
      permissions.includes("*") || permissions.includes(PERMISSIONS.SHIFT_VIEW_OWN) ? "o'z smenangiz va buyurtmalar" : null,
      permissions.some((permission) => reportPermissions.has(permission)) || permissions.includes("*")
        ? "statistika va hisobotlar"
        : null,
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
      isGlobalScope: hasRestaurantGlobalScope(staffUser.roles.map(({ role }) => role)),
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

  private canViewOwnShift(staff: StaffIdentity): boolean {
    return Boolean(staff.user.employeeId)
      && hasPermission(staff.user, PERMISSIONS.SHIFT_VIEW_OWN);
  }

  private canUseCashier(staff: StaffIdentity): boolean {
    return Boolean(staff.user.employeeId)
      && staff.user.roles.some((role) => ["CASHIER", "ADMIN", "SUPER_ADMIN"].includes(role))
      && hasPermission(staff.user, PERMISSIONS.SHIFT_VIEW_OWN);
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

  private fitTelegramMessage(lines: string[]): string {
    const limit = 3800;
    const shortenedNotice = "Hisobot Telegram xabari uchun qisqartirildi.";
    const output: string[] = [];

    for (const line of lines) {
      const nextLength = output.reduce((length, current) => length + current.length, 0)
        + Math.max(0, output.length - 1)
        + (output.length ? 1 : 0)
        + line.length;
      if (nextLength <= limit) {
        output.push(line);
        continue;
      }

      while (
        output.length > 0
        && output.reduce((length, current) => length + current.length, 0)
          + Math.max(0, output.length - 1)
          + shortenedNotice.length
          + 2
          > limit
      ) {
        output.pop();
      }
      const body = output.join("\n");
      return body ? `${body}\n\n${shortenedNotice}` : shortenedNotice;
    }

    return output.join("\n");
  }

  private formatMoney(value: unknown): string {
    const number = Number(value ?? 0);
    return Number.isFinite(number)
      ? `${new Intl.NumberFormat("uz-UZ").format(Math.round(number))} so'm`
      : "—";
  }

  private formatQuantity(value: unknown): string {
    const number = Number(value ?? 0);
    return Number.isFinite(number)
      ? new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 2 }).format(number)
      : "—";
  }

  private locationLink(value: unknown): string | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const location = value as Record<string, unknown>;
    const rawLatitude = location.latitude;
    const rawLongitude = location.longitude;
    if (
      (typeof rawLatitude !== "number" &&
        (typeof rawLatitude !== "string" || !rawLatitude.trim())) ||
      (typeof rawLongitude !== "number" &&
        (typeof rawLongitude !== "string" || !rawLongitude.trim()))
    ) {
      return null;
    }

    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);
    return isWithinTashkent(latitude, longitude)
      ? "https://www.google.com/maps/search/?api=1&query=" +
          latitude +
          "," +
          longitude
      : null;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
