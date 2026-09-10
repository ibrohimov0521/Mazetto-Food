type ReceiptSummary = {
  id: string;
  receiptNumber: string;
  printed: boolean;
  createdAt: string;
  branch?: { id: string; name: string; code: string };
  order?: { orderNumber: string; displayOrderNumber: string | null; status: string };
};

type ReceiptDetail = ReceiptSummary & {
  escpos?: {
    encoding: string;
    commands: Array<Record<string, unknown>>;
  };
};

type AgentConfig = {
  apiUrl: string;
  token: string | null;
  branchId: string | null;
  pollMs: number;
  dryRun: boolean;
  once: boolean;
};

const config = readConfig();

void main(config).catch((error) => {
  console.error("MAZETTO Print Agent failed", error);
  process.exitCode = 1;
});

async function main(agentConfig: AgentConfig): Promise<void> {
  console.log("MAZETTO Print Agent started", {
    apiUrl: agentConfig.apiUrl,
    branchId: agentConfig.branchId ?? "all",
    pollMs: agentConfig.pollMs,
    dryRun: agentConfig.dryRun,
    once: agentConfig.once,
    tokenConfigured: Boolean(agentConfig.token),
  });

  if (!agentConfig.token) {
    console.warn("MAZETTO_PRINT_AGENT_TOKEN is not set. The agent will stay idle until a token is configured.");
    return;
  }

  do {
    await pollOnce(agentConfig);

    if (!agentConfig.once) {
      await delay(agentConfig.pollMs);
    }
  } while (!agentConfig.once);
}

async function pollOnce(agentConfig: AgentConfig): Promise<void> {
  const receipts = await request<ReceiptSummary[]>(agentConfig, receiptsPath(agentConfig));
  const pending = receipts.filter((receipt) => !receipt.printed);

  if (!pending.length) {
    console.log("No pending receipts");
    return;
  }

  for (const receipt of pending) {
    await printReceipt(agentConfig, receipt.id);
  }
}

async function printReceipt(agentConfig: AgentConfig, receiptId: string): Promise<void> {
  const receipt = await request<ReceiptDetail>(agentConfig, `/receipts/${encodeURIComponent(receiptId)}`);
  const label = `${receipt.receiptNumber} / ${receipt.order?.displayOrderNumber ?? receipt.order?.orderNumber ?? "order"}`;

  if (agentConfig.dryRun) {
    console.log(`Dry-run print: ${label}`);
    console.log(renderCommands(receipt.escpos?.commands ?? []));
    return;
  }

  await sendToPrinter(receipt);
  await request<ReceiptDetail>(agentConfig, `/receipts/${encodeURIComponent(receipt.id)}/print`, { method: "PATCH" });
  console.log(`Printed: ${label}`);
}

async function sendToPrinter(receipt: ReceiptDetail): Promise<void> {
  // Real printer adapters will plug in here: USB, network ESC/POS, or Windows spooler.
  // Until then, fail closed so a receipt is never marked printed without hardware output.
  throw new Error(`Printer adapter is not configured for receipt ${receipt.receiptNumber}`);
}

function receiptsPath(agentConfig: AgentConfig): string {
  const params = new URLSearchParams({ limit: "25" });

  if (agentConfig.branchId) {
    params.set("branchId", agentConfig.branchId);
  }

  return `/receipts?${params.toString()}`;
}

async function request<T>(agentConfig: AgentConfig, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${agentConfig.apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${agentConfig.token}`,
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API ${path} failed with ${response.status}: ${await response.text()}`);
  }

  const body = await response.json() as { data?: T } | T;
  return isApiEnvelope<T>(body) ? body.data : body as T;
}

function isApiEnvelope<T>(value: { data?: T } | T): value is { data: T } {
  return Boolean(value && typeof value === "object" && "data" in value);
}

function renderCommands(commands: Array<Record<string, unknown>>): string {
  return commands
    .map((command) => {
      if (command.type === "item") {
        return `${command.quantity} x ${command.name} = ${command.total}`;
      }

      if (command.type === "payment") {
        return `${command.method}: ${command.amount}`;
      }

      if (command.type === "total") {
        return `TOTAL: ${command.value}`;
      }

      if (command.type === "text") {
        return String(command.value ?? "");
      }

      if (command.type === "line") {
        return "------------------------------";
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function readConfig(): AgentConfig {
  return {
    apiUrl: requiredUrl(process.env.MAZETTO_API_URL ?? "https://api.mazettofood.uz/api/v1"),
    token: process.env.MAZETTO_PRINT_AGENT_TOKEN?.trim() || null,
    branchId: process.env.MAZETTO_BRANCH_ID?.trim() || null,
    pollMs: readPositiveInt(process.env.MAZETTO_PRINT_POLL_MS, 5000),
    dryRun: process.env.MAZETTO_PRINT_DRY_RUN !== "false",
    once: process.argv.includes("--once"),
  };
}

function requiredUrl(value: string): string {
  return value.replace(/\/$/, "");
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
