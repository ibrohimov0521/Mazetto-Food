#!/usr/bin/env node

/*
 * Read-only Telegram production acceptance.
 *
 * The command never sets or deletes a webhook and never prints a token. It is
 * intentionally separate from the public HTTP smoke because Telegram's
 * getWebhookInfo requires the bot credential.
 *
 *   TELEGRAM_BOT_TOKEN=... pnpm telegram:smoke
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_STAFF_BOT_TOKEN=... pnpm telegram:smoke
 */

const apiBase = "https://api.telegram.org/bot";
const publicApi = process.env.MAZETTO_API_URL ?? "https://api.mazettofood.uz/api/v1";
const expectedCustomerPath = process.env.TELEGRAM_CUSTOMER_WEBHOOK_PATH ?? "/telegram/webhook/";
const expectedStaffPath = process.env.TELEGRAM_STAFF_WEBHOOK_PATH ?? "/telegram/staff-webhook/";

const bots = [
  { name: "customer", token: process.env.TELEGRAM_BOT_TOKEN, expectedPath: expectedCustomerPath },
  { name: "staff", token: process.env.TELEGRAM_STAFF_BOT_TOKEN, expectedPath: expectedStaffPath },
].filter((bot) => bot.token?.trim());

if (bots.length === 0) {
  console.error("Telegram acceptance stopped: TELEGRAM_BOT_TOKEN is not configured.");
  process.exitCode = 1;
} else {
  for (const bot of bots) {
    const problems = await inspectBot(bot);
    if (problems.length === 0) {
      console.log(`  OK   Telegram ${bot.name} bot`);
    } else {
      console.error(`  FAIL Telegram ${bot.name} bot — ${problems.join("; ")}`);
      process.exitCode = 1;
    }
  }
}

async function inspectBot(bot) {
  const problems = [];
  const me = await telegram(bot.token, "getMe");
  if (!me.ok || !me.result?.username) {
    problems.push("getMe muvaffaqiyatsiz");
    return problems;
  }

  const webhook = await telegram(bot.token, "getWebhookInfo");
  const info = webhook.ok ? webhook.result : null;
  if (!info) {
    problems.push("getWebhookInfo muvaffaqiyatsiz");
    return problems;
  }

  const url = typeof info.url === "string" ? info.url : "";
  if (!url.includes(bot.expectedPath)) problems.push("webhook yo'li kutilgandek emas");
  if (info.pending_update_count !== 0) problems.push(`pending updates: ${info.pending_update_count}`);
  if (info.last_error_message) problems.push("Telegram oxirgi webhook xatosini qaytargan");

  // Confirm the configured API host is reachable without exposing credentials.
  try {
    const health = await fetch(`${publicApi}/health`, { signal: AbortSignal.timeout(10000) });
    if (!health.ok) problems.push(`backend health HTTP ${health.status}`);
  } catch (error) {
    problems.push(`backend health ${error.name ?? "network error"}`);
  }

  return problems;
}

async function telegram(token, method) {
  try {
    const response = await fetch(`${apiBase}${encodeURIComponent(token)}/${method}`, {
      signal: AbortSignal.timeout(15000),
    });
    return await response.json();
  } catch {
    return { ok: false };
  }
}
