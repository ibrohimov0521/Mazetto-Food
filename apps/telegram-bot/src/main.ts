import { createServer, type Server, type ServerResponse } from "node:http";

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
  once: boolean;
  checkMs: number;
  healthPort: number;
  healthHost: string;
  backendHealthUrl: string;
};

type AgentState = {
  startedAt: string;
  mode: "idle" | "checking" | "ready" | "degraded";
  tokenConfigured: boolean;
  secretConfigured: boolean;
  webhookUrl: string | null;
  pendingUpdates: number | null;
  lastTelegramError: string | null;
  backendOk: boolean | null;
  lastCheckedAt: string | null;
  lastError: string | null;
};

const config = readConfig();
const state: AgentState = {
  startedAt: new Date().toISOString(),
  mode: "idle",
  tokenConfigured: Boolean(config.token),
  secretConfigured: Boolean(config.webhookSecret),
  webhookUrl: null,
  pendingUpdates: null,
  lastTelegramError: null,
  backendOk: null,
  lastCheckedAt: null,
  lastError: null,
};

void main(config).catch((error) => {
  state.mode = "degraded";
  state.lastError = errorMessage(error);
  console.error("MAZETTO Telegram Bot agent failed", error);
  process.exitCode = 1;
});

async function main(botConfig: TelegramBotConfig): Promise<void> {
  const healthServer = startHealthServer(botConfig, state);

  console.log("MAZETTO Telegram Bot agent started", {
    publicApiUrl: botConfig.publicApiUrl,
    health: `http://${botConfig.healthHost}:${botConfig.healthPort}`,
    checkMs: botConfig.checkMs,
    tokenConfigured: Boolean(botConfig.token),
    secretConfigured: Boolean(botConfig.webhookSecret),
  });

  if (botConfig.deleteWebhook) {
    await requireToken(botConfig);
    await telegramRequest<boolean>(botConfig, "deleteWebhook", { drop_pending_updates: false });
    console.log("Telegram webhook deleted");
    await refreshState(botConfig, state);
    healthServer.close();
    return;
  }

  if (botConfig.setWebhook) {
    await setWebhook(botConfig);
  }

  await refreshState(botConfig, state);

  if (botConfig.once) {
    healthServer.close();
    return;
  }

  setInterval(() => {
    void refreshState(botConfig, state).catch((error) => {
      state.mode = "degraded";
      state.lastError = errorMessage(error);
      console.error("Telegram health refresh failed", error);
    });
  }, botConfig.checkMs).unref();

  await keepAlive();
}

async function setWebhook(botConfig: TelegramBotConfig): Promise<void> {
  await requireToken(botConfig);

  if (!botConfig.webhookSecret) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET is required when using --set-webhook");
  }

  const url = webhookUrl(botConfig);
  await telegramRequest<boolean>(botConfig, "setWebhook", {
    url,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  console.log(`Telegram webhook set to ${url}`);
}

async function refreshState(botConfig: TelegramBotConfig, agentState: AgentState): Promise<void> {
  agentState.mode = "checking";
  agentState.lastCheckedAt = new Date().toISOString();
  agentState.tokenConfigured = Boolean(botConfig.token);
  agentState.secretConfigured = Boolean(botConfig.webhookSecret);
  agentState.backendOk = await checkBackend(botConfig.backendHealthUrl);

  if (!botConfig.token) {
    agentState.webhookUrl = null;
    agentState.pendingUpdates = null;
    agentState.lastTelegramError = "TELEGRAM_BOT_TOKEN is not set";
    agentState.mode = agentState.backendOk ? "degraded" : "idle";
    return;
  }

  const info = await telegramRequest<WebhookInfo>(botConfig, "getWebhookInfo", {});
  agentState.webhookUrl = info.url || null;
  agentState.pendingUpdates = info.pending_update_count;
  agentState.lastTelegramError = info.last_error_message ?? null;

  const expectedUrl = botConfig.webhookSecret ? webhookUrl(botConfig) : null;
  const webhookMatches = expectedUrl ? info.url === expectedUrl : Boolean(info.url);
  agentState.mode = agentState.backendOk && webhookMatches && !info.last_error_message ? "ready" : "degraded";
  agentState.lastError = agentState.mode === "ready" ? null : agentState.lastError;

  console.log("Telegram status", {
    mode: agentState.mode,
    backendOk: agentState.backendOk,
    webhook: info.url || "not set",
    pendingUpdates: info.pending_update_count,
    lastTelegramError: info.last_error_message ?? null,
  });
}

async function checkBackend(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    return response.ok;
  } catch {
    return false;
  }
}

async function requireToken(botConfig: TelegramBotConfig): Promise<void> {
  if (!botConfig.token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }
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

function startHealthServer(botConfig: TelegramBotConfig, agentState: AgentState): Server {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (url.pathname === "/health") {
      sendJson(response, agentState.mode === "ready" || agentState.mode === "degraded" ? 200 : 503, {
        ok: agentState.mode === "ready",
        mode: agentState.mode,
        backendOk: agentState.backendOk,
      });
      return;
    }

    if (url.pathname === "/status") {
      sendJson(response, 200, agentState);
      return;
    }

    sendHtml(response, renderStatusPage(agentState));
  });

  server.listen(botConfig.healthPort, botConfig.healthHost);
  return server;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function sendHtml(response: ServerResponse, body: string): void {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(body);
}

function renderStatusPage(agentState: AgentState): string {
  return `<!doctype html><html lang="uz"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MAZETTO Telegram Agent</title><style>body{margin:0;font-family:Arial,sans-serif;background:#005b57;color:#062b2a}.wrap{max-width:860px;margin:40px auto;padding:24px}.card{background:#f7f7f2;border:1px solid #d7e5df;border-radius:18px;padding:24px;box-shadow:0 18px 50px #002d2a66}.k{color:#007d75;font-weight:800;text-transform:uppercase;font-size:12px}.h{font-size:34px;font-weight:900;margin:8px 0 18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.box{background:#fff;border:1px solid #dbe7e2;border-radius:14px;padding:14px}.v{font-weight:800;margin-top:6px}.ok{color:#007d75}.bad{color:#a83b32}code{word-break:break-all}</style><body><main class="wrap"><section class="card"><div class="k">Telegram boshqaruvi</div><div class="h">MAZETTO Telegram Agent</div><div class="grid"><div class="box"><div class="k">Holat</div><div class="v ${agentState.mode === "ready" ? "ok" : "bad"}">${agentState.mode}</div></div><div class="box"><div class="k">Backend</div><div class="v">${agentState.backendOk ? "OK" : "Tekshirilmadi/xato"}</div></div><div class="box"><div class="k">Webhook</div><div class="v"><code>${escapeHtml(agentState.webhookUrl ?? "yo'q")}</code></div></div><div class="box"><div class="k">Pending</div><div class="v">${agentState.pendingUpdates ?? "-"}</div></div></div><p>${escapeHtml(agentState.lastTelegramError ?? agentState.lastError ?? "Xato yo'q")}</p></section></main></body></html>`;
}

function webhookUrl(botConfig: TelegramBotConfig): string {
  return `${botConfig.publicApiUrl}/telegram/webhook/${encodeURIComponent(botConfig.webhookSecret ?? "")}`;
}

function readConfig(): TelegramBotConfig {
  const publicApiUrl = normalizeApiUrl(process.env.MAZETTO_PUBLIC_API_URL ?? "https://api.mazettofood.uz/api/v1");
  return {
    token: process.env.TELEGRAM_BOT_TOKEN?.trim() || null,
    publicApiUrl,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null,
    setWebhook: process.argv.includes("--set-webhook"),
    deleteWebhook: process.argv.includes("--delete-webhook"),
    once: process.argv.includes("--once"),
    checkMs: readPositiveInt(process.env.MAZETTO_TELEGRAM_CHECK_MS, 60000),
    healthPort: readPositiveInt(process.env.MAZETTO_TELEGRAM_HEALTH_PORT, 7358),
    healthHost: process.env.MAZETTO_TELEGRAM_HEALTH_HOST?.trim() || "0.0.0.0",
    backendHealthUrl: process.env.MAZETTO_BACKEND_HEALTH_URL?.trim() || `${publicApiUrl}/health`,
  };
}

function normalizeApiUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function keepAlive(): Promise<never> {
  return new Promise(() => undefined);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
}
