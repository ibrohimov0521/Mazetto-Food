import { Socket } from "node:net";
import type { LocalPrintJob } from "./store.js";
import {
  isPrintOutcomeUnknown,
  PrintOutcomeUnknownError,
  withTimeout,
} from "./print-errors.js";
import {
  normalizeWindowsPaperSettings,
  type WindowsPaperFormat,
  type WindowsPaperSettings,
} from "./receipt-renderer.js";

type PrinterMetadata = {
  host?: unknown;
  port?: unknown;
  printRoles?: unknown;
  paperWidthMm?: unknown;
};
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
  paperWidthMm?: number;
  paperFormat?: WindowsPaperFormat;
  paperHeightMm?: number;
};

export type PrinterConnectionResult = ManagedPrinter & {
  ok: boolean;
  message: string | null;
};

type PrintJob = {
  id: string;
  receiptId: string;
  leaseToken: string;
  allowAmbiguousRetry?: boolean;
  payload?: Record<string, unknown> | null;
  receipt?: {
    receiptNumber?: string;
    documentType?: string;
    orderId?: string;
  } | null;
  printer?: {
    id: string;
    name: string;
    metadata?: PrinterMetadata | null;
  } | null;
};
const ALLOW_LOCAL_REPRINT_KEY = "__bestteamAllowLocalReprint";

export type PrintableReceipt = {
  receiptNumber?: string;
  orderId?: string;
  documentType?: string;
  content?: Record<string, unknown> | null;
  escpos?: { commands: Array<Record<string, unknown>> };
};
type LocalPrintQueue = {
  claim: (documentTypes: string[]) => LocalPrintJob | null;
  complete: (id: string, attemptId?: string) => void;
  fail: (
    id: string,
    error: string,
    ambiguous?: boolean,
    attemptId?: string,
  ) => void;
  markPrinting?: (id: string) => string | boolean | void;
  wasPrinted: (
    serverOrderId: string,
    documentType: string,
    printerName?: string,
  ) => boolean;
  wasAmbiguousLocallyOn?: (
    serverOrderId: string,
    documentType: string,
    printerName: string,
  ) => boolean;
  wasTargetPrinted?: (
    scope: "local" | "server",
    jobId: string,
    printerName: string,
  ) => boolean;
  wasTargetAmbiguous?: (
    scope: "local" | "server",
    jobId: string,
    printerName: string,
  ) => boolean;
  markTargetPrinted?: (
    scope: "local" | "server",
    jobId: string,
    printerName: string,
  ) => void;
  markTargetAmbiguous?: (
    scope: "local" | "server",
    jobId: string,
    printerName: string,
  ) => void;
  clearTargetAmbiguous?: (
    scope: "local" | "server",
    jobId: string,
    printerName: string,
  ) => void;
};

export type DesktopPrintWorkerOptions = {
  apiUrl: string;
  printerHost: string | null;
  printerPort?: number;
  agentId: string;
  deviceId: string;
  deviceToken?: string | null;
  systemPrinters?: SystemPrinterTarget[];
  printSystem?: (
    deviceName: string,
    receipt: PrintableReceipt,
    paperSettings?: WindowsPaperSettings,
  ) => Promise<void>;
  localQueue?: LocalPrintQueue;
  onError?: (error: unknown) => void;
  fetchImpl?: typeof fetch;
  socketImpl?: (host: string, port: number, payload?: Buffer) => Promise<void>;
  requestTimeoutMs?: number;
  printTimeoutMs?: number;
};

const MAX_LOCAL_PRINT_JOBS_PER_TICK = 5;
const MAX_SERVER_PRINT_JOBS_PER_TICK = 5;
const MAX_CONCURRENT_PRINTER_TARGETS = 4;
const SERVER_REQUEST_TIMEOUT_MS = 5_000;
const PRINTER_OPERATION_TIMEOUT_MS = 45_000;
const SERVER_RETRY_BASE_MS = 1_000;
const SERVER_RETRY_MAX_MS = 30_000;
const LOCAL_QUEUE_RETRY_BASE_MS = 1_000;
const LOCAL_QUEUE_RETRY_MAX_MS = 30_000;

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
  private readonly onError: DesktopPrintWorkerOptions["onError"];
  private readonly requestTimeoutMs: number;
  private readonly printTimeoutMs: number;
  private authorization: string | null = null;
  private running = false;
  private stopping = false;
  private activeTick: Promise<void> | null = null;
  private managedPrinters = 0;
  private managedPrinterDetails: ManagedPrinter[] = [];
  private localAssignedPrinterGroups: string[][] = [];
  private systemPrinters: SystemPrinterTarget[];
  private printerDiscoveryCache: {
    expiresAt: number;
    readyPrinters: ManagedPrinter[];
    localAssignedPrinterGroups: string[][];
  } | null = null;
  private serverRetryAt = 0;
  private serverFailureCount = 0;
  private localQueueRetryAt = 0;
  private localQueueFailureCount = 0;

  constructor(options: DesktopPrintWorkerOptions) {
    this.apiUrl = options.apiUrl.replace(/\/+$/, "");
    this.printerHost = options.printerHost;
    this.printerPort = options.printerPort ?? 9100;
    this.agentId = options.agentId;
    this.deviceId = options.deviceId;
    this.deviceToken = options.deviceToken ?? null;
    this.systemPrinters = (options.systemPrinters ?? []).map((printer) => ({
      ...printer,
      ...normalizeWindowsPaperSettings(printer),
      roles: [...new Set(printer.roles)],
    }));
    this.printSystem = options.printSystem;
    this.localQueue = options.localQueue;
    this.onError = options.onError;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.socketImpl = options.socketImpl;
    this.requestTimeoutMs =
      options.requestTimeoutMs ?? SERVER_REQUEST_TIMEOUT_MS;
    this.printTimeoutMs =
      options.printTimeoutMs ?? PRINTER_OPERATION_TIMEOUT_MS;
  }

  configure(printerHost: string | null, printerPort: number): void {
    this.printerHost = printerHost;
    this.printerPort = printerPort;
    this.printerDiscoveryCache = null;
  }

  configureSystemPrinters(printers: SystemPrinterTarget[]): void {
    this.systemPrinters = printers.map((printer) => ({
      ...printer,
      ...normalizeWindowsPaperSettings(printer),
      roles: [...new Set(printer.roles)],
    }));
    this.printerDiscoveryCache = null;
  }

  status() {
    return {
      configured:
        Boolean(this.printerHost) ||
        this.managedPrinters > 0 ||
        this.systemPrinters.length > 0,
      host: this.printerHost,
      port: this.printerPort,
      managedPrinters: this.managedPrinters,
      managedPrinterDetails: this.managedPrinterDetails.map((printer) => ({
        ...printer,
      })),
      systemPrinters: this.systemPrinters.map((printer) => ({
        ...printer,
        roles: [...printer.roles],
      })),
    };
  }

  setAuthorization(value: string | undefined): void {
    this.authorization = value?.startsWith("Bearer ") ? value : null;
  }

  setDeviceToken(value: string | null): void {
    this.deviceToken = value;
  }

  async tick(): Promise<void> {
    if (this.running || this.stopping) return;
    this.running = true;
    const activeTick = this.performTick();
    this.activeTick = activeTick;
    try {
      await activeTick;
    } finally {
      if (this.activeTick === activeTick) this.activeTick = null;
      this.running = false;
    }
  }

  async stop(): Promise<void> {
    this.stopping = true;
    await this.activeTick?.catch(() => undefined);
  }

  private async performTick(): Promise<void> {
    for (let index = 0; index < MAX_LOCAL_PRINT_JOBS_PER_TICK; index += 1) {
      if (this.stopping) break;
      if (Date.now() < this.localQueueRetryAt) return;
      try {
        if (!(await this.printNextLocalJob())) {
          this.localQueueFailureCount = 0;
          this.localQueueRetryAt = 0;
          break;
        }
        this.localQueueFailureCount = 0;
        this.localQueueRetryAt = 0;
      } catch (error) {
        this.deferLocalQueuePolling();
        this.onError?.(error);
        return;
      }
    }
    if (this.stopping || !this.authorization) return;
    if (Date.now() < this.serverRetryAt) return;

    try {
      const readyPrinters = await this.discoverReadyPrinters();
      const unassignedRoutes =
        this.systemPrinters.length > 0
          ? [
              ...new Set(
                this.systemPrinters.flatMap((printer) => printer.roles),
              ),
            ].filter((role) =>
              ["RECEIPT", "KITCHEN", "CANCELLATION", "REFUND"].includes(role),
            )
          : this.printerHost
            ? ["RECEIPT", "KITCHEN", "CANCELLATION", "REFUND"]
            : [];
      const acceptsUnassigned = unassignedRoutes.length > 0;
      if (readyPrinters.length === 0 && !acceptsUnassigned) {
        this.resetServerPollingBackoff();
        return;
      }
      const tcpPrinterQueues = new Map<string, string[]>();
      for (const printer of readyPrinters) {
        const queueKey =
          printer.host.toLocaleLowerCase() + ":" + printer.port;
        const queue = tcpPrinterQueues.get(queueKey) ?? [];
        queue.push(printer.id);
        tcpPrinterQueues.set(queueKey, queue);
      }
      const printerQueues = [
        ...tcpPrinterQueues.values(),
        ...this.localAssignedPrinterGroups.map((group) => [...group]),
      ];
      let claimedJobs = 0;
      let reservedClaims = 0;
      let stopClaiming = false;
      let claimError: unknown;
      const claimAndPrint = async (body: {
        printerIds: string[];
        acceptUnassigned: boolean;
        unassignedRoutes: string[];
      }) => {
        while (!stopClaiming && !this.stopping) {
          if (
            claimedJobs + reservedClaims >= MAX_SERVER_PRINT_JOBS_PER_TICK
          ) {
            return;
          }
          reservedClaims += 1;
          let job: PrintJob | null;
          try {
            job = await this.request<PrintJob | null>(
              "/receipts/print-jobs/claim",
              {
                method: "POST",
                body: JSON.stringify({ agentId: this.agentId, ...body }),
              },
            );
          } catch (error) {
            reservedClaims -= 1;
            stopClaiming = true;
            claimError ??= error;
            return;
          }
          reservedClaims -= 1;
          if (!job) return;
          claimedJobs += 1;
          if (!(await this.printServerJob(job))) {
            stopClaiming = true;
            return;
          }
        }
      };

      // One lane owns each physical queue, even when duplicate config records target it.
      let nextPrinterQueue = 0;
      const drainAssignedPrinters = async () => {
        while (!stopClaiming && nextPrinterQueue < printerQueues.length) {
          const printerIds = printerQueues[nextPrinterQueue++];
          if (!printerIds?.length) continue;
          await claimAndPrint({
            printerIds,
            acceptUnassigned: false,
            unassignedRoutes: [],
          });
        }
      };
      await Promise.all(
        Array.from(
          {
            length: Math.min(
              MAX_CONCURRENT_PRINTER_TARGETS,
              printerQueues.length,
            ),
          },
          () => drainAssignedPrinters(),
        ),
      );
      if (claimError) throw claimError;
      if (stopClaiming) {
        this.deferServerPolling();
        return;
      }
      // Unassigned jobs can fan out to multiple Windows queues, so keep them serial.
      if (acceptsUnassigned) {
        await claimAndPrint({
          printerIds: [],
          acceptUnassigned: true,
          unassignedRoutes,
        });
      }
      if (claimError) throw claimError;
      if (stopClaiming) {
        this.deferServerPolling();
        return;
      }
      this.resetServerPollingBackoff();
    } catch (error) {
      this.deferServerPolling();
      this.onError?.(error);
    }
  }

  private async printServerJob(job: PrintJob): Promise<boolean> {
    let printerMayHaveReceived = false;
    try {
      // Job payloadi chek yaratilgan tranzaksiyaning immutable nusxasi.
      // Uni birinchi ishlatish printerdagi ishni keyingi GET so'rovidan
      // mustaqil qiladi: chek ekrani yoki vaqtinchalik API xatosi sabab
      // bo'sh sahifa chop etilmaydi.
      const receipt =
        printableReceiptFromJob(job) ??
        (await this.request<PrintableReceipt>(
          `/receipts/${encodeURIComponent(job.receiptId)}`,
        ));
      const route = receiptRoute(receipt);

      const metadata = job.printer?.metadata ?? {};
      const host =
        typeof metadata.host === "string" && metadata.host.trim()
          ? metadata.host.trim()
          : null;
      const paperWidthMm = printerPaperWidth(metadata.paperWidthMm);
      if (
        paperWidthMm === 210 &&
        (host ||
          (this.printerHost &&
            !this.systemPrinters.some((printer) =>
              printer.roles.includes(route),
            )))
      ) {
        throw new Error(
          "A4 formatni tarmoq ESC/POS printeri qo'llamaydi; Windows drayveridan foydalaning",
        );
      }
      const systemTargets = host
        ? []
        : selectSystemPrinterTargets(job, route, this.systemPrinters);
      const allowLocalReprint = job.payload?.[ALLOW_LOCAL_REPRINT_KEY] === true;
      const wasPrintedLocallyOn = (printerName: string) =>
        !allowLocalReprint &&
        Boolean(receipt.orderId) &&
        this.localQueue?.wasPrinted(receipt.orderId!, route, printerName) ===
          true;
      const wasAmbiguousLocallyOn = (printerName: string) =>
        !allowLocalReprint &&
        Boolean(receipt.orderId) &&
        this.localQueue?.wasAmbiguousLocallyOn?.(
          receipt.orderId!,
          route,
          printerName,
        ) === true;
      const matchingSystemPrinter =
        host && job.printer
          ? this.systemPrinters.find(
              (printer) =>
                printer.roles.includes(route) &&
                [printer.name, printer.displayName].some(
                  (name) =>
                    name.trim().toLocaleLowerCase() ===
                    job.printer!.name.trim().toLocaleLowerCase(),
                ),
            )
          : undefined;
      if (matchingSystemPrinter && wasPrintedLocallyOn(matchingSystemPrinter.name)) {
        await this.completeServerJob(job);
        return true;
      }
      if (
        matchingSystemPrinter &&
        wasAmbiguousLocallyOn(matchingSystemPrinter.name)
      ) {
        await this.markServerJobDispatching(job);
        throw new PrintOutcomeUnknownError(
          `${matchingSystemPrinter.displayName}: offline chop natijasi noaniq; qog'oz tekshirilmaguncha qayta chiqarilmadi.`,
        );
      }
      const ambiguousLocalTargets = systemTargets.filter((printer) =>
        wasAmbiguousLocallyOn(printer.name),
      );
      const systemTargetsToPrint = systemTargets.filter(
        (printer) =>
          !wasPrintedLocallyOn(printer.name) &&
          !wasAmbiguousLocallyOn(printer.name),
      );
      if (systemTargets.length > 0 && systemTargetsToPrint.length === 0) {
        if (ambiguousLocalTargets.length > 0) {
          await this.markServerJobDispatching(job);
          throw new PrintOutcomeUnknownError(
            `Offline chop natijasi noaniq (${ambiguousLocalTargets.map((target) => target.displayName).join(", ")}); qog'ozni tekshiring.`,
          );
        }
        await this.completeServerJob(job);
        return true;
      }
      assertPrintableReceipt(receipt);
      if (
        paperWidthMm === 210 &&
        (host ||
          (!(systemTargetsToPrint.length > 0 && this.printSystem) &&
            this.printerHost))
      ) {
        throw new Error(
          "A4 formatni tarmoq ESC/POS printeri qo'llamaydi; Windows drayveridan foydalaning",
        );
      }
      if (host) {
        const port =
          typeof metadata.port === "number" && Number.isInteger(metadata.port)
            ? metadata.port
            : this.printerPort;
        const printable = receipt.escpos?.commands?.length
          ? receipt
          : await this.request<PrintableReceipt>(
              "/receipts/" + encodeURIComponent(job.receiptId),
            );
        const commands = printable.escpos?.commands ?? [];
        if (commands.length === 0)
          throw new Error("Chek uchun ESC/POS buyruqlari topilmadi");
        await this.markServerJobDispatching(job);
        printerMayHaveReceived = await this.sendServerTcpTarget(
          job,
          commands,
          host,
          port,
          paperWidthMm,
        );
      } else if (systemTargetsToPrint.length > 0 && this.printSystem) {
        await this.markServerJobDispatching(job);
        printerMayHaveReceived = await this.printSystemTargets(
          "server",
          job.id,
          systemTargetsToPrint,
          receipt,
          job.allowAmbiguousRetry === true,
        );
        if (ambiguousLocalTargets.length > 0) {
          throw new PrintOutcomeUnknownError(
            `Offline chop natijasi noaniq (${ambiguousLocalTargets.map((target) => target.displayName).join(", ")}); qog'ozni tekshiring.`,
          );
        }
      } else if (
        this.printerHost &&
        !job.printer &&
        this.systemPrinters.length === 0
      ) {
        const printable = receipt.escpos?.commands?.length
          ? receipt
          : await this.request<PrintableReceipt>(
              "/receipts/" + encodeURIComponent(job.receiptId),
            );
        const commands = printable.escpos?.commands ?? [];
        if (commands.length === 0)
          throw new Error("Chek uchun ESC/POS buyruqlari topilmadi");
        await this.markServerJobDispatching(job);
        printerMayHaveReceived = await this.sendServerTcpTarget(
          job,
          commands,
          this.printerHost,
          this.printerPort,
          paperWidthMm,
        );
      } else {
        throw new Error(`${route} uchun lokal printer tanlanmagan`);
      }
      await this.completeServerJob(job);
      return true;
    } catch (error) {
      const ambiguous = isPrintOutcomeUnknown(error);
      const printerOutcomeUnknown = ambiguous || printerMayHaveReceived;
      const failure =
        printerMayHaveReceived && !ambiguous
          ? new PrintOutcomeUnknownError(
              `Printer ishni qabul qilgan bo'lishi mumkin, ammo server tasdig'i saqlanmadi. Dublikat chiqmasligi uchun avtomatik qayta chop etish to'xtatildi. ${message(error)}`,
            )
          : error;
      try {
        await this.request(
          `/receipts/print-jobs/${encodeURIComponent(job.id)}/fail`,
          {
            method: "POST",
            body: JSON.stringify({
              leaseToken: job.leaseToken,
              error: message(failure),
              ...(printerOutcomeUnknown ? { outcome: "AMBIGUOUS" } : {}),
            }),
          },
        );
        return true;
      } catch {
        return false;
      }
    }
  }

  private deferServerPolling(): void {
    const delay = Math.min(
      SERVER_RETRY_BASE_MS * 2 ** this.serverFailureCount,
      SERVER_RETRY_MAX_MS,
    );
    this.serverFailureCount = Math.min(this.serverFailureCount + 1, 5);
    this.serverRetryAt = Date.now() + delay;
    this.printerDiscoveryCache = null;
  }

  private deferLocalQueuePolling(): void {
    const delay = Math.min(
      LOCAL_QUEUE_RETRY_BASE_MS * 2 ** this.localQueueFailureCount,
      LOCAL_QUEUE_RETRY_MAX_MS,
    );
    this.localQueueFailureCount = Math.min(this.localQueueFailureCount + 1, 5);
    this.localQueueRetryAt = Date.now() + delay;
  }

  private resetServerPollingBackoff(): void {
    this.serverFailureCount = 0;
    this.serverRetryAt = 0;
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
      if (!this.printerHost) throw new Error("Faol IP printer topilmadi");
      await this.openSocket(this.printerHost, this.printerPort, undefined);
      return [
        {
          id: "fallback",
          name: "Lokal zaxira printer",
          host: this.printerHost,
          port: this.printerPort,
          ok: true,
          message: null,
        },
      ];
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

  private async printNextLocalJob(): Promise<boolean> {
    if (
      !this.localQueue ||
      !this.printSystem ||
      this.systemPrinters.length === 0
    )
      return false;
    const roles = [
      ...new Set(this.systemPrinters.flatMap((printer) => printer.roles)),
    ];
    const job = this.localQueue.claim(roles);
    if (!job) return false;
    const attemptId = this.localQueue.markPrinting?.(job.id);
    if (this.localQueue.markPrinting && !attemptId) {
      return true;
    }
    try {
      const content = JSON.parse(job.payloadJson) as Record<string, unknown>;
      const targets = this.systemPrinters.filter((printer) =>
        printer.roles.includes(job.documentType),
      );
      if (targets.length === 0)
        throw new Error(`${job.documentType} uchun printer tanlanmagan`);
      const receipt: PrintableReceipt = {
        receiptNumber: `OFFLINE-${job.id.slice(0, 8).toUpperCase()}`,
        ...(typeof content.orderId === "string"
          ? { orderId: content.orderId }
          : {}),
        documentType: job.documentType,
        content,
      };
      assertPrintableReceipt(receipt);
      await this.printSystemTargets("local", job.id, targets, receipt);
    } catch (error) {
      this.localQueue.fail(
        job.id,
        message(error),
        isPrintOutcomeUnknown(error),
        typeof attemptId === "string" ? attemptId : undefined,
      );
      return true;
    }
    try {
      this.localQueue.complete(
        job.id,
        typeof attemptId === "string" ? attemptId : undefined,
      );
    } catch (error) {
      this.localQueue.fail(
        job.id,
        message(error),
        true,
        typeof attemptId === "string" ? attemptId : undefined,
      );
      return true;
    }
    return true;
  }

  private async printSystemTargets(
    scope: "local" | "server",
    jobId: string,
    targets: SystemPrinterTarget[],
    receipt: PrintableReceipt,
    allowAmbiguousRetry = false,
  ): Promise<boolean> {
    let nextTargetIndex = 0;
    const failures: Array<{ detail: string; ambiguous: boolean }> = [];
    let printedAnyTarget = false;
    const dispatch = async () => {
      while (nextTargetIndex < targets.length) {
        const target = targets[nextTargetIndex++];
        if (!target) continue;
        if (this.localQueue?.wasTargetPrinted?.(scope, jobId, target.name)) {
          continue;
        }
        const wasAmbiguousBeforeAttempt =
          this.localQueue?.wasTargetAmbiguous?.(scope, jobId, target.name) ??
          false;
        if (wasAmbiguousBeforeAttempt && !allowAmbiguousRetry) {
          failures.push({
            detail: `${target.displayName}: oldingi chop etish natijasi noaniq; qog'oz tekshirilib, operator qayta yuborishi kerak.`,
            ambiguous: true,
          });
          continue;
        }

        try {
          this.localQueue?.markTargetAmbiguous?.(scope, jobId, target.name);
          await this.printToSystem(
            target,
            receipt,
            normalizeWindowsPaperSettings(target),
          );
          printedAnyTarget = true;
          try {
            this.localQueue?.markTargetPrinted?.(scope, jobId, target.name);
          } catch (error) {
            throw new PrintOutcomeUnknownError(
              `"${target.displayName}" printerida qog'oz chiqqan bo'lishi mumkin, ammo natija saqlanmadi. Qog'ozni tekshirmasdan qayta chop etmang. ${message(error)}`,
            );
          }
        } catch (error) {
          const ambiguous = isPrintOutcomeUnknown(error);
          if (!ambiguous && !wasAmbiguousBeforeAttempt) {
            try {
              this.localQueue?.clearTargetAmbiguous?.(
                scope,
                jobId,
                target.name,
              );
            } catch {
              // Keeping the marker is safer than silently permitting a duplicate.
            }
          }
          failures.push({
            detail: target.displayName + ": " + message(error),
            ambiguous,
          });
        }
      }
    };

    const workerCount = Math.min(
      MAX_CONCURRENT_PRINTER_TARGETS,
      targets.length,
    );
    await Promise.all(Array.from({ length: workerCount }, () => dispatch()));

    if (failures.length > 0) {
      const details = failures.map((failure) => failure.detail).join("; ");
      if (
        failures.some((failure) => failure.ambiguous) ||
        (scope === "server" && printedAnyTarget)
      ) {
        throw new PrintOutcomeUnknownError(
          scope === "server" && printedAnyTarget
            ? `Some printer targets may already have paper output. ${details}`
            : details,
        );
      }
      throw new Error(details);
    }
    return printedAnyTarget;
  }

  private async markServerJobDispatching(job: PrintJob): Promise<void> {
    await this.request(
      `/receipts/print-jobs/${encodeURIComponent(job.id)}/dispatching`,
      {
        method: "POST",
        body: JSON.stringify({ leaseToken: job.leaseToken }),
      },
    );
  }

  private async completeServerJob(job: PrintJob): Promise<void> {
    await this.request(
      `/receipts/print-jobs/${encodeURIComponent(job.id)}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ leaseToken: job.leaseToken }),
      },
    );
  }

  private async sendServerTcpTarget(
    job: PrintJob,
    commands: Array<Record<string, unknown>>,
    host: string,
    port: number,
    paperWidthMm: number,
  ): Promise<boolean> {
    const targetName = `tcp://${host}:${port}`;
    if (this.localQueue?.wasTargetPrinted?.("server", job.id, targetName)) {
      return false;
    }

    const wasAmbiguousBeforeAttempt =
      this.localQueue?.wasTargetAmbiguous?.("server", job.id, targetName) ??
      false;
    if (wasAmbiguousBeforeAttempt && job.allowAmbiguousRetry !== true) {
      throw new PrintOutcomeUnknownError(
        `TCP printer ${host}:${port} oldingi urinishda chekni olgan bo'lishi mumkin; qog'oz tekshirilmaguncha avtomatik qayta chop etilmaydi.`,
      );
    }

    this.localQueue?.markTargetAmbiguous?.("server", job.id, targetName);
    try {
      await this.send(commands, host, port, paperWidthMm);
    } catch (error) {
      if (!isPrintOutcomeUnknown(error) && !wasAmbiguousBeforeAttempt) {
        try {
          this.localQueue?.clearTargetAmbiguous?.("server", job.id, targetName);
        } catch {
          // Retain the marker if local persistence cannot confirm a safe retry.
        }
      }
      throw error;
    }

    try {
      this.localQueue?.markTargetPrinted?.("server", job.id, targetName);
    } catch (error) {
      throw new PrintOutcomeUnknownError(
        `TCP printer chekni qabul qilgan, ammo natijani lokal saqlash muvaffaqiyatsiz: ${message(error)}`,
      );
    }
    return true;
  }

  private async printToSystem(
    target: SystemPrinterTarget,
    receipt: PrintableReceipt,
    paperSettings: WindowsPaperSettings,
  ): Promise<void> {
    if (!this.printSystem)
      throw new Error("Windows printer adapter sozlanmagan");
    await withTimeout(
      Promise.resolve().then(() =>
        this.printSystem!(
          target.name,
          receipt,
          normalizeWindowsPaperSettings(paperSettings),
        ),
      ),
      this.printTimeoutMs,
      () =>
        new PrintOutcomeUnknownError(
          `"${target.displayName}" printerida chop etish ${Math.ceil(this.printTimeoutMs / 1_000)} soniyada tasdiqlanmadi. Qog'ozni tekshirib, keyin qo'lda qayta yuboring.`,
        ),
    );
  }

  private async discoverReadyPrinters(): Promise<ManagedPrinter[]> {
    const now = Date.now();
    if (
      this.printerDiscoveryCache &&
      this.printerDiscoveryCache.expiresAt > now
    ) {
      this.localAssignedPrinterGroups =
        this.printerDiscoveryCache.localAssignedPrinterGroups.map((group) => [
          ...group,
        ]);
      this.managedPrinterDetails = this.printerDiscoveryCache.readyPrinters.map(
        (printer) => ({ ...printer }),
      );
      this.managedPrinters = this.managedPrinterDetails.length;
      return this.managedPrinterDetails;
    }

    const printers = await this.request<PrinterConfig[]>("/printers");
    const localPrinterGroups = new Map<string, string[]>();
    for (const printer of printers) {
      const roles = Array.isArray(printer.metadata?.printRoles)
        ? printer.metadata.printRoles.filter(
            (role): role is string => typeof role === "string",
          )
        : [];
      const hasHost =
        typeof printer.metadata?.host === "string" &&
        printer.metadata.host.trim();
      const localTarget = this.systemPrinters.find((target) =>
        roles.some((role) => target.roles.includes(role)) &&
        [target.name, target.displayName].some(
          (name) =>
            name.trim().toLocaleLowerCase() ===
            (printer.name?.trim().toLocaleLowerCase() ?? ""),
        ),
      );
      if (
        printer.isActive !== false &&
        printer.status === "ONLINE" &&
        !hasHost &&
        localTarget
      ) {
        const queueKey = localTarget.name.trim().toLocaleLowerCase();
        const group = localPrinterGroups.get(queueKey) ?? [];
        group.push(printer.id);
        localPrinterGroups.set(queueKey, group);
      }
    }
    this.localAssignedPrinterGroups = [...localPrinterGroups.values()].map(
      (group) => [...group],
    );
    const readyPrinters = printers.flatMap((printer) => {
      const host = printer.metadata?.host;
      if (
        printer.isActive === false ||
        printer.status !== "ONLINE" ||
        typeof host !== "string" ||
        !host.trim()
      )
        return [];
      const rawPort = printer.metadata?.port;
      return [
        {
          id: printer.id,
          name: printer.name?.trim() || "Printer",
          host: host.trim(),
          port:
            typeof rawPort === "number" && Number.isInteger(rawPort)
              ? rawPort
              : this.printerPort,
        },
      ];
    });
    this.managedPrinterDetails = readyPrinters;
    this.managedPrinters = readyPrinters.length;
    this.printerDiscoveryCache = {
      expiresAt: now + 10_000,
      readyPrinters: readyPrinters.map((printer) => ({ ...printer })),
      localAssignedPrinterGroups: this.localAssignedPrinterGroups.map(
        (group) => [...group],
      ),
    };
    return readyPrinters;
  }

  private async request<T = unknown>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
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
      signal: init.signal ?? AbortSignal.timeout(this.requestTimeoutMs),
    });
    if (!response.ok) throw new Error(`Printer API ${response.status}`);
    const body = (await response.json()) as T | { data: T };
    return body && typeof body === "object" && "data" in body
      ? body.data
      : (body as T);
  }

  private async send(
    commands: Array<Record<string, unknown>>,
    host: string,
    port: number,
    paperWidthMm: number,
  ): Promise<void> {
    const columns = paperWidthMm === 58 ? 32 : 48;
    const payload = Buffer.concat([
      Buffer.from("\x1b@", "binary"),
      ...commands.map((command) => this.encodeCommand(command, columns)),
    ]);
    await this.openSocket(host, port, payload);
  }

  private encodeCommand(
    command: Record<string, unknown>,
    columns: number,
  ): Buffer {
    const type = String(command.type ?? "");
    if (type === "align")
      return Buffer.from([
        0x1b,
        0x61,
        command.value === "center" ? 1 : command.value === "right" ? 2 : 0,
      ]);
    if (type === "bold")
      return Buffer.from([0x1b, 0x45, command.value ? 1 : 0]);
    if (type === "line") return Buffer.from("-".repeat(columns) + "\n", "utf8");
    if (type === "cut") return Buffer.from([0x1d, 0x56, 0x00]);
    if (type === "item") {
      const lines = wrapEscPosText(
        String(command.quantity ?? "") + "x " + String(command.name ?? ""),
        columns,
      );
      const total = String(command.total ?? "").trim();
      if (total)
        lines.push(...wrapEscPosPair(lines.pop() ?? "", total, columns));
      const note =
        typeof command.notes === "string" ? command.notes.trim() : "";
      if (note) lines.push(...wrapEscPosText("Izoh: " + note, columns, "  "));
      for (const modifier of modifierNames(command.modifiers))
        lines.push(...wrapEscPosText("+ " + modifier, columns, "  "));
      return Buffer.from(lines.join("\n") + "\n", "utf8");
    }
    if (type === "payment")
      return Buffer.from(
        wrapEscPosPair(
          String(command.method ?? "To'lov"),
          String(command.amount ?? ""),
          columns,
        ).join("\n") + "\n",
        "utf8",
      );
    if (type === "total")
      return Buffer.from(
        wrapEscPosPair("JAMI", String(command.value ?? ""), columns).join(
          "\n",
        ) + "\n",
        "utf8",
      );
    return Buffer.from(
      wrapEscPosText(String(command.value ?? ""), columns).join("\n") + "\n",
      "utf8",
    );
  }

  private async openSocket(
    host: string,
    port: number,
    payload: Buffer | undefined,
  ): Promise<void> {
    if (this.socketImpl) {
      try {
        await withTimeout(
          this.socketImpl(host, port, payload),
          this.printTimeoutMs,
          () =>
            new PrintOutcomeUnknownError(
              `TCP printerga yuborish ${this.printTimeoutMs / 1_000} soniyada tugamadi; qog'ozni tekshiring.`,
            ),
        );
      } catch (error) {
        if (payload && !isPrintOutcomeUnknown(error)) {
          throw new PrintOutcomeUnknownError(
            `${message(error)}. Qog'ozni tekshiring.`,
          );
        }
        throw error;
      }
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      let settled = false;
      let payloadStarted = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.removeAllListeners();
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => {
        socket.destroy();
        finish(
          payloadStarted
            ? new PrintOutcomeUnknownError(
                "TCP printer ma'lumotni qabul qilgan-qilmagani 8 soniyada tasdiqlanmadi; qog'ozni tekshiring.",
              )
            : new Error("Printer 8 soniyada ulanmadi"),
        );
      }, 8_000);
      socket.once("error", (error) => {
        finish(
          payloadStarted ? new PrintOutcomeUnknownError(error.message) : error,
        );
      });
      socket.connect(port, host, () => {
        if (payload) {
          payloadStarted = true;
          socket.end(payload, () => finish());
        } else {
          socket.end(() => finish());
        }
      });
    });
  }
}

function printerPaperWidth(value: unknown): 58 | 80 | 210 {
  return value === 58 || value === 80 || value === 210 ? value : 80;
}

function selectSystemPrinterTargets(
  job: PrintJob,
  route: string,
  printers: SystemPrinterTarget[],
): SystemPrinterTarget[] {
  const targets = printers.filter((printer) => printer.roles.includes(route));
  if (!job.printer) return targets;

  const expectedName = job.printer.name.trim().toLocaleLowerCase();
  const matches = targets.filter((target) =>
    [target.name, target.displayName].some(
      (name) => name.trim().toLocaleLowerCase() === expectedName,
    ),
  );
  if (matches.length === 1) return matches;
  if (matches.length > 1) {
    throw new Error(
      `"${job.printer.name}" nomiga bir nechta Windows printer mos keldi; printer nomlarini yagona qiling`,
    );
  }
  throw new Error(
    `"${job.printer.name}" printeri uchun Windows queue topilmadi; bir xil yo'nalishdagi Windows printer nomini moslang`,
  );
}

function wrapEscPosPair(
  left: string,
  right: string,
  columns: number,
): string[] {
  const leftLines = wrapEscPosText(left, columns);
  const finalLine = leftLines.pop() ?? "";
  if (finalLine.length + right.length + 1 <= columns) {
    leftLines.push(
      finalLine + " ".repeat(columns - finalLine.length - right.length) + right,
    );
  } else {
    leftLines.push(
      finalLine,
      ...wrapEscPosText(right, columns).map((line) => line.padStart(columns)),
    );
  }
  return leftLines;
}

function wrapEscPosText(
  value: string,
  columns: number,
  continuationIndent = "",
): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const wordWidth = Math.max(1, columns - continuationIndent.length);
    const parts =
      word.length > wordWidth
        ? Array.from(
            { length: Math.ceil(word.length / wordWidth) },
            (_, index) =>
              word.slice(index * wordWidth, (index + 1) * wordWidth),
          )
        : [word];
    for (const part of parts) {
      const candidate = line
        ? line + " " + part
        : (lines.length > 0 ? continuationIndent : "") + part;
      if (candidate.length <= columns) line = candidate;
      else {
        if (line) lines.push(line);
        line = continuationIndent + part;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function receiptRoute(receipt: PrintableReceipt): string {
  const contentType = receipt.content?.documentType;
  if (typeof contentType === "string")
    return contentType.startsWith("REFUND") ? "REFUND" : contentType;
  if (typeof receipt.documentType === "string")
    return receipt.documentType.startsWith("REFUND")
      ? "REFUND"
      : receipt.documentType;
  return "RECEIPT";
}

function printableReceiptFromJob(job: PrintJob): PrintableReceipt | null {
  if (
    !job.payload ||
    typeof job.payload !== "object" ||
    Array.isArray(job.payload)
  ) {
    return null;
  }
  const documentType =
    typeof job.payload.documentType === "string"
      ? job.payload.documentType
      : job.receipt?.documentType;
  if (!documentType) return null;
  const content = Object.fromEntries(
    Object.entries(job.payload).filter(
      ([key]) => key !== ALLOW_LOCAL_REPRINT_KEY,
    ),
  );
  return {
    ...(job.receipt?.receiptNumber
      ? { receiptNumber: job.receipt.receiptNumber }
      : {}),
    ...(job.receipt?.orderId ? { orderId: job.receipt.orderId } : {}),
    documentType,
    content,
  };
}

function assertPrintableReceipt(receipt: PrintableReceipt): void {
  // TCP ESC/POS printerlari backend tuzgan buyruqlarni ishlatadi; ular uchun
  // HTML snapshot shart emas.
  if (
    Array.isArray(receipt.escpos?.commands) &&
    receipt.escpos.commands.length > 0
  ) {
    return;
  }
  const content = receipt.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new Error("Chek mazmuni topilmadi; chop etish navbatda qoldirildi");
  }
  const documentType = receiptRoute(receipt);
  if (documentType === "SHIFT_REPORT") {
    const shift =
      content.shift &&
      typeof content.shift === "object" &&
      !Array.isArray(content.shift)
        ? (content.shift as Record<string, unknown>)
        : null;
    const orders = content.orders;
    if (
      !shift ||
      typeof shift.id !== "string" ||
      !shift.id ||
      !Array.isArray(orders) ||
      orders.some(
        (order) =>
          !order ||
          typeof order !== "object" ||
          Array.isArray(order) ||
          !Array.isArray((order as Record<string, unknown>).items),
      )
    ) {
      throw new Error("Smena hisoboti to'liq emas; bo'sh sahifa chop etilmadi");
    }
    return;
  }
  const hasOrder =
    typeof content.orderNumber === "string" ||
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
