import { Socket } from "node:net";

type PrinterMetadata = { host?: unknown; port?: unknown };
type PrinterConfig = {
  id: string;
  name?: string;
  isActive?: boolean;
  status?: string;
  metadata?: PrinterMetadata | null;
};

export type ManagedPrinter = {
  id: string;
  name: string;
  host: string;
  port: number;
};

export type PrinterConnectionResult = ManagedPrinter & {
  ok: boolean;
  message: string | null;
};
type PrintJob = {
  id: string;
  receiptId: string;
  leaseToken: string;
  printer?: { id: string; name: string; metadata?: PrinterMetadata | null } | null;
};
type Receipt = { receiptNumber: string; escpos?: { commands: Array<Record<string, unknown>> } };

export type DesktopPrintWorkerOptions = {
  apiUrl: string;
  printerHost: string | null;
  printerPort?: number;
  agentId: string;
  deviceId: string;
  deviceToken?: string | null;
  fetchImpl?: typeof fetch;
  socketImpl?: (host: string, port: number, payload?: Buffer) => Promise<void>;
};

/** Desktop owns outbound printer connections; printer endpoints are never exposed by the API. */
export class DesktopPrintWorker {
  private readonly apiUrl: string;
  private printerHost: string | null;
  private printerPort: number;
  private readonly agentId: string;
  private readonly deviceId: string;
  private deviceToken: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly socketImpl?: DesktopPrintWorkerOptions["socketImpl"];
  private authorization: string | null = null;
  private running = false;
  private managedPrinters = 0;
  private managedPrinterDetails: ManagedPrinter[] = [];

  constructor(options: DesktopPrintWorkerOptions) {
    this.apiUrl = options.apiUrl.replace(/\/+$/, "");
    this.printerHost = options.printerHost;
    this.printerPort = options.printerPort ?? 9100;
    this.agentId = options.agentId;
    this.deviceId = options.deviceId;
    this.deviceToken = options.deviceToken ?? null;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.socketImpl = options.socketImpl;
  }

  configure(printerHost: string | null, printerPort: number): void {
    this.printerHost = printerHost;
    this.printerPort = printerPort;
  }

  status(): { configured: boolean; host: string | null; port: number; managedPrinters: number; managedPrinterDetails: ManagedPrinter[] } {
    return {
      configured: Boolean(this.printerHost) || this.managedPrinters > 0,
      host: this.printerHost,
      port: this.printerPort,
      managedPrinters: this.managedPrinters,
      managedPrinterDetails: this.managedPrinterDetails.map((printer) => ({ ...printer })),
    };
  }

  setAuthorization(value: string | undefined): void {
    this.authorization = value?.startsWith("Bearer ") ? value : null;
  }

  setDeviceToken(value: string | null): void {
    this.deviceToken = value;
  }

  async tick(): Promise<void> {
    if (this.running || !this.authorization) return;
    this.running = true;
    try {
      const readyPrinters = await this.discoverReadyPrinters();
      if (readyPrinters.length === 0 && !this.printerHost) return;
      const job = await this.request<PrintJob | null>("/receipts/print-jobs/claim", {
        method: "POST",
        body: JSON.stringify({
          agentId: this.agentId,
          printerIds: readyPrinters.map((printer) => printer.id),
          acceptUnassigned: Boolean(this.printerHost),
        }),
      });
      if (!job) return;
      try {
        const receipt = await this.request<Receipt>(`/receipts/${encodeURIComponent(job.receiptId)}`);
        const metadata = job.printer?.metadata ?? {};
        const host = typeof metadata.host === "string" && metadata.host.trim() ? metadata.host.trim() : this.printerHost;
        const port = typeof metadata.port === "number" && Number.isInteger(metadata.port) ? metadata.port : this.printerPort;
        if (!host) throw new Error("Printer manzili sozlanmagan");
        await this.send(receipt.escpos?.commands ?? [], host, port);
        await this.request(`/receipts/print-jobs/${encodeURIComponent(job.id)}/complete`, {
          method: "POST",
          body: JSON.stringify({ leaseToken: job.leaseToken }),
        });
      } catch (error) {
        await this.request(`/receipts/print-jobs/${encodeURIComponent(job.id)}/fail`, {
          method: "POST",
          body: JSON.stringify({ leaseToken: job.leaseToken, error: message(error) }),
        }).catch(() => undefined);
      }
    } finally {
      this.running = false;
    }
  }

  async testConnection(): Promise<void> {
    if (!this.printerHost) throw new Error("Printer manzili kiritilmagan");
    await this.openSocket(this.printerHost, this.printerPort, undefined);
  }

  async testManagedConnections(): Promise<PrinterConnectionResult[]> {
    const printers = this.authorization
      ? await this.discoverReadyPrinters()
      : this.managedPrinterDetails;

    if (printers.length === 0) {
      if (!this.printerHost) {
        throw new Error("Faol printer topilmadi");
      }
      await this.openSocket(this.printerHost, this.printerPort, undefined);
      return [{
        id: "fallback",
        name: "Lokal zaxira printer",
        host: this.printerHost,
        port: this.printerPort,
        ok: true,
        message: null,
      }];
    }

    return Promise.all(
      printers.map(async (printer) => {
        try {
          await this.openSocket(printer.host, printer.port, undefined);
          return { ...printer, ok: true, message: null };
        } catch (error) {
          return { ...printer, ok: false, message: message(error) };
        }
      }),
    );
  }

  private async discoverReadyPrinters(): Promise<ManagedPrinter[]> {
    const printers = await this.request<PrinterConfig[]>("/printers");
    const readyPrinters = printers.flatMap((printer) => {
      const host = printer.metadata?.host;
      if (
        printer.isActive === false ||
        printer.status !== "ONLINE" ||
        typeof host !== "string" ||
        !host.trim()
      ) {
        return [];
      }
      const rawPort = printer.metadata?.port;
      const port =
        typeof rawPort === "number" && Number.isInteger(rawPort)
          ? rawPort
          : this.printerPort;
      return [{
        id: printer.id,
        name: printer.name?.trim() || "Printer",
        host: host.trim(),
        port,
      }];
    });
    this.managedPrinterDetails = readyPrinters;
    this.managedPrinters = readyPrinters.length;
    return readyPrinters;
  }

  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.apiUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: this.authorization ?? "",
        "Content-Type": "application/json",
        "x-mazetto-device-id": this.deviceId,
        ...(this.deviceToken
          ? { "x-mazetto-device-token": this.deviceToken }
          : {}),
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error(`Printer API ${response.status}`);
    const body = await response.json() as T | { data: T };
    return body && typeof body === "object" && "data" in body ? body.data : body as T;
  }

  private async send(commands: Array<Record<string, unknown>>, host: string, port: number): Promise<void> {
    const payload = Buffer.concat([Buffer.from("\x1b@", "binary"), ...commands.map((command) => this.encodeCommand(command))]);
    await this.openSocket(host, port, payload);
  }

  private encodeCommand(command: Record<string, unknown>): Buffer {
    const type = String(command.type ?? "");
    if (type === "align") {
      const value = command.value === "center" ? 1 : command.value === "right" ? 2 : 0;
      return Buffer.from([0x1b, 0x61, value]);
    }
    if (type === "bold") return Buffer.from([0x1b, 0x45, command.value ? 1 : 0]);
    if (type === "line") return Buffer.from("------------------------------\n", "utf8");
    if (type === "cut") return Buffer.from([0x1d, 0x56, 0x00]);
    if (type === "item") return Buffer.from(`${String(command.quantity ?? "")}x ${String(command.name ?? "")}  ${String(command.total ?? "")}\n`, "utf8");
    if (type === "payment") return Buffer.from(`${String(command.method ?? "To'lov")}: ${String(command.amount ?? "")}\n`, "utf8");
    if (type === "total") return Buffer.from(`JAMI: ${String(command.value ?? "")}\n`, "utf8");
    return Buffer.from(`${String(command.value ?? "")}\n`, "utf8");
  }

  private async openSocket(host: string, port: number, payload: Buffer | undefined): Promise<void> {
    if (this.socketImpl) {
      await this.socketImpl(host, port, payload);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      const timer = setTimeout(() => { socket.destroy(); reject(new Error("Printer 5 soniyada javob bermadi")); }, 5_000);
      socket.once("error", (error) => { clearTimeout(timer); reject(error); });
      socket.connect(port, host, () => {
        clearTimeout(timer);
        if (payload) socket.end(payload, resolve);
        else socket.end(resolve);
      });
    });
  }
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
