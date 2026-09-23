import { Socket } from "node:net";
import type { LocalPrintJob } from "./store.js";

type PrinterMetadata = { host?: unknown; port?: unknown; printRoles?: unknown };
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

export type SystemPrinterTarget = {
  name: string;
  displayName: string;
  roles: string[];
};

export type PrinterConnectionResult = ManagedPrinter & {
  ok: boolean;
  message: string | null;
};

type PrintJob = {
  id: string;
  receiptId: string;
  leaseToken: string;
  payload?: Record<string, unknown> | null;
  receipt?: {
    receiptNumber?: string;
    documentType?: string;
    orderId?: string;
  } | null;
  printer?: { id: string; name: string; metadata?: PrinterMetadata | null } | null;
};

export type PrintableReceipt = {
  receiptNumber?: string;
  orderId?: string;
  documentType?: string;
  content?: Record<string, unknown> | null;
  escpos?: { commands: Array<Record<string, unknown>> };
};

type LocalPrintQueue = {
  claim: (documentTypes: string[]) => LocalPrintJob | null;
  complete: (id: string) => void;
  fail: (id: string, error: string) => void;
  wasPrinted: (serverOrderId: string, documentType: string) => boolean;
};

export type DesktopPrintWorkerOptions = {
  apiUrl: string;
  printerHost: string | null;
  printerPort?: number;
  agentId: string;
  deviceId: string;
  deviceToken?: string | null;
  systemPrinters?: SystemPrinterTarget[];
  printSystem?: (deviceName: string, receipt: PrintableReceipt) => Promise<void>;
  localQueue?: LocalPrintQueue;
  fetchImpl?: typeof fetch;
  socketImpl?: (host: string, port: number, payload?: Buffer) => Promise<void>;
};

/** Claims each durable job once and dispatches it through a Windows driver or ESC/POS TCP. */
export class DesktopPrintWorker {
  private readonly apiUrl: string;
  private printerHost: string | null;
  private printerPort: number;
  private readonly agentId: string;
  private readonly deviceId: string;
  private deviceToken: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly socketImpl?: DesktopPrintWorkerOptions["socketImpl"];
  private readonly printSystem?: DesktopPrintWorkerOptions["printSystem"];
  private readonly localQueue: LocalPrintQueue | undefined;
  private authorization: string | null = null;
  private running = false;
  private managedPrinters = 0;
  private managedPrinterDetails: ManagedPrinter[] = [];
  private localAssignedPrinterIds: string[] = [];
  private systemPrinters: SystemPrinterTarget[];
  private printerDiscoveryCache: {
    expiresAt: number;
    readyPrinters: ManagedPrinter[];
    localAssignedPrinterIds: string[];
  } | null = null;

  constructor(options: DesktopPrintWorkerOptions) {
    this.apiUrl = options.apiUrl.replace(/\/+$/, "");
    this.printerHost = options.printerHost;
    this.printerPort = options.printerPort ?? 9100;
    this.agentId = options.agentId;
    this.deviceId = options.deviceId;
    this.deviceToken = options.deviceToken ?? null;
    this.systemPrinters = options.systemPrinters ?? [];
    this.printSystem = options.printSystem;
    this.localQueue = options.localQueue;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.socketImpl = options.socketImpl;
  }

  configure(printerHost: string | null, printerPort: number): void {
    this.printerHost = printerHost;
    this.printerPort = printerPort;
    this.printerDiscoveryCache = null;
  }

  configureSystemPrinters(printers: SystemPrinterTarget[]): void {
    this.systemPrinters = printers.map((printer) => ({
      ...printer,
      roles: [...new Set(printer.roles)],
    }));
    this.printerDiscoveryCache = null;
  }

  status() {
    return {
      configured: Boolean(this.printerHost) || this.managedPrinters > 0 || this.systemPrinters.length > 0,
      host: this.printerHost,
      port: this.printerPort,
      managedPrinters: this.managedPrinters,
      managedPrinterDetails: this.managedPrinterDetails.map((printer) => ({ ...printer })),
      systemPrinters: this.systemPrinters.map((printer) => ({ ...printer, roles: [...printer.roles] })),
    };
  }

  setAuthorization(value: string | undefined): void {
    this.authorization = value?.startsWith("Bearer ") ? value : null;
  }

  setDeviceToken(value: string | null): void {
    this.deviceToken = value;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (await this.printNextLocalJob()) {
        // Drain locally queued tickets in this pass; polling once per second
        // between every customer and kitchen slip adds avoidable delay.
      }
      if (!this.authorization) return;

      const readyPrinters = await this.discoverReadyPrinters();
      const acceptsUnassigned = Boolean(this.printerHost) || this.systemPrinters.length > 0;
      if (readyPrinters.length === 0 && !acceptsUnassigned) return;
      const job = await this.request<PrintJob | null>("/receipts/print-jobs/claim", {
        method: "POST",
        body: JSON.stringify({
          agentId: this.agentId,
          printerIds: [
            ...readyPrinters.map((printer) => printer.id),
            ...this.localAssignedPrinterIds,
          ],
          acceptUnassigned: acceptsUnassigned,
        }),
      });
      if (!job) return;
      try {
        // Job payloadi chek yaratilgan tranzaksiyaning immutable nusxasi.
        // Uni birinchi ishlatish printerdagi ishni keyingi GET so'rovidan
        // mustaqil qiladi: chek ekrani yoki vaqtinchalik API xatosi sabab
        // bo'sh sahifa chop etilmaydi.
        const receipt = printableReceiptFromJob(job) ?? await this.request<PrintableReceipt>(`/receipts/${encodeURIComponent(job.receiptId)}`);
        const route = receiptRoute(receipt);
        if (
          receipt.orderId &&
          this.localQueue?.wasPrinted(receipt.orderId, route)
        ) {
          await this.completeServerJob(job);
          return;
        }
        assertPrintableReceipt(receipt);

        const metadata = job.printer?.metadata ?? {};
        const host = typeof metadata.host === "string" && metadata.host.trim()
          ? metadata.host.trim()
          : null;
        const systemTargets = this.systemPrinters.filter((printer) => printer.roles.includes(route));
        if (host) {
          const port = typeof metadata.port === "number" && Number.isInteger(metadata.port)
            ? metadata.port
            : this.printerPort;
          await this.send(receipt.escpos?.commands ?? [], host, port);
        } else if (systemTargets.length > 0 && this.printSystem) {
          for (const target of systemTargets) {
            await this.printSystem(target.name, receipt);
          }
        } else if (this.printerHost) {
          await this.send(receipt.escpos?.commands ?? [], this.printerHost, this.printerPort);
        } else {
          throw new Error(`${route} uchun lokal printer tanlanmagan`);
        }
        await this.completeServerJob(job);
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
    const printers = this.authorization ? await this.discoverReadyPrinters() : this.managedPrinterDetails;
    if (printers.length === 0) {
      if (!this.printerHost) throw new Error("Faol IP printer topilmadi");
      await this.openSocket(this.printerHost, this.printerPort, undefined);
      return [{ id: "fallback", name: "Lokal zaxira printer", host: this.printerHost, port: this.printerPort, ok: true, message: null }];
    }
    return Promise.all(printers.map(async (printer) => {
      try {
        await this.openSocket(printer.host, printer.port, undefined);
        return { ...printer, ok: true, message: null };
      } catch (error) {
        return { ...printer, ok: false, message: message(error) };
      }
    }));
  }

  private async printNextLocalJob(): Promise<boolean> {
    if (!this.localQueue || !this.printSystem || this.systemPrinters.length === 0) return false;
    const roles = [...new Set(this.systemPrinters.flatMap((printer) => printer.roles))];
    const job = this.localQueue.claim(roles);
    if (!job) return false;
    try {
      const content = JSON.parse(job.payloadJson) as Record<string, unknown>;
      const targets = this.systemPrinters.filter((printer) => printer.roles.includes(job.documentType));
      if (targets.length === 0) throw new Error(`${job.documentType} uchun printer tanlanmagan`);
      const receipt: PrintableReceipt = {
        receiptNumber: `OFFLINE-${job.id.slice(0, 8).toUpperCase()}`,
        ...(typeof content.orderId === "string" ? { orderId: content.orderId } : {}),
        documentType: job.documentType,
        content,
      };
      for (const target of targets) await this.printSystem(target.name, receipt);
      this.localQueue.complete(job.id);
    } catch (error) {
      this.localQueue.fail(job.id, message(error));
    }
    return true;
  }

  private async completeServerJob(job: PrintJob): Promise<void> {
    await this.request(`/receipts/print-jobs/${encodeURIComponent(job.id)}/complete`, {
      method: "POST",
      body: JSON.stringify({ leaseToken: job.leaseToken }),
    });
  }

  private async discoverReadyPrinters(): Promise<ManagedPrinter[]> {
    const now = Date.now();
    if (this.printerDiscoveryCache && this.printerDiscoveryCache.expiresAt > now) {
      this.localAssignedPrinterIds = [
        ...this.printerDiscoveryCache.localAssignedPrinterIds,
      ];
      this.managedPrinterDetails = this.printerDiscoveryCache.readyPrinters.map(
        (printer) => ({ ...printer }),
      );
      this.managedPrinters = this.managedPrinterDetails.length;
      return this.managedPrinterDetails;
    }

    const printers = await this.request<PrinterConfig[]>("/printers");
    const localRoles = new Set(this.systemPrinters.flatMap((printer) => printer.roles));
    this.localAssignedPrinterIds = printers.flatMap((printer) => {
      const roles = Array.isArray(printer.metadata?.printRoles)
        ? printer.metadata.printRoles.filter((role): role is string => typeof role === "string")
        : [];
      const hasHost = typeof printer.metadata?.host === "string" && printer.metadata.host.trim();
      return printer.isActive !== false &&
        printer.status === "ONLINE" &&
        !hasHost &&
        roles.some((role) => localRoles.has(role))
        ? [printer.id]
        : [];
    });
    const readyPrinters = printers.flatMap((printer) => {
      const host = printer.metadata?.host;
      if (printer.isActive === false || printer.status !== "ONLINE" || typeof host !== "string" || !host.trim()) return [];
      const rawPort = printer.metadata?.port;
      return [{
        id: printer.id,
        name: printer.name?.trim() || "Printer",
        host: host.trim(),
        port: typeof rawPort === "number" && Number.isInteger(rawPort) ? rawPort : this.printerPort,
      }];
    });
    this.managedPrinterDetails = readyPrinters;
    this.managedPrinters = readyPrinters.length;
    this.printerDiscoveryCache = {
      expiresAt: now + 10_000,
      readyPrinters: readyPrinters.map((printer) => ({ ...printer })),
      localAssignedPrinterIds: [...this.localAssignedPrinterIds],
    };
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
        ...(this.deviceToken ? { "x-mazetto-device-token": this.deviceToken } : {}),
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
    if (type === "align") return Buffer.from([0x1b, 0x61, command.value === "center" ? 1 : command.value === "right" ? 2 : 0]);
    if (type === "bold") return Buffer.from([0x1b, 0x45, command.value ? 1 : 0]);
    if (type === "line") return Buffer.from("------------------------------------------\n", "utf8");
    if (type === "cut") return Buffer.from([0x1d, 0x56, 0x00]);
    if (type === "item") {
      const lines = [`${String(command.quantity ?? "")}x ${String(command.name ?? "")}  ${String(command.total ?? "")}`];
      if (command.notes) lines.push(`  Izoh: ${String(command.notes)}`);
      for (const modifier of modifierNames(command.modifiers)) lines.push(`  + ${modifier}`);
      return Buffer.from(`${lines.join("\n")}\n`, "utf8");
    }
    if (type === "payment") return Buffer.from(`${String(command.method ?? "To'lov")}: ${String(command.amount ?? "")}\n`, "utf8");
    if (type === "total") return Buffer.from(`JAMI: ${String(command.value ?? "")}\n`, "utf8");
    return Buffer.from(`${String(command.value ?? "")}\n`, "utf8");
  }

  private async openSocket(host: string, port: number, payload: Buffer | undefined): Promise<void> {
    if (this.socketImpl) return this.socketImpl(host, port, payload);
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

function receiptRoute(receipt: PrintableReceipt): string {
  const contentType = receipt.content?.documentType;
  if (typeof contentType === "string") return contentType.startsWith("REFUND") ? "REFUND" : contentType;
  if (typeof receipt.documentType === "string") return receipt.documentType.startsWith("REFUND") ? "REFUND" : receipt.documentType;
  return "RECEIPT";
}

function printableReceiptFromJob(job: PrintJob): PrintableReceipt | null {
  if (!job.payload || typeof job.payload !== "object" || Array.isArray(job.payload)) {
    return null;
  }
  const documentType = typeof job.payload.documentType === "string"
    ? job.payload.documentType
    : job.receipt?.documentType;
  if (!documentType) return null;
  return {
    ...(job.receipt?.receiptNumber ? { receiptNumber: job.receipt.receiptNumber } : {}),
    ...(job.receipt?.orderId ? { orderId: job.receipt.orderId } : {}),
    documentType,
    content: job.payload,
  };
}

function assertPrintableReceipt(receipt: PrintableReceipt): void {
  // TCP ESC/POS printerlari backend tuzgan buyruqlarni ishlatadi; ular uchun
  // HTML snapshot shart emas.
  if (Array.isArray(receipt.escpos?.commands) && receipt.escpos.commands.length > 0) {
    return;
  }
  const content = receipt.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new Error("Chek mazmuni topilmadi; chop etish navbatda qoldirildi");
  }
  const documentType = receiptRoute(receipt);
  const hasOrder = typeof content.orderNumber === "string" ||
    typeof content.displayOrderNumber === "string";
  const items = content.items;
  const hasItems = Array.isArray(items) && items.length > 0;
  if (!hasOrder || (!hasItems && documentType !== "REFUND")) {
    throw new Error("Chek mazmuni to'liq emas; bo'sh sahifa chop etilmadi");
  }
}

function modifierNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = record.name ?? record.modifierName;
    return typeof name === "string" && name.trim() ? [name.trim()] : [];
  });
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
