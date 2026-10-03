import assert from "node:assert/strict";
import test from "node:test";
import {
  publicAgentStatus,
  safeWebhookUrl,
  type AgentState,
} from "../src/status.js";

const state: AgentState = {
  startedAt: "2026-10-03T00:00:00.000Z",
  mode: "degraded",
  tokenConfigured: true,
  secretConfigured: true,
  webhookUrl:
    "https://api.example.test/api/v1/telegram/webhook/private-secret?debug=private",
  pendingUpdates: 2,
  lastTelegramError: "secret-bearing internal error",
  backendOk: true,
  lastCheckedAt: "2026-10-03T00:01:00.000Z",
  lastError: "secret-bearing agent error",
};

test("redacts the webhook secret segment and query parameters", () => {
  assert.equal(
    safeWebhookUrl(state.webhookUrl),
    "https://api.example.test/api/v1/telegram/webhook/[redacted]",
  );
});

test("public status excludes webhook secrets and raw error messages", () => {
  const status = publicAgentStatus(state);
  const serialized = JSON.stringify(status);

  assert.equal(status.hasTelegramError, true);
  assert.equal(status.hasAgentError, true);
  assert.doesNotMatch(serialized, /private-secret|debug|secret-bearing/);
});

test("malformed configured webhook locations are not exposed", () => {
  assert.equal(safeWebhookUrl("not a URL with a secret"), "[configured]");
});
