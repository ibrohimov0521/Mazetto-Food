import { contextBridge, ipcRenderer } from "electron";

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

contextBridge.exposeInMainWorld("mazettoDesktop", {
  printer: {
    status: () => ipcRenderer.invoke("desktop:printer:status"),
    save: (input: { host: string; port: number }) => ipcRenderer.invoke("desktop:printer:save", input),
    test: () => ipcRenderer.invoke("desktop:printer:test"),
    testManaged: () => ipcRenderer.invoke("desktop:printer:test-managed"),
    listSystem: () => ipcRenderer.invoke("desktop:printer:list-system"),
    saveSystem: (input: { printers: Array<{ name: string; displayName: string; roles: string[]; paperFormat?: "ROLL" | "A4" | "LABEL"; paperWidthMm?: number; paperHeightMm?: number }> }) =>
      ipcRenderer.invoke("desktop:printer:save-system", input),
    testSystem: (input: { name: string; role: string; paperFormat?: "ROLL" | "A4" | "LABEL"; paperWidthMm?: number; paperHeightMm?: number }) =>
      ipcRenderer.invoke("desktop:printer:test-system", input),
  },
  receiptProfiles: {
    load: () => ipcRenderer.invoke("desktop:receipt-profiles:load"),
    save: (profile: unknown) => ipcRenderer.invoke("desktop:receipt-profiles:save", profile),
    reset: () => ipcRenderer.invoke("desktop:receipt-profiles:reset"),
    preview: (input: { kind: string; profile: unknown; paperWidthMm: number }) =>
      ipcRenderer.invoke("desktop:receipt-profiles:preview", input),
  },
  device: {
    enroll: (input: { deviceId: string; enrollmentCode: string }) =>
      ipcRenderer.invoke("desktop:device:enroll", input),
  },
  auth: {
    login: (input: { identifier: string; password: string }) =>
      ipcRenderer.invoke("desktop:auth:login", input),
    credentials: {
      list: (): Promise<string[]> =>
        ipcRenderer.invoke("desktop:auth:credentials:list"),
      get: (identifier: string): Promise<{ identifier: string; password: string } | null> =>
        ipcRenderer.invoke("desktop:auth:credentials:get", identifier),
      save: (input: { identifier: string; password: string }): Promise<string[]> =>
        ipcRenderer.invoke("desktop:auth:credentials:save", input),
      remove: (identifier: string): Promise<string[]> =>
        ipcRenderer.invoke("desktop:auth:credentials:remove", identifier),
    },
  },
  api: {
    request: (input: {
      path: string;
      method: string;
      body?: string;
      headers?: Record<string, string>;
    }) => ipcRenderer.invoke("desktop:api:request", input),
  },
  sync: {
    realtimeOrigin: (): Promise<string> =>
      ipcRenderer.invoke("desktop:sync:realtime:origin"),
    loadCursor: (stream: string): Promise<string | null> =>
      ipcRenderer.invoke("desktop:sync:cursor:load", stream),
    saveCursor: (input: { stream: string; cursor: string }): Promise<void> =>
      ipcRenderer.invoke("desktop:sync:cursor:save", input),
  },
  updates: {
    getStatus: (): Promise<UpdateStatus> =>
      ipcRenderer.invoke("desktop:updates:status"),
    check: (): Promise<UpdateStatus> =>
      ipcRenderer.invoke("desktop:updates:check"),
    download: (): Promise<UpdateStatus> =>
      ipcRenderer.invoke("desktop:updates:download"),
    install: (): Promise<UpdateStatus> =>
      ipcRenderer.invoke("desktop:updates:install"),
    onStatus: (listener: (status: UpdateStatus) => void): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        status: UpdateStatus,
      ) => listener(status);
      ipcRenderer.on("desktop:updates:status", handler);
      return () =>
        ipcRenderer.removeListener("desktop:updates:status", handler);
    },
  },
  support: {
    export: (): Promise<{ path: string } | null> =>
      ipcRenderer.invoke("desktop:support:export"),
  },
  session: {
    load: (): Promise<string | null> =>
      ipcRenderer.invoke("desktop:session:load"),
    save: (serialized: string): Promise<void> =>
      ipcRenderer.invoke("desktop:session:save", serialized),
    clear: (): Promise<void> =>
      ipcRenderer.invoke("desktop:session:clear"),
  },
});
