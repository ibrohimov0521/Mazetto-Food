"use client";

import { AlertTriangle, Cloud, CloudOff, GitCompareArrows, Printer, RefreshCw, X } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { runPrinterTestsIndependently } from "../../lib/printer-test-batch.mjs";
import { useEffect, useRef, useState } from "react";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Modal } from "../admin-ui/modal";
import { DesktopUpdateControls } from "./desktop-update-controls";

type DesktopStatus = {
  mode: "online" | "offline" | "starting";
  lastOnlineAt: string | null;
  cachedResponses: number;
  pendingCommands: number;
  sendingCommands?: number;
  conflictCommands?: number;
  deadLetterCommands?: number;
  pendingPrintJobs: number;
  deadLetterPrintJobs?: number;
};

type OutboxCommand = {
  id: string;
  idempotencyKey: string;
  commandType: string;
  aggregateType: string;
  aggregateId: string | null;
  state: "pending" | "sending" | "acknowledged" | "conflict" | "dead_letter";
  attempts: number;
  createdAt: string;
  nextAttemptAt: string | null;
  lastError: string | null;
  payload: {
    method?: string;
    pathname?: string;
    queuedAt?: string;
  };
};

type LocalPrintJob = {
  id: string;
  documentType: string;
  state: string;
  attempts: number;
  createdAt: string;
  lastError: string | null;
  attemptHistory?: LocalPrintAttempt[];
};

type LocalPrintAttempt = {
  attemptNumber: number;
  startedAt: string;
  outcome: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type OutboxPayload = {
  summary: DesktopStatus;
  commands: OutboxCommand[];
  printJobs?: LocalPrintJob[];
};

type ConflictComparison = {
  command: {
    id: string;
    commandType: string;
    aggregateType: string;
    aggregateId: string | null;
    idempotencyKey: string;
    baseVersion: number | null;
    payload: { method?: string; pathname?: string; body: unknown };
    lastError: string | null;
  };
  comparison: {
    resourcePath: string;
    expectedVersion: number | null;
    server: { status: number; contentType: string; body: unknown };
  };
};

type PrinterStatus = {
  configured: boolean;
  host: string | null;
  port: number;
  managedPrinters: number;
  managedPrinterDetails: Array<{
    id: string;
    name: string;
    host: string;
    port: number;
  }>;
  systemPrinters?: SelectedSystemPrinter[];
};

type SystemPrinter = {
  name: string;
  displayName: string;
  description: string | null;
  status: number;
  isDefault: boolean;
};

type SelectedSystemPrinter = {
  name: string;
  displayName: string;
  roles: string[];
  paperFormat: "ROLL" | "A4" | "LABEL";
  paperWidthMm: number | "";
  paperHeightMm?: number | "";
};

type PrinterTestResult = {
  name: string;
  ok: boolean;
  message: string;
};

const printRoleOptions = [
  { value: "RECEIPT", label: "Mijoz cheki" },
  { value: "KITCHEN", label: "Oshxona" },
  { value: "CANCELLATION", label: "Bekor qilish" },
  { value: "REFUND", label: "Pul qaytarish" },
  { value: "BAR", label: "Bar (alohida chek yo'q)" },
] as const;

export function DesktopStatusBadge() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [outboxOpen, setOutboxOpen] = useState(false);
  const [outbox, setOutbox] = useState<OutboxPayload | null>(null);
  const [outboxError, setOutboxError] = useState("");
  const [busyCommandId, setBusyCommandId] = useState<string | null>(null);
  const [busyPrintId, setBusyPrintId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<{ commandId: string; data: ConflictComparison } | null>(null);
  const [comparisonBusyId, setComparisonBusyId] = useState<string | null>(null);
  const [printerHost, setPrinterHost] = useState("");
  const [printerPort, setPrinterPort] = useState("9100");
  const [printerMessage, setPrinterMessage] = useState("");
  const [printerTestResults, setPrinterTestResults] = useState<PrinterTestResult[]>([]);
  const [printerBusy, setPrinterBusy] = useState(false);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null);
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinter[]>([]);
  const [selectedSystemPrinters, setSelectedSystemPrinters] = useState<SelectedSystemPrinter[]>([]);
  const printerSettingsDirty = useRef(false);
  const [supportBusy, setSupportBusy] = useState(false);

  useEffect(() => {
    const desktop = window.navigator.userAgent.includes("MAZETTO-Desktop/");
    setIsDesktop(desktop);
    if (!desktop) {
      return;
    }

    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("http://127.0.0.1:7359/desktop/status", {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          data?: DesktopStatus;
        };
        if (active && payload.data) {
          setStatus(payload.data);
        }
      } catch {
        if (active) {
          setStatus((current) =>
            current ? { ...current, mode: "offline" } : null,
          );
        }
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
  
  return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isDesktop || !window.mazettoDesktop?.printer) return;
    let active = true;
    const refreshPrinterStatus = async () => {
      try {
        const settings = await window.mazettoDesktop?.printer?.status();
        if (!active || !settings) return;
        setPrinterStatus(settings);
        setPrinterHost(settings.host ?? "");
        setPrinterPort(String(settings.port));
        if (!printerSettingsDirty.current) {
          setSelectedSystemPrinters((settings.systemPrinters ?? []).map((printer) => ({
            ...printer,
            paperFormat: printer.paperFormat ?? "ROLL",
            paperWidthMm: printer.paperWidthMm ?? 80,
          })));
        }
      } catch {
        // Desktop status polling retries automatically.
      }
    };
    void refreshPrinterStatus();
    const timer = window.setInterval(() => void refreshPrinterStatus(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isDesktop]);

  useEffect(() => {
    if (!outboxOpen || !isDesktop) return;
    void loadSystemPrinters();
  }, [isDesktop, outboxOpen]);
  useEffect(() => {
    const sendHeartbeat = () => {
      const version =
        window.navigator.userAgent.match(/MAZETTO-Desktop\/([^\s]+)/)?.[1];
      void apiFetch("/devices/heartbeat", {
        method: "POST",
        body: JSON.stringify(version ? { softwareVersion: version } : {}),
      }).catch(() => undefined);
    };

    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 30_000);
  
  return () => window.clearInterval(timer);
  }, []);

  async function savePrinter(test = false): Promise<void> {
    if (!window.mazettoDesktop?.printer) return;
    setPrinterBusy(true); setPrinterMessage("");
    try {
      const settings = await window.mazettoDesktop.printer.save({ host: printerHost, port: Number(printerPort) });
      setPrinterStatus(settings); setPrinterHost(settings.host ?? ""); setPrinterPort(String(settings.port));
      if (test) await window.mazettoDesktop.printer.test();
      setPrinterMessage(test ? "Printer bilan ulanish tasdiqlandi." : "Printer sozlamasi saqlandi.");
    } catch (error) { setPrinterMessage(error instanceof Error ? error.message : "Printer sozlanmadi."); }
    finally { setPrinterBusy(false); }
  }

  async function testManagedPrinters(): Promise<void> {
    if (!window.mazettoDesktop?.printer) return;
    setPrinterBusy(true);
    setPrinterMessage("");
    try {
      const results = await window.mazettoDesktop.printer.testManaged();
      const failed = results.filter((result) => !result.ok);
      setPrinterMessage(
        failed.length === 0
          ? `${results.length} ta printer bilan ulanish tasdiqlandi.`
          : `${results.length - failed.length} ta printer ishladi, ${failed.length} tasi javob bermadi: ${failed.map((result) => result.name).join(", ")}.`,
      );
      setPrinterStatus(await window.mazettoDesktop.printer.status());
    } catch (error) {
      setPrinterMessage(error instanceof Error ? error.message : "Printerlar sinalmadi.");
    } finally {
      setPrinterBusy(false);
    }
  }

  async function loadSystemPrinters(): Promise<void> {
    if (!window.mazettoDesktop?.printer) return;
    setPrinterBusy(true);
    setPrinterMessage("");
    try {
      setSystemPrinters(await window.mazettoDesktop.printer.listSystem());
    } catch (error) {
      setPrinterMessage(error instanceof Error ? error.message : "Windows printerlari olinmadi.");
    } finally {
      setPrinterBusy(false);
    }
  }

  function toggleSystemPrinter(printer: SystemPrinter): void {
    printerSettingsDirty.current = true;
    setSelectedSystemPrinters((current) => {
      const exists = current.some((entry) => entry.name === printer.name);
      const isGodexLabel = /\bgodex\b/i.test(`${printer.name} ${printer.displayName}`);
      return exists
        ? current.filter((entry) => entry.name !== printer.name)
        : [...current, {
            name: printer.name,
            displayName: printer.displayName,
            roles: ["RECEIPT"],
            paperFormat: isGodexLabel ? "LABEL" : "ROLL",
            paperWidthMm: isGodexLabel ? 90 : 80,
            ...(isGodexLabel ? { paperHeightMm: 80 } : {}),
          }];
    });
  }

  function setSystemPrinterPaperFormat(printerName: string, value: string): void {
    if (value !== "ROLL" && value !== "A4" && value !== "LABEL") return;
    printerSettingsDirty.current = true;
    setSelectedSystemPrinters((current) => current.map((printer) => {
      if (printer.name !== printerName) return printer;
      if (value === "A4") {
        const next = { ...printer, paperFormat: "A4" as const, paperWidthMm: 210 };
        delete next.paperHeightMm;
        return next;
      }
      if (value === "LABEL") {
        return {
          ...printer,
          paperFormat: "LABEL" as const,
          paperWidthMm: printer.paperWidthMm === 210 ? 90 : printer.paperWidthMm,
          paperHeightMm: printer.paperHeightMm ?? 80,
        };
      }
      const next = {
        ...printer,
        paperFormat: "ROLL" as const,
        paperWidthMm: printer.paperWidthMm === 210 ? 80 : printer.paperWidthMm,
      };
      delete next.paperHeightMm;
      return next;
    }));
  }

  function setSystemPrinterPaperWidth(printerName: string, value: string): void {
    const paperWidthMm = value === "" ? "" : Number(value);
    if (typeof paperWidthMm === "number" && !Number.isFinite(paperWidthMm)) return;
    printerSettingsDirty.current = true;
    setSelectedSystemPrinters((current) => current.map((printer) =>
      printer.name === printerName ? { ...printer, paperWidthMm } : printer,
    ));
  }

  function setSystemPrinterPaperHeight(printerName: string, value: string): void {
    const paperHeightMm = value === "" ? "" : Number(value);
    if (typeof paperHeightMm === "number" && !Number.isFinite(paperHeightMm)) return;
    printerSettingsDirty.current = true;
    setSelectedSystemPrinters((current) => current.map((printer) =>
      printer.name === printerName ? { ...printer, paperHeightMm } : printer,
    ));
  }

  function togglePrinterRole(printerName: string, role: string): void {
    printerSettingsDirty.current = true;
    setSelectedSystemPrinters((current) => current.map((entry) => {
      if (entry.name !== printerName) return entry;
      const roles = entry.roles.includes(role)
        ? entry.roles.filter((value) => value !== role)
        : [...entry.roles, role];
      return { ...entry, roles };
    }).filter((entry) => entry.roles.length > 0));
  }

  async function saveSystemPrinters(test = false): Promise<void> {
    const printerApi = window.mazettoDesktop?.printer;
    if (!printerApi) return;
    setPrinterBusy(true);
    setPrinterMessage("");
    setPrinterTestResults([]);
    try {
      const invalidProfile = selectedSystemPrinters.find((printer) => {
        const width = Number(printer.paperWidthMm);
        const height = Number(printer.paperHeightMm ?? 80);
        return !Number.isInteger(width) || width < 30 || width > 300 ||
          (printer.paperFormat === "LABEL" &&
            (!Number.isInteger(height) || height < 20 || height > 300));
      });
      if (invalidProfile) {
        setPrinterMessage("Qog'oz o'lchamini tekshiring: kenglik 30–300 mm, yorliq balandligi 20–300 mm bo'lishi kerak.");
        return;
      }
      const printers = selectedSystemPrinters.map((printer) => {
        const { paperHeightMm, ...settings } = printer;
        return {
          ...settings,
          paperWidthMm: Number(printer.paperWidthMm),
          ...(printer.paperFormat === "LABEL"
            ? { paperHeightMm: Number(paperHeightMm ?? 80) }
            : {}),
        };
      });
      const settings = await printerApi.saveSystem({ printers });
      setPrinterStatus(settings);
      printerSettingsDirty.current = false;
      if (test) {
        const results = await runPrinterTestsIndependently(
          printers,
          async (printer) => {
            await printerApi.testSystem({
              name: printer.name,
              role: printer.roles[0] ?? "RECEIPT",
              paperFormat: printer.paperFormat,
              paperWidthMm: printer.paperWidthMm,
              ...(printer.paperHeightMm == null
                ? {}
                : { paperHeightMm: Number(printer.paperHeightMm) }),
            });
          },
          setPrinterTestResults,
        );
        const passed = results.filter((result) => result.ok).length;
        setPrinterMessage(
          results.length === 0
            ? "Test qilish uchun printer tanlanmagan."
            : `${passed}/${results.length} printer Windows tomonidan qabul qilindi. Qog'ozni qurilmaning o'zidan tekshiring.`,
        );
      } else {
        setPrinterMessage("Windows printer sozlamalari saqlandi.");
      }
    } catch (error) {
      setPrinterMessage(error instanceof Error ? error.message : "Printer sozlamalari saqlanmadi.");
    } finally {
      setPrinterBusy(false);
    }
  }

  async function exportSupportBundle(): Promise<void> {
    if (!window.mazettoDesktop?.support) return;
    setSupportBusy(true);
    setOutboxError("");
    try {
      const result = await window.mazettoDesktop.support.export();
      if (result) {
        setPrinterMessage("Diagnostika fayli saqlandi.");
      }
    } catch (error) {
      setOutboxError(error instanceof Error ? error.message : "Diagnostika fayli yaratilmadi.");
    } finally {
      setSupportBusy(false);
    }
  }
  if (!isDesktop) {
    return null;
  }

  const mode = status?.mode ?? "starting";
  const label =
    mode === "online" ? "Jonli" : mode === "offline" ? "Oflayn" : "Ulanmoqda";
  const pending = status?.pendingCommands ?? 0;
  const sending = status?.sendingCommands ?? 0;
  const blocked = (status?.conflictCommands ?? 0) + (status?.deadLetterCommands ?? 0);
  const failedPrintJobs = outbox?.printJobs?.filter((job) => job.state === "dead_letter") ?? [];
  const uncertainPrintJobs = failedPrintJobs.filter(isUncertainPrintJob);
  const Icon =
    mode === "online" ? Cloud : mode === "offline" ? CloudOff : RefreshCw;
  const title = status
    ? `${label}. Cache: ${status.cachedResponses}; navbat: ${pending}; yuborilmoqda: ${sending}; bloklangan: ${blocked}; chek: ${status.pendingPrintJobs}`
    : "Desktop runtime holati tekshirilmoqda";

  async function loadOutbox(): Promise<void> {
    setOutboxError("");
    try {
      const payload = await desktopFetch<OutboxPayload>("/desktop/outbox");
      setOutbox(payload);
      setStatus(payload.summary);
    } catch (caught) {
      setOutboxError(
        caught instanceof Error ? caught.message : "Navbatni o'qib bo'lmadi.",
      );
    }
  }

  async function retryPrintJob(job: LocalPrintJob): Promise<void> {
    if (
      isUncertainPrintJob(job) &&
      !window.confirm(
        "Chek qog'ozini printerdan tekshiring. Agar chek chiqqan bo'lsa, qayta chop etish dublikat chiqarishi mumkin. Baribir qayta chop etilsinmi?",
      )
    ) {
      return;
    }
    const jobId = job.id;
    setBusyPrintId(jobId);
    setOutboxError("");
    try {
      const payload = await desktopFetch<OutboxPayload>(
        "/desktop/prints/" + encodeURIComponent(jobId) + "/retry",
        { method: "POST" },
      );
      setOutbox(payload);
      setStatus(payload.summary);
    } catch (caught) {
      setOutboxError(
        caught instanceof Error ? caught.message : "Chek qayta yuborilmadi.",
      );
    } finally {
      setBusyPrintId(null);
    }
  }
  async function mutateCommand(
    commandId: string,
    action: "retry" | "cancel",
  ): Promise<void> {
    setBusyCommandId(commandId);
    setOutboxError("");
    try {
      const payload = await desktopFetch<OutboxPayload>(
        `/desktop/outbox/${encodeURIComponent(commandId)}/${action}`,
        { method: "POST" },
      );
      setOutbox(payload);
      setStatus(payload.summary);
    } catch (caught) {
      setOutboxError(
        caught instanceof Error ? caught.message : "Amal bajarilmadi.",
      );
    } finally {
      setBusyCommandId(null);
    }
  }


  async function compareCommand(command: OutboxCommand): Promise<void> {
    setComparisonBusyId(command.id);
    setOutboxError("");
    try {
      const data = await desktopFetch<ConflictComparison>(
        `/desktop/outbox/${encodeURIComponent(command.id)}/compare`,
      );
      setComparison({ commandId: command.id, data });
    } catch (caught) {
      setOutboxError(
        caught instanceof Error ? caught.message : "Taqqoslashni olib bo'lmadi.",
      );
    } finally {
      setComparisonBusyId(null);
    }
  }
  return (
    <>
      <button
        aria-live="polite"
        className={`flex h-7 shrink-0 items-center gap-1 rounded-mz-pill border px-2 text-[10px] font-bold ${
        mode === "online"
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
          : mode === "offline"
            ? "border-amber-300/50 bg-amber-300/10 text-amber-100"
            : "border-white/20 bg-white/5 text-mz-shell-fg-muted"
        }`}
        onClick={() => {
          setOutboxOpen(true);
          void loadOutbox();
        }}
        title={title}
        type="button"
      >
        <Icon
          aria-hidden="true"
          className={mode === "starting" ? "animate-spin" : ""}
          size={13}
        />
        <span className="hidden sm:inline">{label}</span>
        {pending + sending + blocked > 0 ? (
          <span className="rounded-mz-pill bg-white/15 px-1.5 py-0.5 text-[9px]">
            {pending + sending + blocked}
          </span>
        ) : null}
      </button>

      <Modal
        description="Internet uzilganda saqlangan amallar. Ulanish qaytsa navbat avtomatik yuboriladi."
        footer={
          <>
            <Button onClick={() => void loadOutbox()} size="sm" variant="ghost">
              Yangilash
            </Button>
            <Button onClick={() => setOutboxOpen(false)} size="sm">
              Yopish
            </Button>
          </>
        }
        isOpen={outboxOpen}
        onClose={() => setOutboxOpen(false)}
        title="Desktop navbati"
      >
        <div className="grid gap-3">
          {outboxError ? (
            <div className="flex gap-2 rounded-mz-card border border-mz-danger-accent bg-mz-danger-bg p-3 text-[13px] text-mz-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{outboxError}</span>
            </div>
          ) : null}

          <div className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-mz-text">Ulanish holati</p>
              <Badge
                tone={mode === "online" ? "success" : mode === "offline" ? "warning" : "neutral"}
                withDot
              >
                {label}
              </Badge>
            </div>
            <div className="mt-2 grid gap-1 text-[12px] text-mz-text-muted sm:grid-cols-2">
              <span>Oxirgi jonli ulanish: {formatDesktopTime(status?.lastOnlineAt)}</span>
              <span>Kesh: {status?.cachedResponses ?? 0} ta endpoint</span>
            </div>
          </div>

          <div className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Printer className="text-mz-primary" size={17} />
                <p className="text-sm font-semibold text-mz-text">Printerlar</p>
              </div>
              <Badge tone={selectedSystemPrinters.length ? "success" : "neutral"} withDot>
                {selectedSystemPrinters.length ? `${selectedSystemPrinters.length} ta tanlangan` : "Tanlanmagan"}
              </Badge>
            </div>
            <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
              {systemPrinters.length ? systemPrinters.map((printer) => {
                const selected = selectedSystemPrinters.find((entry) => entry.name === printer.name);
                return (
                  <div className="rounded-mz-control border border-mz-border bg-mz-surface p-3" key={printer.name}>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input checked={Boolean(selected)} className="mt-0.5 h-4 w-4 accent-mz-primary" onChange={() => toggleSystemPrinter(printer)} type="checkbox" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-mz-text">{printer.displayName}</span>
                        <span className="block truncate text-[11px] text-mz-text-muted">{printer.isDefault ? "Windows asosiy printeri" : printer.description || printer.name}</span>
                      </span>
                    </label>
                    {selected ? (
                      <div className="mt-2 grid gap-3 border-t border-mz-border pt-2 sm:grid-cols-[minmax(0,1fr)_210px]">
                        <div className="flex flex-wrap gap-x-3 gap-y-2">
                          {printRoleOptions.map((role) => (
                            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-mz-text" key={role.value}>
                              <input checked={selected.roles.includes(role.value)} className="h-3.5 w-3.5 accent-mz-primary" onChange={() => togglePrinterRole(printer.name, role.value)} type="checkbox" />
                              {role.label}
                            </label>
                          ))}
                        </div>
                        <div className="grid gap-2">
                          <label className="grid gap-1 text-[11px] font-medium text-mz-text">
                            Qog'oz turi
                            <select
                              aria-label={`${printer.displayName} qog'oz turi`}
                              className="min-h-9 rounded-mz-control border border-mz-border bg-mz-surface px-2 text-xs"
                              onChange={(event) => setSystemPrinterPaperFormat(printer.name, event.target.value)}
                              value={selected.paperFormat}
                            >
                              <option value="ROLL">Termal rulon</option>
                              <option value="A4">A4 varaq</option>
                              <option value="LABEL">Yorliq</option>
                            </select>
                          </label>
                          {selected.paperFormat === "A4" ? (
                            <p className="text-[11px] text-mz-text-muted">210 × 297 mm</p>
                          ) : (
                            <div className={`grid gap-2 ${selected.paperFormat === "LABEL" ? "grid-cols-2" : "grid-cols-1"}`}>
                              <label className="grid gap-1 text-[11px] font-medium text-mz-text">
                                Kengligi, mm
                                <input
                                  aria-label={`${printer.displayName} qog'oz kengligi millimetrda`}
                                  className="min-h-9 rounded-mz-control border border-mz-border bg-mz-surface px-2 text-xs"
                                  max={300}
                                  min={30}
                                  onChange={(event) => setSystemPrinterPaperWidth(printer.name, event.target.value)}
                                  step={1}
                                  type="number"
                                  value={selected.paperWidthMm}
                                />
                              </label>
                              {selected.paperFormat === "LABEL" ? (
                                <label className="grid gap-1 text-[11px] font-medium text-mz-text">
                                  Balandligi, mm
                                  <input
                                    aria-label={`${printer.displayName} yorliq balandligi millimetrda`}
                                    className="min-h-9 rounded-mz-control border border-mz-border bg-mz-surface px-2 text-xs"
                                    max={300}
                                    min={20}
                                    onChange={(event) => setSystemPrinterPaperHeight(printer.name, event.target.value)}
                                    step={1}
                                    type="number"
                                    value={selected.paperHeightMm ?? 80}
                                  />
                                </label>
                              ) : null}
                            </div>
                          )}
                          {/\bgodex\b/i.test(printer.name) ? (
                            <p className="text-[11px] text-mz-text-muted">
                              Godex uchun yorliq turini tanlang va o'lchamlarni haqiqiy yorliq bilan tenglang.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }) : (
                <p className="rounded-mz-control border border-dashed border-mz-border p-3 text-center text-[12px] text-mz-text-muted">Windows printer topilmadi.</p>
              )}
            </div>
            <p className="mt-3 text-[11px] text-mz-text-muted">Windows’da USB, Bluetooth va tarmoq printeri uning o‘rnatilgan drayveri orqali ishlaydi. Rulon/yorliq o‘lchamini printer drayveridagi qog‘oz bilan moslang; A4 va maxsus yorliq o‘lchami alohida boshqariladi.</p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button isLoading={printerBusy} onClick={() => void loadSystemPrinters()} size="sm" variant="ghost">Qayta qidirish</Button>
              <Button disabled={!selectedSystemPrinters.length} isLoading={printerBusy} onClick={() => void saveSystemPrinters(true)} size="sm" variant="ghost">Test cheki</Button>
              <Button disabled={!selectedSystemPrinters.length} isLoading={printerBusy} onClick={() => void saveSystemPrinters()} size="sm">Saqlash</Button>
            </div>
            <details className="mt-3 border-t border-mz-border pt-2 text-[12px]">
              <summary className="cursor-pointer font-semibold text-mz-text-muted">Tarmoq printeri (ixtiyoriy)</summary>
              <p className="my-2 text-mz-text-muted">Faqat Windows drayverisiz ESC/POS printer uchun IP manzil ishlatiladi.</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_90px_auto_auto]"><input aria-label="Zaxira printer IP manzili" className="min-h-9 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm" onChange={(event) => setPrinterHost(event.target.value)} placeholder="192.168.1.50" value={printerHost} /><input aria-label="Zaxira printer porti" className="min-h-9 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm" inputMode="numeric" onChange={(event) => setPrinterPort(event.target.value)} value={printerPort} /><Button isLoading={printerBusy} onClick={() => void savePrinter()} size="sm" variant="ghost">Saqlash</Button><Button disabled={!printerHost && !printerStatus?.managedPrinters} isLoading={printerBusy} onClick={() => void (printerStatus?.managedPrinters ? testManagedPrinters() : savePrinter(true))} size="sm">Sinash</Button></div>
            </details>
            {printerMessage ? <p className="mt-2 text-[12px] text-mz-text-muted">{printerMessage}</p> : null}
            {printerTestResults.length ? (
              <ul aria-live="polite" className="mt-2 grid gap-1 text-[11px]">
                {printerTestResults.map((result) => (
                  <li className={result.ok ? "text-mz-success" : "text-mz-danger"} key={result.name}>
                    <span className="font-semibold">{result.name}:</span> {result.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <DesktopUpdateControls />
          <div className="flex justify-end">
            <Button isLoading={supportBusy} onClick={() => void exportSupportBundle()} size="sm" variant="ghost">
              Diagnostika fayli
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <QueueStat label="Kutmoqda" value={status?.pendingCommands ?? 0} />
            <QueueStat label="Yuborilyapti" value={status?.sendingCommands ?? 0} />
            <QueueStat label="Bloklangan" value={blocked} />
            <QueueStat label="Cheklar" value={status?.pendingPrintJobs ?? 0} />
          </div>

          {failedPrintJobs.length ? (
            <div className="grid gap-2 rounded-mz-card border border-mz-danger-accent bg-mz-danger-bg p-3">
              {uncertainPrintJobs.length ? (
                <p className="text-xs text-mz-danger" role="note">
                  {uncertainPrintJobs.length} ta chek natijasi noaniq. Qayta yuborishdan oldin printerdan qog'oz chiqqanini tekshiring; avtomatik dublikat chiqarilmaydi.
                </p>
              ) : null}
              <p className="text-sm font-semibold text-mz-danger">
                Qayta chop etish kerak
              </p>
              {failedPrintJobs.map((job) => (
                <div
                  className="grid gap-3 rounded-mz-control border border-mz-border bg-mz-surface p-3"
                  key={job.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-mz-text">
                        {job.documentType === "KITCHEN"
                          ? "Oshxona nusxasi"
                          : job.documentType === "RECEIPT"
                            ? "Mijoz cheki"
                            : job.documentType}
                      </p>
                      <p className="mt-1 text-[12px] text-mz-danger">
                        {job.lastError || "Printer javob bermadi."}
                      </p>
                    </div>
                    <Button
                      disabled={busyPrintId === job.id}
                      isLoading={busyPrintId === job.id}
                      onClick={() => void retryPrintJob(job)}
                      size="sm"
                    >
                      Qayta chop etish
                    </Button>
                  </div>
                  {job.attemptHistory?.length ? (
                    <div className="rounded-mz-control bg-mz-surface-sunken p-3">
                      <p className="text-xs font-semibold text-mz-text">Chop etish tarixi</p>
                      <ol className="mt-2 grid gap-2 text-xs text-mz-text-muted">
                        {job.attemptHistory.slice(-3).reverse().map((attempt) => (
                          <li className="grid gap-1 sm:grid-cols-[1fr_auto]" key={attempt.attemptNumber}>
                            <span>
                              {getPrintAttemptLabel(attempt)} - {new Date(attempt.startedAt).toLocaleString("uz-UZ")}
                            </span>
                            {attempt.errorMessage ? <span className={attempt.errorCode === "operator_action" ? "text-mz-text-muted" : "text-mz-danger"}>{attempt.errorMessage}</span> : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {outbox?.commands.length ? (
            <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
              {outbox.commands.map((command) => (
                <div
                  className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-3"
                  key={command.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-mz-text">
                          {command.commandType}
                        </p>
                        <Badge tone={commandStateTone(command.state)} withDot>
                          {commandStateLabel(command.state)}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-[12px] text-mz-text-muted">
                        {command.payload.pathname ?? command.aggregateType}
                        {command.aggregateId ? ` · ${command.aggregateId}` : ""}
                      </p>
                      {command.lastError ? (
                        <p className="mt-2 line-clamp-2 text-[12px] text-mz-danger">
                          {command.lastError}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {command.state === "conflict" || command.state === "dead_letter" ? (
                        <Button
                          aria-label="Server holati bilan taqqoslash"
                          disabled={comparisonBusyId === command.id}
                          isLoading={comparisonBusyId === command.id}
                          onClick={() => void compareCommand(command)}
                          size="sm"
                          title="Server holati bilan taqqoslash"
                          variant="ghost"
                        >
                          <GitCompareArrows className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      <Button
                        disabled={command.state === "sending"}
                        isLoading={busyCommandId === command.id}
                        onClick={() => void mutateCommand(command.id, "retry")}
                        size="sm"
                        variant="ghost"
                      >
                        Qayta
                      </Button>
                      <Button
                        disabled={command.state === "sending"}
                        isLoading={busyCommandId === command.id}
                        onClick={() => void mutateCommand(command.id, "cancel")}
                        size="sm"
                        variant="danger"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-mz-card border border-dashed border-mz-border bg-mz-surface-sunken p-5 text-center text-sm text-mz-text-muted">
              Navbat bo'sh.
            </div>
          )}

          {comparison ? (
            <div className="rounded-mz-card border border-mz-warning-accent bg-mz-warning-bg p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-mz-text">Konflikt taqqoslanishi</p>
                  <p className="mt-1 text-[12px] text-mz-text-muted">
                    Lokal amal va serverdagi hozirgi holat yonma-yon tekshirildi.
                  </p>
                </div>
                <Button
                  aria-label="Taqqoslashni yopish"
                  onClick={() => setComparison(null)}
                  size="sm"
                  title="Taqqoslashni yopish"
                  variant="ghost"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-3 grid gap-2 text-[12px] text-mz-text-muted sm:grid-cols-2">
                <span>Amal: {comparison.data.command.commandType}</span>
                <span>Kutilgan versiya: {comparison.data.comparison.expectedVersion ?? "ko'rsatilmagan"}</span>
                <span>Server javobi: {comparison.data.comparison.server.status}</span>
                <span>Resurs: {comparison.data.comparison.resourcePath}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-mz-text-muted">Lokal yuborilgan qiymat</p>
                  <pre className="max-h-40 overflow-auto rounded-mz-control bg-mz-surface p-2 text-[11px] text-mz-text">{JSON.stringify(comparison.data.command.payload.body, null, 2)}</pre>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-mz-text-muted">Serverdagi hozirgi qiymat</p>
                  <pre className="max-h-40 overflow-auto rounded-mz-control bg-mz-surface p-2 text-[11px] text-mz-text">{JSON.stringify(comparison.data.comparison.server.body, null, 2)}</pre>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button
                  disabled={busyCommandId === comparison.commandId}
                  isLoading={busyCommandId === comparison.commandId}
                  onClick={() => void mutateCommand(comparison.commandId, "retry")}
                  size="sm"
                  variant="ghost"
                >
                  Qayta yuborish
                </Button>
                <Button
                  disabled={busyCommandId === comparison.commandId}
                  isLoading={busyCommandId === comparison.commandId}
                  onClick={() => void mutateCommand(comparison.commandId, "cancel")}
                  size="sm"
                  variant="danger"
                >
                  Bekor qilish
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

function QueueStat({ label, value }: { label: string; value: number }) {

  return (
    <div className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-2">
      <p className="text-[11px] text-mz-text-muted">{label}</p>
      <p className="text-lg font-bold text-mz-text">{value}</p>
    </div>
  );
}

function commandStateLabel(commandState: OutboxCommand["state"]): string {
  switch (commandState) {
    case "pending":
      return "Kutmoqda";
    case "sending":
      return "Yuborilyapti";
    case "conflict":
      return "Tekshirish kerak";
    case "dead_letter":
      return "To'xtagan";
    default:
      return "Yakunlangan";
  }
}

function commandStateTone(commandState: OutboxCommand["state"]) {
  if (commandState === "pending") return "warning";
  if (commandState === "sending") return "info";
  if (commandState === "conflict" || commandState === "dead_letter") {
    return "danger";
  }
  return "success";
}

function formatDesktopTime(value: string | null | undefined): string {
  if (!value) {
    return "Hali ulanmagan";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Noma'lum";
  }

  return date.toLocaleString("uz-UZ", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}
async function desktopFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`http://127.0.0.1:7359${path}`, {
    cache: "no-store",
    ...init,
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    data?: T;
    error?: { message?: string };
  };

  if (!response.ok || payload.ok === false || !payload.data) {
    throw new Error(payload.error?.message ?? "Desktop gateway javob bermadi.");
  }

  return payload.data;
}

function isUncertainPrintJob(job: LocalPrintJob): boolean {
  return (
    /qog'ozni tekshiring/i.test(job.lastError ?? "") ||
    job.attemptHistory?.some(
      (attempt) =>
        attempt.outcome === "ambiguous" ||
        attempt.errorCode === "process_interrupted",
    ) === true
  );
}

function getPrintAttemptLabel(attempt: LocalPrintAttempt): string {
  if (attempt.errorCode === "operator_action") {
    return "Qo'lda qayta chop etish so'raldi";
  }
  if (attempt.outcome === "printed") return "Muvaffaqiyatli chop etildi";
  if (attempt.outcome === "failed") return "Chop etish muvaffaqiyatsiz";
  if (attempt.outcome === "ambiguous") return "Natija noaniq";
  return "Boshlanishi qayd etildi";
}
