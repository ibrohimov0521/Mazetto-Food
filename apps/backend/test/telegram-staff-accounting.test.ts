import assert from "node:assert/strict";
import test from "node:test";
import { CashTransactionType } from "@prisma/client";
import { TelegramStaffService } from "../src/modules/telegram/telegram-staff.service";

function createAccountingService(orders: Array<Record<string, unknown>>) {
  const previousToken = process.env.TELEGRAM_STAFF_BOT_TOKEN;
  process.env.TELEGRAM_STAFF_BOT_TOKEN = "test-token";
  const payloads: Array<{ text?: string }> = [];
  const transactionQueries: Array<Record<string, unknown>> = [];
  const orderQueries: Array<Record<string, unknown>> = [];
  let currentShiftCalls = 0;

  const service = new TelegramStaffService(
    {
      cashTransaction: {
        groupBy: async (query: Record<string, unknown>) => {
          transactionQueries.push(query);
          return [
            {
              orderId: "order-1",
              type: CashTransactionType.SALE,
              _sum: { amount: 65000 },
            },
            {
              orderId: "order-1",
              type: CashTransactionType.REFUND,
              _sum: { amount: 5000 },
            },
          ];
        },
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {
      getCurrentShift: async () => {
        currentShiftCalls += 1;
        return {
          id: "shift-1",
          branchId: "branch-1",
          branch: { name: "Markaz" },
          currentBalance: 180000,
          cashSales: 150000,
          orderCount: 2,
        };
      },
      getCurrentShiftOrders: async (query: Record<string, unknown>) => {
        orderQueries.push(query);
        return orders;
      },
    } as never,
    {
      renderWithToken: async (
        _token: string,
        _target: unknown,
        payload: { text?: string },
      ) => payloads.push(payload),
    } as never,
    {} as never,
  );

  return {
    service,
    payloads,
    transactionQueries,
    orderQueries,
    currentShiftCalls: () => currentShiftCalls,
    restoreToken: () => {
      if (previousToken === undefined) delete process.env.TELEGRAM_STAFF_BOT_TOKEN;
      else process.env.TELEGRAM_STAFF_BOT_TOKEN = previousToken;
    },
  };
}

const order = {
  id: "order-1",
  displayOrderNumber: "WEB-42",
  orderNumber: "42",
  status: "COMPLETED",
  total: 90000,
};

test("long report rows are shortened before Telegram's message limit", () => {
  const harness = createAccountingService([]);
  try {
    const formatter = harness.service as unknown as {
      fitTelegramMessage(lines: string[]): string;
    };
    const result = formatter.fitTelegramMessage(["<b>Hisobot</b>", `<b>${"x".repeat(5000)}</b>`]);

    assert.ok(result.length <= 3800);
    assert.match(result, /^<b>Hisobot<\/b>/);
    assert.match(result, /Hisobot Telegram xabari uchun qisqartirildi/);
    assert.doesNotMatch(result, /<b>x+$/);
  } finally {
    harness.restoreToken();
  }
});

test("cashier sees only current-shift orders and their net cash ledger", async () => {
  const harness = createAccountingService([order]);
  try {
    const accounting = harness.service as unknown as {
      sendShiftAccountingPage(
        chatId: string,
        staff: unknown,
        deliveryOnly: boolean,
        offset: number,
      ): Promise<void>;
    };
    await accounting.sendShiftAccountingPage("cashier-chat", {
      user: {
        employeeId: "cashier-1",
        roles: ["CASHIER"],
        permissions: ["SHIFT_VIEW_OWN"],
      },
    }, false, 0);

    assert.deepEqual(harness.orderQueries[0], { limit: "11", offset: "0" });
    assert.deepEqual(harness.transactionQueries[0]?.where, {
      shiftId: "shift-1",
      branchId: "branch-1",
      orderId: { in: ["order-1"] },
    });
    const text = harness.payloads[0]?.text ?? "";
    assert.match(text, /WEB-42/);
    assert.match(text, /Smenadagi naqd savdo/);
    assert.match(text, /Kassa kutilayotgan qoldig'i/);
    assert.match(text, /60/);
    assert.match(text, /000/);
  } finally {
    harness.restoreToken();
  }
});

test("courier shift cash view filters to delivery orders", async () => {
  const harness = createAccountingService([order]);
  try {
    const accounting = harness.service as unknown as {
      sendCourierShiftCash(chatId: string, staff: unknown): Promise<void>;
    };
    await accounting.sendCourierShiftCash("courier-chat", {
      user: {
        employeeId: "courier-1",
        roles: ["COURIER"],
        permissions: ["SHIFT_VIEW_OWN"],
      },
    });

    assert.equal(harness.orderQueries[0]?.deliveryOnly, true);
    assert.match(harness.payloads[0]?.text ?? "", /Kuryer smena tushumlari/);
    assert.match(harness.payloads[0]?.text ?? "", /WEB-42/);
  } finally {
    harness.restoreToken();
  }
});

test("forged courier callback cannot expose another staff member's delivery ledger", async () => {
  const harness = createAccountingService([order]);
  try {
    const accounting = harness.service as unknown as {
      sendShiftAccountingPage(
        chatId: string,
        staff: unknown,
        deliveryOnly: boolean,
        offset: number,
      ): Promise<void>;
    };
    await accounting.sendShiftAccountingPage("staff-chat", {
      user: {
        employeeId: "cashier-1",
        roles: ["CASHIER"],
        permissions: ["SHIFT_VIEW_OWN"],
      },
    }, true, 0);

    assert.equal(harness.currentShiftCalls(), 0);
    assert.equal(harness.orderQueries.length, 0);
    assert.match(harness.payloads[0]?.text ?? "", /faqat kuryer/);
  } finally {
    harness.restoreToken();
  }
});

test("staff without own-shift permission cannot query shift balances", async () => {
  const harness = createAccountingService([order]);
  try {
    const accounting = harness.service as unknown as {
      sendShiftAccountingPage(
        chatId: string,
        staff: unknown,
        deliveryOnly: boolean,
        offset: number,
      ): Promise<void>;
    };
    await accounting.sendShiftAccountingPage("staff-chat", {
      user: {
        employeeId: "employee-1",
        roles: ["CASHIER"],
        permissions: [],
      },
    }, false, 0);

    assert.equal(harness.currentShiftCalls(), 0);
    assert.equal(harness.orderQueries.length, 0);
    assert.match(harness.payloads[0]?.text ?? "", /ruxsati kerak/);
  } finally {
    harness.restoreToken();
  }
});
