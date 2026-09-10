type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type WebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
};

type TelegramBotConfig = {
  token: string | null;
  publicApiUrl: string;
  webhookSecret: string | null;
  setWebhook: boolean;
  deleteWebhook: boolean;
};

const config = readConfig();

void main(config).catch((error) => {
  console.error("MAZETTO Telegram Bot helper failed", error);
  process.exitCode = 1;
});

async function main(botConfig: TelegramBotConfig): Promise<void> {
  console.log("MAZETTO Telegram Bot helper started", {
    publicApiUrl: botConfig.publicApiUrl,
    secretConfigured: Boolean(botConfig.webhookSecret),
    tokenConfigured: Boolean(botConfig.token),
  });

  if (!botConfig.token) {
    console.warn("TELEGRAM_BOT_TOKEN is not set. Backend webhook cannot be inspected or updated.");
    return;
  }

  if (botConfig.deleteWebhook) {
    await telegramRequest<boolean>(botConfig, "deleteWebhook", { drop_pending_updates: false });
    console.log("Telegram webhook deleted");
    return;
  }

  if (botConfig.setWebhook) {
    if (!botConfig.webhookSecret) {
      throw new Error("TELEGRAM_WEBHOOK_SECRET is required when using --set-webhook");
    }

    const url = `${botConfig.publicApiUrl}/telegram/webhook/${encodeURIComponent(botConfig.webhookSecret)}`;
    await telegramRequest<boolean>(botConfig, "setWebhook", {
      url,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    console.log(`Telegram webhook set to ${url}`);
  }

  const info = await telegramRequest<WebhookInfo>(botConfig, "getWebhookInfo", {});
  console.log("Telegram webhook info", {
    url: info.url || "not set",
    pendingUpdateCount: info.pending_update_count,
    lastError: info.last_error_message ?? null,
    maxConnections: info.max_connections ?? null,
    allowedUpdates: info.allowed_updates ?? null,
  });
}

async function telegramRequest<T>(botConfig: TelegramBotConfig, method: string, payload: unknown): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${botConfig.token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.json() as TelegramApiResponse<T>;

  if (!response.ok || !body.ok) {
    throw new Error(`Telegram ${method} failed: ${body.description ?? response.statusText}`);
  }

  if (body.result === undefined) {
    throw new Error(`Telegram ${method} returned no result`);
  }

  return body.result;
}

function readConfig(): TelegramBotConfig {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN?.trim() || null,
    publicApiUrl: normalizeApiUrl(process.env.MAZETTO_PUBLIC_API_URL ?? "https://api.mazettofood.uz/api/v1"),
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null,
    setWebhook: process.argv.includes("--set-webhook"),
    deleteWebhook: process.argv.includes("--delete-webhook"),
  };
}

function normalizeApiUrl(value: string): string {
  return value.replace(/\/$/, "");
}
