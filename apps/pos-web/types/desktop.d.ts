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
  };
  updates?: {
    getStatus: () => Promise<DesktopUpdateStatus>;
    check: () => Promise<DesktopUpdateStatus>;
    download: () => Promise<DesktopUpdateStatus>;
    install: () => Promise<DesktopUpdateStatus>;
    onStatus: (listener: (status: DesktopUpdateStatus) => void) => () => void;
  };
};

declare global {
  interface Window {
    mazettoDesktop?: DesktopBridge;
  }
}

export {};
