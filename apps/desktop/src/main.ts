import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { DesktopGateway } from "./gateway.js";
import { DesktopStore } from "./store.js";
import { DesktopPrintWorker } from "./print-worker.js";

const require = createRequire(import.meta.url);
const { autoUpdater } =
  require("electron-updater") as typeof import("electron-updater");

const GATEWAY_PORT = 7359;
const UPSTREAM_API_URL =
  process.env.MAZETTO_API_URL?.trim() || "https://api.mazettofood.uz/api/v1";
const DESKTOP_UPDATE_URL =
  process.env.MAZETTO_DESKTOP_UPDATE_URL?.trim() ||
  "https://github.com/ibrohimov0521/Mazetto-Food/releases/latest/download/";

let mainWindow: BrowserWindow | null = null;
let gateway: DesktopGateway | null = null;
let store: DesktopStore | null = null;
let uiProcess: ChildProcess | null = null;
let printWorker: DesktopPrintWorker | null = null;
let printTimer: NodeJS.Timeout | null = null;

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

app.on("before-quit", () => {
  if (printTimer) { clearInterval(printTimer); printTimer = null; }
  printWorker = null;
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
  uiProcess?.kill();
  uiProcess = null;
  void gateway?.stop();
  store?.close();
  gateway = null;
  store = null;
});

async function startDesktop(): Promise<void> {
  const dataDirectory = join(app.getPath("userData"), "runtime");
  await mkdir(dataDirectory, { recursive: true });
  store = new DesktopStore(join(dataDirectory, "mazetto-desktop.sqlite"));
  printWorker = new DesktopPrintWorker({ apiUrl: UPSTREAM_API_URL, printerHost: store.getSetting("printer_host") || process.env.MAZETTO_PRINTER_HOST?.trim() || null, printerPort: Number(store.getSetting("printer_port") || process.env.MAZETTO_PRINTER_PORT || 9100), agentId: `desktop-${store.deviceId()}` });
  gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: GATEWAY_PORT,
    upstreamApiUrl: UPSTREAM_API_URL,
    store,
  });
  setupPrinterControls();
  setupDeviceEnrollment();
  await gateway.start();
  printTimer = setInterval(() => void printWorker?.tick(), 3_000);
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
      preload: join(app.getAppPath(), "dist", "preload.js"),
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
  autoUpdater.setFeedURL({ provider: "generic", url: feedUrl });
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
      return payload?.data ?? payload;
    },
  );
}

function setupPrinterControls(): void {
  ipcMain.removeHandler("desktop:printer:status");
  ipcMain.removeHandler("desktop:printer:save");
  ipcMain.removeHandler("desktop:printer:test");
  ipcMain.handle("desktop:printer:status", () => printWorker?.status() ?? { configured: false, host: null, port: 9100 });
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
}