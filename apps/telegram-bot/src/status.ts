export type AgentState = {
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

export function publicAgentStatus(state: AgentState) {
  return {
    startedAt: state.startedAt,
    mode: state.mode,
    tokenConfigured: state.tokenConfigured,
    secretConfigured: state.secretConfigured,
    webhookUrl: safeWebhookUrl(state.webhookUrl),
    pendingUpdates: state.pendingUpdates,
    hasTelegramError: Boolean(state.lastTelegramError),
    backendOk: state.backendOk,
    lastCheckedAt: state.lastCheckedAt,
    hasAgentError: Boolean(state.lastError),
  };
}

export function safeWebhookUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const segments = url.pathname.split("/");

    for (let index = segments.length - 1; index >= 0; index -= 1) {
      if (segments[index]) {
        segments[index] = "[redacted]";
        break;
      }
    }

    return url.origin + segments.join("/");
  } catch {
    return "[configured]";
  }
}
