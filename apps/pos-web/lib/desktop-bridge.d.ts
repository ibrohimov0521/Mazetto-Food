type DesktopUpdateStatus = {
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

type DesktopSystemPrinter = {
  name: string;
  displayName: string;
  roles: string[];
  paperFormat: "ROLL" | "A4" | "LABEL";
  paperWidthMm: number;
  paperHeightMm?: number;
};

type DesktopPrinterStatus = {
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
  systemPrinters?: DesktopSystemPrinter[];
};

declare global {
  interface Window {
    mazettoDesktop?: {
      printer?: {
        status(): Promise<DesktopPrinterStatus>;
        save(input: { host: string; port: number }): Promise<DesktopPrinterStatus>;
        test(): Promise<void>;
        testManaged(): Promise<Array<{ name: string; ok: boolean }>>;
        listSystem(): Promise<
          Array<{
            name: string;
            displayName: string;
            description: string | null;
            status: number;
            isDefault: boolean;
          }>
        >;
        saveSystem(input: { printers: DesktopSystemPrinter[] }): Promise<DesktopPrinterStatus>;
        testSystem(input: {
          name: string;
          role: string;
          paperFormat?: "ROLL" | "A4" | "LABEL";
          paperWidthMm?: number;
          paperHeightMm?: number;
        }): Promise<{ ok: boolean }>;
      };
      device?: {
        enroll(input: { deviceId: string; enrollmentCode: string }): Promise<unknown>;
      };
      auth?: {
        login(input: { identifier: string; password: string }): Promise<unknown>;
        credentials?: {
          list(): Promise<string[]>;
          get(identifier: string): Promise<{ identifier: string; password: string } | null>;
          save(input: { identifier: string; password: string }): Promise<string[]>;
          remove(identifier: string): Promise<string[]>;
        };
      };
      api?: {
        request(input: {
          path: string;
          method: string;
          body?: string;
          headers?: Record<string, string>;
        }): Promise<{
          body: string;
          contentType: string;
          status: number;
          desktopSource: string | null;
          cachedAt: string | null;
        }>;
      };
      sync?: {
        realtimeOrigin(): Promise<string>;
        loadCursor(stream: string): Promise<string | null>;
        saveCursor(input: { stream: string; cursor: string }): Promise<void>;
      };
      updates?: {
        getStatus(): Promise<DesktopUpdateStatus>;
        check(): Promise<DesktopUpdateStatus>;
        download(): Promise<DesktopUpdateStatus>;
        install(): Promise<DesktopUpdateStatus>;
        onStatus(listener: (status: DesktopUpdateStatus) => void): () => void;
      };
      support?: {
        export(): Promise<{ path: string } | null>;
      };
      session?: {
        load(): Promise<string | null>;
        save(serialized: string): Promise<void>;
        clear(): Promise<void>;
      };
    };
  }
}

export {};

