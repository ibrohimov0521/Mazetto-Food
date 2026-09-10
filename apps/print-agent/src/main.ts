import { mkdir, writeFile } from "node:fs/promises";
import { Socket } from "node:net";
import { join } from "node:path";

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
  mode: "stdout" | "file" | "tcp";
  outputDir: string;
  printerHost: string | null;
  printerPort: number;
  timeoutMs: number;
  retries: number;
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
    mode: agentConfig.mode,
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
  const pending = await request<ReceiptSummary[]>(agentConfig, receiptsPath(agentConfig));

  if (!pending.length) {
    console.log("No pending receipts");
    return;
  }

  for (const receipt of pending) {
    try {
      await printReceipt(agentConfig, receipt.id);
    } catch (error) {
      console.error(`Print failed for ${receipt.receiptNumber}`, error);
    }
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

  await sendToPrinter(agentConfig, receipt);
  await request<ReceiptDetail>(agentConfig, `/receipts/${encodeURIComponent(receipt.id)}/print`, { method: "PATCH" });
  console.log(`Printed: ${label}`);
}

async function sendToPrinter(agentConfig: AgentConfig, receipt: ReceiptDetail): Promise<void> {
  const commands = receipt.escpos?.commands ?? [];

  for (let attempt = 1; attempt <= agentConfig.retries + 1; attempt += 1) {
    try {
      if (agentConfig.mode === "stdout") {
        console.log(renderCommands(commands));
        return;
      }

      if (agentConfig.mode === "file") {
        await writeReceiptFile(agentConfig, receipt);
        return;
      }

      if (agentConfig.mode === "tcp") {
        await writeTcpReceipt(agentConfig, commands);
        return;
      }
    } catch (error) {
      if (attempt > agentConfig.retries) {
        throw error;
      }

      console.warn(`Printer retry ${attempt}/${agentConfig.retries} for ${receipt.receiptNumber}`);
      await delay(Math.min(1000 * attempt, 5000));
    }
  }
}

async function writeReceiptFile(agentConfig: AgentConfig, receipt: ReceiptDetail): Promise<void> {
  await mkdir(agentConfig.outputDir, { recursive: true });
  const filename = `${safeFileName(receipt.receiptNumber)}.txt`;
  const content = renderCommands(receipt.escpos?.commands ?? []);
  await writeFile(join(agentConfig.outputDir, filename), `${content}\n`, "utf8");
}

async function writeTcpReceipt(agentConfig: AgentConfig, commands: Array<Record<string, unknown>>): Promise<void> {
  const printerHost = agentConfig.printerHost;

  if (!printerHost) {
    throw new Error("MAZETTO_PRINTER_HOST is required for tcp mode");
  }

  const payload = Buffer.from(toEscPosText(commands), "utf8");

  await new Promise<void>((resolve, reject) => {
    const socket = new Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Printer TCP timeout after ${agentConfig.timeoutMs}ms`));
    }, agentConfig.timeoutMs);

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    socket.connect(agentConfig.printerPort, printerHost, () => {
      socket.end(payload, () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  });
}

function receiptsPath(agentConfig: AgentConfig): string {
  const params = new URLSearchParams({ limit: "50", printed: "false" });

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

      if (command.type === "cut") {
        return "";
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
    mode: readPrintMode(process.env.MAZETTO_PRINTER_MODE),
    outputDir: process.env.MAZETTO_PRINT_OUTPUT_DIR?.trim() || "./printed-receipts",
    printerHost: process.env.MAZETTO_PRINTER_HOST?.trim() || null,
    printerPort: readPositiveInt(process.env.MAZETTO_PRINTER_PORT, 9100),
    timeoutMs: readPositiveInt(process.env.MAZETTO_PRINT_TIMEOUT_MS, 10000),
    retries: readNonNegativeInt(process.env.MAZETTO_PRINT_RETRIES, 2),
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


function toEscPosText(commands: Array<Record<string, unknown>>): string {
  const initialize = "\x1b@";
  const cut = "\x1dV\x00";
  const body = commands
    .map((command) => {
      if (command.type === "align") {
        return command.value === "center" ? "\x1ba\x01" : "\x1ba\x00";
      }

      if (command.type === "bold") {
        return command.value ? "\x1bE\x01" : "\x1bE\x00";
      }

      if (command.type === "cut") {
        return cut;
      }

      const line = renderCommands([command]);
      return line ? `${line}\n` : "";
    })
    .join("");

  return `${initialize}${body}\n${cut}`;
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "receipt";
}

function readPrintMode(value: string | undefined): AgentConfig["mode"] {
  if (value === "stdout" || value === "file" || value === "tcp") {
    return value;
  }

  return "file";
}

function readNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
