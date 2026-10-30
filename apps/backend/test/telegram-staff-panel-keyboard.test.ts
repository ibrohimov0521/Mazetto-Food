import assert from "node:assert/strict";
import test from "node:test";
import { KitchenTicketStatus } from "@prisma/client";
import { TelegramStaffService } from "../src/modules/telegram/telegram-staff.service";

test("staff panel sends one valid inline keyboard for a cashier who also runs the kitchen", async () => {
  const previousToken = process.env.TELEGRAM_STAFF_BOT_TOKEN;
  process.env.TELEGRAM_STAFF_BOT_TOKEN = "test-token";
  const payloads: Array<{ reply_markup?: Record<string, unknown> }> = [];

  try {
    const service = new TelegramStaffService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        renderWithToken: async (_token: string, _target: unknown, payload: { reply_markup?: Record<string, unknown> }) => {
          payloads.push(payload);
        },
      } as never,
      {} as never,
    );
    await (service as unknown as {
      sendStaffPanel(chatId: string, staff: unknown): Promise<void>;
    }).sendStaffPanel("chat-1", {
      displayName: "Xodim",
      user: {
        roles: ["CASHIER", "KITCHEN"],
        employeeId: "employee-1",
        permissions: ["SHIFT_VIEW_OWN"],
      },
    });

    const markup = payloads[0]?.reply_markup;
    assert.ok(markup);
    assert.deepEqual(Object.keys(markup), ["inline_keyboard"]);
    assert.deepEqual(
      (markup.inline_keyboard as Array<Array<{ text: string }>>).map((row) => row[0]?.text),
      ["🍳 Oshxona buyurtmalari", "💵 Kassa va smena buyurtmalari", "🔄 Yangilash"],
    );
  } finally {
    if (previousToken === undefined) delete process.env.TELEGRAM_STAFF_BOT_TOKEN;
    else process.env.TELEGRAM_STAFF_BOT_TOKEN = previousToken;
  }
});

test("kitchen buttons name the action and bind it to the displayed ticket status", async () => {
  const previousToken = process.env.TELEGRAM_STAFF_BOT_TOKEN;
  process.env.TELEGRAM_STAFF_BOT_TOKEN = "test-token";
  const payloads: Array<{ reply_markup?: { inline_keyboard?: Array<Array<{ text: string; callback_data: string }>> } }> = [];
  const statuses = [
    KitchenTicketStatus.NEW,
    KitchenTicketStatus.ACCEPTED,
    KitchenTicketStatus.COOKING,
    KitchenTicketStatus.READY,
  ];

  try {
    const service = new TelegramStaffService(
      {} as never,
      {} as never,
      { listOrders: async () => statuses.map((status, index) => ({
        id: `ticket-${index}`,
        status,
        ticketNumber: index + 1,
        items: [],
      })) } as never,
      {} as never,
      {} as never,
      { renderWithToken: async (_token: string, _target: unknown, payload: typeof payloads[number]) => {
        payloads.push(payload);
      } } as never,
      {} as never,
    );
    await (service as unknown as {
      sendKitchenOrders(chatId: string, staff: unknown): Promise<void>;
    }).sendKitchenOrders("chat-1", { user: { roles: ["KITCHEN"], employeeId: "employee-1" } });

    const buttons = payloads[0]?.reply_markup?.inline_keyboard?.map((row) => row[0]);
    assert.deepEqual(buttons?.slice(0, 4), [
      { text: "✅ Qabul qilish #1", callback_data: "s:kt:ticket-0:NEW" },
      { text: "🍳 Tayyorlash #2", callback_data: "s:kt:ticket-1:ACCEPTED" },
      { text: "🔔 Tayyor deb belgilash #3", callback_data: "s:kt:ticket-2:COOKING" },
      { text: "✅ Yakunlash #4", callback_data: "s:kt:ticket-3:READY" },
    ]);
  } finally {
    if (previousToken === undefined) delete process.env.TELEGRAM_STAFF_BOT_TOKEN;
    else process.env.TELEGRAM_STAFF_BOT_TOKEN = previousToken;
  }
});

test("old kitchen buttons refresh the queue without advancing a newer ticket state", async () => {
  const previousToken = process.env.TELEGRAM_STAFF_BOT_TOKEN;
  process.env.TELEGRAM_STAFF_BOT_TOKEN = "test-token";
  let completed = 0;
  let refreshed = 0;
  const staff = { user: { roles: ["KITCHEN"], employeeId: "employee-1" } };

  try {
    const service = new TelegramStaffService(
      {} as never,
      {} as never,
      {
        getTicket: async () => ({ status: KitchenTicketStatus.READY }),
        listOrders: async () => [],
        completeTicket: async () => { completed += 1; },
      } as never,
      {} as never,
      {} as never,
      { renderWithToken: async () => { refreshed += 1; } } as never,
      {} as never,
    );
    const kitchen = service as unknown as {
      changeKitchenTicket(chatId: string, staff: unknown, ticketId: string, action: string): Promise<void>;
    };
    await kitchen.changeKitchenTicket("chat-1", staff, "ticket-1", "n");
    await kitchen.changeKitchenTicket("chat-1", staff, "ticket-1", KitchenTicketStatus.NEW);
    assert.equal(completed, 0);
    assert.equal(refreshed, 2);

    await kitchen.changeKitchenTicket("chat-1", staff, "ticket-1", KitchenTicketStatus.READY);
    assert.equal(completed, 1);
    assert.equal(refreshed, 3);
  } finally {
    if (previousToken === undefined) delete process.env.TELEGRAM_STAFF_BOT_TOKEN;
    else process.env.TELEGRAM_STAFF_BOT_TOKEN = previousToken;
  }
});
test("management dashboard shows tenant reports and only authorized report controls", async () => {
  const previousToken = process.env.TELEGRAM_STAFF_BOT_TOKEN;
  process.env.TELEGRAM_STAFF_BOT_TOKEN = "test-token";
  const payloads: Array<{ text?: string; reply_markup?: { inline_keyboard?: Array<Array<{ text: string; callback_data: string }>> } }> = [];
  let reportActor: unknown;
  let employeeWhere: Record<string, unknown> | undefined;
  const user = {
    id: "owner-a",
    tenantId: "tenant-a",
    membershipId: "membership-a",
    isGlobalScope: true,
    roles: ["OWNER"],
    permissions: [
      "REPORT_SALES_VIEW",
      "REPORT_PRODUCTS_VIEW",
      "REPORT_EMPLOYEES_VIEW",
      "REPORT_EXPENSES_VIEW",
    ],
  };

  try {
    const service = new TelegramStaffService(
      {
        restaurantTenant: {
          findFirst: async ({ where }: { where: { id: string; status: string } }) => ({
            id: where.id,
          }),
        },
        employee: {
          count: async ({ where }: { where: Record<string, unknown> }) => {
            employeeWhere = where;
            return 2;
          },
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        renderWithToken: async (
          _token: string,
          _target: unknown,
          payload: typeof payloads[number],
        ) => payloads.push(payload),
      } as never,
      {
        getSalesReport: async (_query: unknown, actor: unknown) => {
          reportActor = actor;
          return {
            revenue: 120000,
            orderCount: 3,
            averageOrderValue: 40000,
            cashSales: 80000,
            refundHandling: { amount: 5000 },
            cancelledOrders: 1,
            branchBreakdown: [{ branch: { name: "Markaz" }, amount: 120000, orderCount: 3 }],
            paymentBreakdown: [{ paymentMethod: { name: "Naqd" }, amount: 80000 }],
          };
        },
      } as never,
    );
    await (service as unknown as {
      sendManagementPanel(chatId: string, staff: unknown): Promise<void>;
    }).sendManagementPanel("chat-1", { user });

    assert.equal(reportActor, user);
    assert.deepEqual(employeeWhere?.branch, { tenantId: "tenant-a" });
    assert.match(payloads[0]?.text ?? "", /120/);
    assert.match(payloads[0]?.text ?? "", /Markaz/);
    assert.match(payloads[0]?.text ?? "", /Faol xodimlar: <b>2<\/b>/);
    const buttons = payloads[0]?.reply_markup?.inline_keyboard?.flat() ?? [];
    for (const section of ["sales", "products", "employees", "expenses", "z"]) {
      assert.ok(buttons.some((button) => button.callback_data.includes(section)));
    }
    assert.ok(buttons.some((button) => button.callback_data.endsWith(":today")));
    assert.ok(buttons.some((button) => button.callback_data.endsWith(":year")));
  } finally {
    if (previousToken === undefined) delete process.env.TELEGRAM_STAFF_BOT_TOKEN;
    else process.env.TELEGRAM_STAFF_BOT_TOKEN = previousToken;
  }
});

test("unauthorized Telegram report requests do not call the report service", async () => {
  const previousToken = process.env.TELEGRAM_STAFF_BOT_TOKEN;
  process.env.TELEGRAM_STAFF_BOT_TOKEN = "test-token";
  const payloads: Array<{ text?: string }> = [];
  let called = false;
  try {
    const service = new TelegramStaffService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { renderWithToken: async (_token: string, _target: unknown, payload: { text?: string }) => payloads.push(payload) } as never,
      { getSalesReport: async () => { called = true; } } as never,
    );
    await (service as unknown as {
      sendManagementReport(chatId: string, staff: unknown, section: string, preset: string): Promise<void>;
    }).sendManagementReport("chat-1", {
      user: { roles: ["CASHIER"], permissions: [], employeeId: "cashier-1" },
    }, "sales", "today");

    assert.equal(called, false);
    assert.match(payloads[0]?.text ?? "", /ruxsatingiz yo'q/);
  } finally {
    if (previousToken === undefined) delete process.env.TELEGRAM_STAFF_BOT_TOKEN;
    else process.env.TELEGRAM_STAFF_BOT_TOKEN = previousToken;
  }
});
