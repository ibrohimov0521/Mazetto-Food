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
  systemPrinters: Array<{
    name: string;
    displayName: string;
    roles: string[];
  }>;
};

type DesktopSystemPrinter = {
  name: string;
  displayName: string;
  description: string | null;
  status: number;
  isDefault: boolean;
};

type DesktopPrinterConnectionResult =
  DesktopPrinterStatus["managedPrinterDetails"][number] & {
    ok: boolean;
    message: string | null;
  };

type DesktopBridge = {
  device?: {
    enroll: (input: { deviceId: string; enrollmentCode: string }) => Promise<{
      id: string;
      branchId: string;
      name: string;
      type: string;
      enrolledAt: string;
    }>;
  };
  printer?: {
    status: () => Promise<DesktopPrinterStatus>;
    save: (input: { host: string; port: number }) => Promise<DesktopPrinterStatus>;
    test: () => Promise<void>;
    testManaged: () => Promise<DesktopPrinterConnectionResult[]>;
    listSystem: () => Promise<DesktopSystemPrinter[]>;
    saveSystem: (input: { printers: Array<{ name: string; displayName: string; roles: string[] }> }) => Promise<DesktopPrinterStatus>;
    testSystem: (input: { name: string; role: string }) => Promise<{ ok: boolean }>;
  };
  updates?: {
    getStatus: () => Promise<DesktopUpdateStatus>;
    check: () => Promise<DesktopUpdateStatus>;
    download: () => Promise<DesktopUpdateStatus>;
    install: () => Promise<DesktopUpdateStatus>;
    onStatus: (listener: (status: DesktopUpdateStatus) => void) => () => void;
  };
  auth?: {
    login: (input: { identifier: string; password: string }) => Promise<unknown>;
  };
  api?: {
    request: (input: {
      path: string;
      method: string;
      body?: string;
      headers?: Record<string, string>;
    }) => Promise<{ body: string; contentType: string; status: number }>;
  };
  support?: {
    export: () => Promise<{ path: string } | null>;
  };
  session?: {
    load: () => Promise<string | null>;
    save: (serialized: string) => Promise<void>;
    clear: () => Promise<void>;
  };
};

declare global {
  interface Window {
    mazettoDesktop?: DesktopBridge;
  }
}

export {};
