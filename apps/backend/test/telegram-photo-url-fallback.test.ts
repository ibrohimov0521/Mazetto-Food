import assert from "node:assert/strict";
import test from "node:test";
import { TelegramCustomerScreenService } from "../src/modules/telegram/telegram-customer-screen.service";

class RecordingScreen extends TelegramCustomerScreenService {
  readonly calls: Array<{ method: string; payload: unknown }> = [];

  override async telegramRequest(method: string, payload: unknown): Promise<void> {
    this.calls.push({ method, payload });
  }
}

test("relative catalogue image does not break the Telegram menu", async () => {
  const screen = new RecordingScreen();

  await screen.renderCustomerPhotoScreen(
    { chatId: "123" },
    {
      photo: "/uploads/catalog/lavash.jpg",
      caption: "<b>Lavashlar</b>",
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "Mahsulot" }]] },
    },
  );

  assert.deepEqual(screen.calls, [
    {
      method: "sendMessage",
      payload: {
        chat_id: "123",
        text: "<b>Lavashlar</b>",
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "Mahsulot" }]] },
      },
    },
  ]);
});

test("public catalogue image still uses Telegram photo rendering", async () => {
  const screen = new RecordingScreen();

  await screen.renderCustomerPhotoScreen(
    { chatId: "123" },
    { photo: "https://media.mazettofood.uz/lavash.jpg", caption: "Lavash" },
  );

  assert.equal(screen.calls[0]?.method, "sendPhoto");
});
