export type PrintRoute = "RECEIPT" | "KITCHEN" | "CANCELLATION" | "REFUND";
type PrinterMode = "stdout" | "file" | "tcp";

export type ReceiptSummary = {
  id: string;
  receiptNumber: string;
  printed: boolean;
  createdAt: string;
  branch?: { id: string; name: string; code: string };
  order?: {
    orderNumber: string;
    displayOrderNumber: string | null;
    status: string;
  };
};

export type ReceiptDetail = ReceiptSummary & {
  escpos?: {
    encoding: string;
    commands: Array<Record<string, unknown>>;
  };
};

export type PrintJob = { id: string; receiptId: string; leaseToken: string };

export type PrintQueueConfig = {
  agentId: string;
  branchId: string | null;
  printerIds: string[];
  acceptUnassigned: boolean;
  unassignedRoutes: PrintRoute[];
  mode: PrinterMode;
};

export type PrintQueueState = {
  mode: "idle" | "polling" | "ready" | "degraded";
  pendingCount: number;
  printedCount: number;
  failedCount: number;
  lastPrintedAt: string | null;
  lastReceipt: string | null;
  lastError: string | null;
  pollingHalted?: boolean;
};

export type AgentRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
export type PrintReceipt = (receipt: ReceiptDetail) => Promise<void>;

export class AmbiguousPrintError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AmbiguousPrintError";
  }
}

export function hasPrintQueueTarget(config: PrintQueueConfig): boolean {
  return (
    config.printerIds.length > 0 ||
    (config.acceptUnassigned && config.unassignedRoutes.length > 0)
  );
}

export async function pollPrintJob(
  config: PrintQueueConfig,
  state: PrintQueueState,
  request: AgentRequest,
  printReceipt: PrintReceipt,
): Promise<void> {
  state.mode = "polling";
  if (!hasPrintQueueTarget(config)) {
    state.pendingCount = 0;
    state.mode = "degraded";
    state.lastError =
      "Configure MAZETTO_PRINT_PRINTER_IDS or explicit unassigned print routes";
    return;
  }

  const query = config.branchId
    ? `?branchId=${encodeURIComponent(config.branchId)}`
    : "";
  const job = await request<PrintJob | null>(
    `/receipts/print-jobs/claim${query}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: config.agentId,
        printerIds: config.printerIds,
        acceptUnassigned: config.acceptUnassigned,
        unassignedRoutes: config.unassignedRoutes,
      }),
    },
  );

  state.pendingCount = job ? 1 : 0;
  if (!job) {
    state.mode = "ready";
    state.lastError = null;
    return;
  }

  let outputCompleted = false;
  try {
    const receipt = await request<ReceiptDetail>(
      `/receipts/${encodeURIComponent(job.receiptId)}`,
    );
    await printReceipt(receipt);
    outputCompleted = true;
    await request(
      `/receipts/print-jobs/${encodeURIComponent(job.id)}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaseToken: job.leaseToken }),
      },
    );
    state.printedCount += 1;
    state.lastPrintedAt = new Date().toISOString();
    state.lastReceipt = receipt.receiptNumber;
    state.lastError = null;
    state.mode = "ready";
  } catch (error) {
    const message = errorMessage(error);
    const outcome =
      error instanceof AmbiguousPrintError ||
      (outputCompleted && config.mode === "tcp")
        ? "AMBIGUOUS"
        : "FAILED";
    let outcomeSaved = true;
    await request(`/receipts/print-jobs/${encodeURIComponent(job.id)}/fail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leaseToken: job.leaseToken,
        error: message,
        outcome,
      }),
    }).catch(() => {
      outcomeSaved = false;
    });
    state.failedCount += 1;
    state.lastError = outcomeSaved
      ? message
      : `${message}; print outcome could not be saved, inspect paper and queue before retrying`;
    if (!outcomeSaved && outcome === "AMBIGUOUS") {
      state.pollingHalted = true;
    }
    state.mode = "degraded";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
