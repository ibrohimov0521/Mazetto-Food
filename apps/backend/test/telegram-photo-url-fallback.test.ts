import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveTelegramPhotoUrl,
  TelegramCustomerScreenService,
} from "../src/modules/telegram/telegram-customer-screen.service";

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
      method: "sendPhoto",
      payload: {
        chat_id: "123",
        photo: "https://media.mazettofood.uz/uploads/catalog/lavash.jpg",
        caption: "<b>Lavashlar</b>",
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "Mahsulot" }]] },
      },
    },
  ]);
});

test("catalogue image URL normalization supports stored object paths", () => {
  assert.equal(
    resolveTelegramPhotoUrl("products/lavash.jpg"),
    "https://mazettofood.uz/products/lavash.jpg",
  );
  assert.equal(
    resolveTelegramPhotoUrl("/categories/lavash.webp"),
    "https://mazettofood.uz/categories/lavash.webp",
  );
  assert.equal(
    resolveTelegramPhotoUrl("/uploads/catalog/lavash.jpg"),
    "https://media.mazettofood.uz/uploads/catalog/lavash.jpg",
  );
  assert.equal(
    resolveTelegramPhotoUrl("https://cdn.example.com/lavash.jpg"),
    "https://cdn.example.com/lavash.jpg",
  );
});

test("public catalogue image still uses Telegram photo rendering", async () => {
  const screen = new RecordingScreen();

  await screen.renderCustomerPhotoScreen(
    { chatId: "123" },
    { photo: "https://media.mazettofood.uz/lavash.jpg", caption: "Lavash" },
  );

  assert.equal(screen.calls[0]?.method, "sendPhoto");
});
