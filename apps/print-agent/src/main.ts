import { createServer, type Server, type ServerResponse } from "node:http";
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
  healthPort: number;
  healthHost: string;
};

type AgentState = {
  startedAt: string;
  mode: "idle" | "polling" | "ready" | "degraded";
  tokenConfigured: boolean;
  printerConfigured: boolean;
  lastPollAt: string | null;
  lastPrintedAt: string | null;
  lastReceipt: string | null;
  pendingCount: number;
  printedCount: number;
  failedCount: number;
  lastError: string | null;
};

const config = readConfig();
const state: AgentState = {
  startedAt: new Date().toISOString(),
  mode: "idle",
  tokenConfigured: Boolean(config.token),
  printerConfigured: config.dryRun || config.mode !== "tcp" || Boolean(config.printerHost),
  lastPollAt: null,
  lastPrintedAt: null,
  lastReceipt: null,
  pendingCount: 0,
  printedCount: 0,
  failedCount: 0,
  lastError: null,
};

void main(config, state).catch((error) => {
  state.mode = "degraded";
  state.lastError = errorMessage(error);
  console.error("MAZETTO Print Agent failed", error);
  process.exitCode = 1;
});

async function main(agentConfig: AgentConfig, agentState: AgentState): Promise<void> {
  const healthServer = startHealthServer(agentConfig, agentState);

  console.log("MAZETTO Print Agent started", {
    apiUrl: agentConfig.apiUrl,
    branchId: agentConfig.branchId ?? "all",
    pollMs: agentConfig.pollMs,
    dryRun: agentConfig.dryRun,
    once: agentConfig.once,
    mode: agentConfig.mode,
    health: `http://${agentConfig.healthHost}:${agentConfig.healthPort}`,
    tokenConfigured: Boolean(agentConfig.token),
  });

  if (!agentConfig.token) {
    agentState.mode = "idle";
    agentState.lastError = "MAZETTO_PRINT_AGENT_TOKEN is not set";
    console.warn("MAZETTO_PRINT_AGENT_TOKEN is not set. The agent will stay idle until a token is configured.");
    if (!agentConfig.once) {
      await keepAlive();
    }
    healthServer.close();
    return;
  }

  do {
    await pollOnce(agentConfig, agentState);

    if (!agentConfig.once) {
      await delay(agentConfig.pollMs);
    }
  } while (!agentConfig.once);

  healthServer.close();
}

async function pollOnce(agentConfig: AgentConfig, agentState: AgentState): Promise<void> {
  agentState.mode = "polling";
  agentState.lastPollAt = new Date().toISOString();
  const pending = await request<ReceiptSummary[]>(agentConfig, receiptsPath(agentConfig));
  agentState.pendingCount = pending.length;

  if (!pending.length) {
    agentState.mode = "ready";
    console.log("No pending receipts");
    return;
  }

  for (const receipt of pending) {
    try {
      await printReceipt(agentConfig, agentState, receipt.id);
    } catch (error) {
      agentState.failedCount += 1;
      agentState.mode = "degraded";
      agentState.lastError = errorMessage(error);
      console.error(`Print failed for ${receipt.receiptNumber}`, error);
    }
  }

  if (agentState.mode !== "degraded") {
    agentState.mode = "ready";
  }
}

async function printReceipt(agentConfig: AgentConfig, agentState: AgentState, receiptId: string): Promise<void> {
  const receipt = await request<ReceiptDetail>(agentConfig, `/receipts/${encodeURIComponent(receiptId)}`);
  const label = `${receipt.receiptNumber} / ${receipt.order?.displayOrderNumber ?? receipt.order?.orderNumber ?? "order"}`;

  if (agentConfig.dryRun) {
    console.log(`Dry-run print: ${label}`);
    console.log(renderCommands(receipt.escpos?.commands ?? []));
    agentState.lastReceipt = label;
    agentState.mode = "ready";
    return;
  }

  await sendToPrinter(agentConfig, receipt);
  await request<ReceiptDetail>(agentConfig, `/receipts/${encodeURIComponent(receipt.id)}/print`, { method: "PATCH" });
  agentState.printedCount += 1;
  agentState.lastPrintedAt = new Date().toISOString();
  agentState.lastReceipt = label;
  agentState.lastError = null;
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

function startHealthServer(agentConfig: AgentConfig, agentState: AgentState): Server {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (url.pathname === "/health") {
      sendJson(response, agentState.mode === "degraded" || agentState.mode === "idle" ? 503 : 200, {
        ok: agentState.mode === "ready" || agentState.mode === "polling",
        mode: agentState.mode,
        tokenConfigured: agentState.tokenConfigured,
        printerConfigured: agentState.printerConfigured,
      });
      return;
    }

    if (url.pathname === "/status") {
      sendJson(response, 200, agentState);
      return;
    }

    sendHtml(response, renderDashboard(agentConfig, agentState));
  });

  server.listen(agentConfig.healthPort, agentConfig.healthHost);
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

function renderDashboard(agentConfig: AgentConfig, agentState: AgentState): string {
  return `<!doctype html><html lang="uz"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MAZETTO Print Agent</title><style>body{margin:0;font-family:Arial,sans-serif;background:#005b57;color:#062b2a}.wrap{max-width:920px;margin:36px auto;padding:20px}.card{background:#f7f7f2;border:1px solid #d7e5df;border-radius:18px;padding:24px;box-shadow:0 18px 50px #002d2a66}.k{color:#007d75;font-weight:800;text-transform:uppercase;font-size:12px}.h{font-size:34px;font-weight:900;margin:8px 0 18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.box{background:#fff;border:1px solid #dbe7e2;border-radius:14px;padding:14px}.v{font-weight:800;margin-top:6px}.ok{color:#007d75}.bad{color:#a83b32}.muted{color:#5f7470}code{word-break:break-all}</style><body><main class="wrap"><section class="card"><div class="k">Chek printeri</div><div class="h">MAZETTO Print Agent</div><div class="grid"><div class="box"><div class="k">Holat</div><div class="v ${agentState.mode === "ready" || agentState.mode === "polling" ? "ok" : "bad"}">${agentState.mode}</div></div><div class="box"><div class="k">Printer</div><div class="v">${agentConfig.dryRun ? "Dry-run" : agentConfig.mode}</div></div><div class="box"><div class="k">Kutayotgan chek</div><div class="v">${agentState.pendingCount}</div></div><div class="box"><div class="k">Chop etildi</div><div class="v">${agentState.printedCount}</div></div><div class="box"><div class="k">Xato</div><div class="v">${agentState.failedCount}</div></div></div><p class="muted">Oxirgi chek: ${escapeHtml(agentState.lastReceipt ?? "yo'q")}</p><p class="muted">${escapeHtml(agentState.lastError ?? "Xato yo'q")}</p><p><code>${escapeHtml(agentConfig.apiUrl)}</code></p></section></main></body></html>`;
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
    healthPort: readPositiveInt(process.env.MAZETTO_PRINT_HEALTH_PORT, 7357),
    healthHost: process.env.MAZETTO_PRINT_HEALTH_HOST?.trim() || "0.0.0.0",
  };
}

function requiredUrl(value: string): string {
  return value.replace(/\/+$/, "");
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

function keepAlive(): Promise<never> {
  return new Promise(() => undefined);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
}
