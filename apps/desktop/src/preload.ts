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
});
