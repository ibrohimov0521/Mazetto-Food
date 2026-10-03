import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { TelegramCustomerAuthService } from "../src/modules/telegram/telegram-customer-auth.service";

function createService() {
  return new TelegramCustomerAuthService(
    {
      customer: {
        findUnique: async () => ({ telegramChatId: "test-chat" }),
      },
    } as never,
    {} as never,
    {} as never,
  );
}

function telegramResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function withTelegramEnvironment(run: () => Promise<void>) {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";

  try {
    await run();
  } finally {
    if (previousToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = previousToken;
    }
    globalThis.fetch = previousFetch;
  }
}

test("customer verification retries a transient Telegram network failure once", async () => {
  await withTelegramEnvironment(async () => {
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("fetch failed");
      return telegramResponse({ ok: true, result: { message_id: 1 } });
    }) as typeof fetch;

    const result = await createService().deliverVerificationCode({
      tenantId: "tenant-a",
      phone: "+998901234567",
      code: "123456",
    });

    assert.equal(result.status, "SENT");
    assert.equal(attempts, 2);
  });
});

test("HTTP 200 with Telegram ok=false is treated as failed code delivery", async () => {
  await withTelegramEnvironment(async () => {
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts += 1;
      return telegramResponse({ ok: false, description: "chat not found" });
    }) as typeof fetch;

    await assert.rejects(
      createService().deliverVerificationCode({
        tenantId: "tenant-a",
        phone: "+998901234567",
        code: "123456",
      }),
      (error: unknown) =>
        error instanceof ServiceUnavailableException &&
        error.message.includes("Bir ozdan keyin qayta urinib") &&
        !error.message.includes("chat not found"),
    );
    assert.equal(attempts, 1);
  });
});

test("customer verification returns a clear unavailable error after network retries fail", async () => {
  await withTelegramEnvironment(async () => {
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts += 1;
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    await assert.rejects(
      createService().deliverVerificationCode({
        tenantId: "tenant-a",
        phone: "+998901234567",
        code: "123456",
      }),
      (error: unknown) =>
        error instanceof ServiceUnavailableException &&
        error.message.includes("Bir ozdan keyin qayta urinib"),
    );
    assert.equal(attempts, 2);
  });
});
