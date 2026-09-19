import { Socket } from "node:net";

type PrintJob = { id: string; receiptId: string; leaseToken: string };
type Receipt = { receiptNumber: string; escpos?: { commands: Array<Record<string, unknown>> } };

export type DesktopPrintWorkerOptions = {
  apiUrl: string;
  printerHost: string | null;
  printerPort?: number;
  agentId: string;
  fetchImpl?: typeof fetch;
};

/** Desktop owns a single outbound printer worker; it never exposes the printer to the internet. */
export class DesktopPrintWorker {
  private readonly apiUrl: string;
  private readonly printerHost: string | null;
  private readonly printerPort: number;
  private readonly agentId: string;
  private readonly fetchImpl: typeof fetch;
  private authorization: string | null = null;
  private running = false;

  constructor(options: DesktopPrintWorkerOptions) {
    this.apiUrl = options.apiUrl.replace(/\/+$/, "");
    this.printerHost = options.printerHost;
    this.printerPort = options.printerPort ?? 9100;
    this.agentId = options.agentId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  setAuthorization(value: string | undefined): void {
    this.authorization = value?.startsWith("Bearer ") ? value : null;
  }

  async tick(): Promise<void> {
    if (this.running || !this.authorization || !this.printerHost) return;
    this.running = true;
    try {
      const job = await this.request<PrintJob | null>("/receipts/print-jobs/claim", { method: "POST", body: JSON.stringify({ agentId: this.agentId }) });
      if (!job) return;
      try {
        const receipt = await this.request<Receipt>(`/receipts/${encodeURIComponent(job.receiptId)}`);
        await this.send(receipt.escpos?.commands ?? []);
        await this.request(`/receipts/print-jobs/${encodeURIComponent(job.id)}/complete`, { method: "POST", body: JSON.stringify({ leaseToken: job.leaseToken }) });
      } catch (error) {
        await this.request(`/receipts/print-jobs/${encodeURIComponent(job.id)}/fail`, { method: "POST", body: JSON.stringify({ leaseToken: job.leaseToken, error: message(error) }) }).catch(() => undefined);
      }
    } finally { this.running = false; }
  }

  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.apiUrl}${path}`, { ...init, headers: { Accept: "application/json", Authorization: this.authorization ?? "", "Content-Type": "application/json", ...init.headers } });
    if (!response.ok) throw new Error(`Printer API ${response.status}`);
    const body = await response.json() as T | { data: T };
    return body && typeof body === "object" && "data" in body ? body.data : body as T;
  }

  private async send(commands: Array<Record<string, unknown>>): Promise<void> {
    const payload = Buffer.from(commands.map((command) => command.type === "text" ? String(command.value ?? "") + "\n" : command.type === "line" ? "------------------------------\n" : command.type === "cut" ? "\x1dV\x00" : "").join(""), "utf8");
    await new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      socket.once("error", reject);
      socket.connect(this.printerPort, this.printerHost!, () => socket.end(payload, resolve));
    });
  }
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }