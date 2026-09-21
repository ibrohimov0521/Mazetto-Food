"use client";

import { AlertTriangle, Cloud, CloudOff, GitCompareArrows, Printer, RefreshCw, X } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { useEffect, useState } from "react";
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

type OutboxPayload = {
  summary: DesktopStatus;
  commands: OutboxCommand[];
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
};

const printRoleOptions = [
  { value: "RECEIPT", label: "Mijoz cheki" },
  { value: "KITCHEN", label: "Oshxona" },
  { value: "CANCELLATION", label: "Bekor qilish" },
  { value: "REFUND", label: "Pul qaytarish" },
] as const;

export function DesktopStatusBadge() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [outboxOpen, setOutboxOpen] = useState(false);
  const [outbox, setOutbox] = useState<OutboxPayload | null>(null);
  const [outboxError, setOutboxError] = useState("");
  const [busyCommandId, setBusyCommandId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<{ commandId: string; data: ConflictComparison } | null>(null);
  const [comparisonBusyId, setComparisonBusyId] = useState<string | null>(null);
  const [printerHost, setPrinterHost] = useState("");
  const [printerPort, setPrinterPort] = useState("9100");
  const [printerMessage, setPrinterMessage] = useState("");
  const [printerBusy, setPrinterBusy] = useState(false);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null);
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinter[]>([]);
  const [selectedSystemPrinters, setSelectedSystemPrinters] = useState<SelectedSystemPrinter[]>([]);
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
        setSelectedSystemPrinters(settings.systemPrinters ?? []);
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
    setSelectedSystemPrinters((current) => {
      const exists = current.some((entry) => entry.name === printer.name);
      return exists
        ? current.filter((entry) => entry.name !== printer.name)
        : [...current, { name: printer.name, displayName: printer.displayName, roles: ["RECEIPT"] }];
    });
  }

  function togglePrinterRole(printerName: string, role: string): void {
    setSelectedSystemPrinters((current) => current.map((entry) => {
      if (entry.name !== printerName) return entry;
      const roles = entry.roles.includes(role)
        ? entry.roles.filter((value) => value !== role)
        : [...entry.roles, role];
      return { ...entry, roles };
    }).filter((entry) => entry.roles.length > 0));
  }

  async function saveSystemPrinters(test = false): Promise<void> {
    if (!window.mazettoDesktop?.printer) return;
    setPrinterBusy(true);
    setPrinterMessage("");
    try {
      const settings = await window.mazettoDesktop.printer.saveSystem({ printers: selectedSystemPrinters });
      setPrinterStatus(settings);
      if (test) {
        for (const printer of selectedSystemPrinters) {
          await window.mazettoDesktop.printer.testSystem({
            name: printer.name,
            role: printer.roles[0] ?? "RECEIPT",
          });
        }
      }
      setPrinterMessage(test ? "Tanlangan printerlarda test cheki chiqarildi." : "Windows printer sozlamalari saqlandi.");
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
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2 border-t border-mz-border pt-2">
                        {printRoleOptions.map((role) => (
                          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-mz-text" key={role.value}>
                            <input checked={selected.roles.includes(role.value)} className="h-3.5 w-3.5 accent-mz-primary" onChange={() => togglePrinterRole(printer.name, role.value)} type="checkbox" />
                            {role.label}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }) : (
                <p className="rounded-mz-control border border-dashed border-mz-border p-3 text-center text-[12px] text-mz-text-muted">Windows printer topilmadi.</p>
              )}
            </div>
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
