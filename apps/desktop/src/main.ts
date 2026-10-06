import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { DesktopGateway } from "./gateway.js";
import { DesktopStore } from "./store.js";
import {
  DesktopPrintWorker,
  type PrintableReceipt,
  type SystemPrinterTarget,
} from "./print-worker.js";
import {
  normalizeWindowsPaperSettings,
  printableReceiptHtml,
  windowsPrintPageSize,
} from "./receipt-renderer.js";
import { PrintOutcomeUnknownError, withTimeout } from "./print-errors.js";
import { realtimeSocketOrigin } from "./realtime-origin.js";
import { resolveDesktopUpdateFeed } from "./update-feed.js";
import {
  formatDesktopApiError,
  type DesktopApiError,
} from "./api-error-reference.js";
import {
  normalizeSavedCredentialIdentifier,
  parseSavedDesktopCredentials,
  removeSavedDesktopCredential,
  upsertSavedDesktopCredential,
  type SavedDesktopCredential,
} from "./saved-credentials.js";

const require = createRequire(import.meta.url);
const { autoUpdater } =
  require("electron-updater") as typeof import("electron-updater");

const GATEWAY_PORT = 7359;
const SAVED_LOGIN_CREDENTIALS_KEY = "saved_login_credentials_encrypted";
const UPSTREAM_API_URL =
  process.env.MAZETTO_API_URL?.trim() || "https://api.mazettofood.uz/api/v1";
const LOCAL_GATEWAY_API_URL = `http://127.0.0.1:${GATEWAY_PORT}/api/v1`;
const DESKTOP_UPDATE_URL =
  process.env.MAZETTO_DESKTOP_UPDATE_URL?.trim() ||
  "https://github.com/ibrohimov0521/Mazetto-Food/releases/latest/download/";

let mainWindow: BrowserWindow | null = null;
let gateway: DesktopGateway | null = null;
let store: DesktopStore | null = null;
let uiProcess: ChildProcess | null = null;
let printWorker: DesktopPrintWorker | null = null;
let deviceAuthToken: string | null = null;
let printTimer: NodeJS.Timeout | null = null;
let shutdownStarted = false;
let shutdownComplete = false;

type UpdateStatus = {
  state:
    | "disabled"
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "up-to-date"
    | "error";
  version: string | null;
  percent: number | null;
  message: string | null;
  checkedAt: string | null;
};

let updateStatus: UpdateStatus = {
  state: "disabled",
  version: null,
  percent: null,
  message: null,
  checkedAt: null,
};
let updateTimer: NodeJS.Timeout | null = null;

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  void app.whenReady().then(startDesktop).catch((error) => {
    console.error("[desktop] startup failed", error);
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (!mainWindow) {
    void createWindow();
  }
});

app.on("before-quit", (event) => {
  if (shutdownComplete) return;
  event.preventDefault();
  if (shutdownStarted) return;
  shutdownStarted = true;
  void shutdownDesktop()
    .catch((error: unknown) => {
      console.error("[desktop] graceful shutdown failed", error);
    })
    .finally(() => {
      shutdownComplete = true;
      app.quit();
    });
});

async function shutdownDesktop(): Promise<void> {
  if (printTimer) {
    clearInterval(printTimer);
    printTimer = null;
  }
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }

  uiProcess?.kill();
  uiProcess = null;
  const activeGateway = gateway;
  const activePrintWorker = printWorker;
  printWorker = null;

  const results = await Promise.allSettled([
    activeGateway?.stop(),
    activePrintWorker?.stop(),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[desktop] runtime shutdown task failed", result.reason);
    }
  }

  gateway = null;
  try {
    store?.close();
  } catch (error) {
    console.error("[desktop] local database close failed", error);
  }
  store = null;
}

async function startDesktop(): Promise<void> {
  const dataDirectory = join(app.getPath("userData"), "runtime");
  await mkdir(dataDirectory, { recursive: true });
  store = new DesktopStore(join(dataDirectory, "mazetto-desktop.sqlite"));
  deviceAuthToken = readProtectedDeviceToken();
  printWorker = new DesktopPrintWorker({
    apiUrl: UPSTREAM_API_URL,
    printerHost: store.getSetting("printer_host") || process.env.MAZETTO_PRINTER_HOST?.trim() || null,
    printerPort: Number(store.getSetting("printer_port") || process.env.MAZETTO_PRINTER_PORT || 9100),
    agentId: `desktop-${store.deviceId()}`,
    deviceId: store.deviceId(),
    deviceToken: deviceAuthToken,
    systemPrinters: readSystemPrinterTargets(),
    printSystem: silentPrintReceipt,
    localQueue: {
      claim: (documentTypes) => store?.claimLocalPrintJob(documentTypes) ?? null,
      markPrinting: (id) => store?.markLocalPrintJobPrinting(id) ?? false,
      complete: (id, attemptId) => store?.completeLocalPrintJob(id, attemptId),
      fail: (id, error, ambiguous, attemptId) =>
        store?.failLocalPrintJob(id, error, new Date(), ambiguous, attemptId),
      wasPrinted: (orderId, documentType) =>
        store?.wasLocalDocumentPrinted(orderId, documentType) ?? false,
      wasTargetPrinted: (scope, jobId, printerName) =>
        store?.wasPrintTargetPrinted(scope, jobId, printerName) ?? false,
      markTargetPrinted: (scope, jobId, printerName) =>
        store?.recordPrintTarget(scope, jobId, printerName, "printed"),
      markTargetAmbiguous: (scope, jobId, printerName) =>
        store?.recordPrintTarget(scope, jobId, printerName, "ambiguous"),
    },
  });
  gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: GATEWAY_PORT,
    upstreamApiUrl: UPSTREAM_API_URL,
    store,
    onAuthorization: (authorization) =>
      printWorker?.setAuthorization(authorization),
    getDeviceToken: () => deviceAuthToken,
  });
  setupPrinterControls();
  setupDeviceEnrollment();
  setupAuthControls();
  setupApiControls();
  setupSessionControls();
  setupSyncControls();
  setupSupportControls();
  await gateway.start();
  printTimer = setInterval(() => void printWorker?.tick(), 1_000);
  printTimer.unref();
  setupAutoUpdater();
  const uiUrl = await resolveUiUrl();
  await createWindow(uiUrl);
}

async function createWindow(uiUrl?: string): Promise<void> {
  if (mainWindow) {
    return;
  }

  const targetUiUrl = uiUrl ?? (await resolveUiUrl());
  const icon = join(
    app.getAppPath(),
    "..",
    "pos-web",
    "public",
    "brand",
    "mazetto-m-icon-192-v2.png",
  );
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#f3f8f6",
    show: false,
    icon,
    title: "MAZETTO Desktop",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      preload: join(app.getAppPath(), "dist", "preload.cjs"),
    },
  });

  mainWindow.removeMenu();
  mainWindow.webContents.setUserAgent(
    `${mainWindow.webContents.getUserAgent()} MAZETTO-Desktop/${app.getVersion()}`,
  );
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    const allowed = target.origin === new URL(targetUiUrl).origin;
    if (!allowed) {
      event.preventDefault();
      if (target.protocol === "https:") {
        void shell.openExternal(url);
      }
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  try {
    await mainWindow.loadURL(targetUiUrl);
  } catch {
    await mainWindow.loadURL(offlineShellUrl(targetUiUrl));
    mainWindow.show();
  }
}

function setupAutoUpdater(): void {
  const feedUrl = DESKTOP_UPDATE_URL;

  ipcMain.removeHandler("desktop:updates:status");
  ipcMain.removeHandler("desktop:updates:check");
  ipcMain.removeHandler("desktop:updates:download");
  ipcMain.removeHandler("desktop:updates:install");
  ipcMain.handle("desktop:updates:status", () => updateStatus);
  ipcMain.handle("desktop:updates:check", async () => {
    await checkForUpdates(feedUrl);
    return updateStatus;
  });
  ipcMain.handle("desktop:updates:download", async () => {
    if (updateStatus.state === "available") {
      await autoUpdater.downloadUpdate();
    }
    return updateStatus;
  });
  ipcMain.handle("desktop:updates:install", () => {
    if (updateStatus.state === "downloaded") {
      autoUpdater.quitAndInstall(false, true);
    }
    return updateStatus;
  });

  if (!app.isPackaged || !feedUrl) {
    setUpdateStatus({
      state: "disabled",
      message: app.isPackaged
        ? "Yangilanish serveri sozlanmagan."
        : "Development rejimida avtomatik yangilanish o'chirilgan.",
    });
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL(resolveDesktopUpdateFeed(feedUrl));
  autoUpdater.on("checking-for-update", () =>
    setUpdateStatus({ state: "checking", message: null }),
  );
  autoUpdater.on("update-available", (info) =>
    setUpdateStatus({
      state: "available",
      version: info.version,
      percent: null,
      message: null,
    }),
  );
  autoUpdater.on("update-not-available", () =>
    setUpdateStatus({
      state: "up-to-date",
      version: app.getVersion(),
      percent: null,
      message: null,
    }),
  );
  autoUpdater.on("download-progress", (progress) =>
    setUpdateStatus({
      state: "downloading",
      percent: Math.round(progress.percent),
      message: null,
    }),
  );
  autoUpdater.on("update-downloaded", (info) =>
    setUpdateStatus({
      state: "downloaded",
      version: info.version,
      percent: 100,
      message: null,
    }),
  );
  autoUpdater.on("error", (error) =>
    setUpdateStatus({ state: "error", message: error.message }),
  );

  updateTimer = setInterval(
    () => void checkForUpdates(feedUrl),
    6 * 60 * 60 * 1000,
  );
  updateTimer.unref();
  void checkForUpdates(feedUrl);
}

async function checkForUpdates(feedUrl: string | undefined): Promise<void> {
  if (!app.isPackaged || !feedUrl) {
    return;
  }

  try {
    await autoUpdater.checkForUpdates();
    updateStatus = { ...updateStatus, checkedAt: new Date().toISOString() };
    broadcastUpdateStatus();
  } catch (error) {
    setUpdateStatus({
      state: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function setUpdateStatus(next: Partial<UpdateStatus>): void {
  updateStatus = {
    ...updateStatus,
    ...next,
    checkedAt: new Date().toISOString(),
  };
  broadcastUpdateStatus();
}

function broadcastUpdateStatus(): void {
  mainWindow?.webContents.send("desktop:updates:status", updateStatus);
}

async function resolveUiUrl(): Promise<string> {
  const configured = process.env.MAZETTO_DESKTOP_UI_URL?.trim();
  if (configured) {
    return configured;
  }

  const useBundledUi = app.isPackaged || process.argv.includes("--bundled-ui");
  if (!useBundledUi) {
    return "http://127.0.0.1:3001";
  }

  const packagedUiDirectory = join(process.resourcesPath, "ui");
  const developmentUiDirectory = join(app.getAppPath(), "runtime", "pos-web");
  const uiDirectory = existsSync(packagedUiDirectory)
    ? packagedUiDirectory
    : developmentUiDirectory;
  const serverEntry = join(uiDirectory, "apps", "pos-web", "server.js");
  const nodeExecutable = existsSync(join(uiDirectory, "node.exe"))
    ? join(uiDirectory, "node.exe")
    : process.execPath;
  console.error("[desktop] starting bundled UI", {
    nodeExecutable,
    serverEntry,
    uiDirectory,
  });
  uiProcess = spawn(nodeExecutable, [serverEntry], {
    cwd: join(uiDirectory, "apps", "pos-web"),
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: "7360",
    },
    stdio: app.isPackaged ? "ignore" : "inherit",
    windowsHide: true,
  });
  uiProcess.once("error", (error) =>
    console.error("[desktop] bundled UI process error", error),
  );
  uiProcess.once("exit", (code, signal) =>
    console.error("[desktop] bundled UI process exited", { code, signal }),
  );

  const localUrl = "http://127.0.0.1:7360";
  await waitForUi(`${localUrl}/api/health`, 30_000);
  return localUrl;
}

async function waitForUi(healthUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (uiProcess?.exitCode !== null) {
      throw new Error(
        `Bundled UI exited with code ${uiProcess?.exitCode ?? "unknown"}`,
      );
    }

    try {
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(1_500),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Bundled UI did not start within 30 seconds");
}

function offlineShellUrl(uiUrl: string): string {
  const statusUrl = `http://127.0.0.1:${GATEWAY_PORT}/desktop/status`;
  const html = `<!doctype html><html lang="uz"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MAZETTO Desktop</title><style>body{margin:0;background:#f3f8f6;color:#062f31;font:16px system-ui,sans-serif}main{max-width:680px;margin:12vh auto;padding:32px}img{width:64px;height:64px;border-radius:12px}h1{font-size:28px;margin:18px 0 8px}p{line-height:1.55;color:#46615f}button{border:1px solid #00605d;background:#00605d;color:#fff;padding:10px 16px;border-radius:6px;font-weight:700;cursor:pointer}code{display:block;margin-top:20px;padding:12px;background:#fff;border:1px solid #cfddda;border-radius:6px}</style><main><img src="file://${join(app.getAppPath(), "..", "pos-web", "public", "brand", "mazetto-m-icon-192-v2.png").replace(/\\/g, "/")}" alt=""><h1>Mahalliy panel ishga tushmadi</h1><p>Desktop runtime va lokal baza ishlayapti, lekin POS interfeysi topilmadi. Ilovani qayta ishga tushiring yoki diagnostika manzilini tekshiring.</p><button onclick="location.href='${uiUrl}'">Qayta urinish</button><code>${statusUrl}</code></main></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function setupDeviceEnrollment(): void {
  ipcMain.removeHandler("desktop:device:enroll");
  ipcMain.handle(
    "desktop:device:enroll",
    async (_event, input: { deviceId?: unknown; enrollmentCode?: unknown }) => {
      const deviceId = typeof input?.deviceId === "string" ? input.deviceId.trim() : "";
      const enrollmentCode = typeof input?.enrollmentCode === "string" ? input.enrollmentCode.trim().toUpperCase() : "";
      if (!deviceId || !enrollmentCode) throw new Error("Qurilma ID va ulanish kodini kiriting");
      const response = await fetch(UPSTREAM_API_URL + "/devices/enroll", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, enrollmentCode, softwareVersion: app.getVersion() }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = (await response.json().catch(() => null)) as { data?: unknown; error?: { message?: string | string[] } } | null;
      const message = payload?.error?.message;
      if (!response.ok) throw new Error(Array.isArray(message) ? message.join(", ") : message || "Qurilmani ulashda server xatosi (" + response.status + ")");
      const result = (payload?.data ?? payload) as Record<string, unknown> | null;
      if (!result) throw new Error("Server qurilma ma'lumotini qaytarmadi");
      const deviceToken = typeof result?.deviceToken === "string" ? result.deviceToken : "";
      if (!deviceToken) throw new Error("Server qurilma maxfiy kalitini qaytarmadi");
      saveProtectedDeviceToken(deviceToken);
      deviceAuthToken = deviceToken;
      printWorker?.setDeviceToken(deviceToken);
      const safeResult = { ...result };
      delete safeResult.deviceToken;
      return safeResult;
    },
  );
}

function setupPrinterControls(): void {
  ipcMain.removeHandler("desktop:printer:status");
  ipcMain.removeHandler("desktop:printer:save");
  ipcMain.removeHandler("desktop:printer:test");
  ipcMain.removeHandler("desktop:printer:list-system");
  ipcMain.removeHandler("desktop:printer:save-system");
  ipcMain.removeHandler("desktop:printer:test-system");
  ipcMain.handle("desktop:printer:status", () => printWorker?.status() ?? { configured: false, host: null, port: 9100, managedPrinters: 0, managedPrinterDetails: [] });
  ipcMain.handle("desktop:printer:save", async (_event, input: { host?: unknown; port?: unknown }) => {
    const host = typeof input?.host === "string" ? input.host.trim() : "";
    const port = Number(input?.port);
    if (!host || host.length > 253 || !/^[a-zA-Z0-9.-]+$/.test(host)) throw new Error("Printer manzilini to‘g‘ri kiriting");
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Printer porti 1–65535 oralig‘ida bo‘lishi kerak");
    store?.setSetting("printer_host", host);
    store?.setSetting("printer_port", String(port));
    printWorker?.configure(host, port);
    return printWorker?.status();
  });
  ipcMain.handle("desktop:printer:test", () => printWorker?.testConnection());
  ipcMain.removeHandler("desktop:printer:test-managed");
  ipcMain.handle("desktop:printer:test-managed", () => printWorker?.testManagedConnections());
  ipcMain.handle("desktop:printer:list-system", async () => {
    if (!mainWindow) return [];
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map((printer) => {
      const extended = printer as typeof printer & { status?: number; isDefault?: boolean };
      return ({
      name: printer.name,
      displayName: printer.displayName || printer.name,
      description: printer.description || null,
      status: extended.status ?? 0,
      isDefault: extended.isDefault ?? false,
    });
    });
  });
  ipcMain.handle(
    "desktop:printer:save-system",
    async (_event, input: { printers?: unknown }) => {
      const printers = normalizeSystemPrinterTargets(input?.printers);
      store?.setSetting("system_printers", JSON.stringify(printers));
      printWorker?.configureSystemPrinters(printers);
      return printWorker?.status();
    },
  );
  ipcMain.handle(
    "desktop:printer:test-system",
    async (_event, input: {
      name?: unknown;
      role?: unknown;
      paperFormat?: unknown;
      paperWidthMm?: unknown;
      paperHeightMm?: unknown;
    }) => {
      const name = typeof input?.name === "string" ? input.name.trim() : "";
      if (!name) throw new Error("Windows printerini tanlang");
      const role = typeof input?.role === "string" ? input.role : "RECEIPT";
      const paperSettings = normalizeWindowsPaperSettings(input, name);
      await silentPrintReceipt(name, {
        receiptNumber: "TEST",
        documentType: role,
        content: {
          documentType: role,
          statusLabel: role === "KITCHEN" ? "OSHXONA TEST CHEKI" : "PRINTER TEST CHEKI",
          branchName: "MAZETTO FOOD",
          orderNumber: "TEST-001",
          displayOrderNumber: "TEST-001",
          items: [{ productName: "Test mahsulot", quantity: "1", totalPrice: "1000" }],
          payments: [{ method: "CASH", amount: "1000" }],
          total: "1000",
          dateTime: new Date().toISOString(),
        },
      }, paperSettings);
      return { ok: true };
    },
  );
}

function setupAuthControls(): void {
  ipcMain.removeHandler("desktop:auth:credentials:list");
  ipcMain.removeHandler("desktop:auth:credentials:get");
  ipcMain.removeHandler("desktop:auth:credentials:save");
  ipcMain.removeHandler("desktop:auth:credentials:remove");
  ipcMain.handle("desktop:auth:credentials:list", () =>
    readSavedDesktopCredentials().map(({ identifier }) => identifier),
  );
  ipcMain.handle("desktop:auth:credentials:get", (_event, value: unknown) => {
    const identifier = typeof value === "string"
      ? normalizeSavedCredentialIdentifier(value)
      : "";
    return readSavedDesktopCredentials().find(
      (entry) => normalizeSavedCredentialIdentifier(entry.identifier) === identifier,
    ) ?? null;
  });
  ipcMain.handle(
    "desktop:auth:credentials:save",
    (_event, input: { identifier?: unknown; password?: unknown }) => {
      if (typeof input?.identifier !== "string" || typeof input.password !== "string") {
        throw new Error("Saqlanadigan login ma'lumoti noto'g'ri");
      }
      const credentials = upsertSavedDesktopCredential(
        readSavedDesktopCredentials(),
        input.identifier,
        input.password,
      );
      saveProtectedSetting(SAVED_LOGIN_CREDENTIALS_KEY, JSON.stringify(credentials));
      return credentials.map(({ identifier }) => identifier);
    },
  );
  ipcMain.handle("desktop:auth:credentials:remove", (_event, value: unknown) => {
    if (typeof value !== "string") {
      throw new Error("O'chiriladigan login ma'lumoti noto'g'ri");
    }
    const credentials = removeSavedDesktopCredential(
      readSavedDesktopCredentials(),
      value,
    );
    saveProtectedSetting(SAVED_LOGIN_CREDENTIALS_KEY, JSON.stringify(credentials));
    return credentials.map(({ identifier }) => identifier);
  });

  ipcMain.removeHandler("desktop:auth:login");
  ipcMain.handle(
    "desktop:auth:login",
    async (_event, input: { identifier?: unknown; password?: unknown }) => {
      const identifier = typeof input?.identifier === "string" ? input.identifier.trim() : "";
      const password = typeof input?.password === "string" ? input.password : "";
      if (!identifier || !password) throw new Error("Login va parolni kiriting");

      const response = await fetch(`${UPSTREAM_API_URL}/auth/login`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-mazetto-device-id": store?.deviceId() ?? "",
          ...(deviceAuthToken ? { "x-mazetto-device-token": deviceAuthToken } : {}),
        },
        body: JSON.stringify({ identifier, password }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: { tokens?: { accessToken?: string; tokenType?: string } };
        error?: DesktopApiError;
      } | null;
      if (!response.ok || !payload?.success || !payload.data?.tokens?.accessToken) {
        throw new Error(formatDesktopApiError(
          payload?.error,
          response.status,
          "Login amalga oshmadi",
        ));
      }

      const heartbeat = await fetch(`${UPSTREAM_API_URL}/devices/heartbeat`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `${payload.data.tokens.tokenType ?? "Bearer"} ${payload.data.tokens.accessToken}`,
          "x-mazetto-device-id": store?.deviceId() ?? "",
          ...(deviceAuthToken ? { "x-mazetto-device-token": deviceAuthToken } : {}),
        },
        body: JSON.stringify({ softwareVersion: app.getVersion() }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!heartbeat.ok) {
        const heartbeatPayload = (await heartbeat.json().catch(() => null)) as {
          error?: DesktopApiError;
        } | null;
        throw new Error(formatDesktopApiError(
          heartbeatPayload?.error,
          heartbeat.status,
          "Qurilma tasdiqlanmagan yoki ushbu foydalanuvchiga ruxsat berilmagan",
        ));
      }

      // Native login local gatewayni chetlab o'tishi mumkin. Printer worker ham
      // shu sessiya bilan server navbatini olishi uchun tokenni bevosita beramiz.
      printWorker?.setAuthorization(
        `${payload.data.tokens.tokenType ?? "Bearer"} ${payload.data.tokens.accessToken}`,
      );
      return payload.data;
    },
  );
}

function setupApiControls(): void {
  ipcMain.removeHandler("desktop:api:request");
  ipcMain.handle(
    "desktop:api:request",
    async (_event, input: {
      path?: unknown;
      method?: unknown;
      body?: unknown;
      headers?: unknown;
    }) => {
      const path = typeof input?.path === "string" ? input.path : "";
      const method = typeof input?.method === "string" ? input.method.toUpperCase() : "GET";
      const body = typeof input?.body === "string" ? input.body : undefined;
      if (!path.startsWith("/") || path.startsWith("//") || !/^[A-Z]+$/.test(method)) {
        throw new Error("Desktop API so'rovi noto'g'ri");
      }

      const requestHeaders = new Headers({ Accept: "application/json" });
      if (input?.headers && typeof input.headers === "object") {
        for (const [name, value] of Object.entries(input.headers as Record<string, unknown>)) {
          if (typeof value === "string" && /^(authorization|content-type|idempotency-key)$/i.test(name)) {
            requestHeaders.set(name, value);
          }
        }
      }
      requestHeaders.set("x-mazetto-device-id", store?.deviceId() ?? "");
      if (deviceAuthToken) requestHeaders.set("x-mazetto-device-token", deviceAuthToken);

      /*
       * The renderer already talks to the local gateway in desktop mode, but
       * apiFetch falls back to this native bridge when browser fetch fails.
       * Keep the fallback on the same gateway too; otherwise an offline sale
       * bypasses the outbox/local-print logic and becomes a raw `fetch failed`.
       */
      const response = await fetch(`${LOCAL_GATEWAY_API_URL}${path}`, {
        method,
        headers: requestHeaders,
        ...(body ? { body } : {}),
        signal: AbortSignal.timeout(15_000),
      });
      return {
        body: await response.text(),
        contentType: response.headers.get("content-type") ?? "application/json; charset=utf-8",
        status: response.status,
        desktopSource: response.headers.get("X-Mazetto-Desktop"),
        cachedAt: response.headers.get("X-Mazetto-Cached-At"),
      };
    },
  );
}

function readSystemPrinterTargets(): SystemPrinterTarget[] {
  const source = store?.getSetting("system_printers");
  if (!source) return [];
  try {
    return normalizeSystemPrinterTargets(JSON.parse(source));
  } catch {
    return [];
  }
}

function normalizeSystemPrinterTargets(value: unknown): SystemPrinterTarget[] {
  if (!Array.isArray(value)) return [];
  const validRoles = new Set(["RECEIPT", "KITCHEN", "CANCELLATION", "REFUND", "BAR"]);
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name || name.length > 260) return [];
    const displayName = typeof record.displayName === "string" && record.displayName.trim()
      ? record.displayName.trim()
      : name;
    const roles = Array.isArray(record.roles)
      ? [...new Set(record.roles.filter((role): role is string => typeof role === "string" && validRoles.has(role)))]
      : [];
    const paperSettings = normalizeWindowsPaperSettings(record, name);
    return roles.length > 0 ? [{ name, displayName, roles, ...paperSettings }] : [];
  });
}

async function silentPrintReceipt(
  deviceName: string,
  receipt: PrintableReceipt,
  selectedPaperInput?: unknown,
): Promise<void> {
  const paper = normalizeWindowsPaperSettings(selectedPaperInput, deviceName);
  const paperWidthMm = paper.paperWidthMm;
  const window = new BrowserWindow({
    show: false,
    width: paperWidthMm === 210 ? 900 : Math.min(1_600, Math.max(420, Math.round(paperWidthMm * 4.25 + 80))),
    height: paper.paperFormat === "LABEL"
      ? Math.max(300, Math.round((paper.paperHeightMm ?? 80) * 4.25 + 80))
      : 800,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    await withTimeout(
      window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printableReceiptHtml(receipt, paper))}`),
      10_000,
      () => new Error("Chek oynasi 10 soniyada tayyor bo'lmadi"),
    );
    // Hidden oynada `loadURL` tugashi sahifa birinchi marta chizilganini
    // kafolatlamaydi. Godex kabi Windows drayverlari shu onda print qilinsa
    // bo'sh sahifa berishi mumkin, shuning uchun ikki frame kutamiz.
    await withTimeout(
      window.webContents.executeJavaScript(
        "new Promise((resolve, reject) => requestAnimationFrame(() => requestAnimationFrame(() => { if (!document.body || !document.body.innerText.trim()) reject(new Error(\"Chek oynasi bo'sh render bo'ldi\")); else resolve(); })))",
        true,
      ),
      8_000,
      () => new Error("Chek maketi 8 soniyada chizilmadi"),
    );
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        window.webContents.print(
          {
            silent: true,
            deviceName,
            printBackground: true,
            ...windowsPrintPageSize(paper),
            margins: { marginType: "none" },
          },
          (success, failureReason) =>
            success
              ? resolve()
              : reject(
                  new Error(
                    failureReason || "Printer chop etishni rad etdi",
                  ),
                ),
        );
      }),
      30_000,
      () =>
        new PrintOutcomeUnknownError(
          `"${deviceName}" printerining drayveri 30 soniyada javob bermadi; qog'ozni tekshiring.`,
        ),
    );
  } finally {
    window.destroy();
  }
}

function setupSupportControls(): void {
  ipcMain.removeHandler("desktop:support:export");
  ipcMain.handle("desktop:support:export", async () => {
    if (!store) throw new Error("Desktop ma'lumotlar bazasi tayyor emas");
    const generatedAt = new Date();
    const defaultName = `mazetto-support-${generatedAt.toISOString().replace(/[:.]/g, "-")}.json`;
    const dialogOptions = {
      title: "Diagnostika faylini saqlash",
      defaultPath: join(app.getPath("downloads"), defaultName),
      filters: [{ name: "JSON", extensions: ["json"] }],
    };
    const selected = mainWindow
      ? await dialog.showSaveDialog(mainWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);
    if (selected.canceled || !selected.filePath) return null;

    const bundle = {
      schemaVersion: 1,
      generatedAt: generatedAt.toISOString(),
      application: {
        name: app.getName(),
        version: app.getVersion(),
        packaged: app.isPackaged,
        platform: process.platform,
        architecture: process.arch,
      },
      device: {
        id: store.deviceId(),
        enrolledCredentialPresent: Boolean(deviceAuthToken),
      },
      connectivity: gateway?.status() ?? null,
      printers: printWorker?.status() ?? null,
      updates: updateStatus,
      upstreamOrigin: new URL(UPSTREAM_API_URL).origin,
    };
    await writeFile(selected.filePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
    shell.showItemInFolder(selected.filePath);
    return { path: selected.filePath };
  });
}

function setupSessionControls(): void {
  ipcMain.removeHandler("desktop:session:load");
  ipcMain.removeHandler("desktop:session:save");
  ipcMain.removeHandler("desktop:session:clear");
  ipcMain.handle("desktop:session:load", () => {
    const serialized = readProtectedSetting("staff_auth_session_encrypted");
    syncPrinterAuthorization(serialized);
    return serialized;
  });
  ipcMain.handle("desktop:session:save", (_event, serialized: unknown) => {
    if (typeof serialized !== "string" || serialized.length > 100_000) {
      throw new Error("Sessiya ma'lumoti noto'g'ri");
    }
    saveProtectedSetting("staff_auth_session_encrypted", serialized);
    syncPrinterAuthorization(serialized);
  });
  ipcMain.handle("desktop:session:clear", () => {
    store?.setSetting("staff_auth_session_encrypted", "");
    printWorker?.setAuthorization(undefined);
  });
}

function setupSyncControls(): void {
  ipcMain.removeHandler("desktop:sync:realtime:origin");
  ipcMain.handle("desktop:sync:realtime:origin", () =>
    realtimeSocketOrigin(UPSTREAM_API_URL),
  );
  ipcMain.removeHandler("desktop:sync:cursor:load");
  ipcMain.removeHandler("desktop:sync:cursor:save");
  ipcMain.handle("desktop:sync:cursor:load", (_event, stream: unknown) => {
    const cursorStream = validateRealtimeCursorStream(stream);
    return store?.getSyncCursor(cursorStream) ?? null;
  });
  ipcMain.handle("desktop:sync:cursor:save", (_event, input: unknown) => {
    if (!input || typeof input !== "object") {
      throw new Error("Realtime cursor ma'lumoti noto'g'ri");
    }
    const value = input as Record<string, unknown>;
    const cursorStream = validateRealtimeCursorStream(value.stream);
    const cursor = value.cursor;
    if (
      typeof cursor !== "string" ||
      cursor.length > 65_536 ||
      !/^[A-Za-z0-9_-]+$/.test(cursor)
    ) {
      throw new Error("Realtime cursor noto'g'ri");
    }
    store?.setSyncCursor(cursorStream, cursor);
  });
}

function validateRealtimeCursorStream(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("mazetto.staff.realtime.cursor.") ||
    value.length > 512
  ) {
    throw new Error("Realtime cursor oqimi noto'g'ri");
  }
  return value;
}

function syncPrinterAuthorization(serialized: string | null): void {
  if (!serialized) {
    printWorker?.setAuthorization(undefined);
    return;
  }
  try {
    const value = JSON.parse(serialized) as {
      tokens?: { tokenType?: unknown; accessToken?: unknown };
    };
    const accessToken = value.tokens?.accessToken;
    if (typeof accessToken !== "string" || !accessToken.trim()) {
      printWorker?.setAuthorization(undefined);
      return;
    }
    const tokenType = typeof value.tokens?.tokenType === "string"
      ? value.tokens.tokenType
      : "Bearer";
    printWorker?.setAuthorization(`${tokenType} ${accessToken}`);
  } catch {
    printWorker?.setAuthorization(undefined);
  }
}

function readProtectedDeviceToken(): string | null {
  return readProtectedSetting("device_auth_token_encrypted");
}

function readSavedDesktopCredentials(): SavedDesktopCredential[] {
  return parseSavedDesktopCredentials(
    readProtectedSetting(SAVED_LOGIN_CREDENTIALS_KEY),
  );
}

function readProtectedSetting(key: string): string | null {
  const encrypted = store?.getSetting(key);
  if (!encrypted || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    return null;
  }
}

function saveProtectedDeviceToken(token: string): void {
  saveProtectedSetting("device_auth_token_encrypted", token);
}

function saveProtectedSetting(key: string, value: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Windows xavfsiz saqlash xizmati mavjud emas");
  }
  const encrypted = safeStorage.encryptString(value).toString("base64");
  store?.setSetting(key, encrypted);
}
