import assert from "node:assert/strict";
import test from "node:test";
import { TelegramOrderNotificationService } from "../src/modules/telegram/telegram-order-notification.service";

const formatter = new TelegramOrderNotificationService(
  {} as never,
  {} as never,
  {} as never,
) as unknown as {
  formatStaffOrderMessage(order: Record<string, unknown>): string;
};

function messageFor(type: string): string {
  return formatter.formatStaffOrderMessage({
    id: "order-a",
    orderNumber: "101",
    displayOrderNumber: null,
    staffTelegramChatId: null,
    staffTelegramMessageId: null,
    customerName: "Mijoz",
    customerPhone: null,
    deliveryAddress: null,
    deliveryLocation: null,
    type,
    status: "NEW",
    total: 56000,
    notes: null,
    items: [],
    customerOrder: null,
    kitchenTickets: [],
  });
}

test("Telegram labels dine-in as zal and does not invent a pickup address", () => {
  const message = messageFor("DINE_IN");

  assert.match(message, /Turi:<\/b> Zal/);
  assert.doesNotMatch(message, /Manzil:/);
  assert.doesNotMatch(message, /Olib ketish/);
});

test("Telegram labels takeaway without rendering a fake address", () => {
  const message = messageFor("TAKEAWAY");

  assert.match(message, /Turi:<\/b> Olib ketish/);
  assert.doesNotMatch(message, /Manzil:/);
});
